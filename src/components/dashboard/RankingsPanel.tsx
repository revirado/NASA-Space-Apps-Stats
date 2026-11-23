// FILE: src/components/dashboard/RankingsPanel.tsx
// Rankings (sección 7): métrica × filtro × alcance. Alcance global = países
// entre sí; dentro de un país = sus locaciones por inscritos. El Universal
// Event nunca entra (D8). Toda la lógica vive en domain/ranking.ts.

'use client';

import { useMemo, useState } from 'react';
import { Medal, Trophy } from 'lucide-react';
import { useLanguage } from '@/i18n';
import { formatNumber, formatDecimal } from '@/lib/format';
import { flagEmoji } from '@/domain/countryMap';
import type { LocalEvent } from '@/domain/types';
import {
  DEFAULT_FILTERS,
  listCountries,
  rankCountries,
  rankLocationsInCountry,
  type RankFilters,
  type RankMetric,
} from '@/domain/ranking';
import { TypeBadge } from './TypeBadge';

const MEDALS = ['text-[var(--pl-accent-gold)]', 'text-[var(--pl-text-secondary)]', 'text-[#cd7f32]'];

export function RankingsPanel({ events }: { events: LocalEvent[] }) {
  const { dict, lang } = useLanguage();
  const [metric, setMetric] = useState<RankMetric>('total');
  const [scope, setScope] = useState<string>('global'); // 'global' | country name
  const [filters, setFilters] = useState<RankFilters>(DEFAULT_FILTERS);

  const countries = useMemo(() => listCountries(events), [events]);

  const countryRows = useMemo(
    () => (scope === 'global' ? rankCountries(events, metric, filters) : []),
    [events, metric, filters, scope]
  );

  const locationRows = useMemo(
    () => (scope === 'global' ? [] : rankLocationsInCountry(events, scope, filters)),
    [events, filters, scope]
  );

  const setFilter = <K extends keyof RankFilters>(key: K, value: RankFilters[K]) =>
    setFilters((f) => ({ ...f, [key]: value }));

  const metricValue = (row: { registrations: number; locations: number; average: number; median: number }) =>
    metric === 'total' ? row.registrations
    : metric === 'locations' ? row.locations
    : metric === 'average' ? row.average
    : row.median;

  return (
    <section
      aria-label={dict.rankings.title}
      className="rounded-2xl border border-[var(--pl-border)] bg-[var(--pl-surface-raised)] p-4"
    >
      <div className="mb-3 flex items-center gap-2">
        <Trophy className="h-4 w-4 text-[var(--pl-accent-gold)]" aria-hidden />
        <h2 className="text-sm font-bold text-[var(--pl-text-primary)]">{dict.rankings.title}</h2>
      </div>

      {/* Controles */}
      <div className="grid grid-cols-2 gap-2">
        {scope === 'global' ? (
          <label className="col-span-2 grid grid-cols-[auto_1fr] items-center gap-2 text-xs text-[var(--pl-text-muted)]">
            <span className="shrink-0 font-semibold uppercase tracking-wide">{dict.rankings.metric}</span>
            <select
              value={metric}
              onChange={(e) => setMetric(e.target.value as RankMetric)}
              className="h-9 rounded-lg border border-[var(--pl-border)] bg-[var(--pl-surface)] px-2 text-xs text-[var(--pl-text-primary)] focus:border-[var(--pl-accent-gold)] focus:outline-none"
            >
              <option value="total">{dict.rankings.metricTotal}</option>
              <option value="locations">{dict.rankings.metricLocations}</option>
              <option value="average">{dict.rankings.metricAverage}</option>
              <option value="median">{dict.rankings.metricMedian}</option>
            </select>
          </label>
        ) : (
          <p className="col-span-2 rounded-lg bg-[var(--pl-surface)] px-2.5 py-2 text-[11px] leading-snug text-[var(--pl-text-muted)]">
            {dict.rankings.inCountryHint}
          </p>
        )}

        {/* Alcance: global o dentro de un país */}
        <label className="col-span-2 grid grid-cols-[auto_1fr] items-center gap-2 text-xs text-[var(--pl-text-muted)]">
          <span className="shrink-0 font-semibold uppercase tracking-wide">{dict.rankings.scope}</span>
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            className="scrollbar-thin h-9 rounded-lg border border-[var(--pl-border)] bg-[var(--pl-surface)] px-2 text-xs text-[var(--pl-text-primary)] focus:border-[var(--pl-accent-gold)] focus:outline-none"
          >
            <option value="global">{dict.rankings.scopeGlobal}</option>
            <optgroup label={dict.rankings.scopeInCountry}>
              {countries.map((c) => (
                <option key={c.country} value={c.country}>
                  {c.country}
                </option>
              ))}
            </optgroup>
          </select>
        </label>

        <FilterSelect
          label={dict.rankings.filterType}
          value={filters.eventType}
          onChange={(v) => setFilter('eventType', v as RankFilters['eventType'])}
          options={[
            ['all', dict.rankings.typeAll],
            ['In-Person', dict.rankings.typeInPerson],
            ['Virtual', dict.rankings.typeVirtual],
            ['Virtual & In-Person', dict.rankings.typeHybrid],
          ]}
        />
        <FilterSelect
          label={dict.rankings.filterOpen}
          value={filters.open}
          onChange={(v) => setFilter('open', v as RankFilters['open'])}
          options={[
            ['all', dict.rankings.openAll],
            ['open', dict.rankings.openOpen],
            ['closed', dict.rankings.openClosed],
          ]}
        />
        <FilterSelect
          label={dict.rankings.filterWaitlist}
          value={filters.waitlist}
          onChange={(v) => setFilter('waitlist', v as RankFilters['waitlist'])}
          options={[
            ['all', dict.rankings.waitlistAll],
            ['only', dict.rankings.waitlistOnly],
            ['exclude', dict.rankings.waitlistExclude],
          ]}
        />
        <p className="col-span-2 text-[10px] leading-snug text-[var(--pl-text-muted)]">
          {dict.rankings.medianHint}
        </p>
      </div>

      {/* Cantidad de resultados tras los filtros (visible sin scrollear) */}
      <ResultCount count={scope === 'global' ? countryRows.length : locationRows.length} dict={dict} lang={lang} />

      {/* Tabla: países (global) */}
      {scope === 'global' && (
        <div className="scrollbar-thin mt-2 max-h-96 overflow-y-auto rounded-xl border border-[var(--pl-border)]">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-[var(--pl-surface-hover)]">
              <tr className="text-left text-[10px] uppercase tracking-wider text-[var(--pl-text-muted)]">
                <th className="w-9 px-2 py-2 font-semibold">{dict.rankings.colRank}</th>
                <th className="px-2 py-2 font-semibold">{dict.rankings.colCountry}</th>
                <th className="px-2 py-2 text-right font-semibold">{dict.rankings.colLocations}</th>
                <th className={`px-2 py-2 text-right font-semibold ${metric === 'total' ? 'text-[var(--pl-accent-gold)]' : ''}`}>
                  {dict.rankings.colRegistrants}
                </th>
                <th className={`px-2 py-2 text-right font-semibold ${metric === 'average' ? 'text-[var(--pl-accent-gold)]' : ''}`}>
                  {dict.rankings.colAverage}
                </th>
                <th className={`px-2 py-2 text-right font-semibold ${metric === 'median' ? 'text-[var(--pl-accent-gold)]' : ''}`}>
                  {dict.rankings.colMedian}
                </th>
              </tr>
            </thead>
            <tbody>
              {countryRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-xs text-[var(--pl-text-muted)]">
                    {dict.rankings.empty}
                  </td>
                </tr>
              )}
              {countryRows.map((row, i) => (
                <tr
                  key={row.country}
                  className="border-t border-[var(--pl-border)] text-[var(--pl-text-primary)] transition-colors hover:bg-[var(--pl-surface-hover)]"
                >
                  <td className="px-2 py-2">
                    {i < 3 ? (
                      <Medal className={`h-3.5 w-3.5 ${MEDALS[i]}`} aria-label={`#${i + 1}`} />
                    ) : (
                      <span className="text-xs text-[var(--pl-text-muted)]">{i + 1}</span>
                    )}
                  </td>
                  <td className="max-w-[160px] px-2 py-2">
                    <span className="flex items-center gap-1.5">
                      <span aria-hidden>{flagEmoji(row.iso2)}</span>
                      <span className="truncate text-[13px] font-medium">{row.country}</span>
                    </span>
                  </td>
                  <td className="px-2 py-2 text-right text-xs text-[var(--pl-text-secondary)]">
                    {formatNumber(row.locations, lang)}
                  </td>
                  <td className={`px-2 py-2 text-right font-bold ${metric === 'total' ? 'text-[var(--pl-accent-gold)]' : ''}`}>
                    {formatNumber(row.registrations, lang)}
                  </td>
                  <td className={`px-2 py-2 text-right text-xs ${metric === 'average' ? 'font-bold text-[var(--pl-accent-gold)]' : 'text-[var(--pl-text-secondary)]'}`}>
                    {formatDecimal(row.average, lang)}
                  </td>
                  <td className={`px-2 py-2 text-right text-xs ${metric === 'median' ? 'font-bold text-[var(--pl-accent-gold)]' : 'text-[var(--pl-text-secondary)]'}`}>
                    {formatDecimal(row.median, lang)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tabla: locaciones dentro de un país */}
      {scope !== 'global' && (
        <div className="scrollbar-thin mt-2 max-h-96 overflow-y-auto rounded-xl border border-[var(--pl-border)]">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-[var(--pl-surface-hover)]">
              <tr className="text-left text-[10px] uppercase tracking-wider text-[var(--pl-text-muted)]">
                <th className="w-9 px-2 py-2 font-semibold">{dict.rankings.colRank}</th>
                <th className="px-2 py-2 font-semibold">{dict.rankings.colLocation}</th>
                <th className="px-2 py-2 font-semibold">{dict.rankings.colType}</th>
                <th className="px-2 py-2 text-right font-semibold">{dict.rankings.colRegistrants}</th>
              </tr>
            </thead>
            <tbody>
              {locationRows.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-xs text-[var(--pl-text-muted)]">
                    {dict.rankings.empty}
                  </td>
                </tr>
              )}
              {locationRows.map((loc, i) => (
                <tr
                  key={loc.externalId}
                  className="border-t border-[var(--pl-border)] text-[var(--pl-text-primary)] transition-colors hover:bg-[var(--pl-surface-hover)]"
                >
                  <td className="px-2 py-2">
                    {i < 3 ? (
                      <Medal className={`h-3.5 w-3.5 ${MEDALS[i]}`} aria-label={`#${i + 1}`} />
                    ) : (
                      <span className="text-xs text-[var(--pl-text-muted)]">{i + 1}</span>
                    )}
                  </td>
                  <td className="max-w-[180px] px-2 py-2">
                    <span className="truncate text-[13px] font-medium">{loc.title}</span>
                  </td>
                  <td className="px-2 py-2">
                    <TypeBadge type={loc.eventType} dict={dict} />
                  </td>
                  <td className="px-2 py-2 text-right font-bold">{formatNumber(loc.registrations, lang)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// Contador de resultados del ranking filtrado (singular/plural por idioma)
function ResultCount({
  count,
  dict,
  lang,
}: {
  count: number;
  dict: ReturnType<typeof useLanguage>['dict'];
  lang: ReturnType<typeof useLanguage>['lang'];
}) {
  return (
    <p
      className="mt-3 text-xs text-[var(--pl-text-muted)]"
      aria-live="polite"
    >
      <span className="font-bold text-[var(--pl-accent-gold)]">{formatNumber(count, lang)}</span>{' '}
      {count === 1 ? dict.rankings.resultSingular : dict.rankings.resultPlural}
    </p>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <label className="grid grid-cols-1 items-center gap-1 text-xs text-[var(--pl-text-muted)]">
      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 rounded-lg border border-[var(--pl-border)] bg-[var(--pl-surface)] px-2 text-xs text-[var(--pl-text-primary)] focus:border-[var(--pl-accent-gold)] focus:outline-none"
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}
