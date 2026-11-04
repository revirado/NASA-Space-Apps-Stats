# Brief técnico: Dashboard de Local Events (NASA Space Apps 2026)

Documento de referencia para construir, refactorizar o ampliar el sistema. Cada decisión indica en qué dato real de los JSON (a.json y b.json) se apoya, o queda marcada como hipótesis o pendiente.

## 1. Cómo leer este documento

Cada decisión lleva una etiqueta de evidencia:

- **Verificado:** observado directamente en los JSON o en la salida de los scripts de inspección.
- **Derivado:** calculado a partir de datos verificados, con supuestos que se indican.
- **Hipótesis:** explicación plausible sin respaldo en los datos. Nada se construye sobre ella sin validarla.
- **Pendiente:** falta un dato o una prueba.

Si un dato nuevo contradice una decisión, se corrige primero este documento y luego el código.

## 2. Arquitectura

Es un solo proyecto con dos vistas y una base de datos compartida (Neon), desplegado en Vercel. Una variable de entorno decide qué vista se habilita en cada despliegue (sección 15).

- **Dashboard (público):** solo lectura. Globo, buscador, rankings y evolución. Ruta `/dashboard`.
- **Terminal de carga (privada, solo el autor; en otras secciones aparece como «panel de carga» o «admin»):** sube los JSON crudos, indica la fecha de captura, valida, escribe en la DB y exporta el historial. Ruta `/terminal`.
- **La DB es descartable.** Es una caché derivada de los JSON crudos más sus fechas de captura. Si se borra, se reconstruye volviendo a cargar los JSON con sus fechas (sección 9).
- **Esquema único.** Las migraciones viven en el mismo repositorio que las dos vistas, y existe una tabla `schema_version` para detectar un esquema que el código no espera.
- **Los JSON crudos son la fuente de verdad** y se conservan fuera de la DB (carpeta propia, repositorio privado o almacenamiento). Sin ellos no hay reconstrucción posible.
- **Dónde se parsea:** en el navegador de la terminal, que muestra el resultado de la detección y la validación antes de enviar. Al servidor solo viaja el resumen limpio (unas 600 filas por snapshot). Motivo: mostrar el resultado de la validación antes de enviar y evitar una ida y vuelta al servidor. El tamaño ya no es un obstáculo: a.json pesa 666 KB y b.json 126 KB (unos 792 KB en total), muy por debajo del límite de petición de las funciones de Vercel (documentado en torno a 4,5 MB; verificar contra la documentación vigente). Si el volumen creciera mucho, conviene volver a medirlo. Estado: decisión de diseño; tamaño de los archivos Verificado.

## 3. Registro de decisiones y su evidencia

### D1. Estructura del archivo

- **Hallazgo:** cada archivo es un array de bloques `{ data: { ... } }` y cada bloque trae una sola clave: `contentFilterForm`, `event` u `openLocations`.
- **Evidencia:** a.json tiene los tres bloques; b.json solo `openLocations`.
- **Decisión:** el parser recorre todos los bloques de todos los archivos y los clasifica por clave. `contentFilterForm` es un formulario de filtros de la interfaz y se ignora.
- **Nota histórica:** el primer script de inspección solo analizó `contentFilterForm` porque tomaba el primer array que encontraba. De ahí que el parser no deba asumir una posición fija.
- **Estado:** Verificado.

### D2. Detección de archivos por estructura

- **Evidencia:** a.json contiene `event` y 500 edges; b.json contiene 100 edges y ningún `event`.
- **Decisión:** no se usa nombre, tamaño ni orden de subida. Un archivo con bloque `event` aporta las cifras globales; todo archivo con `openLocations` aporta locaciones.
- **Límite:** que `event` aparezca siempre en el primer archivo es una **hipótesis** (solo hay una captura). Por eso las cifras globales son opcionales en cada snapshot.
- **Estado:** Verificado para estos dos archivos.

### D3. Orden de páginas mediante el cursor

- **Evidencia:** `pageInfo.endCursor` de a.json es `b2Zmc2V0OjQ5OQ==`, que en base64 decodifica a `offset:499`. El de b.json es `b2Zmc2V0OjU5OQ==`, igual a `offset:599`. Cada edge trae también su propio cursor (el de Salta, `b2Zmc2V0OjEzMQ==`, es `offset:131`).
- **Coherencia con los conteos:** 500 edges que terminan en 499 empiezan en 0; 100 edges que terminan en 599 empiezan en 500.
- **Decisión:** el orden y la contigüidad de las páginas salen del offset del cursor, no del nombre del archivo. Si hay huecos o solapes, se rechaza el snapshot.
- **Riesgo:** el formato del cursor no está documentado por la plataforma. Si el decode falla, se cae a la validación por `totalCount` (D4) y se avisa.
- **Estado:** Verificado.

### D4. Validación de completitud

- **Evidencia:** ambos archivos declaran `totalCount: 600`; hay 600 ids únicos y 0 duplicados; `hasNextPage` es `true` en a.json y `false` en b.json.
- **Decisión:** un snapshot es válido si la cantidad de ids únicos es igual a `totalCount` y la última página tiene `hasNextPage: false`. Si no, se rechaza e indica cuántas locaciones faltan.
- **Estado:** Verificado.

### D5. Identificador de locación

- **Evidencia:** `properties.id` es base64 (`aWQ6NTQ1NTE=` decodifica a `id:54551`). El autor tomó un id al azar de un JSON capturado la semana anterior y correspondía a la misma locación.
- **Decisión:** `external_id` es el string tal cual llega. No se decodifica ni se interpreta.
- **Pendiente:** la muestra es de un solo id. La comprobación completa es la intersección de ids entre ambas capturas, que se hace al cargar el JSON anterior como segundo snapshot (el paso 7 del algoritmo ya emite una advertencia por ids ausentes).
- **Estado:** formato Verificado; estabilidad Verificada en una muestra, comprobación completa Pendiente.

