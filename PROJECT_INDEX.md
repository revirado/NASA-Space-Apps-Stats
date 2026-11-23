# PROJECT_INDEX — Dashboard de Local Events (NASA Space Apps 2026)

> **LEER ESTE ARCHIVO PRIMERO EN CADA ITERACIÓN.** Es el índice estructural del
> proyecto: qué hace cada archivo, sus exports y las reglas de negocio. Con este
> índice NO hace falta releer todos los archivos: buscar acá el archivo a tocar,
> abrir solo ese, y actualizar la entrada correspondiente al terminar.
>
> **Protocolo de iteración:**
> 1. Leer este índice (y la sección del archivo a modificar).
> 2. Los detalles de negocio viven en los briefs (`upload/Brief técnico...md`, secciones D1–D20); acá hay un resumen de 1 línea por decisión.
> 3. Cada archivo fuente arranca con `// FILE: ruta — propósito`: si el índice no alcanza, basta grep del header, no lectura completa.
> 4. Al terminar una iteración: actualizar la entrada del índice + agregar una fila al **Registro de iteraciones** (final del archivo).
> 5. Regla de regresión: tras tocar `domain/` o los fixtures, correr `bun run fixtures:verify` (debe dar 63/63).
>
> Fuente de verdad de requisitos: `upload/Brief conceptual...md` y `upload/Brief técnico...md` (v6).

---

## 1. Qué es

Un solo proyecto Next.js 16 (App Router) con dos vistas: el **dashboard
público** (solo lectura) y la **terminal de carga** (privada, Fase 2).
Fases 1 y 2 completas: dashboard sobre JSON crudos o DB, y terminal de carga
con parseo en navegador, validación y escritura transaccional.

- Datos: los JSON crudos de la plataforma (`fixtures/`) son la fuente de verdad; la DB es descartable y reconstruible (sección 9 del brief).
- Rutas (sección 15): `/` redirige a `/dashboard`; `/terminal` 404 si el modo no la habilita. En dev sin variables: `APP_MODE=all` + `DATA_SOURCE=fixtures`.
- Stack: Next.js 16 + TypeScript 5 + Tailwind 4 + shadcn/ui + react-globe.gl (three.js) + Recharts + Prisma (SQLite aquí, Neon en producción).

## 2. Estado por fases

| Fase | Estado |
| --- | --- |
| 1 · Prueba de concepto sin DB (globo, buscador, rankings, tarjetas, estados, i18n, paleta) | **Completa y verificada** (63/63 + navegador) |
| 2 · Terminal de carga + DB (Neon en prod) | **Completa en sandbox/SQLite y verificada en navegador** (carga→guardar→leer, idempotencia, 404 por modo). Neon/Vercel queda para la Fase 3 |
| 3 · Despliegue en la nube | **Rediseñado 2026-11-21**: UN deploy estático (dashboard-only sobre fixtures reales, sin DB, sin terminal online) — receta en sección 9.1. Terminal online / dos dominios = TODO con recetas listas en 9.2 (no hay que re-analizar código). Falta validar el switcher ENG default en el deploy |
| 4 · Evolución con 2+ capturas, manifiesto masivo, exportación | `domain/evolution.ts` y UI listos; SIN DB ya funciona si el manifest tiene 2+ entradas por fecha (serie temporal en fixtures); la carga real por terminal requiere la receta 9.2 |
| Después · API oficial como fuente más | Pendiente |

## 3. Mapa de archivos

Leyenda: **S** = solo servidor · **C** = componente cliente · **P** = puro (sin I/O, testeable).

### Config (`src/config/`)

| Archivo | Rol | Clave |
| --- | --- | --- |
| `theme.ts` | Paleta centralizada (D18): ÚNICA fuente de color de la app | `palette`, `buildThemeCss()` (inyecta `--pl-*` y overrides shadcn en layout) |
| `appMode.ts` | Lee/valida `APP_MODE` y `DATA_SOURCE` (sección 15); nadie más toca `process.env` | `getAppMode()`, `getDataSource()`, `canUseDashboard()`, `canUseTerminal()` |

### Domain (`src/domain/`) — puro, sin I/O, isomórfico

