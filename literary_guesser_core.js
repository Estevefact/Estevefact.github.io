(function (root, factory) {
    const api = factory();
    if (typeof module === "object" && module.exports) module.exports = api;
    root.LiteraryGuesserCore = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function () {
    "use strict";

    const LEVELS = {
        easy: { key: "easy", maxWords: 180, finalMaxWords: 300, options: 3, label: "Fácil" },
        medium: { key: "medium", maxWords: 300, finalMaxWords: 450, options: 4, label: "Media" },
        hard: { key: "hard", maxWords: 450, finalMaxWords: 650, options: 6, label: "Difícil" }
    };

    const ROUND_POINTS = { author: 4, nationality: 2, sex: 1, birthDecade: 2, perfect: 1 };
    const PENALTIES = { author: -2, nationality: -1, sex: -0.5, birthDecade: -1 };

    function clamp(value, min = 0, max = 10) {
        return Math.min(max, Math.max(min, Number.isFinite(Number(value)) ? Number(value) : min));
    }

    function normalizeLevel(level) {
        return LEVELS[level] ? level : "easy";
    }

    function normalizeKind(kind) {
        return kind === "poem" ? "poem" : "story";
    }

    function normalizeKindFilter(kind) {
        return ["both", "story", "poem"].includes(kind) ? kind : "both";
    }

    function matchesKind(story, kind) {
        const mode = normalizeKindFilter(kind);
        return mode === "both" || normalizeKind(story?.kind) === mode;
    }

    function normalizeCountryList(author) {
        const values = Array.isArray(author?.countries) ? author.countries : [author?.country];
        return values.filter(value => value !== null && value !== undefined && String(value).trim())
            .map(value => String(value).trim());
    }

    function normalizeAuthor(author) {
        const hasBirthYear = author?.birthYear !== null && author?.birthYear !== undefined && String(author.birthYear).trim() !== "";
        const hasBirthDecade = author?.birthDecade !== null && author?.birthDecade !== undefined && String(author.birthDecade).trim() !== "";
        const birthYear = hasBirthYear && Number.isFinite(Number(author.birthYear)) ? Number(author.birthYear) : null;
        let birthDecade = hasBirthDecade && Number.isFinite(Number(author.birthDecade)) ? Number(author.birthDecade) : null;
        if (birthDecade === null && birthYear !== null) birthDecade = Math.trunc(birthYear / 10) * 10;
        return {
            ...author,
            id: String(author?.id || ""),
            name: String(author?.name || ""),
            countries: normalizeCountryList(author),
            sex: ["male", "female", "unknown"].includes(author?.sex) ? author.sex : "unknown",
            birthYear,
            birthDecade,
            genres: Array.isArray(author?.genres) ? author.genres.filter(Boolean).map(String) : [],
            weirdTags: Array.isArray(author?.weirdTags) ? author.weirdTags.filter(Boolean) : []
        };
    }

    function normalizeStory(story) {
        const wordCount = Number(story?.wordCount);
        return {
            ...story,
            id: String(story?.id || ""),
            authorId: String(story?.authorId || ""),
            title: String(story?.title || ""),
            kind: normalizeKind(story?.kind),
            wordCount: Number.isFinite(wordCount) ? wordCount : 0,
            familiarity: clamp(Number(story?.familiarity), 0, 10),
            readingComplexity: clamp(Number(story?.readingComplexity), 0, 10),
            isClassic: story?.isClassic ? 1 : 0
        };
    }

    function normalizeCatalog(catalog) {
        const authors = (catalog?.authors || []).map(normalizeAuthor).filter(author => author.id);
        const authorMap = Object.fromEntries(authors.map(author => [author.id, author]));
        const stories = (catalog?.stories || []).map(normalizeStory)
            .filter(story => story.id && authorMap[story.authorId])
            .map(story => ({ ...story, author: authorMap[story.authorId] }));
        return { version: catalog?.version || 1, authors, stories, authorMap };
    }

    function filterStories(stories, filters = {}) {
        const level = normalizeLevel(filters.level);
        const limit = Number.isFinite(Number(filters.wordCap)) ? Number(filters.wordCap) : LEVELS[level].maxWords;
        const genre = filters.genre && filters.genre !== "all" ? String(filters.genre) : null;
        const nationality = filters.nationality && filters.nationality !== "all" ? String(filters.nationality) : null;
        const kind = normalizeKindFilter(filters.kind || filters.kindFilter);
        return (stories || []).filter(story => {
            if (story.quizEligible === false) return false;
            const author = story.author;
            if (!author || !author.id || !author.name) return false;
            if (!Array.isArray(author.countries) || !author.countries.length) return false;
            if (author.birthYear === null || author.birthYear === undefined || !Number.isFinite(Number(author.birthYear))) return false;
            if (author.birthDecade === null || author.birthDecade === undefined || !Number.isFinite(Number(author.birthDecade))) return false;
            if (author.sex !== "male" && author.sex !== "female") return false;
            if (!Number.isFinite(Number(story.wordCount)) || story.wordCount < 1) return false;
            if (!matchesKind(story, kind)) return false;
            if (filters.classicsOnly && story.isClassic !== 1) return false;
            if (genre && !(story.author?.genres || []).includes(genre)) return false;
            if (nationality && !(story.author?.countries || []).includes(nationality)) return false;
            if (story.wordCount > limit) return false;
            return true;
        });
    }

    function rankStory(story, round, level) {
        const normalizedLevel = normalizeLevel(level);
        const familiarity = Number(story.familiarity) || 0;
        const complexity = Number(story.readingComplexity) || 0;
        const shortness = Math.max(0, 1 - (story.wordCount || 0) / (LEVELS[normalizedLevel].maxWords || 1));
        // Introductory rounds favor familiar, compact stories. The final round deliberately
        // rewards the less familiar and more complex end of the same filtered pool.
        let ease;
        if (normalizedLevel === "hard") ease = -familiarity * 1.1 + complexity * 1.8 - shortness * .2;
        else if (normalizedLevel === "medium") ease = familiarity * 1.25 + shortness * 1.6 - complexity * .3;
        else ease = familiarity * 1.4 + shortness * 2.2 - complexity * 1.35;
        if (round >= 3) return -familiarity * .55 + complexity * 1.7 - shortness * .1;
        return ease;
    }

    function shuffled(values, random = Math.random) {
        const result = (values || []).slice();
        for (let index = result.length - 1; index > 0; index -= 1) {
            const value = Math.max(0, Math.min(.999999, Number(random()) || 0));
            const swap = Math.floor(value * (index + 1));
            [result[index], result[swap]] = [result[swap], result[index]];
        }
        return result;
    }

    function selectGameStories(stories, filters = {}, random = Math.random) {
        const level = normalizeLevel(filters.level);
        const pool = filterStories(stories, { ...filters, level, wordCap: LEVELS[level].maxWords });
        if (pool.length < 4) return { stories: [], count: pool.length, eligibleCount: pool.length, level };
        const recent = [...new Set((filters.excludeIds || []).map(String))];
        const recentIndex = new Map(recent.map((id, index) => [id,index]));
        const freshness = story => recentIndex.has(story.id) ? recentIndex.get(story.id) + 1 : 0;
        const qualityBand = story => {
            if (level === "easy" && story.wordCount <= 120 && story.familiarity >= 6 && story.readingComplexity <= 6) return 0;
            if (level === "easy" && story.familiarity >= 6 && story.readingComplexity <= 6) return 1;
            if (level === "medium" && story.wordCount <= 220 && story.readingComplexity <= 8) return 0;
            return 2;
        };
        const candidates = shuffled(pool,random).sort((a,b) => {
            const aSeen=freshness(a), bSeen=freshness(b);
            if (!aSeen || !bSeen) return Number(Boolean(aSeen)) - Number(Boolean(bSeen)) || qualityBand(a) - qualityBand(b);
            return aSeen - bSeen || qualityBand(a) - qualityBand(b);
        });
        const selected = [];
        const authors = new Set();
        const mode = normalizeKindFilter(filters.kind || filters.kindFilter);
        const availableKinds = new Set(pool.map(story => normalizeKind(story.kind)));
        const requiredKinds = mode === "both" && availableKinds.size > 1 ? [...availableKinds] : [];
        // Mixed games include both forms when both are available.
        for (const kind of requiredKinds) {
            const candidate = candidates.find(story => normalizeKind(story.kind) === kind && !selected.some(item => item.id === story.id));
            if (candidate) {
                selected.push(candidate);
                authors.add(candidate.authorId);
            }
        }
        // Keep authors diverse where possible, then fill from the same randomized order.
        for (const story of candidates) {
            if (selected.length >= 3) break;
            if (selected.some(item => item.id === story.id)) continue;
            if (!authors.has(story.authorId) || pool.length < 8) {
                selected.push(story);
                authors.add(story.authorId);
            }
        }
        const remaining = candidates.filter(story => !selected.some(item => item.id === story.id));
        while (selected.length < 3 && remaining.length) selected.push(remaining.shift());
        const finalPool = filterStories(stories, { ...filters, level, wordCap: LEVELS[level].finalMaxWords })
            .filter(story => !selected.some(item => item.id === story.id));
        const freshestRank = Math.min(...finalPool.map(freshness));
        let finalCandidates = finalPool.filter(story => freshness(story) === freshestRank && !authors.has(story.authorId));
        if (!finalCandidates.length) finalCandidates = finalPool.filter(story => freshness(story) === freshestRank);
        const challengeOrder = shuffled(finalCandidates,random).sort((a,b) => rankStory(b,3,level) - rankStory(a,3,level));
        const challengeWindow = challengeOrder.slice(0,Math.max(1,Math.ceil(challengeOrder.length / 2)));
        const final = challengeWindow[Math.floor(Math.max(0,Math.min(.999999,Number(random()) || 0)) * challengeWindow.length)] || remaining[0];
        if (final) selected.push(final);
        // Start with the shortest readings, then leave the challenge for last.
        const firstThree = selected.slice(0, 3).sort((a, b) => a.wordCount - b.wordCount);
        return { stories: [...firstThree, selected[3]], count: pool.length, eligibleCount: pool.length, level };
    }

    function scoreRound(answers, expected) {
        const fields = ["author", "nationality", "sex", "birthDecade"];
        const result = { points: 0, correct: {}, breakdown: {} };
        fields.forEach(field => {
            const actual = answers?.[field];
            let isCorrect = false;
            if (field === "nationality") isCorrect = Array.isArray(expected?.countries) && expected.countries.includes(actual);
            else {
                const expectedValue = field === "author" ? (expected?.author ?? expected?.id) : expected?.[field];
                isCorrect = actual !== undefined && actual !== null && String(actual) === String(expectedValue);
            }
            result.correct[field] = isCorrect;
            const amount = isCorrect ? ROUND_POINTS[field] : PENALTIES[field];
            result.breakdown[field] = amount;
            result.points += amount;
        });
        const perfect = fields.every(field => result.correct[field]);
        result.correct.perfect = perfect;
        result.breakdown.perfect = perfect ? ROUND_POINTS.perfect : 0;
        result.points += result.breakdown.perfect;
        result.points = Math.round(clamp(result.points) * 10) / 10;
        return result;
    }

    const calculateRoundScore = scoreRound;

    function scoreGame(roundScores) {
        const scores = (roundScores || []).map(score => Number(score?.points ?? score) || 0);
        const total = Math.round(scores.reduce((sum, score) => sum + clamp(score), 0) * 10) / 10;
        return { total, average: scores.length ? Math.round((total / scores.length) * 10) / 10 : 0, rounds: scores.length };
    }

    function formatBirthDecade(value) {
        if (value === null || value === undefined || String(value).trim() === "") return "—";
        const year = Number(value);
        if (!Number.isFinite(year)) return "—";
        const decade = Math.trunc(year / 10) * 10;
        if (year < 0) return `${Math.abs(decade)}s BCE`;
        return `${decade}s`;
    }

    function birthDecadeOptions(authors) {
        return [...new Set((authors || []).map(author => author.birthDecade).filter(value => value !== null && value !== undefined && Number.isFinite(Number(value))))]
            .map(Number).sort((a, b) => a - b);
    }

    function shuffleUnique(values, correct, count, random = Math.random) {
        const pool = [...new Set((values || []).filter(value => value !== undefined && value !== null && String(value) !== String(correct)))];
        for (let index = pool.length - 1; index > 0; index -= 1) {
            const swap = Math.floor(Math.max(0, Math.min(.999999, Number(random()) || 0)) * (index + 1));
            [pool[index], pool[swap]] = [pool[swap], pool[index]];
        }
        const options = [correct, ...pool.slice(0, Math.max(0, count - 1))];
        for (let index = options.length - 1; index > 0; index -= 1) {
            const swap = Math.floor(Math.max(0, Math.min(.999999, Number(random()) || 0)) * (index + 1));
            [options[index], options[swap]] = [options[swap], options[index]];
        }
        return options;
    }

    function buildAcceptedOptions(values, accepted, count, random = Math.random) {
        const correctValues = [...new Set((accepted || []).filter(value => value !== undefined && value !== null))];
        const distractors = [...new Set((values || []).filter(value => !correctValues.map(String).includes(String(value))))];
        for (let index = distractors.length - 1; index > 0; index -= 1) {
            const swap = Math.floor(Math.max(0, Math.min(.999999, Number(random()) || 0)) * (index + 1));
            [distractors[index], distractors[swap]] = [distractors[swap], distractors[index]];
        }
        const options = [...correctValues, ...distractors.slice(0, Math.max(0, count - correctValues.length))];
        for (let index = options.length - 1; index > 0; index -= 1) {
            const swap = Math.floor(Math.max(0, Math.min(.999999, Number(random()) || 0)) * (index + 1));
            [options[index], options[swap]] = [options[swap], options[index]];
        }
        return options.slice(0, count);
    }

    function buildGuessOptions(stories, expected, level = "easy", random = Math.random) {
        const normalizedLevel = normalizeLevel(level);
        const count = LEVELS[normalizedLevel].options;
        const authors = [...new Map((stories || []).map(story => [story.author?.id, story.author]).filter(([, author]) => author && author.id !== expected?.id)).values()];
        const countries = [...new Set([...authors.flatMap(author => author.countries || []), ...(expected?.countries || [])])];
        const sexes = [...new Set(authors.map(author => author.sex).filter(sex => sex === "male" || sex === "female"))];
        const decades = birthDecadeOptions(authors);
        return {
            author: shuffleUnique(authors.map(author => author.id), expected?.id, count, random),
            nationality: buildAcceptedOptions(countries, expected?.countries, count, random),
            sex: shuffleUnique(sexes, expected?.sex, 2, random),
            birthDecade: shuffleUnique(decades, expected?.birthDecade, count, random)
        };
    }

    const SCORE_COMPANION_POOLS = Object.freeze({
        borges: Object.freeze([
            { quoteId:"borges-reader", quote:"«Que otros se jacten de las páginas que han escrito; a mí me enorgullecen las que he leído.»", quoteEn:"“Let others boast of the pages they have written; I am proud of those I have read.”", work:"Un lector, Elogio de la sombra (1969)", workEn:"A Reader, In Praise of Darkness (1969)", source:"https://www.lanacion.com.ar/opinion/la-redencion-por-la-lectura-nid1042081/", sourceLabel:"La Nación", translationEn:true },
            { quoteId:"borges-memory", quote:"«El libro es una extensión de la memoria y la imaginación.»", quoteEn:"“The book is an extension of memory and imagination.”", work:"El libro, Borges, oral (1979)", workEn:"The Book, Borges, oral (1979)", source:"https://nyork.cervantes.es/es/biblioteca_espanol/Borges_espanol/Jorge_Luis_Borges_introduccion_espanol.htm", sourceLabel:"Instituto Cervantes", translationEn:true },
            { quoteId:"borges-happiness", quote:"«Creo que una forma de felicidad es la lectura.»", quoteEn:"“I believe that one form of happiness is reading.”", work:"El libro, Borges, oral (1979)", workEn:"The Book, Borges, oral (1979)", source:"https://periodicos.fclar.unesp.br/letras/article/download/18376/18277/77801", sourceLabel:"Universidade Estadual Paulista", translationEn:true },
            { quoteId:"borges-paradise", quote:"«Yo siempre me había imaginado el Paraíso bajo la especie de una biblioteca.»", quoteEn:"“I had always imagined Paradise as a kind of library.”", work:"La ceguera, Siete noches (1980)", workEn:"Blindness, Seven Nights (1980)", source:"https://hispanicstudiesreview.cofc.edu/api/v1/articles/36094-espejismos-de-perpetuidad-el-leitmotiv-de-la-biblioteca-en-las-esquinas-del-aire-de-juan-manuel-de-prada.pdf", sourceLabel:"Hispanic Studies Review", translationEn:true }
        ]),
        woolf: Object.freeze([
            { quoteId:"woolf-advice", quote:"«En realidad, el único consejo que una persona puede dar a otra, en lo referente a leer, es que no siga consejo alguno…»", quoteEn:"“The only advice, indeed, that one person can give another about reading is to take no advice…”", work:"¿Cómo hay que leer un libro?, La torre inclinada (trad. Andrés Bosch, 1980)", workEn:"How Should One Read a Book?, The Common Reader, Second Series (1932)", source:"https://bibliotecadigital.udea.edu.co/server/api/core/bitstreams/71898972-c502-4308-b123-6d6969517ad0/content", sourceLabel:"Universidad de Antioquia", sourceEn:"https://assets.cambridge.org/97805218/45977/frontmatter/9780521845977_frontmatter.pdf", sourceLabelEn:"Cambridge University Press" },
            { quoteId:"woolf-freedom", quote:"«No hay puerta, cerradura ni cerrojo que puedas imponer a la libertad de mi mente.»", quoteEn:"“…there is no gate, no lock, no bolt that you can set upon the freedom of my mind.”", work:"Una habitación propia (1929)", workEn:"A Room of One’s Own (1929)", source:"https://anthology.lib.virginia.edu/work/Woolf/woolf-room-of-ones-own.pdf", sourceLabel:"University of Virginia", translationEs:true },
            { quoteId:"woolf-treasure", quote:"«Saqueo las bibliotecas públicas y las encuentro llenas de tesoros hundidos.»", quoteEn:"“I ransack public libraries, and find them full of sunk treasure.”", work:"Diario (1921)", workEn:"Diary (1921)", source:"https://floridapress.org/news/why-writers-should-keep-diaries/", sourceLabel:"University Press of Florida", translationEs:true },
            { quoteId:"woolf-method", quote:"«Cualquier método es correcto, todo método es correcto, si expresa lo que deseamos expresar…»", quoteEn:"“Any method is right, every method is right, that expresses what we wish to express…”", work:"La narrativa moderna, The Common Reader (1925)", workEn:"Modern Fiction, The Common Reader (1925)", source:"https://content.sakai.rutgers.edu/access/content/group/cd503331-2b38-4eff-83af-c00abbcf5c6d/public/0201joyce1.pdf", sourceLabel:"Rutgers University", translationEs:true }
        ]),
        kafka: Object.freeze([
            { quoteId:"kafka-punch", quote:"«Si el libro que estamos leyendo no nos despierta como un puñetazo en el cráneo, ¿para qué molestarnos en leerlo?»", quoteEn:"“If the book we are reading does not wake us like a punch to the skull, why should we bother reading it?”", work:"Carta a Oskar Pollak (enero de 1904)", workEn:"Letter to Oskar Pollak (January 1904)", source:"https://www.dgcs.unam.mx/ProyectoUNAM/imagenes/240607.pdf", sourceLabel:"UNAM", translationEn:true }
        ])
    });

    function companionTier(score) { return Number(score) > 8 ? "borges" : Number(score) >= 6 ? "woolf" : "kafka"; }
    function scoreCompanionPool(score) {
        const tier=companionTier(score), identity=tier === "borges"
            ? { name:"Jorge Luis Borges",image:"static/imgs/Borges.png" }
            : tier === "woolf" ? { name:"Virginia Woolf",image:"static/imgs/Virginia.png" }
                : { name:"Franz Kafka",image:"static/imgs/Kafka.png" };
        return SCORE_COMPANION_POOLS[tier].map(item => ({ ...identity,tier,...item }));
    }
    function companionForScore(score, random = Math.random, excludeQuoteIds = []) {
        const pool=scoreCompanionPool(score), excluded=new Set(excludeQuoteIds || []);
        const available=pool.filter(item => !excluded.has(item.quoteId));
        const choices=available.length ? available : pool;
        const value=Math.max(0,Math.min(.999999,Number(random()) || 0));
        return choices[Math.floor(value * choices.length)];
    }

    function getScoreCompanion(score, random, excludeQuoteIds) { return companionForScore(score,random,excludeQuoteIds); }

    function finalClosingQuote() {
        return {
            name: "Miguel de Cervantes", quote: "«El que lee mucho y anda mucho vee mucho y sabe mucho.»",
            quoteEn: "“He who reads much and walks much sees much and knows much.”",
            work: "Don Quijote de la Mancha, segunda parte, capítulo XXV (1615)",
            workEn: "Don Quixote, Part II, Chapter 25 (1615)",
            source: "https://cvc.cervantes.es/literatura/clasicos/quijote/edicion/parte2/cap25/cap25_02.htm",
            sourceLabel: "Instituto Cervantes", translationEn: true
        };
    }

    return {
        LEVELS, ROUND_POINTS, PENALTIES, clamp, normalizeLevel, normalizeKind, normalizeKindFilter, normalizeCatalog, filterStories,
        rankStory, selectGameStories, scoreRound, calculateRoundScore, scoreGame, formatBirthDecade,
        birthDecadeOptions, shuffleUnique, buildAcceptedOptions, buildGuessOptions, SCORE_COMPANION_POOLS, scoreCompanionPool, companionForScore, getScoreCompanion, finalClosingQuote
    };
}));
