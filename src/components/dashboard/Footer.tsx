// FILE: src/components/dashboard/Footer.tsx
// Pie sticky (mt-auto en el contenedor flex de DashboardApp) con el crédito del
// desarrollador y enlace a ariellamas.tech (D20). Respeta el safe area inferior
// en iOS.

'use client';

import { Code2 } from 'lucide-react';
import { useLanguage } from '@/i18n';

export function Footer() {
  const { dict } = useLanguage();
  return (
    <footer className="mt-auto border-t border-[var(--pl-border)] bg-[var(--pl-surface)] pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-[var(--pl-text-muted)]">
        <p className="inline-flex items-center gap-1.5">
          <Code2 className="h-3.5 w-3.5 text-[var(--pl-text-secondary)]" />
          {dict.footer.credit}{' '}
          <a
            href="https://ariellamas.tech"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-[var(--pl-accent-gold)] underline-offset-2 hover:underline"
          >
            ariellamas.tech
          </a>
        </p>
        <p>NASA Space Apps 2026 · Local Events</p>
      </div>
    </footer>
  );
}
