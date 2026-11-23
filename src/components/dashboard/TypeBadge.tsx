// FILE: src/components/dashboard/TypeBadge.tsx
// Badge del tipo de locación (D11): color del token de paleta + etiqueta del
// diccionario. Compartido por rankings, globo y tarjetas.

'use client';

import { palette } from '@/config/theme';
import type { EventType } from '@/domain/types';
import type { Dict } from '@/i18n/dictionaries';

const COLORS: Record<EventType, string> = {
  'In-Person': palette.typeInPerson,
  'Virtual': palette.typeVirtual,
  'Virtual & In-Person': palette.typeHybrid,
};

export function typeLabel(type: EventType, dict: Dict): string {
  switch (type) {
    case 'In-Person':
      return dict.rankings.typeInPerson;
    case 'Virtual':
      return dict.rankings.typeVirtual;
    case 'Virtual & In-Person':
      return dict.rankings.typeHybrid;
  }
}

export function TypeBadge({ type, dict }: { type: EventType; dict: Dict }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--pl-border)] bg-[var(--pl-surface)] px-2 py-0.5 text-[11px] font-medium text-[var(--pl-text-secondary)] whitespace-nowrap">
      <span
        aria-hidden
        className="h-1.5 w-1.5 rounded-full shrink-0"
        style={{ backgroundColor: COLORS[type] }}
      />
      {typeLabel(type, dict)}
    </span>
  );
}
