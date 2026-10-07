// MPI-623 — the Scene workspace shell (plan A9, Parallel Batch "Scene workspace shell").
//
// Three things this proves, each silent when wrong:
//   1. Leaving Scene LOSES its WebGL context. Chromium caps live contexts (~16) and kills
//      the oldest past that, so a leak shows only on the Nth visit, as some other canvas
//      going blank. Every context the page makes is recorded and must read lost after.
//   2. Scene-ness is the CARD's: a scene card whose selected entry is one of its plain
//      pictures still opens Scene and still wears the 3D chip (A3).
//   3. "Convert to 360 pano" is offered on a plain 2:1 still and nowhere else.
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('./launch');

test.setTimeout(180000);

const STILL = '/comfy_workflows/display/flow-head-swap.webp';
const VISITS = 10;

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

/** Right-click a card; the menu row keys it offers and whether convert-pano is disabled. */
async function menuRows(window, groupId) {
    return window.evaluate(async (id) => {
        document.querySelector(`.mpi-gallery-grid__row-wrap[data-group-id="${id}"] .mpi-group-card`)
            .dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 80, clientY: 80 }));
        await new Promise(r => setTimeout(r, 250));
        const rows = [...document.querySelectorAll('.mpi-ctx-menu__item')];
        const convert = rows.find(r => r.dataset.key === 'convert-pano');
        const out = { keys: rows.map(r => r.dataset.key), convertDisabled: convert ? convert.disabled : null };
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        const { Events } = await import('/js/events.js');
        Events.emit('ui:close-all-popups');
        await new Promise(r => setTimeout(r, 200));
        return out;
    }, groupId);
}

test('Scene: a scene card opens it whichever entry is selected, every visit frees its GL context, Convert is offered on 2:1 only', async ({}, testInfo) => {
    const { app, window, pageErrors } = await launchApp(testInfo);

    try {
        await window.waitForTimeout(6000);
        await window.evaluate(async () => {
            const { Events } = await import('/js/events.js');
            Events.emit('engine:install-skipped');
            await new Promise(r => setTimeout(r, 300));
        });
        await clearBootModals(window);

        await window.evaluate(async ({ name, folderPath, still }) => {
            const { createProject, openProject, addGroup } = await import('/js/services/projectService.js');
            const p = await createProject(name, folderPath);
            await openProject(p);
            const at = new Date().toISOString();
            const item = (id, w, h, extra = {}) => ({ id, type: 'image', filePath: still, thumbPath: still, createdAt: at, pixelDimensions: { w, h }, ...extra });
            // The scene card's SELECTED entry is a plain picture taken in it (index 1).
            await addGroup({ id: 'e2e-scene', type: 'image', name: 'scene', createdAt: at, selectedIndex: 1, history: [
                item('e2e-scene-pano', 4096, 2048, { scenePath: '/project-file?path=.meta/e2e-scene-pano.scene.json' }),
                item('e2e-scene-shot', 1360, 768),
            ] });
            await addGroup({ id: 'e2e-pano', type: 'image', name: 'pano', createdAt: at, selectedIndex: 0, history: [item('e2e-pano-1', 4096, 2048)] });
            await addGroup({ id: 'e2e-flat', type: 'image', name: 'flat', createdAt: at, selectedIndex: 0, history: [item('e2e-flat-1', 1920, 1080)] });

            // Every WebGL2 context the page makes from here on, kept to ask it later.
            window.__sceneGL = [];
            const getContext = HTMLCanvasElement.prototype.getContext;
            HTMLCanvasElement.prototype.getContext = function (kind, ...rest) {
                const ctx = getContext.call(this, kind, ...rest);
                if (kind === 'webgl2') window.__sceneGL.push({ ctx, canvas: this });
                return ctx;
            };

            const { navigate, PAGE_GALLERY } = await import('/js/router.js');
            navigate(PAGE_GALLERY);
            await new Promise(r => setTimeout(r, 1200));
        }, { name: `mpi623-${Date.now()}`, folderPath: testInfo.outputPath('projects'), still: STILL });
        await expect(window.locator('.mpi-gallery-grid__row-wrap')).toHaveCount(3, { timeout: 15000 });

        // ── 2. The chip is the card's, not the selected entry's ───────────────────
        await expect(window.locator('.mpi-gallery-grid__row-wrap[data-group-id="e2e-scene"] .mpi-group-card__kind'))
            .toHaveAttribute('data-kind', 'scene');

        // ── 1. Ten round trips, each through the real left-click intercept ────────
        for (let i = 0; i < VISITS; i++) {
            await window.evaluate(() => document
                .querySelector('.mpi-gallery-grid__row-wrap[data-group-id="e2e-scene"] .mpi-group-card')
                .dispatchEvent(new MouseEvent('click', { bubbles: true })));
            await expect(window.locator('.mpi-scene-block .mpi-scene-canvas')).toHaveCount(1, { timeout: 10000 });
            expect(await window.evaluate(async () => {
                const { state } = await import('/js/state.js');
                return [state.currentPage, state.currentParams?.groupId, document.body.classList.contains('page-scene')];
            })).toEqual(['scene', 'e2e-scene', true]);
            await window.evaluate(async () => {
                const { navigate, PAGE_GALLERY } = await import('/js/router.js');
                navigate(PAGE_GALLERY);
            });
            await expect(window.locator('.mpi-gallery-grid__row-wrap')).toHaveCount(3, { timeout: 10000 });
        }

        const gl = await window.evaluate(() => ({
            sceneCanvases: document.querySelectorAll('.mpi-scene-canvas').length,
            made: window.__sceneGL.length,
            nulls: window.__sceneGL.filter(r => !r.ctx).length,
            live: window.__sceneGL.filter(r => r.ctx && !r.ctx.isContextLost()).length,
            sized: window.__sceneGL.filter(r => r.canvas.width || r.canvas.height).length,
        }));
        expect(gl.sceneCanvases, 'no Scene canvas survives leaving').toBe(0);
        expect(gl.nulls, 'WebGL2 is available in this run, so the teardown below is real').toBe(0);
        expect(gl.made, 'one context per visit').toBe(VISITS);
        expect(gl.live, 'every context lost on leave').toBe(0);
        expect(gl.sized, 'every canvas zeroed on leave').toBe(0);

        // ── 3. Convert to 360 pano: a plain 2:1 still only, live since Phase 2's sceneConvert ──
        const pano = await menuRows(window, 'e2e-pano');
        expect(pano.keys).toContain('convert-pano');
        expect(pano.convertDisabled).toBe(false);
        expect((await menuRows(window, 'e2e-flat')).keys).not.toContain('convert-pano');
        expect((await menuRows(window, 'e2e-scene')).keys, 'a scene card is never converted again').not.toContain('convert-pano');

        expect(pageErrors).toEqual([]);
    } finally {
        await closeApp(app);
    }
});
