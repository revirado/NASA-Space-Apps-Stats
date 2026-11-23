// FILE: src/components/terminal/types.ts
// Tipos compartidos de la terminal de carga. La UI muestra hechos estructurados
// (etiquetas del diccionario D19); los mensajes de diagnóstico del domain
// (advertencias/rechazos) son datos del parser y se muestran tal cual.

import type { ClassifyResult } from '@/domain/parser';

/** Un archivo crudo ya procesado en el navegador. */
export interface TerminalFile {
  name: string;
  size: number;
  sha256: string;
  result: ClassifyResult;
}

export type LogKind = 'cmd' | 'info' | 'ok' | 'warn' | 'err' | 'dim';

export interface LogLine {
  kind: LogKind;
  text: string;
}

export const LOG_KIND_CLASS: Record<LogKind, string> = {
  cmd: 'text-[var(--pl-text-primary)]',
  info: 'text-[var(--pl-text-secondary)]',
  ok: 'text-[var(--pl-success)]',
  warn: 'text-[var(--pl-warning)]',
  err: 'text-[var(--pl-danger)]',
  dim: 'text-[var(--pl-text-muted)]',
};
