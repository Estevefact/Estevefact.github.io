const test = require("node:test");
const assert = require("node:assert/strict");
const Core = require("../literary_guesser_core.js");

function author(id, index = 0, extra = {}) {
    return {
        id, name: id, countries: [index % 2 ? "Argentina" : "España"], sex: index % 2 ? "female" : "male",
        birthYear: 1900 + index * 10, birthDecade: 1900 + index * 10, genres: ["cuento"],
        ...extra
    };
}
function story(id, authorData, index = 0, extra = {}) {
    return { id, authorId: authorData.id, author: authorData, title: id, wordCount: 40 + index * 20, familiarity: 10 - index, readingComplexity: index, isClassic: index % 2, ...extra };
}
function seeded(seed) {
    let value=seed >>> 0;
    return () => { value=(value * 1664525 + 1013904223) >>> 0; return value / 4294967296; };
}

test("scores all 16 answer combinations with explicit bonuses and penalties", () => {
    const expected = { id: "a", countries: ["Argentina"], sex: "female", birthDecade: 1910 };
    const fields = [
        ["author", "a"], ["nationality", "Argentina"], ["sex", "female"], ["birthDecade", 1910]
    ];
    for (let mask = 0; mask < 16; mask += 1) {
        const answers = Object.fromEntries(fields.map(([field, value], index) => [field, (mask & (1 << index)) ? value : (field === "birthDecade" ? 1920 : "wrong")]));
        const result = Core.scoreRound(answers, expected);
        const correctCount = fields.filter(([,], index) => mask & (1 << index)).length;
        const expectedRaw = (mask & 1 ? 4 : -2) + (mask & 2 ? 2 : -1) + (mask & 4 ? 1 : -.5) + (mask & 8 ? 2 : -1) + (correctCount === 4 ? 1 : 0);
        assert.equal(result.points, Math.max(0, Math.min(10, Math.round(expectedRaw * 10) / 10)));
        assert.equal(result.correct.perfect, mask === 15);
    }
});

test("perfect score selects Borges above the literary-oracle threshold", () => {
    const result = Core.scoreRound({ author: "a", nationality: "España", sex: "male", birthDecade: 1900 }, { id: "a", countries: ["España"], sex: "male", birthDecade: 1900 });
    assert.equal(result.points, 10);
    assert.equal(Core.getScoreCompanion(result.points,() => 0).name, "Jorge Luis Borges");
});

