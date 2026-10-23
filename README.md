# Coem

Coem reúne cuentos y poemas clásicos breves en español para leerlos, escucharlos y descubrir conexiones literarias mediante embeddings semánticos.

La aplicación está publicada con GitHub Pages en **[estevefact.github.io](https://estevefact.github.io/)**. No requiere cuenta, servidor ni instalación.

## Explorar

- [Inicio](https://estevefact.github.io/)
- [Lector de cuentos](https://estevefact.github.io/stories-info.html)
- [Lector de poemas](https://estevefact.github.io/poems-info.html)
- [Literary Guesser / Oráculo literario](https://estevefact.github.io/literary-guesser.html)
- [Proyector de embeddings](https://estevefact.github.io/embeddings.html)
- [Mapa de autores](https://estevefact.github.io/authorToAuthor3DSmall.html)

Los lectores funcionan en móvil y escritorio. Incluyen:

- recomendaciones calculadas desde los embeddings de TensorFlow, con autor, país, duración y puntuación de similitud;
- enlaces directos a cada obra mediante `?story=<uuid>` o `?poem=<uuid>`;
- búsqueda global por título, autor, país, género o año, incluso mezclando varios términos;
- filtros combinables de país, género y duración para buscar o usar «Sorpréndeme»;
- «Sorpréndeme» respeta simultáneamente texto, país, género y duración; los
  cuentos con país o género `Unknown` siguen participando y pueden filtrarse;
- modo oscuro y tamaño de texto ajustable;
- guardados e historial local en el navegador;
- compartir mediante el menú nativo del dispositivo o copiando el enlace;
- retratos animados con p5 al cambiar de obra;
- narración de cuentos cuando el audio está disponible. Los poemas no incluyen audio.
- navegación automática al inicio de la nueva obra, con foco accesible y anuncio para lectores de pantalla;
- autores relacionados calculados desde los embeddings de sus cuentos, sin recomendaciones aleatorias;
- similitud porcentual entre autores acompañada de país, género y año de nacimiento, y similitud porcentual entre cuentos;
- indicador visual de la obra actual dentro de la lista del autor;
- menú principal compartido entre cuentos, poemas, mapa de autores y embeddings.

Los guardados, el historial y las preferencias se almacenan únicamente en `localStorage`; no salen del dispositivo.

Al abrir el lector de cuentos sin un parámetro `?story=`, se elige un cuento
aleatorio nuevo. Un enlace directo válido conserva siempre el cuento solicitado.

## Inicio rápido de los lectores

El primer texto y la información del autor tienen prioridad sobre las funciones
secundarias:

- Los poemas arrancan desde `static/poemStartupPool.json`: un conjunto compacto
  de 384 autores y poemas que pesa unos 160 KB. Cada visita elige uno al azar y
  solicita inmediatamente su pequeño archivo de texto.
- El catálogo completo de poemas (8,5 MB), los vecinos de poemas (7,9 MB) y sus
  índices auxiliares se descargan sólo después de mostrar el poema y el autor.
- Los cuentos usan `static/storyReaderCatalog.json`, un catálogo de inicio de
  unos 220 KB en lugar del grafo completo de 416 KB.
- Los índices semánticos de cuentos, sus metadatos y autores relacionados también
  se hidratan después de mostrar el cuento.
- p5 ya no bloquea el lector desde una CDN: primero aparece el retrato normal y,
  cuando la librería termina de cargar en segundo plano, comienza la animación de
  dibujo.
- Búsqueda, filtros y «Sorpréndeme» se habilitan al terminar esa hidratación para
  evitar resultados parciales. Tema, tipografía, guardados y lectura permanecen
  disponibles desde el primer render.

Esta separación mantiene todas las funciones, pero reduce el camino crítico del
poema de unos 18,5 MB a unos 160 KB más el texto elegido. El cuento necesita unos
220 KB más su texto, por lo que ambos lectores arrancan con cargas comparables.

## Datos y modelos

El catálogo contiene aproximadamente 3.000 cuentos y 22.800 poemas breves. Las obras fueron recopiladas y anotadas a partir de fuentes literarias en español y metadatos de Wikipedia.

- Embeddings: `jina-embeddings-v2-base-es`
- Traducción: NLLB
- LLM de apoyo: Phi-3
- TTS de cuentos: OpenVoice y MetaVoice
- Imágenes: Midjourney

Las recomendaciones se precalculan con similitud coseno sobre los tensores del proyector. Esto evita descargar cientos de megabytes de tensores en cada visita:

- `static/storyEmbeddingNeighbors.json`
- `static/poemEmbeddingNeighbors.json`
- `static/authorEmbeddingNeighbors.json`
- `static/poemAuthorEmbeddingNeighbors.json`

Una obra que todavía no aparezca en la exportación de tensores recibe temporalmente recomendaciones deterministas basadas en otras obras del mismo autor hasta regenerar los embeddings.

### Metadatos de Literary Guesser

`static/literaryGuesserCatalog.json` es el catálogo reproducible de la ruta
Literary Guesser (Oráculo literario): reúne 725 autores, 2.758 cuentos y
22.813 poemas. Cada obra incluye `kind` (`story` o `poem`), `familiarity` y
`readingComplexity` en una escala editorial de 0 a 10, además de `isClassic`
como 0 o 1. Las puntuaciones equilibran las rondas y documentan la estimación
editorial usada por el juego.

`static/storyReaderMetadata.json` conserva `readingTime`, `wordCount` y las
clasificaciones de los 7.877 cuentos locales. `static/poemReaderMetadata.json`
hace lo mismo para 31.279 registros de poemas: 31.253 archivos locales y 26
referencias de fuente cuyo texto no está disponible localmente. Los registros
sin atribución verificable llevan `classificationStatus: "unmapped"`,
`unreviewed: true` y `quizEligible: false`.

Al revelar una ronda, el juego muestra las categorías biográficas conservadas
en `rawCategory` con su enlace a la página del autor. El generador acepta el
país, sexo y año de nacimiento de una fila de poema completa y coherente;
marca las biografías contradictorias para excluirlas de las respuestas. La
corrección curada de Antonio Machado conserva España y 1875, respaldada por la
[Biblioteca Nacional de España](https://www.bne.es/es/autores/machado-antonio).

Las obras con `quizEligible: false` siguen disponibles para lectura y quedan
fuera de las respuestas. Las dos atribuciones discutidas son
`Aviso` y `Vendo zapatos`, dos textos de seis palabras asociados a Hemingway
cuya atribución popular no está respaldada por evidencia suficiente; el registro
incluye la fuente de la investigación de Quote Investigator.

La modalidad inicial es «Coemas», que mezcla cuentos y poemas; los filtros
permiten elegir cada forma por separado junto con clásicos, género y
nacionalidad. Cada partida ofrece cuatro textos. Las primeras tres rondas
priorizan lecturas breves y la cuarta añade desafío. Se puntúan autor,
nacionalidad, sexo y década de nacimiento, con crédito parcial y penalización
proporcional por error. El resultado muestra una frase y un retrato asociado
(Borges celebra una puntuación superior a 8) y permite empezar otra partida
con filtros distintos. La interfaz cambia al inglés con `?lang=en`.

Por ronda: autor +4/−2, nacionalidad +2/−1, sexo +1/−0,5 y década +2/−1,
con un punto adicional si las cuatro respuestas son correctas. El resultado
se limita a 0–10 y la nota final es el promedio de las cuatro rondas. Las
categorías biográficas se muestran después de responder y no afectan la nota.

Para regenerar ambos artefactos:

```bash
python3 tools/generate_literary_guesser_data.py
```

El generador calcula la complejidad de forma determinista a partir de longitud,
frases, diversidad léxica y puntuación, aplica pocas excepciones editoriales
para microcuentos célebres y marca como clásicos el canon curado o autores
históricos (nacidos hasta 1900 inclusive). `isClassic: 0` significa que la obra no está
designada como clásica, no que exista una evaluación negativa.

### Cómo se calcula la similitud entre autores

1. Se normaliza cada vector de cuento.
2. Se agrupan los cuentos por autor y se calcula el centroide de cada grupo.
3. La similitud mostrada es el coseno entre los centroides de los dos autores.

Por ejemplo, `82% de similitud` significa que los centroides tienen una similitud
coseno de `0.82`. La interfaz acompaña este valor con país, género y año de
nacimiento para que la recomendación resulte más fácil de interpretar.

Los autores relacionados de cuentos y poemas se mantienen separados:

- `authorEmbeddingNeighbors.json` agrupa únicamente embeddings de cuentos;
- `poemAuthorEmbeddingNeighbors.json` agrupa únicamente embeddings de poemas y
  utiliza UUID de autor para evitar ambigüedades por nombres similares.

Los filtros de ambos mapas son controles accesibles: se abren con clic o flechas,
se cierran con `Escape` y permiten recorrer opciones con `↑`, `↓`, `Inicio` y `Fin`.
Las sugerencias de autores son botones dentro de un `listbox`, por lo que también
pueden recorrerse y seleccionarse sin ratón.

## Desarrollo local

Sirve el repositorio desde su raíz:

```bash
python3 -m http.server 8000
```

Abre [http://localhost:8000/](http://localhost:8000/). No abras los HTML directamente con `file://`, porque los lectores cargan JSON mediante `fetch`.

Ejecuta las pruebas:

```bash
npm test
```

Las pruebas usan el runner integrado de Node y verifican recomendaciones, búsqueda
combinada, filtros, navegación, métricas semánticas, tiempo de lectura, guardados,
historial, IDs HTML únicos, recursos locales y la integridad de los índices.

Después de instalar las dependencias (`npm install`), ejecuta los recorridos reales
en Chromium:

```bash
npm run test:browser
```

Estos recorridos comprueban filtros de cuentos y poemas, «Sorpréndeme», selección
de resultados, apertura y cierre accesible del menú del mapa, navegación por
flechas, autocompletado con botones y un autor sin vecinos del grafo que recibe
afinidad semántica.

El recorrido específico del juego se puede ejecutar con:

```bash
node browser-tests/literary_guesser.cjs
```

Para regenerar los vecinos semánticos se requiere Python con NumPy:

```bash
python3 tools/generate_nearest_stories.py
python3 tools/generate_nearest_poems.py
python3 tools/generate_author_embedding_neighbors.py
python3 tools/generate_poem_author_embedding_neighbors.py
python3 tools/generate_reader_startup_data.py
```

Los archivos fuente viven en `tensors_generator/`. Los cuatro shards de poemas existen porque GitHub limita el tamaño de los archivos publicados.

## Estructura relevante

```text
stories-info.html       Lector de cuentos
poems-info.html         Lector de poemas
authorToAuthor3D.html    Mapa completo de autores
authorToAuthor3DSmall.html Mapa centrado en autores con cuentos
reader_ui.css           Diseño responsive compartido
reader_features.js      Preferencias, historial, guardados, filtros y compartir
stories_core.js         Lógica pura de catálogo y vecinos
author_similarity.js    Lectura y formato de similitud/error entre autores
map_controls.js         Menú de filtros y combobox accesibles de ambos mapas
stories_script.js       Integración del lector de cuentos
poems_script.js         Integración del lector de poemas
tools/                  Generadores reproducibles de índices
test/                   Pruebas de funcionalidad e integridad
browser-tests/           Recorridos completos ejecutados en Chromium
```

### Ruta rápida para orientarse

- Para cambiar presentación o accesibilidad de los lectores, empieza en
  `reader_ui.css` y `reader_features.js`.
- Para cambiar cómo se carga una obra, revisa `stories_script.js` o
  `poems_script.js`; las funciones reutilizables y fáciles de probar viven en
  `stories_core.js`.
- Para cambiar filtros o teclado de los mapas, edita `map_controls.js`. Ambos
  HTML sólo proporcionan el gráfico y conectan sus callbacks.
- Para cambiar la definición matemática de afinidad, edita
  `tools/generate_author_embedding_neighbors.py`, regenera el JSON y después
  ejecuta ambas suites.
- Los archivos de `tensors_generator/` son entradas pesadas. Los JSON de
  `static/` son artefactos pequeños preparados para el navegador.
- `embeddings.html` contiene el proyector TensorFlow empaquetado; conviene
  tratarlo como código de terceros y evitar cambios manuales extensos.

## Límites conocidos

- GitHub Pages tiene límites de almacenamiento y tamaño de archivo; por eso no se alojan todos los audios ni traducciones.
- El proyector asigna colores a un máximo práctico de categorías, por lo que conviene segmentar el análisis por autor o género.
- Algunas biografías y relaciones de autores siguen necesitando revisión manual.

## Contribuir

Los pull requests son bienvenidos, especialmente para corregir textos o metadatos, mejorar accesibilidad, revisar traducciones y ampliar pruebas. Al modificar catálogos o tensores, regenera el índice correspondiente y ejecuta `npm test`.

La visualización de relaciones contó con la colaboración de [@AgustinVallejo](https://github.com/AgustinVallejo).

[![Donar con PayPal](https://www.paypalobjects.com/en_US/i/btn/btn_donateCC_LG.gif)](https://www.paypal.com/donate?hosted_button_id=F43U7EFMW5N2A)
