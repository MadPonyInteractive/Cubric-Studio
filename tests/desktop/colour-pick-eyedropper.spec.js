const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('./launch');

/**
 * MPI-960 / MPI-964 — every tool panel's colour control is MpiColorField: a swatch
 * with the eyedropper Pick beside it. Remove Background (Color mode), Paint, Paint
 * Adjust, the GIF cut-out's By colour and the image Colour mask.
 *
 * Each panel is mounted on its own against a stub viewer, and `window.EyeDropper` is
 * replaced so the pick resolves without a human click on the screen. What is proven:
 * the button exists beside the swatch, a pick lands in the swatch, and it reaches the
 * panel's own 'change' path (Paint/Adjust hand it to `viewer.el.setPaintColor`, the
 * Colour mask to `viewer.el.setMaskColourParams`).
 */
test.setTimeout(120000);

const PICKED = '#123456';
const PANELS = ['removebg', 'paint', 'adjust', 'gifcutout', 'maskcolour'];

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

test('Pick sits beside every tool colour picker and lands the picked colour', async ({}, testInfo) => {
    let app, window, pageErrors;
    try {
        ({ app, window, pageErrors } = await launchApp(testInfo));
        await window.waitForTimeout(6000);
        await clearBootModals(window);

        await window.evaluate(async ({ picked }) => {
            window.EyeDropper = class { open() { return Promise.resolve({ sRGBHex: picked }); } };
            window.__paintColours = [];
            window.__maskColours = [];
            // Every viewer method is a no-op, except the ones this spec reads back and
            // the GIF viewer's frame list, which the cut-out panel iterates.
            const calls = {
                setPaintColor: (hex) => window.__paintColours.push(hex),
                setMaskColourParams: (p) => window.__maskColours.push(p?.colour),
                getFrames: () => [],
                getFrameIndex: () => 0,
            };
            const viewerEl = new Proxy({}, {
                get: (_, key) => calls[key] || (key === 'then' ? undefined : () => undefined),
            });
            const viewer = { el: viewerEl, on: () => () => {} };
            const host = document.createElement('div');
            host.id = 'mpi964-host';
            host.style.cssText = 'position:fixed;top:0;left:0;z-index:99999;display:flex;flex-wrap:wrap;gap:16px;padding:16px;width:1000px;background:var(--surface-1)';
            document.body.appendChild(host);
            const O = '/js/components/Organisms';
            const panels = [
                ['removebg', `${O}/MpiToolOptionsRemoveBg/MpiToolOptionsRemoveBg.js`, 'MpiToolOptionsRemoveBg', {}],
                ['paint', `${O}/MpiToolOptionsPaint/MpiToolOptionsPaint.js`, 'MpiToolOptionsPaint', {}],
                ['adjust', `${O}/MpiToolOptionsMaskAdjust/MpiToolOptionsMaskAdjust.js`, 'MpiToolOptionsMaskAdjust', { mode: 'paintAdjust' }],
                ['gifcutout', `${O}/MpiToolOptionsGifCutout/MpiToolOptionsGifCutout.js`, 'MpiToolOptionsGifCutout', {}],
                ['maskcolour', `${O}/MpiToolOptionsMaskColour/MpiToolOptionsMaskColour.js`, 'MpiToolOptionsMaskColour', {}],
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

        // Remove Background shows its picker only in Color mode, the cut-out only By colour.
        await window.locator('[data-panel="removebg"] .mpi-radio-group__btn[data-value="color"]').click();
        await window.locator('[data-panel="gifcutout"] .mpi-radio-group__btn[data-value="colour"]').click();
        await window.locator('#mpi964-host').screenshot({ path: testInfo.outputPath('before-pick.png') });

        for (const id of PANELS) {
            const field = window.locator(`[data-panel="${id}"] .mpi-color-field`);
            await expect(field, `${id}: one colour field`).toHaveCount(1);
            const pick = field.locator('.mpi-color-field__pick button');
            await expect(pick, `${id}: Pick button present`).toBeVisible();
            await pick.click();
            await expect(field.locator('.mpi-color-picker__hex'), `${id}: picked colour in the swatch`).toHaveText(PICKED);
        }
        await window.locator('#mpi964-host').screenshot({ path: testInfo.outputPath('after-pick.png') });

        const { paint, mask } = await window.evaluate(() => ({ paint: window.__paintColours, mask: window.__maskColours }));
        // Paint and Adjust each seed the viewer once on mount, then once per pick.
        expect(paint.filter(c => c === PICKED), 'both paint panels handed the pick to the viewer').toHaveLength(2);
        expect(mask, 'the Colour mask handed the pick to the viewer').toContain(PICKED);
        expect(pageErrors).toEqual([]);
    } finally {
        if (app) await closeApp(app);
    }
});
