const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ReaderFeatures = require("../reader_features.js");

test("bookmarks toggle on and off without duplicating an item", () => {
  const type = `test-${Date.now()}`;
  const item = { id: "one", title: "Uno", author: "Autora" };
  assert.equal(ReaderFeatures.toggleBookmark(type, item), true);
  assert.equal(ReaderFeatures.toggleBookmark(type, item), false);
  assert.deepEqual(ReaderFeatures.getLibrary(type).bookmarks, []);
});

test("reading history keeps the newest visit first and deduplicates revisits", () => {
  const type = `history-${Date.now()}`;
  ReaderFeatures.recordHistory(type, { id: "a", title: "A" });
  ReaderFeatures.recordHistory(type, { id: "b", title: "B" });
  ReaderFeatures.recordHistory(type, { id: "a", title: "A" });
  assert.deepEqual(ReaderFeatures.getLibrary(type).history.map(item => item.id), ["a", "b"]);
});

test("discovery filters enforce country, genre, duration, and current-item exclusion", () => {
  const items = [
    { id: "a", country: "Colombia", genre: "Romanticismo", readingTime: 1 },
    { id: "b", country: "Chile", genre: "Romanticismo", readingTime: 1 },
    { id: "c", country: "Colombia", genre: "Modernismo", readingTime: 7 }
  ];
  assert.equal(
    ReaderFeatures.randomItem(items, { country: "Colombia", genre: "Romanticismo", maxMinutes: 2 }, "c").id,
    "a"
  );
  assert.equal(ReaderFeatures.randomItem(items, { country: "Perú" }), null);
});

test("combined search matches terms across title, author, country, genre, and year", () => {
  const items = [
    {
      id: "borges",
      title: "El Aleph",
      author: "Jorge Luis Borges",
      country: "Argentina",
      genre: "Realismo mágico",
      birthYear: "1899",
      readingTime: 4
    },
    {
      id: "other",
      title: "Aleph",
      author: "Otra persona",
      country: "México",
      genre: "Romanticismo",
      birthYear: "1900",
      readingTime: 2
    }
  ];
  assert.deepEqual(
    ReaderFeatures.filterItems(items, { query: "borges argentina mágico 1899" }).map(item => item.id),
    ["borges"]
  );
  assert.deepEqual(
    ReaderFeatures.filterItems(items, { query: "ALEPH mexico" }).map(item => item.id),
    ["other"]
  );
});

test("combined structured filters use AND semantics and ignore accents/case", () => {
  const items = [
    { id: "a", title: "A", country: "México", genre: "Ficción", readingTime: 4.9 },
    { id: "b", title: "B", country: "México", genre: "Ficción", readingTime: 6 },
    { id: "c", title: "C", country: "México", genre: "Ensayo", readingTime: 2 },
    { id: "d", title: "D", country: "Chile", genre: "Ficción", readingTime: 2 }
  ];
  assert.deepEqual(
    ReaderFeatures.filterItems(items, {
      country: "mexico",
      genre: "ficcion",
      maxMinutes: 5
    }).map(item => item.id),
    ["a"]
  );
});

test("a query and structured filters are applied together", () => {
  const items = [
    { id: "a", title: "La casa", author: "María", country: "Colombia", genre: "Realismo", readingTime: 3 },
    { id: "b", title: "La casa", author: "María", country: "Colombia", genre: "Realismo", readingTime: 7 },
    { id: "c", title: "La casa", author: "María", country: "Chile", genre: "Realismo", readingTime: 3 }
  ];
  assert.deepEqual(
    ReaderFeatures.filterItems(items, {
      query: "maria casa",
      country: "Colombia",
      genre: "Realismo",
      maxMinutes: 5
    }).map(item => item.id),
    ["a"]
  );
});

test("Surprise uses every active filter and keeps Unknown authors eligible", () => {
  const items = [
    {
      id: "unknown-match",
      title: "La casa nocturna",
      author: "Autora Unknown",
      country: "Colombia",
      genre: "Unknown",
      readingTime: 4
    },
    {
      id: "wrong-country",
      title: "La casa nocturna",
      author: "Otro Unknown",
      country: "Chile",
      genre: "Unknown",
      readingTime: 4
    },
    {
      id: "too-long",
      title: "La casa nocturna",
      author: "Tercera Unknown",
      country: "Colombia",
      genre: "Unknown",
      readingTime: 9
    }
  ];
  const filters = {
    query: "casa unknown",
    country: "Colombia",
    genre: "Unknown",
    maxMinutes: 5
  };
  assert.equal(
    ReaderFeatures.randomItem(items, filters, null, () => 0).id,
    "unknown-match"
  );
  assert.equal(
    ReaderFeatures.randomItem(items, filters, "unknown-match", () => 0),
    null
  );
});

