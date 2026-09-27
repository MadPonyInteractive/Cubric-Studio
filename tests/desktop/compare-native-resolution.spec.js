const { test, expect } = require('@playwright/test');
const crypto = require('crypto');
const fs = require('fs-extra');
const sharp = require('sharp');
const { launchApp, closeApp } = require('./launch');

/**
 * MPI-956 — Compare keeps each side's NATIVE pixels, whichever order they were picked in.
 *
 * The bug: MpiCanvas drew the "after" image into the overlay canvas, which is sized to
 * the BEFORE image. Picking a 1K image first and an 8K second rasterized the 8K down to
 * 1K, so zooming in showed a pixelated 1K. The fix gives the after side its own canvas
 * at its own resolution.
 *
 * 512 vs 4096 is the same 8x ratio as 1K vs 8K and stays well under any GPU's
 * MAX_TEXTURE_SIZE (SwiftShader on CI caps at 8192). The large image carries a 1px
 * checkerboard in its top-left corner: at native resolution neighbouring pixels
 * alternate black/white; squashed 8x they average to one grey.
 *
 * Same real path as gif-make.spec.js: real project, real upload route + media:imported,
 * real ctrl-click selection, the real selection-bar Compare button.
 */
test.setTimeout(180000);

const SMALL = 512;
const LARGE = 4096;
const TILE = 64;

async function clearBootModals(window) {
    const backdrops = () => window.evaluate(
        () => document.querySelectorAll('.mpi-modal-backdrop').length);
    const cont = window.locator('.mpi-modal-backdrop button:has-text("Continue")').first();
    if (await cont.count()) await cont.click({ timeout: 5000 }).catch(() => {});
    for (let i = 0; i < 8 && await backdrops() > 0; i++) {
        await window.keyboard.press('Escape');
        await window.waitForTimeout(400);
    }
    expect(await backdrops(), 'the boot modals must be gone').toBe(0);
}

async function smallPng() {
    return sharp({ create: { width: SMALL, height: SMALL, channels: 3, background: { r: 90, g: 90, b: 200 } } })
        .png().toBuffer();
}

/** LARGE x LARGE mid-grey with a TILE x TILE 1px black/white checkerboard at (0,0). */
async function largeCheckerPng() {
    const tile = Buffer.alloc(TILE * TILE * 3);
    for (let y = 0; y < TILE; y++) {
        for (let x = 0; x < TILE; x++) tile.fill((x + y) % 2 ? 255 : 0, (y * TILE + x) * 3, (y * TILE + x) * 3 + 3);
    }
    return sharp({ create: { width: LARGE, height: LARGE, channels: 3, background: { r: 128, g: 128, b: 128 } } })
        .composite([{ input: tile, raw: { width: TILE, height: TILE, channels: 3 }, left: 0, top: 0 }])
        .png().toBuffer();
}

