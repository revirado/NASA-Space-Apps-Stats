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

Un solo proyecto Next.js 16 (App Router) con dos vistas previstas: el **dashboard
público** (solo lectura) y la **terminal de carga** (privada, Fase 2). Hoy está
implementada la **Fase 1** completa: dashboard sobre JSON crudos de la plataforma
+ terminología, paleta y estados de fallo listos para las fases siguientes.

- Datos: los JSON crudos de la plataforma (`fixtures/`) son la fuente de verdad; la DB es descartable y reconstruible (sección 9 del brief).
- El sandbox solo permite la ruta `/`; el dashboard vive ahí (en producción serán `/dashboard` y `/terminal` según `APP_MODE`).
- Stack: Next.js 16 + TypeScript 5 + Tailwind 4 + shadcn/ui + react-globe.gl (three.js) + Recharts + Prisma (SQLite aquí, Neon en producción).

## 2. Estado por fases

| Fase | Estado |
| --- | --- |
| 1 · Prueba de concepto sin DB (globo, buscador, rankings, tarjetas, estados, i18n, paleta) | **Completa y verificada** (63/63 + navegador) |
| 2 · Terminal de carga + DB (Neon en prod) | Preparada: esquema Prisma y `dbReader.ts` listos; falta `SnapshotWriter`, UI `/terminal`, APIs |
| 3 · Despliegue en la nube (Vercel, dos proyectos, switcher ENG default) | Pendiente |
| 4 · Evolución con 2+ capturas, manifiesto masivo, exportación | `domain/evolution.ts` listo; UI básica de evolución lista; falta carga real |
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

### i18n (`src/i18n/`) — bilingüe (D19)

| Archivo | Rol |
| --- | --- |
| `dictionaries.ts` | `en` (default) y `es`; `Dict = typeof en`. Todo texto de UI vive acá, ninguno en componentes |
| `index.tsx` | `LanguageProvider` + `useLanguage()` vía `useSyncExternalStore`; localStorage `pl-language`; sin rutas por idioma |

### App y componentes

| Archivo | Rol |
| --- | --- |
| `src/app/layout.tsx` | Fuentes, metadata, `<style>` con la paleta de `theme.ts` (D18) |
| `src/app/page.tsx` **S** | Ruta `/` (única del sandbox): `getDashboardPayload()` → `<DashboardApp/>`; `force-dynamic` |
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
| `src/lib/format.ts` | `formatNumber/Decimal/CapturedAt` con Intl (en-US / es-AR), fechas en UTC (D15/D16) |
| `src/lib/db.ts` **S** | Cliente Prisma singleton (andamio del sandbox) |

### Fixtures y scripts

| Archivo | Rol |
| --- | --- |
| `fixtures/a.json` | JSON crudo sintético: `contentFilterForm` + `event` + 500 edges (offsets 0–499, `hasNextPage:true`) |
| `fixtures/b.json` | Solo `openLocations` con 100 edges (offsets 500–599, `hasNextPage:false`) |
| `fixtures/manifest.json` | Lista `{capturedAt, files, note}` (sección 9): captura del 2026-11-02T14:00:00Z |
| `scripts/countries-data.mjs` | Datos de apoyo del generador: 115 países con pool de ciudades, centroides y locaciones fijas |
| `scripts/generate-fixtures.ts` | Genera los fixtures sintéticos con los valores de referencia de la sección 8 (`bun run fixtures:generate`) |
| `scripts/verify-fixtures.ts` | **Prueba de regresión**: parsea los fixtures con el domain real y comprueba 63 valores/reglas exactos (`bun run fixtures:verify`) |

### Otros

| Archivo | Rol |
| --- | --- |
| `prisma/schema.prisma` | Modelo sección 6 adaptado a SQLite (`Snapshot`, `SnapshotFile`, `EventStat`, `CountryMap`, `SchemaVersion`); en Neon: provider postgres + `@db.Timestamptz` |
| `public/geo/countries-110m.geojson` | Polígonos de continentes (Natural Earth 110m) para el globo |
| `.env.example` | Variables de la sección 15 |
| `db/custom.db` | SQLite del sandbox (descartable) |

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

> Los fixtures son sintéticos pero reproducen estos valores **exactamente**. Cuando existan los JSON reales, reemplazar `fixtures/a.json`, `b.json` y la fecha en `manifest.json` (misma estructura) sin tocar código; `fixtures:verify` debe seguir dando 63/63.

## 6. Comandos

```bash
bun run dev                 # dev server :3000 (siempre en background; log en dev.log)
bun run lint                # ESLint (debe salir limpio)
bun run fixtures:generate   # regenera fixtures sintéticos (seed determinista 20261104)
bun run fixtures:verify     # 63 comprobaciones de sección 8 + D17 (regresión)
bun run db:push             # aplica prisma/schema.prisma a SQLite
```

## 7. Variables de entorno (sección 15)

