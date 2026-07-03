let coemPortraitSketch = null;
let coemAnimationRun = 0;
const COEM_PORTRAIT_TIMING = Object.freeze({
  drawingDuration: 4200,
  revealDuration: 1400
});
let coemP5Promise = null;

function loadCoemPortraitAnimator(onReady) {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (typeof window.p5 === "function") {
    onReady?.();
    return Promise.resolve(true);
  }
  if (!coemP5Promise) {
    coemP5Promise = new Promise(resolve => {
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.11.0/p5.min.js";
      script.async = true;
      script.addEventListener("load", () => resolve(typeof window.p5 === "function"), { once: true });
      script.addEventListener("error", () => resolve(false), { once: true });
      document.head.appendChild(script);
    });
  }
  return coemP5Promise.then(loaded => {
    if (loaded) onReady?.();
    return loaded;
  });
}

function renderPortraitFallback(container, providedURL) {
  container.replaceChildren();
  container.dataset.animationPhase = "fallback";
  const image = document.createElement("img");
  image.src = `static/imgs/${encodeURIComponent(providedURL || "Sagan.png")}`;
  image.alt = "Retrato del autor";
  image.addEventListener("error", () => { image.src = "preview.png"; }, { once: true });
  container.appendChild(image);
}

/**
 * Restart the p5 portrait reveal. A fresh instance is created for every selected
 * story, which makes the transition deterministic and prevents orphan canvases.
 */
function resetAuthorImage(providedURL) {
  const container = document.getElementById("drawing");
  if (!container) return;
  container.dataset.animationRun = String(++coemAnimationRun);
  if (coemPortraitSketch) {
    coemPortraitSketch.remove();
    coemPortraitSketch = null;
  }
  container.replaceChildren();

  if (typeof window.p5 !== "function") {
    renderPortraitFallback(container, providedURL);
    return;
  }

  coemPortraitSketch = new window.p5(p => {
    let portrait;
    let failed = false;
    let particles = [];
    let startedAt = 0;
    const size = 250;
    const maxParticles = 1000;
    const particleSpeed = .5;
    const { drawingDuration, revealDuration } = COEM_PORTRAIT_TIMING;

    function createParticles(amount) {
      for (let index = 0; index < amount; index += 1) {
        const angle = p.random(p.TWO_PI);
        particles.push({
          position: p.createVector(p.random(size), p.random(size)),
          velocity: p.createVector(p.cos(angle), p.sin(angle)).setMag(particleSpeed)
        });
      }
    }

    p.preload = () => {
      portrait = p.loadImage(
        `static/imgs/${encodeURIComponent(providedURL || "Sagan.png")}`,
        undefined,
        () => { failed = true; }
      );
    };

    p.setup = () => {
      const canvas = p.createCanvas(size, size);
      canvas.parent(container);
      p.pixelDensity(1);
      p.frameRate(60);
      const dark = document.documentElement.dataset.theme === "dark";
      const background = dark ? [36, 48, 52] : [238, 231, 218];
      p.background(...background);
      if (failed || !portrait || !portrait.width) {
        p.remove();
        coemPortraitSketch = null;
        renderPortraitFallback(container, providedURL);
        return;
      }
      portrait.resize(size, size);
      portrait.loadPixels();
      createParticles(200);
      startedAt = p.millis();
      container.dataset.animationPhase = "drawing";
    };

    p.draw = () => {
      if (!portrait || failed || !portrait.pixels.length) return;
      const elapsed = p.millis() - startedAt;
      if (elapsed <= drawingDuration) {
        particles.forEach(particle => {
          particle.position.add(particle.velocity);
          particle.velocity.rotate(p.random(-p.PI / 5, p.PI / 5));
          particle.velocity.setMag(particleSpeed);
          particle.position.x = (particle.position.x + size) % size;
          particle.position.y = (particle.position.y + size) % size;
          const pixel = 4 * (
            Math.floor(particle.position.y) * size +
            Math.floor(particle.position.x)
          );
          p.stroke(
            portrait.pixels[pixel],
            portrait.pixels[pixel + 1],
            portrait.pixels[pixel + 2],
            220
          );
          p.strokeWeight(1);
          p.point(particle.position.x, particle.position.y);
        });
        if (particles.length < maxParticles) {
          createParticles(Math.min(200, maxParticles - particles.length));
        }
      } else {
        container.dataset.animationPhase = "revealing";
        const alpha = Math.min(255, ((elapsed - drawingDuration) / revealDuration) * 255);
        p.tint(255, alpha);
        p.image(portrait, 0, 0, size, size);
      }

      if (elapsed > drawingDuration + revealDuration) {
        p.tint(255);
        p.image(portrait, 0, 0, size, size);
        container.dataset.animationPhase = "complete";
        p.noLoop();
      }
    };
  });
}

if (typeof module === "object" && module.exports) {
  module.exports = { COEM_PORTRAIT_TIMING, loadCoemPortraitAnimator };
}
