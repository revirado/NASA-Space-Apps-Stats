// FILE: src/components/terminal/ValidationSummary.tsx
// Resumen previo al envío (paso 8 del algoritmo, sección 5): archivos
// detectados, locaciones, cifras globales y advertencias que no bloquean.
// Un rechazo muestra el motivo y nada se guarda.

'use client';

import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { useLanguage } from '@/i18n';
import { formatNumber } from '@/lib/format';
import type { BuildResult } from '@/domain/parser';
import type { TerminalFile } from './types';

interface ValidationSummaryProps {
  files: TerminalFile[];
  build: BuildResult | null; // null = nada que validar todavía
  canSave: boolean;
  saving: boolean;
  onSave: () => void;
  onStartOver: () => void;
}

const REJECT_MSG_KEY: Record<string, 'msgNoLocations' | 'msgGap' | 'msgDuplicates' | 'msgCountMismatch' | 'msgIncomplete'> = {
  NO_LOCATIONS: 'msgNoLocations',
  GAP_IN_OFFSETS: 'msgGap',
  DUPLICATE_IDS: 'msgDuplicates',
  COUNT_MISMATCH: 'msgCountMismatch',
  INCOMPLETE_LAST_PAGE: 'msgIncomplete',
};

export function ValidationSummary({ files, build, canSave, saving, onSave, onStartOver }: ValidationSummaryProps) {
  const { dict, lang } = useLanguage();
  const t = dict.terminal;

  if (!build) return null;

  return (
    <section
      aria-label={t.validationTitle}
      className={`rounded-lg border bg-[var(--pl-surface)] p-4 ${
        build.ok ? 'border-[var(--pl-success)]' : 'border-[var(--pl-danger)]'
      }`}
    >
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {build.ok ? (
            <CheckCircle2 className="size-5 text-[var(--pl-success)]" aria-hidden />
          ) : (
            <XCircle className="size-5 text-[var(--pl-danger)]" aria-hidden />
          )}
          <h2 className="text-sm font-medium text-[var(--pl-text-primary)]">
            {build.ok ? t.complete : t.rejectedTitle}
          </h2>
        </div>
        {build.ok ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onStartOver}
              disabled={saving}
              className="min-h-[44px] rounded-md border border-[var(--pl-border)] px-3 py-2 text-xs text-[var(--pl-text-secondary)] transition-colors hover:bg-[var(--pl-surface-hover)] disabled:opacity-50"
            >
              {t.startOver}
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={!canSave || saving}
              className="min-h-[44px] rounded-md bg-[var(--pl-accent)] px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {saving ? t.saving : t.save}
            </button>
          </div>
        ) : null}
      </header>

      {/* Tabla de archivos detectados */}
      <div className="scrollbar-thin max-h-52 overflow-auto rounded-md border border-[var(--pl-border)]">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-[var(--pl-surface-raised)] text-[var(--pl-text-muted)]">
            <tr>
              <th className="px-2 py-1.5 font-medium">{t.colFile}</th>
              <th className="px-2 py-1.5 font-medium">{t.colContent}</th>
              <th className="px-2 py-1.5 text-right font-medium">{t.colEdges}</th>
              <th className="px-2 py-1.5 font-medium">{t.colOffsets}</th>
              <th className="px-2 py-1.5 font-medium">{t.colSha}</th>
            </tr>
          </thead>
          <tbody>
            {files.map((f, i) => {
              const ok = f.result.ok;
              const file = ok ? f.result.file : null;
              return (
                <tr key={`${f.name}-${i}`} className="border-t border-[var(--pl-border)]">
                  <td className="max-w-[180px] truncate px-2 py-1.5 text-[var(--pl-text-primary)]" title={f.name}>
                    {f.name}
                  </td>
                  <td className="px-2 py-1.5">
                    {ok ? (
                      <span className={file?.hasEventBlock ? 'text-[var(--pl-accent-gold)]' : 'text-[var(--pl-text-secondary)]'}>
                        {file?.hasEventBlock ? t.eventBlock : t.locationsOnly}
                      </span>
                    ) : (
                      <span className="text-[var(--pl-danger)]">{t.invalidJson}</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-right text-[var(--pl-text-secondary)]">
                    {file ? formatNumber(file.edges.length, lang) : '—'}
                  </td>
                  <td className="px-2 py-1.5 text-[var(--pl-text-secondary)]">
                    {file && file.offsetStart !== null && file.offsetEnd !== null
                      ? `${file.offsetStart}–${file.offsetEnd}`
                      : '—'}
                  </td>
                  <td className="px-2 py-1.5 text-[var(--pl-text-muted)]" title={f.sha256}>
                    {f.sha256.slice(0, 10)}…
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Veredicto */}
      {build.ok ? (
        <div className="mt-3 space-y-2 text-sm">
          <p className="text-[var(--pl-text-primary)]">
            <span className="text-[var(--pl-success)]">●</span>{' '}
            {formatNumber(build.snapshot.events.length, lang)} {t.uniqueLocations}
            <span className="text-[var(--pl-text-muted)]"> · {t.declared} {formatNumber(build.snapshot.declaredTotal, lang)}</span>
          </p>
          {build.snapshot.global ? (
            <p className="text-xs text-[var(--pl-text-secondary)]">
              {t.globalFigures}: {formatNumber(build.snapshot.global.totalRegistrations, lang)} ·{' '}
              {formatNumber(build.snapshot.global.totalLocalEvents, lang)} ·{' '}
              {formatNumber(build.snapshot.global.teams, lang)}
            </p>
          ) : null}

          <details className="rounded-md border border-[var(--pl-border)] bg-[var(--pl-surface-sunken)] p-2">
            <summary className="flex cursor-pointer items-center gap-1.5 text-xs text-[var(--pl-warning)]">
              <AlertTriangle className="size-3.5" aria-hidden />
              {t.warningsTitle} ({build.snapshot.warnings.length})
            </summary>
            {build.snapshot.warnings.length === 0 ? (
              <p className="mt-1 text-xs text-[var(--pl-text-muted)]">{t.noWarnings}</p>
            ) : (
              <ul className="mt-1 space-y-1">
                {build.snapshot.warnings.map((w, i) => (
                  <li key={i} className="text-xs leading-relaxed text-[var(--pl-text-secondary)]">
                    · {w}
                  </li>
                ))}
              </ul>
            )}
          </details>
        </div>
      ) : (
        <div className="mt-3 space-y-1 text-sm">
          <p className="text-[var(--pl-danger)]">{REJECT_MSG_KEY[build.code] ? dict.terminal[REJECT_MSG_KEY[build.code]] : build.code}</p>
          <p className="text-xs text-[var(--pl-text-muted)]">
            {t.detailLabel}: {build.message}
          </p>
        </div>
      )}
    </section>
  );
}
