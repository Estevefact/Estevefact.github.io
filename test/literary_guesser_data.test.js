const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = (file) => JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
const catalog = read('static/literaryGuesserCatalog.json');
const storyMetadata = read('static/storyReaderMetadata.json');
const poemMetadata = read('static/poemReaderMetadata.json');
const poemSource = read('static/poems.json');
const localIds = (folder) => new Set(fs.readdirSync(path.join(ROOT, folder))
  .filter((file) => file.endsWith('.json')).map((file) => path.basename(file, '.json')));
const normalize = (value) => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/gi, ' ').trim().toLowerCase();

function assertMetadataShape(item, kind) {
  assert.ok(Number.isFinite(item.readingTime) && item.readingTime >= 0);
  assert.ok(Number.isInteger(item.wordCount) && item.wordCount >= 0);
  assert.ok(Number.isInteger(item.familiarity) && item.familiarity >= 0 && item.familiarity <= 10);
  assert.ok(Number.isInteger(item.readingComplexity) && item.readingComplexity >= 0 && item.readingComplexity <= 10);
  assert.ok(item.isClassic === 0 || item.isClassic === 1);
  assert.equal(typeof item.classificationStatus, 'string');
  assert.equal(typeof item.unreviewed, 'boolean');
  assert.equal(typeof item.quizEligible, 'boolean');
  if (kind) assert.equal(item.kind, kind);
}

