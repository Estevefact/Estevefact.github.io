let gData = { nodes: [], links: [] };
let storyCatalog = {};
let storyNeighborIndex = {};
let authorNeighborIndex = {};
let storyMetadata = {};
let currentStory = null;
let activeStoryLoad = 0;

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

function storyViewModel(story) {
  const author = story.author;
  const metadata = storyMetadata[story.id] || {};
  return {
    id: story.id,
    title: story.title,
    author: author.id,
    country: author.country || "País desconocido",
    genre: author.genre || "Género desconocido",
    birthYear: author.birth_year || "",
    deathYear: author.death_year || "",
    readingTime: Number(metadata.readingTime || 0)
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

function renderAuthor(author, storyTitle) {
  const container = document.getElementById("author-info-container");
  container.innerHTML = `
    <div class="author-summary">
      <div id="drawing" aria-label="Retrato animado de ${author.id}"></div>
      <div>
        <h2>${author.id}</h2>
        <div class="author-facts">
          <p><strong>País</strong><br>${author.country || "—"}</p>
          <p><strong>Género</strong><br>${author.genre || "—"}</p>
          <p><strong>Nacimiento</strong><br>${author.birth_year || "—"}</p>
          <p><strong>Muerte</strong><br>${author.death_year || "—"}</p>
        </div>
        <p>Ahora leyendo: <strong>${storyTitle}</strong></p>
        <audio id="popup-audio" controls aria-label="Narración del cuento"></audio>
      </div>
    </div>`;
  resetAuthorImage(author.image);
}

async function setAudio(storyId, audio = document.getElementById("popup-audio")) {
  if (!audio) return;
  const storyAudio = `static/audios_es/${encodeURIComponent(storyId)}.mp3`;
  try {
    const response = await fetch(storyAudio, { method: "HEAD" });
    if (audio.isConnected) audio.src = response.ok ? storyAudio : "static/tenquita.mp3";
  } catch {
    if (audio.isConnected) audio.src = "static/tenquita.mp3";
  }
}

function renderAuthorStories(author, selectedStoryId) {
  const list = document.getElementById("stories-list");
  list.replaceChildren();
  Object.entries(author.stories || {}).forEach(([id, title]) => {
    const item = createButton(title, () => loadStory(id));
    if (id === selectedStoryId) {
      item.querySelector("button").setAttribute("aria-current", "true");
      item.querySelector("button").title = "Cuento actual";
    }
    list.appendChild(item);
  });
}

function renderRelatedAuthors(author) {
  const list = document.getElementById("top-authors-list");
  const note = document.getElementById("related-authors-note");
  list.replaceChildren();
  const availableAuthors = new Map(
    gData.nodes.filter(candidate => Object.keys(candidate.stories || {}).length)
      .map(candidate => [candidate.id, candidate])
  );
  const suggestions = AuthorSimilarity.neighborsFor(
    author.id, authorNeighborIndex, availableAuthors, 5
  );
  note.textContent = suggestions.length
    ? "Afinidad calculada con los centroides de los embeddings de sus cuentos."
    : "No hay suficientes cuentos con embeddings para calcular afinidad.";
  suggestions.forEach(entry => {
    const suggested = entry.author;
    const label = AuthorSimilarity.recommendationLabel(entry, suggested);
    const item = createButton(label, () => {
      const id = Object.keys(suggested.stories || {})[0];
      if (id) loadStory(id);
    });
    item.querySelector("button").dataset.source = "embedding";
    item.querySelector("button").title = `Afinidad semántica con ${author.id}`;
    list.appendChild(item);
  });
}

function renderRecommendations(storyId) {
  const container = document.getElementById("top-stories-list");
  container.replaceChildren();
  const recommendations = StoriesCore.getNearestStories(storyId, storyNeighborIndex, storyCatalog);
  recommendations.forEach(story => {
    const model = storyViewModel(story);
    const card = document.createElement("button");
    card.type = "button";
    card.className = "recommendation-card";
    card.innerHTML = `
      <span class="recommendation-card__title">${model.title}</span>
      <span class="recommendation-card__author">${model.author}</span>
      <span class="recommendation-card__meta">${model.country} · ${ReaderFeatures.formatTime(model.readingTime)}</span>
      <span class="recommendation-card__score">${StoriesCore.similarityLabel(story.similarity)}</span>`;
    card.addEventListener("click", () => loadStory(story.id));
    container.appendChild(card);
  });
}

function renderLibrary() {
  const library = ReaderFeatures.getLibrary("story");
  const render = (id, entries) => {
    const container = document.getElementById(id);
    container.replaceChildren();
    if (!entries.length) {
      container.innerHTML = '<p class="reader-empty">Todavía no hay cuentos aquí.</p>';
      return;
    }
    const list = document.createElement("ul");
    list.className = "compact-list";
    entries.forEach(entry => list.appendChild(createButton(
      `${entry.title} — ${entry.author}`,
      () => loadStory(entry.id)
    )));
    container.appendChild(list);
  };
  render("bookmarks-list", library.bookmarks);
  render("history-list", library.history);
}

function updateBookmarkButton() {
  const button = document.getElementById("bookmark-toggle");
  const saved = currentStory && ReaderFeatures.isBookmarked("story", currentStory.id);
  button.setAttribute("aria-pressed", String(Boolean(saved)));
  button.textContent = saved ? "★ Guardado" : "☆ Guardar";
}

async function loadStory(storyId, options = {}) {
  const story = storyCatalog[storyId];
  if (!story) return;
  const requestId = ++activeStoryLoad;
  const textContainer = document.getElementById("cuentoText");
  document.getElementById("container-cuento").setAttribute("aria-busy", "true");
  textContainer.textContent = "Cargando…";
  try {
    const data = await fetchJSON(`static/Cuentos/${encodeURIComponent(storyId)}.json`);
    if (requestId !== activeStoryLoad) return;
    const model = storyViewModel(story);
    if (data.metadata?.reading_time_min) {
      model.readingTime = Number(data.metadata.reading_time_min);
      storyMetadata[storyId] = { readingTime: model.readingTime };
    }
    currentStory = model;
    document.getElementById("cuentoTitle").textContent = story.title;
    document.getElementById("cuentoTime").textContent = ReaderFeatures.formatTime(model.readingTime);
    textContainer.textContent = data.text || "Este cuento no tiene texto disponible.";
    renderAuthor(story.author, story.title);
    renderAuthorStories(story.author, storyId);
    renderRelatedAuthors(story.author);
    renderRecommendations(storyId);
    setAudio(storyId, document.getElementById("popup-audio"));
    ReaderFeatures.updateURL("story", storyId, story.title);
    if (options.record !== false) ReaderFeatures.recordHistory("story", model);
    renderLibrary();
    updateBookmarkButton();
    document.getElementById("reader-status").textContent =
      `Cargado ${story.title}, de ${story.author.id}.`;
    if (options.scroll !== false) {
      requestAnimationFrame(() => {
        ReaderFeatures.navigateToReadingStart(document.getElementById("cuentoTitle"));
      });
    }
  } catch (error) {
    if (requestId !== activeStoryLoad) return;
    textContainer.textContent = "No fue posible cargar este cuento.";
    console.error(error);
  } finally {
    if (requestId === activeStoryLoad) {
      document.getElementById("container-cuento").setAttribute("aria-busy", "false");
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
    const matches = ReaderFeatures.filterItems(Object.values(storyCatalog).map(storyViewModel), filters);
    count.textContent = `${matches.length} coincidencia${matches.length === 1 ? "" : "s"}`;
    matches.slice(0, 30).forEach(model => {
      const suggestion = document.createElement("button");
      suggestion.type = "button";
      suggestion.className = "autocomplete-suggestion";
      suggestion.textContent = `${model.title} — ${model.author} · ${model.country}`;
      suggestion.addEventListener("click", () => {
        results.replaceChildren();
        count.textContent = "";
        input.value = model.title;
        loadStory(model.id);
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
    if (!currentStory) return;
    ReaderFeatures.toggleBookmark("story", currentStory);
    updateBookmarkButton();
    renderLibrary();
  });
  document.getElementById("share-button").addEventListener("click", () => {
    if (currentStory) ReaderFeatures.shareCurrent(currentStory.title).catch(console.error);
  });
  document.getElementById("surprise-button").addEventListener("click", () => {
    const item = ReaderFeatures.randomItem(
      Object.values(storyCatalog).map(storyViewModel),
      activeFilters(),
      currentStory?.id
    );
    if (item) loadStory(item.id);
    else ReaderFeatures.toast("No hay cuentos con esos filtros");
  });
}

async function initializeStories() {
  try {
    gData = await fetchJSON("static/storyReaderCatalog.json");
    storyCatalog = StoriesCore.buildStoryCatalog(gData.nodes);
    populateSelect("country-filter", gData.nodes.map(node => node.country), "País");
    populateSelect("genre-filter", gData.nodes.map(node => node.genre), "Género");
    setupSearch();
    setupControls();
    const requested = ReaderFeatures.getItemFromURL("story");
    const initialId = StoriesCore.chooseInitialStoryId(requested, storyCatalog);
    if (initialId) await loadStory(initialId, { scroll: false });
    loadCoemPortraitAnimator(() => {
      const story = currentStory && storyCatalog[currentStory.id];
      if (story) resetAuthorImage(story.author.image);
    });

    Promise.all([
      fetchJSON("static/storyEmbeddingNeighbors.json"),
      fetchJSON("static/storyReaderMetadata.json"),
      fetchJSON("static/authorEmbeddingNeighbors.json")
    ]).then(([loadedNeighbors, loadedMetadata, loadedAuthorNeighbors]) => {
      storyNeighborIndex = loadedNeighbors;
      storyMetadata = loadedMetadata;
      authorNeighborIndex = loadedAuthorNeighbors;
      if (!currentStory) return;
      const story = storyCatalog[currentStory.id];
      if (!story) return;
      renderRelatedAuthors(story.author);
      renderRecommendations(story.id);
    }).catch(error => {
      console.error("No fue posible completar las funciones de descubrimiento:", error);
    });
  } catch (error) {
    document.getElementById("cuentoText").textContent = "No fue posible iniciar el lector.";
    console.error(error);
  }
}

initializeStories();
