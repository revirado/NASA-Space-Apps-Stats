// FILE: src/domain/ranking.ts
// Rankings combinando métrica × filtro × alcance (sección 7). Puro.
// El Universal Event queda fuera de todo ranking (D8).

import { type EventType, type LocalEvent } from './types';
import { aggregateByCountry, type CountryAgg } from './stats';

export type RankMetric = 'total' | 'locations' | 'average' | 'median';

export interface RankFilters {
  eventType: EventType | 'all';
  open: 'all' | 'open' | 'closed';
  waitlist: 'all' | 'only' | 'exclude';
}

export const DEFAULT_FILTERS: RankFilters = {
  eventType: 'all',
  open: 'all',
  waitlist: 'all',
};

export function filterLocations(events: LocalEvent[], f: RankFilters): LocalEvent[] {
  return events.filter((e) => {
    if (e.isUniversal) return false; // D8
    if (f.eventType !== 'all' && e.eventType !== f.eventType) return false;
    if (f.open === 'open' && !e.registrationOpen) return false;
    if (f.open === 'closed' && e.registrationOpen) return false;
    if (f.waitlist === 'only' && !e.isWaitlist) return false;
    if (f.waitlist === 'exclude' && e.isWaitlist) return false;
    return true;
  });
}

/** Ranking de países (alcance global) según métrica y filtros. */
export function rankCountries(events: LocalEvent[], metric: RankMetric, f: RankFilters): CountryAgg[] {
  const filtered = filterLocations(events, f);
  const rows = aggregateByCountry(filtered);
  const key = (r: CountryAgg): number =>
    metric === 'total' ? r.registrations
    : metric === 'locations' ? r.locations
    : metric === 'average' ? r.average
    : r.median;
  return rows.sort((a, b) => key(b) - key(a) || a.country.localeCompare(b.country));
}

/** Ranking de locaciones dentro de un país (métrica: inscritos). */
export function rankLocationsInCountry(
  events: LocalEvent[],
  country: string,
  f: RankFilters
): LocalEvent[] {
  return filterLocations(events, f)
    .filter((e) => e.country === country)
    .sort((a, b) => b.registrations - a.registrations || a.title.localeCompare(b.title));
}

/** Lista de países presentes (para el selector de alcance), alfabética. */
export function listCountries(events: LocalEvent[]): { country: string; iso2: string | null }[] {
  const seen = new Map<string, string | null>();
  for (const e of events) {
    if (e.isUniversal) continue;
    if (!seen.has(e.country)) seen.set(e.country, e.iso2);
  }
  return [...seen.entries()]
    .map(([country, iso2]) => ({ country, iso2 }))
    .sort((a, b) => a.country.localeCompare(b.country));
}
