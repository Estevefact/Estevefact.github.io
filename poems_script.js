document.addEventListener("DOMContentLoaded", () => {
  const DEFAULT_POEM = {
    id: "d313c7ec-a7c5-48be-878f-d5a89008ed78",
    author_uuid: "3aebced8-2731-45b4-95a5-40b104b4fe00",
    story_name: "En mi jardín avanza un pájaro...",
    reading_time: "0.425",
    author_name: "Emily Dickinson",
    country: "Estados Unidos",
    birth_year: "1830"
  };
  const DEFAULT_AUTHOR = {
    author_uuid: DEFAULT_POEM.author_uuid,
    author_name: "Emily Dickinson",
    country: "Estados Unidos",
    birth_year: "1830",
    death_year: "1886",
    genre: "Romanticismo",
    image: "Dickinson.png"
  };
  let data = { poems: [DEFAULT_POEM], authors: [DEFAULT_AUTHOR] };
  let poemCatalog = {};
  let authorCatalog = {};
  let neighborIndex = {};
  let authorNeighborIndex = {};
  let poemMetadata = {};
  let currentPoem = null;
  let activePoemLoad = 0;

  async function fetchJSON(path) {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`No se pudo cargar ${path} (${response.status})`);
    return response.json();
  }

  function createButton(text, onClick) {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = text;
    button.addEventListener("click", onClick);
    item.appendChild(button);
    return item;
  }

  function poemViewModel(poem) {
    const author = authorCatalog[poem.author_uuid] || {};
    return {
      id: poem.id,
      title: poem.story_name,
      author: poem.author_name || author.author_name || "Autor desconocido",
      authorId: poem.author_uuid,
      country: poem.country || author.country || "País desconocido",
      genre: author.genre || "Género desconocido",
      birthYear: poem.birth_year || author.birth_year || "",
      deathYear: author.death_year || "",
      readingTime: Number(poem.reading_time || poemMetadata[poem.id]?.readingTime || 0)
    };
  }

  function populateSelect(id, values, label) {
    const select = document.getElementById(id);
    [...new Set(values.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), "es"))
      .forEach(value => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = value;
        select.appendChild(option);
      });
  }

  function activeFilters() {
    return {
      query: document.getElementById("author-search").value,
      country: document.getElementById("country-filter").value,
      genre: document.getElementById("genre-filter").value,
      maxMinutes: document.getElementById("time-filter").value
    };
  }

  function renderAuthor(author, poem) {
    document.getElementById("content").innerHTML = `
      <div class="author-summary">
        <div id="drawing" aria-label="Retrato animado de ${author.author_name}"></div>
        <div>
          <h2>${author.author_name}</h2>
          <div class="author-facts">
            <p><strong>País</strong><br>${author.country || "—"}</p>
            <p><strong>Género</strong><br>${author.genre || "—"}</p>
            <p><strong>Nacimiento</strong><br>${author.birth_year || "—"}</p>
            <p><strong>Muerte</strong><br>${author.death_year || "—"}</p>
          </div>
          <p>Ahora leyendo: <strong>${poem.story_name}</strong></p>
        </div>
      </div>`;
    resetAuthorImage(author.image);
  }

  function renderMoreByAuthor(poem) {
    const list = document.getElementById("poems-by-author");
    list.replaceChildren();
    data.poems.filter(candidate => candidate.author_uuid === poem.author_uuid && candidate.id !== poem.id)
      .slice(0, 8)
      .forEach(candidate => list.appendChild(createButton(candidate.story_name, () => loadPoem(candidate.id))));
  }

  function renderRelatedAuthors(author) {
    const list = document.getElementById("related-poem-authors");
    const note = document.getElementById("related-authors-note");
    list.replaceChildren();
    const normalizedAuthors = data.authors.map(candidate => ({ ...candidate, id: candidate.author_name }));
    const authorsById = new Map(normalizedAuthors.map(candidate => [candidate.author_uuid, candidate]));
    const suggestions = AuthorSimilarity.neighborsFor(
      author.author_uuid, authorNeighborIndex, authorsById, 5
    );
    note.textContent = suggestions.length
      ? "Afinidad calculada exclusivamente con los centroides de los embeddings de sus poemas."
      : "No hay suficientes poemas con embeddings para calcular afinidad.";
    suggestions.forEach(entry => {
      const suggested = entry.author;
      const candidate = data.poems.find(poem => poem.author_uuid === suggested.author_uuid);
      const item = createButton(
        AuthorSimilarity.recommendationLabel(entry, suggested),
        () => candidate && loadPoem(candidate.id)
      );
      item.querySelector("button").dataset.source = "embedding";
      list.appendChild(item);
    });
  }

  function nearestPoems(poemId) {
    const seen = new Set([poemId]);
    return (neighborIndex[poemId] || [])
      .map(entry => typeof entry === "string" ? { id: entry, similarity: null } : entry)
      .filter(entry => poemCatalog[entry.id] && !seen.has(entry.id) && seen.add(entry.id))
      .slice(0, 5)
      .map(entry => ({ poem: poemCatalog[entry.id], similarity: entry.similarity }));
  }

  function renderRecommendations(poemId) {
    const container = document.getElementById("suggested-author-poems");
    container.replaceChildren();
    nearestPoems(poemId).forEach(({ poem, similarity }) => {
      const model = poemViewModel(poem);
      const card = document.createElement("button");
      card.type = "button";
      card.className = "recommendation-card";
      card.innerHTML = `
        <span class="recommendation-card__title">${model.title}</span>
        <span class="recommendation-card__author">${model.author}</span>
        <span class="recommendation-card__meta">${model.country} · ${ReaderFeatures.formatTime(model.readingTime)}</span>
        <span class="recommendation-card__score">${StoriesCore.similarityLabel(similarity)}</span>`;
      card.addEventListener("click", () => loadPoem(poem.id));
      container.appendChild(card);
    });
  }

  function renderLibrary() {
    const library = ReaderFeatures.getLibrary("poem");
    const render = (id, entries) => {
      const container = document.getElementById(id);
      container.replaceChildren();
      if (!entries.length) {
        container.innerHTML = '<p class="reader-empty">Todavía no hay poemas aquí.</p>';
        return;
      }
      const list = document.createElement("ul");
      list.className = "compact-list";
      entries.forEach(entry => list.appendChild(createButton(
        `${entry.title} — ${entry.author}`,
        () => loadPoem(entry.id)
      )));
      container.appendChild(list);
    };
    render("bookmarks-list", library.bookmarks);
    render("history-list", library.history);
  }

  function updateBookmarkButton() {
    const button = document.getElementById("bookmark-toggle");
    const saved = currentPoem && ReaderFeatures.isBookmarked("poem", currentPoem.id);
    button.setAttribute("aria-pressed", String(Boolean(saved)));
    button.textContent = saved ? "★ Guardado" : "☆ Guardar";
  }

  async function loadPoem(poemId, options = {}) {
    const poem = poemCatalog[poemId];
    if (!poem) return;
    const requestId = ++activePoemLoad;
    const text = document.getElementById("poemText");
    document.getElementById("container-poem").setAttribute("aria-busy", "true");
    text.textContent = "Cargando…";
    try {
      const poemData = await fetchJSON(`static/Poemas/${encodeURIComponent(poemId)}.json`);
      if (requestId !== activePoemLoad) return;
      const author = authorCatalog[poem.author_uuid];
      const model = poemViewModel(poem);
      currentPoem = model;
      document.getElementById("poemTitle").textContent = poem.story_name;
      document.getElementById("poemTime").textContent = ReaderFeatures.formatTime(model.readingTime);
      text.textContent = poemData.text || "Este poema no tiene texto disponible.";
      renderAuthor(author, poem);
      renderMoreByAuthor(poem);
      renderRelatedAuthors(author);
      renderRecommendations(poemId);
      ReaderFeatures.updateURL("poem", poemId, poem.story_name);
      if (options.record !== false) ReaderFeatures.recordHistory("poem", model);
      renderLibrary();
      updateBookmarkButton();
      document.getElementById("reader-status").textContent =
        `Cargado ${poem.story_name}, de ${model.author}.`;
      if (options.scroll !== false) {
        requestAnimationFrame(() => {
          ReaderFeatures.navigateToReadingStart(document.getElementById("poemTitle"));
        });
      }
    } catch (error) {
      if (requestId !== activePoemLoad) return;
      text.textContent = "No fue posible cargar este poema.";
      console.error(error);
    } finally {
      if (requestId === activePoemLoad) {
        document.getElementById("container-poem").setAttribute("aria-busy", "false");
      }
    }
  }

  function setupSearch() {
    const input = document.getElementById("author-search");
    const results = document.getElementById("autocomplete-container");
    const count = document.getElementById("search-result-count");
    const filterControls = ["country-filter", "genre-filter", "time-filter"]
      .map(id => document.getElementById(id));

    const renderResults = () => {
      const filters = activeFilters();
      const active = filters.query.trim() || filters.country || filters.genre || filters.maxMinutes;
      results.replaceChildren();
      count.textContent = "";
      if (!active) return;
      const matches = ReaderFeatures.filterItems(data.poems.map(poemViewModel), filters);
      count.textContent = `${matches.length} coincidencia${matches.length === 1 ? "" : "s"}`;
      matches.slice(0, 30).forEach(model => {
          const suggestion = document.createElement("button");
          suggestion.type = "button";
          suggestion.className = "autocomplete-suggestion";
          suggestion.textContent = `${model.title} — ${model.author} · ${model.country}`;
          suggestion.addEventListener("click", () => {
            input.value = model.title;
            results.replaceChildren();
            count.textContent = "";
            loadPoem(model.id);
          });
          results.appendChild(suggestion);
        });
    };

    input.addEventListener("input", renderResults);
    filterControls.forEach(control => control.addEventListener("change", renderResults));
    document.getElementById("clear-filters").addEventListener("click", () => {
      input.value = "";
      filterControls.forEach(control => { control.value = ""; });
      renderResults();
      input.focus();
    });
  }

  function setupControls() {
    ReaderFeatures.applyPreferences();
    document.getElementById("theme-toggle").addEventListener("click", () => {
      const current = ReaderFeatures.getPreferences().theme;
      ReaderFeatures.setTheme(current === "dark" ? "light" : "dark");
    });
    document.getElementById("font-decrease").addEventListener("click", () => ReaderFeatures.changeFontSize(-2));
    document.getElementById("font-increase").addEventListener("click", () => ReaderFeatures.changeFontSize(2));
    document.getElementById("bookmark-toggle").addEventListener("click", () => {
      if (!currentPoem) return;
      ReaderFeatures.toggleBookmark("poem", currentPoem);
      updateBookmarkButton();
      renderLibrary();
    });
    document.getElementById("share-button").addEventListener("click", () => {
      if (currentPoem) ReaderFeatures.shareCurrent(currentPoem.title).catch(console.error);
    });
    document.getElementById("surprise-button").addEventListener("click", () => {
      const item = ReaderFeatures.randomItem(
        data.poems.map(poemViewModel),
        activeFilters(),
        currentPoem?.id
      );
      if (item) loadPoem(item.id);
      else ReaderFeatures.toast("No hay poemas con esos filtros");
    });
  }

  function setDiscoveryReady(ready) {
    [
      "author-search", "country-filter", "genre-filter", "time-filter",
      "clear-filters", "surprise-button"
    ].forEach(id => {
      const control = document.getElementById(id);
      if (control) control.disabled = !ready;
    });
  }

  function hydrateCatalog(fullData) {
    data = fullData;
    poemCatalog = Object.fromEntries(data.poems.map(poem => [poem.id, poem]));
    authorCatalog = Object.fromEntries(data.authors.map(author => [author.author_uuid, author]));
  }

  function refreshCurrentPoemFeatures() {
    if (!currentPoem) return;
    const poem = poemCatalog[currentPoem.id];
    const author = poem && authorCatalog[poem.author_uuid];
    if (!poem || !author) return;
    renderMoreByAuthor(poem);
    renderRelatedAuthors(author);
    renderRecommendations(poem.id);
  }

  async function hydrateDiscoveryFeatures(fullDataPromise) {
    const [fullData, loadedNeighbors, loadedMetadata, loadedAuthorNeighbors] = await Promise.all([
      fullDataPromise,
      fetchJSON("static/poemEmbeddingNeighbors.json"),
      fetchJSON("static/poemReaderMetadata.json"),
      fetchJSON("static/poemAuthorEmbeddingNeighbors.json")
    ]);
    hydrateCatalog(fullData);
    neighborIndex = loadedNeighbors;
    poemMetadata = loadedMetadata;
    authorNeighborIndex = loadedAuthorNeighbors;
    populateSelect("country-filter", data.poems.map(poem => poem.country), "País");
    populateSelect("genre-filter", data.authors.map(author => author.genre), "Género");
    setupSearch();
    setDiscoveryReady(true);
    refreshCurrentPoemFeatures();
  }

  async function initialize() {
    try {
      setupControls();
      setDiscoveryReady(false);
      const requested = ReaderFeatures.getItemFromURL("poem");
      let fullDataPromise;

      if (!requested || requested === DEFAULT_POEM.id) {
        hydrateCatalog({ poems: [DEFAULT_POEM], authors: [DEFAULT_AUTHOR] });
        await loadPoem(DEFAULT_POEM.id, { scroll: false });
        fullDataPromise = fetchJSON("static/poems.json");
      } else {
        fullDataPromise = fetchJSON("static/poems.json");
        const fullData = await fullDataPromise;
        hydrateCatalog(fullData);
        const initialId = poemCatalog[requested] ? requested : DEFAULT_POEM.id;
        await loadPoem(initialId, { scroll: false });
      }
      loadCoemPortraitAnimator(() => {
        const poem = currentPoem && poemCatalog[currentPoem.id];
        const author = poem && authorCatalog[poem.author_uuid];
        if (author) resetAuthorImage(author.image);
      });

      hydrateDiscoveryFeatures(fullDataPromise).catch(error => {
        setDiscoveryReady(true);
        console.error("No fue posible completar las funciones de descubrimiento:", error);
      });
    } catch (error) {
      document.getElementById("poemText").textContent = "No fue posible iniciar el lector de poemas.";
      console.error(error);
    }
  }

  initialize();
});
