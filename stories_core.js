(function (root, factory) {
    const api = factory();
    if (typeof module === "object" && module.exports) module.exports = api;
    root.StoriesCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
    function buildStoryCatalog(nodes) {
        const catalog = {};
        (nodes || []).forEach(author => {
            Object.entries(author.stories || {}).forEach(([id, title]) => {
                catalog[id] = { id, title, author };
            });
        });
        return catalog;
    }

    function getNearestStories(storyId, neighborIndex, catalog, limit = 5) {
        const seen = new Set([storyId]);
        return ((neighborIndex && neighborIndex[storyId]) || [])
            .map(entry => typeof entry === "string" ? { id: entry, similarity: null } : entry)
            .filter(entry => catalog[entry.id] && !seen.has(entry.id) && seen.add(entry.id))
            .slice(0, limit)
            .map(entry => ({ ...catalog[entry.id], similarity: entry.similarity }));
    }

    function findMatchingStory(node, query) {
        const normalizedQuery = String(query || "").trim().toLocaleLowerCase();
        if (!normalizedQuery || !node || !node.stories) return null;
        const match = Object.entries(node.stories).find(([, title]) =>
            String(title).toLocaleLowerCase().includes(normalizedQuery)
        );
        return match ? { id: match[0], title: match[1] } : null;
    }

    function formatReadingTime(minutes) {
        const totalSeconds = Math.max(0, Math.round(Number(minutes || 0) * 60));
        return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, "0")} min`;
    }

    function similarityLabel(value) {
        return Number.isFinite(Number(value)) ? `${Math.round(Number(value) * 100)}% de similitud` : "Similitud no disponible";
    }

    function chooseInitialStoryId(requestedId, catalog, random = Math.random) {
        if (requestedId && catalog?.[requestedId]) return requestedId;
        const ids = Object.keys(catalog || {});
        return ids.length ? ids[Math.floor(random() * ids.length)] : null;
    }

    function selectRelatedAuthors(currentAuthor, allAuthors, limit = 5) {
        const identity = author => author && (author.id || author.author_name || author.author_uuid);
        const currentId = identity(currentAuthor);
        const seen = new Set([currentId]);
        const selected = [];

        (currentAuthor?.neighbors || []).forEach(author => {
            const id = identity(author);
            if (!id || seen.has(id) || selected.length >= limit) return;
            seen.add(id);
            selected.push({ author, source: "related" });
        });

        return selected;
    }

    return {
        buildStoryCatalog, getNearestStories, findMatchingStory, formatReadingTime,
        similarityLabel, chooseInitialStoryId, selectRelatedAuthors
    };
});
