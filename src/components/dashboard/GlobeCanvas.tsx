// FILE: src/components/dashboard/GlobeCanvas.tsx
// Globo sobre three.js mediante react-globe.gl (propuesta concreta del brief,
// sección 16). Continentes desde GeoJSON local (public/geo), un marcador por
// locación con tamaño/color según inscritos (Universal Event excluido, D8),
// anillo de selección, rotación automática y foco animado en la selección.
// Los colores salen SIEMPRE de config/theme.ts (D18).
// Este módulo solo se importa con dynamic(..., { ssr: false }).

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Globe, { type GlobeMethods } from 'react-globe.gl';
import * as THREE from 'three';
import { palette } from '@/config/theme';
import type { EventType } from '@/domain/types';

export interface GlobePoint {
  externalId: string;
  title: string;
  country: string;
  iso2: string | null;
  lat: number;
  lng: number;
  registrations: number;
  eventType: EventType;
}

export interface GlobeFocus {
  lat: number;
  lng: number;
  key: number; // cambia en cada selección para re-disparar el efecto
}

interface Props {
  points: GlobePoint[];
  focus: GlobeFocus | null;
  selectedId: string | null;
  onSelect: (p: GlobePoint) => void;
  registrantsLabel: string;
}

interface GeoFeature {
  type: 'Feature';
  geometry: { type: string; coordinates: unknown } | null;
  properties: Record<string, unknown>;
}

function markerColor(registrations: number): string {
  const s = palette.markerScale;
  if (registrations >= 1500) return s[3];
  if (registrations >= 500) return s[2];
  if (registrations >= 100) return s[1];
  return s[0];
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export default function GlobeCanvas({ points, focus, selectedId, onSelect, registrantsLabel }: Props) {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [features, setFeatures] = useState<GeoFeature[]>([]);

  // Dimensiones responsivas del contenedor
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setSize({ w: Math.floor(width), h: Math.floor(height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Continentes: GeoJSON local servido desde /public/geo
  useEffect(() => {
    let cancelled = false;
    fetch('/geo/countries-110m.geojson')
      .then((r) => r.json())
      .then((json: { features: GeoFeature[] }) => {
        if (cancelled) return;
        setFeatures(json.features.filter((f) => f.geometry));
      })
      .catch(() => setFeatures([]));
    return () => {
      cancelled = true;
    };
  }, []);

  // Material del océano y alturas de marcador memoizadas
  const globeMaterial = useMemo(
    () => new THREE.MeshPhongMaterial({ color: new THREE.Color(palette.globeOcean) }),
    []
  );

  const maxRegs = useMemo(
    () => Math.max(1, ...points.map((p) => p.registrations)),
    [points]
  );

  const ringsData = useMemo(() => {
    const sel = points.find((p) => p.externalId === selectedId);
    return sel ? [sel] : [];
  }, [points, selectedId]);

  // Foco animado al seleccionar (buscador o clic en marcador)
  useEffect(() => {
    if (!focus || !globeRef.current) return;
    globeRef.current.pointOfView({ lat: focus.lat, lng: focus.lng, altitude: 1.35 }, 900);
    const controls = globeRef.current.controls();
    if (controls) controls.autoRotate = false;
  }, [focus]);

  const handleGlobeReady = () => {
    const controls = globeRef.current?.controls();
    if (controls) {
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.45;
      controls.enableDamping = true;
      controls.dampingFactor = 0.1;
    }
    globeRef.current?.pointOfView({ lat: 12, lng: -30, altitude: 2.1 }, 0);
  };

  const pointLabel = (p: GlobePoint): string => {
    const t = escapeHtml(p.title);
    const c = escapeHtml(p.country);
    return `
      <div style="padding:8px 10px;border-radius:10px;background:var(--pl-surface-raised);border:1px solid var(--pl-border-strong);box-shadow:0 8px 24px rgba(0,0,0,.45);font-family:inherit">
        <div style="font-weight:700;font-size:13px;color:var(--pl-text-primary)">${t}</div>
        <div style="font-size:11px;color:var(--pl-text-secondary);margin-top:2px">${c}</div>
        <div style="font-size:12px;font-weight:600;color:var(--pl-accent-gold);margin-top:4px">${p.registrations.toLocaleString('en-US')} ${registrantsLabel}</div>
      </div>`;
  };

  return (
    <div ref={containerRef} className="h-full w-full" aria-label="Globe">
      <Globe
        ref={globeRef}
        width={size.w}
        height={size.h}
        backgroundColor="rgba(0,0,0,0)"
        globeMaterial={globeMaterial}
        showAtmosphere
        atmosphereColor={palette.accent}
        atmosphereAltitude={0.16}
        onGlobeReady={handleGlobeReady}
        polygonsData={features}
        polygonAltitude={0.006}
        polygonCapColor={() => 'rgba(28, 34, 48, 0.92)'}
        polygonSideColor={() => 'rgba(0,0,0,0)'}
        polygonStrokeColor={() => palette.globeLandStroke}
        polygonsTransitionDuration={0}
        pointsData={points}
        pointLat={(d: GlobePoint) => d.lat}
        pointLng={(d: GlobePoint) => d.lng}
        pointColor={(d: GlobePoint) =>
          d.externalId === selectedId ? palette.markerHighlight : markerColor(d.registrations)
        }
        pointAltitude={(d: GlobePoint) => 0.008 + Math.min(1, Math.sqrt(d.registrations / maxRegs)) * 0.055}
        pointRadius={(d: GlobePoint) => 0.11 + Math.min(1, Math.sqrt(d.registrations / maxRegs)) * 0.22}
        pointLabel={pointLabel as unknown as string}
        onPointClick={(d: object) => onSelect(d as GlobePoint)}
        pointsMerge={false}
        pointsTransitionDuration={300}
        ringsData={ringsData}
        ringLat={(d: GlobePoint) => d.lat}
        ringLng={(d: GlobePoint) => d.lng}
        ringColor={() => palette.markerHighlight}
        ringMaxRadius={2.4}
        ringPropagationSpeed={1.4}
        ringRepeatPeriod={900}
        ringAltitude={0.012}
      />
    </div>
  );
}