### D6. Coordenadas

- **Evidencia:** `geometry.coordinates` viene como `[lng, lat]` (GeoJSON). Salta: `[-65.4231976, -24.7821269]` es lat -24,78 y lng -65,42, que corresponde a Salta (Argentina). Şanlıurfa: `[38.7955, 37.1674]`, que corresponde a el sureste de Turquía. El script halló 0 locaciones sin coordenadas válidas de 600.
- **Decisión:** se invierte a `lat, lng` al guardar. Las librerías de globo esperan lat primero.
- **Pendiente:** las coordenadas del Universal Event no se han visto. Por eso se excluye del globo (D8).
- **Estado:** Verificado.

### D7. Inscritos por locación

- **Evidencia:** `properties.cachedRegistrations` es numérico en las 600 locaciones; mínimo 0, máximo 14.828, suma 104.784. Hay 4 locaciones con 0.
- **Decisión:** se guarda tal cual por snapshot. El prefijo `cached` indica un valor en caché de la plataforma, que puede ir retrasado respecto a la realidad; las comparaciones entre fechas miden lo que la plataforma mostraba, no el instante exacto.
- **Estado:** Verificado.

### D8. El Universal Event

- **Evidencia:** la locación con 14.828 inscritos tiene `title: Universal Event`, `country: Anywhere in the World` y `eventType: Virtual`. Pesa 14,2 % de los 104.784.
- **Decisión:** se marca `is_universal = (country === 'Anywhere in the World')`. Se excluye de rankings por país, promedios, medianas y del globo, y se muestra en una tarjeta aparte. Si el snapshot trae más de una locación con esa marca, se emite una advertencia.
- **Historia:** primero se supuso que era un evento virtual (hipótesis); la salida de check.mjs lo confirmó.
- **Estado:** Verificado.

### D9. País

- **Evidencia:** `country` es texto libre en inglés, sin ISO. Hay 116 valores distintos: 115 países o territorios y `Anywhere in the World`.
- **Decisión:** tabla manual `country → iso2 y nombre de polígono del globo`. Un país sin mapeo no rompe nada: aparece en rankings y se marca como no mapeado en el globo.
- **Nombres que no coinciden con ISO o con polígonos comunes:** Turkey (Türkiye), Burma (Myanmar), Cabo Verde, Côte d'Ivoire, The Gambia, Democratic Republic of the Congo, Republic of the Congo, Holy See, Palestinian Territories, Taiwan, South Korea, North Macedonia.
- **Pendiente:** que los nombres sean estables entre capturas.
- **Estado:** Verificado.

### D10. No existe el concepto de ciudad

- **Evidencia:** los 14 campos de `properties` no incluyen `city`. `title` y `displayName` son el nombre de la locación (ejemplos: Salta, Çorum, Cairo).
- **Decisión:** en código y en la interfaz se habla de *locación*, nunca de *ciudad*. El ranking dentro de un país es un ranking de locaciones.
- **Estado:** Verificado.

### D11. Virtual y presencial se miden por tipo de locación

- **Evidencia:** `eventType` tiene tres valores: In-Person 235, Virtual 119, Virtual & In-Person 246 (suma 600). Los inscritos por tipo suman 27.979 + 27.714 + 49.091 = 104.784, igual al total.
- **Decisión:** el JSON no separa personas virtuales de presenciales dentro de una locación híbrida. Los rankings son por tipo de locación y las híbridas son una categoría propia; no se reparten.
- **Consistencia con los booleanos:** Salta es híbrida con `isHybrid: true` e `isVirtual: false`, y Şanlıurfa es In-Person con ambos en `false`. No se comprobó el resto. Por eso `eventType` es la fuente de verdad, y la ingesta emite una advertencia si `isVirtual` o `isHybrid` lo contradicen.
- **Estado:** Verificado; consistencia de booleanos Pendiente.

### D12. Cifras globales del bloque `event`

- **Evidencia:** `cachedEventRegistrations = 124934`, `cachedLocalEvents = 680`, `cachedTeams = 17794`, `cachedLocalEventRegistrations = null`, `startDate = 2026-11-13T19:00:00`, `endDate = 2026-11-15T23:59:00`.
- **Decisión:** se guardan los tres primeros números por snapshot. `cachedLocalEventRegistrations` se ignora por ser null.
- **Estado:** Verificado.

### D13. Inscritos sin local event

- **Cálculo:** 124.934 menos 104.784 da 20.150.
- **Supuestos no verificados:** (a) las 80 locaciones que no llegan no aportan inscritos; (b) ambas cifras en caché se refrescaron al mismo tiempo.
- **Decisión:** se guardan los dos componentes y la cifra se calcula en la consulta. Siempre se etiqueta como **derivada**. Puede cambiar de signo entre capturas, y el sistema lo muestra con una advertencia en lugar de ocultarlo.
- **Estado:** Derivado.

### D14. Las 80 locaciones que faltan

- **Evidencia:** `cachedLocalEvents = 680` frente a `totalCount = 600`.
- **Hipótesis descartada:** que el nombre `openLocations` explique la diferencia. No hay dato que lo respalde.
- **Decisión:** se muestra como «600 locaciones visibles en la API de 680 declaradas». No se dice nada sobre el motivo.
- **Estado:** Pendiente.

### D15. Fecha de captura

