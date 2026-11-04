# Brief conceptual: Dashboard de Local Events (NASA Space Apps 2026)

El sistema convierte los JSON que entrega la plataforma oficial de NASA Space Apps en estadísticas, rankings, un globo de locaciones y un historial de inscritos, para mostrarlos en una charla del autor como local lead. Este documento explica qué debe hacer y por qué; la evidencia y los detalles de implementación están en el brief técnico.

## 1. Problema y objetivo

- **Situación:** el autor necesita mostrar, en una charla en dos días, cuántos inscritos y cuántas locaciones hay por país y cómo evolucionan.
- **Fuente:** la plataforma oficial. Se intentó obtener los datos automáticamente en tiempo real y se dejó de lado, porque consumía esfuerzo sin acercar a las estadísticas. Los datos se obtienen a mano, como archivos JSON, desde la red del navegador.
- **Objetivo:** que el sistema trabaje con esos archivos tal como salen de la plataforma, sin prepararlos ni modificarlos, y que sea fácil sumar capturas nuevas con el paso de los días.
- **Mejora posterior:** la actualización automática desde la API oficial se agregaría como una fuente más de capturas, sin cambiar el modelo.

## 2. Quiénes lo usan

- **Autor (privado):** sube los archivos, indica la fecha de cada captura, revisa la validación y exporta el historial. Es la única persona con acceso a la terminal de carga.
- **Lector (público):** ve el dashboard en modo lectura. No sube ni descarga nada.

Es un solo proyecto con dos vistas que comparten una base de datos: la terminal de carga escribe y el dashboard solo lee. Una variable de entorno decide, en cada despliegue, qué vista queda habilitada: en local se prueban las dos y en la nube cada despliegue muestra una sola, con la otra inhabilitada (detalle en el brief técnico, sección 15).

## 3. Cómo entra la información

1. El autor sube los archivos de una captura. Hoy son dos, porque la plataforma entrega las locaciones en páginas de 500 y hay 600.
2. Indica la fecha y hora de la captura. Es obligatoria y manual; el sistema nunca la toma del reloj.
3. El sistema reconoce qué es cada archivo por su contenido y no por el nombre, el tamaño ni el orden: un archivo trae las cifras globales del evento junto con locaciones, y el otro solo locaciones.
4. Valida que la captura esté completa: las locaciones únicas deben coincidir con el total que declaran los archivos. Si falta algo, rechaza la carga y dice qué falta.
5. Muestra un resumen y guarda.

Reglas de la carga:

- El orden de subida no importa; importa la fecha. Se pueden cargar muchas capturas, en cualquier orden.
- Misma fecha y hora con archivos idénticos: no pasa nada. Con archivos distintos: pide confirmación antes de reemplazar.
- Una captura es «N archivos más una fecha». Si las locaciones llegaran a superar 1.000, serían tres archivos y el sistema lo tolera.
- La base de datos es descartable: si se borra, se reconstruye subiendo de nuevo los JSON con sus fechas. Por eso el autor conserva siempre los archivos originales.

## 4. Qué muestra el dashboard

- **Globo:** un planeta simplificado con continentes y un marcador por locación, con el tamaño según los inscritos.
- **Buscador:** por nombre de locación o por país. Ignora acentos y mayúsculas, muestra el nombre original y centra el globo en el resultado.
- **Rankings:** se describen abajo.
- **Evolución:** cómo cambian los inscritos entre capturas.
- **Tarjetas aparte:** el Universal Event, los inscritos sin local event (derivado) y las locaciones visibles frente a las declaradas.
- **Fecha de última actualización:** siempre visible; es la fecha y hora de captura que ingresó el autor.
- **Idioma:** la interfaz es bilingüe, inglés por defecto, con un switcher a español; la preferencia queda recordada en el navegador.
- **Pie de página:** crédito del desarrollador con enlace, ariellamas.tech.

### Rankings

Un ranking combina una métrica, un filtro y un alcance.

| Eje | Opciones |
| --- | --- |
| Métrica | Total de inscritos, cantidad de locaciones, promedio de inscritos y mediana de inscritos |
| Filtro | Tipo de locación (presencial, virtual o híbrida), país, inscripción abierta o cerrada, lista de espera |
| Alcance | Global (países entre sí) o dentro de un país (sus locaciones entre sí) |

Preguntas que debe poder contestar: qué país tiene más inscritos en locaciones virtuales, en presenciales o en total; el ranking de países a nivel global; el ranking de locaciones dentro de un país; el promedio de inscritos por país; y la cantidad de locaciones de un país dado.

Limitación importante: «virtual» y «presencial» se miden por el tipo de la locación, no por persona. Los archivos no separan a las personas virtuales de las presenciales dentro de una locación híbrida, por eso las híbridas (hoy 246 de 600) son una categoría propia.

### Evolución

- Un gráfico de inscritos por captura, a nivel global, por país o por locación.
- Para cada par de capturas consecutivas, el cambio absoluto y el cambio por día. Se ordenan por la fecha que indicó el autor, nunca por el orden de subida, y los intervalos pueden ser irregulares.
- Una cifra puede bajar, y el sistema lo muestra tal cual.
- Las locaciones que aparecen o desaparecen entre capturas se listan aparte.
- Con una sola captura se muestra un aviso en lugar del gráfico.

