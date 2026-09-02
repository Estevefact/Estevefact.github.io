const assert = require("node:assert/strict");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");
const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };
const server = http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
  const requested = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const file = path.resolve(root, requested);
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    response.writeHead(404).end();
    return;
  }
  const contentType = mime[path.extname(file)] || "application/octet-stream";
  response.setHeader("Content-Type", contentType.startsWith("text/") ? `${contentType}; charset=utf-8` : contentType);
  fs.createReadStream(file).pipe(response);
});

async function assertAutocompleteScrolls(page, label) {
  await page.waitForFunction(() => document.querySelector("#autocomplete-container")?.children.length > 0);
  const metrics = await page.locator("#autocomplete-container").evaluate(element => {
    const styles = getComputedStyle(element);
    return {
      clientHeight: element.clientHeight,
      overflowY: styles.overflowY,
      scrollHeight: element.scrollHeight
    };
  });
  assert.equal(metrics.overflowY, "auto", `${label} autocomplete should allow vertical scrolling`);
  assert.ok(
    metrics.scrollHeight > metrics.clientHeight,
    `${label} autocomplete should have scrollable overflow`
  );
}

async function assertReadableCompactList(page, selector, label) {
  const button = page.locator(`${selector} button`).first();
  await button.waitFor();
  const typography = await button.evaluate(element => {
    const styles = getComputedStyle(element);
    return {
      family: styles.fontFamily,
      size: Number.parseFloat(styles.fontSize),
      lineHeight: Number.parseFloat(styles.lineHeight),
      weight: Number.parseInt(styles.fontWeight, 10)
    };
  });
  assert.match(typography.family, /Cormorant Garamond/, `${label} should use the readable serif`);
  assert.ok(typography.size >= 18, `${label} text should be at least 18px`);
  assert.ok(typography.lineHeight >= 25, `${label} should have a generous line height`);
  assert.ok(typography.weight >= 600, `${label} should have a legible weight`);
}

