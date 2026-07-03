(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.ReaderFeatures = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const memory = {};

  function storageGet(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch {
      return memory[key] || fallback;
    }
  }

  function storageSet(key, value) {
    memory[key] = value;
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ }
  }

  function recordHistory(type, item, max = 30) {
    const key = `coem:${type}:history`;
    const history = storageGet(key, []).filter(entry => entry.id !== item.id);
    history.unshift({ ...item, visitedAt: Date.now() });
    storageSet(key, history.slice(0, max));
    return history.slice(0, max);
  }

  function toggleBookmark(type, item) {
    const key = `coem:${type}:bookmarks`;
    const bookmarks = storageGet(key, []);
    const exists = bookmarks.some(entry => entry.id === item.id);
    const next = exists
      ? bookmarks.filter(entry => entry.id !== item.id)
      : [{ ...item, savedAt: Date.now() }, ...bookmarks];
    storageSet(key, next);
    return !exists;
  }

  function isBookmarked(type, id) {
    return storageGet(`coem:${type}:bookmarks`, []).some(entry => entry.id === id);
  }

  function getLibrary(type) {
    return {
      bookmarks: storageGet(`coem:${type}:bookmarks`, []),
      history: storageGet(`coem:${type}:history`, [])
    };
  }

  function getItemFromURL(type) {
    return new URL(location.href).searchParams.get(type);
  }

  function updateURL(type, id, title) {
    const url = new URL(location.href);
    url.searchParams.set(type, id);
    history.replaceState({ type, id }, "", url);
    document.title = `${title} · Coem`;
  }

  function getPreferences() {
    return storageGet("coem:preferences", { theme: "light", fontSize: 20 });
  }

  function applyPreferences(preferences = getPreferences()) {
    document.documentElement.dataset.theme = preferences.theme;
    document.documentElement.style.setProperty("--reader-font-size", `${preferences.fontSize}px`);
    storageSet("coem:preferences", preferences);
    return preferences;
  }

  function setTheme(theme) {
    return applyPreferences({ ...getPreferences(), theme });
  }

  function changeFontSize(delta) {
    const preferences = getPreferences();
    preferences.fontSize = Math.max(16, Math.min(30, preferences.fontSize + delta));
    return applyPreferences(preferences);
  }

  function toast(message) {
    document.querySelector(".reader-toast")?.remove();
    const element = document.createElement("div");
    element.className = "reader-toast";
    element.setAttribute("role", "status");
    element.textContent = message;
    document.body.appendChild(element);
    setTimeout(() => element.remove(), 1800);
  }

  async function shareCurrent(title) {
    const data = { title, text: `${title} en Coem`, url: location.href };
    if (navigator.share) {
      await navigator.share(data);
      return "shared";
    }
    await navigator.clipboard.writeText(location.href);
    toast("Enlace copiado");
    return "copied";
  }

  function formatTime(minutes) {
    const seconds = Math.max(0, Math.round(Number(minutes || 0) * 60));
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")} min`;
  }

  function normalizeText(value) {
    return String(value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase()
      .trim();
  }

  function matchesFilters(item, filters) {
    if (filters.country && normalizeText(item.country) !== normalizeText(filters.country)) return false;
    if (filters.genre && normalizeText(item.genre) !== normalizeText(filters.genre)) return false;
    if (filters.maxMinutes && Number(item.readingTime) > Number(filters.maxMinutes)) return false;
    return true;
  }

  function filterItems(items, filters = {}) {
    const terms = normalizeText(filters.query).split(/\s+/).filter(Boolean);
    return items.filter(item => {
      if (!matchesFilters(item, filters)) return false;
      if (!terms.length) return true;
      const searchable = normalizeText([
        item.title, item.author, item.country, item.genre,
        item.birthYear, item.deathYear
      ].join(" "));
      return terms.every(term => searchable.includes(term));
    });
  }

  function randomItem(items, filters = {}, excludeId, random = Math.random) {
    const eligible = filterItems(items, filters).filter(item => item.id !== excludeId);
    return eligible.length ? eligible[Math.floor(random() * eligible.length)] : null;
  }

  function navigateToReadingStart(element, behavior = "smooth") {
    if (!element) return false;
    element.setAttribute("tabindex", "-1");
    element.focus({ preventScroll: true });
    element.scrollIntoView({ behavior, block: "start" });
    return true;
  }

  return {
    storageGet, storageSet, recordHistory, toggleBookmark, isBookmarked, getLibrary,
    getItemFromURL, updateURL, getPreferences, applyPreferences, setTheme,
    changeFontSize, shareCurrent, formatTime, normalizeText, matchesFilters,
    filterItems, randomItem, navigateToReadingStart, toast
  };
});
