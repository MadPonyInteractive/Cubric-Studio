const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('./launch');

/**
 * MPI-960 — the image workspace's colour pickers carry the GIF cut-out's eyedropper
 * Pick: Remove Background (Color mode), Paint, and Paint Adjust.
 *
 * Each panel is mounted on its own against a stub viewer, and `window.EyeDropper` is
 * replaced so the pick resolves without a human click on the screen. What is proven:
 * the button exists beside the swatch, a pick lands in the swatch, and it reaches the
 * panel's own 'change' path (Paint/Adjust hand it to `viewer.el.setPaintColor`).
 */
test.setTimeout(120000);

const PICKED = '#123456';

async function clearBootModals(window) {
    const backdrops = () => window.evaluate(
        () => document.querySelectorAll('.mpi-modal-backdrop').length);
    const cont = window.locator('.mpi-modal-backdrop button:has-text("Continue")').first();
    if (await cont.count()) await cont.click({ timeout: 5000 }).catch(() => {});
    for (let i = 0; i < 8 && await backdrops() > 0; i++) {
        await window.keyboard.press('Escape');
        await window.waitForTimeout(400);
    }
}

test('Pick sits beside the colour picker and lands the picked colour', async ({}, testInfo) => {
    let app, window, pageErrors;
    try {
        ({ app, window, pageErrors } = await launchApp(testInfo));
        await window.waitForTimeout(6000);
        await clearBootModals(window);

        await window.evaluate(async ({ picked }) => {
            window.EyeDropper = class { open() { return Promise.resolve({ sRGBHex: picked }); } };
            window.__paintColours = [];
            // Every viewer method is a no-op, except the one this spec reads back.
            const viewerEl = new Proxy({}, {
                get: (_, key) => (key === 'setPaintColor'
                    ? (hex) => window.__paintColours.push(hex)
                    : (key === 'then' ? undefined : () => undefined)),
            });
            const viewer = { el: viewerEl, on: () => () => {} };
            const host = document.createElement('div');
            host.id = 'mpi960-host';
            host.style.cssText = 'position:fixed;top:0;left:0;z-index:99999;display:flex;gap:16px;padding:16px;background:var(--surface-1)';
            document.body.appendChild(host);
            const panels = [
                ['removebg', '/js/components/Organisms/MpiToolOptionsRemoveBg/MpiToolOptionsRemoveBg.js', 'MpiToolOptionsRemoveBg', {}],
                ['paint', '/js/components/Organisms/MpiToolOptionsPaint/MpiToolOptionsPaint.js', 'MpiToolOptionsPaint', {}],
                ['adjust', '/js/components/Organisms/MpiToolOptionsMaskAdjust/MpiToolOptionsMaskAdjust.js', 'MpiToolOptionsMaskAdjust', { mode: 'paintAdjust' }],
            ];
            for (const [id, path, name, extra] of panels) {
                const slot = document.createElement('div');
                slot.style.width = '300px';
                slot.dataset.panel = id;
                host.appendChild(slot);
                const mod = await import(path);
                mod[name].mount(slot, { viewer, ...extra });
            }
        }, { picked: PICKED });

        // Remove Background shows its picker only in Color mode.
        await window.locator('[data-panel="removebg"] .mpi-radio-group__btn[data-value="color"]').click();
        await window.locator('#mpi960-host').screenshot({ path: testInfo.outputPath('before-pick.png') });

        for (const id of ['removebg', 'paint', 'adjust']) {
            const panel = window.locator(`[data-panel="${id}"]`);
            const pick = panel.locator('#pick-slot button');
            await expect(pick, `${id}: Pick button present`).toBeVisible();
            await pick.click();
            await expect(panel.locator('.mpi-color-picker__hex'), `${id}: picked colour in the swatch`).toHaveText(PICKED);
        }
        await window.locator('#mpi960-host').screenshot({ path: testInfo.outputPath('after-pick.png') });

        const colours = await window.evaluate(() => window.__paintColours);
        // Paint and Adjust each seed the viewer once on mount, then once per pick.
        expect(colours.filter(c => c === PICKED), 'both paint panels handed the pick to the viewer').toHaveLength(2);
        expect(pageErrors).toEqual([]);
    } finally {
        if (app) await closeApp(app);
    }
});
