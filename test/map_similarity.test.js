const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const AuthorSimilarity = require("../author_similarity.js");

test("embedding author neighbors are deterministic and valid", () => {
  const root = path.resolve(__dirname, "..");
  const graph = JSON.parse(fs.readFileSync(path.join(root, "static/authorLinksSmallerAllStories.json")));
  const index = JSON.parse(fs.readFileSync(path.join(root, "static/authorEmbeddingNeighbors.json")));
  const authors = new Set(graph.nodes.map(node => node.id));
  for (const [authorId, neighbors] of Object.entries(index)) {
    assert.ok(authors.has(authorId));
    assert.equal(neighbors.length, 5, `expected five neighbors for ${authorId}`);
    assert.equal(new Set(neighbors.map(entry => entry.id)).size, 5);
    for (const entry of neighbors) {
      assert.notEqual(entry.id, authorId);
      assert.ok(authors.has(entry.id));
      assert.ok(Number.isFinite(entry.similarity));
      assert.ok(entry.similarity >= -1 && entry.similarity <= 1);
      assert.ok(entry.storyPairs >= 1);
    }
  }
});

test("an author without graph neighbors still uses embedding recommendations", () => {
  const current = { id: "Sin enlaces", neighbors: [] };
  const related = { id: "Afinidad semántica" };
  const byId = new Map([[current.id, current], [related.id, related]]);
  const result = AuthorSimilarity.neighborsFor(current.id, {
    [current.id]: [{ id: related.id, similarity: 0.81 }]
  }, byId);
  assert.deepEqual(result.map(entry => entry.author.id), [related.id]);
  assert.equal(AuthorSimilarity.metricLabel(result[0]), "81% de similitud");
});

test("story and author labels expose similarity and recommended-author metadata", () => {
  assert.equal(AuthorSimilarity.storyMetricLabel({ similarity: 0.734 }), "73% de similitud");
  assert.equal(
    AuthorSimilarity.recommendationLabel(
      { similarity: 0.75 },
      { id: "Autora", country: "Colombia", genre: "Realismo", birth_year: 1980 }
    ),
    "Autora · 75% de similitud · Colombia · Realismo · 1980"
  );
});

test("poem author recommendations use a separate poem-only UUID index", () => {
  const root = path.resolve(__dirname, "..");
  const poemData = JSON.parse(fs.readFileSync(path.join(root, "static/poems.json")));
  const poemIndex = JSON.parse(
    fs.readFileSync(path.join(root, "static/poemAuthorEmbeddingNeighbors.json"))
  );
  const storyIndex = JSON.parse(
    fs.readFileSync(path.join(root, "static/authorEmbeddingNeighbors.json"))
  );
  const authorIds = new Set(poemData.authors.map(author => author.author_uuid));
  const unknownAuthorIds = new Set(
    poemData.authors
      .filter(author => !author.author_name || author.author_name.toLowerCase() === "unknown")
      .map(author => author.author_uuid)
  );

  assert.ok(Object.keys(poemIndex).length >= 500);
  assert.ok(Object.keys(poemIndex).every(id => authorIds.has(id)));
  assert.ok(Object.keys(poemIndex).every(id => !unknownAuthorIds.has(id)));
  assert.ok(Object.keys(poemIndex).every(id => !Object.hasOwn(storyIndex, id)));
  for (const [authorId, neighbors] of Object.entries(poemIndex)) {
    assert.equal(neighbors.length, 5, `expected five poem authors for ${authorId}`);
    assert.equal(new Set(neighbors.map(entry => entry.id)).size, 5);
    assert.ok(neighbors.every(entry =>
      entry.id !== authorId
      && authorIds.has(entry.id)
      && !unknownAuthorIds.has(entry.id)
      && Number.isFinite(entry.similarity)
      && entry.sourcePoems >= 1
      && entry.targetPoems >= 1
    ));
  }

  const poemScript = fs.readFileSync(path.join(root, "poems_script.js"), "utf8");
  assert.match(poemScript, /poemAuthorEmbeddingNeighbors\.json/);
  assert.doesNotMatch(poemScript, /fetchJSON\("static\/authorEmbeddingNeighbors\.json"\)/);
});
