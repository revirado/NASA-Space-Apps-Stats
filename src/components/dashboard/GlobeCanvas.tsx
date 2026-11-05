// FILE: src/components/dashboard/GlobeCanvas.tsx
// Globo sobre three.js mediante react-globe.gl (propuesta concreta del brief,
// sección 16). Continentes desde GeoJSON local (public/geo), un marcador por
// locación con tamaño/color según inscritos (Universal Event excluido, D8),
// anillo de selección, rotación automática y foco animado en la selección.
// Los colores salen SIEMPRE de config/theme.ts (D18).
// Este módulo solo se importa con dynamic(..., { ssr: false }).
//
// REGLA DE ROTACIÓN (pedido explícito del usuario): el globo gira SIEMPRE,
// incluso durante drag/zoom o con una selección activa. La ÚNICA pausa es el
// hover del puntero sobre un marcador de local event (para no perder el
// tooltip). Se conserva además una gracia corta tras un foco de búsqueda para
// que el destino aterrice y sea visible antes de que el giro lo lleve.
//
// RENDIMIENTO (prioridad: no quemar la notebook del usuario). Ahorro medido
// contra la versión anterior (60/120 fps, dpr hasta 1.5, Phong, atmósfera):
// 1. CAP DE FPS A 30: el loop interno de globe.gl corre al refresco nativo
//    (60/120 Hz). En vez de eso, un gobernador propio hace UN único frame por
//    paso: resumeAnimation() ejecuta _animationCycle() de forma síncrona
//    (render + raycast de hover + tweens + controls.update) y pauseAnimation()
//    cancela el siguiente rAF — verificado en el código de globe.gl. La
//    rotación NO se altera: OrbitControls corrige autoRotate por deltaTime.
//    El gobernador corre en un rAF propio, es el vigilante (auto-repara el
//    loop muerto del destructor del double-mount de StrictMode) y se omite a
//    sí mismo con la pestaña oculta o el globo fuera de vista.
// 2. PIXELADO INTENCIONAL: pixelRatio fijo 0.5 + image-rendering: pixelated.
//    El canvas se dibuja a 1/4 de área y se escala con bordes duros: 4x menos
//    fragmentos que a 1x y hasta 36x menos que el viejo dpr 1.5 en retina.
//    Los tooltips son DOM (no canvas) y siguen nítidos.
// 3. ESFERA LOW-POLY EVIDENTE: la malla del océano (SphereGeometry de ~7.500
//    triángulos con Phong + specular) se reemplaza por un IcosahedronGeometry
//    de 320 triángulos con MeshLambertMaterial flatShading (sin specular, sin
//    gradientes suaves: facetas planas). detail 2 es el mínimo que mantiene la
//    tierra (altitud 0.006) siempre por encima del océano facetado.
// 4. ATMÓSFERA OFF: una esfera transparente entera menos renderizada por frame.
// 5. POLÍGONOS MÁS BARATOS: sin caras laterales (sideColor null — antes se
//    generaban invisibles), teselación de tapa al mínimo útil
//    (capCurvatureResolution 2) y tapa opaca (sin alpha blending por país).
// 6. MARCADORES MÍNIMOS: pointResolution 4 (prismas de ~10 triángulos vs ~32)
//    y sin transiciones. pointsMerge sigue en false A PROPÓSITO: con la
//    geometría fusionada globe.gl ignora el hover de los puntos (verificado en
//    su fuente) y perderíamos la única pausa de rotación.
// 6b. HITBOX INVISIBLE POR MARCADOR: el cilindro visible mide ~2-3 px en
//    pantalla; aterrizar el hover sobre él con el globo girando es impracticable
//    (verificado con telemetría del raycaster). Cada marcador lleva además una
//    esfera de colisión invisible (visible=false → three ni la dibuja: costo de
//    render CERO) de radio fijo en la capa objects: el raycast la detecta,
//    dispara onObjectHover/onObjectClick y muestra el mismo tooltip. Ojo: las
//    mallas invisibles SÍ participan del raycast (three no consulta visible).
// 7. Se eliminó el auto-pause de 45 s (contradice "girar siempre"); quedan las
//    pausas invisibles: pestaña oculta y globo fuera del viewport.

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