test("Surprise includes Unknown metadata when no structured filters are active", () => {
  const items = [
    { id: "known", author: "Conocido", country: "España", genre: "Realismo" },
    { id: "unknown", author: "Unknown", country: "Unknown", genre: "Unknown" }
  ];
  assert.equal(
    ReaderFeatures.randomItem(items, {}, "known", () => 0).id,
    "unknown"
  );
});

test("reader pages expose unified search, visible filters, and the shared main menu", () => {
  const root = path.resolve(__dirname, "..");
  for (const file of ["stories-info.html", "poems-info.html"]) {
    const html = fs.readFileSync(path.join(root, file), "utf8");
    assert.match(html, /Buscar en todo/);
    assert.match(html, /Filtros combinables/);
    assert.match(html, /Menú principal/);
    assert.match(html, /id="reader-status"/);
    assert.match(html, /id="related-authors-note"/);
    assert.doesNotMatch(html, /id="filter-button"/);
  }
  const map = fs.readFileSync(path.join(root, "authorToAuthor3DSmall.html"), "utf8");
  assert.match(map, /Menú principal/);
  assert.match(map, /site_chrome\.css/);
});

test("dark and light themes explicitly style related sections and keep the shared typeface", () => {
  const root = path.resolve(__dirname, "..");
  const readerCss = fs.readFileSync(path.join(root, "reader_ui.css"), "utf8");
  const chromeCss = fs.readFileSync(path.join(root, "site_chrome.css"), "utf8");
  assert.match(readerCss, /:root\[data-theme="dark"\]/);
  assert.match(readerCss, /\.reader-section\s*\{[\s\S]*background:\s*var\(--reader-surface\)\s*!important/);
  assert.match(readerCss, /\.reader-section h2,\s*\.reader-section h3\s*\{[\s\S]*color:\s*var\(--reader-text\)/);
  assert.match(chromeCss, /html,\s*body,\s*button,\s*input,\s*select/);
  assert.match(chromeCss, /#filter-button,\s*\.dropbtn\s*\{[\s\S]*var\(--coem-header\)/);
});

test("mobile map styles provide a full-width sheet and touch-sized controls", () => {
  const css = fs.readFileSync(path.resolve(__dirname, "../site_chrome.css"), "utf8");
  assert.match(css, /\.author-map-page #popup\s*\{[\s\S]*width:\s*100vw\s*!important/);
  assert.match(css, /\.author-map-page #filter-button,[\s\S]*min-height:\s*46px/);
  assert.match(css, /\.author-map-page #toggle-popup-btn\s*\{[\s\S]*min-height:\s*44px/);
});

test("p5 portrait timing leaves a clearly visible drawing phase before reveal", () => {
  const { COEM_PORTRAIT_TIMING } = require("../static/particleDrawStories.js");
  assert.ok(COEM_PORTRAIT_TIMING.drawingDuration >= 4000);
  assert.ok(COEM_PORTRAIT_TIMING.revealDuration >= 1000);
});

test("navigation focuses and scrolls the new reading heading", () => {
  const calls = [];
  const element = {
    setAttribute: (...args) => calls.push(["attribute", ...args]),
    focus: options => calls.push(["focus", options]),
    scrollIntoView: options => calls.push(["scroll", options])
  };
  assert.equal(ReaderFeatures.navigateToReadingStart(element, "auto"), true);
  assert.deepEqual(calls, [
    ["attribute", "tabindex", "-1"],
    ["focus", { preventScroll: true }],
    ["scroll", { behavior: "auto", block: "start" }]
  ]);
  assert.equal(ReaderFeatures.navigateToReadingStart(null), false);
});

test("poem embedding recommendations cover every poem and reference valid distinct poems", () => {
  const root = path.resolve(__dirname, "..");
  const poems = JSON.parse(fs.readFileSync(path.join(root, "static/poems.json"))).poems;
  const index = JSON.parse(fs.readFileSync(path.join(root, "static/poemEmbeddingNeighbors.json")));
  const ids = new Set(poems.map(poem => poem.id));
  assert.equal(Object.keys(index).length, poems.length);
  for (const poem of poems) {
    assert.equal(index[poem.id].length, 5, `expected five recommendations for ${poem.id}`);
    assert.ok(index[poem.id].every(entry =>
      entry.id !== poem.id && ids.has(entry.id) && Number.isFinite(Number(entry.similarity))
    ));
  }
});

test("poem reader intentionally contains no audio player", () => {
  const html = fs.readFileSync(path.resolve(__dirname, "../poems-info.html"), "utf8");
  assert.doesNotMatch(html, /<audio\b/i);
});