- **Evidencia:** en los campos inspeccionados no hay ninguna fecha de captura. Las únicas fechas son las del evento (`startDate`, `endDate`).
- **Decisión:** la fecha y hora de captura son obligatorias, las indica el autor al subir y nunca se toman del reloj del servidor. Se guarda como `timestamptz` en UTC; la interfaz de carga pide la zona horaria (por defecto la del navegador). La comparación entre snapshots se ordena por esa fecha, nunca por el orden de subida.
- **Estado:** Decisión de diseño sobre un dato ausente.

### D16. Fecha de última actualización en el dashboard

- **Requisito:** el dashboard público muestra la fecha de la última actualización de los datos.
- **Decisión:** se muestra la `captured_at` del snapshot más reciente: la fecha y hora que el autor ingresa al cargar (D15). Nunca se usa la fecha y hora automáticas de la subida (`ingested_at`). Así el lector sabe a qué momento corresponden los números. Se muestra con la zona horaria indicada.
- **Fuente:** `DataState.latestCapturedAt` (sección 13). Si el estado no es `ok`, no se muestra fecha.
- **Estado:** confirmado por el autor.

### D17. Búsqueda con nombres normalizados

- **Evidencia:** se corrió un script sobre los 600 títulos y países, aplicando NFD y quitando las marcas combinadas. Solo quedaron dos caracteres no ASCII: `ı` (U+0131, 5 apariciones, por ejemplo Şanlıurfa) y `’` (U+2019, 1 aparición, en St. John’s). Todo lo demás (Ş, Ç, ô y similares) sí se descompone. Además, Côte d'Ivoire usa apóstrofe recto, así que los datos mezclan ambos tipos.
- **Decisión:** se busca sobre una clave normalizada y los resultados muestran siempre el nombre original con sus caracteres. Una única función `normalizeKey` se aplica al texto escrito y al nombre comparado, para que ambos lados pasen por la misma regla.
- **Regla de normalización, en orden:** (1) minúsculas; (2) NFD y eliminación de marcas combinadas; (3) `ı` → `i`, necesario porque NFD no la descompone: es una letra distinta; (4) se eliminan los apóstrofes (`'`, `’`, `‘`, `ʼ`); (5) cualquier otro signo de puntuación (punto, guion) pasa a espacio; (6) se colapsan los espacios repetidos y se recortan los extremos.
- **Mapa preventivo:** `ł` → `l`, `ø` → `o`, `đ` → `d`, `ß` → `ss`, `æ` → `ae`, `œ` → `oe`. No aparecen en los datos actuales; se incluyen porque una captura futura puede traer locaciones nuevas.
- **Pruebas de referencia:** `Şanlıurfa` → `sanliurfa`; `St. John’s` → `st johns`; `Côte d'Ivoire` → `cote divoire`; `Shebeen El-Kom` → `shebeen el kom`.
- **Estado:** regla Verificada con los datos actuales; el mapa preventivo es una Hipótesis hasta que esas letras aparezcan.

### D18. Paleta de colores centralizada

- **Decisión:** todos los colores de la interfaz (vistas, globo, gráficos, estados de fallo) salen de un único archivo de tokens en `config/theme.ts`. Ningún componente define un color propio: consume un token. Cambiar la paleta es editar un solo punto, sin refactorizar.
- **Motivo:** el dashboard es un producto visual y los ajustes de color serán frecuentes; con colores dispersos, cada ajuste sería una refactorización.
- **Alcance por fases:** desde la Fase 1, para no heredar colores sueltos a las vistas siguientes.
- **Estado:** confirmado por el autor (versión 6).

### D19. Interfaz bilingüe (inglés por defecto)

- **Decisión:** el dashboard y la terminal leen sus textos de diccionarios en inglés (por defecto) y español, con un switcher visible «ENG / ESPA». La preferencia queda recordada en el navegador.
- **Límite:** no hay rutas por idioma (`/en/...`, `/es/...`): el idioma viaja como preferencia, no en la URL, para no interferir con el 404 por modo de la sección 15 ni duplicar las rutas.
- **Alcance por fases:** desde la Fase 1 los textos viven en diccionarios, sin strings sueltos en componentes; el inglés por defecto y el switcher se completan antes del despliegue público (Fase 3). La charla de la Fase 1 puede mostrarse en español.
- **Pendiente:** confirmar si la terminal arranca también en inglés por defecto o en español para el autor (sección 11, pendiente 13).
- **Estado:** confirmado por el autor (versión 6).

### D20. Crédito del desarrollador

- **Decisión:** el pie del dashboard muestra el crédito con enlace a `https://ariellamas.tech`: «Developed by ariellamas.tech» en inglés y «Desarrollado por ariellamas.tech» en español. El texto pasa por los diccionarios de D19 y el color por la paleta de D18.
- **Estado:** confirmado por el autor (versión 6).

## 4. Interfaces (derivadas de los JSON reales)

