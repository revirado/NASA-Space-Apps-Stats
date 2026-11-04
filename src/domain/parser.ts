// FILE: src/domain/parser.ts
// Parser y validación de los JSON crudos de la plataforma (D1–D8, sección 5).
// Módulo puro, isomórfico (corre en el servidor y en el navegador de la
// terminal). No asume posición de bloques ni nombre/tamaño/orden de archivos.

import {
  UNIVERSAL_COUNTRY,
  EVENT_TYPES,
  type EventType,
  type GlobalStats,
  type LocalEvent,
  type RawBlock,
  type RawLocationEdge,
  type Snapshot,
} from './types';
import { getIso2 } from './countryMap';

// ---------------------------------------------------------------------------
// Cursor (D3): base64 de 'offset:N'
// ---------------------------------------------------------------------------

function base64Decode(input: string): string {
  if (typeof atob === 'function') return atob(input);
  // Node / Bun
  return Buffer.from(input, 'base64').toString('binary');
}

export function decodeCursorOffset(cursor: unknown): number | null {
  if (typeof cursor !== 'string') return null;
  try {
    const decoded = base64Decode(cursor);
    const m = /^offset:(\d+)$/.exec(decoded);
    return m ? Number(m[1]) : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Clasificación de archivos por estructura, nunca por nombre (D1, D2)
// ---------------------------------------------------------------------------

export interface ParsedFile {
  originalName: string;
  hasEventBlock: boolean;
  event: GlobalStats | null;
  edges: RawLocationEdge[];
  totalCount: number | null;
  hasNextPage: boolean | null;
  offsetStart: number | null;
  offsetEnd: number | null;
  ignoredContentFilterBlocks: number;
  warnings: string[];
}

export type ClassifyResult =
  | { ok: true; file: ParsedFile }
  | { ok: false; code: 'INVALID_JSON' | 'NOT_BLOCK_ARRAY'; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function classifyFile(originalName: string, json: unknown): ClassifyResult {
  if (!Array.isArray(json)) {
    return {
      ok: false,
      code: 'NOT_BLOCK_ARRAY',
      message: `El archivo ${originalName} no es un array de bloques { data: ... }.`,
    };
  }

  const warnings: string[] = [];
  let hasEventBlock = false;
  let event: GlobalStats | null = null;
  let edges: RawLocationEdge[] = [];
  let totalCount: number | null = null;
  let hasNextPage: boolean | null = null;
  let endCursor: string | null = null;
  let ignoredContentFilterBlocks = 0;

  for (let i = 0; i < json.length; i++) {
    const block = json[i];
    if (!isRecord(block) || !isRecord(block.data)) {
      warnings.push(`Bloque #${i} de ${originalName} no tiene la forma { data: ... }; se ignora.`);
      continue;
    }
    const data = block.data as RawBlock['data'];

    if ('contentFilterForm' in data) {
      ignoredContentFilterBlocks++;
      continue; // formulario de filtros de la interfaz: se ignora (D1)
    }

    if ('event' in data && data.event) {
      const ev = data.event;
      hasEventBlock = true;
      if (!event) {
        event = {
          totalRegistrations: Number(ev.cachedEventRegistrations),
          totalLocalEvents: Number(ev.cachedLocalEvents),
          teams: Number(ev.cachedTeams),
        };
      } else {
        warnings.push(`${originalName} trae más de un bloque 'event'; se usa el primero (D2).`);
      }
      continue;
    }

    if ('openLocations' in data && data.openLocations) {
      const ol = data.openLocations;
      if (Array.isArray(ol.edges)) edges = edges.concat(ol.edges as RawLocationEdge[]);
      if (typeof ol.totalCount === 'number') {
        totalCount = totalCount === null ? ol.totalCount : Math.max(totalCount, ol.totalCount);
      }
      if (ol.pageInfo && typeof ol.pageInfo === 'object') {
        hasNextPage = Boolean(ol.pageInfo.hasNextPage);
        endCursor = typeof ol.pageInfo.endCursor === 'string' ? ol.pageInfo.endCursor : null;
      }
      continue;
    }

    warnings.push(`Bloque #${i} de ${originalName} tiene una clave desconocida; se ignora.`);
  }

  const offsetEnd = endCursor !== null ? decodeCursorOffset(endCursor) : null;
  const offsetStart =
    edges.length > 0 ? decodeCursorOffset(edges[0]?.cursor) : null;

  return {
    ok: true,
    file: {
      originalName,
      hasEventBlock,
      event,
      edges,
      totalCount,
      hasNextPage,
      offsetStart,
      offsetEnd,
      ignoredContentFilterBlocks,
      warnings,
    },
  };
}

// ---------------------------------------------------------------------------
// Construcción del snapshot con validación de completitud (D3, D4)
// ---------------------------------------------------------------------------

export type BuildResult =
  | { ok: true; snapshot: Snapshot }
  | {
      ok: false;
      code:
        | 'NO_LOCATIONS'
        | 'GAP_IN_OFFSETS'
        | 'DUPLICATE_IDS'
        | 'COUNT_MISMATCH'
        | 'INCOMPLETE_LAST_PAGE';
      message: string;
      missing?: number;
    };

function normalizeEdge(edge: RawLocationEdge, warnings: string[]): LocalEvent | null {
  const node = edge?.node;
  if (!node || !node.properties) return null;
  const p = node.properties;

  // Coordenadas GeoJSON [lng, lat] → lat, lng (D6)
  let lat = 0;
  let lng = 0;
  const coords = node.geometry?.coordinates;
  if (Array.isArray(coords) && coords.length === 2 && coords.every((n) => typeof n === 'number')) {
    lng = coords[0];
    lat = coords[1];
  } else {
    warnings.push(`Locación "${p.title}" sin coordenadas válidas; se ubica en (0,0).`);
  }

  const isUniversal = p.country === UNIVERSAL_COUNTRY; // D8

  // Consistencia de booleanos contra eventType (D11): advertencia, no bloqueo
  if (p.eventType === 'In-Person' && (p.isVirtual || p.isHybrid)) {
    warnings.push(`"${p.title}" declara eventType In-Person pero flags isVirtual/isHybrid en true (D11).`);
  } else if (p.eventType === 'Virtual' && p.isHybrid) {
    warnings.push(`"${p.title}" declara eventType Virtual pero isHybrid en true (D11).`);
  } else if (p.eventType === 'Virtual & In-Person' && (!p.isVirtual || !p.isHybrid)) {
    warnings.push(`"${p.title}" declara eventType híbrido pero flags isVirtual/isHybrid lo contradicen (D11).`);
  }

  const eventType: EventType = EVENT_TYPES.includes(p.eventType) ? p.eventType : 'Virtual';

  const iso2 = getIso2(p.country);

  return {
    externalId: String(p.id),
    title: p.title ?? p.displayName ?? 'Sin nombre',
    country: p.country ?? 'Desconocido',
    iso2,
    lat,
    lng,
    registrations: Number.isFinite(p.cachedRegistrations) ? p.cachedRegistrations : 0,
    eventType,
    registrationOpen: Boolean(p.isRegistrationOpen),
    isWaitlist: Boolean(p.isWaitlist),
    isUniversal,
    url: p.meta?.htmlUrl ?? '',
  };
}

export function buildSnapshot(files: ParsedFile[], capturedAt: string): BuildResult {
  const warnings: string[] = [];
  for (const f of files) warnings.push(...f.warnings);

  // Cifras globales: opcionales por snapshot (D2)
  let global: GlobalStats | null = null;
  const eventFiles = files.filter((f) => f.hasEventBlock);
  if (eventFiles.length > 1) {
    warnings.push('Más de un archivo aporta el bloque event; se usa el primero (D2).');
  }
  if (eventFiles.length > 0 && eventFiles[0].event) {
    global = eventFiles[0].event;
  }

  const allEdges = files.flatMap((f) => f.edges);
  if (allEdges.length === 0) {
    return { ok: false, code: 'NO_LOCATIONS', message: 'Ningún archivo trae locaciones (openLocations).' };
  }

  const totalCount = files.reduce<number | null>(
    (acc, f) => (f.totalCount !== null ? Math.max(acc ?? 0, f.totalCount) : acc),
    null
  );
  const lastPage = [...files]
    .filter((f) => f.edges.length > 0 && f.hasNextPage !== null)
    .sort((a, b) => (b.offsetEnd ?? 0) - (a.offsetEnd ?? 0))[0];

  // Orden por offset del cursor; si algún decode falla, se conserva el orden
  // de subida y se advierte (D3: la validación cae a totalCount, D4).
  const withOffset = allEdges.map((e) => ({ e, offset: decodeCursorOffset(e.cursor) }));
  const allDecoded = withOffset.every((x) => x.offset !== null);
  if (!allDecoded) {
    warnings.push('No se pudo decodificar el cursor de alguna página (formato inesperado); se usa el orden de subida (D3).');
  } else {
    withOffset.sort((a, b) => (a.offset as number) - (b.offset as number));
  }

  // Contigüidad 0..N-1 (D3)
  if (allDecoded) {
    const offsets = withOffset.map((x) => x.offset as number);
    for (let i = 0; i < offsets.length; i++) {
      if (offsets[i] !== i) {
        return {
          ok: false,
          code: 'GAP_IN_OFFSETS',
          message: `Las páginas no son contiguas: se esperaba offset ${i} y se encontró ${offsets[i]}. Faltan páginas de la plataforma.`,
        };
      }
    }
  }

  // Duplicados e identidad (D4, D5)
  const seen = new Set<string>();
  const unique: LocalEvent[] = [];
  let duplicates = 0;
  for (const { e } of withOffset) {
    const ev = normalizeEdge(e, warnings);
    if (!ev) continue;
    if (seen.has(ev.externalId)) {
      duplicates++;
      continue;
    }
    seen.add(ev.externalId);
    unique.push(ev);
  }
  if (duplicates > 0) {
    return {
      ok: false,
      code: 'DUPLICATE_IDS',
      message: `Hay ${duplicates} locaciones duplicadas entre los archivos.`,
    };
  }

  // Completitud: ids únicos === totalCount (D4)
  if (totalCount !== null && unique.length !== totalCount) {
    return {
      ok: false,
      code: 'COUNT_MISMATCH',
      message: `La captura está incompleta: ${unique.length} locaciones únicas de ${totalCount} declaradas.`,
      missing: totalCount - unique.length,
    };
  }

  // Última página debe cerrar la colección (D4)
  if (lastPage && lastPage.hasNextPage === true) {
    return {
      ok: false,
      code: 'INCOMPLETE_LAST_PAGE',
      message: 'La última página declara hasNextPage: true; falta al menos una página.',
    };
  }

  // Universal Event (D8)
  const universals = unique.filter((e) => e.isUniversal);
  if (universals.length > 1) {
    warnings.push(`Hay ${universals.length} locaciones con país "${UNIVERSAL_COUNTRY}"; se esperaba una sola (D8).`);
  }

  // Países sin mapeo (D9): advertencia agregada, no bloquea.
  // El Universal Event se excluye: su país "Anywhere in the World" nunca tiene
  // mapeo y eso es esperado (D8).
  const unmapped = [
    ...new Set(unique.filter((e) => e.iso2 === null && !e.isUniversal).map((e) => e.country)),
  ];
  if (unmapped.length > 0) {
    warnings.push(`Países sin mapeo ISO (no rompe, quedan sin bandera): ${unmapped.join(', ')}.`);
  }

  const declaredTotal = totalCount ?? unique.length;

  return {
    ok: true,
    snapshot: {
      capturedAt,
      events: unique,
      global,
      declaredTotal,
      warnings,
    },
  };
}
