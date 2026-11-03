import { test, expect } from '@playwright/test';
test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
        if (!localStorage.getItem('tucatv-epg-settings'))
            localStorage.setItem('tucatv-epg-settings', JSON.stringify({ automatic: false, disabled: [] }));
    });
});

const channels = (count = 160) =>
    Array.from({ length: count }, (_, i) => ({
        name: 'Canale ' + i,
        group: 'Categoria ' + i,
        tvg: 'channel-' + i,
        url: 'https://example.test/live/' + i,
        logo: 'https://example.test/logo.svg',
    }));
const list = (id, items, extra = {}) => ({
    id,
    name: 'Lista ' + id,
    channels: items,
    source: '',
    epg: '',
    updated: Date.now(),
    ...extra,
});
const stamp = (t) => new Date(t).toISOString().replace(/[-:T]/g, '').slice(0, 14) + ' +0000';
const guide = (title) =>
    `<tv><programme channel="channel-0" start="${stamp(Date.now() - 60000)}" stop="${stamp(Date.now() + 3600000)}"><title>${title}</title></programme></tv>`;
async function seed(page, lists, lastOpened = {}, favorites = []) {
    await page.route('https://example.test/logo.svg', (route) =>
        route.fulfill({
            contentType: 'image/svg+xml',
            body: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="80"><rect width="100" height="80" fill="orange"/></svg>',
        }),
    );
    await page.goto('/');
    await page.evaluate(
        async ({ lists, lastOpened, favorites }) => {
            const db = await new Promise((resolve, reject) => {
                const request = indexedDB.open('keyval-store', 1);
                request.onupgradeneeded = () => request.result.createObjectStore('keyval');
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
            await new Promise((resolve, reject) => {
                const tx = db.transaction('keyval', 'readwrite');
                tx.objectStore('keyval').put({ lists, favorites }, 'tucatv');
                tx.objectStore('keyval').put(lastOpened, 'tuca-last-opened');
                tx.oncomplete = resolve;
                tx.onerror = () => reject(tx.error);
            });
            db.close();
        },
        { lists, lastOpened, favorites },
    );
    await page.reload();
    await page.getByRole('button', { name: 'Salta intro' }).click();
    await expect(page.getByRole('combobox', { name: 'Playlist' })).toBeVisible();
}

test('grid and category management extend in place and keep remote focus', async ({ page }) => {
    // Exercise the keyboard fallback independently of automatic intersection loading.
    await page.addInitScript(() => {
        delete window.IntersectionObserver;
    });
    await seed(page, [list('a', channels(70))]);
    await page.getByRole('button', { name: 'Vista griglia', exact: true }).click();
    await expect(page.locator('.tv-tile')).toHaveCount(24);
    await page.getByRole('button', { name: /Carica altri ·/ }).focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.tv-tile')).toHaveCount(48);
    await expect(page.locator('.tv-tile').nth(24)).toBeFocused();
    await page.getByRole('button', { name: 'Le mie playlist', exact: true }).click();
    await page.getByRole('button', { name: 'Categorie', exact: true }).click();
    await expect(page.locator('.category-check')).toHaveCount(24);
    await page.getByRole('button', { name: /Carica altre categorie/ }).focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.category-check')).toHaveCount(48);
    await expect(page.locator('.category-check').nth(24)).toBeFocused();
    await page.getByRole('textbox', { name: 'Cerca una categoria' }).fill('Categoria 69');
    await expect(page.locator('.category-check')).toHaveCount(1);
    await expect(page.getByText(/Pagina \d/)).toHaveCount(0);
});

test('scrolling automatically loads more channels without replacing the first ones', async ({ page }) => {
    await seed(page, [list('a', channels())]);
    await page.getByRole('button', { name: 'Vista griglia', exact: true }).click();
    const before = await page.locator('.tv-tile').count();
    await page.locator('main').evaluate((el) => (el.scrollTop = el.scrollHeight));
    await expect.poll(() => page.locator('.tv-tile').count()).toBeGreaterThan(before);
    await expect(page.locator('.tv-tile').first()).toHaveAttribute('aria-label', 'Riproduci Canale 0');
});

test('compact grid keeps channel logos visible', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await seed(page, [list('a', channels(4))]);
    await page.getByRole('button', { name: 'Vista griglia', exact: true }).click();
    const logo = page.locator('.tv-card .tv-logo').first();
    await expect(logo).toBeVisible();
    await expect(logo.locator('img')).toBeVisible();
    const box = await logo.boundingBox();
    expect(box.width).toBeGreaterThanOrEqual(24);
    expect(box.height).toBeGreaterThanOrEqual(24);
    await page.screenshot({ path: testInfo.outputPath('compact-grid-logos.png') });
});

test('artwork is above its badge and the hero respects Live/VOD', async ({ page }, testInfo) => {
    const items = [
        ...channels(1),
        {
            name: 'Film esempio',
            group: 'Film',
            url: 'https://example.test/movie/1',
            logo: 'https://example.test/logo.svg',
        },
    ];
    await seed(page, [list('a', items)], { a: { url: items[0].url, at: Date.now() } });
    await page.getByRole('button', { name: 'Film e serie' }).click();
    await expect(page.locator('.hero-content h1')).toHaveText('Film esempio');
    const art = page.locator('.media-art').first();
    await expect(art.locator('img')).toBeVisible();
    const image = await art.locator('.logo-frame').boundingBox(),
        badge = await art.locator('.media-type').boundingBox();
    expect(image.y + image.height).toBeLessThanOrEqual(badge.y + 1);
    await page.screenshot({ path: testInfo.outputPath('catalog.png') });
});

test('favorites appear in the first shelf below the hero', async ({ page }) => {
    const items = channels(3);
    await seed(page, [list('a', items)], {}, [items[1].url]);
    const firstShelf = page.locator('.shelf').first();
    await expect(firstShelf.getByRole('heading', { name: 'Preferiti' })).toBeVisible();
    await expect(firstShelf.locator('.media-open')).toHaveCount(1);
    await expect(firstShelf.locator('.media-open h3')).toHaveText(items[1].name);
    await firstShelf.getByRole('button', { name: 'Vedi tutti' }).click();
    await expect(page.locator('.tv-tile')).toHaveCount(1);
});

for (const source of ['', 'https://example.test/missing.m3u']) {
    test(`EPG loads on boot (${source ? 'failed refresh' : 'local playlist'}) and retains local XML`, async ({
        page,
    }) => {
        await page.route('https://example.test/missing.m3u', (route) =>
            route.fulfill({ status: 503, headers: { 'access-control-allow-origin': '*' }, body: 'Unavailable' }),
        );
        await page.route('https://example.test/guide.xml', (route) =>
            route.fulfill({
                contentType: 'text/xml',
                headers: { 'access-control-allow-origin': '*' },
                body: guide('Programma remoto'),
            }),
        );
        await seed(page, [list('a', channels(1), { source, epg: 'https://example.test/guide.xml' })]);
        await expect(page.locator('.hero-content')).toContainText('Programma remoto');
        await expect(page.locator('.epgbutton input')).toHaveCount(0);
        await page.getByRole('button', { name: 'Impostazioni', exact: true }).click();
        await page.getByRole('button', { name: 'Gestione EPG' }).click();
        const input = page.locator('.epg-upload input');
        await expect(input).toBeVisible();
        await input.setInputFiles({
            name: 'guide.xml',
            mimeType: 'text/xml',
            buffer: Buffer.from(guide('Programma locale')),
        });
        await expect(page.getByText('Guida TV caricata.', { exact: true })).toBeVisible();
        await page.getByRole('button', { name: 'Catalogo', exact: true }).click();
        await expect(page.locator('.hero-content')).toContainText('Programma locale');
        await page.route('https://example.test/guide.xml', (route) =>
            route.fulfill({ status: 503, headers: { 'access-control-allow-origin': '*' }, body: 'Unavailable' }),
        );
        await page.reload();
        await page.getByRole('button', { name: 'Salta intro' }).click();
        await expect(page.locator('.hero-content')).toContainText('Programma locale');
    });
}

test('late XMLTV responses cannot overwrite the selected playlist guide', async ({ page }) => {
    let release;
    const gate = new Promise((resolve) => (release = resolve));
    await page.route('https://example.test/slow.xml', async (route) => {
        await gate;
        await route.fulfill({
            contentType: 'text/xml',
            headers: { 'access-control-allow-origin': '*' },
            body: guide('Guida vecchia'),
        });
    });
    await page.route('https://example.test/fast.xml', (route) =>
        route.fulfill({
            contentType: 'text/xml',
            headers: { 'access-control-allow-origin': '*' },
            body: guide('Guida corrente'),
        }),
    );
    await seed(page, [
        list('a', channels(1), { epg: 'https://example.test/slow.xml' }),
        list('b', channels(1), { epg: 'https://example.test/fast.xml' }),
    ]);
    await page.getByRole('combobox', { name: 'Playlist' }).selectOption('b');
    await expect(page.locator('.hero-content')).toContainText('Guida corrente');
    const response = page.waitForResponse('https://example.test/slow.xml');
    release();
    await response;
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.hero-content')).not.toContainText('Guida vecchia');
});

test('shelves and playlist collections also load progressively', async ({ page }) => {
    await page.addInitScript(() => {
        delete window.IntersectionObserver;
    });
    const items = channels(40).map((c) => ({ ...c, group: 'Principale' }));
    items.push(...channels(12).map((c, i) => ({ ...c, name: 'Extra ' + i, group: 'Extra ' + i })));
    await seed(
        page,
        Array.from({ length: 14 }, (_, i) => list(String(i), items)),
    );
    await expect(page.locator('.shelf')).toHaveCount(6);
    const shelf = page.locator('.shelf').first();
    await expect(shelf.locator('.media-open')).toHaveCount(8);
    await shelf.getByRole('button', { name: /Carica altri ·/ }).click();
    await expect(shelf.locator('.media-open')).toHaveCount(16);
    await expect(shelf.locator('.media-open').nth(8)).toBeFocused();
    await page.getByRole('button', { name: /Carica altre categorie/ }).click();
    await expect(page.locator('.shelf')).toHaveCount(12);
    await page.getByRole('button', { name: 'Le mie playlist', exact: true }).click();
    await expect(page.locator('.playlistcard')).toHaveCount(12);
    await page.getByRole('button', { name: /Carica altre playlist/ }).click();
    await expect(page.locator('.playlistcard')).toHaveCount(14);
    await expect(page.locator('.playlistcard').nth(12).getByRole('button', { name: 'Apri' })).toBeFocused();
});

test('disabling startup refresh preserves saved channels without downloading the playlist', async ({ page }) => {
    let requests = 0;
    await page.route('https://example.test/playlist.m3u', (route) => {
        requests++;
        return route.fulfill({ body: '#EXTM3U\n#EXTINF:-1,Updated\nhttps://example.test/live/new' });
    });
    await page.addInitScript(() =>
        localStorage.setItem('tucatv-settings', JSON.stringify({ refreshOnStartup: false })),
    );
    await seed(page, [list('a', channels(1), { source: 'https://example.test/playlist.m3u' })]);
    await expect(page.locator('.hero-content h1')).toHaveText('Canale 0');
    await page.getByRole('button', { name: 'Le mie playlist', exact: true }).click();
    expect(requests).toBe(0);
    await page.getByRole('button', { name: 'Aggiorna', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Playlist aggiornata' })).toBeVisible();
    expect(requests).toBe(1);
});

test('playlist progress opens list management with the remote keyboard', async ({ page }) => {
    let release;
    const gate = new Promise((resolve) => (release = resolve));
    await page.route('https://example.test/playlist.m3u', async (route) => {
        await gate;
        await route.fulfill({ body: '#EXTM3U\n#EXTINF:-1,Updated\nhttps://example.test/live/new' });
    });
    await seed(page, [list('a', channels(1), { source: 'https://example.test/playlist.m3u' })]);
    const progress = page.getByRole('link', { name: 'Avanzamento caricamento playlist' });
    await expect(progress).toBeVisible();
    await progress.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'Le mie playlist' })).toBeVisible();
    const response = page.waitForResponse('https://example.test/playlist.m3u');
    release();
    await response;
    await expect(progress).toContainText('Playlist aggiornate');
});

