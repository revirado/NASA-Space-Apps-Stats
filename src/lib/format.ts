// FILE: src/lib/format.ts
// Formateo de números y fechas según idioma (en-US / es-AR). Las fechas de
// captura son UTC (D15/D16) y se muestran con sufijo UTC.

export function localeFor(lang: string): string {
  return lang === 'es' ? 'es-AR' : 'en-US';
}

export function formatNumber(n: number, lang: string): string {
  return new Intl.NumberFormat(localeFor(lang)).format(n);
}

export function formatDecimal(n: number, lang: string, digits = 1): string {
  return new Intl.NumberFormat(localeFor(lang), {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n);
}

/** Fecha de captura (ISO UTC) → 'Nov 2, 2026, 2:00 PM UTC'. */
export function formatCapturedAt(iso: string, lang: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const formatted = new Intl.DateTimeFormat(localeFor(lang), {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(date);
  return `${formatted} UTC`;
}
