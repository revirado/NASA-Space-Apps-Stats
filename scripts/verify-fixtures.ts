// FILE: scripts/verify-fixtures.ts
// Verificación de aceptación de la Fase 1 (sección 8 y 12 del brief técnico).
// Parsea fixtures/a.json + b.json con el MISMO módulo domain que usa la app y
// comprueba los valores de referencia exactos + las reglas de búsqueda (D17).
//
//   bun run fixtures:verify
//
// Salida: tabla PASS/FAIL. Exit code 1 si algo falla. Criterio de regresión
// para cualquier refactorización (sección 8).

import * as fs from 'fs';
import * as path from 'path';
import { classifyFile, buildSnapshot } from '../src/domain/parser';
import { computeStats } from '../src/domain/stats';
import { normalizeKey } from '../src/domain/normalizeKey';
import type { Snapshot } from '../src/domain/types';

const results: { name: string; pass: boolean; detail: string }[] = [];

function check(name: string, actual: unknown, expected: unknown): void {
  const pass = actual === expected;
  results.push({ name, pass, detail: pass ? `${actual}` : `esperado ${expected}, obtenido ${actual}` });
}

function checkTrue(name: string, cond: boolean, detail = ''): void {
  results.push({ name, pass: cond, detail });
}

// ---------------------------------------------------------------------------
// Carga con el pipeline real de la app
// ---------------------------------------------------------------------------

const fixturesDir = path.join(process.cwd(), 'fixtures');
const fileA = JSON.parse(fs.readFileSync(path.join(fixturesDir, 'a.json'), 'utf-8'));
const fileB = JSON.parse(fs.readFileSync(path.join(fixturesDir, 'b.json'), 'utf-8'));

const a = classifyFile('a.json', fileA);
const b = classifyFile('b.json', fileB);
checkTrue('D1/D2 · a.json clasifica', a.ok);
checkTrue('D1/D2 · b.json clasifica', b.ok);
if (!a.ok || !b.ok) {
  printAndExit();
}

checkTrue('D2 · a.json aporta el bloque event', a.file.hasEventBlock === true);
checkTrue('D2 · b.json NO aporta event', b.file.hasEventBlock === false);
checkTrue('D1 · a.json ignora contentFilterForm', a.file.ignoredContentFilterBlocks === 1);

const built = buildSnapshot([a.file, b.file], '2026-11-02T14:00:00Z');
checkTrue('Parser · snapshot construido', built.ok);
if (!built.ok) {
  results.push({ name: 'Parser · error', pass: false, detail: built.message });
  printAndExit();
}
const snapshot: Snapshot = built.snapshot;

// D3: cursores
checkTrue('D3 · a.json endCursor decodifica a offset 499', a.file.offsetEnd === 499);
checkTrue('D3 · b.json endCursor decodifica a offset 599', b.file.offsetEnd === 599);
checkTrue('D3 · a.json hasNextPage true', a.file.hasNextPage === true);
checkTrue('D3 · b.json hasNextPage false', b.file.hasNextPage === false);

// D4: completitud
check('D4 · locaciones únicas', snapshot.events.length, 600);
check('D4 · declaredTotal', snapshot.declaredTotal, 600);
checkTrue('D4 · sin advertencias de validación', snapshot.warnings.length === 0,
  snapshot.warnings.join(' | ') || 'limpio');

const stats = computeStats(snapshot);

// Sección 8: valores de referencia exactos
check('8 · locaciones sin Universal', snapshot.events.filter((e) => !e.isUniversal).length, 599);
check('8 · países distintos (sin Universal)', stats.countriesCount, 115);
check('8 · suma de inscritos', stats.sumRegistrations, 104784);
check('8 · suma sin Universal', stats.sumRegistrationsWithoutUniversal, 89956);

const typeRow = (t: string) => stats.byType.find((r) => r.type === t);
check('8 · In-Person locaciones', typeRow('In-Person')?.locations, 235);
check('8 · In-Person inscritos', typeRow('In-Person')?.registrations, 27979);
check('8 · Virtual locaciones', typeRow('Virtual')?.locations, 119);
check('8 · Virtual inscritos', typeRow('Virtual')?.registrations, 27714);
check('8 · Virtual sin Universal', typeRow('Virtual')!.registrations - stats.universal.registrations, 12886);
check('8 · Híbridas locaciones', typeRow('Virtual & In-Person')?.locations, 246);
check('8 · Híbridas inscritos', typeRow('Virtual & In-Person')?.registrations, 49091);
check('8 · locaciones con 0 inscritos', stats.zeroRegistrationsCount, 4);
check('8 · global cachedEventRegistrations', stats.globalRegistrations, 124934);
check('8 · global cachedLocalEvents', stats.declaredLocalEvents, 680);
check('8 · global cachedTeams', stats.teams, 17794);
check('8 · derivado sin local event', stats.derivedWithoutLocalEvent, 20150);