for (const width of [390, 1280]) {
    test(`wide logos and tall posters fit above badges at ${width}px`, async ({ page }, testInfo) => {
        await page.setViewportSize({ width, height: 800 });
        const items = [
            ...channels(1),
            {
                name: 'Poster alto',
                kind: 'vod',
                group: 'Film',
                tvg: '',
                url: 'https://example.test/movie/1',
                logo: 'https://example.test/tall.svg',
            },
        ];
        await page.route('https://example.test/tall.svg', (r) =>
            r.fulfill({
                contentType: 'image/svg+xml',
                body: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="600"><rect x="3" y="3" width="194" height="594" fill="orange" stroke="white" stroke-width="6"/></svg>',
            }),
        );
        await seed(page, [list('a', items)]);
        for (const mode of ['live', 'vod']) {
            if (mode === 'vod') await page.getByRole('button', { name: 'Film e serie' }).click();
            const art = page.locator('.media-art').first();
            await art.scrollIntoViewIfNeeded();
            await expect(art.locator('img')).toBeVisible();
            const outer = await art.boundingBox(),
                frame = await art.locator('.logo-frame').boundingBox(),
                image = await art.locator('img').boundingBox(),
                badge = await art.locator('.media-type').boundingBox();
            expect(image.height).toBeGreaterThan(15);
            expect(image.y).toBeGreaterThanOrEqual(frame.y);
            expect(image.y + image.height).toBeLessThanOrEqual(frame.y + frame.height + 1);
            expect(image.x + image.width).toBeLessThanOrEqual(outer.x + outer.width);
            expect(image.y + image.height).toBeLessThan(badge.y);
            expect(badge.y + badge.height).toBeLessThanOrEqual(outer.y + outer.height);
            expect(await art.locator('img').evaluate((el) => getComputedStyle(el).objectFit)).toBe('contain');
            await art.screenshot({ path: testInfo.outputPath(`art-${width}-${mode}.png`) });
        }
    });
}