```ts
// Crudo: solo los campos usados
export type EventType = 'In-Person' | 'Virtual' | 'Virtual & In-Person';

export interface RawLocationEdge {
  cursor: string; // base64 de 'offset:N'
  node: {
    geometry: { coordinates: [lng: number, lat: number] };
    properties: {
      id: string; // opaco
      title: string;
      displayName: string;
      country: string;
      cachedRegistrations: number;
      eventType: EventType;
      registrationEnabled: boolean;
      isRegistrationOpen: boolean;
      isHostEvent: boolean;
      isHybrid: boolean;
      isVirtual: boolean;
      isWaitlist: boolean;
      meta: { htmlUrl: string };
    };
  };
}

export interface RawBlock {
  data: {
    contentFilterForm?: unknown; // se ignora
    event?: {
      cachedEventRegistrations: number;
      cachedLocalEvents: number;
      cachedTeams: number;
      startDate: string;
      endDate: string;
    };
    openLocations?: {
      totalCount: number;
      edges: RawLocationEdge[];
      pageInfo: { endCursor: string; hasNextPage: boolean };
    };
  };
}
export type RawFile = RawBlock[];

// Modelo limpio
export interface LocalEvent {
  externalId: string;
  title: string;
  country: string;
  iso2: string | null;
  lat: number;
  lng: number;
  registrations: number;
  eventType: EventType;
  registrationOpen: boolean;
  isWaitlist: boolean;
  isUniversal: boolean;
  url: string;
}

export interface GlobalStats {
  totalRegistrations: number;
  totalLocalEvents: number;
  teams: number;
}

export interface Snapshot {
  capturedAt: string; // ISO, UTC, indicada por el autor
  events: LocalEvent[];
  global: GlobalStats | null;
  declaredTotal: number; // totalCount
  warnings: string[];
}
```

## 5. Algoritmo de ingesta

1. Leer cada archivo y verificar que sea un array de bloques con `data`. Si no, rechazar ese archivo con el motivo.
2. Clasificar cada bloque por su clave (D1, D2).
3. Reunir todos los edges de `openLocations`, leer el offset de cada cursor y ordenar (D3).
4. Verificar contigüidad de offsets, ausencia de duplicados, `ids únicos = totalCount` y `hasNextPage: false` en la última página (D3, D4).
5. Calcular el sha256 de cada archivo para detectar cargas repetidas.
6. Normalizar: invertir coordenadas, marcar `isUniversal`, asignar `iso2` desde la tabla (D6, D8, D9).
7. Emitir advertencias que no bloquean: país sin mapeo, booleanos que contradicen `eventType`, más de un Universal Event, ids ausentes en el snapshot previo.
8. Mostrar al autor el resumen (archivos detectados, locaciones, total, advertencias) y pedir la fecha de captura.
9. Guardar en una sola transacción. Si ya existe un snapshot con la misma fecha y hora: si los sha256 coinciden, no se hace nada; si difieren, se pide confirmación para reemplazarlo.

## 6. Modelo de datos

El modelo es deliberadamente desnormalizado: cada snapshot guarda todos los atributos de sus locaciones. Con unas 600 filas por snapshot el costo es mínimo, y evita una regla de «gana el último valor» que dependería del orden de subida.

```
snapshots(captured_at TIMESTAMPTZ PRIMARY KEY, note, declared_total,
          total_registrations NULL, total_local_events NULL, teams NULL,
          ingested_at)
snapshot_files(sha256 PRIMARY KEY, captured_at REFERENCES snapshots,
               original_name, offset_start, offset_end, has_event_block)
event_stats(captured_at, external_id, title, country, iso2 NULL, lat, lng,
            registrations, event_type, registration_open, is_waitlist,
            is_universal, url,
            PRIMARY KEY (captured_at, external_id))
country_map(country PRIMARY KEY, iso2, polygon_name)
schema_version(version)
```

No hay ids autoincrementales como llave: la llave natural es la fecha de captura. Así dos reconstrucciones dan filas idénticas. La lista de locaciones y de países es una vista sobre `event_stats`.

## 7. Métricas y rankings

Un ranking se define combinando tres ejes:

- **Métrica:** total de inscritos, cantidad de locaciones, promedio y mediana (la mediana evita que pocas locaciones enormes distorsionen).
- **Filtro:** tipo de locación (In-Person, Virtual, Virtual & In-Person), país, estado de inscripción, lista de espera.
- **Alcance:** global, por país, o por locación dentro de un país.

Reglas: el Universal Event queda fuera de todo ranking por país y del globo, y se muestra en una tarjeta propia. Las locaciones con 0 inscritos cuentan en el conteo de locaciones. Las cifras derivadas llevan etiqueta.

**Evolución entre fechas:** para cada variable se muestra el cambio absoluto entre dos snapshots consecutivos ordenados por `captured_at` y el cambio por día (cambio dividido entre las horas transcurridas por 24), porque los intervalos serán irregulares. Una cifra puede bajar. Las locaciones que aparecen o desaparecen entre capturas se listan por separado, comparando por `external_id`.

## 8. Valores de referencia para pruebas

Con a.json y b.json actuales, el sistema debe producir exactamente esto. Sirve como prueba de regresión ante cualquier refactorización.

- 600 locaciones únicas; 599 sin el Universal Event; 115 países más `Anywhere in the World`.
- Suma de `cachedRegistrations`: 104.784 (89.956 sin el Universal Event).
- Por tipo: In-Person 235 locaciones y 27.979 inscritos; Virtual 119 locaciones (118 sin Universal) y 27.714 inscritos (12.886 sin Universal); Virtual & In-Person 246 locaciones y 49.091 inscritos.
- 4 locaciones con 0 inscritos.
- Global: `cachedEventRegistrations` 124.934, `cachedLocalEvents` 680, `cachedTeams` 17.794. Derivado: 20.150.
- Locaciones por país: India 72, United States 55, Brazil 44, Turkey 28, Mexico 25, Egypt 16, Canada 16, Argentina 16, Peru 15, Colombia 13.
- Top de locaciones por inscritos (sin Universal Event): Cairo 3.474, Harohalli 2.364, Dhaka 2.022, Ankara 1.343, Chennai 1.255, Delhi 1.240, Shebeen El-Kom 988, Karachi 979, Tashkent 947.
- Salta: 112 inscritos, Virtual & In-Person, coordenadas `[-65.4231976, -24.7821269]`.

## 9. Reconstrucción de la DB

