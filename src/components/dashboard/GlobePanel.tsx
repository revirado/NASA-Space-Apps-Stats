// FILE: src/components/dashboard/GlobePanel.tsx
// Contenedor del globo: título, leyenda de la escala de marcadores, tarjeta de
// la locación seleccionada y carga diferida del canvas (client-only).

'use client';

import dynamic from 'next/dynamic';
import { ExternalLink, X } from 'lucide-react';
import { useLanguage } from '@/i18n';
import { formatNumber } from '@/lib/format';
import { flagEmoji } from '@/domain/countryMap';
import type { LocalEvent } from '@/domain/types';
import type { GlobeFocus, GlobePoint } from './GlobeCanvas';
import { TypeBadge } from './TypeBadge';

const GlobeCanvas = dynamic(() => import('./GlobeCanvas'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center">
      <div className="h-40 w-40 animate-pulse rounded-full bg-[var(--pl-surface-hover)]" />
    </div>
  ),
});

export function GlobePanel({
  points,
  selected,
  focus,
  onSelect,
  onClear,
}: {
  points: GlobePoint[];
  selected: LocalEvent | null;
  focus: GlobeFocus | null;
  onSelect: (p: GlobePoint) => void;
  onClear: () => void;
}) {
  const { dict, lang } = useLanguage();

  return (
    <div
      id="globe-panel"
      className="relative h-[380px] overflow-hidden rounded-2xl border border-[var(--pl-border)] bg-[var(--pl-surface-sunken)] sm:h-[480px] lg:h-[560px]"
    >
      <GlobeCanvas
        points={points}
        focus={focus}
        selectedId={selected?.externalId ?? null}
        onSelect={onSelect}
        registrantsLabel={dict.globe.registered}
      />

      {/* Título + hint */}
      <div className="pointer-events-none absolute left-4 top-4 max-w-[70%]">
        <h2 className="text-sm font-bold text-[var(--pl-text-primary)]">{dict.globe.title}</h2>
        <p className="mt-0.5 text-[11px] text-[var(--pl-text-muted)]">{dict.globe.hint}</p>
      </div>

      {/* Leyenda de escala */}
      <div className="pointer-events-none absolute bottom-4 right-4 hidden rounded-xl border border-[var(--pl-border)] bg-[var(--pl-surface-raised)]/90 p-2.5 backdrop-blur sm:block">
        <div className="flex items-center gap-1.5" aria-hidden>
          {[12, 18, 24, 30].map((s, i) => (
            <span
              key={i}
              className="rounded-full"
              style={{
                width: s / 2,
                height: s / 2,
                backgroundColor: ['var(--pl-accent-gold-soft)','#ffb400','#ff7f2a','#fc3d21'][i],
                opacity: 0.95,
              }}
            />
          ))}
        </div>
        <p className="mt-1 text-[10px] text-[var(--pl-text-muted)]">
          &lt;100 · &lt;500 · &lt;1.5k · ≥1.5k
        </p>
      </div>

      {/* Tarjeta de locación seleccionada */}
      {selected && (
        <div className="absolute bottom-4 left-4 right-4 max-w-sm rounded-xl border border-[var(--pl-border-strong)] bg-[var(--pl-surface-raised)]/95 p-3.5 shadow-xl backdrop-blur sm:right-auto">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-bold text-[var(--pl-text-primary)]">
                {flagEmoji(selected.iso2)} {selected.title}
              </h3>
              <p className="mt-0.5 text-xs text-[var(--pl-text-secondary)]">{selected.country}</p>
            </div>
            <button
              type="button"
              onClick={onClear}
              aria-label="Close"
              className="rounded-lg p-1 text-[var(--pl-text-muted)] transition-colors hover:bg-[var(--pl-surface-hover)] hover:text-[var(--pl-text-primary)]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <TypeBadge type={selected.eventType} dict={dict} />
            <span className="text-sm font-bold text-[var(--pl-accent-gold)]">
              {formatNumber(selected.registrations, lang)}{' '}
              <span className="text-xs font-medium text-[var(--pl-text-muted)]">
                {dict.common.registrants}
              </span>
            </span>
            {selected.url && (
              <a
                href={selected.url}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-[var(--pl-accent)] hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                NASA
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
