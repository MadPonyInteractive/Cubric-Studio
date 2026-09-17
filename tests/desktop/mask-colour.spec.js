/**
 * MPI-771 — Mask By Colour (maskColour) desktop spec.
 *
 * End-to-end: real Electron app, real fixture (64×64 grey #c8c6c8 background
 * with a dark 32×32 centre square), real rail UI clicks, committed-pixel
 * assertions, undo, and debounced re-run on tolerance change.
 *
 * Fixture pixel expectations:
 *   (2,2)   — grey background: colour key selects it → baked, alpha=255
 *   (32,32) — dark centre square: not selected → stays transparent, alpha=0
 *
 * BITE: in js/utils/colourKeyMask.js change the `colourKeyMask` return so it
 * produces an all-zero mask (e.g. add `return new Uint8Array(n);` right after
 * the `const mask = ...` line).  The spec turns RED on the pixel assertions.
 * Restore the file byte-exact → GREEN.
 */

'use strict';

const sharp = require('sharp');
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('./launch');

/** 64×64 fixture: grey background + dark 32×32 centre square. */
async function makeFixture() {
    const SZ = 64;
    const bg = await sharp({ create: { width: SZ, height: SZ, channels: 3, background: { r: 200, g: 198, b: 200 } } }).png().toBuffer();
    const sq = await sharp({ create: { width: 32, height: 32, channels: 3, background: { r: 64, g: 64, b: 64 } } }).png().toBuffer();
    const buf = await sharp(bg).composite([{ input: sq, left: 16, top: 16 }]).png().toBuffer();
    return `data:image/png;base64,${buf.toString('base64')}`;
}

async function clearBootModals(window) {
    const backdrops = () => window.evaluate(() => document.querySelectorAll('.mpi-modal-backdrop').length);
    const cont = window.locator('.mpi-modal-backdrop button:has-text("Continue")').first();
    if (await cont.count()) await cont.click({ timeout: 5000 }).catch(() => {});
    for (let i = 0; i < 8 && await backdrops() > 0; i++) {
        await window.keyboard.press('Escape');
        await window.waitForTimeout(400);
    }
}

