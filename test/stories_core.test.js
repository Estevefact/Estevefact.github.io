const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
    buildStoryCatalog,
    getNearestStories,
    findMatchingStory,
    formatReadingTime,
    chooseInitialStoryId,
    selectRelatedAuthors
} = require("../stories_core.js");

const authorA = { id: "Author A", stories: { a: "Alpha", b: "Beta" } };
const authorB = { id: "Author B", stories: { c: "Gamma" } };

test("buildStoryCatalog retains the story title and owning author", () => {
    const catalog = buildStoryCatalog([authorA, authorB]);
    assert.deepEqual(Object.keys(catalog), ["a", "b", "c"]);
    assert.equal(catalog.c.title, "Gamma");
    assert.equal(catalog.c.author, authorB);
});

test("getNearestStories follows embedding order, removes invalid duplicates and excludes itself", () => {
    const catalog = buildStoryCatalog([authorA, authorB]);
    const index = { a: ["a", "missing", "c", "c", "b"] };
    assert.deepEqual(getNearestStories("a", index, catalog).map(story => story.id), ["c", "b"]);
});

test("findMatchingStory returns the exact id belonging to the matched title", () => {
    assert.deepEqual(findMatchingStory(authorA, "bet"), { id: "b", title: "Beta" });
    assert.equal(findMatchingStory(authorA, "unknown"), null);
});

test("formatReadingTime handles rounding across a minute boundary", () => {
    assert.equal(formatReadingTime(1.999), "2:00 min");
    assert.equal(formatReadingTime(undefined), "0:00 min");
});

test("initial story preserves valid deep links and is otherwise random on every visit", () => {
    const catalog = buildStoryCatalog([authorA, authorB]);
    assert.equal(chooseInitialStoryId("b", catalog, () => 0), "b");
    assert.equal(chooseInitialStoryId("missing", catalog, () => 0), "a");
    assert.equal(chooseInitialStoryId(null, catalog, () => 0.99), "c");
    assert.equal(chooseInitialStoryId(null, {}, () => 0.5), null);
});

test("legacy graph author selection removes duplicates and never adds random authors", () => {
    const current = { id: "A" };
    const linked = { id: "B" };
    current.neighbors = [linked, linked, current];
    const result = selectRelatedAuthors(current, [current, linked, { id: "C" }], 3);
    assert.deepEqual(result.map(entry => entry.author.id), ["B"]);
    assert.deepEqual(result.map(entry => entry.source), ["related"]);
});

test("authors without graph links do not receive random recommendations", () => {
    const authors = ["A", "B", "C", "D", "E", "F"].map(id => ({ id }));
    assert.deepEqual(selectRelatedAuthors(authors[0], authors, 5), []);
});

test("the generated embedding index covers every displayed story with valid recommendations", () => {
    const root = path.resolve(__dirname, "..");
    const graph = JSON.parse(fs.readFileSync(path.join(root, "static/authorLinksSmallerAllStories.json")));
    const index = JSON.parse(fs.readFileSync(path.join(root, "static/storyEmbeddingNeighbors.json")));
    const catalog = buildStoryCatalog(graph.nodes);

    for (const storyId of Object.keys(catalog)) {
        assert.ok(index[storyId], `missing neighbor index for ${storyId}`);
        assert.ok(index[storyId].length > 0, `no recommendations for ${storyId}`);
        assert.ok(index[storyId].every(entry => {
            const id = typeof entry === "string" ? entry : entry.id;
            return id !== storyId && catalog[id] && Number.isFinite(Number(entry.similarity));
        }), `invalid recommendation for ${storyId}`);
    }
});

test("the lightweight startup catalog covers the complete story reader", () => {
    const root = path.resolve(__dirname, "..");
    const fullGraph = JSON.parse(fs.readFileSync(path.join(root, "static/authorLinksSmallerAllStories.json")));
    const startup = JSON.parse(fs.readFileSync(path.join(root, "static/storyReaderCatalog.json")));
    const fullCatalog = buildStoryCatalog(fullGraph.nodes);
    const startupCatalog = buildStoryCatalog(startup.nodes);
    assert.deepEqual(Object.keys(startupCatalog).sort(), Object.keys(fullCatalog).sort());
    assert.ok(startup.nodes.every(author =>
        author.id && author.stories && !Object.hasOwn(author, "linked_authors")
    ));
});

test("the poem startup pool is compact, varied and references valid local poems", () => {
    const root = path.resolve(__dirname, "..");
    const pool = JSON.parse(fs.readFileSync(path.join(root, "static/poemStartupPool.json")));
    const fullData = JSON.parse(fs.readFileSync(path.join(root, "static/poems.json")));
    const poemIds = new Set(fullData.poems.map(poem => poem.id));
    const authorIds = new Set(fullData.authors.map(author => author.author_uuid));
    assert.ok(pool.poems.length >= 300);
    assert.equal(pool.poems.length, pool.authors.length);
    assert.equal(new Set(pool.poems.map(poem => poem.author_uuid)).size, pool.poems.length);
    assert.ok(pool.poems.every(poem =>
        poemIds.has(poem.id)
        && authorIds.has(poem.author_uuid)
        && fs.existsSync(path.join(root, "static/Poemas", `${poem.id}.json`))
    ));
    assert.ok(pool.authors.every(author =>
        author.author_name && author.author_name.toLowerCase() !== "unknown"
    ));
    assert.ok(fs.statSync(path.join(root, "static/poemStartupPool.json")).size < 200_000);
});

test("every embedded catalog author gets five deterministic semantic authors", () => {
    const root = path.resolve(__dirname, "..");
    const graph = JSON.parse(fs.readFileSync(path.join(root, "static/authorLinksSmallerAllStories.json")));
    const byId = new Map(graph.nodes.map(author => [author.id, author]));
    const index = JSON.parse(fs.readFileSync(path.join(root, "static/authorEmbeddingNeighbors.json")));
    for (const [authorId, suggestions] of Object.entries(index)) {
        assert.equal(suggestions.length, 5, `expected five authors for ${authorId}`);
        assert.equal(new Set(suggestions.map(entry => entry.id)).size, 5);
        assert.ok(suggestions.every(entry => entry.id !== authorId && byId.has(entry.id)));
    }
});