Regla de diseño: todo lo que está en la DB debe poder regenerarse a partir de los JSON crudos más su fecha de captura. Por eso no se guarda ningún dato que no salga de ahí.

- **Reconstruir:** vaciar las tablas y volver a cargar cada grupo de archivos con su fecha. El orden de carga no importa, porque todo se ordena por `captured_at`.
- **Manifiesto opcional:** un archivo `manifest.json` junto a los crudos, con la lista `{ capturedAt, files, note }`. El admin puede ofrecer una carga masiva que lo lea. Sin él, se sube cada snapshot a mano.
- **Idempotencia:** cargar dos veces lo mismo no cambia nada (sha256 y fecha, paso 9 del algoritmo).
- **Criterio de aceptación:** cargar los mismos snapshots en dos órdenes distintos debe producir tablas idénticas, salvo `ingested_at`.
- **Respaldo:** `country_map` es el único dato escrito a mano; debe versionarse en el repositorio.

## 10. Hipótesis y afirmaciones retractadas

- Se afirmó que el máximo de 14.828 era «casi seguro un evento virtual». Era una suposición; luego se confirmó (D8).
- Se sugirió que el nombre `openLocations` explicaba las 80 locaciones faltantes. Es una hipótesis sin respaldo (D14).
- Se había propuesto agrupar inscritos por «ciudad». El JSON no tiene ese campo (D10).
- Se había planteado un ranking de «participantes virtuales vs presenciales». Los datos solo permiten hacerlo por tipo de locación (D11).
- Se afirmó que normalizar con NFD alcanzaba para que «sanliurfa» encontrara «Şanlıurfa». Es incorrecto: la ı sin punto no se descompone y necesita un mapa explícito (D17).

## 11. Pendientes de verificación

1. Estabilidad de `external_id`: verificada en una muestra de un id contra un JSON de la semana anterior. Falta la intersección completa de ids al cargarlo como segundo snapshot.
2. Fecha y hora exactas de captura del JSON de la semana anterior, y si tiene la misma estructura que a.json y b.json (la fecha no viene en el archivo, D15).
3. Coordenadas del Universal Event.
4. Si `isVirtual` e `isHybrid` son siempre coherentes con `eventType`.
5. Por qué hay 680 locaciones declaradas y solo 600 en el JSON.
6. Si el bloque `event` aparece siempre en el primer archivo.
7. Si las dos cifras en caché de D13 se refrescan al mismo tiempo.
8. Estabilidad de los nombres de país entre capturas.
9. Decisiones abiertas de la sección 14: niveles de detalle, formatos y si la exportación se puede acotar.
10. Comprobar en Neon la creación de un rol de solo lectura (sección 15 y Fase 2). Desde la versión 6 no hay base de desarrollo separada ni ramas: el desarrollo local se conecta directamente a la base de Neon en la nube.
11. Comprobar que el plan de Vercel permite dos proyectos sobre el mismo repositorio (Fase 3).
12. Confirmar con el autor si la Fase 1 necesita una URL pública antes de la Fase 3.
13. Confirmar si la terminal de carga arranca en inglés por defecto, igual que el dashboard, o en español para el autor (D19).

## 12. Esquema de desarrollo por fases

Cada fase se puede dar por terminada sin las siguientes. La Fase 1 ya cubre la charla; las demás agregan base de datos, nube y evolución. Quien construye usa este documento, el brief conceptual y los valores de referencia de la sección 8 como criterio de aceptación.

### Fase 1: prueba de concepto sin base de datos (local)

- **Objetivo:** demostrar que a.json y b.json producen las estadísticas correctas.
- **Alcance:** módulo `domain` (parseo, detección de archivos, validación, `normalizeKey`, estadísticas) con pruebas; un `SnapshotReader` que lee los dos JSON y el manifiesto de `/fixtures` (la fecha de captura sale del manifiesto); la vista `/dashboard` con globo, buscador, rankings por métrica, filtro y alcance, tarjetas (Universal Event, inscritos sin local event derivado, 600 de 680 locaciones) y fecha de última actualización; los estados de la sección 13 aplicados a archivos ausentes; los colores consumen la paleta centralizada y los textos viven en diccionarios, para no heredar colores ni strings sueltos a las fases siguientes (D18, D19).
- **Fuera de alcance:** base de datos, terminal de carga, evolución.
- **Criterios de aceptación:** los valores de la sección 8 salen exactos; buscar `sanliurfa` encuentra Şanlıurfa y muestra el nombre original; el Universal Event no aparece en el globo ni en los rankings por país; sin los archivos, el dashboard muestra «aún no hay datos cargados» sin error.
- **Opcional:** si la charla necesita una URL pública antes de la Fase 3, se despliega esta fase en modo `dashboard` con los JSON empaquetados. Lo decide el autor con quien construye.

### Fase 2: terminal de carga en local, base de datos en Neon (nube)

- **Objetivo:** probar el ciclo completo cargar, guardar y leer.
- **Alcance:** `APP_MODE` y las rutas `/dashboard` y `/terminal` (sección 15); migraciones y esquema de la sección 6 aplicados directamente sobre la base de Neon en la nube, la misma que usará producción: la terminal se desarrolla en local, pero no hay base de desarrollo separada ni ramas, porque la DB es descartable y reconstruible (sección 9); `SnapshotReader` y `SnapshotWriter` sobre Neon con `DATA_SOURCE=db`; la terminal con subida de archivos, detección y validación en el navegador, fecha obligatoria con zona horaria, resumen previo y confirmación para reemplazar; los cinco estados de la sección 13 con la DB real, con el reintento automático previsto, relevante porque cada consulta sale hacia la nube.
- **Criterios de aceptación:** cargar a.json y b.json con una fecha muestra en el dashboard los mismos valores que la Fase 1; vaciar la DB y volver a cargar deja tablas idénticas (salvo `ingested_at`); cargar los mismos snapshots en dos órdenes distintos deja tablas idénticas; subir solo b.json se rechaza e indica que faltan locaciones; misma fecha con archivos idénticos no cambia nada; misma fecha con archivos distintos pide confirmación; cargar el JSON de la semana pasada como segundo snapshot informa la intersección de ids (cierra el pendiente 1); sin variable de conexión, con base vacía, sin esquema y sin conexión se muestra el aviso correspondiente.

