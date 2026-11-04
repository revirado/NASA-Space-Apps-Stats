// FILE: src/components/dashboard/DashboardApp.tsx
// Vista raíz del dashboard: compone header, tarjetas, globo, buscador,
// rankings, evolución y pie. Estado de selección compartido entre el buscador
// y el globo. Solo decide qué mostrar según el DataState (sección 13).

'use client';

import { useState } from 'react';
import { LanguageProvider, useLanguage } from '@/i18n';
import { flagEmoji } from '@/domain/countryMap';
import type { LocalEvent } from '@/domain/types';
import type { DashboardPayload } from '@/data/dataState';
import type { GlobeFocus, GlobePoint } from './GlobeCanvas';
import { Header } from './Header';
import { Footer } from './Footer';
import { FailState } from './FailState';
import { KpiCards } from './KpiCards';
import { GlobePanel } from './GlobePanel';
import { SearchBox } from './SearchBox';
import { RankingsPanel } from './RankingsPanel';
import { EvolutionCard } from './EvolutionCard';

export function DashboardApp({ payload }: { payload: DashboardPayload }) {
  return (
    <LanguageProvider>
      <DashboardInner payload={payload} />
    </LanguageProvider>
  );
}

function DashboardInner({ payload }: { payload: DashboardPayload }) {
  useLanguage(); // asegura re-render al cambiar idioma
  const stateOk = payload.state.status === 'ok';
  const latest = payload.snapshots.length > 0 ? payload.snapshots[payload.snapshots.length - 1] : null;

  const [selected, setSelected] = useState<LocalEvent | null>(null);
  const [focus, setFocus] = useState<GlobeFocus | null>(null);

  const events = latest?.events ?? [];
  const nonUniversal = events.filter((e) => !e.isUniversal); // D8: el Universal no va al globo
  const points: GlobePoint[] = nonUniversal.map((e) => ({
    externalId: e.externalId,
    title: e.title,
    country: e.country,
    iso2: e.iso2,
    lat: e.lat,
    lng: e.lng,
    registrations: e.registrations,
    eventType: e.eventType,
  }));

  const focusOn = (lat: number, lng: number) => {
    setFocus({ lat, lng, key: Date.now() });
    // En móvil, llevar la vista hacia el globo al seleccionar desde el buscador
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      document.getElementById('globe-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-[var(--pl-page-bg)]">
      <Header lastCapturedAt={stateOk ? payload.state.latestCapturedAt : null} />

      <main className="mx-auto w-full max-w-7xl flex-1 space-y-4 px-4 py-5 sm:py-6">
        {stateOk && latest ? (
          <>
            <KpiCards stats={payload.latestStats} />

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
              <div className="lg:col-span-3">
                <GlobePanel
                  points={points}
                  selected={selected}
                  focus={focus}
                  onSelect={(p) => {
                    const found = nonUniversal.find((e) => e.externalId === p.externalId) ?? null;
                    setSelected(found);
                    focusOn(p.lat, p.lng);
                  }}
                  onClear={() => setSelected(null)}
                />
              </div>
              <div className="space-y-4 lg:col-span-2">
                <SearchBox
                  events={nonUniversal}
                  onSelectLocation={(e) => {
                    setSelected(e);
                    focusOn(e.lat, e.lng);
                  }}
                  onSelectCountry={(hit) => {
                    setSelected(null);
                    focusOn(hit.lat, hit.lng);
                  }}
                />
                <RankingsPanel events={events} />
              </div>
            </div>

            <EvolutionCard snapshots={payload.snapshots} />
          </>
        ) : (
          <FailState state={payload.state} />
        )}
      </main>

      <Footer />
    </div>
  );
}
