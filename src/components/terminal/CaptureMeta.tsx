// FILE: src/components/terminal/CaptureMeta.tsx
// Fecha y hora de captura (obligatoria y manual, D15) + zona horaria (por
// defecto la del navegador) + nota opcional. Muestra el instante UTC que se
// guardará, para que el autor verifique antes de confirmar.

'use client';

import { useSyncExternalStore } from 'react';
import { CalendarClock } from 'lucide-react';
import { useLanguage } from '@/i18n';
import { FALLBACK_TIMEZONES, clientTimezones } from '@/lib/timezone';

/** «Store» nulo: las opciones de TZ no cambian durante la vida de la página;
 *  useSyncExternalStore solo separa el snapshot de servidor (fallback) del de
 *  cliente (lista con la TZ del navegador primera), sin setState en efectos. */
const noopSubscribe = () => () => {};

interface CaptureMetaProps {
  wall: string;
  onWall: (v: string) => void;
  tz: string;
  onTz: (v: string) => void;
  note: string;
  onNote: (v: string) => void;
  utcIso: string | null;
}

export function CaptureMeta({ wall, onWall, tz, onTz, note, onNote, utcIso }: CaptureMetaProps) {
  const { dict } = useLanguage();
  const t = dict.terminal;

  const options = useSyncExternalStore(
    noopSubscribe,
    clientTimezones,
    () => FALLBACK_TIMEZONES as unknown as string[]
  );

  return (
    <section className="rounded-lg border border-[var(--pl-border)] bg-[var(--pl-surface)] p-4">
      <header className="mb-3 flex items-center gap-2">
        <CalendarClock className="size-4 text-[var(--pl-accent-gold)]" aria-hidden />
        <h2 className="text-sm font-medium text-[var(--pl-text-primary)]">{t.captureDate}</h2>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs text-[var(--pl-text-muted)]">{t.captureDate}</span>
          <input
            type="datetime-local"
            value={wall}
            required
            onChange={(e) => onWall(e.target.value)}
            className="w-full rounded-md border border-[var(--pl-border)] bg-[var(--pl-surface-sunken)] px-2 py-2 text-sm text-[var(--pl-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pl-accent-gold)]"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs text-[var(--pl-text-muted)]">{t.timezone}</span>
          <select
            value={tz}
            onChange={(e) => onTz(e.target.value)}
            className="scrollbar-thin w-full rounded-md border border-[var(--pl-border)] bg-[var(--pl-surface-sunken)] px-2 py-2 text-sm text-[var(--pl-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pl-accent-gold)]"
          >
            {options.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="mt-2 text-xs text-[var(--pl-text-muted)]">{t.captureDateHint}</p>

      {utcIso ? (
        <p className="mt-2 text-xs text-[var(--pl-success)]">
          {t.utcPreview} <span className="font-semibold">{utcIso}</span>
        </p>
      ) : null}

      <label className="mt-3 block">
        <span className="mb-1 block text-xs text-[var(--pl-text-muted)]">{t.note}</span>
        <input
          type="text"
          value={note}
          maxLength={120}
          placeholder={t.notePlaceholder}
          onChange={(e) => onNote(e.target.value)}
          className="w-full rounded-md border border-[var(--pl-border)] bg-[var(--pl-surface-sunken)] px-2 py-2 text-sm text-[var(--pl-text-primary)] placeholder:text-[var(--pl-text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pl-accent-gold)]"
        />
      </label>
    </section>
  );
}
