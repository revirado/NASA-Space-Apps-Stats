// FILE: src/domain/evolution.ts
// Comparación entre capturas (sección 7): cambio absoluto y cambio por día
// entre capturas consecutivas ordenadas por captured_at (nunca por orden de
// subida, D15). Los intervalos pueden ser irregulares; una cifra puede bajar.
// Puro, sin I/O.

import type { LocalEvent, Snapshot } from './types';

const MS_PER_DAY = 86_400_000;

export interface EvolutionDelta {
  from: string; // capturedAt anterior
  to: string; // capturedAt actual
  days: number; // días transcurridos (pueden ser fraccionarios)
  // Cambios absolutos y por día de las series principales:
  globalRegistrations: { abs: number | null; perDay: number | null };
  sumLocationRegistrations: { abs: number; perDay: number };
  locations: { abs: number; perDay: number };
  derivedWithoutLocalEvent: { abs: number | null; perDay: number | null };
}

function dayDiff(fromIso: string, toIso: string): number {
  const from = new Date(fromIso).getTime();
  const to = new Date(toIso).getTime();
  if (Number.isNaN(from) || Number.isNaN(to)) return 0;
  return (to - from) / MS_PER_DAY;
}

function perDay(abs: number, days: number): number | null {
  if (days <= 0) return null;
  return abs / days;
}

function sumRegs(events: LocalEvent[]): number {
  return events.reduce((acc, e) => acc + e.registrations, 0);
}

/** Deltas entre cada par de capturas consecutivas (ordenadas por fecha, D15). */
export function compareConsecutive(snapshots: Snapshot[]): EvolutionDelta[] {
  const sorted = [...snapshots].sort(
    (a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime()
  );
  const deltas: EvolutionDelta[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const days = dayDiff(prev.capturedAt, curr.capturedAt);

    const prevSum = sumRegs(prev.events);
    const currSum = sumRegs(curr.events);
    const prevGlobal = prev.global?.totalRegistrations ?? null;
    const currGlobal = curr.global?.totalRegistrations ?? null;
    const prevDerived = prevGlobal !== null ? prevGlobal - prevSum : null;
    const currDerived = currGlobal !== null ? currGlobal - currSum : null;

    deltas.push({
      from: prev.capturedAt,
      to: curr.capturedAt,
      days,
      globalRegistrations: {
        abs: currGlobal !== null && prevGlobal !== null ? currGlobal - prevGlobal : null,
        perDay: currGlobal !== null && prevGlobal !== null ? perDay(currGlobal - prevGlobal, days) : null,
      },
      sumLocationRegistrations: {
        abs: currSum - prevSum,
        perDay: perDay(currSum - prevSum, days) ?? 0,
      },
      locations: {
        abs: curr.events.length - prev.events.length,
        perDay: perDay(curr.events.length - prev.events.length, days) ?? 0,
      },
      derivedWithoutLocalEvent: {
        abs: currDerived !== null && prevDerived !== null ? currDerived - prevDerived : null,
        perDay: currDerived !== null && prevDerived !== null ? perDay(currDerived - prevDerived, days) : null,
      },
    });
  }
  return deltas;
}

/** Locaciones que aparecen o desaparecen entre dos capturas, por external_id. */
export function diffLocations(
  prev: Snapshot,
  curr: Snapshot
): { appeared: LocalEvent[]; disappeared: LocalEvent[] } {
  const prevIds = new Set(prev.events.map((e) => e.externalId));
  const currIds = new Set(curr.events.map((e) => e.externalId));
  const appeared = curr.events.filter((e) => !prevIds.has(e.externalId));
  const disappeared = prev.events.filter((e) => !currIds.has(e.externalId));
  return { appeared, disappeared };
}