### Fase 3: despliegue en la nube

- **Objetivo:** que el dashboard público y la terminal funcionen en Vercel sobre la misma DB.
- **Alcance:** dos proyectos de Vercel sobre el mismo repositorio; las variables de la sección 15; el rol de solo lectura en Neon; `TERMINAL_TOKEN`; el switcher de idioma con inglés por defecto y el crédito del desarrollador en el pie del dashboard (D19, D20).
- **Orden del primer despliegue:** crear la DB y los roles; aplicar migraciones; desplegar la terminal con sus variables; cargar capturas desde la nube; desplegar el dashboard con `APP_MODE=dashboard` y solo la cadena de lectura.
- **Criterios de aceptación:** las pruebas de la sección 15; el dashboard público muestra lo cargado desde la terminal en la nube; un despliegue sin variables muestra el aviso «sin configuración» y nombra la variable que falta; el dashboard abre en inglés por defecto y el switcher cambia a español; el pie muestra el crédito con enlace a ariellamas.tech.

### Fase 4: evolución y exportación

- **Alcance:** gráficos de evolución, comparación entre capturas (cambio absoluto y por día, altas y bajas), carga masiva con manifiesto y exportación del historial en la terminal. Antes hay que cerrar las decisiones abiertas de la sección 14.
- **Criterios de aceptación:** con dos o más capturas, los cambios coinciden con un cálculo manual hecho sobre los JSON de las dos fechas; las capturas cargadas en cualquier orden dan el mismo gráfico; la exportación existe solo en `/terminal` y responde 404 en el despliegue del dashboard.

### Más adelante

Actualización automática desde la API oficial, que se agrega como una fuente más de snapshots sin cambiar el modelo.

## 13. Estados de fallo y fallback

El sistema no se rompe cuando falta información: distingue cinco situaciones y muestra un aviso que dice cuál es, para que el autor pueda diagnosticar el problema, por ejemplo en el primer despliegue.

| Estado | Cómo se detecta | Qué muestra el dashboard | Qué ve el admin |
| --- | --- | --- | --- |
| Sin configuración | Falta la variable de entorno con la conexión a la DB | «La base de datos no está configurada» | «Falta configurar la conexión a la DB», útil en el primer despliegue |
| Sin conexión | Falla la conexión o se supera el tiempo de espera | «No se pudo conectar con la base de datos», con botón de reintento | Motivo resumido (tiempo de espera, conexión rechazada o desconocido); los archivos ya validados se conservan en el navegador para reintentar el envío |
| Base sin inicializar | Conexión correcta, pero las tablas no existen (código `42P01`, undefined\_table, de Postgres) o `schema_version` no coincide | «La base está conectada pero no tiene el esquema esperado» | «El esquema no está creado o no coincide» |
| Base vacía | Conexión correcta y la tabla `snapshots` sin filas | «Conectado correctamente, pero aún no hay datos cargados» | «La DB está vacía», con acceso a la carga y a la carga masiva con manifiesto |
| Un solo snapshot | Hay una fila en `snapshots` | Todo funciona salvo la evolución: «Se necesitan al menos dos capturas para ver cambios» | Igual |

Reglas de implementación:

- Una sola función de acceso a datos devuelve un estado y no lanza excepciones a la interfaz. La interfaz solo decide qué mostrar según ese estado.
- Antes de declarar «sin conexión» se hace un reintento automático, porque una base en reposo puede tardar más de lo normal en responder la primera consulta (comprobar el comportamiento con el plan de Neon en uso).
- Verificar cómo expone el driver elegido el código de error `42P01` antes de depender de él.
- En la Fase 1 (archivos locales) rige la misma tabla: si faltan a.json o b.json se muestra el estado vacío, no un error.
- **Decisión:** no existe una «última versión conocida». El dashboard no almacena datos propios y la DB es su única fuente, así que cuando no responde solo se muestra el aviso del estado correspondiente.
- Los avisos nombran la categoría del problema y nunca exponen la cadena de conexión ni credenciales; el detalle técnico va a los logs del servidor.

```ts
export type DataState =
  | { status: 'ok'; snapshots: number; latestCapturedAt: string }
  | { status: 'unconfigured' }
  | { status: 'unavailable'; reason: 'timeout' | 'connection' | 'unknown' }
  | { status: 'uninitialized'; detail?: string }
  | { status: 'empty' };
```

## 14. Exportación del historial (en exploración)

Una decisión está tomada (la exportación vive solo en el panel de carga privado); el resto sigue abierto.

Son dos cosas distintas que no deben mezclarse:

- **Exportación de análisis:** el historial de cambios de inscritos en el tiempo, para abrirlo en una hoja de cálculo o graficarlo fuera del sistema. Es un dato derivado de la DB, no una fuente de verdad.
- **Respaldo para reconstruir:** ya lo cubren los JSON crudos y el manifiesto (sección 9). Una variante a evaluar es exportar un snapshot ya normalizado y reimportable; ahorraría el parseo, pero crea una segunda fuente de verdad que puede divergir de los crudos. Solo tendría sentido si los crudos pudieran perderse.

