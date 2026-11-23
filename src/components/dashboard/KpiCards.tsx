// FILE: src/components/dashboard/KpiCards.tsx
// Tarjetas del dashboard: cifras globales, Universal Event (tarjeta propia,
// D8), derivado «sin local event» etiquetado (D13), visibles vs declaradas
// (D14) y desglose por tipo (D11). Números con etiqueta «derivado» cuando
// corresponde. Toda cifra sale de domain/stats.ts.

'use client';

import { Globe2, MapPin, Sigma, Users, UsersRound, Layers } from 'lucide-react';
import { useLanguage } from '@/i18n';
import { formatNumber } from '@/lib/format';
import type { DashboardStats } from '@/domain/stats';
import type { DashboardPayload } from '@/data/dataState';

export function KpiCards({ stats }: { stats: DashboardPayload['latestStats'] }) {
  const { dict, lang } = useLanguage();
  if (!stats) return null;

  const n = (v: number | null | undefined): string =>
    v === null || v === undefined ? '—' : formatNumber(v, lang);

  return (
    <section
      aria-label={dict.cards.globalRegistrations}
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
    >
      {/* Inscritos globales */}
      <Card icon={<Users className="h-4 w-4" />} tone="accent" label={dict.cards.globalRegistrations}>
        <Value>{n(stats.globalRegistrations)}</Value>
        <Hint>{dict.cards.globalRegistrationsHint}</Hint>
      </Card>

      {/* Local events declaradas por la plataforma (680, D12) */}
      <Card icon={<MapPin className="h-4 w-4" />} tone="gold" label={dict.cards.declaredLocations}>
        <Value>{n(stats.declaredLocalEvents)}</Value>
        <Hint>
          {dict.cards.visibleLocations}: <b className="text-[var(--pl-text-primary)]">{n(stats.totalLocations)}</b>
        </Hint>
      </Card>

      {/* Visibles frente a declaradas (D14: 600 de 680, sin explicar el motivo) */}
      <Card icon={<Sigma className="h-4 w-4" />} tone="gold" label={dict.cards.visibleLocations}>
        <Value>
          {n(stats.totalLocations)}
          <span className="text-base font-medium text-[var(--pl-text-muted)]">
            {' '}{dict.cards.visibleOf} {n(stats.declaredLocalEvents ?? stats.declaredTotal)}
          </span>
        </Value>
        <Hint>{dict.cards.declared}</Hint>
      </Card>

      {/* Universal Event: tarjeta propia (D8) */}
      <Card icon={<Globe2 className="h-4 w-4" />} tone="accent" label={dict.cards.universalEvent}>
        <Value>{n(stats.universal.registrations)}</Value>
        <Hint>{dict.cards.universalHint}</Hint>
      </Card>

      {/* Derivado: inscritos sin local event (D13, etiquetado) */}
      <Card icon={<Sigma className="h-4 w-4" />} tone="gold" label={dict.cards.withoutLocalEvent} derived>
        <Value>{n(stats.derivedWithoutLocalEvent)}</Value>
        <Hint>
          {n(stats.globalRegistrations)} − {n(stats.sumRegistrations)}
        </Hint>
      </Card>

      {/* Equipos + por tipo */}
      <Card icon={<UsersRound className="h-4 w-4" />} tone="gold" label={dict.cards.teams}>
        <Value>{n(stats.teams)}</Value>
        <Hint>
          {formatNumber(stats.zeroRegistrationsCount, lang)} × {dict.cards.zeroLocations.toLowerCase()}
        </Hint>
      </Card>

      {/* Desglose por tipo (D11) — tarjeta ancha en pantallas grandes */}
      <Card icon={<Layers className="h-4 w-4" />} tone="gold" label={dict.cards.byType} className="sm:col-span-2 lg:col-span-3 xl:col-span-6">
        <div className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {stats.byType.map((row) => (
            <div
              key={row.type}
              className="flex items-center justify-between rounded-xl border border-[var(--pl-border)] bg-[var(--pl-surface)] px-3 py-2.5"
            >
              <span className="flex items-center gap-2 text-xs font-medium text-[var(--pl-text-secondary)]">
                <span
                  aria-hidden
                  className="h-2 w-2 rounded-full"
                  style={{
                    backgroundColor:
                      row.type === 'In-Person'
                        ? 'var(--pl-type-in-person)'
                        : row.type === 'Virtual'
                          ? 'var(--pl-type-virtual)'
                          : 'var(--pl-type-hybrid)',
                  }}
                />
                {row.type === 'In-Person'
                  ? dict.rankings.typeInPerson
                  : row.type === 'Virtual'
                    ? dict.rankings.typeVirtual
                    : dict.rankings.typeHybrid}
              </span>
              <span className="text-sm">
                <b className="text-[var(--pl-text-primary)]">{n(row.registrations)}</b>
                <span className="ml-1.5 text-xs text-[var(--pl-text-muted)]">
                  {n(row.locations)} {dict.common.locations}
                </span>
              </span>
            </div>
          ))}
        </div>
      </Card>
    </section>
  );
}

function Card({
  icon,
  tone,
  label,
  derived,
  className,
  children,
}: {
  icon: React.ReactNode;
  tone: 'accent' | 'gold';
  label: string;
  derived?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-2xl border border-[var(--pl-border)] bg-[var(--pl-surface-raised)] p-4 ${className ?? ''}`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--pl-text-muted)]">
          <span
            className={`flex h-6 w-6 items-center justify-center rounded-lg ${
              tone === 'accent'
                ? 'bg-[var(--pl-accent-soft)] text-[var(--pl-accent)]'
                : 'bg-[var(--pl-accent-gold-soft)] text-[var(--pl-accent-gold)]'
            }`}
          >
            {icon}
          </span>
          {label}
        </span>
        {derived && <DerivedBadge />}
      </div>
      {children}
    </div>
  );
}

function DerivedBadge() {
  const { dict } = useLanguage();
  return (
    <span className="rounded-full border border-[var(--pl-accent-gold)]/40 bg-[var(--pl-accent-gold-soft)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--pl-accent-gold)]">
      {dict.cards.derived}
    </span>
  );
}

function Value({ children }: { children: React.ReactNode }) {
  return <p className="text-2xl font-bold leading-tight text-[var(--pl-text-primary)]">{children}</p>;
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="mt-0.5 text-xs leading-snug text-[var(--pl-text-muted)]">{children}</p>;
}
