// FILE: src/app/api/terminal/snapshot/route.ts
// POST: guarda una captura validada (SnapshotWriter, paso 9 del algoritmo).
// DELETE: borra una captura por capturedAt. Ambas protegidas por modo (404) y
// token (401) según sección 15. Al servidor solo llega el resumen limpio
// (sección 2 del brief).

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { guardTerminal } from '@/lib/terminalGuard';
import { removeSnapshot, saveSnapshot, type FileRecord } from '@/data/dbWriter';
import { EVENT_TYPES, type EventType, type GlobalStats } from '@/domain/types';

export const dynamic = 'force-dynamic';

interface SavePayload {
  capturedAt: string;
  note: string | null;
  replace: boolean;
  declaredTotal: number;
  global: GlobalStats | null;
  events: unknown[];
  files: FileRecord[];
}

/** Validación defensiva del payload: el cliente es propio, pero la DB no
 *  debe recibir jamás una fila que no entienda. */
function isValidPayload(b: unknown): b is SavePayload {
  if (typeof b !== 'object' || b === null) return false;
  const p = b as Record<string, unknown>;
  if (typeof p.capturedAt !== 'string' || Number.isNaN(Date.parse(p.capturedAt))) return false;
  if (!/^\d{4}-\d{2}-\d{2}T/.test(p.capturedAt)) return false; // ISO, no «12/2026»
  if (p.note !== null && typeof p.note !== 'string') return false;
  if (typeof p.replace !== 'boolean') return false;
  if (typeof p.declaredTotal !== 'number' || !Number.isInteger(p.declaredTotal)) return false;
  if (p.global !== null) {
    const g = p.global as Record<string, unknown> | null;
    if (
      typeof g !== 'object' ||
      g === null ||
      !Number.isFinite(Number(g.totalRegistrations)) ||
      !Number.isFinite(Number(g.totalLocalEvents)) ||
      !Number.isFinite(Number(g.teams))
    ) {
      return false;
    }
  }
  if (!Array.isArray(p.events) || p.events.length === 0 || p.events.length > 5000) return false;
  if (!Array.isArray(p.files) || p.files.length === 0 || p.files.length > 20) return false;
  for (const f of p.files as unknown[]) {
    const r = f as Record<string, unknown>;
    if (typeof r?.sha256 !== 'string' || r.sha256.length !== 64) return false;
    if (typeof r?.originalName !== 'string') return false;
    if (typeof r?.hasEventBlock !== 'boolean') return false;
  }
  return true;
}

function isValidEvent(e: unknown): boolean {
  const r = e as Record<string, unknown>;
  if (typeof r !== 'object' || r === null) return false;
  if (typeof r.externalId !== 'string' || r.externalId.length === 0) return false;
  if (typeof r.title !== 'string' || typeof r.country !== 'string') return false;
  if (!Number.isFinite(Number(r.lat)) || !Number.isFinite(Number(r.lng))) return false;
  if (!Number.isFinite(Number(r.registrations))) return false;
  if (!EVENT_TYPES.includes(r.eventType as EventType)) return false;
  if (typeof r.registrationOpen !== 'boolean' || typeof r.isWaitlist !== 'boolean') return false;
  if (typeof r.isUniversal !== 'boolean') return false;
  if (typeof r.url !== 'string') return false;
  return true;
}

export async function POST(req: NextRequest) {
  const guard = guardTerminal(req);
  if (!guard.ok) return guard.response;

  const body: unknown = await req.json().catch(() => null);
  if (!isValidPayload(body)) {
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
  }
  if (!body.events.every(isValidEvent)) {
    return NextResponse.json({ error: 'invalid_event_row' }, { status: 400 });
  }

  const snapshot: Parameters<typeof saveSnapshot>[0] = {
    capturedAt: body.capturedAt,
    declaredTotal: body.declaredTotal,
    global: body.global,
    warnings: [],
    events: body.events.map((raw) => {
      const r = raw as Record<string, unknown>;
      return {
        externalId: r.externalId as string,
        title: r.title as string,
        country: r.country as string,
        iso2: (r.iso2 as string | null) ?? null,
        lat: Number(r.lat),
        lng: Number(r.lng),
        registrations: Number(r.registrations),
        eventType: r.eventType as Parameters<typeof saveSnapshot>[0]['events'][number]['eventType'],
        registrationOpen: r.registrationOpen as boolean,
        isWaitlist: r.isWaitlist as boolean,
        isUniversal: r.isUniversal as boolean,
        url: r.url as string,
      };
    }),
  };

  const outcome = await saveSnapshot(snapshot, body.files, body.note, body.replace);

  if (!outcome.ok) {
    return NextResponse.json(
      { status: outcome.state.status, reason: outcome.state.status === 'unavailable' ? outcome.state.reason : undefined },
      { status: 503 }
    );
  }
  return NextResponse.json({ status: outcome.result });
}

export async function DELETE(req: NextRequest) {
  const guard = guardTerminal(req);
  if (!guard.ok) return guard.response;

  const capturedAt = req.nextUrl.searchParams.get('capturedAt');
  if (!capturedAt || Number.isNaN(Date.parse(capturedAt))) {
    return NextResponse.json({ error: 'invalid_captured_at' }, { status: 400 });
  }

  const outcome = await removeSnapshot(capturedAt);
  if (!outcome.ok) {
    return NextResponse.json({ status: outcome.state.status }, { status: 503 });
  }
  return NextResponse.json({ removed: true });
}
