// FILE: scripts/generate-fixtures.ts
// Genera fixtures sintéticos (fixtures/a.json, b.json, manifest.json) con la
// MISMA estructura de la plataforma y los valores de referencia de la sección 8
// del brief técnico. Sirven para desarrollar y demostrar sin los JSON reales;
// cuando existan los crudos reales, se reemplazan sin tocar código.
//
//   bun run fixtures:generate
//
// Garantías (comprobadas al final del script y por verify-fixtures.ts):
//   600 únicas · 599 sin Universal · 115 países + Anywhere in the World
//   suma 104.784 (89.956 sin Universal) · tipos: 235/119/246 locaciones y
//   27.979 / 27.714 / 49.091 inscritos · 4 con 0 · top-9 y Salta exactos.

import * as fs from 'fs';
import * as path from 'path';
import { TOP_COUNTRIES, OTHER_COUNTRIES } from './countries-data.mjs';

// ---------------------------------------------------------------------------
// Determinismo
// ---------------------------------------------------------------------------

const SEED = 20261104;
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(SEED);

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const b64 = (s: string): string => Buffer.from(s, 'utf-8').toString('base64');

type EventType = 'In-Person' | 'Virtual' | 'Virtual & In-Person';

interface CountryDef {
  n: string;
  c: [number, number];
  s: number;
  w: number;
  zero?: boolean;
  cities: string[];
  f: { t: string; r: number | null; y: EventType; co?: [number, number] }[];
}

interface Loc {
  country: string;
  title: string;
  regs: number | null; // null → viene del bucket aleatorio de su tipo
  type: EventType | null; // null → tag aleatorio
  lat: number;
  lng: number;
  isUniversal: boolean;
  waitlist: boolean;
}

function jitter(c: [number, number], spread: number): [number, number] {
  const lat = c[0] + (rng() * 2 - 1) * spread;
  const lng = c[1] + (rng() * 2 - 1) * spread;
  return [Math.round(lat * 7) / 7, Math.round(lng * 7) / 7];
}

