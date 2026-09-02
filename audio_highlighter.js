(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.AudioHighlighter = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const DEFAULT_OPTIONS = { targetWords: 8, maxWords: 14 };

  function segmentText(value, options = {}) {
    const text = String(value || "");
    if (!text) return [];
    const { targetWords, maxWords } = { ...DEFAULT_OPTIONS, ...options };
    const tokens = [...text.matchAll(/\S+\s*/gu)];
    if (!tokens.length) return [text];

    const phrases = [];
    let phrase = text.slice(0, tokens[0].index);
    let words = 0;

    tokens.forEach(match => {
      const token = match[0];
      const spoken = token.trimEnd();
      phrase += token;
      words += 1;

      const sentenceEnd = /[.!?…]+["'»”’)]*$/u.test(spoken);
      const clauseEnd = /[,;:]+["'»”’)]*$/u.test(spoken);
      const lineEnd = /\n/u.test(token.slice(spoken.length));
      const paragraphEnd = /\n\s*\n/u.test(token.slice(spoken.length));
      const shouldBreak = paragraphEnd
        || sentenceEnd
        || (lineEnd && words >= Math.max(4, targetWords - 2))
        || (clauseEnd && words >= targetWords)
        || words >= maxWords;

      if (shouldBreak) {
        phrases.push(phrase);
        phrase = "";
        words = 0;
      }
    });

    if (phrase) phrases.push(phrase);
    return phrases;
  }

  function phraseWeight(value) {
    const text = String(value || "");
    const words = text.match(/[\p{L}\p{N}]+/gu) || [];
    const spokenWeight = words.reduce((total, word) => {
      const vowelGroups = word.match(/[aeiouáéíóúü]+/giu)?.length || 1;
      return total + 0.72 + Math.min(1.2, vowelGroups * 0.18 + word.length * 0.025);
    }, 0);
    const commaPauses = (text.match(/[,;]/g) || []).length * 0.45;
    const sentencePauses = (text.match(/[.!?…]+/g) || []).length * 0.9;
    const paragraphPauses = (text.match(/\n\s*\n/g) || []).length * 1.35;
    return Math.max(0.5, spokenWeight + commaPauses + sentencePauses + paragraphPauses);
  }

  function buildTimeline(phrases, duration) {
    const totalDuration = Number(duration);
    if (!phrases.length || !Number.isFinite(totalDuration) || totalDuration <= 0) return [];
    const leadIn = Math.min(0.65, totalDuration * 0.01);
    const tailOut = Math.min(0.45, totalDuration * 0.005);
    const spokenDuration = Math.max(0.01, totalDuration - leadIn - tailOut);
    const weights = phrases.map(phraseWeight);
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    let cursor = leadIn;

    return phrases.map((text, index) => {
      const start = cursor;
      cursor += spokenDuration * (weights[index] / totalWeight);
      return {
        text,
        start,
        end: index === phrases.length - 1 ? totalDuration - tailOut : cursor
      };
    });
  }

  function findPhraseIndex(timeline, currentTime) {
    const time = Number(currentTime);
    if (!timeline.length || !Number.isFinite(time)) return -1;
    let low = 0;
    let high = timeline.length - 1;
    while (low <= high) {
      const middle = (low + high) >> 1;
      const phrase = timeline[middle];
      if (time < phrase.start) high = middle - 1;
      else if (time >= phrase.end) low = middle + 1;
      else return middle;
    }
    return -1;
  }

  function renderPhrases(container, phrases) {
    const fragment = document.createDocumentFragment();
    const elements = phrases.map((text, index) => {
      const phrase = document.createElement("span");
      phrase.className = "audio-phrase";
      phrase.dataset.phraseIndex = String(index);
      phrase.textContent = text;
      fragment.appendChild(phrase);
      return phrase;
    });
    container.replaceChildren(fragment);
    return elements;
  }

  function attach({ audio, container, text, follow = true }) {
    if (!audio || !container) return null;
    const phrases = segmentText(text);
    const elements = renderPhrases(container, phrases);
    const listeners = [];
    let timeline = [];
    let activeIndex = -1;
    let frame = 0;
    let destroyed = false;

    const listen = (event, handler) => {
      audio.addEventListener(event, handler);
      listeners.push([event, handler]);
    };

    const setActive = index => {
      if (index === activeIndex) return;
      if (activeIndex >= 0) elements[activeIndex]?.classList.remove("audio-phrase--active");
      activeIndex = index;
      const active = elements[activeIndex];
      if (!active) return;
      active.classList.add("audio-phrase--active");
      if (!follow || audio.paused) return;
      const bounds = active.getBoundingClientRect();
      const topEdge = Math.max(76, window.innerHeight * 0.14);
      const bottomEdge = window.innerHeight * 0.86;
      if (bounds.top < topEdge || bounds.bottom > bottomEdge) {
        const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        active.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "center" });
      }
    };

    const prepare = () => {
      timeline = buildTimeline(phrases, audio.duration);
    };

    const update = () => {
      if (!timeline.length) prepare();
      setActive(findPhraseIndex(timeline, audio.currentTime));
    };

    const stopFrame = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
    };

    const tick = () => {
      update();
      frame = !audio.paused && !audio.ended ? requestAnimationFrame(tick) : 0;
    };

    const startFrame = () => {
      stopFrame();
      tick();
    };

    listen("loadedmetadata", () => { prepare(); update(); });
    listen("durationchange", prepare);
    listen("play", startFrame);
    listen("playing", startFrame);
    listen("timeupdate", update);
    listen("seeking", update);
    listen("seeked", update);
    listen("pause", () => { stopFrame(); update(); });
    listen("ended", () => { stopFrame(); setActive(-1); });
    if (audio.readyState >= 1) prepare();
    update();

    return {
      phrases,
      get timeline() { return timeline; },
      update,
      destroy() {
        if (destroyed) return;
        destroyed = true;
        stopFrame();
        listeners.forEach(([event, handler]) => audio.removeEventListener(event, handler));
        setActive(-1);
      }
    };
  }

  return { segmentText, phraseWeight, buildTimeline, findPhraseIndex, attach };
});
