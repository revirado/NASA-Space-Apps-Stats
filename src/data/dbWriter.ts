// FILE: src/data/dbWriter.ts
// SnapshotWriter sobre Prisma (Fase 2, sección 16 del brief). ÚNICO punto de
// escritura de la app; solo se usa cuando canUseTerminal() es verdadero.
// SOLO SERVIDOR.
//
// Paso 9 del algoritmo (sección 5): misma capturedAt con archivos idénticos →
// 'unchanged' (idempotencia por sha256); con archivos distintos →
// 'needs_confirmation' salvo replace=true. Todo en UNA transacción: una
// reconstrucción desde los crudos produce filas idénticas (sección 9).

import type { Snapshot } from '@/domain/types';
import { mapDbError } from './dbErrors';

export interface FileRecord {
  sha256: string;
  originalName: string;
  hasEventBlock: boolean;
  offsetStart: number | null;
  offsetEnd: number | null;
}

export type SaveOutcome =
  | { ok: true; result: 'saved' | 'unchanged' | 'needs_confirmation' }
  | { ok: false; state: ReturnType<typeof mapDbError> };

export type RemoveOutcome =
  | { ok: true; removed: true }
  | { ok: false; state: ReturnType<typeof mapDbError> };

export interface SnapshotRowInfo {
  capturedAt: string;
  note: string | null;
  declaredTotal: number;
  totalRegistrations: number | null;
  files: number;
  locations: number;
}

export type ListOutcome =
  | { ok: true; snapshots: SnapshotRowInfo[] }
  | { ok: false; state: ReturnType<typeof mapDbError> };

const SCHEMA_VERSION = 1;

/** Guarda (o pide confirmación para reemplazar) una captura completa. */
export async function saveSnapshot(
  snapshot: Snapshot,
  files: FileRecord[],
  note: string | null,
  replace: boolean
): Promise<SaveOutcome> {
  try {
    const { db } = await import('@/lib/db');
    const result = await db.$transaction(async (tx) => {
      // Marca de esquema conocida (secciones 2 y 13)
      await tx.schemaVersion.upsert({
        where: { version: SCHEMA_VERSION },
        create: { version: SCHEMA_VERSION },
        update: {},
      });

      const existing = await tx.snapshot.findUnique({
        where: { capturedAt: snapshot.capturedAt },
        include: { files: true },
      });

      if (existing) {
        const sameFiles =
          existing.files.length === files.length &&
          [...existing.files].map((f) => f.sha256).sort().join() ===
            [...files].map((f) => f.sha256).sort().join();
        if (sameFiles) return 'unchanged' as const;
        if (!replace) return 'needs_confirmation' as const;

        // Reemplazo: borrar y reinsertar dentro de la misma transacción
        await tx.eventStat.deleteMany({ where: { capturedAt: snapshot.capturedAt } });
        await tx.snapshotFile.deleteMany({ where: { capturedAt: snapshot.capturedAt } });
        await tx.snapshot.delete({ where: { capturedAt: snapshot.capturedAt } });
      }

      await tx.snapshot.create({
        data: {
          capturedAt: snapshot.capturedAt,
          note,
          declaredTotal: snapshot.declaredTotal,
          totalRegistrations: snapshot.global?.totalRegistrations ?? null,
          totalLocalEvents: snapshot.global?.totalLocalEvents ?? null,
          teams: snapshot.global?.teams ?? null,
          files: {
            create: files.map((f) => ({
              sha256: f.sha256,
              originalName: f.originalName,
              offsetStart: f.offsetStart,
              offsetEnd: f.offsetEnd,
              hasEventBlock: f.hasEventBlock,
            })),
          },
          stats: {
            create: snapshot.events.map((e) => ({
              externalId: e.externalId,
              title: e.title,
              country: e.country,
              iso2: e.iso2,
              lat: e.lat,
              lng: e.lng,
              registrations: e.registrations,
              eventType: e.eventType,
              registrationOpen: e.registrationOpen,
              isWaitlist: e.isWaitlist,
              isUniversal: e.isUniversal,
              url: e.url,
            })),
          },
        },
      });
      return 'saved' as const;
    });
    return { ok: true, result };
  } catch (err) {
    return { ok: false, state: mapDbError('dbWriter', err) };
  }
}

/** Borra una captura completa (stats + files + snapshot) en una transacción. */
export async function removeSnapshot(capturedAt: string): Promise<RemoveOutcome> {
  try {
    const { db } = await import('@/lib/db');
    await db.$transaction(async (tx) => {
      await tx.eventStat.deleteMany({ where: { capturedAt } });
      await tx.snapshotFile.deleteMany({ where: { capturedAt } });
      await tx.snapshot.delete({ where: { capturedAt } });
    });
    return { ok: true, removed: true };
  } catch (err) {
    return { ok: false, state: mapDbError('dbWriter', err) };
  }
}

/** Lista de capturas cargadas (para la vista de la terminal). */
export async function listSnapshots(): Promise<ListOutcome> {
  try {
    const { db } = await import('@/lib/db');
    const rows = await db.snapshot.findMany({
      orderBy: { capturedAt: 'asc' },
      include: { _count: { select: { files: true, stats: true } } },
    });
    return {
      ok: true,
      snapshots: rows.map((r) => ({
        capturedAt: r.capturedAt,
        note: r.note,
        declaredTotal: r.declaredTotal,
        totalRegistrations: r.totalRegistrations,
        files: r._count.files,
        locations: r._count.stats,
      })),
    };
  } catch (err) {
    return { ok: false, state: mapDbError('dbWriter', err) };
  }
}