function slugify(title: string): string {
  return title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

/** Reparte `total` entre los pesos con mínimo `min`; devuelve enteros exactos. */
function distributeCounts(weights: number[], total: number, min = 1): number[] {
  const n = weights.length;
  const sum = weights.reduce((a, b) => a + b, 0);
  const counts = weights.map((w) => Math.max(min, Math.round((total * w) / sum)));
  let diff = total - counts.reduce((a, b) => a + b, 0);
  const order = [...counts.keys()].sort((a, b) => weights[b] - weights[a] || a - b);
  let i = 0;
  while (diff !== 0 && i < 100000) {
    const idx = order[i % order.length];
    if (diff > 0) { counts[idx]++; diff--; }
    else if (counts[idx] > min) { counts[idx]--; diff++; }
    i++;
  }
  if (diff !== 0) throw new Error('No se pudo repartir el conteo de países');
  return counts;
}

/** Escala `weights` para que sumen `target`, con techo `max` y mínimo 1. */
function distributeValues(weights: number[], target: number, max: number): number[] {
  const n = weights.length;
  if (n === 0) return [];
  const sum = weights.reduce((a, b) => a + b, 0);
  const vals = weights.map((w) => Math.max(1, Math.floor((target * w) / sum)));
  let diff = target - vals.reduce((a, b) => a + b, 0);
  const order = [...vals.keys()].sort((a, b) => weights[b] - weights[a] || a - b);
  let i = 0;
  while (diff !== 0 && i < 500000) {
    const idx = order[i % order.length];
    if (diff > 0 && vals[idx] < max) { vals[idx]++; diff--; }
    else if (diff < 0 && vals[idx] > 1) { vals[idx]--; diff++; }
    i++;
  }
  if (diff !== 0) throw new Error('No se pudo repartir el valor objetivo');
  return vals;
}

// ---------------------------------------------------------------------------
// Construcción de las 600 locaciones
// ---------------------------------------------------------------------------

const allCountries: CountryDef[] = [...TOP_COUNTRIES, ...OTHER_COUNTRIES];

// 1) Conteos: top-10 fijos; resto 299 repartido por peso (105 países, min 1)
const otherCounts = distributeCounts(
  OTHER_COUNTRIES.map((c) => c.w),
  299,
  1
);

const locations: Loc[] = [];

// 2) Universal Event (D8): Virtual, "Anywhere in the World", 14.828
locations.push({
  country: 'Anywhere in the World',
  title: 'Universal Event',
  regs: 14828,
  type: 'Virtual',
  lat: 0,
  lng: 0,
  isUniversal: true,
  waitlist: false,
});

// 3) Cada país: fijas primero, resto del pool (con variantes si hace falta)
function buildCountry(def: CountryDef, count: number): void {
  const usedTitles = new Set<string>();
  const fixed = def.f;

  if (def.zero && count !== 1) throw new Error(`${def.n} debería tener exactamente 1 locación`);

  const make = (title: string, regs: number | null, type: EventType | null, coords?: [number, number]): Loc => {
    usedTitles.add(title);
    const [lat, lng] = coords ?? jitter(def.c, def.s);
    return {
      country: def.n,
      title,
      regs,
      type,
      lat,
      lng,
      isUniversal: false,
      waitlist: false,
    };
  };

  // Fijas (top-9, Salta, Şanlıurfa)
  for (const f of fixed) {
    locations.push(make(f.t, f.r, f.y, f.co));
  }
  // Única locación en cero (Yemen, Libya, Botswana, Namibia)
  if (def.zero) {
    locations.push(make(def.cities[0], 0, 'In-Person'));
    return;
  }
  // Resto con pool + variantes deterministas si el pool no alcanza
  const remaining = count - fixed.length;
  const pool = def.cities.filter((c) => !usedTitles.has(c));
  for (let k = 0; k < remaining; k++) {
    let title: string;
    if (k < pool.length) {
      title = pool[k];
    } else {
      const base = pool[k % pool.length];
      const cycle = Math.floor(k / pool.length);
      title = cycle === 1 ? `${base} Metro` : cycle === 2 ? `${base} Region` : `${base} ${cycle + 1}`;
    }
    if (usedTitles.has(title)) title = `${title} II`;
    locations.push(make(title, null, null));
  }
}

TOP_COUNTRIES.forEach((def) => buildCountry(def, def.w));
OTHER_COUNTRIES.forEach((def, i) => buildCountry(def, otherCounts[i]));

// 4) Asignación de tipo + inscritos a las locaciones libres
//    Buckets: IP 222 valores = 13.367 (incluye Şanlıurfa) · VI 118 = 12.886 ·
//    HY 245 = 48.979. Techo 900 para no superar al top-9 (mínimo 947).
const ipVals = distributeValues(
  Array.from({ length: 222 }, () => Math.exp(2 + rng() * 3.2)),
  13367,
  900
);
const viVals = distributeValues(
  Array.from({ length: 118 }, () => Math.exp(2 + rng() * 3.4)),
  12886,
  900
);
const hyVals = distributeValues(
  Array.from({ length: 245 }, () => Math.exp(2 + rng() * 3.3)),
  48979,
  900
);

const bucket: Record<EventType, number[]> = {
  'In-Person': ipVals,
  'Virtual': viVals,
  'Virtual & In-Person': hyVals,
};

// Şanlıurfa (tipo fijo, regs nula) toma el primer valor del bucket IP
const sanliurfa = locations.find((l) => l.title === 'Şanlıurfa');
if (!sanliurfa) throw new Error('Şanlıurfa no fue generada');
sanliurfa.regs = bucket['In-Person'].shift() ?? null;

// Tags para las libres: IP 221 · HY 245 · VI 118 = 584
const free = locations.filter((l) => !l.isUniversal && l.type === null && l.regs === null);
if (free.length !== 584) throw new Error(`Locaciones libres = ${free.length}, se esperaban 584`);
const tags: EventType[] = [
  ...Array<EventType>(221).fill('In-Person'),
  ...Array<EventType>(245).fill('Virtual & In-Person'),
  ...Array<EventType>(118).fill('Virtual'),
];
const shuffledTags = shuffle(tags);
free.forEach((loc, i) => {
  loc.type = shuffledTags[i];
  loc.regs = bucket[loc.type].shift() ?? null;
  if (loc.regs === null) throw new Error('Bucket agotado');
});

// 5) Lista de espera (~28 locaciones libres): abierta=false
const waitlistTargets = shuffle(free).slice(0, 28);
for (const loc of waitlistTargets) loc.waitlist = true;

// ---------------------------------------------------------------------------
// Verificaciones internas del generador (sección 8)
// ---------------------------------------------------------------------------

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`FALLA INTERNA: ${msg}`);
}

const total = locations.length;
const sumAll = locations.reduce((a, l) => a + (l.regs ?? 0), 0);
const sumNoUni = locations.filter((l) => !l.isUniversal).reduce((a, l) => a + (l.regs ?? 0), 0);
const byType = (t: EventType) => {
  const rows = locations.filter((l) => l.type === t);
  return { loc: rows.length, regs: rows.reduce((a, l) => a + (l.regs ?? 0), 0) };
};

assert(total === 600, `total ${total} ≠ 600`);
assert(sumAll === 104784, `suma ${sumAll} ≠ 104.784`);
assert(sumNoUni === 89956, `suma sin Universal ${sumNoUni} ≠ 89.956`);
assert(byType('In-Person').loc === 235 && byType('In-Person').regs === 27979, 'In-Person 235/27.979');
assert(byType('Virtual').loc === 119 && byType('Virtual').regs === 27714, 'Virtual 119/27.714');
assert(byType('Virtual & In-Person').loc === 246 && byType('Virtual & In-Person').regs === 49091, 'Híbridas 246/49.091');
assert(locations.filter((l) => l.regs === 0).length === 4, 'deben existir 4 locaciones en 0');
assert(new Set(locations.map((l) => l.country)).size === 116, '116 valores de país distintos');
assert(new Set(locations.filter((l) => !l.isUniversal).map((l) => l.country)).size === 115, '115 países sin Universal');