(async () => {
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const chromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  const browser = await chromium.launch({
    headless: true,
    ...(fs.existsSync(chromePath) ? { executablePath: chromePath } : {})
  });
  const page = await browser.newPage();
  try {
    await page.goto(`${base}/`);
    await page.evaluate(() => sessionStorage.setItem("coem:hero-portrait-offset", "17"));
    await page.reload();
    const firstPortraitNames = await page.locator("[data-hero-portrait] figcaption").allTextContents();
    assert.deepEqual(firstPortraitNames, ["Carl Sagan", "Emily Dickinson", "Franz Kafka"]);
    const carlPortrait = page.locator("[data-hero-portrait] img").first();
    assert.match(await carlPortrait.getAttribute("src"), /static\/imgs\/Sagan\.png$/);
    assert.equal(await carlPortrait.evaluate(image => image.naturalWidth), 1024);
    await page.reload();
    const secondPortraitNames = await page.locator("[data-hero-portrait] figcaption").allTextContents();
    assert.notDeepEqual(secondPortraitNames, firstPortraitNames);
    assert.equal(new Set(secondPortraitNames).size, 3);

    assert.equal(await page.getByRole("tab").count(), 6);
    await page.getByRole("tab", { name: /02 Poemas/ }).click();
    assert.equal(await page.locator("#route-title").innerText(), "Poemas");
    assert.match(await page.locator("#route-image").getAttribute("src"), /Pizarnik\.png$/);
    await page.getByRole("tab", { name: /02 Poemas/ }).press("ArrowRight");
    assert.equal(await page.locator("#route-title").innerText(), "Relaciones");
    assert.equal(await page.getByRole("tab", { name: /03 Relaciones/ }).getAttribute("aria-selected"), "true");

    await page.goto(`${base}/stories-info.html`);
    await page.getByRole("button", { name: "Cambiar tema" }).click();
    await page.waitForFunction(() => document.documentElement.dataset.theme === "dark");
    const darkTheme = await page.evaluate(() => ({
      bodyBackground: getComputedStyle(document.body).backgroundColor,
      bodyColor: getComputedStyle(document.body).color,
      discoveryBackground: getComputedStyle(document.querySelector(".reader-discovery")).backgroundColor,
      discoveryColor: getComputedStyle(document.querySelector(".reader-discovery")).color,
      buttonColor: getComputedStyle(document.querySelector(".reader-button")).color,
      storyBackground: getComputedStyle(document.querySelector("#cuentoText")).backgroundColor,
      surprise: (() => {
        const button = document.querySelector("#surprise-button");
        const styles = getComputedStyle(button);
        return {
          background: styles.backgroundColor,
          color: styles.color,
          visible: button.getBoundingClientRect().width > 0 && styles.visibility === "visible" && styles.opacity === "1"
        };
      })()
    }));
    assert.deepEqual(darkTheme, {
      bodyBackground: "rgb(24, 23, 19)",
      bodyColor: "rgb(241, 238, 229)",
      discoveryBackground: "rgb(24, 23, 19)",
      discoveryColor: "rgb(241, 238, 229)",
      buttonColor: "rgb(241, 238, 229)",
      storyBackground: "rgb(24, 23, 19)",
      surprise: {
        background: "rgb(24, 23, 19)",
        color: "rgb(241, 238, 229)",
        visible: true
      }
    });
    await page.getByRole("button", { name: "Cambiar tema" }).click();
    await page.waitForFunction(() => document.documentElement.dataset.theme === "light");
    await assertReadableCompactList(page, "#stories-list", "Story list");
    await assertReadableCompactList(page, "#top-authors-list", "Related story authors");

    await page.getByRole("searchbox", { name: "Buscar en todo" }).fill("a");
    await assertAutocompleteScrolls(page, "Stories");
    await page.getByRole("searchbox", { name: "Buscar en todo" }).fill("Borges");
    await page.getByRole("combobox", { name: "País" }).selectOption({ label: "Argentina" });
    await page.getByRole("button", { name: "Limpiar filtros" }).click();
    assert.equal(await page.getByRole("searchbox", { name: "Buscar en todo" }).inputValue(), "");
    assert.equal(await page.getByRole("combobox", { name: "País" }).inputValue(), "");

    const originalStory = await page.locator("h1").innerText();
    await page.getByRole("button", { name: "Sorpréndeme" }).click();
    await page.waitForFunction(title => document.querySelector("h1")?.textContent !== title, originalStory);
    assert.notEqual(await page.locator("h1").innerText(), originalStory);

    await page.getByRole("combobox", { name: "País" }).selectOption({ label: "Colombia" });
    await page.getByRole("combobox", { name: "Género" }).selectOption({ label: "Unknown" });
    await page.getByRole("combobox", { name: "Duración máxima" }).selectOption("5");
    const prefilteredStory = await page.locator("h1").innerText();
    await page.getByRole("button", { name: "Sorpréndeme" }).click();
    await page.waitForFunction(title => document.querySelector("h1")?.textContent !== title, prefilteredStory);
    const selectedFacts = await page.locator(".author-facts").innerText();
    assert.match(selectedFacts, /Colombia/);
    assert.match(selectedFacts, /Unknown/);

    await page.goto(`${base}/poems-info.html`);
    await page.getByRole("searchbox", { name: "Buscar en todo" }).fill("a");
    await assertAutocompleteScrolls(page, "Poems");
    await page.getByRole("searchbox", { name: "Buscar en todo" }).fill("Borges");
    const poemResult = page.locator("#autocomplete-container button").first();
    await poemResult.waitFor();
    await poemResult.click();
    await page.waitForFunction(() =>
      document.querySelector("#poemTitle")?.textContent === document.querySelector("#author-search")?.value
    );
    assert.equal(await page.locator("#poemTitle").innerText(), await page.getByRole("searchbox").inputValue());
    await assertReadableCompactList(page, "#poems-by-author", "Poem list");
    await assertReadableCompactList(page, "#related-poem-authors", "Related poem authors");

    await page.goto(`${base}/test/fixtures/map_controls.html`);
    const filter = page.getByRole("button", { name: "Filtrar por Nombre" });
    await filter.click();
    assert.equal(await filter.getAttribute("aria-expanded"), "true");
    await page.keyboard.press("Escape");
    assert.equal(await filter.getAttribute("aria-expanded"), "false");
    await filter.press("ArrowDown");
    assert.equal(await page.getByRole("menuitemradio", { name: "Nombre" }).evaluate(el => document.activeElement === el), true);
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    const authorSearch = page.getByRole("combobox");
    await authorSearch.fill("Colombia");
    await authorSearch.press("ArrowDown");
    await page.keyboard.press("Enter");
    assert.equal(
      await page.locator("#selected-author").evaluate(element => element.value),
      "Gabriel García Márquez"
    );
    assert.equal(
      await page.locator("#semantic-recommendations").evaluate(element => element.value),
      "Jorge Luis Borges · 79% de similitud · Argentina · Ficción · 1899"
    );
    assert.equal(await page.locator("#autocomplete-container > button").count(), 0);

    await page.setViewportSize({ width: 390, height: 844 });
    for (const route of [
      "/",
      "/stories-info.html",
      "/poems-info.html",
      "/authorToAuthor3DSmall.html",
      "/authorToAuthor3D.html",
      "/embeddings.html"
    ]) {
      await page.goto(`${base}${route}`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(500);
      assert.equal(
        await page.evaluate(() =>
          document.documentElement.scrollWidth <= document.documentElement.clientWidth
        ),
        true,
        `${route} has horizontal overflow at 390px`
      );
      if (route === "/stories-info.html" || route === "/poems-info.html") {
        const compactButton = page.locator(".compact-list button").first();
        await compactButton.waitFor();
        const bounds = await compactButton.evaluate(element => {
          const rect = element.getBoundingClientRect();
          return { height: rect.height, left: rect.left, right: rect.right };
        });
        assert.ok(bounds.height >= 44, `${route} compact links are too small for touch`);
        assert.ok(bounds.left >= 0 && bounds.right <= 390, `${route} compact links overflow the viewport`);
      }
    }

    await page.goto(`${base}/authorToAuthor3DSmall.html`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(500);
    for (const selector of ["#toggle-popup-btn", "#filter-button", "#author-search", "#follow-author-btn"]) {
      assert.ok(
        await page.locator(selector).evaluate(element => element.getBoundingClientRect().height >= 44),
        `${selector} is too small for touch`
      );
    }
    await page.getByRole("button", { name: "Ocultar Info Autor" }).click();
    assert.equal(await page.locator("#popup").evaluate(element => getComputedStyle(element).display), "none");
    assert.equal(await page.locator("#container").evaluate(element =>
      Math.round(element.getBoundingClientRect().width)
    ), 390);
  } finally {
    await browser.close();
    server.close();
  }
  console.log("Browser flows passed");
})().catch(error => {
  console.error(error);
  server.close();
  process.exitCode = 1;
});
