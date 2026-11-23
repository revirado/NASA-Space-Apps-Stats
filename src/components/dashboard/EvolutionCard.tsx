// FILE: src/components/dashboard/EvolutionCard.tsx
// Evolución (sección 7): con una sola captura muestra el aviso correspondiente;
// con dos o más, gráfico de líneas + deltas absolutos y por día entre capturas
// consecutivas (orden por captured_at, nunca por orden de subida, D15).
// La lógica vive en domain/evolution.ts. Una cifra puede bajar y se muestra
// tal cual, con signo.

'use client';

import { Info, TrendingDown, TrendingUp } from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useLanguage } from '@/i18n';
import { palette } from '@/config/theme';
import { formatNumber, formatDecimal, formatCapturedAt } from '@/lib/format';
import type { Snapshot } from '@/domain/types';
import { compareConsecutive } from '@/domain/evolution';

export function EvolutionCard({ snapshots }: { snapshots: Snapshot[] }) {
  const { dict, lang } = useLanguage();

  if (snapshots.length < 2) {
    return (
      <section
        aria-label={dict.evolution.title}
        className="rounded-2xl border border-[var(--pl-border)] bg-[var(--pl-surface-raised)] p-4"
      >
        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-[var(--pl-text-primary)]">
          {dict.evolution.title}
        </h2>
        <div className="flex items-start gap-3 rounded-xl border border-[var(--pl-accent-gold)]/30 bg-[var(--pl-accent-gold-soft)] p-4">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-[var(--pl-accent-gold)]" aria-hidden />
          <div>
            <p className="text-sm font-semibold text-[var(--pl-text-primary)]">
              {dict.evolution.needTwoTitle}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-[var(--pl-text-secondary)]">
              {dict.evolution.needTwoBody}
            </p>
          </div>
        </div>
      </section>
    );
  }

  const sorted = [...snapshots].sort(
    (a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime()
  );
  const data = sorted.map((s) => ({
    label: new Date(s.capturedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    global: s.global?.totalRegistrations ?? null,
    sum: s.events.reduce((acc, e) => acc + e.registrations, 0),
  }));
  const deltas = compareConsecutive(snapshots);

  return (
    <section
      aria-label={dict.evolution.title}
      className="rounded-2xl border border-[var(--pl-border)] bg-[var(--pl-surface-raised)] p-4"
    >
      <h2 className="mb-3 text-sm font-bold text-[var(--pl-text-primary)]">{dict.evolution.title}</h2>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={palette.chartGrid} strokeDasharray="3 3" />
            <XAxis dataKey="label" stroke={palette.textMuted} fontSize={11} tickLine={false} />
            <YAxis
              stroke={palette.textMuted}
              fontSize={11}
              tickLine={false}
              width={64}
              tickFormatter={(v: number) => formatNumber(v, lang)}
            />
            <Tooltip
              contentStyle={{
                background: palette.surfaceRaised,
                border: `1px solid ${palette.borderStrong}`,
                borderRadius: 12,
                color: palette.textPrimary,
                fontSize: 12,
              }}
              labelStyle={{ color: palette.textSecondary }}
              formatter={(value: number | string) =>
                typeof value === 'number' ? formatNumber(value, lang) : value
              }
            />
            <Line
              type="monotone"
              dataKey="global"
              name={dict.evolution.seriesGlobal}
              stroke={palette.accent}
              strokeWidth={2}
              dot={{ r: 4, fill: palette.accent }}
            />
            <Line
              type="monotone"
              dataKey="sum"
              name={dict.evolution.seriesTotal}
              stroke={palette.accentGold}
              strokeWidth={2}
              dot={{ r: 4, fill: palette.accentGold }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <ul className="mt-3 space-y-2">
        {deltas.map((d) => (
          <li
            key={`${d.from}→${d.to}`}
            className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-[var(--pl-border)] bg-[var(--pl-surface)] px-3 py-2.5 text-xs"
          >
            <span className="text-[var(--pl-text-secondary)]">
              {formatCapturedAt(d.from, lang)} <span className="text-[var(--pl-text-muted)]">→</span>{' '}
              {formatCapturedAt(d.to, lang)}
              <span className="ml-1 text-[var(--pl-text-muted)]">
                ({formatDecimal(d.days, lang, 1)} {dict.evolution.days})
              </span>
            </span>
            <Delta label={dict.evolution.seriesGlobal} abs={d.globalRegistrations.abs} perDay={d.globalRegistrations.perDay} />
            <Delta label={dict.evolution.seriesTotal} abs={d.sumLocationRegistrations.abs} perDay={d.sumLocationRegistrations.perDay} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function Delta({ label, abs, perDay }: { label: string; abs: number | null; perDay: number | null }) {
  const { lang } = useLanguage();
  if (abs === null) return null;
  const up = abs >= 0;
  return (
    <span className="inline-flex items-center gap-1.5 font-semibold">
      <span className="text-[var(--pl-text-muted)]">{label}:</span>
      {up ? (
        <TrendingUp className="h-3.5 w-3.5 text-[var(--pl-success)]" aria-hidden />
      ) : (
        <TrendingDown className="h-3.5 w-3.5 text-[var(--pl-danger)]" aria-hidden />
      )}
      <span className={up ? 'text-[var(--pl-success)]' : 'text-[var(--pl-danger)]'}>
        {up ? '+' : ''}
        {formatNumber(abs, lang)}
      </span>
      {perDay !== null && (
        <span className="text-[var(--pl-text-muted)]">
          ({up ? '+' : ''}
          {formatDecimal(perDay, lang, 1)}/d)
        </span>
      )}
    </span>
  );
}