const expectedTop: [string, number][] = [
  ['Cairo', 3474], ['Harohalli', 2364], ['Dhaka', 2022], ['Ankara', 1343],
  ['Chennai', 1255], ['Delhi', 1240], ['Shebeen El-Kom', 988], ['Karachi', 979], ['Tashkent', 947],
];
const top = locations
  .filter((l) => !l.isUniversal)
  .sort((a, b) => (b.regs ?? 0) - (a.regs ?? 0))
  .slice(0, 9)
  .map((l) => [l.title, l.regs] as [string, number]);
for (let i = 0; i < 9; i++) {
  assert(top[i][0] === expectedTop[i][0] && top[i][1] === expectedTop[i][1],
    `top#${i + 1} ${top[i][0]}=${top[i][1]} ≠ ${expectedTop[i][0]}=${expectedTop[i][1]}`);
}

// ---------------------------------------------------------------------------
// Serialización al formato crudo de la plataforma
// ---------------------------------------------------------------------------

const sorted = [...locations].sort(
  (a, b) => a.country.localeCompare(b.country) || a.title.localeCompare(b.title)
);

function booleans(type: EventType): { isVirtual: boolean; isHybrid: boolean } {
  if (type === 'In-Person') return { isVirtual: false, isHybrid: false };
  if (type === 'Virtual') return { isVirtual: true, isHybrid: false };
  return { isVirtual: true, isHybrid: true };
}

function toEdge(loc: Loc, offset: number) {
  const flags = booleans(loc.type as EventType);
  return {
    cursor: b64(`offset:${offset}`),
    node: {
      geometry: { coordinates: [loc.lng, loc.lat] }, // GeoJSON: [lng, lat] (D6)
      properties: {
        id: b64(`id:${54551 + offset}`),
        title: loc.title,
        displayName: loc.title,
        country: loc.country,
        cachedRegistrations: loc.regs ?? 0,
        eventType: loc.type,
        registrationEnabled: true,
        isRegistrationOpen: !loc.waitlist,
        isHostEvent: false,
        isHybrid: flags.isHybrid,
        isVirtual: flags.isVirtual,
        isWaitlist: loc.waitlist,
        meta: { htmlUrl: `https://www.spaceappschallenge.org/nasa-space-apps-2026/2026/locations/${slugify(loc.title)}` },
      },
    },
  };
}

const edges = sorted.map(toEdge);
const pageA = edges.slice(0, 500);
const pageB = edges.slice(500);

const contentFilterForm = {
  search: '',
  sort: null,
  filters: { country: [], eventType: [], registrationStatus: [] },
};

const eventBlock = {
  cachedEventRegistrations: 124934,
  cachedLocalEvents: 680,
  cachedTeams: 17794,
  cachedLocalEventRegistrations: null,
  startDate: '2026-11-13T19:00:00',
  endDate: '2026-11-15T23:59:00',
};

const fileA = [
  { data: { contentFilterForm } }, // bloque ignorado por el parser (D1)
  { data: { event: eventBlock } },
  {
    data: {
      openLocations: {
        totalCount: 600,
        edges: pageA,
        pageInfo: { endCursor: pageA[pageA.length - 1].cursor, hasNextPage: true },
      },
    },
  },
];

const fileB = [
  {
    data: {
      openLocations: {
        totalCount: 600,
        edges: pageB,
        pageInfo: { endCursor: pageB[pageB.length - 1].cursor, hasNextPage: false },
      },
    },
  },
];

const manifest = [
  {
    capturedAt: '2026-11-02T14:00:00Z',
    files: ['a.json', 'b.json'],
    note: 'Primera captura (fixtures sintéticos con los valores de referencia de la sección 8)',
  },
];

// ---------------------------------------------------------------------------
// Escritura
// ---------------------------------------------------------------------------

const fixturesDir = path.join(process.cwd(), 'fixtures');
fs.mkdirSync(fixturesDir, { recursive: true });
fs.writeFileSync(path.join(fixturesDir, 'a.json'), JSON.stringify(fileA, null, 1), 'utf-8');
fs.writeFileSync(path.join(fixturesDir, 'b.json'), JSON.stringify(fileB, null, 1), 'utf-8');
fs.writeFileSync(path.join(fixturesDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8');

console.log('✔ fixtures generados en ./fixtures');
console.log(`  a.json: ${pageA.length} edges (offsets 0–499, hasNextPage: true) + event + contentFilterForm`);
console.log(`  b.json: ${pageB.length} edges (offsets 500–599, hasNextPage: false)`);
console.log(`  manifest: 1 captura ${manifest[0].capturedAt}`);
console.log('✔ valores internos verificados: 600 · 104.784 · 235/119/246 · 4 en cero · top-9 exacto');
