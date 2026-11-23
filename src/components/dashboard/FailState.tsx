// FILE: src/components/dashboard/FailState.tsx
// Estados de fallo (sección 13): un aviso que dice qué ocurre, nombrando la
// categoría del problema y la variable que falta, sin exponer credenciales.

'use client';

import { AlertTriangle, DatabaseZap, PlugZap, RotateCcw, Table2, Inbox } from 'lucide-react';
import { useLanguage } from '@/i18n';
import type { DataState } from '@/data/dataState';

export function FailState({ state }: { state: DataState }) {
  const { dict } = useLanguage();

  const content = (() => {
    switch (state.status) {
      case 'unconfigured':
        return {
          icon: DatabaseZap,
          title: dict.states.unconfiguredTitle,
          body: (
            <p>
              {dict.states.unconfiguredBody}{' '}
              <code className="rounded bg-[var(--pl-surface-sunken)] px-1.5 py-0.5 text-[var(--pl-accent-gold)]">
                {state.missingVar}
              </code>
            </p>
          ),
        };
      case 'unavailable':
        return {
          icon: PlugZap,
          title: dict.states.unavailableTitle,
          body: <p>{dict.states.unavailableBody}</p>,
          retry: true,
        };
      case 'uninitialized':
        return {
          icon: Table2,
          title: dict.states.uninitializedTitle,
          body: <p>{dict.states.uninitializedBody}</p>,
        };
      case 'empty':
        return {
          icon: Inbox,
          title: dict.states.emptyTitle,
          body: <p>{dict.states.emptyBody}</p>,
        };
      default:
        return {
          icon: AlertTriangle,
          title: dict.states.unavailableTitle,
          body: <p>{dict.states.unavailableBody}</p>,
          retry: true,
        };
    }
  })();

  const Icon = content.icon;

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div
        role="alert"
        className="w-full max-w-lg rounded-2xl border border-[var(--pl-border)] bg-[var(--pl-surface-raised)] p-6 text-center sm:p-8"
      >
        <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--pl-border)] bg-[var(--pl-accent-gold-soft)]">
          <Icon className="h-7 w-7 text-[var(--pl-accent-gold)]" />
        </span>
        <h2 className="mb-2 text-lg font-bold text-[var(--pl-text-primary)]">{content.title}</h2>
        <div className="text-sm leading-relaxed text-[var(--pl-text-secondary)]">{content.body}</div>
        {content.retry && (
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[var(--pl-accent)] px-5 text-sm font-semibold text-white transition-transform hover:scale-[1.02] active:scale-95"
          >
            <RotateCcw className="h-4 w-4" />
            {dict.states.retry}
          </button>
        )}
      </div>
    </div>
  );
}
