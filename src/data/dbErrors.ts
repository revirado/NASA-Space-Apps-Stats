// FILE: src/data/dbErrors.ts
// Mapeo compartido de errores de Prisma a los estados de la sección 13, sin
// exponer credenciales: el detalle técnico va a los logs del servidor.

import type { DataState } from './dataState';

interface PrismaErrorLike {
  code?: string;
  message?: string;
}

export function mapDbError(source: string, err: unknown): Extract<DataState, { status: 'unavailable' | 'uninitialized' }> {
  const e = err as PrismaErrorLike;
  console.error(`[${source}]`, e?.code ?? '', e?.message ?? err);
  const code = e?.code ?? '';
  if (code === 'P2021' || code === 'P2022') {
    return { status: 'uninitialized', detail: 'Las tablas no existen o no coinciden.' };
  }
  if (code === 'P1001' || code === 'P1002') {
    return { status: 'unavailable', reason: 'connection' };
  }
  if (code === 'P2024') {
    return { status: 'unavailable', reason: 'timeout' };
  }
  return { status: 'unavailable', reason: 'unknown' };
}
