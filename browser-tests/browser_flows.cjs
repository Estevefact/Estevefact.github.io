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
    await page.goto(`${base}/stories-info.html`);
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
    await page.getByRole("searchbox", { name: "Buscar en todo" }).fill("Borges");
    const poemResult = page.locator("#autocomplete-container button").first();
    await poemResult.waitFor();
    await poemResult.click();
    await page.waitForFunction(() =>
      document.querySelector("#poemTitle")?.textContent === document.querySelector("#author-search")?.value
    );
    assert.equal(await page.locator("#poemTitle").innerText(), await page.getByRole("searchbox").inputValue());

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