// Países del top
const byCountry = (c: string) => stats.byCountry.find((r) => r.country === c);
check('8 · India', byCountry('India')?.locations, 72);
check('8 · United States', byCountry('United States')?.locations, 55);
check('8 · Brazil', byCountry('Brazil')?.locations, 44);
check('8 · Turkey', byCountry('Turkey')?.locations, 28);
check('8 · Mexico', byCountry('Mexico')?.locations, 25);
check('8 · Egypt', byCountry('Egypt')?.locations, 16);
check('8 · Canada', byCountry('Canada')?.locations, 16);
check('8 · Argentina', byCountry('Argentina')?.locations, 16);
check('8 · Peru', byCountry('Peru')?.locations, 15);
check('8 · Colombia', byCountry('Colombia')?.locations, 13);

// Top de locaciones
const expectedTop = [
  ['Cairo', 3474], ['Harohalli', 2364], ['Dhaka', 2022], ['Ankara', 1343],
  ['Chennai', 1255], ['Delhi', 1240], ['Shebeen El-Kom', 988], ['Karachi', 979], ['Tashkent', 947],
] as const;
for (let i = 0; i < expectedTop.length; i++) {
  check(
    `8 · top#${i + 1} ${expectedTop[i][0]}`,
    `${stats.topLocations[i]?.title}=${stats.topLocations[i]?.registrations}`,
    `${expectedTop[i][0]}=${expectedTop[i][1]}`
  );
}

// Salta (D6)
const salta = snapshot.events.find((e) => e.title === 'Salta');
checkTrue('8 · Salta existe', Boolean(salta));
check('8 · Salta inscritos', salta?.registrations, 112);
check('8 · Salta tipo', salta?.eventType, 'Virtual & In-Person');
check('8 · Salta lat', salta?.lat, -24.7821269);
check('8 · Salta lng', salta?.lng, -65.4231976);

// D8: Universal Event excluido de rankings y con tarjeta propia
checkTrue('D8 · Universal excluido de byCountry', !stats.byCountry.some((r) => r.country === 'Anywhere in the World'));
check('D8 · Universal inscritos', stats.universal.registrations, 14828);

// D17: normalización y búsqueda
check("D17 · normalizeKey('Şanlıurfa')", normalizeKey('Şanlıurfa'), 'sanliurfa');
check("D17 · normalizeKey('St. John’s')", normalizeKey('St. John’s'), 'st johns');
check("D17 · normalizeKey('Côte d'Ivoire')", normalizeKey("Côte d'Ivoire"), 'cote divoire');
check("D17 · normalizeKey('Shebeen El-Kom')", normalizeKey('Shebeen El-Kom'), 'shebeen el kom');

const query = normalizeKey('sanliurfa');
const hit = snapshot.events.find((e) => normalizeKey(e.title).includes(query));
checkTrue('D17 · buscar "sanliurfa" encuentra Şanlıurfa', hit?.title === 'Şanlıurfa',
  hit ? hit.title : 'sin resultado');
const stJohns = snapshot.events.find((e) => normalizeKey(e.title) === 'st johns');
checkTrue("D17 · buscar \"st johns\" encuentra St. John’s", stJohns?.title === "St. John’s",
  stJohns ? stJohns.title : 'sin resultado');

// D9: nombres no-ISO mapeados
checkTrue('D9 · Turkey → TR', snapshot.events.find((e) => e.country === 'Turkey')?.iso2 === 'TR');
checkTrue('D9 · Côte d’Ivoire → CI', snapshot.events.find((e) => e.country === "Côte d'Ivoire")?.iso2 === 'CI');

// ---------------------------------------------------------------------------

function printAndExit(): never {
  for (const r of results) {
    console.log(`${r.pass ? 'PASS' : 'FAIL'} · ${r.name}${r.detail ? ` — ${r.detail}` : ''}`);
  }
  const failed = results.filter((r) => !r.pass).length;
  console.log(`\n${results.length - failed}/${results.length} comprobaciones OK`);
  process.exit(failed > 0 ? 1 : 0);
}

printAndExit();
