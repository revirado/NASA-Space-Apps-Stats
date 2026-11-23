// FILE: src/data/dataState.ts
// Estados de fallo y fallback (sección 13). Una sola forma de acceso a datos:
// devuelve un estado, nunca lanza excepciones a la interfaz. La interfaz solo
// decide qué mostrar según ese estado.

import type { AppMode, DataSource } from '@/config/appMode';
import type { DashboardStats } from '@/domain/stats';
import type { Snapshot } from '@/domain/types';

export type DataState =
  | { status: 'ok'; snapshots: number; latestCapturedAt: string }
  | { status: 'unconfigured'; missingVar: string }
  | { status: 'unavailable'; reason: 'timeout' | 'connection' | 'unknown' }
  | { status: 'uninitialized'; detail?: string }
  | { status: 'empty' };

/** Carga completa que consume la vista del dashboard (Fase 1). */
export interface DashboardPayload {
  state: DataState;
  snapshots: Snapshot[]; // ordenadas por capturedAt ascendente
  latestStats: DashboardStats | null; // stats del snapshot más reciente
  mode: AppMode | null;
  dataSource: DataSource | null;
}
