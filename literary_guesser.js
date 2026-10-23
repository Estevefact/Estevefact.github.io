(function () {
    "use strict";
    const Core = window.LiteraryGuesserCore;
    if (!Core) return;

    const RECENT_STORIES_KEY = "coem:literary-guesser:recent-stories";
    const translations = {
        es: {
            gameTitle:"Oráculo literario",skip:"Ir al juego",backArchive:"Volver al archivo",eyebrow:"Juego de lectura",intro:"Lee un cuento breve y adivina su procedencia",note:"Cuatro textos muy breves. Empieza por los más cortos y descubre el reto final.",setup:"Preparar la partida",filtersTitle:"Elige tus pistas",filtersCopy:"Personaliza tu próxima partida.",kind:"Forma literaria",bothKinds:"Coemas · cuentos y poemas",storiesOnly:"Solo cuentos",poemsOnly:"Solo poemas",level:"Nivel",easy:"Fácil",medium:"Media",hard:"Difícil",nationality:"Nacionalidad",nationalityNote:"Nacionalidades registradas en el catálogo; se aceptan las múltiples documentadas.",allCountries:"Todas las nacionalidades",genre:"Género",allGenres:"Todos los géneros",classics:"Solo clásicos",matching:"textos compatibles",rounds:"4 rondas",start:"Comenzar partida",round:"Ronda",currentScore:"Puntuación total",fragment:"Texto sin firma",roundPrompt:"¿Quién escribió este texto?",originalNote:"Texto del archivo en español.",author:"Autor",nationalityAnswer:"Nacionalidad",sex:"Sexo del autor",decade:"Década de nacimiento",choose:"Elige una opción",male:"Hombre",female:"Mujer",required:"Completa las cuatro respuestas para revelar la firma.",submit:"Revelar mi respuesta",result:"Resultado",finalTitle:"Tu brújula literaria",companion:"Tu compañero de lectura",replay:"Jugar otra partida",archive:"Archivo",contact:"Contacto",loadingStory:"El texto está llegando…",storyError:"No pudimos cargar este texto.",retry:"Intentar de nuevo",empty:"Hay {count} textos compatibles. Amplía un filtro para reunir cuatro rondas.",reset:"Restablecer filtros",unavailable:"No pudimos abrir el catálogo.",correct:"Correcto",incorrect:"No esta vez",authorCorrect:"La firma era",nationalityCorrect:"La nacionalidad era",sexCorrect:"La respuesta registrada era",decadeCorrect:"La década era",source:"Fuente",translation:"Traducción al inglés de COEM",translationEs:"Traducción al español de COEM",continueReading:"Para seguir leyendo",curious:"Etiquetas curiosas",editorial:"Estimación editorial",familiarity:"familiaridad",complexity:"complejidad",classic:"clásico",noTags:"Sin etiquetas curiosas registradas.",scoreLine:"Autor +4 / −2 · Nacionalidad +2 / −1 · Sexo +1 / −0,5 · Década +2 / −1 · Respuesta perfecta +1",rating:"Tu promedio se lee así: 0–2 aprendiz, 3–5 atento, 6–8 literato/a, más de 8 oráculo.",finalCopy:"Tu promedio fue {score} sobre 10.",scoreRound:"Puntuación de la ronda",breakdown:"Desglose",nextRound:"Siguiente ronda",finalButton:"Ver mi resultado",allScores:"Tus cuatro rondas sumaron {total} puntos.",storyRead:"Leer el texto completo"
        },
        en: {
            gameTitle:"Literary guesser",skip:"Go to game",backArchive:"Back to archive",eyebrow:"Reading game",intro:"Read a short story and guess its origins",note:"Four very short texts. Start with the shortest and discover the final challenge.",setup:"Prepare the game",filtersTitle:"Choose your clues",filtersCopy:"Customize your next game.",kind:"Literary form",bothKinds:"Coemas · stories & poems",storiesOnly:"Stories only",poemsOnly:"Poems only",level:"Level",easy:"Easy",medium:"Medium",hard:"Hard",nationality:"Nationality",nationalityNote:"Recorded nationalities; documented alternatives are accepted.",allCountries:"All nationalities",genre:"Genre",allGenres:"All genres",classics:"Classical works only",matching:"matching texts",rounds:"4 rounds",start:"Start game",round:"Round",currentScore:"Total score",fragment:"Unsigned text",roundPrompt:"Who wrote this text?",originalNote:"Archive text in Spanish.",author:"Author",nationalityAnswer:"Nationality",sex:"Author's sex",decade:"Birth decade",choose:"Choose an option",male:"Male",female:"Female",required:"Complete all four answers to reveal the signature.",submit:"Reveal my answer",result:"Result",finalTitle:"Your literary compass",companion:"Your reading companion",replay:"Play another game",archive:"Archive",contact:"Contact",loadingStory:"The text is arriving…",storyError:"We could not load this text.",retry:"Try again",empty:"There are {count} matching texts. Broaden a filter to gather four rounds.",reset:"Reset filters",unavailable:"We could not open the catalogue.",correct:"Correct",incorrect:"Not this time",authorCorrect:"The signature was",nationalityCorrect:"The nationality was",sexCorrect:"The recorded answer was",decadeCorrect:"The decade was",source:"Source",translation:"COEM English translation",continueReading:"For further reading",curious:"Unusual tags",editorial:"Editorial estimate",familiarity:"familiarity",complexity:"complexity",classic:"classic",noTags:"No unusual tags recorded.",scoreLine:"Author +4 / −2 · Nationality +2 / −1 · Sex +1 / −0.5 · Decade +2 / −1 · Perfect answer +1",rating:"Average guide: 0–2 learner, 3–5 attentive, 6–8 literary scholar, above 8 oracle.",finalCopy:"Your average was {score} out of 10.",scoreRound:"Round score",breakdown:"Breakdown",nextRound:"Next round",finalButton:"See my result",allScores:"Your four rounds totaled {total} points.",storyRead:"Read the complete text"
        }
    };
    const state = { lang: new URLSearchParams(location.search).get("lang") === "en" ? "en" : "es", catalog:null, currentGame:[], roundIndex:0, roundScores:[], roundCompanions:[], finalCompanion:null, lastQuoteIds:{}, recentIds:[], currentStory:null, currentAuthor:null, currentLevel:"easy", kind:"both", submitted:false, storyReady:false, loadToken:0, portraitToken:0, finalShown:false };
    const $ = id => document.getElementById(id);
    const els = { filters:document.querySelector(".filters-panel"), kind:$("kind-filter"), level:$("level-filter"),nationality:$("nationality-filter"),genre:$("genre-filter"),classics:$("classic-filter"),count:$("matching-count"),empty:$("empty-state"),start:$("start-game"),game:$("game-panel"),final:$("final-panel"),form:$("guess-form"),story:$("story-text"),round:$("round-number"),roundKind:$("round-kind"),progress:$("progress-bar"),roundProgress:document.querySelector(".progress-track"),score:$("current-score"),levelLabel:$("round-level"),result:$("round-result"),announcement:$("game-announcement"),finalAverage:$("final-average"),finalCopy:$("final-copy"),companionPortrait:$("drawing"),companionName:$("companion-name"),companionPhrase:$("companion-phrase"),companionSource:$("companion-source"),breakdown:$("score-breakdown"),closingQuote:$("final-closing-quote")};

    function t(key, vars) {
        let value = translations[state.lang][key] || translations.es[key] || key;
        Object.entries(vars || {}).forEach(([name, replacement]) => { value = value.replace("{" + name + "}", replacement); });
        return value;
    }
    function modeKind() { return els.kind.value || "both"; }
    function kindLabel(kind, plural = false) {
        const value = kind === "poem" ? (plural ? (state.lang === "en" ? "poems" : "poemas") : (state.lang === "en" ? "Poem" : "Poema")) : (plural ? (state.lang === "en" ? "stories" : "cuentos") : (state.lang === "en" ? "Story" : "Cuento"));
        return value;
    }
    function modeCopy() {
        const mode = modeKind();
        const title = state.lang === "en" ? "Literary guesser" : "Oráculo literario";
        const game = state.lang === "en" ? "Reading game" : "Juego de lectura";
        if (mode === "story") return { title, eyebrow:game + " · " + (state.lang === "en" ? "Stories" : "Cuentos"), intro:state.lang === "en" ? "Read a short story and guess its origins" : "Lee un cuento breve y adivina su procedencia", prompt:state.lang === "en" ? "Who wrote this story?" : "¿Quién escribió este cuento?" };
        if (mode === "poem") return { title, eyebrow:game + " · " + (state.lang === "en" ? "Poems" : "Poemas"), intro:state.lang === "en" ? "Read a short poem and guess its origins" : "Lee un poema breve y adivina su procedencia", prompt:state.lang === "en" ? "Who wrote this poem?" : "¿Quién escribió este poema?" };
        return { title, eyebrow:game + " · Coemas", intro:state.lang === "en" ? "Read a short story and guess its origins" : "Lee un cuento breve y adivina su procedencia", prompt:t("roundPrompt") };
    }
    function refreshModeCopy() {
        const copy = modeCopy();
        $("game-mode").textContent = copy.eyebrow;
        $("game-title").textContent = copy.title;
        document.querySelector(".guesser-intro").textContent = copy.intro;
        $("round-title").textContent = copy.prompt;
        $("round-kind").textContent = modeKind() === "both" ? (state.lang === "en" ? "Story or poem" : "Cuento o poema") : kindLabel(modeKind());
    }
    function announce(message) { els.announcement.textContent = ""; window.setTimeout(() => { els.announcement.textContent = message; }, 10); }
    function getFilters() { return { kind:modeKind(), level:els.level.value, nationality:els.nationality.value, genre:els.genre.value, classicsOnly:els.classics.checked }; }
    function loadRecentStories() { try { const value=JSON.parse(localStorage.getItem(RECENT_STORIES_KEY) || "[]"); return Array.isArray(value) ? value.filter(id => typeof id === "string").slice(-64) : []; } catch (_) { return []; } }
    function saveRecentStories(ids) { const used=[...new Set(ids)]; const usedSet=new Set(used); state.recentIds=[...state.recentIds.filter(id => !usedSet.has(id)),...used].slice(-64); try { localStorage.setItem(RECENT_STORIES_KEY,JSON.stringify(state.recentIds)); } catch (_) {} }
    function chooseCompanion(score) { const tier=Number(score)>8?"borges":Number(score)>=6?"woolf":"kafka"; const companion=Core.getScoreCompanion(score,Math.random,state.lastQuoteIds[tier]?[state.lastQuoteIds[tier]]:[]); state.lastQuoteIds[tier]=companion.quoteId; return companion; }
    function imagePath(filename) { if (!filename) return ""; return /^(https?:)?\//.test(filename) || filename.includes("/") ? filename : "static/imgs/" + filename; }
    function storyUrl(story) { return (story.kind === "poem" ? "poems-info.html?poem=" : "stories-info.html?story=") + encodeURIComponent(story.id); }
    function localizedQuote(item) { return state.lang === "en" && item.quoteEn ? item.quoteEn : item.quote; }
    function localizedWork(item) { return state.lang === "en" && item.workEn ? item.workEn : item.work; }
    function renderCitation(item) {
        const cite=document.createElement("cite"); cite.className="quote-source";
        const author=document.createElement("strong"); author.textContent=item.name; cite.append(author,document.createTextNode(" · " + localizedWork(item) + " · "));
        const source=document.createElement("a"); source.href=state.lang === "en" && item.sourceEn ? item.sourceEn : item.source; source.target="_blank"; source.rel="noreferrer"; source.textContent=state.lang === "en" && item.sourceLabelEn ? item.sourceLabelEn : item.sourceLabel; cite.appendChild(source);
        if (state.lang === "en" && item.translationEn) cite.appendChild(document.createTextNode(" · " + t("translation")));
        if (state.lang === "es" && item.translationEs) cite.appendChild(document.createTextNode(" · " + t("translationEs")));
        return cite;
    }
    function renderClosingQuote() {
        const item=Core.finalClosingQuote(); els.closingQuote.replaceChildren();
        const label=document.createElement("p"); label.className="route-kicker"; label.textContent=t("continueReading");
        const quote=document.createElement("blockquote"); quote.className="quote-text"; quote.textContent=localizedQuote(item);
        els.closingQuote.append(label,quote,renderCitation(item));
    }
    function startFinalPortrait(companion) {
        const token=++state.portraitToken, filename=companion.image.split("/").pop();
        els.companionPortrait.setAttribute("aria-label", (state.lang === "en" ? "Animated portrait of " : "Retrato animado de ") + companion.name);
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            renderPortraitFallback(els.companionPortrait,filename);
            return;
        }
        if (typeof window.p5 === "function") {
            resetAuthorImage(filename);
            return;
        }
        renderPortraitFallback(els.companionPortrait,filename);
        loadCoemPortraitAnimator().then(loaded => {
            if (loaded && token === state.portraitToken && state.finalShown && !els.final.hidden) resetAuthorImage(filename);
        });
    }

    function applyLanguage() {
        document.documentElement.lang = state.lang;
        document.title = state.lang === "en" ? "Literary guesser — COEM" : "Oráculo literario — COEM";
        document.querySelectorAll("[data-i18n]").forEach(node => { node.textContent = t(node.dataset.i18n); });
        $("language-toggle").textContent = state.lang === "es" ? "EN" : "ES";
        $("language-toggle").setAttribute("aria-label", state.lang === "es" ? "Switch to English" : "Cambiar a español");
        if (state.catalog) { renderFilterOptions(); updateMatching(); }
        refreshModeCopy();
        updateActiveLanguage();
        if (!els.final.hidden) updateFinalLanguage();
        else if (state.currentAuthor && state.submitted) renderRoundResult();
    }
    function updateActiveLanguage() {
        if (!state.currentStory || els.game.hidden) return;
        els.roundKind.textContent = kindLabel(state.currentStory.kind);
        $("round-title").textContent = state.currentStory.kind === "poem"
            ? (state.lang === "en" ? "Who wrote this poem?" : "¿Quién escribió este poema?")
            : (state.lang === "en" ? "Who wrote this story?" : "¿Quién escribió este cuento?");
        els.levelLabel.textContent = state.roundIndex === 3 ? t("hard") : t(state.currentLevel);
        ["male", "female"].forEach(value => { const option = Array.from($("answer-sex").options).find(item => item.value === value); if (option) option.textContent = t(value); });
        if (state.submitted && state.roundScores.length) ["author", "nationality", "sex", "birthDecade"].forEach(field => feedbackFor(field, state.roundScores[state.roundScores.length - 1].correct[field]));
    }

    function renderFilterOptions() {
        const selectedCountry = els.nationality.value || "all", selectedGenre = els.genre.value || "all";
        const scoped = Core.filterStories(state.catalog.stories, { kind:modeKind(), level:"hard", wordCap:Number.MAX_SAFE_INTEGER });
        const authors = [...new Map(scoped.map(story => [story.author.id, story.author])).values()];
        const countries = [...new Set(authors.flatMap(author => author.countries || []))].sort((a,b) => a.localeCompare(b,state.lang));
        const genres = [...new Set(authors.flatMap(author => author.genres || []))].sort((a,b) => a.localeCompare(b,state.lang));
        function fill(select, values, allKey, current) {
            select.replaceChildren(); const all = document.createElement("option"); all.value = "all"; all.textContent = t(allKey); select.appendChild(all);
            values.forEach(value => { const option = document.createElement("option"); option.value = value; option.textContent = value; select.appendChild(option); });
            select.value = values.includes(current) ? current : "all";
        }
        fill(els.nationality,countries,"allCountries",selectedCountry); fill(els.genre,genres,"allGenres",selectedGenre);
    }
    function updateMatching() {
        if (!state.catalog) return;
        const count = Core.filterStories(state.catalog.stories,getFilters()).length, enough = count >= 4;
        els.count.textContent = String(count); els.start.disabled = !enough; els.start.setAttribute("aria-disabled",String(!enough)); els.empty.hidden = enough;
        if (!enough) { els.empty.textContent = t("empty",{count}); const reset = document.createElement("button"); reset.type="button"; reset.className="text-button"; reset.textContent=t("reset"); reset.addEventListener("click",resetFilters); els.empty.append(document.createTextNode(" "),reset); }
    }
    function resetFilters() { els.kind.value="both"; els.level.value="easy"; els.nationality.value="all"; els.genre.value="all"; els.classics.checked=false; renderFilterOptions(); updateMatching(); refreshModeCopy(); }
    async function loadJson(url) { const response = await fetch(url); if (!response.ok) throw new Error(response.status + " " + url); return response.json(); }
    async function loadCatalog() {
        try { state.catalog=Core.normalizeCatalog(await loadJson("static/literaryGuesserCatalog.json")); renderFilterOptions(); updateMatching(); }
        catch (_) { state.catalog=null; els.empty.hidden=false; els.empty.textContent=t("unavailable") + " "; const retry=document.createElement("button"); retry.type="button"; retry.className="text-button"; retry.textContent=t("retry"); retry.addEventListener("click",loadCatalog); els.empty.appendChild(retry); els.start.disabled=true; announce(t("unavailable")); }
    }
    function paragraphs(text, kind = "story") {
        els.story.replaceChildren();
        els.story.classList.toggle("poem-text", kind === "poem");
        const stanzas = kind === "poem"
            ? String(text || "").replace(/\r\n?/g, "\n").split(/\n[ \t]*\n+/)
            : String(text || "").split(/\n\s*\n+/);
        stanzas.map(part => part.trim()).filter(Boolean).forEach(part => { const p=document.createElement("p"); p.textContent=part; els.story.appendChild(p); });
    }
    function populateSelect(selectId, values, labels) {
        const select=$(selectId), placeholder=select.querySelector("option"); select.replaceChildren(placeholder); select.value="";
        values.forEach(value => { const option=document.createElement("option"); option.value=value; option.textContent=labels && labels[value] || value; select.appendChild(option); });
    }
    async function loadStory(story) {
        const token = ++state.loadToken; state.storyReady=false; $("submit-guess").disabled=true; paragraphs(t("loadingStory"), story.kind);
        try {
            const folder = story.kind === "poem" ? "Poemas" : "Cuentos";
            const data=await loadJson("static/" + folder + "/" + encodeURIComponent(story.id) + ".json");
            if (token !== state.loadToken || state.currentStory?.id !== story.id) return;
            state.currentText=String(data.text || ""); paragraphs(state.currentText, story.kind); state.storyReady=true; $("submit-guess").disabled=false;
        } catch (_) {
            if (token !== state.loadToken || state.currentStory?.id !== story.id) return;
            paragraphs(t("storyError") + " ", story.kind); const retry=document.createElement("button"); retry.type="button"; retry.className="text-button"; retry.textContent=t("retry"); retry.addEventListener("click",() => loadStory(story)); els.story.appendChild(retry); announce(t("storyError"));
        }
    }
    function authorLabels(stories) { return Object.fromEntries(stories.map(story => [story.author.id,story.author.name])); }
    function renderRound() {
        const story=state.currentGame[state.roundIndex]; state.currentStory=story; state.currentAuthor=story.author; state.submitted=false;
        els.round.textContent=String(state.roundIndex+1); els.score.textContent=String(Core.scoreGame(state.roundScores).total); els.progress.style.width=((state.roundIndex+1)/4*100) + "%"; els.roundProgress.setAttribute("aria-valuenow",String(state.roundIndex+1)); els.levelLabel.textContent=(state.roundIndex===3 ? t("hard") : t(state.currentLevel));
        els.roundKind.textContent=kindLabel(story.kind);
        $("round-title").textContent=story.kind === "poem" ? (state.lang === "en" ? "Who wrote this poem?" : "¿Quién escribió este poema?") : (state.lang === "en" ? "Who wrote this story?" : "¿Quién escribió este cuento?");
        els.result.hidden=true; els.result.replaceChildren(); els.form.hidden=false; els.form.querySelectorAll("select").forEach(select => { select.disabled=false; select.value=""; const field=select.closest(".guess-field"); field.classList.remove("is-correct","is-wrong"); field.querySelector(".field-feedback").textContent=""; }); $("submit-guess").disabled=false;
        const optionPool=Core.filterStories(state.catalog.stories,{kind:modeKind(),level:"hard",wordCap:Number.MAX_SAFE_INTEGER});
        const options=Core.buildGuessOptions(optionPool,story.author,state.currentLevel);
        populateSelect("answer-author",options.author,authorLabels(optionPool)); populateSelect("answer-nationality",options.nationality); populateSelect("answer-sex",options.sex,{male:t("male"),female:t("female")}); populateSelect("answer-birthDecade",options.birthDecade,Object.fromEntries(options.birthDecade.map(value => [value,Core.formatBirthDecade(value)])));
        els.game.hidden=false; els.final.hidden=true; els.story.setAttribute("aria-busy","true"); loadStory(story).finally(() => els.story.setAttribute("aria-busy","false")); announce(t("round") + " " + (state.roundIndex+1) + " / 4"); window.requestAnimationFrame(() => $("round-title").focus());
    }
    function startGame() {
        if (!state.catalog || !els.game.hidden || !els.final.hidden) return; const filters=getFilters(); state.currentLevel=filters.level;
        const selected=Core.selectGameStories(state.catalog.stories,{...filters,excludeIds:state.recentIds},Math.random).stories;
        if (!selected || selected.length<4) { updateMatching(); return; }
        state.currentGame=selected; saveRecentStories(selected.map(story => story.id)); state.roundIndex=0; state.roundScores=[]; state.roundCompanions=[]; state.finalCompanion=null;
        els.start.hidden=true; els.filters.hidden=true; els.game.hidden=false; els.final.hidden=true; document.querySelector(".game-panel").scrollIntoView({behavior:"smooth",block:"start"}); renderRound();
    }
    function answers() { return { author:$("answer-author").value,nationality:$("answer-nationality").value,sex:$("answer-sex").value,birthDecade:Number($("answer-birthDecade").value) }; }
    function expectedLabel(field) {
        if (field === "author") return state.currentAuthor.name;
        if (field === "nationality") return state.currentAuthor.countries.join(", ");
        if (field === "sex") return t(state.currentAuthor.sex);
        return Core.formatBirthDecade(state.currentAuthor.birthDecade);
    }
    function authorStoryValue(field) { return state.currentStory && Number.isFinite(Number(state.currentStory[field])) ? state.currentStory[field] : "—"; }
    function feedbackFor(field,correct) { const select=$("answer-" + field), wrapper=select.closest(".guess-field"); wrapper.classList.toggle("is-correct",correct); wrapper.classList.toggle("is-wrong",!correct); wrapper.querySelector(".field-feedback").textContent=(correct?t("correct"):t("incorrect")) + " · " + expectedLabel(field); }
    function renderTags(author) { const tags=author.weirdTags || []; if (!tags.length) return t("noTags"); const wrap=document.createElement("span"); tags.forEach(tag => { const chip=document.createElement("span"); chip.className="tag"; const label=tag.label || String(tag); if (tag.source) { const link=document.createElement("a"); link.href=tag.source; link.target="_blank"; link.rel="noreferrer"; link.textContent=label; chip.appendChild(link); } else chip.textContent=label; wrap.appendChild(chip); }); return wrap; }
    function renderRoundResult() {
        const companionIndex=state.roundScores.length-1, score=state.roundScores[companionIndex], author=state.currentAuthor, companion=state.roundCompanions[companionIndex] || (state.roundCompanions[companionIndex]=chooseCompanion(score.points)); els.result.replaceChildren();
        const copy=document.createElement("div"); copy.className="result-copy"; const heading=document.createElement("h3"); heading.id="round-result-title"; heading.tabIndex=-1; heading.textContent=t("scoreRound") + ": " + score.points + "/10"; copy.appendChild(heading);
        const points=document.createElement("p"); points.className="result-points"; const pointNames={author:t("author"),nationality:t("nationalityAnswer"),sex:t("sex"),birthDecade:t("decade"),perfect:state.lang === "en" ? "Perfect" : "Perfecta"}; points.textContent=t("breakdown") + ": " + Object.entries(score.breakdown).filter(([,value]) => value).map(([field,value]) => (pointNames[field] || field) + " " + (value>0?"+":"") + value).join(" · "); copy.appendChild(points);
        const correct=document.createElement("p"); correct.textContent=t("authorCorrect") + ": " + author.name; copy.appendChild(correct);
        const facts=document.createElement("div"); facts.className="result-facts"; const storyTitle=document.createElement("strong"); storyTitle.textContent=state.currentStory.title; facts.appendChild(storyTitle); facts.appendChild(document.createTextNode(" · " + author.countries.join(", ") + " · " + Core.formatBirthDecade(author.birthDecade)));
        const editorial=document.createElement("p"); editorial.textContent=t("editorial") + ": " + t("familiarity") + " " + authorStoryValue("familiarity") + "/10 · " + t("complexity") + " " + authorStoryValue("readingComplexity") + "/10 · " + (state.currentStory.isClassic ? t("classic") : t("classic") + ": no"); facts.appendChild(editorial);
        if (author.source) { facts.append(document.createTextNode(" · ")); const link=document.createElement("a"); link.href=author.source; link.target="_blank"; link.rel="noreferrer"; link.textContent=t("source"); facts.appendChild(link); }
        const tags=document.createElement("div"); tags.className="result-tags"; const tagsLabel=document.createElement("strong"); tagsLabel.textContent=t("curious") + ": "; tags.appendChild(tagsLabel); const tagsContent=renderTags(author); tags.appendChild(typeof tagsContent==="string" ? document.createTextNode(tagsContent) : tagsContent); facts.appendChild(tags); copy.appendChild(facts);
        const read=document.createElement("a"); read.href=storyUrl(state.currentStory); read.className="text-button"; read.target="_blank"; read.rel="noreferrer"; read.textContent=t("storyRead"); copy.appendChild(read);
        const companionWrap=document.createElement("div"); companionWrap.className="result-companion"; const img=document.createElement("img"); img.src=companion.image; img.alt=companion.name; img.onerror=() => { img.remove(); const fallback=document.createElement("span"); fallback.className="portrait-fallback"; fallback.textContent="✦"; companionWrap.prepend(fallback); }; companionWrap.appendChild(img); const quotation=document.createElement("div"); const phrase=document.createElement("blockquote"); phrase.className="quote-text"; phrase.textContent=localizedQuote(companion); quotation.append(phrase,renderCitation(companion)); companionWrap.appendChild(quotation); els.result.append(copy,companionWrap);
        const next=document.createElement("button"); next.type="button"; next.className="ink-link"; next.textContent=state.roundIndex===3?t("finalButton"):t("nextRound"); next.addEventListener("click",() => state.roundIndex===3?showFinal():(state.roundIndex+=1,renderRound())); els.result.appendChild(next); els.result.hidden=false; els.score.textContent=String(Core.scoreGame(state.roundScores).total); announce(t("scoreRound") + ": " + score.points + " / 10"); window.requestAnimationFrame(() => heading.focus());
    }
    function showFinal() {
        els.game.hidden=true; els.final.hidden=false; state.finalShown=true; const result=Core.scoreGame(state.roundScores); state.finalCompanion=state.finalCompanion || chooseCompanion(result.average); updateFinalLanguage(); startFinalPortrait(state.finalCompanion); announce(t("finalTitle") + ": " + result.average + " / 10"); els.final.scrollIntoView({behavior:"smooth",block:"start"}); window.requestAnimationFrame(() => $("final-title").focus());
    }
    function updateFinalLanguage() { const result=Core.scoreGame(state.roundScores), companion=state.finalCompanion || chooseCompanion(result.average); state.finalCompanion=companion; els.finalAverage.textContent=String(result.average); els.finalCopy.textContent=t("finalCopy",{score:result.average}); els.companionName.textContent=companion.name; els.companionPhrase.textContent=localizedQuote(companion); els.companionSource.replaceChildren(renderCitation(companion)); els.companionPortrait.setAttribute("aria-label", (state.lang === "en" ? "Animated portrait of " : "Retrato animado de ") + companion.name); els.breakdown.replaceChildren(); state.roundScores.forEach((score,index) => { const p=document.createElement("p"); p.textContent=t("round") + " " + (index+1) + ": "; const strong=document.createElement("strong"); strong.textContent=score.points + "/10"; p.appendChild(strong); els.breakdown.appendChild(p); }); const total=document.createElement("p"); total.textContent=t("allScores",{total:result.total}); els.breakdown.appendChild(total); renderClosingQuote(); }
    function submitGuess(event) {
        event.preventDefault(); if (state.submitted || !state.storyReady) return; if (!els.form.reportValidity()) { announce(t("required")); return; } state.submitted=true;
        const score=Core.scoreRound({author:$("answer-author").value,nationality:$("answer-nationality").value,sex:$("answer-sex").value,birthDecade:Number($("answer-birthDecade").value)},{id:state.currentAuthor.id,countries:state.currentAuthor.countries,sex:state.currentAuthor.sex,birthDecade:state.currentAuthor.birthDecade});
        state.roundScores.push(score); state.roundCompanions.push(chooseCompanion(score.points)); ["author","nationality","sex","birthDecade"].forEach(field => feedbackFor(field,score.correct[field])); els.form.querySelectorAll("select").forEach(select => { select.disabled=true; }); $("submit-guess").disabled=true; renderRoundResult();
    }
    function replay() { state.finalShown=false; state.portraitToken+=1; clearAuthorImage(); state.submitted=false; state.currentAuthor=null; state.currentStory=null; state.finalCompanion=null; els.final.hidden=true; els.game.hidden=true; els.filters.hidden=false; els.start.hidden=false; els.filters.scrollIntoView({behavior:"smooth",block:"start"}); renderFilterOptions(); updateMatching(); refreshModeCopy(); els.start.focus(); }

    $("language-toggle").addEventListener("click",() => { state.lang=state.lang==="es"?"en":"es"; applyLanguage(); });
    [els.kind,els.level,els.nationality,els.genre,els.classics].forEach(control => control.addEventListener("change",() => { if (control === els.kind) { renderFilterOptions(); refreshModeCopy(); } updateMatching(); }));
    els.start.addEventListener("click",startGame); els.form.addEventListener("submit",submitGuess); $("replay-game").addEventListener("click",replay);
    state.recentIds=loadRecentStories();
    applyLanguage(); loadCatalog();
}());
