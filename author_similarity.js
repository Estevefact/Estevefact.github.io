(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.AuthorSimilarity = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function percent(value) {
    return `${Math.round(Number(value) * 100)}%`;
  }

  function metricLabel(entry) {
    if (!entry || !Number.isFinite(Number(entry.similarity))) {
      return "Similitud no disponible";
    }
    return `${percent(entry.similarity)} de similitud`;
  }

  function recommendationLabel(entry, author) {
    const known = (value, fallback) =>
      value && String(value).toLocaleLowerCase() !== "unknown" ? value : fallback;
    const country = known(author?.country, "País desconocido");
    const genre = known(author?.genre, "Género desconocido");
    const birthYear = known(author?.birth_year || author?.birthYear, "Año desconocido");
    return `${author?.id || author?.author_name || "Autor desconocido"} · ${metricLabel(entry)} · ${country} · ${genre} · ${birthYear}`;
  }

  function neighborsFor(authorId, index, authorsById, limit = 5) {
    return ((index && index[authorId]) || [])
      .filter(entry => entry.id !== authorId && authorsById.has(entry.id))
      .slice(0, limit)
      .map(entry => ({ ...entry, author: authorsById.get(entry.id) }));
  }

  function storyMetricLabel(entry) {
    return Number.isFinite(Number(entry?.similarity))
      ? `${percent(entry.similarity)} de similitud`
      : "Similitud no disponible";
  }

  return { metricLabel, recommendationLabel, neighborsFor, storyMetricLabel };
});