// --- Tuning de rendimiento / rotación ---
const TARGET_FPS = 30; // cap duro del loop de render (velocidad de giro intacta por deltaTime)
const FRAME_MS = 1000 / TARGET_FPS;
const PIXEL_RATIO = 0.5; // render interno a media resolución + upscale pixelado
const ICO_DETAIL = 2; // icosaedro del océano: 320 triángulos (mín. para no hundir la tierra)
const ROTATE_SPEED = 0.45;
const FOCUS_HOLD_MS = 2200; // tras un foco animado (búsqueda/selección): pausa corta para verlo
const FLY_MS = 900; // duración del vuelo de pointOfView
const HITBOX_RADIUS = 1.6; // radio (unidades de mundo ≈ 0.9°) de la esfera de colisión invisible

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

  // --- Estado ligero (refs: nunca provocan re-render) ---
  const hoveringPointRef = useRef(false); // ÚNICA condición de pausa de giro
  const focusHoldUntilRef = useRef(0); // gracia corta tras un foco animado
  const inViewRef = useRef(true);
  const selectedIdRef = useRef<string | null>(selectedId);

  // ¿Corresponde rotar? Gira siempre salvo hover sobre marcador (y la gracia
  // del foco). El zoom/drag/selección ya NO detienen el giro.
  const syncRotation = useCallback(() => {
    const controls = globeRef.current?.controls();
    if (!controls) return;
    const want =
      !hoveringPointRef.current && // hover sobre marcador → quieta (tooltip estable)
      Date.now() >= focusHoldUntilRef.current && // aterrizaje de búsqueda → gracia breve
      inViewRef.current; // fuera de vista el gobernador ni renderiza
    if (controls.autoRotate !== want) controls.autoRotate = want;
  }, []);

  // Gobernador de frames: UN frame cada FRAME_MS (resume síncrono + cancelación
  // del siguiente rAF). También es el vigilante que auto-repara el loop interno
  // si algo externo lo mató, y se apaga solo cuando el globo no está a la vista.
  useEffect(() => {
    let rafId = 0;
    let lastFrame = 0;
    const step = (t: number) => {
      rafId = window.requestAnimationFrame(step);
      const globe = globeRef.current;
      if (!globe) return;
      if (document.visibilityState !== 'visible' || !inViewRef.current) return;
      if (t - lastFrame < FRAME_MS - 1) return;
      lastFrame = t;
      syncRotation();
      globe.resumeAnimation(); // BISECT: free-run temporal (sin pause)
    };
    rafId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(rafId);
  }, [syncRotation]);

  // Espejo del selectionId para callbacks estables
  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

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

  // Globo fuera de la ventana (scroll) → el gobernador deja de renderizar
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        inViewRef.current = entries[0]?.isIntersecting ?? true;
      },
      { threshold: 0.2 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Material del océano: Lambert plano facetado (sin specular ni gradientes)
  const globeMaterial = useMemo(
    () => new THREE.MeshLambertMaterial({ color: new THREE.Color(palette.globeOcean), flatShading: true }),
    []
  );

  // Geometría/material compartidos de las esferas de colisión invisibles
  // (las mallas por-datum las crea objectThreeObject; visible=false no resta
  // rendimiento de render porque three las saltea por completo).
  const hitboxGeo = useMemo(() => new THREE.SphereGeometry(HITBOX_RADIUS, 8, 6), []);
  // material.visible=false → three la saltea al renderizar (0 draw calls) pero
  // el raycast no consulta material.visible → sigue actuando de colisionador.
  const hitboxMat = useMemo(() => new THREE.MeshBasicMaterial({ visible: false }), []);
  const makeHitbox = useCallback(
    () => new THREE.Mesh(hitboxGeo, hitboxMat),
    [hitboxGeo, hitboxMat]
  );

  const maxRegs = useMemo(
    () => Math.max(1, ...points.map((p) => p.registrations)),
    [points]
  );

  const ringsData = useMemo(() => {
    const sel = points.find((p) => p.externalId === selectedId);
    return sel ? [sel] : [];
  }, [points, selectedId]);

  // Foco animado al seleccionar (buscador o clic en marcador). La cámara vuela
  // igual que siempre; la rotación solo se toma una gracia breve.
  useEffect(() => {
    if (!focus || !globeRef.current) return;
    globeRef.current.pointOfView({ lat: focus.lat, lng: focus.lng, altitude: 1.35 }, FLY_MS);
    focusHoldUntilRef.current = Date.now() + FOCUS_HOLD_MS;
  }, [focus]);

  const handleGlobeReady = useCallback(() => {
    const globe = globeRef.current;
    if (!globe) return;
    // 1) Render pixelado: media resolución + upscale con bordes duros.
    try {
      globe.renderer().setPixelRatio(PIXEL_RATIO);
      const canvas = globe.renderer().domElement;
      canvas.style.imageRendering = 'pixelated';
    } catch {
      /* noop */
    }
    // 2) Océano low-poly: reemplazar la esfera densa por un icosaedro plano.
    try {
      globe.scene().traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (
          mesh.isMesh &&
          mesh.material === globeMaterial &&
          mesh.geometry instanceof THREE.SphereGeometry
        ) {
          const radius = mesh.geometry.parameters.radius;
          mesh.geometry.dispose();
          mesh.geometry = new THREE.IcosahedronGeometry(radius, ICO_DETAIL);
        }
      });
    } catch {
      /* noop */
    }
    // 3) Rotación permanente + damping suave. Sin listeners de start/end: el
    //    giro ya no se congela al interactuar (regla nueva).
    const controls = globe.controls();
    if (controls) {
      controls.autoRotate = true;
      controls.autoRotateSpeed = ROTATE_SPEED;
      controls.enableDamping = true;
      controls.dampingFactor = 0.1;
    }
    globe.pointOfView({ lat: 12, lng: -30, altitude: 2.1 }, 0);
  }, [globeMaterial]);

  // Hover sobre un marcador: única pausa de la rotación
  const handlePointHover = useCallback((point: object | null) => {
    hoveringPointRef.current = !!point;
  }, []);

  // El puntero puede irse del canvas parado sobre un marcador (el raycast
  // interno no detecta pointerleave): limpiar el hover local al salir.
  const handlePointerLeave = useCallback(() => {
    hoveringPointRef.current = false;
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
      onPointerLeave={handlePointerLeave}
    >
      <Globe
        ref={globeRef}
        width={size.w}
        height={size.h}
        backgroundColor="rgba(0,0,0,0)"
        rendererConfig={{ antialias: false, powerPreference: 'low-power' }}
        globeMaterial={globeMaterial}
        showAtmosphere={false}
        onGlobeReady={handleGlobeReady}
        polygonsData={features}
        polygonAltitude={0.006}
        polygonCapColor={() => palette.globeLand}
        polygonSideColor={(() => null) as unknown as () => string}
        polygonStrokeColor={() => palette.globeLandStroke}
        polygonCapCurvatureResolution={2}
        polygonsTransitionDuration={0}
        pointsData={points}
        pointLat={(d: GlobePoint) => d.lat}
        pointLng={(d: GlobePoint) => d.lng}
        pointColor={(d: GlobePoint) =>
          d.externalId === selectedId ? palette.markerHighlight : markerColor(d.registrations)
        }
        pointAltitude={(d: GlobePoint) => 0.008 + Math.min(1, Math.sqrt(d.registrations / maxRegs)) * 0.055}
        pointRadius={(d: GlobePoint) => 0.11 + Math.min(1, Math.sqrt(d.registrations / maxRegs)) * 0.22}
        pointResolution={4}
        pointLabel={pointLabel as unknown as string}
        onPointClick={(d: object) => onSelect(d as GlobePoint)}
        onPointHover={handlePointHover}
        pointsMerge={false}
        pointsTransitionDuration={0}
        // Capa de colisión invisible: hace el hover/click alcanzable aunque el
        // cilindro visible mida 2-3 px (ver comentario 6b del encabezado).
        objectsData={points}
        objectLat={(d: GlobePoint) => d.lat}
        objectLng={(d: GlobePoint) => d.lng}
        objectAltitude={0.01}
        objectThreeObject={makeHitbox as unknown as (d: object) => THREE.Object3D}
        objectsTransitionDuration={0}
        objectLabel={pointLabel as unknown as string}
        onObjectClick={(d: object) => onSelect(d as GlobePoint)}
        onObjectHover={handlePointHover}
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