## 5. Definiciones

| Término | Qué significa |
| --- | --- |
| Locación (local event) | Cada entrada de la lista de la plataforma. Tiene nombre y país; no existe el dato de ciudad. |
| Inscritos de una locación | La cifra que la plataforma muestra para esa locación en el momento de la captura. Puede ir algo retrasada respecto a la realidad. |
| Tipo de locación | Presencial, virtual o híbrida (en los archivos, «Virtual & In-Person»). |
| Universal Event | Pseudo-locación virtual, con país «Anywhere in the World». No es un país. En la captura actual tiene 14.828 inscritos. |
| Inscritos globales | Total de inscritos del evento que publica la plataforma. En la captura actual, 124.934. |
| Inscritos sin local event (derivado) | Total global menos la suma de inscritos de las locaciones visibles. En la captura actual, 20.150. |
| Captura | Conjunto de archivos con una fecha y hora indicadas por el autor. |
| Última actualización | Fecha y hora de la captura más reciente, la que ingresó el autor. |

## 6. Reglas de negocio

- El Universal Event nunca entra en los rankings por país, ni en promedios o medianas, ni en el globo. Se muestra en una tarjeta propia.
- Todo promedio va acompañado de la mediana, porque unas pocas locaciones muy grandes distorsionan el promedio.
- Las locaciones con 0 inscritos cuentan en el conteo de locaciones (hoy son 4).
- Las cifras derivadas llevan siempre la etiqueta «derivado». La de inscritos sin local event depende de que los 80 locaciones que la plataforma declara y no llegan en los archivos (680 declaradas frente a 600 recibidas) no sumen inscritos, y de que ambas cifras se hayan actualizado a la vez. Ninguna de las dos cosas está comprobada.
- Se muestra «600 locaciones visibles de 680 declaradas», sin explicar el motivo, porque no se conoce.
- La búsqueda usa nombres normalizados: «sanliurfa» encuentra «Şanlıurfa», pero el resultado muestra el nombre con sus caracteres originales.
- Los países se muestran con el nombre en inglés de la plataforma. Una tabla de correspondencia manual los ubica en el globo.

## 7. Qué pasa cuando algo falla

El sistema no se rompe: muestra un aviso que dice qué ocurre, para que el autor pueda diagnosticarlo, por ejemplo en el primer despliegue.

- **Sin configuración:** falta la conexión a la base de datos, o falta la variable que define el modo del despliegue.
- **Sin conexión:** no se pudo conectar o se agotó el tiempo de espera.
- **Base sin esquema:** se conectó, pero las tablas no existen o no coinciden.
- **Base vacía:** se conectó correctamente, pero aún no hay datos cargados.
- **Una sola captura:** todo funciona salvo la evolución, que pide al menos dos capturas.

No existe una «última versión conocida»: el dashboard no guarda datos propios, así que la base de datos es su única fuente. Los avisos nunca exponen la cadena de conexión ni credenciales.

## 8. Exportación del historial

El autor podrá exportar a un archivo el historial de cambios de inscritos en el tiempo. La opción existe solo en la terminal de carga (privada); el dashboard público no la ofrece. Siguen abiertos qué niveles de detalle incluir (global, país, locación, altas y bajas), en qué formatos y si se puede acotar la exportación. La exploración está en el brief técnico, sección 14.

## 9. Alcance por fases

El desarrollo avanza en fases, y cada fase termina con una prueba que se puede dar por cerrada sin las siguientes. El sistema es un solo proyecto con dos vistas (`/dashboard` y `/terminal`); una variable de entorno decide qué vista se habilita en cada despliegue: en local se prueban las dos (`localhost:3000/dashboard` y `localhost:3000/terminal`) y en la nube cada despliegue muestra una sola. Los alcances y criterios de aceptación de cada fase están en el brief técnico, sección 12.

- **Fase 1 (charla en dos días):** prueba de concepto sin base de datos: leer los dos JSON actuales desde archivos locales y comprobar que producen las estadísticas exactas. Globo, buscador, rankings y tarjetas.
- **Fase 2:** terminal de carga desarrollada en local, con la base de datos directamente en Neon (nube): probar el ciclo completo de cargar (fecha obligatoria y validación), guardar y leer. Primera prueba real: cargar el JSON de la semana pasada como segunda captura.
- **Fase 3:** la nube: el mismo proyecto se despliega en la nube; el dashboard público y la terminal de carga son dos despliegues sobre la misma base de datos, cada uno con su variable de modo.
- **Fase 4:** gráficos de evolución, comparación entre capturas, carga masiva con manifiesto y exportación del historial.
- **Más adelante:** actualización automática desde la API oficial.

**Fuera de alcance por ahora:** obtener datos en vivo; separar personas virtuales y presenciales dentro de una locación híbrida; agrupar por ciudad (el dato no existe); explicar por qué faltan 80 locaciones.

## 10. Preguntas abiertas

1. Niveles de detalle, formatos y filtros de la exportación del historial.
2. Fecha y hora exactas de captura del JSON de la semana pasada, necesarias para cargarlo como segunda captura.
3. Si el JSON de la semana pasada tiene la misma estructura que los dos actuales.
