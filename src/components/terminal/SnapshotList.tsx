// FILE: src/components/terminal/SnapshotList.tsx
// Capturas ya guardadas en la base, con borrado con confirmación. La base es
// descartable: borrar una captura deja al dashboard en «sin datos» hasta la
// próxima carga; los JSON crudos del autor siguen siendo la fuente de verdad.

'use client';

import { useState } from 'react';
import { Database, Trash2 } from 'lucide-react';
import { useLanguage } from '@/i18n';
import { formatCapturedAt, formatNumber } from '@/lib/format';
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

export interface SnapshotRowInfo {
  capturedAt: string;
  note: string | null;
  declaredTotal: number;
  totalRegistrations: number | null;
  files: number;
  locations: number;
}

interface SnapshotListProps {
  items: SnapshotRowInfo[] | null; // null = cargando
  onDelete: (capturedAt: string) => void;
  busy: boolean;
}

export function SnapshotList({ items, onDelete, busy }: SnapshotListProps) {
  const { dict, lang } = useLanguage();
  const t = dict.terminal;
  const [pending, setPending] = useState<SnapshotRowInfo | null>(null);

  return (
    <section
      aria-label={t.listedTitle}
      className="rounded-lg border border-[var(--pl-border)] bg-[var(--pl-surface)] p-4"
    >
      <header className="mb-3 flex items-center gap-2">
        <Database className="size-4 text-[var(--pl-accent-gold)]" aria-hidden />
        <h2 className="text-sm font-medium text-[var(--pl-text-primary)]">{t.listedTitle}</h2>
        {items ? (
          <span className="text-xs text-[var(--pl-text-muted)]">({items.length})</span>
        ) : null}
      </header>

      {items === null ? (
        <div className="space-y-2" aria-hidden>
          <div className="h-10 animate-pulse rounded bg-[var(--pl-surface-hover)]" />
          <div className="h-10 animate-pulse rounded bg-[var(--pl-surface-hover)]" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-xs text-[var(--pl-text-muted)]">{t.listedEmpty}</p>
      ) : (
        <ul className="scrollbar-thin max-h-64 space-y-2 overflow-y-auto pr-1">
          {items.map((s) => (
            <li
              key={s.capturedAt}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--pl-border)] bg-[var(--pl-surface-sunken)] px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm text-[var(--pl-text-primary)]">
                  {formatCapturedAt(s.capturedAt, lang)}
                </p>
                <p className="text-xs text-[var(--pl-text-muted)]">
                  {formatNumber(s.locations, lang)} {t.listedLocations} · {s.files} {t.listedFiles}
                  {s.totalRegistrations !== null
                    ? ` · ${formatNumber(s.totalRegistrations, lang)} ${dict.common.registrants}`
                    : ''}
                  {s.note ? ` · ${s.note}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPending(s)}
                disabled={busy}
                aria-label={`${t.removeBtn}: ${s.capturedAt}`}
                className="flex min-h-[44px] items-center gap-1.5 rounded-md border border-[var(--pl-border)] px-3 py-2 text-xs text-[var(--pl-danger)] transition-colors hover:bg-[var(--pl-surface-hover)] disabled:opacity-50"
              >
                <Trash2 className="size-3.5" aria-hidden />
                {t.removeBtn}
              </button>
            </li>
          ))}
        </ul>
      )}

      <AlertDialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
        <AlertDialogContent className="border-[var(--pl-border)] bg-[var(--pl-surface-raised)]">
          <AlertDialogHeader>
            <AlertDialogTitle>{t.removeConfirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>{t.removeConfirmBody}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-[44px]">{t.replaceNo}</AlertDialogCancel>
            <AlertDialogAction
              className="min-h-[44px] bg-[var(--pl-danger)] text-white hover:bg-[var(--pl-danger)] hover:opacity-90"
              onClick={() => {
                if (pending) onDelete(pending.capturedAt);
                setPending(null);
              }}
            >
              {t.removeBtn}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
