const { test, expect } = require('@playwright/test');
const crypto = require('crypto');
const fs = require('fs-extra');
const sharp = require('sharp');
const { launchApp, closeApp } = require('./launch');

/**
 * MPI-957 — a large image zoomed out must not alias.
 *
 * MpiCanvas holds the image at native px and scales the stack with CSS. Chromium
 * composites a canvas with plain bilinear and no mipmaps, so an 8192px image at fit
 * (~1/12) skipped source pixels: a 1px black/white grating beat into moire bands
 * (screenshot std 74) where a properly filtered downscale is flat grey (std 0, sharp
 * lanczos3 — and the History PROMPT preview, an <img>, measured the same 0). The fix
 * shows a mipmapped display copy below half size; this spec pins both canvases that
 * reach the screen that way — the base (History tool mode) and the compare side — and
 * that the native pixels take over again once zoomed in.
 *
 * 8192 is SwiftShader's MAX_TEXTURE_SIZE on CI, so nothing is clamped there either.
 */
test.setTimeout(240000);

const N = 8192;
const SQ = 2048;
const SMALL = 512;

async function clearBootModals(window) {
    const backdrops = () => window.evaluate(() => document.querySelectorAll('.mpi-modal-backdrop').length);
    const cont = window.locator('.mpi-modal-backdrop button:has-text("Continue")').first();
    if (await cont.count()) await cont.click({ timeout: 5000 }).catch(() => {});
    for (let i = 0; i < 8 && await backdrops() > 0; i++) {
        await window.keyboard.press('Escape');
        await window.waitForTimeout(400);
    }
    expect(await backdrops(), 'the boot modals must be gone').toBe(0);
}

/** N x N: 1px vertical black/white grating, a solid black square top-left, white bottom-right. */
async function gratingPng() {
    const buf = Buffer.alloc(N * N);
    for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++) {
            let v = (x & 1) ? 255 : 0;
            if (x < SQ && y < SQ) v = 0;
            else if (x >= N - SQ && y >= N - SQ) v = 255;
            buf[y * N + x] = v;
        }
    }
    return sharp(buf, { raw: { width: N, height: N, channels: 1 } }).png().toBuffer();
}

async function smallPng() {
    return sharp({ create: { width: SMALL, height: SMALL, channels: 3, background: { r: 90, g: 90, b: 200 } } })
        .png().toBuffer();
}

/** Grey-level mean/std of a screenshot clip given in the element's IMAGE px. */
async function measure(window, sel, [x0, y0, x1, y1]) {
    const r = await window.evaluate((s) => {
        const b = document.querySelector(s).getBoundingClientRect();
        return { x: b.left, y: b.top, w: b.width };
    }, sel);
    const k = r.w / N;
    const png = await window.screenshot({ clip: { x: r.x + x0 * k, y: r.y + y0 * k, width: (x1 - x0) * k, height: (y1 - y0) * k } });
    const { data } = await sharp(png).greyscale().raw().toBuffer({ resolveWithObject: true });
    let s = 0, s2 = 0;
    for (const v of data) { s += v; s2 += v * v; }
    const mean = s / data.length;
    return { mean, std: Math.sqrt(s2 / data.length - mean * mean) };
}