test("score companion pools rotate sourced quotations while Kafka stays fixed", () => {
    assert.equal(Core.scoreCompanionPool(9).length,4);
    assert.equal(Core.scoreCompanionPool(6).length,4);
    assert.equal(Core.scoreCompanionPool(5.9).length,1);
    const borges = Core.getScoreCompanion(9,() => 0);
    const nextBorges = Core.getScoreCompanion(9,() => 0,[borges.quoteId]);
    const woolf = Core.getScoreCompanion(6,() => 0);
    const nextWoolf = Core.getScoreCompanion(6,() => .999999,[woolf.quoteId]);
    const kafka = Core.getScoreCompanion(5.9,() => 0);
    const sameKafka = Core.getScoreCompanion(0,() => .9,[kafka.quoteId]);
    const cervantes = Core.finalClosingQuote();
    assert.equal(borges.name, "Jorge Luis Borges");
    assert.match(borges.quote, /páginas que han escrito/);
    assert.notEqual(nextBorges.quoteId,borges.quoteId);
    assert.equal(woolf.name, "Virginia Woolf");
    assert.match(woolf.quoteEn, /advice, indeed/);
    assert.notEqual(nextWoolf.quoteId,woolf.quoteId);
    assert.equal(kafka.name, "Franz Kafka");
    assert.match(kafka.quote, /puñetazo en el cráneo/);
    assert.equal(sameKafka.quoteId,kafka.quoteId);
    assert.match(cervantes.quote, /vee mucho y sabe mucho/);
    const rotating=[...Core.scoreCompanionPool(9),...Core.scoreCompanionPool(6),kafka];
    assert.equal(new Set(rotating.map(item => item.quoteId)).size,rotating.length);
    for (const item of [...rotating,cervantes]) {
        assert.match(item.source, /^https:\/\//);
        assert.ok(item.work);
        assert.ok(item.sourceLabel);
        assert.ok(item.quote.match(/[\p{L}\p{N}’]+/gu).length <= 25,item.quoteId);
        assert.ok(item.quoteEn.match(/[\p{L}\p{N}’]+/gu).length <= 25,item.quoteId);
    }
});

test("guess options keep the correct choice for every deterministic seed", () => {
    const authors = Array.from({ length: 8 }, (_, index) => author("a" + index, index));
    const stories = authors.map((item, index) => story("s" + index, item, index));
    for (let seed = 0; seed < 100; seed += 1) {
        const random = () => (seed * 37 % 101) / 101;
        const options = Core.buildGuessOptions(stories, authors[0], "hard", random);
        assert.ok(options.author.includes(authors[0].id));
        assert.ok(options.nationality.includes(authors[0].countries[0]));
        assert.ok(options.sex.includes(authors[0].sex));
        assert.ok(options.birthDecade.includes(authors[0].birthDecade));
        assert.equal(new Set(options.author).size, options.author.length);
        assert.equal(new Set(options.nationality).size, options.nationality.length);
    }
});

test("unknown sex, country, year and decade metadata is excluded from play", () => {
    const valid = author("valid");
    const stories = [
        story("valid-story", valid),
        story("unknown-sex", author("unknown-sex", 1, { sex: "unknown" }), 1),
        story("unknown-country", author("unknown-country", 2, { countries: [] }), 2),
        story("unknown-year", author("unknown-year", 3, { birthYear: null, birthDecade: null }), 3),
        story("unknown-decade", author("unknown-decade", 4, { birthDecade: null }), 4),
        story("disputed", valid, 5, { quizEligible: false })
    ];
    const normalized = Core.normalizeCatalog({ authors: stories.map(item => item.author), stories: stories.map(({ author: _author, ...item }) => item) });
    assert.deepEqual(normalized.stories.map(item => item.id), stories.map(item => item.id));
    assert.deepEqual(Core.filterStories(stories, { level: "easy" }).map(item => item.id), ["valid-story"]);
    assert.deepEqual(Core.birthDecadeOptions([{ birthDecade: null }, { birthDecade: undefined }, { birthDecade: 1920 }]), [1920]);
});

test("selection follows filters, excludes recent ids when possible, and avoids duplicate stories", () => {
    const authors = Array.from({ length: 12 }, (_, index) => author("a" + index, index));
    const stories = authors.map((item, index) => story("s" + index, item, index, { wordCount: 50, isClassic: index < 8 ? 1 : 0 }));
    const selected = Core.selectGameStories(stories, { level: "easy", classicsOnly: true, excludeIds: ["s0", "s1", "s2", "s3"] }, () => .2);
    assert.equal(selected.stories.length, 4);
    assert.equal(new Set(selected.stories.map(item => item.id)).size, 4);
    assert.ok(selected.stories.every(item => item.isClassic === 1));
    assert.ok(selected.stories.every(item => !["s0", "s1", "s2", "s3"].includes(item.id)));
    const empty = Core.selectGameStories(stories.slice(0, 2), { level: "hard" });
    assert.deepEqual(empty.stories, []);
    assert.equal(empty.count, 2);
});

test("random selection varies across seeds while easy openings stay compact and approachable", () => {
    const authors=Array.from({length:24},(_,index) => author("random-author-" + index,index));
    const stories=authors.map((item,index) => story("random-story-" + index,item,index,{
        wordCount:index<12 ? 55 + index * 3 : 150 + index,
        familiarity:index<12 ? 8 : 3,
        readingComplexity:index<12 ? 3 : 8
    }));
    const games=Array.from({length:8},(_,seed) => Core.selectGameStories(stories,{kind:"story",level:"easy"},seeded(seed+1)).stories);
    assert.ok(new Set(games.map(game => game.map(item => item.id).join(","))).size >= 6);
    for (const game of games) {
        assert.equal(new Set(game.map(item => item.id)).size,4);
        assert.ok(game.slice(0,3).every(item => item.wordCount <= 120 && item.familiarity >= 6 && item.readingComplexity <= 6));
    }
});

test("narrow pools reuse least-recent stories only after unseen stories", () => {
    const authors=Array.from({length:5},(_,index) => author("recent-author-" + index,index));
    const stories=authors.map((item,index) => story("recent-story-" + index,item,index,{ wordCount:60,familiarity:8,readingComplexity:2 }));
    const selected=Core.selectGameStories(stories,{kind:"story",level:"easy",excludeIds:stories.slice(0,4).map(item => item.id)},seeded(4)).stories;
    assert.ok(selected.some(item => item.id === "recent-story-4"));
    assert.ok(!selected.some(item => item.id === "recent-story-3"));
    assert.equal(new Set(selected.map(item => item.id)).size,4);
});

test("scoring clamps negative guesses and reports the game average", () => {
    const round = Core.scoreRound({ author: "wrong", nationality: "wrong", sex: "wrong", birthDecade: 2000 }, { id: "a", countries: ["España"], sex: "male", birthDecade: 1900 });
    assert.equal(round.points, 0);
    assert.deepEqual(Core.scoreGame([{ points: 10 }, { points: 8 }, { points: 6 }, { points: 4 }]), { total: 28, average: 7, rounds: 4 });
});

test("negative birth years use truncated BCE decades and null stays unavailable", () => {
    const catalog = Core.normalizeCatalog({ authors: [{ id: "ancient", name: "Ancient", countries: ["Egypt"], sex: "male", birthYear: -551, birthDecade: null }], stories: [] });
    assert.equal(catalog.authors[0].birthDecade, -550);
    assert.equal(Core.formatBirthDecade(-551), "550s BCE");
    assert.equal(Core.formatBirthDecade(null), "—");
});

test("kind modes preserve legacy stories and scope filters", () => {
    const writerA = author("story-author", 0, { genres: ["cuento"] });
    const writerB = author("poem-author", 1, { genres: ["poesía"] });
    const items = [
        story("legacy", writerA, 0),
        story("explicit-story", writerA, 1, { kind: "story" }),
        story("poem", writerB, 2, { kind: "poem" })
    ];
    const normalized = Core.normalizeCatalog({ authors: [writerA, writerB], stories: items.map(({ author: _author, ...item }) => item) });
    assert.equal(normalized.stories.find(item => item.id === "legacy").kind, "story");
    assert.deepEqual(Core.filterStories(normalized.stories, { kind: "story", level: "hard" }).map(item => item.id), ["legacy", "explicit-story"]);
    assert.deepEqual(Core.filterStories(normalized.stories, { kind: "poem", level: "hard" }).map(item => item.id), ["poem"]);
});

test("mixed selection includes both poems and stories when both kinds have room", () => {
    const authors = Array.from({ length: 8 }, (_, index) => author("mixed-author-" + index, index));
    const items = authors.map((item, index) => story("mixed-" + index, item, index, { kind: index % 2 ? "poem" : "story", wordCount: 50, familiarity: 8 - index, readingComplexity: index }));
    const selected = Core.selectGameStories(items, { kind: "both", level: "easy" }, () => .42).stories;
    assert.equal(selected.length, 4);
    assert.deepEqual(new Set(selected.map(item => item.kind)), new Set(["story", "poem"]));
    assert.equal(new Set(selected.map(item => item.id)).size, 4);
});

test("mixed selection reaches a minority form beyond the easy ranked window without duplicates", () => {
    const authors = Array.from({ length: 20 }, (_, index) => author("window-author-" + index, index));
    const stories = authors.map((item, index) => story("window-" + index, item, index, {
        kind: index === 19 ? "poem" : "story", wordCount: 20 + index, familiarity: 10 - Math.min(index, 9), readingComplexity: 1
    }));
    const selected = Core.selectGameStories(stories, { kind: "both", level: "easy" }, () => .4).stories;
    assert.equal(selected.length, 4);
    assert.ok(selected.some(item => item.kind === "poem"));
    assert.equal(new Set(selected.map(item => item.id)).size, 4);
});

test("mixed pools from four to seven texts produce four distinct rounds", () => {
    for (let size = 4; size <= 7; size += 1) {
        const authors = Array.from({ length: size }, (_, index) => author("small-author-" + size + "-" + index, index));
        const items = authors.map((item, index) => story("small-" + size + "-" + index, item, index, {
            kind: index === size - 1 ? "poem" : "story", wordCount: 30 + index
        }));
        const selected = Core.selectGameStories(items, { kind: "both", level: "easy" }, () => .2).stories;
        assert.equal(selected.length, 4, String(size));
        assert.equal(new Set(selected.map(item => item.id)).size, 4, String(size));
        assert.ok(selected.some(item => item.kind === "poem"), String(size));
    }
});