| Archivo | Rol | Clave |
| --- | --- | --- |
| `types.ts` | Tipos crudos (formato plataforma) + modelo limpio | `RawBlock`, `LocalEvent`, `GlobalStats`, `Snapshot`, `UNIVERSAL_COUNTRY` |
| `parser.ts` | Clasifica archivos por contenido (D1–D2), decodifica cursores `offset:N` (D3), valida completitud (D4), normaliza coordenadas [lng,lat]→lat (D6), marca Universal (D8), iso2 (D9), advierte contradicciones de booleanos (D11) | `classifyFile()`, `buildSnapshot()`, `ParsedFile` |
| `normalizeKey.ts` | Regla de búsqueda (D17): minúsculas → NFD → ı→i/łøđßæœ → sin apóstrofes → puntuación a espacio | `normalizeKey()` |
| `countryMap.ts` | Tabla manual país→ISO2 (D9), incluye nombres no-ISO (Turkey, Burma, Côte d'Ivoire…) | `COUNTRY_ISO2`, `getIso2()`, `flagEmoji()` |
| `stats.ts` | Estadísticas del dashboard: totales, derivado (D13), por tipo (D11), por país con promedio+mediana | `computeStats()`, `aggregateByCountry()`, `median()` |
| `ranking.ts` | Rankings métrica × filtro × alcance (sección 7); Universal siempre fuera (D8) | `rankCountries()`, `rankLocationsInCountry()`, `filterLocations()`, `listCountries()` |
| `evolution.ts` | Cambios absolutos y por día entre capturas consecutivas; altas/bajas por external_id | `compareConsecutive()`, `diffLocations()` |

### Data (`src/data/`) — acceso a datos, nunca lanza a la interfaz

| Archivo | Rol | Clave |
| --- | --- | --- |
| `dataState.ts` | Los 5 estados de fallo (sección 13) + `DashboardPayload` | `DataState` (`ok/unconfigured/unavailable/uninitialized/empty`) |
| `fixturesReader.ts` **S** | Fase 1: lee `fixtures/manifest.json` + JSON, parsea con domain, arma payload; archivos ausentes → `empty` | `getDashboardPayload()` |
| `dbReader.ts` **S** | Fase 2: lee snapshots de Prisma y mapea errores (P2021→uninitialized, P1001→connection) | `getPayloadFromDb()` |
| `dbWriter.ts` **S** | SnapshotWriter (sección 16): transacción única, idempotencia por sha256 (paso 9: unchanged / needs_confirmation / saved), upsert de `schema_version`, listado y borrado | `saveSnapshot()`, `removeSnapshot()`, `listSnapshots()`, `FileRecord` |
| `dbErrors.ts` **S** | Mapeo compartido de errores Prisma → estados de la sección 13, sin credenciales en la UI | `mapDbError()` |

### i18n (`src/i18n/`) — bilingüe (D19)

| Archivo | Rol |
| --- | --- |
| `dictionaries.ts` | `en` (default) y `es`; `Dict = typeof en`. Todo texto de UI vive acá, ninguno en componentes |
| `index.tsx` | `LanguageProvider` + `useLanguage()` vía `useSyncExternalStore`; localStorage `pl-language`; sin rutas por idioma |

### App y componentes

| Archivo | Rol |
| --- | --- |
| `src/app/layout.tsx` | Fuentes, metadata, `<style>` con la paleta de `theme.ts` (D18) |
| `src/app/page.tsx` **S** | `/` → redirect a `/dashboard` (sección 15, regla confirmada por el autor); `force-dynamic` |
| `src/app/dashboard/page.tsx` **S** | Vista pública: `getDashboardPayload()` → `<DashboardApp/>`; `force-dynamic` |
| `src/app/terminal/page.tsx` **S** | Vista privada: 404 por modo (`notFound()` si `!canUseTerminal()`); renderiza `<TerminalApp/>` |
| `src/app/api/terminal/snapshots/route.ts` **S** | GET lista de capturas (guard: 404 por modo, 401/503 por token) |
| `src/app/api/terminal/snapshot/route.ts` **S** | POST guarda captura validada (payload validado defensivamente); DELETE borra por `?capturedAt=` |
| `src/app/globals.css` | Tokens shadcn base + `.scrollbar-thin` + estilos del tooltip de globe.gl |
| `src/components/dashboard/DashboardApp.tsx` **C** | Vista raíz: decide qué mostrar según `DataState`; estado compartido selección/foco entre buscador y globo |
| `src/components/dashboard/Header.tsx` **C** | Identidad + fecha de captura (D16: `latestCapturedAt`, nunca `ingestedAt`) + switcher |
| `src/components/dashboard/LanguageSwitcher.tsx` **C** | «ENG / ESPA» (D19) |
| `src/components/dashboard/KpiCards.tsx` **C** | Tarjetas: globales, 680 declaradas, 600 de 680 (D14), Universal (D8), derivado etiquetado (D13), equipos, desglose por tipo |
| `src/components/dashboard/GlobePanel.tsx` **C** | Contenedor del globo: leyenda, tarjeta de locación seleccionada; carga el canvas con `dynamic(ssr:false)` |
| `src/components/dashboard/GlobeCanvas.tsx` **C** | react-globe.gl/three: polígonos desde `public/geo/countries-110m.geojson`, marcadores tamaño/color por inscritos, anillo de selección, `pointOfView()` al foco. **Rotación**: gira SIEMPRE (incluso con drag/zoom o selección activa); única pausa = hover sobre un marcador (hitbox invisible) + gracia de 2.2 s tras un foco de búsqueda. **Rendimiento (estilo retro/pixelado deliberado)**: gobernador propio a 30 fps (resume+pause = 1 frame síncrono de globe.gl por paso; auto-repara el loop del double-mount de StrictMode), pixelRatio 0.5 + `image-rendering: pixelated` (los tooltips son DOM y quedan nítidos), océano = icosaedro de 320 tris con Lambert flatShading (sin specular), atmósfera OFF, polígonos sin caras laterales + `capCurvatureResolution 2` + tapa opaca, `pointResolution 4`, hitboxes invisibles (esferas con `material.visible=false` en la capa objects: el raycast sí las detecta, render costo cero) que hacen el hover alcanzable con marcadores de 2-3 px, pausa por pestaña oculta/globo fuera de vista (IntersectionObserver 0.2) |
| `src/components/dashboard/SearchBox.tsx` **C** | Buscador locación/país con `normalizeKey` (D17); muestra nombre original; `Enter` = primer resultado |
| `src/components/dashboard/RankingsPanel.tsx` **C** | Tabla países (global) / locaciones (dentro de país) + filtros tipo/inscripción/waitlist + **contador de resultados filtrados** (`N results`, visible sin scrollear, `aria-live`) |
| `src/components/dashboard/EvolutionCard.tsx` **C** | Con 1 captura: aviso (sección 13). Con 2+: Recharts + deltas abs/por día con signo |
| `src/components/dashboard/FailState.tsx` **C** | Aviso por estado, nombra la variable que falta, sin credenciales; botón Reintentar |
| `src/components/dashboard/Footer.tsx` **C** | Pie sticky (`mt-auto`) con crédito ariellamas.tech (D20) y safe-area iOS |
| `src/components/dashboard/TypeBadge.tsx` **C** | Badge de tipo de locación con color de paleta |
| `src/components/terminal/TerminalApp.tsx` **C** | Raíz de la terminal: máquina de estados (parseo→validación→guardado), reemplazo confirmado por AlertDialog, token en sessionStorage (`pl-terminal-token`), TZ del navegador vía `useSyncExternalStore` (anti-hidratación) |
| `src/components/terminal/UploadZone.tsx` **C** | Drag & drop + selector múltiple; parsea en el navegador, nada viaja hasta «Guardar» |
| `src/components/terminal/ParseLog.tsx` **C** | Log de sesión monoespaciado con niveles de color de paleta; auto-scroll |
| `src/components/terminal/CaptureMeta.tsx` **C** | Fecha/hora de captura obligatoria (D15, nunca del reloj) + TZ (default navegador) + nota; muestra el instante UTC resultante |
| `src/components/terminal/ValidationSummary.tsx` **C** | Resumen previo (paso 8): tabla de archivos con sha/offsets, veredicto del parser, advertencias no bloqueantes |
| `src/components/terminal/SnapshotList.tsx` **C** | Capturas en la base con borrado confirmado (AlertDialog) |
| `src/components/terminal/types.ts` **C** | Tipos de la terminal + colores de log por paleta |
| `src/lib/format.ts` | `formatNumber/Decimal/CapturedAt` con Intl (en-US / es-AR), fechas en UTC (D15/D16) |
| `src/lib/timezone.ts` | `zonedWallTimeToUtcIso()` (dos pasadas DST), `browserTimezone()`, `listTimezones()` + snapshot estable para `useSyncExternalStore` (D15) |
| `src/lib/hash.ts` | `sha256Hex()` con WebCrypto en el navegador (paso 5 del algoritmo) |
| `src/lib/terminalGuard.ts` **S** | Guard de APIs de escritura (sección 15, defensa en profundidad): 404 por modo, token con `timingSafeEqual`, 503 «sin configuración» en prod sin token, dev sin token permitido con warning | `guardTerminal()` |
| `src/lib/db.ts` **S** | Cliente Prisma singleton (andamio del sandbox) |

### Fixtures y scripts

| Archivo | Rol |
| --- | --- |
| `fixtures/` | **Datos REALES del autor (deploy estático)**: JSON crudos de la plataforma con nombres libres (D1–D2 clasifica por contenido) + `manifest.json` — array de capturas `{capturedAt, files, note}`; una entrada por fecha, 2+ entradas = serie temporal |
| `fixtures-synthetic/` | Harness sintético de regresión (valores de sección 8 exactos): `a.json` (contentFilterForm + event + 500 edges), `b.json` (100 edges), `manifest.json`. NO se despliega; `fixtures:generate`/`fixtures:verify` apuntan acá desde 2026-11-21 |
| `scripts/countries-data.mjs` | Datos de apoyo del generador: 115 países con pool de ciudades, centroides y locaciones fijas |
| `scripts/generate-fixtures.ts` | Genera el harness sintético en `fixtures-synthetic/` (`bun run fixtures:generate`) |
| `scripts/verify-fixtures.ts` | **Prueba de regresión**: parsea `fixtures-synthetic/` con el domain real y comprueba 63 valores/reglas exactos (`bun run fixtures:verify`) |

### Otros

| Archivo | Rol |
| --- | --- |
| `prisma/schema.prisma` | Modelo sección 6 adaptado a SQLite (`Snapshot`, `SnapshotFile`, `EventStat`, `CountryMap`, `SchemaVersion`); en Neon: provider postgres + `@db.Timestamptz` |
| `public/geo/countries-110m.geojson` | Polígonos de continentes (Natural Earth 110m) para el globo |
| `.env.example` | Variables de la sección 15 + recetas dev/prod (semántica de rutas SQLite, escenarios A/B, dos despliegues Fase 3). Ya no lo traga el `.gitignore` (`!.env.example`) — esta vez SÍ está committeado |
| `db/custom.db` | SQLite del sandbox (descartable). **Fuera del git** desde 2026-11-21: se reconstruye vacía con `npm run db:push` |

## 4. Contratos y decisiones clave (resumen D1–D20)

| # | Regla |
| --- | --- |
| D1–D2 | Los archivos son arrays de bloques `{data}`; se clasifican por contenido (`event` = cifras globales opcionales; `openLocations` = locaciones). Nunca por nombre/orden. `contentFilterForm` se ignora |
| D3–D4 | Orden y contigüidad por offset decodificado del cursor (`base64 'offset:N'`); válido si ids únicos == `totalCount` y última página cierra (`hasNextPage:false`) |
| D5–D7 | `id` opaco; coordenadas GeoJSON `[lng,lat]` → invertir; `cachedRegistrations` tal cual |
| D8 | Universal Event (`country==='Anywhere in the World'`): tarjeta propia; fuera de rankings, promedios y globo |
| D9–D10 | País = texto libre inglés; tabla manual a ISO2; no existe ciudad: siempre «locación» |
| D11–D13 | Tipo por `eventType` (In-Person/Virtual/Híbrida, categorías propias); cifras del bloque `event` por snapshot; «sin local event» = global − suma, SIEMPRE etiquetado «derivado» |
| D14 | Mostrar «600 visibles de 680 declaradas» sin explicar el motivo |
| D15–D16 | Fecha de captura la ingresa el autor (UTC); el dashboard muestra la `capturedAt` del snapshot más reciente, nunca la de subida |
| D17 | Búsqueda con `normalizeKey` (ver domain); resultado con nombre original |
| D18 | Un solo archivo de color: `src/config/theme.ts`; componentes usan `var(--pl-*)` |
| D19 | Textos en diccionarios; inglés default, switcher ENG/ESPA, localStorage, sin rutas por idioma |
| D20 | Pie: «Developed by ariellamas.tech» / «Desarrollado por ariellamas.tech» |

## 5. Valores de referencia (sección 8) — criterio de regresión

600 únicas · 599 sin Universal · 115 países + Anywhere in the World · suma **104.784** (89.956 sin Universal) · tipos: In-Person 235/27.979 · Virtual 119/27.714 (12.886 sin Universal) · Híbridas 246/49.091 · 4 con 0 · global 124.934 / 680 / 17.794 · derivado **20.150** · top países: India 72, US 55, Brazil 44, Turkey 28, Mexico 25, Egypt 16, Canada 16, Argentina 16, Peru 15, Colombia 13 · top locaciones: Cairo 3.474, Harohalli 2.364, Dhaka 2.022, Ankara 1.343, Chennai 1.255, Delhi 1.240, Shebeen El-Kom 988, Karachi 979, Tashkent 947 · Salta 112 híbrida `[-65.4231976, -24.7821269]` · buscar `sanliurfa` → Şanlıurfa.

> Los fixtures son sintéticos pero reproducen estos valores **exactamente**. Desde la decisión de despliegue estático (2026-11-21) el set sintético vive en `fixtures-synthetic/` como harness de regresión (`fixtures:generate` / `fixtures:verify` apuntan ahí), y `fixtures/` está reservado a los JSON crudos REALES: reemplazar su contenido y actualizar las entradas de `manifest.json` (misma estructura, una por fecha) sin tocar código. El dashboard muestra la captura más reciente del manifest (D16) y la evolución compara entradas consecutivas.

## 6. Comandos

```bash
bun run dev                 # dev server :3000 (siempre en background; log en dev.log)
bun run lint                # ESLint (debe salir limpio)
bun run fixtures:generate   # regenera el harness sintético en fixtures-synthetic/ (seed determinista 20261104)
bun run fixtures:verify     # 63 comprobaciones de sección 8 + D17 (regresión, contra fixtures-synthetic/)
bun run db:push             # aplica prisma/schema.prisma a SQLite
npm run build               # next build — SIN standalone, listo para Vercel (pedido del autor)
npm run start               # next start — corre el build de producción, sin bun
```

`postinstall: prisma generate` está en package.json: el build de Vercel genera
el cliente Prisma sin necesitar `DATABASE_URL` (el deploy estático no usa DB).

> **Semántica de rutas SQLite (hallazgo 2026-11-21, verificado empíricamente):**
> la ruta de `file:` se resuelve relativa a `prisma/schema.prisma`, NO a la raíz:
> `file:../db/custom.db` → `<raíz>/db/custom.db` (recomendado); `file:./db/custom.db`
> → `prisma/db/custom.db` (funciona pero queda escondida). El CLI (`db:push`)
> SÍ crea carpetas si faltan; el **runtime NO** — si la carpeta no existe, toda
> query muere con `Error code 14: Unable to open the database file`, que Prisma
> reporta como PrismaClientInitializationError **sin código P** → `mapDbError`
> lo clasifica `unavailable` ("No se pudo conectar con la base de datos"), no
> `uninitialized`. Los scripts `db:*` de package.json son prisma puro: funcionan
> con `npm run db:push` / `npx prisma db push` sin bun.

## 7. Variables de entorno (sección 15)

| Variable | Valores | Uso |
| --- | --- | --- |
| `APP_MODE` | dashboard \| terminal \| all (`all` solo dev) | qué vistas se habilitan; falta en prod → estado `unconfigured` |
| `DATA_SOURCE` | fixtures \| db | origen de los datos |
| `DATABASE_URL` | SQLite en dev (`file:../db/custom.db`) / cadena Neon en prod | **Hoy es la única credencial cableada**: la usan tanto `dbReader` como `dbWriter` |
| `DATABASE_URL_READ` / `DATABASE_URL_WRITE` | cadena Neon (Fase 3) | plan de la sección 15: rol read-only para el dashboard, rol de escritura solo para la terminal — **aún no cableado** en el código |
| `TERMINAL_TOKEN` | secreto | APIs de escritura; OPCIONAL en dev (permite sin token, warning en log); en prod sin token → 503 «sin configuración»; definido → obligatorio (`x-terminal-token`, timingSafeEqual) |

En dev, si faltan: `APP_MODE=all`, `DATA_SOURCE=fixtures`.

## 8. Convenciones para iterar

1. **Colores**: solo desde `theme.ts` (D18). UI usa `bg-[var(--pl-surface)]` etc.; globo/gráficos importan `palette`. Agregar un color = sumarlo a `palette` + `projectVars`.
2. **Textos**: solo desde `dictionaries.ts` (D19). Nueva clave = agregar en `en` y `es` (el tipo obliga).
3. **`domain/`** sigue puro y sin I/O; todo cálculo nuevo va ahí y suma un caso a `verify-fixtures.ts`.
4. **La interfaz no decide datos**: solo renderiza según `DataState` (sección 13); los errores van al log del servidor, nunca credenciales a la UI.
5. **Números y fechas**: siempre con `src/lib/format.ts` (Intl, fechas UTC).
6. **Responsive**: móvil primero; objetivos táctiles ≥44px; listas largas con `max-h-*` + `overflow-y-auto` + `scrollbar-thin`.
7. **Footer sticky**: contenedor `min-h-screen flex flex-col` + footer `mt-auto` (ya en `DashboardApp`); no romperlo.
8. Cada archivo nuevo arranca con `// FILE: ruta — propósito` y se suma a la tabla de la sección 3.

## 9. Plan de despliegue y decisiones de infraestructura (2026-11-21)

**Decisión del autor**: el evento terminó y los datos quedan congelados →
UN solo despliegue estático, sin DB y sin terminal online. La terminal queda
como herramienta local (validación/parseo en el navegador) y como TODO de
feature. Si en el futuro se quieren dominios extra o la terminal online,
aplicar la receta de esta sección SIN re-analizar el código.

### 9.1 Receta vigente — deploy estático HOY (Vercel, cero DB)

1. Datos: reemplazar el contenido de `fixtures/` por los JSON crudos reales
   (nombres libres: el parser clasifica por contenido, D1–D2). Una entrada en
   `fixtures/manifest.json` por fecha de captura — `capturedAt` ISO UTC real.
   **2+ entradas = serie temporal** para la tarjeta de evolución: el manifest
   ya es un array, el dashboard muestra la última captura y EvolutionCard
   compara consecutivas. El set sintético de regresión vive aparte en
   `fixtures-synthetic/` y NO forma parte del deploy.
2. Variables de entorno en Vercel (Environment Variables): `APP_MODE=dashboard`
   y `DATA_SOURCE=fixtures`. Nada más: sin `DATABASE_URL`, sin Neon, sin
   `TERMINAL_TOKEN`. `postinstall: prisma generate` ya está en package.json.
3. Flujo: push a GitHub → Vercel «New Project» → importar el repo → deploy con
   el default (`next build`; el repo NO usa `output: standalone`).
4. Verificación previa local: `npm run build && npm start` con
   `APP_MODE=dashboard DATA_SOURCE=fixtures` → el dashboard debe mostrar los
   valores reales y la fecha de la última entrada del manifest (D16).
5. Online: `/terminal` y las APIs de escritura responden **404** (modo
   dashboard) — la terminal solo existe en local (`npm run dev`).
   `fixtures:verify` ya no aplica al contenido real (sus 63 valores son del
   set sintético); sigue corriendo contra `fixtures-synthetic/`.

### 9.2 TODO de feature — terminal online (futuro)

La terminal está COMPLETA y verificada (Fase 2); lo único que falta es
exponerla. Dos variantes, en orden de esfuerzo:

**Variante A — un despliegue con terminal online (mínima):**
1. `src/config/appMode.ts`: permitir `'all'` en producción (hoy lo rechaza:
   `if (isProduction && value === 'all') return null;` — quitar esa línea y su
   comentario).
2. `src/app/terminal/page.tsx`: metadata `robots: noindex`.
3. `src/lib/db.ts`: segundo cliente Prisma (escritura) leyendo
   `DATABASE_URL_WRITE` con fallback a `DATABASE_URL`; que `dbReader` use el
   de lectura (`DATABASE_URL_READ`) y `dbWriter` el de escritura. Hoy ambos
   comparten el único `DATABASE_URL`.
4. `prisma/schema.prisma`: `provider = "postgresql"` + `capturedAt DateTime
   @db.Timestamptz`; `prisma db push` contra Neon.
5. Vercel (un proyecto): `APP_MODE=all`, `DATA_SOURCE=db`,
   `DATABASE_URL_READ` (rol read-only de Neon), `DATABASE_URL_WRITE` (rol de
   escritura), `TERMINAL_TOKEN`. Sin token en prod la escritura responde 503
   (guard existente); con token definido, obligatorio en `x-terminal-token`.
6. El candado real ya existe y está verificado: TODAS las `/api/terminal/*`
   (listar, guardar, borrar) pasan por `guardTerminal` (timingSafeEqual; sin
   token la lista ni siquiera carga). La URL oculta y el noindex son confort,
   no seguridad.

**Variante B — dos despliegues / dos dominios:**
1. Pasos 3–4 de la variante A (split READ/WRITE + schema Postgres).
2. NO tocar `appMode.ts`: `'dashboard'` y `'terminal'` ya son válidos en prod.
3. Proyecto Dashboard (dominio público): `APP_MODE=dashboard`,
   `DATA_SOURCE=db`, `DATABASE_URL` = rol read-only → `/terminal` 404.
4. Proyecto Terminal (dominio privado): `APP_MODE=terminal`, `DATABASE_URL` =
   rol de escritura, `TERMINAL_TOKEN`.
5. Rotación de credenciales: token → env de Vercel; contraseñas de roles →
   consola de Neon. (Opcional no implementado: hash del token en una tabla
   para rotarlo desde la consola SQL de Neon sin redeploy.)

### 9.3 Serie temporal / evolución (futuro)

- HOY: si el autor conservó JSONs de varias fechas, agregar una entrada por
  fecha al `fixtures/manifest.json` → la evolución funciona SIN DB.
- Fase 4 real (carga por terminal, manifiesto masivo, exportación): requiere
  la variante A o B + Neon. `domain/evolution.ts` y la UI ya consumen el array
  `snapshots` tal cual (fixtures o DB, indistinto).
- Tip de reserva: commitear cada set de JSON con su fecha = serie temporal
  recuperable desde el historial de git.

## 10. Registro de iteraciones (append-only)

| Fecha | Cambios | Archivos tocados |
| --- | --- | --- |
| 2026-11-04 | **Fase 1 completa**: módulo `domain` (parser D1–D8, normalizeKey D17, stats, rankings, evolución), paleta centralizada D18, i18n D19, capa `data` (fixtures + db groundwork), dashboard completo en `/` (globo three.js con marcadores, buscador, rankings métrica×filtro×alcance, tarjetas incl. derivado D13 y 600 de 680 D14, estados de fallo sección 13, footer D20), fixtures sintéticos que reproducen sección 8, esquema Prisma sección 6, `.env.example`. Verificado: 63/63 fixtures, lint limpio, navegador (globo, búsqueda Şanlıurfa, rankings por país, ENG/ESPA, móvil, estado vacío) | Todas las rutas nuevas; ver sección 3 |
| 2026-11-04 | **Rendimiento del globo + UX de rotación + conteo de rankings**: (a) GlobeCanvas reescrito con render on-demand — el loop RAF se pausa (`pauseAnimation`) cuando no hay nada que animar y el vigilante de 300ms fuerza el estado deseado con métodos idempotentes (repara el loop muerto que dejaba el `_destructor` del double-mount de StrictMode en dev, que congelaba el globo para siempre); (b) rotación solo cuando no hay hover sobre marcador, ni zoom/drag (gracias a eventos `start`/`end` de OrbitControls + gracia de 2.5s), ni selección activa, ni foco reciente; hover mantiene el tooltip vivo porque el loop sigue corriendo mientras (`hoveringPoint` sostiene el loop); (c) costo por frame: antialias off, pixelRatio ≤ 1.5, `powerPreference low-power`, `pointResolution 8`; (d) pausa inmediata con pestaña oculta o globo <20% visible y auto-pausa total a los 45s sin actividad (attract mode); (e) RankingsPanel: contador de resultados filtrados (claves i18n `resultSingular/resultPlural`). Verificado en navegador: rota al cargar → se congela sobre marcador (tooltip "Salta/112") → tarjeta seleccionada lo mantiene enmarcado → al cerrar reanuda → RAF=0 tras 45s idle y con pestaña oculta → zoom con rueda OK → conteo 115/79/58 según filtro y 16 en Argentina → móvil OK → consola limpia. Hallazgo técnico: el raycast/hover de globe.gl corre DENTRO del tick RAF — pausar el loop sin mantenerlo vivo durante hover rompe tooltips (por eso `pointerBusy` incluye `hoveringPoint`) | `src/components/dashboard/GlobeCanvas.tsx`, `src/components/dashboard/RankingsPanel.tsx`, `src/i18n/dictionaries.ts` |
| 2026-11-05 | **Giro permanente + segunda tanda de optimización del globo (pedido explícito)**: (a) regla nueva: el globo gira SIEMPRE — única pausa = hover sobre un local event (+ gracia de 2.2 s tras un foco de búsqueda para ver el destino aterrizar); eliminados los bloqueos por drag/zoom/selección y el auto-pause de 45 s; (b) gobernador de FPS: el loop interno corría al refresco nativo (60/120 Hz); ahora un rAF propio ejecuta EXACTAMENTE 1 tick cada 33 ms (`resumeAnimation()` corre `_animationCycle` síncrono y `pauseAnimation()` cancela el siguiente rAF — verificado en la fuente de globe.gl); la velocidad de giro no cambia porque OrbitControls corrige autoRotate por deltaTime; (c) pixelRatio 0.5 + `image-rendering: pixelated` (¼ de fragmentos; los tooltips son DOM y quedan nítidos); (d) océano = IcosahedronGeometry(detail 2, 320 tris) con MeshLambertMaterial flatShading (antes SphereGeometry ~7.5k tris con Phong+specular); detail 2 = mínimo que mantiene la tierra (alt 0.006) sobre el océano facetado; (e) atmósfera OFF; polígonos sin caras laterales (`polygonSideColor null`), `capCurvatureResolution 2` y tapa opaca; marcadores `pointResolution 4` sin transiciones; (f) **hitboxes invisibles** (esferas r=1.6, `material.visible=false`, capa objects): el cilindro visible mide 2-3 px y el hover era inalcanzable con el globo girando (diagnosticado con instrumentación temporal del raycaster de three-render-objects — hallazgo: three SÍ raycastea mallas con material invisible; instrumentación revertida a pristine). Verificado en navegador: rotación continua (frames difieren), sigue girando durante zoom sintético, hover → autoRotate=false + tooltip "Cairo Egypt 3,474 registrants", reanuda a 8 px del marcador, click → tarjeta Salta, búsqueda → vuelo + gracia + reanudación, contador 115 results, móvil OK (footer sticky), consola limpia, lint limpio, 63/63 | `src/components/dashboard/GlobeCanvas.tsx` |
| 2026-11-21 | **Restauración del workspace + build/start Vercel-ready**: el sandbox se restableció a la plantilla vacía y se perdió todo el código; restaurado íntegramente desde el tar que subió el autor (`.git` incluido con la historia real; fixtures, geojson, PROJECT_INDEX, componentes — verificado con `fixtures:verify` 63/63, lint limpio y navegador: dashboard completo con valores de sección 8 exactos, búsqueda `sanliurfa`→Şanlıurfa, switcher ESPA, globo rotando, consola limpia). Config corregida (pedido explícito del autor, pensado para Vercel): `next.config.ts` **sin** `output:"standalone"`, `"build": "next build"`, `"start": "next start"` (sin bun). Recreado `.env.example` (no vino en el tar). **Advertencia de plataforma**: el `build.sh` interno del sandbox auto-inyecta `output:"standalone"` en next.config.ts si falta, al publicar desde el sandbox (modelo FC propio) — si eso pasa, re-quitar la línea | `package.json`, `next.config.ts`, `.env.example`, `.gitignore`, PROJECT_INDEX.md |
| 2026-11-21 | **Repo: `.env` fuera del tracking** (reportado por el autor: git detectaba cambios aunque `.env*` está en `.gitignore`). Causa: `.env` quedó trackeado desde el Initial commit de la plantilla (`720d0cb`) y gitignore solo aplica a archivos no trackeados. Fix en sandbox: `git rm --cached .env` + commit (`df9a9e1`); el autor corre lo mismo en su local | `.env` (untracked), PROJECT_INDEX.md |
| 2026-11-21 | **Fase 2 completa: terminal de carga** (rutas `/`→redirect, `/dashboard`, `/terminal` + APIs). UI estilo terminal (mono, paleta D18, textos D19 en `terminal.*`): drag&drop + parseo COMPLETO en navegador con domain isomórfico (clasificación D1–D2, sha256 WebCrypto paso 5, validación D3–D4, resumen previo paso 8, advertencias no bloqueantes), fecha de captura obligatoria + zona horaria con conversión de pared→UTC en dos pasadas DST (D15, `lib/timezone.ts`), guardado vía API con reemplazo confirmado (AlertDialog) y token en sessionStorage. Backend: `dbWriter.ts` = SnapshotWriter con transacción única + idempotencia por sha256 (unchanged/needs_confirmation/saved) + upsert `schema_version`; APIs con `terminalGuard` (404 por modo — verificado: con `APP_MODE=dashboard` GET /terminal, POST y GET responden 404 y /dashboard 200; token con timingSafeEqual; 503 «sin configuración» en prod sin token; dev sin token permitido con warning). Esquema: `SnapshotFile.offsetStart/offsetEnd` ahora `Int?` (fallback D3 cuando el cursor no decodifica). `dbReader` refactorizado para compartir `dbErrors.ts`. **Verificado en navegador**: a.json+b.json → reconocidos por contenido (no por nombre), captura guardada con UTC preview, lista con 1 fila; re-guardado idéntico → «unchanged»; `DATA_SOURCE=db` → dashboard lee de la DB con valores de sección 8 idénticos y capturedAt del autor (D16). Lint limpio, 63/63. Nota: los mensajes de diagnóstico del domain (advertencias/rechazos) se muestran en su idioma original (español) — son datos del parser, no strings de UI | `src/app/page.tsx`, `src/app/dashboard/page.tsx`, `src/app/terminal/page.tsx`, `src/app/api/terminal/**`, `src/components/terminal/**` (7 archivos), `src/data/dbWriter.ts`, `src/data/dbErrors.ts`, `src/data/dbReader.ts`, `src/lib/{timezone,hash,terminalGuard}.ts`, `src/i18n/dictionaries.ts`, `prisma/schema.prisma`, PROJECT_INDEX.md |
| 2026-11-21 | **Diagnóstico del fallo local de la terminal + hardening de configuración**: el autor, en su máquina (`APP_MODE=all`, `npm run dev`), subió los JSONs a `/terminal` y al guardar obtuvo "No se pudo conectar con la base de datos. Tus archivos siguen parseados acá". Reproducido y con causa raíz confirmada: su `.env` tenía `DATABASE_URL=file:./db/custom.db`, que Prisma resuelve relativo a `prisma/` (verificado empíricamente en CLI y runtime), y el runtime NO crea carpetas → `Error code 14: Unable to open the database file` → error sin código P → `mapDbError` → `unavailable`. **No era Neon**: la nube entra en Fase 3; en local la terminal escribe en SQLite. Fixes: (1) `.gitignore`: `!.env.example` (el patrón `.env*` lo excluía — por eso había desaparecido tras el reinicio del contenedor) y `db/*.db` ignorado + `git rm --cached db/custom.db` (DB descartable, sección 9); (2) `.env.example` recreado y COMMITTEADO (recetas dev/prod, semántica de rutas, escenarios A/B, dos despliegues Fase 3, estado real de READ/WRITE); (3) sandbox migrado a `DATABASE_URL=file:../db/custom.db` y verificado end-to-end (`GET /api/terminal/snapshots` 200 con la captura; dashboard leyendo de DB) | `.gitignore`, `.env.example`, `db/custom.db` (untrack), PROJECT_INDEX.md |
| 2026-11-21 | **Decisión de despliegue: estático de un solo deploy + dato real separado del harness** (pedido explícito del autor: registrar el cambio de plan — dos despliegues → uno — para que el futuro no requiera re-analizar código). (a) El autor elige el camino sin Neon: dashboard-only sobre JSON reales; registrada la receta HOY (sección 9.1: Vercel, `APP_MODE=dashboard`, `DATA_SOURCE=fixtures`, sin DB) y las recetas futuras de terminal online (9.2 variante A: un deploy + `'all'` en prod + split READ/WRITE; variante B: dos dominios con `'dashboard'`/`'terminal'`, sin tocar appMode) + serie temporal sin DB vía manifest multi-entrada (9.3); (b) `fixtures/` reservado a los datos REALES del autor y el set sintético movido a `fixtures-synthetic/` — `fixtures:generate`/`fixtures:verify` apuntan ahí, 63/63 verificado tras el cambio; (c) hallazgo a favor: el manifest ya es un array, así que N entradas por fecha dan la serie temporal SIN DB (EvolutionCard compara consecutivas); (d) package.json: `postinstall: prisma generate` para builds de Vercel sin `DATABASE_URL`; (e) `.env.example` reordenado: receta HOY + futuras A/B | `package.json`, `.env.example`, `fixtures-synthetic/` (nuevo), `scripts/generate-fixtures.ts`, `scripts/verify-fixtures.ts`, `PROJECT_INDEX.md` |
