// FILE: src/lib/timezone.ts
// Conversión «hora de pared + zona horaria» → instante UTC (D15): la fecha y
// hora de captura las indica el autor y NUNCA se toman del reloj. La interfaz
// pide la zona horaria aparte (por defecto la del navegador) porque un
// datetime-local no trae offset. Dos pasadas para cubrir bordes de DST.

/** Convierte 'YYYY-MM-DDTHH:mm' (valor de datetime-local) + tz en ISO UTC. */
export function zonedWallTimeToUtcIso(wall: string, tz: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(wall);
  if (!m) return null;
  const asUtc = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
  if (!Number.isFinite(asUtc)) return null;
  const offset = tzOffsetMs(asUtc, tz);
  if (offset === null) return null;
  return new Date(asUtc - offset).toISOString();
}

/** Offset en ms de tz para el instante dado (dos pasadas: DST). */
function tzOffsetMs(asUtcMs: number, tz: string): number | null {
  try {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const wallAsUtc = (instant: number): number => {
      const o: Record<string, number> = {};
      for (const p of dtf.formatToParts(new Date(instant))) {
        if (p.type !== 'literal') o[p.type] = Number(p.value);
      }
      if (o.hour === 24) o.hour = 0; // Algunos motores emiten 24:00 a medianoche
      return Date.UTC(o.year ?? 1970, (o.month ?? 1) - 1, o.day ?? 1, o.hour ?? 0, o.minute ?? 0, o.second ?? 0);
    };
    const guess = asUtcMs - wallAsUtc(asUtcMs);
    return asUtcMs - wallAsUtc(asUtcMs + guess);
  } catch {
    return null; // tz desconocida
  }
}

export function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/** Lista curada de zonas comunes; la del navegador va primera si existe. */
export const FALLBACK_TIMEZONES: readonly string[] = [
  'UTC',
  'America/Argentina/Buenos_Aires',
  'America/Santiago',
  'America/Montevideo',
  'America/Sao_Paulo',
  'America/Bogota',
  'America/Lima',
  'America/Mexico_City',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
  'America/Caracas',
  'America/Toronto',
  'America/Asuncion',
  'America/La_Paz',
  'America/Guayaquil',
  'America/Havana',
  'Europe/London',
  'Europe/Lisbon',
  'Europe/Madrid',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Rome',
  'Europe/Athens',
  'Europe/Moscow',
  'Europe/Istanbul',
  'Africa/Casablanca',
  'Africa/Cairo',
  'Africa/Lagos',
  'Africa/Nairobi',
  'Africa/Johannesburg',
  'Asia/Dubai',
  'Asia/Tehran',
  'Asia/Karachi',
  'Asia/Kolkata',
  'Asia/Dhaka',
  'Asia/Bangkok',
  'Asia/Jakarta',
  'Asia/Shanghai',
  'Asia/Hong_Kong',
  'Asia/Singapore',
  'Asia/Manila',
  'Asia/Taipei',
  'Asia/Seoul',
  'Asia/Tokyo',
  'Australia/Perth',
  'Australia/Sydney',
  'Pacific/Auckland',
  'Pacific/Honolulu',
];

export function listTimezones(): string[] {
  const browser = browserTimezone();
  const set = new Set<string>([browser]);
  for (const tz of FALLBACK_TIMEZONES) set.add(tz);
  return [...set].sort((a, b) => (a === browser ? -1 : b === browser ? 1 : a.localeCompare(b)));
}

/** Snapshot de cliente con referencia estable (para useSyncExternalStore):
 *  la lista se calcula una sola vez por sesión del navegador. */
let cachedClientList: string[] | null = null;
export function clientTimezones(): string[] {
  if (!cachedClientList) cachedClientList = listTimezones();
  return cachedClientList;
}
