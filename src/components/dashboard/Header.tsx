// FILE: src/components/dashboard/Header.tsx
// Encabezado: identidad, fecha de última actualización (D16: la capturedAt del
// snapshot más reciente, nunca la fecha de subida) y switcher de idioma.

'use client';

import { CalendarClock, Rocket } from 'lucide-react';
import { useLanguage } from '@/i18n';
import { formatCapturedAt } from '@/lib/format';
import { LanguageSwitcher } from './LanguageSwitcher';

export function Header({ lastCapturedAt }: { lastCapturedAt: string | null }) {
  const { dict, lang } = useLanguage();

  return (
    <header className="border-b border-[var(--pl-border)] bg-[var(--pl-surface)]/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-3 px-4 py-3 sm:gap-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span
            aria-hidden
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--pl-border)] bg-[var(--pl-accent-soft)]"
          >
            <Rocket className="h-5 w-5 text-[var(--pl-accent)]" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--pl-accent-gold)]">
              {dict.app.badge}
            </p>
            <h1 className="truncate text-base font-bold leading-tight text-[var(--pl-text-primary)] sm:text-lg">
              {dict.app.title}
              <span className="mx-2 text-[var(--pl-border-strong)]">·</span>
              <span className="font-medium text-[var(--pl-text-secondary)]">{dict.app.subtitle}</span>
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {lastCapturedAt && (
            <time
              dateTime={lastCapturedAt}
              title={dict.lastUpdate.label}
              className="hidden items-center gap-1.5 rounded-full border border-[var(--pl-border)] bg-[var(--pl-surface-raised)] px-3 py-1.5 text-xs text-[var(--pl-text-secondary)] sm:inline-flex"
            >
              <CalendarClock className="h-3.5 w-3.5 text-[var(--pl-accent-gold)]" />
              <span className="text-[var(--pl-text-muted)]">{dict.lastUpdate.label}:</span>
              <span className="font-semibold text-[var(--pl-text-primary)]">
                {formatCapturedAt(lastCapturedAt, lang)}
              </span>
            </time>
          )}
          <LanguageSwitcher />
        </div>

        {/* En móvil la fecha va en segunda fila, siempre visible */}
        {lastCapturedAt && (
          <time
            dateTime={lastCapturedAt}
            className="inline-flex w-full items-center gap-1.5 text-xs text-[var(--pl-text-secondary)] sm:hidden"
          >
            <CalendarClock className="h-3.5 w-3.5 text-[var(--pl-accent-gold)]" />
            <span className="text-[var(--pl-text-muted)]">{dict.lastUpdate.label}:</span>
            <span className="font-semibold text-[var(--pl-text-primary)]">
              {formatCapturedAt(lastCapturedAt, lang)}
            </span>
          </time>
        )}
      </div>
    </header>
  );
}