test('literary guesser joins stories and poems to unified author metadata', () => {
  assert.equal(catalog.version, 1);
  assert.equal(catalog.authors.length, 725);
  assert.equal(catalog.stories.filter((item) => item.kind === 'story').length, 2758);
  assert.equal(catalog.stories.filter((item) => item.kind === 'poem').length, 22813);
  const authorIds = new Set(catalog.authors.map((author) => author.id));
  assert.equal(authorIds.size, catalog.authors.length);
  for (const author of catalog.authors) {
    assert.equal(author.id, author.name);
    assert.ok(['male', 'female', 'unknown'].includes(author.sex));
    assert.ok(Array.isArray(author.countries) && Array.isArray(author.genres) && Array.isArray(author.weirdTags));
    assert.match(author.source, /^https:\/\//);
    for (const tag of author.weirdTags) {
      assert.equal(tag.label, tag.rawCategory);
      assert.match(tag.source, /^https:\/\//);
    }
  }
  const ids = new Set();
  for (const item of catalog.stories) {
    assert.equal(ids.has(item.id), false); ids.add(item.id);
    assert.equal(authorIds.has(item.authorId), true);
    assert.ok(['story', 'poem'].includes(item.kind));
    assert.ok(Number.isInteger(item.wordCount) && item.wordCount >= 0);
    assert.ok(Number.isInteger(item.familiarity) && item.familiarity >= 0 && item.familiarity <= 10);
    assert.ok(Number.isInteger(item.readingComplexity) && item.readingComplexity >= 0 && item.readingComplexity <= 10);
    assert.ok(item.isClassic === 0 || item.isClassic === 1);
    assert.equal(typeof item.quizEligible, 'boolean');
    const metadata = item.kind === 'poem' ? poemMetadata[item.id] : storyMetadata[item.id];
    assert.ok(metadata, `${item.id} is missing reader metadata`);
    for (const field of ['wordCount', 'familiarity', 'readingComplexity', 'isClassic', 'quizEligible']) {
      assert.equal(item[field], metadata[field], `${item.id}: ${field} differs between catalogs`);
    }
  }
});

test('reader metadata covers every local story and poem, plus missing poem source records', () => {
  const stories = localIds('static/Cuentos');
  const poems = localIds('static/Poemas');
  const sourcePoems = new Set(poemSource.poems.map((poem) => poem.id));
  assert.equal(Object.keys(storyMetadata).length, stories.size);
  assert.deepEqual(new Set(Object.keys(poemMetadata)), new Set([...poems, ...sourcePoems]));
  for (const id of stories) assertMetadataShape(storyMetadata[id]);
  for (const id of poems) assertMetadataShape(poemMetadata[id], 'poem');
  for (const id of sourcePoems) {
    assert.ok(poemMetadata[id]);
    if (!poems.has(id)) {
      assert.equal(poemMetadata[id].classificationStatus, 'unmapped');
      assert.equal(poemMetadata[id].quizEligible, false);
    }
  }
});

test('poem collisions, unknown bylines, and text mismatches stay out of quiz answers', () => {
  const byText = new Map();
  for (const poem of poemSource.poems) {
    const file = path.join(ROOT, 'static/Poemas', `${poem.id}.json`);
    if (!fs.existsSync(file)) continue;
    const text = JSON.parse(fs.readFileSync(file, 'utf8')).text || '';
    if ((text.match(/[\wÀ-ÿ]+(?:['’][\wÀ-ÿ]+)?/g) || []).length < 4) continue;
    const key = normalize(text);
    if (!byText.has(key)) byText.set(key, []);
    byText.get(key).push(poem);
  }
  const collisions = [...byText.values()].filter((items) => new Set(items.map((item) => normalize(item.author_name))).size > 1);
  assert.ok(collisions.length > 0);
  for (const poem of collisions.flat()) assert.equal(poemMetadata[poem.id].quizEligible, false, poem.id);
  for (const [id, item] of Object.entries(poemMetadata)) if (item.authorId === 'Unknown') assert.equal(item.quizEligible, false, id);
  for (const id of ['a297c490-8997-40e3-a2a8-518119dc1631', 'f913c5f2-9c6e-4629-8b70-1b527f5026d4']) {
    assert.equal(poemMetadata[id].quizEligible, false);
    assert.equal(poemMetadata[id].attributionStatus, 'title-text-mismatch');
  }
});

test('the eight curated introductory readings stay eligible and stable', () => {
  const storyIds = ['6e9e02d2-cbed-4113-8d61-329cc63143a4', 'c4c576bf-194b-4186-a958-957681ff1cd4', '48d207d1-3a9f-4972-b28a-c27684afed92', '6f1fd77c-cbcb-4af8-b8ce-7386a4d3518b'];
  const poemIds = ['7e2311c5-0866-4b76-a645-32aa28bf4197', '57b6c3fa-514b-417f-a82e-90546b1b65f4', '992b9152-cde8-457d-8e61-60e4b0fe4bd0', 'a6c745b5-0dcc-497f-ad93-61330cf88f33'];
  for (const id of [...storyIds, ...poemIds]) assert.equal((storyMetadata[id] || poemMetadata[id]).quizEligible, true);
  assert.deepEqual(poemIds.map((id) => poemMetadata[id].readingComplexity), [0, 1, 1, 3]);
  assert.deepEqual(poemIds.map((id) => poemMetadata[id].wordCount), [23, 38, 51, 38]);
  assert.equal(storyMetadata[storyIds[0]].familiarity, 10);
  assert.equal(storyMetadata[storyIds[0]].readingComplexity, 0);
  assert.equal(storyMetadata[storyIds[3]].readingComplexity, 2);
});

test('the Machado duplicate resolves to the cited complete Spanish authority record', () => {
  const machado = catalog.authors.find((author) => author.name === 'Antonio Machado');
  assert.deepEqual(machado.countries, ['España']);
  assert.equal(machado.birthYear, 1875);
  assert.equal(machado.sex, 'male');
  assert.equal(machado.biographyConflict, false);
  assert.equal(machado.biographySource, 'https://www.bne.es/es/autores/machado-antonio');
});

test('established story answers and disputed attributions retain their boundaries', () => {
  const borges = catalog.authors.find((author) => author.name === 'Jorge Luis Borges');
  const woolf = catalog.authors.find((author) => author.name === 'Virginia Woolf');
  assert.equal(borges.sex, 'male');
  assert.equal(woolf.sex, 'female');
  const familiarPairs = [
    ['Augusto Monterroso', 'El dinosaurio'], ['Julio Cortázar', 'Amor 77'],
    ['Franz Kafka', 'Una pequeña fábula'], ['Jorge Luis Borges', 'Del Rigor en la Ciencia'],
    ['Esopo', 'La liebre y la tortuga'], ['Charles Perrault', 'Caperucita Roja'],
  ];
  for (const [authorId, title] of familiarPairs) {
    assert.ok(catalog.stories.some((item) => item.kind === 'story' && item.authorId === authorId && item.title === title && item.familiarity > 8));
  }
  for (const id of ['43c5dcfd-ac67-4dac-be2e-b97c8a314534', '799a672c-3226-4f98-a193-d6cfa4cb94e7']) {
    const story = catalog.stories.find((item) => item.id === id);
    assert.equal(story.quizEligible, false);
    assert.equal(storyMetadata[id].attributionStatus, 'disputed');
    assert.match(storyMetadata[id].attributionSource, /^https:\/\/quoteinvestigator\.com\//);
  }
});