**Niveles de detalle posibles.** Las filas son un ejemplo con 30 capturas.

| Nivel | Columnas principales | Filas (30 capturas) |
| --- | --- | --- |
| Global | captured\_at, total\_registrations, total\_local\_events, teams, derivado sin local event, inscritos del Universal Event, variación y variación por día | 30 |
| País | captured\_at, country, iso2, locations, registrations, avg, median, variación y variación por día | unas 3.450 (115 países) |
| Locación | captured\_at, external\_id, title, country, event\_type, registrations, variación y variación por día | unas 18.000 |
| Altas y bajas | captured\_at, external\_id, title, country, tipo de cambio (apareció o desapareció) | variable |

**Formatos a comparar.**

- **CSV:** abre en cualquier herramienta. Dos puntos a comprobar con el Excel del autor: la codificación (UTF-8 con BOM para que se vean bien nombres como Şanlıurfa o Çorum) y el separador, porque Excel configurado en español suele esperar punto y coma.
- **JSON:** para uso programático; admite estructura anidada.
- **XLSX:** una hoja por nivel; es el más cómodo para quien no programa, pero exige una librería adicional.

**Propuestas sujetas a confirmación.**

- Las variaciones se incluyen ya calculadas; la primera captura queda con la variación vacía.
- El Universal Event no se excluye del historial exportado: va marcado con una columna `is_universal`. La exclusión es una regla de los rankings, no de los datos.
- Con estos volúmenes (decenas de miles de filas) la exportación se puede generar de una vez en el servidor, sin paginar.

**Decisión tomada.** La exportación solo existe en el panel de carga (privado, solo para el autor). El dashboard público no la ofrece, así que no hay una descarga pública que proteger ni limitar.

**Decisiones abiertas.**

1. Qué niveles de detalle se ofrecen.
2. Qué formatos.
3. Si el panel permite acotar la exportación (por país, tipo de locación o rango de fechas) o siempre entrega todo.

## 15. Un proyecto, dos vistas

Un solo repositorio contiene el dashboard y la terminal de carga. La variable `APP_MODE` define qué vista se habilita en cada despliegue. En local se habilitan las dos, en `localhost:3000/dashboard` y `localhost:3000/terminal`.

| Modo | `/dashboard` | `/terminal` y APIs de escritura |
| --- | --- | --- |
| `dashboard` | Habilitado | Responde 404 |
| `terminal` | Habilitado (en el despliegue de la terminal no importa que se pueda acceder) | Habilitado, con token |
| `all` | Habilitado | Habilitado (solo para desarrollo local) |

Variables de entorno. Se leen solo en el servidor y ninguna llega al navegador.

| Variable | Valores | Dónde se define | Para qué |
| --- | --- | --- | --- |
| `APP_MODE` | `dashboard`, `terminal`, `all` | Cada despliegue | Qué vistas se habilitan |
| `DATA_SOURCE` | `fixtures`, `db` | Local y despliegues | Origen de los datos: archivos de `/fixtures` (Fase 1) o Neon |
| `DATABASE_URL_READ` | Cadena de conexión de solo lectura | Todos los despliegues | Lectura de la DB |
| `DATABASE_URL_WRITE` | Cadena de conexión con escritura | Solo el despliegue de la terminal y local | Guardar capturas |
| `TERMINAL_TOKEN` | Secreto | Solo el despliegue de la terminal y local | Acceso a la terminal |

Reglas:

- Un único módulo `config/appMode` lee y valida las variables. El resto del código consulta `canUseDashboard()` y `canUseTerminal()`, nunca la variable directamente.
- Si `APP_MODE` falta o tiene un valor desconocido en producción, el estado es `unconfigured` (sección 13) y ninguna vista de escritura queda habilitada. `all` en producción se trata como configuración inválida.
- El aviso de «sin configuración» nombra la variable que falta, nunca su valor.
- `/` redirige a la vista habilitada (confirmado por el autor en la versión 6).
- Cuando el modo no habilita la terminal, toda ruta bajo `/terminal` y toda API de escritura responde 404 y no 403, para no revelar que existe.

Defensa en profundidad. Es una propuesta: ocultar la vista no es una barrera de seguridad por sí sola.

1. 404 por modo, como se describe arriba.
2. El despliegue del dashboard no recibe `DATABASE_URL_WRITE`: aunque hubiera un error en una ruta, no podría escribir.
3. `DATABASE_URL_READ` usa un rol de Neon con permiso solo de lectura.
4. La terminal exige `TERMINAL_TOKEN`.

**Despliegue en Vercel:** dos proyectos sobre el mismo repositorio, cada uno con sus variables. Estado: decisión de diseño; faltan por comprobar el rol de solo lectura en Neon y que el plan de Vercel permita dos proyectos sobre un repositorio (sección 11).

**Pruebas de aceptación:**

- Con `APP_MODE=dashboard`, un GET a `/terminal` y un POST a la API de carga responden 404.
- Con `APP_MODE=terminal` y sin token válido, la terminal rechaza el acceso y la API no escribe.
- Con `APP_MODE` ausente en producción, el dashboard muestra el aviso de «sin configuración» con el nombre de la variable.
- Un GET a `/` redirige a la vista habilitada según el modo (regla de esta sección, confirmada por el autor en la versión 6).
- Con `APP_MODE=all` en local, `/dashboard` y `/terminal` responden las dos.

## 16. Estructura del código y contratos

Tecnología fijada en la versión 6, confirmada por el autor: Next.js para las rutas `/dashboard` y `/terminal`; el globo se resuelve sobre three.js mediante la librería más adecuada — react-globe.gl, un envoltorio de React sobre three.js, es la propuesta concreta, y solo un motivo concreto hallado en la Fase 1 justificaría bajar a three.js puro; Recharts para los gráficos; Neon como base. Cualquier reemplazo puntual es válido si respeta las secciones 15 y 16.

