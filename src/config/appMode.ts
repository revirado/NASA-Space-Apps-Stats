// FILE: src/config/appMode.ts
// Único módulo que lee y valida las variables de entorno (sección 15 del brief).
// El resto del código consulta canUseDashboard() / canUseTerminal() /
// getDataSource(), nunca process.env directamente.
//
// En desarrollo local, si las variables faltan, se asume 'all' + 'fixtures'
// para que el preview funcione sin configuración. En producción, faltar
// APP_MODE o DATA_SOURCE produce estado 'unconfigured' (sección 13).

export type AppMode = 'dashboard' | 'terminal' | 'all';
export type DataSource = 'fixtures' | 'db';

const VALID_MODES: readonly AppMode[] = ['dashboard', 'terminal', 'all'];
const VALID_SOURCES: readonly DataSource[] = ['fixtures', 'db'];

const isProduction = process.env.NODE_ENV === 'production';

/** APP_MODE válido o null si falta/ es inválido ('all' es inválido en producción). */
export function getAppMode(): AppMode | null {
  const raw = process.env.APP_MODE;
  if (!raw || raw.trim() === '') {
    return isProduction ? null : 'all';
  }
  const value = raw.trim() as AppMode;
  if (!VALID_MODES.includes(value)) return null;
  if (isProduction && value === 'all') return null; // 'all' solo desarrollo
  return value;
}

/** DATA_SOURCE válido o null si falta / es inválido. */
export function getDataSource(): DataSource | null {
  const raw = process.env.DATA_SOURCE;
  if (!raw || raw.trim() === '') {
    return isProduction ? null : 'fixtures';
  }
  const value = raw.trim() as DataSource;
  return VALID_SOURCES.includes(value) ? value : null;
}

/** El dashboard está habilitado en los tres modos válidos (sección 15). */
export function canUseDashboard(): boolean {
  return getAppMode() !== null;
}

/** La terminal y las APIs de escritura solo en 'terminal' y 'all' (desarrollo). */
export function canUseTerminal(): boolean {
  const mode = getAppMode();
  return mode === 'terminal' || mode === 'all';
}

export const isProductionEnv = isProduction;
