// FILE: src/components/dashboard/GlobeCanvas.tsx
// Globo sobre three.js mediante react-globe.gl (propuesta concreta del brief,
// sección 16). Continentes desde GeoJSON local (public/geo), un marcador por
// locación con tamaño/color según inscritos (Universal Event excluido, D8),
// anillo de selección, rotación automática y foco animado en la selección.
// Los colores salen SIEMPRE de config/theme.ts (D18).
// Este módulo solo se importa con dynamic(..., { ssr: false }).
//
// RENDIMIENTO (prioridad: no quemar la notebook del usuario):
// 1. Render on-demand: el loop interno de three (RAF a 60fps) se PAUSA
//    (pauseAnimation) cuando no hay nada que animar: sin rotación, sin hover
//    activo, sin interacción reciente, pestaña oculta o globo fuera de vista.
//    El vigilante llama SIEMPRE a pause/resume (son idempotentes en globe.gl):
//    así un loop muerto externamente (p. ej. el destructor del double-mount de
//    StrictMode en dev) se auto-repara en el próximo tick en vez de quedar
//    congelado para siempre. El hover/click sigue funcionando porque cualquier
//    pointermove reanuda el loop un frame antes del raycast.
// 2. Rotación condicionada: solo rota si no hay selección, no hay hover sobre
//    un marcador, no hubo interacción/zoom reciente (con gracia de reanudación)
//    y el globo está suficientemente visible.
// 3. Costo por frame menor: antialias off + pixelRatio acotado a 1.5
//    (three-render-objects usa min(2, dpr): en retina son 4x píxeles),
//    powerPreference 'low-power' (integrada en laptops) y marcadores de 8
//    segmentos en vez de 12.
// 4. Auto-pausa total (attract mode): tras AUTO_PAUSE_MS sin actividad el
//    globo se congela aunque esté rotando; cualquier toque lo despierta.

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

