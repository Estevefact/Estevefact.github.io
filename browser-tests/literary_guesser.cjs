const assert = require("node:assert/strict");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");
const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png" };
function makeServer() {
    return http.createServer((request, response) => {
        const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
        const requested = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
        const file = path.resolve(root, requested);
        if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
            response.writeHead(404).end();
            return;
        }
        response.setHeader("Content-Type", (mime[path.extname(file)] || "application/octet-stream") + (mime[path.extname(file)]?.startsWith("text/") ? "; charset=utf-8" : ""));
        fs.createReadStream(file).pipe(response);
    });
}

async function answerRound(page, answer) {
    await page.locator("#answer-author").selectOption({ label: answer.author });
    await page.locator("#answer-nationality").selectOption(answer.country);
    await page.locator("#answer-sex").selectOption(answer.sex);
    await page.locator("#answer-birthDecade").selectOption(answer.decade);
    await page.getByRole("button", { name: /Revelar mi respuesta|Reveal my answer/ }).click();
    await page.waitForSelector("#round-result:not([hidden])");
}

(async () => {
    const server = makeServer();
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    const base = "http://127.0.0.1:" + server.address().port;
    const browser = await chromium.launch({ headless: true, executablePath: fs.existsSync("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome") ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" : undefined });
    try {
        const catalog = JSON.parse(fs.readFileSync(path.join(root, "static/literaryGuesserCatalog.json"), "utf8"));
        const authors = new Map(catalog.authors.map(author => [author.id, author]));
        const texts = new Map(catalog.stories.map(story => [story.id, story]));
        const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
        let pageCurrentText;
        const firstGameIds = [], roundQuotes = [];
        page.on("request", request => {
            const match = request.url().match(/\/static\/(Cuentos|Poemas)\/([^/]+)\.json$/);
            if (match) pageCurrentText = { kind:match[1] === "Poemas" ? "poem" : "story",id:match[2] };
        });
        await page.goto(base + "/literary-guesser.html");
        await page.waitForFunction(() => document.querySelector("#matching-count")?.textContent !== "—");
        assert.equal(await page.getByRole("button", { name: "Comenzar partida" }).isEnabled(), true);
        assert.equal(await page.locator(".guesser-intro").innerText(), "Lee un cuento breve y adivina su procedencia");
        assert.match(await page.locator("#game-mode").innerText(), /coemas/i);
        assert.equal(await page.locator(".curious-note").count(), 0);
        assert.equal(await page.evaluate(() => {
            const intro = document.querySelector(".guesser-intro").getBoundingClientRect();
            const start = document.querySelector("#start-game").getBoundingClientRect();
            return start.top >= intro.bottom && start.bottom <= innerHeight;
        }), true);
        await page.locator("#kind-filter").selectOption("story");
        await page.getByRole("button", { name: "Comenzar partida" }).click();
        assert.equal(await page.locator(".filters-panel").isHidden(), true);
        await page.waitForSelector("#story-text p");
        await page.locator("#language-toggle").click();
        assert.equal(await page.locator("#answer-sex option[value=male]").innerText(), "Male");
        assert.equal(await page.locator("#round-level").innerText(), "EASY");
        await page.locator("#language-toggle").click();
        for (let index = 0; index < 4; index += 1) {
            await page.waitForFunction(() => !document.querySelector("#submit-guess")?.disabled);
            const text=texts.get(pageCurrentText.id), author=authors.get(text.authorId);
            firstGameIds.push(pageCurrentText.id);
            await answerRound(page,{ author:author.name,country:author.countries[0],sex:author.sex,decade:String(author.birthDecade) });
            assert.equal(await page.locator(".field-feedback").count(), 4);
            assert.match(await page.locator("#round-result").innerText(), /10\/10/);
            roundQuotes.push(await page.locator("#round-result .quote-text").innerText());
            if (index) assert.notEqual(roundQuotes[index],roundQuotes[index-1]);
            assert.match(await page.locator("#round-result .quote-source").innerText(), /Jorge Luis Borges/);
            assert.match(await page.locator("#round-result .quote-source a").getAttribute("href"), /^https:\/\//);
            await page.waitForFunction(() => document.activeElement?.id === "round-result-title");
            if (index === 0) {
                const quoteEs=roundQuotes[0];
                const selected = await page.locator(".guess-field select").evaluateAll(selects => selects.map(select => select.value));
                await page.locator("#language-toggle").click();
                assert.equal(await page.locator("#answer-sex option[value=male]").innerText(), "Male");
                assert.equal((await page.locator(".field-feedback").first().innerText()).startsWith("Correct"), true);
                assert.deepEqual(await page.locator(".guess-field select").evaluateAll(selects => selects.map(select => select.value)), selected);
                await page.locator("#language-toggle").click();
                assert.equal(await page.locator("#round-result .quote-text").innerText(),quoteEs);
            }
            await page.getByRole("button", { name: index === 3 ? "Ver mi resultado" : "Siguiente ronda" }).click();
            if (index < 3) await page.waitForSelector("#story-text p");
        }
        await page.waitForSelector("#final-panel:not([hidden])");
        assert.equal(await page.locator("#companion-name").innerText(), "Jorge Luis Borges");
        assert.equal(await page.locator("#final-copy").innerText(), "Tu promedio fue 10 sobre 10.");
        assert.match(await page.locator("#companion-source").innerText(), /Jorge Luis Borges/);
        assert.match(await page.locator("#companion-source a").getAttribute("href"), /^https:\/\//);
        assert.match(await page.locator("#final-closing-quote").innerText(), /Miguel de Cervantes.*Don Quijote de la Mancha/s);
        assert.equal(await page.locator("#final-closing-quote a").getAttribute("href"), "https://cvc.cervantes.es/literatura/clasicos/quijote/edicion/parte2/cap25/cap25_02.htm");
        assert.ok(["fallback","drawing","revealing","complete"].includes(await page.locator("#drawing").getAttribute("data-animation-phase")));
        assert.equal(await page.locator("#drawing img, #drawing canvas").count(), 1);
        await page.locator("#drawing").evaluate(node => { node.dataset.languageCheck = "preserved"; });
        const finalQuoteEs=await page.locator("#companion-phrase").innerText();
        await page.locator("#language-toggle").click();
        assert.equal(await page.locator("#final-copy").innerText(), "Your average was 10 out of 10.");
        assert.match(await page.locator("#companion-source").innerText(), /COEM English translation/);
        assert.equal(await page.locator("#drawing").getAttribute("data-language-check"), "preserved");
        await page.locator("#language-toggle").click();
        assert.equal(await page.locator("#companion-phrase").innerText(),finalQuoteEs);
        if (process.env.LITERARY_GUESSER_SCREENSHOT) await page.screenshot({ path: process.env.LITERARY_GUESSER_SCREENSHOT, fullPage: true });
        await page.getByRole("button", { name: "Jugar otra partida" }).click();
        assert.equal(await page.locator(".filters-panel").isHidden(), false);
        assert.equal(new Set(firstGameIds).size,4);
        await page.reload();
        await page.waitForFunction(() => !document.querySelector("#start-game").disabled);
        await page.locator("#kind-filter").selectOption("story");
        await page.locator("#start-game").click();
        const recentAfterReload=await page.evaluate(() => JSON.parse(localStorage.getItem("coem:literary-guesser:recent-stories")));
        const secondGameIds=recentAfterReload.slice(-4);
        assert.equal(secondGameIds.length,4);
        assert.equal(secondGameIds.some(id => firstGameIds.includes(id)),false);
        await page.reload();
        await page.waitForFunction(() => !document.querySelector("#start-game").disabled);
        await page.locator("#level-filter").selectOption("hard");
        await page.locator("#language-toggle").click();
        assert.equal(await page.locator("html").getAttribute("lang"), "en");
        assert.match(await page.locator("#game-title").innerText(), /Literary guesser/);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        await page.emulateMedia({ reducedMotion: "reduce" });
        assert.equal(await page.locator(".guesser-start").evaluate(element => getComputedStyle(element, "::after").animationName), "none");
        await page.setViewportSize({ width: 320, height: 640 });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);

        const modesPage = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
        const errors = [];
        modesPage.on("pageerror", error => errors.push(error.message));
        let currentText;
        modesPage.on("request", request => {
            const match = request.url().match(/\/static\/(Cuentos|Poemas)\/([^/]+)\.json$/);
            if (match) currentText = { kind: match[1] === "Poemas" ? "poem" : "story", id: match[2] };
        });
        await modesPage.goto(base + "/literary-guesser.html");
        await modesPage.waitForFunction(() => !document.querySelector("#start-game").disabled);
        assert.equal(await modesPage.locator(".filters-panel select").first().getAttribute("id"), "kind-filter");
        assert.equal(await modesPage.locator("#kind-filter").inputValue(), "both");
        for (const mode of ["poem", "both"]) {
            await modesPage.locator("#kind-filter").selectOption(mode);
            await modesPage.locator("#start-game").click();
            const kinds = new Set(), ids = new Set();
            for (let index = 0; index < 4; index += 1) {
                await modesPage.waitForFunction(() => !document.querySelector("#submit-guess").disabled);
                const text = texts.get(currentText.id), author = authors.get(text.authorId);
                kinds.add(currentText.kind); ids.add(currentText.id);
                if (mode === "poem") assert.equal(currentText.kind, "poem");
                const labels = await modesPage.locator("#answer-author option:not([value=''])").allTextContents();
                assert.equal(new Set(labels).size, labels.length, "Author choices must be unambiguous");
                if (currentText.kind === "poem") {
                    assert.equal(await modesPage.locator("#story-text p").first().evaluate(node => getComputedStyle(node).whiteSpace), "pre-wrap");
                }
                assert.equal(await modesPage.locator("#round-result").isHidden(), true);
                await answerRound(modesPage, { author: author.name, country: author.countries[0], sex: author.sex, decade: String(author.birthDecade) });
                assert.match(await modesPage.locator("#round-result").innerText(), /10\/10/);
                assert.equal(await modesPage.locator("#round-result a[href*='-info.html']").getAttribute("href"),
                    (currentText.kind === "poem" ? "poems-info.html?poem=" : "stories-info.html?story=") + currentText.id);
                await modesPage.getByRole("button", { name: index === 3 ? "Ver mi resultado" : "Siguiente ronda" }).click();
            }
            assert.equal(ids.size, 4);
            if (mode === "both") assert.deepEqual([...kinds].sort(), ["poem", "story"]);
            assert.equal(await modesPage.locator("#final-average").innerText(), "10");
            assert.equal(await modesPage.locator("#companion-name").innerText(), "Jorge Luis Borges");
            assert.equal(await modesPage.locator("#drawing").getAttribute("data-animation-phase"), "fallback");
            assert.equal(await modesPage.locator("#drawing img").count(), 1);
            await modesPage.getByRole("button", { name: "Jugar otra partida" }).click();
            assert.equal(await modesPage.locator("#kind-filter").inputValue(), mode);
        }
        await modesPage.locator("#kind-filter").selectOption("poem");
        await modesPage.locator("#classic-filter").check();
        await modesPage.locator("#nationality-filter").selectOption("España");
        await modesPage.locator("#level-filter").selectOption("medium");
        await modesPage.locator("#start-game").click();
        await modesPage.waitForFunction(() => !document.querySelector("#submit-guess").disabled);
        assert.equal(texts.get(currentText.id).kind, "poem");
        assert.equal(texts.get(currentText.id).isClassic, 1);
        assert.ok(authors.get(texts.get(currentText.id).authorId).countries.includes("España"));
        assert.deepEqual(errors, []);

        const retryPage = await browser.newPage();
        let failOnce = true;
        await retryPage.route("**/static/Cuentos/*.json", route => {
            if (failOnce) { failOnce = false; route.abort(); } else route.continue();
        });
        await retryPage.goto(base + "/literary-guesser.html");
        await retryPage.waitForFunction(() => document.querySelector("#matching-count")?.textContent !== "—");
        await retryPage.locator("#kind-filter").selectOption("story");
        await retryPage.getByRole("button", { name: "Comenzar partida" }).click();
        await retryPage.waitForSelector("#story-text .text-button");
        assert.match(await retryPage.locator("#story-text").innerText(), /No pudimos cargar|could not load/i);
        await retryPage.getByRole("button", { name: "Intentar de nuevo" }).click();
        await retryPage.waitForFunction(() => !document.querySelector("#submit-guess")?.disabled);
        assert.equal(await retryPage.locator("#story-text .text-button").count(),0);
    } finally {
        await browser.close();
        server.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
