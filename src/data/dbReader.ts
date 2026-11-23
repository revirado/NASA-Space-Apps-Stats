// FILE: src/data/dbReader.ts
// SnapshotReader sobre base de datos (Fase 2 en adelante, DATA_SOURCE=db).
// SOLO SERVIDOR. Mapea los errores de conexión/esquema a los estados de la
// sección 13 sin exponer credenciales: el detalle técnico va a los logs.
//
// Nota sandbox: el proyecto usa SQLite vía Prisma. En producción (Neon/Postgres)
// solo cambia el provider del datasource; el modelo de la sección 6 es el mismo
// (captured_at como string ISO UTC en SQLite, timestamptz en Postgres).

import type { AppMode, DataSource } from '@/config/appMode';
import { computeStats } from '@/domain/stats';
import type { Snapshot } from '@/domain/types';
import type { DashboardPayload, DataState } from './dataState';
import { mapDbError } from './dbErrors';

export async function getPayloadFromDb(mode: AppMode | null, dataSource: DataSource | null): Promise<DashboardPayload> {
  try {
    const { db } = await import('@/lib/db');

    // Comprobación de esquema: la tabla snapshots debe existir (42P01 equiv.)
    const rows = await db.snapshot.findMany({
      include: { stats: true },
      orderBy: { capturedAt: 'asc' },
    });

    if (rows.length === 0) {
      return { state: { status: 'empty' }, snapshots: [], latestStats: null, mode, dataSource };
    }

    const snapshots: Snapshot[] = rows.map((r) => ({
      capturedAt: r.capturedAt,
      declaredTotal: r.declaredTotal,
      warnings: [],
      global: r.totalRegistrations !== null && r.totalLocalEvents !== null && r.teams !== null
        ? { totalRegistrations: r.totalRegistrations, totalLocalEvents: r.totalLocalEvents, teams: r.teams }
        : null,
      events: r.stats.map((s) => ({
        externalId: s.externalId,
        title: s.title,
        country: s.country,
        iso2: s.iso2,
        lat: s.lat,
        lng: s.lng,
        registrations: s.registrations,
        eventType: s.eventType as Snapshot['events'][number]['eventType'],
        registrationOpen: s.registrationOpen,
        isWaitlist: s.isWaitlist,
        isUniversal: s.isUniversal,
        url: s.url,
      })),
    }));

    const latest = snapshots[snapshots.length - 1];
    return {
      state: { status: 'ok', snapshots: snapshots.length, latestCapturedAt: latest.capturedAt },
      snapshots,
      latestStats: computeStats(latest),
      mode,
      dataSource,
    };
  } catch (err) {
    return { state: mapDbError('dbReader', err), snapshots: [], latestStats: null, mode, dataSource };
  }
}
