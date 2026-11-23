// FILE: src/domain/stats.ts
// Estadísticas del dashboard (sección 7 del brief). Puro, sin I/O.
// Reglas: el Universal Event nunca entra en rankings por país, promedios,
// medianas ni globo (D8); las locaciones con 0 inscritos sí cuentan (sección 6).

import { UNIVERSAL_COUNTRY, type EventType, type LocalEvent, type Snapshot } from './types';

export interface TypeBreakdownRow {
  type: EventType;
  locations: number;
  registrations: number;
}

export interface CountryAgg {
  country: string;
  iso2: string | null;
  locations: number;
  registrations: number;
  average: number;
  median: number;
}

export interface DashboardStats {
  totalLocations: number; // locaciones únicas recibidas (visibles): 600
  declaredTotal: number; // declaradas por la plataforma en el JSON (totalCount)
  declaredLocalEvents: number | null; // cachedLocalEvents del bloque event: 680 (D12)
  globalRegistrations: number | null; // cachedEventRegistrations (124.934)
  teams: number | null;
  universal: { present: boolean; registrations: number };
  sumRegistrations: number; // suma de todas las locaciones (104.784)
  sumRegistrationsWithoutUniversal: number; // 89.956
  derivedWithoutLocalEvent: number | null; // global − suma (20.150, DERIVADO D13)
  zeroRegistrationsCount: number; // 4
  countriesCount: number; // 115 (sin Universal)
  byType: TypeBreakdownRow[];
  byCountry: CountryAgg[]; // sin Universal, orden por registrations desc
  topLocations: LocalEvent[]; // top 10 por inscritos, sin Universal
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((acc, v) => acc + v, 0) / values.length;
}

export function isUniversalEvent(e: LocalEvent): boolean {
  return e.isUniversal || e.country === UNIVERSAL_COUNTRY;
}

/** Agregación por país sobre una lista de locaciones (ya filtrada). */
export function aggregateByCountry(events: LocalEvent[]): CountryAgg[] {
  const map = new Map<string, { regs: number[] }>();
  for (const e of events) {
    if (isUniversalEvent(e)) continue; // D8
    const entry = map.get(e.country) ?? { regs: [] };
    entry.regs.push(e.registrations);
    map.set(e.country, entry);
  }
  const rows: CountryAgg[] = [];
  for (const [country, { regs }] of map) {
    const iso2 = events.find((e) => e.country === country)?.iso2 ?? null;
    rows.push({
      country,
      iso2,
      locations: regs.length,
      registrations: regs.reduce((a, v) => a + v, 0),
      average: average(regs),
      median: median(regs),
    });
  }
  return rows.sort((a, b) => b.registrations - a.registrations);
}

export function computeStats(snapshot: Snapshot): DashboardStats {
  const events = snapshot.events;
  const universals = events.filter(isUniversalEvent);
  const nonUniversal = events.filter((e) => !isUniversalEvent(e));

  const sumRegistrations = events.reduce((acc, e) => acc + e.registrations, 0);
  const sumWithout = nonUniversal.reduce((acc, e) => acc + e.registrations, 0);
  const globalRegs = snapshot.global?.totalRegistrations ?? null;

  const byTypeMap = new Map<EventType, TypeBreakdownRow>();
  for (const e of events) {
    const row = byTypeMap.get(e.eventType) ?? { type: e.eventType, locations: 0, registrations: 0 };
    row.locations++;
    row.registrations += e.registrations;
    byTypeMap.set(e.eventType, row);
  }
  // Orden fijo: In-Person, Virtual, Virtual & In-Person
  const order: EventType[] = ['In-Person', 'Virtual', 'Virtual & In-Person'];
  const byType = order
    .map((t) => byTypeMap.get(t))
    .filter((r): r is TypeBreakdownRow => Boolean(r));

  return {
    totalLocations: events.length,
    declaredTotal: snapshot.declaredTotal,
    declaredLocalEvents: snapshot.global?.totalLocalEvents ?? null,
    globalRegistrations: globalRegs,
    teams: snapshot.global?.teams ?? null,
    universal: {
      present: universals.length > 0,
      registrations: universals.reduce((acc, e) => acc + e.registrations, 0),
    },
    sumRegistrations,
    sumRegistrationsWithoutUniversal: sumWithout,
    derivedWithoutLocalEvent:
      globalRegs !== null ? globalRegs - sumRegistrations : null,
    zeroRegistrationsCount: events.filter((e) => e.registrations === 0).length,
    countriesCount: new Set(nonUniversal.map((e) => e.country)).size,
    byType,
    byCountry: aggregateByCountry(events),
    topLocations: [...nonUniversal].sort((a, b) => b.registrations - a.registrations).slice(0, 10),
  };
}
