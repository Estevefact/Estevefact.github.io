const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');

// Start a static server, then run: node browser-tests/landing.cjs
const base = process.env.LANDING_TEST_URL || 'http://127.0.0.1:8080';
const titleText = 'Esbozando el mapa de la literatura clásica.';

(async () => {
    const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    const browser = await chromium.launch({
        headless: true,
        ...(fs.existsSync(chromePath) ? { executablePath: chromePath } : {})
    });
    try {
        for (const width of [320, 390, 1280]) {
            const context = await browser.newContext({ viewport: { width, height: width === 320 ? 568 : 844 }, deviceScaleFactor: 2,
                isMobile: width < 900, hasTouch: width < 900 });
            const page = await context.newPage();
            const errors = [];
            const requests = [];
            page.on('pageerror', error => errors.push(error.message));
            page.on('request', request => requests.push(request.url()));
            await page.addInitScript(() => sessionStorage.setItem('coem:hero-portrait-offset', '30'));
            // Hold all large images so we can inspect real cold-load previews.
            await page.route('**/static/landing/*.webp', async route => {
                await new Promise(resolve => setTimeout(resolve, 600));
                await route.continue();
            });
            await page.goto(base, { waitUntil: 'domcontentloaded' });
            await page.waitForFunction(() => document.querySelectorAll('.route-tab').length === 7);
            assert.deepEqual(await page.locator('[data-hero-portrait] figcaption').allTextContents(),
                ['Carl Sagan', 'Emily Dickinson', 'Franz Kafka']);
            assert.ok(await page.locator('[data-hero-portrait] img').evaluateAll(images =>
                images.every(image => image.src.startsWith('data:image/webp') && image.naturalWidth > 0)));
            await page.waitForFunction(() => [...document.querySelectorAll('[data-hero-portrait] img')]
                .every(image => !image.src.startsWith('data:') && image.complete && image.naturalWidth > 0));
            assert.ok(requests.every(url => !url.includes('/static/imgs/')), 'No original PNG downloads');
            assert.ok(requests.every(url => new URL(url).origin === new URL(base).origin), 'No third-party requests');
            assert.ok(!requests.some(url => /Pizarnik|cortazar|Marquez|Borges/.test(url)), 'No eager route downloads');

            // The initially selected stories tab must still take readers to its action.
            await page.getByRole('tab', { name: /01 Cuentos/ }).click();
            await page.waitForFunction(() => {
                const bounds = document.querySelector('#route-link').getBoundingClientRect();
                return Math.abs((bounds.top + bounds.bottom) / 2 - innerHeight / 2) < 3;
            });
            assert.equal(await page.locator('#route-link').innerText(), 'Explorar cuentos');
            assert.equal(await page.locator('#route-link').getAttribute('href'), 'stories-info.html');

            await page.getByRole('tab', { name: /02 Poemas/ }).click();
            assert.match(await page.locator('#route-image').getAttribute('src'), /^data:image\/webp/);
            await page.getByRole('tab', { name: /03 Relaciones/ }).click();
            await page.waitForFunction(() => document.querySelector('#route-image').src.endsWith('cortazar-480.webp'));
            await page.waitForLoadState('networkidle');
            assert.match(await page.locator('#route-image').getAttribute('src'), /cortazar-480.webp$/);
            assert.equal(await page.locator('#route-image').getAttribute('alt'), 'Retrato de Julio Cortázar');
            await page.route('**/static/landing/Marquez-*.webp', route => route.abort());
            await page.getByRole('tab', { name: /05 Autores/ }).click();
            await page.waitForLoadState('networkidle');
            assert.ok(await page.locator('#route-image').evaluate(image => image.src.startsWith('data:') && image.naturalWidth > 0),
                'An unavailable full image leaves the preview visible');
            await page.getByRole('tab', { name: /05 Autores/ }).press('ArrowRight');
            assert.equal(await page.locator('#route-title').innerText(), 'Describir');

            // Every route must reveal a usable action, including horizontally scrolled phone tabs.
            for (let index = 0; index < 7; index++) {
                const tab = page.getByRole('tab').nth(index);
                if (width < 900) await tab.tap();
                else await tab.click();
                await page.waitForFunction(() => {
                    const link = document.querySelector('#route-link');
                    const bounds = link.getBoundingClientRect();
                    return bounds.left >= 0 && bounds.right <= innerWidth && bounds.top >= 0 &&
                        bounds.bottom <= innerHeight &&
                        Math.abs((bounds.top + bounds.bottom) / 2 - innerHeight / 2) < 20 &&
                        link.contains(document.elementFromPoint(
                            (bounds.left + bounds.right) / 2, (bounds.top + bounds.bottom) / 2));
                });
                assert.equal(await tab.getAttribute('aria-selected'), 'true');
                assert.ok(await page.locator('#route-link').getAttribute('href'));
                await page.locator('#route-link').click({ trial: true });
                assert.ok(await page.evaluate(() => document.documentElement.scrollWidth) <= width,
                    `Route ${index + 1} overflows at ${width}px`);
            }

            const heading = page.locator('#colophon-title');
            await heading.scrollIntoViewIfNeeded();
            await page.waitForFunction(() => document.querySelector('#colophon-title').classList.contains('is-writing'));
            assert.equal(await heading.getAttribute('aria-label'), titleText);
            assert.ok(await heading.locator('.calligraphy-stroke').count() > 40);
            // Check overflow throughout writing, including feather travel at the right edge.
            for (let sample = 0; sample < 12; sample++) {
                assert.ok(await page.evaluate(() => document.documentElement.scrollWidth) <= width, `Overflow at ${width}px`);
                if (width === 390 && sample === 3 && process.env.LANDING_SCREENSHOT_DIR) {
                    await page.screenshot({ path: path.join(process.env.LANDING_SCREENSHOT_DIR, 'landing-quill-mobile.png') });
                }
                await page.waitForTimeout(800);
            }
            await page.waitForFunction(() => document.querySelector('#colophon-title').classList.contains('is-written'));
            assert.equal(await heading.locator('.writing-quill').count(), 0);
            if (width === 390 && process.env.LANDING_SCREENSHOT_DIR) {
                await page.screenshot({ path: path.join(process.env.LANDING_SCREENSHOT_DIR, 'landing-complete-mobile.png') });
            }
            assert.ok(await heading.locator('.calligraphy-stroke').evaluateAll(paths => paths.every(path => path.style.strokeDashoffset === '0')));
            assert.deepEqual(errors, []);
            console.log(`Landing verified at ${width}px: previews, all route actions, route races, offline fallback, quill, overflow, keyboard`);
            await context.close();
        }
        // All twelve new portraits participate in rotation and decode successfully.
        const added = await browser.newPage({ viewport: { width: 390, height: 844 } });
        for (const [offset, expected] of [
            [16, ['Ernest Hemingway', 'H. P. Lovecraft', 'Hermann Hesse']],
            [19, ['Rainer Maria Rilke', 'Charles Baudelaire', 'Gabriela Mistral']],
            [22, ['Clarice Lispector', 'Alejo Carpentier', 'Carlos Fuentes']],
            [25, ['Rosario Castellanos', 'Alfonsina Storni', 'Miguel Ángel Asturias']]
        ]) {
            await added.goto(base);
            await added.evaluate(value => sessionStorage.setItem('coem:hero-portrait-offset', String(value)), offset);
            await added.reload();
            await added.waitForFunction(() => [...document.querySelectorAll('[data-hero-portrait] img')]
                .every(img => img.src.includes('-480.webp') && img.complete && img.naturalWidth > 0));
            assert.deepEqual(await added.locator('[data-hero-portrait] figcaption').allTextContents(), expected);
        }
        await added.close();
        console.log('All twelve new author portraits verified');
        const reduced = await browser.newPage({ reducedMotion: 'reduce', viewport: { width: 390, height: 844 } });
        await reduced.goto(base);
        assert.equal(await reduced.locator('#colophon-title').innerText(), titleText);
        assert.equal(await reduced.locator('.writing-quill').count(), 0);
        for (let index = 0; index < 7; index++) {
            await reduced.getByRole('tab').nth(index).click();
            assert.ok(await reduced.locator('#route-link').evaluate(link => {
                const bounds = link.getBoundingClientRect();
                return bounds.top >= 0 && bounds.bottom <= innerHeight;
            }), 'Reduced-motion navigation immediately reveals every route action');
        }
        const noJS = await browser.newPage({ javaScriptEnabled: false });
        await noJS.goto(base);
        assert.equal(await noJS.locator('#colophon-title').innerText(), titleText);
        assert.equal(await noJS.locator('[data-hero-portrait] noscript img').count(), 3);
        console.log('Reduced motion and no-JavaScript fallbacks verified');
    } finally {
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
