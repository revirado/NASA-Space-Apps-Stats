// FILE: src/components/terminal/TerminalApp.tsx
// Vista raíz de la terminal de carga (Fase 2, privada). Flujo del algoritmo de
// ingesta (sección 5): subir archivos → clasificar/validar EN EL NAVEGADOR →
// resumen previo → fecha de captura obligatoria (D15) → guardar vía API. Los
// errores de DB conservan los archivos parseados para reintentar (sección 13).

'use client';

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { Rocket, TerminalSquare } from 'lucide-react';
import { LanguageProvider, useLanguage } from '@/i18n';
import { buildSnapshot, classifyFile, type ClassifyResult } from '@/domain/parser';
import { sha256Hex } from '@/lib/hash';
import { browserTimezone, zonedWallTimeToUtcIso } from '@/lib/timezone';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { UploadZone } from './UploadZone';
import { ParseLog } from './ParseLog';
import { CaptureMeta } from './CaptureMeta';
import { ValidationSummary } from './ValidationSummary';
import { SnapshotList, type SnapshotRowInfo } from './SnapshotList';
import type { LogLine, TerminalFile } from './types';

const TOKEN_KEY = 'pl-terminal-token';

/** «Store» nulo: misma técnica anti-hidratación del provider de idioma.
 *  El servidor renderiza 'UTC'; el cliente adopta su zona sin mismatch. */
const noopSubscribe = () => () => {};

export function TerminalApp() {
  return (
    <LanguageProvider>
      <TerminalInner />
    </LanguageProvider>
  );
}