// --- Tuning de rendimiento / rotación (ms y límites) ---
const MAX_PIXEL_RATIO = 1.5; // antes: min(2, dpr) → 4x píxeles en retina
const ROTATE_SPEED = 0.45;
const INTERACT_RESUME_MS = 2500; // tras soltar drag/zoom, cuánto espera la rotación
const POINTER_RESUME_MS = 1200; // debounce para reanudar rotación al salir del canvas
const FOCUS_HOLD_MS = 2200; // tras un foco animado, no rotar mientras aterriza
const LOOP_IDLE_MS = 1600; // ventana de gracia del loop tras cada actividad
const LOOP_TICK_MS = 300; // frecuencia del vigilante de pausa
const AUTO_PAUSE_MS = 45_000; // attract mode: sin actividad prolongada → congela
const FLY_MS = 900; // duración del vuelo de pointOfView

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

  // --- Estado de actividad (refs: nunca provocan re-render) ---
  const pointerInsideRef = useRef(false);
  const lastPointerMoveRef = useRef(0);
  const hoveringPointRef = useRef(false);
  const interactingRef = useRef(false);
  const noRotateUntilRef = useRef(0);
  const keepAliveUntilRef = useRef(0);
  const lastActivityRef = useRef(Date.now());
  const inViewRef = useRef(true);
  const selectedIdRef = useRef<string | null>(selectedId);

  // --- Motor de pausa/reanudación del loop de render ---
  // Ambos delegan SIEMPRE en globe.gl: sus métodos ya son idempotentes
  // (guardados por animationFrameRequestId), así que llamarlos de más es un
  // no-op y de menos deja el globo muerto. Nada de flags locales como fuente
  // de verdad: el vigilante decide y repara cada LOOP_TICK_MS.
  const pauseLoop = useCallback(() => {
    globeRef.current?.pauseAnimation();
  }, []);

  const resumeLoop = useCallback(() => {
    globeRef.current?.resumeAnimation();
  }, []);

  const bumpActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    keepAliveUntilRef.current = Date.now() + LOOP_IDLE_MS;
    resumeLoop();
  }, [resumeLoop]);

  // ¿Corresponde rotar? Rotación = loop corriendo a 60fps, así que es el
  // estado más caro y se concede solo cuando nada se está inspeccionando.
  const syncRotation = useCallback(() => {
    const controls = globeRef.current?.controls();
    if (!controls) return;
    const now = Date.now();
    const want =
      !selectedIdRef.current && // hay selección → quieta (no perder la vista)
      !hoveringPointRef.current && // hover sobre marcador → quieta
      !interactingRef.current && // drag/zoom en curso → quieta
      now >= noRotateUntilRef.current && // gracia post-interacción/foco/salida
      inViewRef.current; // poco visible → no rota
    if (controls.autoRotate !== want) controls.autoRotate = want;
  }, []);

  // Vigilante de pausa: cada LOOP_TICK_MS decide si el loop sigue siendo útil
  // y FUERZA ese estado (idempotente) — reparación automática incluida.
  useEffect(() => {
    const id = window.setInterval(() => {
      const globe = globeRef.current;
      if (!globe) return;
      const now = Date.now();
      syncRotation();
      // syncRotation deja controls.autoRotate sincronizado con la decisión.
      const wantRotate = !!globe.controls()?.autoRotate;
      // El hover sobre un marcador mantiene el loop por sí solo: el raycast
      // corre dentro del tick y es lo único que puede limpiar el hover.
      const pointerBusy =
        hoveringPointRef.current ||
        (pointerInsideRef.current && now - lastPointerMoveRef.current < LOOP_IDLE_MS);
      const needLoop =
        wantRotate || pointerBusy || now < keepAliveUntilRef.current; // gracia post-actividad
      const hidden = document.visibilityState !== 'visible' || !inViewRef.current;
      const longIdle = now - lastActivityRef.current > AUTO_PAUSE_MS; // attract mode agotado
      if (!hidden && !longIdle && needLoop) resumeLoop();
      else pauseLoop();
    }, LOOP_TICK_MS);
    return () => window.clearInterval(id);
  }, [pauseLoop, resumeLoop, syncRotation]);

  // Espejo del selectionId para callbacks estables + reacción al cambio
  useEffect(() => {
    selectedIdRef.current = selectedId;
    bumpActivity(); // transición de color/anillo: dejar animar un instante
  }, [selectedId, bumpActivity]);

  // Cambios de datos (transiciones de puntos/anillos)
  useEffect(() => {
    bumpActivity();
  }, [points, bumpActivity]);

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

  // Pestaña oculta → pausa inmediata; visible → reanudar
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        pauseLoop();
      } else {
        bumpActivity();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [pauseLoop, bumpActivity]);

  // Globo fuera de la ventana (scroll) → pausa; vuelve a verse → reanudar
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries[0]?.isIntersecting ?? true;
        inViewRef.current = visible;
        if (visible) bumpActivity();
      },
      { threshold: 0.2 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [bumpActivity]);

  // Material del océano y derivados memoizados
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
    globeRef.current.pointOfView({ lat: focus.lat, lng: focus.lng, altitude: 1.35 }, FLY_MS);
    // Cubrir el tween completo con el loop encendido y sin rotación.
    keepAliveUntilRef.current = Date.now() + FLY_MS + 250;
    noRotateUntilRef.current = Date.now() + FOCUS_HOLD_MS;
    bumpActivity();
    const controls = globeRef.current.controls();
    if (controls) controls.autoRotate = false;
  }, [focus, bumpActivity]);

  const handleGlobeReady = useCallback(() => {
    const globe = globeRef.current;
    if (!globe) return;
    // Costo por frame: menor resolución efectiva en pantallas retina y GPU
    // integrada en laptops. Nunca sube el costo respecto del default.
    try {
      globe.renderer().setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));
    } catch {
      /* noop */
    }
    const controls = globe.controls();
    if (controls) {
      controls.autoRotate = true;
      controls.autoRotateSpeed = ROTATE_SPEED;
      controls.enableDamping = true;
      controls.dampingFactor = 0.1;
      const onStart = () => {
        interactingRef.current = true;
        bumpActivity();
      };
      const onEnd = () => {
        interactingRef.current = false;
        noRotateUntilRef.current = Date.now() + INTERACT_RESUME_MS;
        bumpActivity();
      };
      controls.addEventListener('start', onStart);
      controls.addEventListener('end', onEnd);
    }
    globe.pointOfView({ lat: 12, lng: -30, altitude: 2.1 }, 0);
  }, [bumpActivity]);

  // Hover sobre un marcador: congela la rotación (no se pierde el tooltip)
  const handlePointHover = useCallback(
    (point: object | null) => {
      const hovered = !!point;
      if (hovered === hoveringPointRef.current) return;
      hoveringPointRef.current = hovered;
      if (hovered) bumpActivity();
    },
    [bumpActivity]
  );

  // Puntero sobre el canvas: loop encendido (para raycast de hover) y rotación congelada
  const handlePointerEnter = useCallback(() => {
    pointerInsideRef.current = true;
    bumpActivity();
  }, [bumpActivity]);

  const handlePointerMove = useCallback(() => {
    pointerInsideRef.current = true;
    lastPointerMoveRef.current = Date.now();
    bumpActivity();
  }, [bumpActivity]);

  const handlePointerLeave = useCallback(() => {
    pointerInsideRef.current = false;
    hoveringPointRef.current = false;
    noRotateUntilRef.current = Date.now() + POINTER_RESUME_MS;
    lastActivityRef.current = Date.now();
  }, []);

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
    <div
      ref={containerRef}
      className="h-full w-full"
      aria-label="Globe"
      onPointerEnter={handlePointerEnter}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      <Globe
        ref={globeRef}
        width={size.w}
        height={size.h}
        backgroundColor="rgba(0,0,0,0)"
        rendererConfig={{ antialias: false, powerPreference: 'low-power' }}
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
        pointResolution={8}
        pointLabel={pointLabel as unknown as string}
        onPointClick={(d: object) => onSelect(d as GlobePoint)}
        onPointHover={handlePointHover}
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