| Variable | Valores | Uso |
| --- | --- | --- |
| `APP_MODE` | dashboard \| terminal \| all (`all` solo dev) | qué vistas se habilitan; falta en prod → estado `unconfigured` |
| `DATA_SOURCE` | fixtures \| db | origen de los datos |
| `DATABASE_URL_READ` / `DATABASE_URL_WRITE` | cadena Neon | lectura (rol read-only) / escritura (solo terminal) |
| `TERMINAL_TOKEN` | secreto | acceso a la terminal (Fase 2) |

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

## 9. Registro de iteraciones (append-only)

| Fecha | Cambios | Archivos tocados |
| --- | --- | --- |
| 2026-11-04 | **Fase 1 completa**: módulo `domain` (parser D1–D8, normalizeKey D17, stats, rankings, evolución), paleta centralizada D18, i18n D19, capa `data` (fixtures + db groundwork), dashboard completo en `/` (globo three.js con marcadores, buscador, rankings métrica×filtro×alcance, tarjetas incl. derivado D13 y 600 de 680 D14, estados de fallo sección 13, footer D20), fixtures sintéticos que reproducen sección 8, esquema Prisma sección 6, `.env.example`. Verificado: 63/63 fixtures, lint limpio, navegador (globo, búsqueda Şanlıurfa, rankings por país, ENG/ESPA, móvil, estado vacío) | Todas las rutas nuevas; ver sección 3 |
| 2026-11-04 | **Rendimiento del globo + UX de rotación + conteo de rankings**: (a) GlobeCanvas reescrito con render on-demand — el loop RAF se pausa (`pauseAnimation`) cuando no hay nada que animar y el vigilante de 300ms fuerza el estado deseado con métodos idempotentes (repara el loop muerto que dejaba el `_destructor` del double-mount de StrictMode en dev, que congelaba el globo para siempre); (b) rotación solo cuando no hay hover sobre marcador, ni zoom/drag (gracias a eventos `start`/`end` de OrbitControls + gracia de 2.5s), ni selección activa, ni foco reciente; hover mantiene el tooltip vivo porque el loop sigue corriendo mientras (`hoveringPoint` sostiene el loop); (c) costo por frame: antialias off, pixelRatio ≤ 1.5, `powerPreference low-power`, `pointResolution 8`; (d) pausa inmediata con pestaña oculta o globo <20% visible y auto-pausa total a los 45s sin actividad (attract mode); (e) RankingsPanel: contador de resultados filtrados (claves i18n `resultSingular/resultPlural`). Verificado en navegador: rota al cargar → se congela sobre marcador (tooltip "Salta/112") → tarjeta seleccionada lo mantiene enmarcado → al cerrar reanuda → RAF=0 tras 45s idle y con pestaña oculta → zoom con rueda OK → conteo 115/79/58 según filtro y 16 en Argentina → móvil OK → consola limpia. Hallazgo técnico: el raycast/hover de globe.gl corre DENTRO del tick RAF — pausar el loop sin mantenerlo vivo durante hover rompe tooltips (por eso `pointerBusy` incluye `hoveringPoint`) | `src/components/dashboard/GlobeCanvas.tsx`, `src/components/dashboard/RankingsPanel.tsx`, `src/i18n/dictionaries.ts` |
| 2026-11-05 | **Giro permanente + segunda tanda de optimización del globo (pedido explícito)**: (a) regla nueva: el globo gira SIEMPRE — única pausa = hover sobre un local event (+ gracia de 2.2 s tras un foco de búsqueda para ver el destino aterrizar); eliminados los bloqueos por drag/zoom/selección y el auto-pause de 45 s; (b) gobernador de FPS: el loop interno corría al refresco nativo (60/120 Hz); ahora un rAF propio ejecuta EXACTAMENTE 1 tick cada 33 ms (`resumeAnimation()` corre `_animationCycle` síncrono y `pauseAnimation()` cancela el siguiente rAF — verificado en la fuente de globe.gl); la velocidad de giro no cambia porque OrbitControls corrige autoRotate por deltaTime; (c) pixelRatio 0.5 + `image-rendering: pixelated` (¼ de fragmentos; los tooltips son DOM y quedan nítidos); (d) océano = IcosahedronGeometry(detail 2, 320 tris) con MeshLambertMaterial flatShading (antes SphereGeometry ~7.5k tris con Phong+specular); detail 2 = mínimo que mantiene la tierra (alt 0.006) sobre el océano facetado; (e) atmósfera OFF; polígonos sin caras laterales (`polygonSideColor null`), `capCurvatureResolution 2` y tapa opaca; marcadores `pointResolution 4` sin transiciones; (f) **hitboxes invisibles** (esferas r=1.6, `material.visible=false`, capa objects): el cilindro visible mide 2-3 px y el hover era inalcanzable con el globo girando (diagnosticado con instrumentación temporal del raycaster de three-render-objects — hallazgo: three SÍ raycastea mallas con material invisible; instrumentación revertida a pristine). Verificado en navegador: rotación continua (frames difieren), sigue girando durante zoom sintético, hover → autoRotate=false + tooltip "Cairo Egypt 3,474 registrants", reanuda a 8 px del marcador, click → tarjeta Salta, búsqueda → vuelo + gracia + reanudación, contador 115 results, móvil OK (footer sticky), consola limpia, lint limpio, 63/63 | `src/components/dashboard/GlobeCanvas.tsx` |