test('a large image zoomed out does not alias, on the base or the compare side', async ({}, testInfo) => {
    let app, window, projectFolderPath = null;
    try {
        ({ app, window } = await launchApp(testInfo));
        await window.waitForTimeout(6000);
        await clearBootModals(window);

        const project = await window.evaluate(async ({ name, folderPath }) => {
            const { createProject, openProject } = await import('/js/services/projectService.js');
            const p = await createProject(name, folderPath);
            await openProject(p);
            return p;
        }, { name: `mpi957-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`, folderPath: testInfo.outputPath('projects') });
        projectFolderPath = project.folderPath;

        async function importStill(buf, size, prefix) {
            const itemId = crypto.randomUUID();
            return window.evaluate(async ({ project, itemId, base64, size, prefix }) => {
                const { Events } = await import('/js/events.js');
                const res = await fetch(`/project-media/${project.id}/upload?folderPath=${encodeURIComponent(project.folderPath)}`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ filename: `${prefix}_001.png`, base64Data: base64, autoSequence: true, itemId, mediaType: 'image', width: size, height: size }),
                });
                const data = await res.json();
                if (!data.success) throw new Error(`upload failed for ${prefix}: ${data.error}`);
                return new Promise((resolve, reject) => {
                    const timer = setTimeout(() => reject(new Error(`project:group-added never fired for ${prefix}`)), 30000);
                    const unsub = Events.on('project:group-added', ({ group }) => {
                        if (group?.history?.[0]?.id !== itemId) return;
                        clearTimeout(timer); unsub(); resolve(group.id);
                    });
                    Events.emit('media:imported', {
                        url: `/project-file?path=${encodeURIComponent(data.filePath)}`,
                        filename: data.filename, itemId, thumbPath: data.thumbPath || null, thumbPathLg: data.thumbPathLg || null,
                        proxyPath: null, pixelDimensions: { w: size, h: size }, mediaType: 'image',
                    });
                });
            }, { project, itemId, base64: buf.toString('base64'), size, prefix });
        }

        const grating = await importStill(await gratingPng(), N, 'e2e-grating');
        const small = await importStill(await smallPng(), SMALL, 'e2e-small');

        // ── Base canvas: History in a tool mode (PROMPT mode shows an <img> preview instead).
        await window.evaluate(async (id) => {
            const { navigate, PAGE_GROUP_HISTORY } = await import('/js/router.js');
            navigate(PAGE_GROUP_HISTORY, { groupId: id });
        }, grating);
        await expect(window.locator('.mpi-history-tools')).toBeVisible();
        await window.evaluate(() => document.querySelector('.mpi-history-tools').setMode('mask'));
        const base = '.mpi-canvas-viewer canvas[data-role="base"]';
        await window.waitForFunction((s) => document.querySelector(s)?.width === 8192, base, { timeout: 60000 });
        await window.waitForTimeout(1000);

        const fit = await window.evaluate(() => document.querySelector('.mpi-canvas-viewer .mpi-canvas').scale * devicePixelRatio);
        expect(fit, 'the image is shown far below half size at fit').toBeLessThan(0.25);
        const g = await measure(window, base, [3072, 3072, 5120, 5120]);
        expect(g.std, `grating reads as flat grey, not moire (mean ${g.mean.toFixed(1)})`).toBeLessThan(10);
        expect(Math.abs(g.mean - 127.5)).toBeLessThan(12);
        expect(await window.evaluate(() => document.querySelector('.mpi-canvas-viewer canvas[data-role="base-mip"]').width),
            'the display copy is a reduced one').toBeLessThan(N / 2);
        // Geometry: the copy covers exactly the native's box — the squares land where they are.
        expect((await measure(window, base, [256, 256, 1792, 1792])).mean).toBeLessThan(10);
        expect((await measure(window, base, [6400, 6400, 7936, 7936])).mean).toBeGreaterThan(245);

        // Zoomed past 1:1 the native canvas is back and the 1px grating resolves.
        const zoomed = await window.evaluate(() => {
            const el = document.querySelector('.mpi-canvas-viewer .mpi-canvas');
            const r = el.getBoundingClientRect();
            el.isManagedView = false;
            el.scale = 2;
            el.offsetX = r.width / 2 - 4096 * 2;
            el.offsetY = r.height / 2 - 4096 * 2;
            el.resize();
            const q = (role) => document.querySelector(`.mpi-canvas-viewer canvas[data-role="${role}"]`);
            return { native: q('base').style.visibility, mip: q('base-mip').style.display };
        });
        expect(zoomed).toEqual({ native: '', mip: 'none' });
        // std, not min/max: a half-pixel offset blends 2x-bilinear lines to 64/192, and
        // a flat grey (a copy left showing) is ~0 either way.
        expect((await measure(window, base, [4076, 4076, 4116, 4116])).std, 'native 1px lines visible at 2x')
            .toBeGreaterThan(40);

        // ── Compare side: the 8K grating as the AFTER image over a 512 before.
        await window.evaluate(async () => {
            const { navigate, PAGE_GALLERY } = await import('/js/router.js');
            navigate(PAGE_GALLERY);
        });
        const cardSel = (id) => `[data-group-id="${id}"] .mpi-group-card`;
        for (const id of [small, grating]) await window.waitForSelector(cardSel(id), { timeout: 15000 });
        await window.locator(cardSel(small)).click({ modifiers: ['Control'] });
        await window.locator(cardSel(grating)).click({ modifiers: ['Control'] });
        await window.locator('.mpi-gallery-grid__selection-bar [data-action="compare"]').click();
        const cmp = '.mpi-compare-view canvas[data-role="compare"]';
        await window.waitForFunction((s) => {
            const c = document.querySelector(s);
            return c && c.style.display !== 'none' && c.width === 8192;
        }, cmp, { timeout: 60000 });
        await window.waitForTimeout(1000);
        expect(await window.evaluate(() => {
            const q = (role) => document.querySelector(`.mpi-compare-view canvas[data-role="${role}"]`);
            return { native: q('compare').style.visibility, mip: q('compare-mip').style.display, clip: q('compare-mip').style.clipPath === q('compare').style.clipPath };
        })).toEqual({ native: 'hidden', mip: '', clip: true });

        // Right of the centred slider, clear of the white square.
        const c = await measure(window, cmp, [4800, 2600, 6000, 5600]);
        expect(c.std, `compare-side grating reads as flat grey (mean ${c.mean.toFixed(1)})`).toBeLessThan(10);
        expect((await measure(window, cmp, [6400, 6400, 7936, 7936])).mean).toBeGreaterThan(245);
    } finally {
        if (app) await closeApp(app);
        if (projectFolderPath) await fs.remove(projectFolderPath).catch(() => {});
    }
});
