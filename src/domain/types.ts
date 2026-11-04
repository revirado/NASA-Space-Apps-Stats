// FILE: src/domain/types.ts
// Tipos crudos (derivados de los JSON reales, sección 4 del brief técnico) y
// modelo limpio. Módulo puro: sin I/O.

export type EventType = 'In-Person' | 'Virtual' | 'Virtual & In-Person';

export const EVENT_TYPES: readonly EventType[] = [
  'In-Person',
  'Virtual',
  'Virtual & In-Person',
];

/** País pseudo-locación del Universal Event (D8). No es un país. */
export const UNIVERSAL_COUNTRY = 'Anywhere in the World';

// ---------------------------------------------------------------------------
// Crudo: solo los campos usados
// ---------------------------------------------------------------------------

export interface RawLocationNode {
  geometry: { coordinates: [number, number] }; // [lng, lat] (GeoJSON, D6)
  properties: {
    id: string; // opaco, no se interpreta (D5)
    title: string;
    displayName: string;
    country: string;
    cachedRegistrations: number;
    eventType: EventType;
    registrationEnabled: boolean;
    isRegistrationOpen: boolean;
    isHostEvent: boolean;
    isHybrid: boolean;
    isVirtual: boolean;
    isWaitlist: boolean;
    meta: { htmlUrl: string };
  };
}

export interface RawLocationEdge {
  cursor: string; // base64 de 'offset:N' (D3)
  node: RawLocationNode;
}

export interface RawEventBlock {
  cachedEventRegistrations: number;
  cachedLocalEvents: number;
  cachedTeams: number;
  cachedLocalEventRegistrations: number | null; // siempre null hoy (D12)
  startDate: string;
  endDate: string;
}

export interface RawOpenLocationsBlock {
  totalCount: number;
  edges: RawLocationEdge[];
  pageInfo: { endCursor: string; hasNextPage: boolean };
}

export interface RawBlock {
  data: {
    contentFilterForm?: unknown; // formulario de la UI de la plataforma: se ignora (D1)
    event?: RawEventBlock;
    openLocations?: RawOpenLocationsBlock;
  };
}

export type RawFile = RawBlock[];

// ---------------------------------------------------------------------------
// Modelo limpio
// ---------------------------------------------------------------------------

export interface LocalEvent {
  externalId: string;
  title: string;
  country: string;
  iso2: string | null;
  lat: number;
  lng: number;
  registrations: number;
  eventType: EventType;
  registrationOpen: boolean;
  isWaitlist: boolean;
  isUniversal: boolean;
  url: string;
}

export interface GlobalStats {
  totalRegistrations: number; // cachedEventRegistrations
  totalLocalEvents: number; // cachedLocalEvents (declaradas)
  teams: number; // cachedTeams
}

export interface Snapshot {
  capturedAt: string; // ISO UTC, indicada por el autor (D15)
  events: LocalEvent[];
  global: GlobalStats | null;
  declaredTotal: number; // totalCount de la plataforma
  warnings: string[];
}