test('maskColour E2E: detect + add + undo + debounce re-run', async ({}, testInfo) => {
    const { app, window } = await launchApp(testInfo);
    try {
        await window.waitForTimeout(3000);
        await clearBootModals(window);

        // ── 1. Build fixture, set project state, navigate ───────────────────
        const imgUrl = await makeFixture();
        await window.evaluate(async (url) => {
            const { state } = await import('/js/state.js');
            const { navigate, PAGE_GROUP_HISTORY } = await import('/js/router.js');
            state.currentProject = {
                id: 'pMC771', name: 'MC771 Test', folderPath: 'C:/tmp/mc771',
                itemGroups: [{
                    id: 'gMC771', type: 'image', name: 'MC771 Group', selectedIndex: 0,
                    history: [{ id: 'iMC771', filePath: url, type: 'image', displayName: 'mc771' }],
                }],
            };
            navigate(PAGE_GROUP_HISTORY, { groupId: 'gMC771' });
        }, imgUrl);

        // ── 2. Wait for history block; image (data URL) loads instantly ─────
        await window.waitForSelector('.mpi-group-history-block', { timeout: 10000 });
        // Give the viewer one tick to call loadImage on the data-URL entry.
        await window.waitForTimeout(500);

        // ── 3. Open Detect strip (collapse popup) then click Colour ─────────
        await window.evaluate(() => {
            document.querySelector('.mpi-history-tools__slot[data-mode="mask"] .mpi-history-tools__btn[data-info="Detect"] button').click();
        });
        await window.waitForSelector('.mpi-history-tools__strip', { timeout: 5000 });
        await window.evaluate(() => {
            document.querySelector('.mpi-history-tools__strip .mpi-history-tools__btn[data-info="Colour"] button').click();
        });

        // ── 4. Panel mounts ─────────────────────────────────────────────────
        await window.waitForSelector('.mpi-tool-options-mask-colour', { timeout: 5000 });
        await window.waitForTimeout(500); // let setup + async _seedCornerColour run

        // ── 5. Corner colour seeded: picker shows #c8c6c8 ───────────────────
        await expect.poll(() => window.evaluate(() => {
            const hex = document.querySelector(
                '.mpi-tool-options-mask-colour .mpi-color-picker__hex')?.textContent?.trim().toLowerCase();
            return hex;
        }), { timeout: 8000 }).toBe('#c8c6c8');

        // ── 6. Set up run-1 listener BEFORE clicking Detect (no race) ───────
        await window.evaluate(async () => {
            const { Events } = await import('/js/events.js');
            let started = false;
            window.__mc_run1 = new Promise((resolve) => {
                const off = Events.on('automask:running', ({ running }) => {
                    if (running) { started = true; return; }
                    if (started) { off(); resolve(true); }
                });
                setTimeout(() => { off(); resolve(false); }, 12000);
            });
        });

        // Click Detect
        await window.evaluate(() => {
            document.querySelector('.mpi-mask-detect-row #detect-slot button').click();
        });

        // Wait for run to complete (pure-JS, very fast)
        const run1done = await window.evaluate(() => window.__mc_run1);
        expect(run1done, 'colour-key run 1 must start and finish').toBe(true);

        // ── 7. Click Add (first button in #commit-slot) ──────────────────────
        await window.evaluate(() => {
            document.querySelector('.mpi-mask-detect-row #commit-slot button').click();
        });
        await window.waitForTimeout(100);

        // ── 8. Assert committed pixels in manualCtx ──────────────────────────
        const px = await window.evaluate(() => {
            const mm = document.querySelector('.mpi-canvas')?.mask;
            if (!mm || !mm.manualCtx) return null;
            const bg  = Array.from(mm.manualCtx.getImageData(2,  2,  1, 1).data);
            const ctr = Array.from(mm.manualCtx.getImageData(32, 32, 1, 1).data);
            return { bgAlpha: bg[3], ctrAlpha: ctr[3] };
        });
        expect(px, 'mask manager must be accessible').not.toBeNull();
        expect(px.bgAlpha,  'background pixel (2,2) must be masked (alpha=255)').toBe(255);
        expect(px.ctrAlpha, 'centre pixel (32,32) must not be masked (alpha=0)').toBe(0);

        // ── 9. Ctrl+Z via undoMask() → mask clears ──────────────────────────
        await window.evaluate(() => { document.querySelector('.mpi-canvas').undoMask(); });
        await window.waitForTimeout(50);
        const alphaAfterUndo = await window.evaluate(() => {
            const mm = document.querySelector('.mpi-canvas')?.mask;
            return mm?.manualCtx?.getImageData(2, 2, 1, 1).data[3] ?? -1;
        });
        expect(alphaAfterUndo, 'undo must clear mask — alpha back to 0').toBe(0);

        // ── 10. Tolerance → 0: debounced re-run fires (tolerance-0 fix) ─────
        // Set up promise BEFORE slider change so we catch the event cycle.
        await window.evaluate(async () => {
            const { Events } = await import('/js/events.js');
            let started = false;
            window.__mc_run2 = new Promise((resolve) => {
                const off = Events.on('automask:running', ({ running }) => {
                    if (running) { started = true; return; }
                    if (started) { off(); resolve(true); }
                });
                setTimeout(() => { off(); resolve(false); }, 8000);
            });
        });

        await window.evaluate(() => {
            const inp = document.querySelector('.mpi-tool-options-mask-colour .mpi-progress__input');
            inp.value = '0';
            inp.dispatchEvent(new Event('input', { bubbles: true }));
        });

        const run2done = await window.evaluate(() => window.__mc_run2);
        expect(run2done, 'debounced re-run at tolerance=0 must complete').toBe(true);

    } finally {
        await closeApp(app);
    }
});