function TerminalInner() {
  useLanguage();
  const { dict, lang } = useLanguage();
  const t = dict.terminal;
  const { toast } = useToast();

  // ---- Estado ----
  const [files, setFiles] = useState<TerminalFile[]>([]);
  const [log, setLog] = useState<LogLine[]>([]);
  const [parsing, setParsing] = useState(false);
  const [wall, setWall] = useState('');
  // TZ elegida por el autor (null = la del navegador, D15). El valor de
  // servidor es 'UTC' y el cliente adopta el suyo vía useSyncExternalStore.
  const browserTz = useSyncExternalStore(noopSubscribe, browserTimezone, () => 'UTC');
  const [tzChoice, setTzChoice] = useState<string | null>(null);
  const tz = tzChoice ?? browserTz;
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [tokenDialogOpen, setTokenDialogOpen] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [listItems, setListItems] = useState<SnapshotRowInfo[] | null>(null);
  const [listBusy, setListBusy] = useState(false);
  const tokenRef = useRef<string>('');

  const pushLog = (lines: LogLine[]) => setLog((prev) => [...prev, ...lines]);

  // Token de esta sesión del navegador (sección 15): ref, no estado.
  useEffect(() => {
    try {
      tokenRef.current = window.sessionStorage.getItem(TOKEN_KEY) ?? '';
    } catch {
      /* sin sessionStorage */
    }
  }, []);

  // ---- Parseo en el navegador ----
  const logLinesFor = (tf: TerminalFile): LogLine[] => {
    if (tf.result.ok) {
      const pf = tf.result.file;
      const lines: LogLine[] = [
        {
          kind: 'ok',
          text: `${tf.name} · ${t.recognized} · ${pf.hasEventBlock ? t.eventBlock : t.locationsOnly}`,
        },
        {
          kind: 'info',
          text: `  ${t.edgesLabel}: ${pf.edges.length} · ${t.offsetRange}: ${
            pf.offsetStart !== null && pf.offsetEnd !== null ? `${pf.offsetStart}–${pf.offsetEnd}` : '—'
          } · ${t.declared}: ${pf.totalCount ?? '—'} · ${
            pf.hasNextPage === null ? '' : pf.hasNextPage ? t.hasNextTrue : t.hasNextFalse
          }${pf.ignoredContentFilterBlocks > 0 ? ` · ${t.ignoredFilter}` : ''}`,
        },
        { kind: 'dim', text: `  ${t.shaLabel}: ${tf.sha256}` },
      ];
      for (const w of pf.warnings) lines.push({ kind: 'warn', text: `  ⚠ ${w}` });
      return lines;
    }
    return [
      { kind: 'err', text: `${tf.name} · ${t.rejected}` },
      { kind: 'err', text: `  ${tf.result.message}` },
    ];
  };

  const handleFiles = async (incoming: File[]) => {
    setParsing(true);
    const accepted: TerminalFile[] = [];
    for (const f of incoming) {
      pushLog([{ kind: 'cmd', text: t.logParsing.replace('{name}', f.name) }]);
      try {
        const buf = await f.arrayBuffer();
        const sha = await sha256Hex(buf);
        if (files.some((p) => p.sha256 === sha) || accepted.some((p) => p.sha256 === sha)) {
          pushLog([
            { kind: 'warn', text: `${f.name}: sha256=${sha.slice(0, 10)}… (ya agregado, se omite)` },
          ]);
          continue;
        }
        let result: ClassifyResult;
        try {
          const json = JSON.parse(new TextDecoder().decode(buf)) as unknown;
          result = classifyFile(f.name, json);
        } catch {
          result = { ok: false, code: 'INVALID_JSON', message: t.invalidJson };
        }
        const tf: TerminalFile = { name: f.name, size: f.size, sha256: sha, result };
        accepted.push(tf);
        pushLog(logLinesFor(tf));
      } catch (err) {
        pushLog([{ kind: 'err', text: `${f.name}: ${String(err)}` }]);
      }
    }
    if (accepted.length > 0) setFiles((prev) => [...prev, ...accepted]);
    setParsing(false);
  };

  const startOver = () => {
    setFiles([]);
    pushLog([{ kind: 'dim', text: t.startOver }]);
  };

  // ---- Validación (domain, isomórfica) ----
  const parsedFiles = useMemo(
    () => files.filter((f) => f.result.ok).map((f) => f.result.file),
    [files]
  );
  const utcIso = useMemo(
    () => (wall ? zonedWallTimeToUtcIso(wall, tz) : null),
    [wall, tz]
  );
  const build = useMemo(
    () => (parsedFiles.length > 0 && utcIso ? buildSnapshot(parsedFiles, utcIso) : null),
    [parsedFiles, utcIso]
  );

  const canSave = build?.ok === true && utcIso !== null && !saving;

  // ---- API helpers ----
  const headersWithToken = (): HeadersInit => ({
    'content-type': 'application/json',
    ...(tokenRef.current ? { 'x-terminal-token': tokenRef.current } : {}),
  });

  const refreshList = async () => {
    setListBusy(true);
    try {
      const res = await fetch('/api/terminal/snapshots', { headers: headersWithToken() });
      if (res.status === 401) {
        setTokenDialogOpen(true);
        setListItems([]);
        return;
      }
      if (!res.ok) {
        setListItems([]);
        return;
      }
      const data = (await res.json()) as { snapshots?: SnapshotRowInfo[] };
      setListItems(data.snapshots ?? []);
    } catch {
      setListItems([]);
    } finally {
      setListBusy(false);
    }
  };

  useEffect(() => {
    void refreshList();
  }, []);

  // ---- Guardar ----
  const doSave = async (replace: boolean) => {
    if (!build?.ok || !utcIso) return;
    setSaving(true);
    try {
      const payload = {
        capturedAt: utcIso,
        note: note.trim() ? note.trim() : null,
        replace,
        declaredTotal: build.snapshot.declaredTotal,
        global: build.snapshot.global,
        events: build.snapshot.events,
        files: files
          .filter((f) => f.result.ok)
          .map((f) => ({
            sha256: f.sha256,
            originalName: f.name,
            hasEventBlock: f.result.file.hasEventBlock,
            offsetStart: f.result.file.offsetStart,
            offsetEnd: f.result.file.offsetEnd,
          })),
      };
      const res = await fetch('/api/terminal/snapshot', {
        method: 'POST',
        headers: headersWithToken(),
        body: JSON.stringify(payload),
      });

      if (res.status === 404) {
        pushLog([{ kind: 'err', text: '404 — write APIs are not enabled in this deployment (section 15)' }]);
        toast({ title: '404', description: 'APP_MODE', variant: 'destructive' });
        return;
      }
      if (res.status === 401) {
        setTokenDialogOpen(true);
        return;
      }

      const data = (await res.json()) as {
        status?: string;
        missingVar?: string;
        error?: string;
      };

      switch (data.status) {
        case 'saved':
          pushLog([{ kind: 'ok', text: `✓ ${t.savedMsg}` }]);
          toast({ title: t.savedMsg });
          void refreshList();
          break;
        case 'unchanged':
          pushLog([{ kind: 'info', text: `= ${t.unchangedMsg}` }]);
          toast({ title: t.unchangedMsg });
          break;
        case 'needs_confirmation':
          setConfirmReplace(true);
          break;
        case 'unavailable':
          pushLog([{ kind: 'err', text: `✗ ${t.unavailableMsg}` }]);
          toast({ title: t.unavailableMsg, variant: 'destructive' });
          break;
        case 'uninitialized':
          pushLog([{ kind: 'err', text: `✗ ${t.uninitializedMsg}` }]);
          toast({ title: t.uninitializedMsg, variant: 'destructive' });
          break;
        case 'unconfigured':
          pushLog([
            { kind: 'err', text: `✗ ${t.unconfiguredMsg} ${data.missingVar ?? 'TERMINAL_TOKEN'}` },
          ]);
          toast({
            title: t.unconfiguredMsg,
            description: data.missingVar ?? 'TERMINAL_TOKEN',
            variant: 'destructive',
          });
          break;
        default:
          pushLog([{ kind: 'err', text: `✗ ${data.error ?? 'unknown error'}` }]);
          toast({ title: String(data.error ?? 'error'), variant: 'destructive' });
      }
    } catch {
      pushLog([{ kind: 'err', text: `✗ ${t.unavailableMsg}` }]);
      toast({ title: t.unavailableMsg, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // ---- Borrar captura ----
  const handleDelete = async (capturedAt: string) => {
    setListBusy(true);
    try {
      const res = await fetch(`/api/terminal/snapshot?capturedAt=${encodeURIComponent(capturedAt)}`, {
        method: 'DELETE',
        headers: headersWithToken(),
      });
      if (res.status === 401) {
        setTokenDialogOpen(true);
        return;
      }
      if (res.ok) {
        toast({ title: t.removedMsg });
        void refreshList();
      } else {
        toast({ title: `${t.unavailableMsg}`, variant: 'destructive' });
      }
    } catch {
      toast({ title: t.unavailableMsg, variant: 'destructive' });
    } finally {
      setListBusy(false);
    }
  };

  const submitToken = () => {
    tokenRef.current = tokenInput.trim();
    try {
      window.sessionStorage.setItem(TOKEN_KEY, tokenRef.current);
    } catch {
      /* sin sessionStorage */
    }
    setTokenInput('');
    setTokenDialogOpen(false);
  };

  return (
    <div
      className="flex min-h-screen flex-col bg-[var(--pl-page-bg)] text-[var(--pl-text-primary)]"
      style={{ fontFamily: 'var(--font-geist-mono), ui-monospace, SFMono-Regular, monospace' }}
    >
      {/* Header */}
      <header className="border-b border-[var(--pl-border)] bg-[var(--pl-surface)]">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-md border border-[var(--pl-border)] bg-[var(--pl-surface-sunken)]">
              <TerminalSquare className="size-5 text-[var(--pl-accent)]" aria-hidden />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--pl-accent)]">{dict.app.badge}</p>
              <h1 className="text-lg font-semibold leading-tight">{t.title}</h1>
              <p className="text-xs text-[var(--pl-text-muted)]">{t.subtitle}</p>
            </div>
          </div>
          <Link
            href="/dashboard"
            className="flex min-h-[44px] items-center gap-2 rounded-md border border-[var(--pl-border)] bg-[var(--pl-surface-raised)] px-3 py-2 text-xs text-[var(--pl-text-secondary)] transition-colors hover:bg-[var(--pl-surface-hover)]"
          >
            <Rocket className="size-3.5" aria-hidden />
            {t.dashLink}
          </Link>
        </div>
      </header>

      {/* Contenido */}
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-4 px-4 py-5">
        <UploadZone onFiles={handleFiles} busy={parsing} hasFiles={files.length > 0} />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ParseLog lines={log} />
          <CaptureMeta
            wall={wall}
            onWall={setWall}
            tz={tz}
            onTz={setTzChoice}
            note={note}
            onNote={setNote}
            utcIso={utcIso}
          />
        </div>

        <ValidationSummary
          files={files}
          build={build}
          canSave={canSave}
          saving={saving}
          onSave={() => void doSave(false)}
          onStartOver={startOver}
        />

        <SnapshotList items={listItems} onDelete={handleDelete} busy={listBusy} />
      </main>

      {/* Footer sticky (mt-auto) */}
      <footer className="mt-auto border-t border-[var(--pl-border)] bg-[var(--pl-surface)]">
        <div className="mx-auto w-full max-w-5xl px-4 py-3 text-center text-xs text-[var(--pl-text-muted)]">
          {dict.footer.credit}{' '}
          <a
            href="https://ariellamas.tech"
            target="_blank"
            rel="noreferrer"
            className="text-[var(--pl-accent-gold)] hover:underline"
          >
            ariellamas.tech
          </a>
          <span aria-hidden> · </span>
          <span className="lowercase">{lang === 'es' ? 'los JSON crudos son la fuente de verdad' : 'raw JSONs are the source of truth'}</span>
        </div>
      </footer>

      {/* Confirmación de reemplazo (paso 9: misma fecha con archivos distintos) */}
      <AlertDialog open={confirmReplace} onOpenChange={setConfirmReplace}>
        <AlertDialogContent className="border-[var(--pl-border)] bg-[var(--pl-surface-raised)]">
          <AlertDialogHeader>
            <AlertDialogTitle>{t.needsConfirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>{t.needsConfirmBody}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-[44px]">{t.replaceNo}</AlertDialogCancel>
            <AlertDialogAction
              className="min-h-[44px] bg-[var(--pl-warning)] text-black hover:bg-[var(--pl-warning)] hover:opacity-90"
              onClick={() => void doSave(true)}
            >
              {t.replaceYes}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Token (sección 15, defensa en profundidad #4) */}
      <AlertDialog open={tokenDialogOpen} onOpenChange={setTokenDialogOpen}>
        <AlertDialogContent className="border-[var(--pl-border)] bg-[var(--pl-surface-raised)]">
          <AlertDialogHeader>
            <AlertDialogTitle>{t.tokenPromptTitle}</AlertDialogTitle>
            <AlertDialogDescription>{t.tokenPromptBody}</AlertDialogDescription>
          </AlertDialogHeader>
          <input
            type="password"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder={t.tokenPlaceholder}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && tokenInput.trim()) submitToken();
            }}
            className="w-full rounded-md border border-[var(--pl-border)] bg-[var(--pl-surface-sunken)] px-3 py-2 text-sm text-[var(--pl-text-primary)] placeholder:text-[var(--pl-text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pl-accent-gold)]"
          />
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-[44px]" onClick={() => setTokenInput('')}>
              {t.replaceNo}
            </AlertDialogCancel>
            <AlertDialogAction
              className="min-h-[44px]"
              disabled={!tokenInput.trim()}
              onClick={submitToken}
            >
              {t.tokenSubmit}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
