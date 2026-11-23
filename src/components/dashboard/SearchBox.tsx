// FILE: src/components/dashboard/SearchBox.tsx
// Buscador por nombre de locación o por país (D17): compara con normalizeKey
// (ignora acentos y mayúsculas; «sanliurfa» encuentra «Şanlıurfa») y muestra
// SIEMPRE el nombre original. Al elegir, centra el globo en el resultado.

'use client';

import { useMemo, useRef, useState } from 'react';
import { MapPin, Search, X } from 'lucide-react';
import { useLanguage } from '@/i18n';
import { normalizeKey } from '@/domain/normalizeKey';
import { flagEmoji } from '@/domain/countryMap';
import { formatNumber } from '@/lib/format';
import type { LocalEvent } from '@/domain/types';

interface CountryHit {
  country: string;
  iso2: string | null;
  locations: number;
  lat: number;
  lng: number;
}

export function SearchBox({
  events,
  onSelectLocation,
  onSelectCountry,
}: {
  events: LocalEvent[]; // sin Universal Event (D8)
  onSelectLocation: (e: LocalEvent) => void;
  onSelectCountry: (hit: CountryHit) => void;
}) {
  const { dict, lang } = useLanguage();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const countryIndex = useMemo(() => {
    const map = new Map<string, { iso2: string | null; latSum: number; lngSum: number; n: number }>();
    for (const e of events) {
      const entry = map.get(e.country) ?? { iso2: e.iso2, latSum: 0, lngSum: 0, n: 0 };
      entry.latSum += e.lat;
      entry.lngSum += e.lng;
      entry.n += 1;
      if (!entry.iso2 && e.iso2) entry.iso2 = e.iso2;
      map.set(e.country, entry);
    }
    return [...map.entries()].map(([country, v]) => ({
      country,
      iso2: v.iso2,
      locations: v.n,
      lat: v.latSum / v.n,
      lng: v.lngSum / v.n,
    }));
  }, [events]);

  const { locHits, countryHits } = useMemo(() => {
    const q = normalizeKey(query);
    if (q.length === 0) return { locHits: [], countryHits: [] };
    const locHits = events
      .filter((e) => normalizeKey(e.title).includes(q))
      .slice(0, 7);
    const countryHits = countryIndex
      .filter((c) => normalizeKey(c.country).includes(q))
      .slice(0, 5);
    return { locHits, countryHits };
  }, [query, events, countryIndex]);

  const hasResults = locHits.length > 0 || countryHits.length > 0;

  const close = () => {
    setOpen(false);
    inputRef.current?.blur();
  };

  const pickLocation = (e: LocalEvent) => {
    onSelectLocation(e);
    setQuery('');
    close();
  };

  const pickCountry = (hit: CountryHit) => {
    onSelectCountry(hit);
    setQuery('');
    close();
  };

  return (
    <div className="relative">
      <label htmlFor="location-search" className="sr-only">
        {dict.search.placeholder}
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--pl-text-muted)]" />
        <input
          id="location-search"
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setQuery('');
              close();
            }
            if (e.key === 'Enter') {
              if (locHits.length > 0) pickLocation(locHits[0]);
              else if (countryHits.length > 0) pickCountry(countryHits[0]);
            }
          }}
          placeholder={dict.search.placeholder}
          autoComplete="off"
          role="combobox"
          aria-expanded={open && query.length > 0}
          aria-controls="search-results"
          className="h-12 w-full rounded-xl border border-[var(--pl-border)] bg-[var(--pl-surface-raised)] pl-10 pr-10 text-sm text-[var(--pl-text-primary)] placeholder:text-[var(--pl-text-muted)] focus:border-[var(--pl-accent-gold)] focus:outline-none focus:ring-2 focus:ring-[var(--pl-accent-gold)]/30"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              inputRef.current?.focus();
            }}
            aria-label="Clear"
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-[var(--pl-text-muted)] hover:text-[var(--pl-text-primary)]"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {open && query.length > 0 && (
        <div
          id="search-results"
          role="listbox"
          className="scrollbar-thin absolute z-20 mt-2 max-h-80 w-full overflow-y-auto rounded-xl border border-[var(--pl-border-strong)] bg-[var(--pl-surface-raised)] p-1.5 shadow-2xl"
        >
          {!hasResults && (
            <p className="px-3 py-4 text-center text-xs text-[var(--pl-text-muted)]">
              {dict.search.noResults} «{query}»
            </p>
          )}

          {countryHits.length > 0 && (
            <>
              <p className="px-2.5 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--pl-text-muted)]">
                {dict.search.countries}
              </p>
              {countryHits.map((c) => (
                <button
                  key={`c-${c.country}`}
                  type="button"
                  role="option"
                  aria-selected={false}
                  onClick={() => pickCountry(c)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left transition-colors hover:bg-[var(--pl-surface-hover)]"
                >
                  <span className="text-base" aria-hidden>
                    {flagEmoji(c.iso2)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--pl-text-primary)]">
                    {c.country}
                  </span>
                  <span className="text-xs text-[var(--pl-text-muted)]">
                    {formatNumber(c.locations, lang)} {dict.common.locations}
                  </span>
                </button>
              ))}
            </>
          )}

          {locHits.length > 0 && (
            <>
              <p className="px-2.5 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--pl-text-muted)]">
                {dict.search.locations}
              </p>
              {locHits.map((e) => (
                <button
                  key={e.externalId}
                  type="button"
                  role="option"
                  aria-selected={false}
                  onClick={() => pickLocation(e)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left transition-colors hover:bg-[var(--pl-surface-hover)]"
                >
                  <MapPin className="h-4 w-4 shrink-0 text-[var(--pl-accent-gold)]" aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--pl-text-primary)]">
                    {e.title}
                  </span>
                  <span className="max-w-[40%] truncate text-xs text-[var(--pl-text-muted)]">
                    {flagEmoji(e.iso2)} {e.country}
                  </span>
                  <span className="text-xs font-semibold text-[var(--pl-accent-gold)]">
                    {formatNumber(e.registrations, lang)}
                  </span>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