test('Compare: the higher-res side keeps its native pixels in either order', async ({}, testInfo) => {
    let app, window;
    let projectFolderPath = null;

    try {
        ({ app, window } = await launchApp(testInfo));
        await window.waitForTimeout(6000);
        await clearBootModals(window);

        const project = await window.evaluate(async ({ name, folderPath }) => {
            const { createProject, openProject } = await import('/js/services/projectService.js');
            const p = await createProject(name, folderPath);
            await openProject(p);
            return p;
        }, { name: `mpi956-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`, folderPath: testInfo.outputPath('projects') });
        projectFolderPath = project.folderPath;

        async function importStill(buf, size, prefix) {
            const itemId = crypto.randomUUID();
            return window.evaluate(async ({ project, itemId, base64, size, prefix }) => {
                const { Events } = await import('/js/events.js');
                const res = await fetch(
                    `/project-media/${project.id}/upload?folderPath=${encodeURIComponent(project.folderPath)}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            filename: `${prefix}_001.png`, base64Data: base64, autoSequence: true,
                            itemId, mediaType: 'image', width: size, height: size,
                        }),
                    });
                const data = await res.json();
                if (!data.success) throw new Error(`upload failed for ${prefix}: ${data.error}`);
                return new Promise((resolve, reject) => {
                    const timer = setTimeout(() => reject(new Error(`project:group-added never fired for ${prefix}`)), 15000);
                    const unsub = Events.on('project:group-added', ({ group }) => {
                        if (group?.history?.[0]?.id !== itemId) return;
                        clearTimeout(timer);
                        unsub();
                        resolve(group.id);
                    });
                    Events.emit('media:imported', {
                        url: `/project-file?path=${encodeURIComponent(data.filePath)}`,
                        filename: data.filename, itemId,
                        thumbPath: data.thumbPath || null, thumbPathLg: data.thumbPathLg || null, proxyPath: null,
                        pixelDimensions: { w: size, h: size }, mediaType: 'image',
                    });
                });
            }, { project, itemId, base64: buf.toString('base64'), size, prefix });
        }

        const small = await importStill(await smallPng(), SMALL, 'e2e-small');
        const large = await importStill(await largeCheckerPng(), LARGE, 'e2e-large');

        await window.evaluate(async () => {
            const { navigate, PAGE_GALLERY } = await import('/js/router.js');
            navigate(PAGE_GALLERY);
        });
        const cardSel = (groupId) => `[data-group-id="${groupId}"] .mpi-group-card`;
        for (const g of [small, large]) await window.waitForSelector(cardSel(g), { timeout: 15000 });

        /** Open Compare on (first, second) and read both canvases once the after side painted. */
        async function compare(first, second) {
            await window.locator(cardSel(first)).click({ modifiers: ['Control'] });
            await window.locator(cardSel(second)).click({ modifiers: ['Control'] });
            await window.locator('.mpi-gallery-grid__selection-bar [data-action="compare"]').click();
            const sel = '.mpi-compare-view canvas[data-role="compare"]';
            // Not `width > 0`: a fresh canvas is 300x150 before anything draws. The layer is
            // hidden until the after side has loaded and painted.
            await window.waitForFunction((s) => {
                const c = document.querySelector(s);
                return c && c.style.display !== 'none' && c.width > 0;
            }, sel, { timeout: 30000 });
            const out = await window.evaluate(({ tile }) => {
                const view = document.querySelector('.mpi-compare-view');
                const base = view.querySelector('canvas[data-role="base"]');
                const cmp = view.querySelector('canvas[data-role="compare"]');
                // Distinct values along one row of the corner: a 1px checker gives {0,255};
                // an 8x downsample gives a single grey.
                const row = (c) => {
                    const d = c.getContext('2d').getImageData(0, 0, tile, 1).data;
                    const v = new Set();
                    for (let i = 0; i < d.length; i += 4) v.add(d[i]);
                    return [...v].sort((a, b) => a - b);
                };
                return {
                    base: { w: base.width, h: base.height, row: row(base) },
                    cmp: { w: cmp.width, h: cmp.height, row: row(cmp) },
                };
            }, { tile: TILE });
            await window.keyboard.press('Escape');
            await window.waitForFunction(() => !document.querySelector('.mpi-compare-view'), null, { timeout: 10000 });
            return out;
        }

        // Small first: the large image is the AFTER side, the one that used to be squashed.
        const a = await compare(small, large);
        expect(a.base.w, 'before side at its native px').toBe(SMALL);
        expect(a.cmp.w, 'after side at ITS native px, not the before side').toBe(LARGE);
        expect(a.cmp.h).toBe(LARGE);
        expect(a.cmp.row, 'the 1px checkerboard survives on the after side').toEqual([0, 255]);

        // Large first: both sides still native.
        const b = await compare(large, small);
        expect(b.base.w).toBe(LARGE);
        expect(b.base.row).toEqual([0, 255]);
        expect(b.cmp.w).toBe(SMALL);
    } finally {
        if (app) await closeApp(app);
        if (projectFolderPath) await fs.remove(projectFolderPath).catch(() => {});
    }
});
