// FILE: src/config/theme.ts
// Paleta centralizada del proyecto (D18). ÚNICA fuente de color de toda la app:
// la UI (via variables CSS inyectadas en layout.tsx), el globo y los gráficos.
// Cambiar un color = editar este archivo, nada más.

export const palette = {
  // ---- Base (tema espacial oscuro, neutros + naranja/dorado NASA) ----
  pageBg: '#0a0c11',
  surface: '#12151d',
  surfaceRaised: '#181c26',
  surfaceHover: '#1f2432',
  surfaceSunken: '#070910',
  border: '#272d3d',
  borderStrong: '#3a4256',

  // ---- Texto ----
  textPrimary: '#f4f5f7',
  textSecondary: '#a7adbc',
  textMuted: '#6f7788',

  // ---- Acentos ----
  accent: '#fc3d21', // naranja-rojo NASA
  accentGold: '#ffb400',
  accentSoft: 'rgba(252, 61, 33, 0.15)',
  accentGoldSoft: 'rgba(255, 180, 0, 0.14)',

  // ---- Estados ----
  success: '#34d399',
  warning: '#fbbf24',
  danger: '#f87171',

  // ---- Colores por tipo de locación (D11: categorías propias, no se reparten) ----
  typeInPerson: '#fbbf24',
  typeVirtual: '#34d399',
  typeHybrid: '#f97316',

  // ---- Marcadores del globo (escala por inscritos, de menor a mayor) ----
  markerScale: ['#ffe08a', '#ffb400', '#ff7f2a', '#fc3d21'],
  markerHighlight: '#ffffff',

  // ---- Globo ----
  globeOcean: '#0d1017',
  globeLand: '#1c2230',
  globeLandStroke: '#323a4e',
  globeAtmosphere: 'rgba(252, 61, 33, 0.28)',

  // ---- Gráficos (futuro: evolución) ----
  chartLine: '#ffb400',
  chartGrid: '#272d3d',
} as const;

/** Overrides de las variables CSS de shadcn/ui para que TODA la librería
 *  consuma esta paleta. Inyectado en layout.tsx mediante buildThemeCss(). */
export const shadcnVarOverrides: Record<string, string> = {
  '--background': palette.pageBg,
  '--foreground': palette.textPrimary,
  '--card': palette.surfaceRaised,
  '--card-foreground': palette.textPrimary,
  '--popover': palette.surfaceRaised,
  '--popover-foreground': palette.textPrimary,
  '--primary': palette.accent,
  '--primary-foreground': '#ffffff',
  '--secondary': palette.surfaceHover,
  '--secondary-foreground': palette.textPrimary,
  '--muted': palette.surfaceHover,
  '--muted-foreground': palette.textSecondary,
  '--accent': palette.surfaceHover,
  '--accent-foreground': palette.textPrimary,
  '--destructive': palette.danger,
  '--border': palette.border,
  '--input': palette.border,
  '--ring': palette.accentGold,
};

/** Variables CSS propias del proyecto (prefijo --pl-), consumibles con
 *  utilidades arbitrarias de Tailwind: bg-[var(--pl-surface)], etc. */
export const projectVars: Record<string, string> = {
  '--pl-page-bg': palette.pageBg,
  '--pl-surface': palette.surface,
  '--pl-surface-raised': palette.surfaceRaised,
  '--pl-surface-hover': palette.surfaceHover,
  '--pl-surface-sunken': palette.surfaceSunken,
  '--pl-border': palette.border,
  '--pl-border-strong': palette.borderStrong,
  '--pl-text-primary': palette.textPrimary,
  '--pl-text-secondary': palette.textSecondary,
  '--pl-text-muted': palette.textMuted,
  '--pl-accent': palette.accent,
  '--pl-accent-gold': palette.accentGold,
  '--pl-accent-soft': palette.accentSoft,
  '--pl-accent-gold-soft': palette.accentGoldSoft,
  '--pl-success': palette.success,
  '--pl-warning': palette.warning,
  '--pl-danger': palette.danger,
  '--pl-type-in-person': palette.typeInPerson,
  '--pl-type-virtual': palette.typeVirtual,
  '--pl-type-hybrid': palette.typeHybrid,
  '--pl-chart-line': palette.chartLine,
  '--pl-chart-grid': palette.chartGrid,
};

/** Genera el bloque <style> inyectado una sola vez en layout.tsx. */
export function buildThemeCss(): string {
  const lines = Object.entries(shadcnVarOverrides)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join('\n');
  const plLines = Object.entries(projectVars)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join('\n');
  return `:root {\n${lines}\n${plLines}\n}`;
}
