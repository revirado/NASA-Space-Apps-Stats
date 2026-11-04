// FILE: src/data/fixturesReader.ts
// SnapshotReader de la Fase 1 (DATA_SOURCE=fixtures): lee /fixtures/manifest.json
// y los JSON crudos de cada grupo, los parsea con el módulo domain y devuelve
// un DashboardPayload con estado (nunca lanza a la interfaz, sección 13).
// SOLO SERVIDOR (usa fs).

import fs from 'fs/promises';
import path from 'path';
import { getAppMode, getDataSource, type AppMode, type DataSource } from '@/config/appMode';
import { computeStats } from '@/domain/stats';
import { buildSnapshot, classifyFile, type ParsedFile } from '@/domain/parser';
import type { Snapshot } from '@/domain/types';
import type { DashboardPayload, DataState } from './dataState';

interface ManifestEntry {
  capturedAt: string;
  files: string[];
  note?: string;
}

const FIXTURES_DIR = path.join(process.cwd(), 'fixtures');

async function readJsonFile(filePath: string): Promise<unknown | null> {
  try {
    const text = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function loadGroup(entry: ManifestEntry): Promise<Snapshot | { error: string }> {
  const parsedFiles: ParsedFile[] = [];
  for (const fileName of entry.files) {
    const json = await readJsonFile(path.join(FIXTURES_DIR, fileName));
    if (json === null) return { error: `FILE_MISSING:${fileName}` };
    const result = classifyFile(fileName, json);
    if (!result.ok) return { error: `${result.code}: ${result.message}` };
    parsedFiles.push(result.file);
  }
  const built = buildSnapshot(parsedFiles, entry.capturedAt);
  if (!built.ok) return { error: `${built.code}: ${built.message}` };
  return built.snapshot;
}

/** Punto de entrada único del dashboard (Fase 1: fixtures). */
export async function getDashboardPayload(): Promise<DashboardPayload> {
  const mode: AppMode | null = getAppMode();
  const dataSource: DataSource | null = getDataSource();

  if (mode === null) {
    return { state: { status: 'unconfigured', missingVar: 'APP_MODE' }, snapshots: [], latestStats: null, mode, dataSource };
  }
  if (dataSource === null) {
    return { state: { status: 'unconfigured', missingVar: 'DATA_SOURCE' }, snapshots: [], latestStats: null, mode, dataSource };
  }

  if (dataSource === 'db') {
    const { getPayloadFromDb } = await import('./dbReader');
    return getPayloadFromDb(mode, dataSource);
  }

  // ---- DATA_SOURCE = fixtures (Fase 1) ----
  try {
    const manifest = await readJsonFile(path.join(FIXTURES_DIR, 'manifest.json'));
    if (!Array.isArray(manifest) || manifest.length === 0) {
      return { state: { status: 'empty' }, snapshots: [], latestStats: null, mode, dataSource };
    }

    const snapshots: Snapshot[] = [];
    for (const entry of manifest as ManifestEntry[]) {
      if (!entry || typeof entry.capturedAt !== 'string' || !Array.isArray(entry.files)) continue;
      const result = await loadGroup(entry);
      if ('error' in result) {
        // Archivo ausente o inválido → estado vacío, no un error (sección 13)
        console.error(`[fixturesReader] ${result.error}`);
        return { state: { status: 'empty' }, snapshots: [], latestStats: null, mode, dataSource };
      }
      snapshots.push(result);
    }

    if (snapshots.length === 0) {
      return { state: { status: 'empty' }, snapshots: [], latestStats: null, mode, dataSource };
    }

    snapshots.sort(
      (a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime()
    );
    const latest = snapshots[snapshots.length - 1];

    return {
      state: { status: 'ok', snapshots: snapshots.length, latestCapturedAt: latest.capturedAt },
      snapshots,
      latestStats: computeStats(latest),
      mode,
      dataSource,
    };
  } catch (err) {
    console.error('[fixturesReader] error inesperado:', err);
    return { state: { status: 'unavailable', reason: 'unknown' }, snapshots: [], latestStats: null, mode, dataSource };
  }
}