```
/src
  /domain     puro, sin I/O: tipos, parseo, detección de archivos, validación,
              normalizeKey, estadísticas, comparación entre capturas
  /data       getDataState, SnapshotReader (fixtures y Neon), SnapshotWriter (Neon)
  /config     appMode: lee y valida las variables de entorno
              theme.ts: paleta de colores centralizada, única fuente de color (D18)
  /i18n       diccionarios en inglés (por defecto) y español, y el switcher (D19)
  /routes     /dashboard, /terminal, API de carga y exportación
/fixtures     a.json, b.json y manifest.json (fechas de captura)
/migrations   esquema de la sección 6
```

Principios:

- `domain` no hace I/O y se prueba solo con los fixtures. El mismo parser corre en el navegador de la terminal y en las pruebas.
- El dashboard solo habla con `SnapshotReader`. Pasar de archivos a Neon (de la Fase 1 a la 2) no cambia ninguna vista.
- Solo `SnapshotWriter` escribe, y únicamente se instancia cuando `canUseTerminal()` es verdadero.
- En la Fase 1, `fixtures/manifest.json` aporta la fecha de captura con el formato del manifiesto de la sección 9: `{ capturedAt, files, note }`.
- Ninguna interfaz escribe un color suelto: la paleta vive en `config/theme.ts` y de allí salen los colores de la interfaz, del globo y de los gráficos (D18). Ajustar la paleta es tocar un único punto.
- Ningún texto de interfaz va incrustado en componentes: vive en los diccionarios de `/i18n`. Inglés por defecto, switcher a español, preferencia recordada en el navegador y sin rutas por idioma (D19).

```ts
export type AppMode = 'dashboard' | 'terminal' | 'all';

export interface SnapshotReader {
  getState(): Promise<DataState>;
  listSnapshots(): Promise<{ capturedAt: string; totalRegistrations: number | null }[]>;
  getSnapshot(capturedAt: string): Promise<Snapshot>;
}

export interface FileRecord {
  sha256: string;
  originalName: string;
  hasEventBlock: boolean;
  offsetStart: number;
  offsetEnd: number;
}

export interface SnapshotWriter {
  // 'needs_confirmation': misma capturedAt con archivos distintos y replace = false
  save(
    snapshot: Snapshot,
    files: FileRecord[],
    opts: { replace: boolean }
  ): Promise<'saved' | 'unchanged' | 'needs_confirmation'>;
  remove(capturedAt: string): Promise<void>;
}
```

## 17. Historial de cambios del documento

Versión 2:

- Se midió el peso de los JSON (666 KB y 126 KB). Queda resuelto el pendiente de tamaño y la decisión de parsear en el navegador pasa a justificarse por la vista previa, no por el límite de Vercel.
- Se verificó la estabilidad del `id` en una muestra de un id contra un JSON de la semana anterior (D5). Falta la intersección completa.
- Existe un JSON de la semana anterior que puede cargarse como segundo snapshot; falta confirmar su fecha y hora de captura.
- Nueva sección 13 (estados de fallo y fallback) y nueva sección 14 (exportación del historial, en exploración).
- Se actualizaron las secciones 11 (pendientes) y 12 (fases).

Versión 3:

- La exportación del historial queda solo en el panel de carga privado (sección 14).
- Se descarta la «última versión conocida» porque el dashboard no almacena datos; se agrega el estado «sin configuración» y los avisos indican la categoría del problema (sección 13).
- Nuevas decisiones D16 (fecha de última actualización) y D17 (búsqueda con nombres normalizados).
- Corrección en la sección 10: NFD por sí solo no alcanza para la ı sin punto.

Versión 4:

- D16 confirmada por el autor: la última actualización es la fecha y hora que ingresa el usuario, no la de subida.
- D17 ajustada con los datos reales: solo `ı` y el apóstrofe tipográfico `’` necesitan tratamiento; se definió cómo tratar apóstrofes y puntuación y se agregaron pruebas de referencia.
- Se cerraron los pendientes 10 y 11 de la sección 11.

Versión 5:

- La arquitectura pasa de dos aplicaciones a un solo proyecto con dos vistas, gobernadas por la variable `APP_MODE` (sección 15).
- Nueva sección 16: estructura del código y contratos entre módulos.
- La sección 12 pasa a ser el esquema de desarrollo por fases, con alcance y criterios de aceptación.
- Nuevos pendientes 10 a 12 en la sección 11.
- El historial de cambios pasa a ser la sección 17.

Versión 6:

- Fase 2 corregida: la terminal se desarrolla en local, pero la base de datos es directamente la de Neon en la nube, la misma de producción; se descartan la base de desarrollo separada y las ramas, apoyándose en que la DB es descartable y reconstruible (sección 9). Pendiente 10 actualizado.
- Regla «`/` redirige a la vista habilitada» confirmada por el autor; entran como pruebas de aceptación el redirect de `/` y el modo `all` en local (sección 15).
- Tecnología fijada: Next.js; globo sobre three.js con react-globe.gl como propuesta concreta; Recharts; Neon (sección 16).
- Nueva D18: paleta de colores centralizada en un único archivo (secciones 3 y 16).
- Nueva D19: interfaz bilingüe con switcher «ENG / ESPA», inglés por defecto, sin rutas por idioma (secciones 3 y 16).
- Nueva D20: crédito del desarrollador con enlace a ariellamas.tech en el pie del dashboard (sección 3).
- Nuevo pendiente 13: idioma por defecto de la terminal de carga.
