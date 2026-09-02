const test = require("node:test");
const assert = require("node:assert/strict");
const {
  segmentText,
  phraseWeight,
  buildTimeline,
  findPhraseIndex
} = require("../audio_highlighter.js");

test("karaoke segmentation preserves the story text exactly", () => {
  const text = "—Hola, María —dijo él. ¿Vienes conmigo?\n\nSí; pero dame un momento, por favor.";
  const phrases = segmentText(text, { targetWords: 4, maxWords: 7 });
  assert.equal(phrases.join(""), text);
  assert.ok(phrases.length >= 3);
  assert.ok(phrases.every(phrase => phrase.length > 0));
});

test("karaoke segmentation caps long unpunctuated phrases", () => {
  const text = "uno dos tres cuatro cinco seis siete ocho nueve diez once doce trece catorce quince";
  const phrases = segmentText(text, { targetWords: 5, maxWords: 6 });
  assert.equal(phrases.join(""), text);
  assert.deepEqual(phrases.map(phrase => phrase.trim().split(/\s+/).length), [6, 6, 3]);
});

test("estimated timing gives punctuation and paragraphs additional weight", () => {
  assert.ok(phraseWeight("Una frase.\n\n") > phraseWeight("Una frase"));
  assert.ok(phraseWeight("Extraordinariamente") > phraseWeight("Sol"));
});

test("estimated timeline spans the narration and supports seeking", () => {
  const phrases = ["Primera frase. ", "Segunda frase. ", "Tercera frase."];
  const timeline = buildTimeline(phrases, 30);
  assert.equal(timeline.length, phrases.length);
  assert.ok(timeline[0].start > 0);
  assert.ok(timeline[2].end < 30);
  assert.equal(timeline[0].end, timeline[1].start);
  assert.equal(findPhraseIndex(timeline, timeline[1].start + 0.01), 1);
  assert.equal(findPhraseIndex(timeline, 0), -1);
  assert.equal(findPhraseIndex(timeline, 30), -1);
});
