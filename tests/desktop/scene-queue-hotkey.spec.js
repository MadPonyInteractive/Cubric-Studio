const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('./launch');

/**
 * MPI-623 — Q opens the Cue queue in the 360 player (Fabio, 2026-10-12: "In the 3D video, I should be
 * able to access my queue by pressing Q, and I can't"). Q was bound by Gallery and Group History only;
 * every workspace now binds `bindQueueSlideOver` (js/shell/queueSlideOver.js). In the Scene itself Q
 * flies down, so there it must NOT open the queue, while the status bar's `generation-queue:open` still does.
 *
 * MPI-1238 — the rest of the app's keys on the Scene page (Fabio, 2026-10-21: "Q doesn't work there,
 * A doesn't work there, and Escape doesn't work there"). Escape returns to the gallery from both Blocks,
 * A toggles Agent mode in the 360 player (it flies left in the Scene), and Tab opens the radial in both.
 * The keys are pressed after REAL clicks on the player's controls, not after a blur: a focused control
 * is how the user meets them.
 */
test.setTimeout(180000);

const STILL = '/comfy_workflows/display/flow-head-swap.webp';
const CLIP = '/comfy_workflows/display/flow-character-sheet.mp4';

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

const queueOpen = (window) => window.evaluate(() => {
    const p = document.querySelector('.mpi-slide-over--queue');
    return !!p && p.getAttribute('aria-expanded') !== 'false' && getComputedStyle(p).visibility !== 'hidden';
});

const agentMode = (window) => window.evaluate(async () => !!(await import('/js/state.js')).state.agentMode);

async function openCard(window, id, root) {
    await window.evaluate((gid) => document
        .querySelector(`.mpi-gallery-grid__row-wrap[data-group-id="${gid}"] .mpi-group-card`)
        .dispatchEvent(new MouseEvent('click', { bubbles: true })), id);
    await expect(window.locator(root)).toHaveCount(1, { timeout: 10000 });
    await window.waitForTimeout(400);
}

/** Escape leaves the workspace: the hotkey under test, and the way back for the next leg. */
async function escapeToGallery(window, root) {
    await window.keyboard.press('Escape');
    await expect(window.locator(root)).toHaveCount(0, { timeout: 10000 });
    await expect(window.locator('.mpi-gallery-grid__row-wrap')).toHaveCount(2, { timeout: 15000 });
}

async function radialOpens(window) {
    await window.keyboard.down('Tab');
    await expect(window.locator('.mpi-radial--visible')).toBeVisible({ timeout: 5000 });
    await window.keyboard.up('Tab'); // released in the middle: picks nothing
    await expect(window.locator('.mpi-radial--visible')).toHaveCount(0, { timeout: 5000 });
}

test('Scene page keys: Q, A, Tab and Escape in the 360 player; Escape and Tab in the Scene, where Q and A fly', async ({}, testInfo) => {
    const { app, window, pageErrors } = await launchApp(testInfo);
    try {
        await window.waitForTimeout(6000);
        await window.evaluate(async () => {
            const { Events } = await import('/js/events.js');
            Events.emit('engine:install-skipped');
            await new Promise(r => setTimeout(r, 300));
        });
        await clearBootModals(window);

        await window.evaluate(async ({ name, folderPath, still, clip }) => {
            const { createProject, openProject, addGroup } = await import('/js/services/projectService.js');
            const p = await createProject(name, folderPath);
            await openProject(p);
            const at = new Date().toISOString();
            await addGroup({ id: 'e2e-path', type: 'video', name: 'path', createdAt: at, selectedIndex: 0, history: [
                { id: 'e2e-path-1', type: 'video', operation: 'scenePathVideo', filePath: clip, thumbPath: still, createdAt: at, pixelDimensions: { w: 1440, h: 720 } },
            ] });
            await addGroup({ id: 'e2e-scene', type: 'image', name: 'scene', createdAt: at, selectedIndex: 0, history: [
                { id: 'e2e-scene-1', type: 'image', filePath: still, thumbPath: still, createdAt: at, pixelDimensions: { w: 4096, h: 2048 },
                    scenePath: '/project-file?path=.meta/e2e-scene-1.scene.json' },
            ] });
            const { navigate, PAGE_GALLERY } = await import('/js/router.js');
            navigate(PAGE_GALLERY);
            await new Promise(r => setTimeout(r, 1200));
        }, { name: `mpi623-q-${Date.now()}`, folderPath: testInfo.outputPath('projects'), still: STILL, clip: CLIP });
        await expect(window.locator('.mpi-gallery-grid__row-wrap')).toHaveCount(2, { timeout: 15000 });

        // ── The 360 player, after the user has clicked its controls ─────────────
        await openCard(window, 'e2e-path', '.mpi-pano-video-block');
        await window.locator('.mpi-pano-video-block__viewport').click();
        await window.locator('.mpi-pano-video-block__scrub .mpi-progress__input').click();
        await window.locator('.mpi-pano-video-block .mpi-radio-group__btn').nth(1).click();

        expect(await queueOpen(window), 'closed on arrival').toBe(false);
        await window.keyboard.press('q');
        await expect.poll(() => queueOpen(window), { timeout: 5000 }).toBe(true);
        await window.keyboard.press('q');
        await expect.poll(() => queueOpen(window), { timeout: 5000 }).toBe(false);

        const before = await agentMode(window);
        await window.keyboard.press('a');
        await expect.poll(() => agentMode(window), { timeout: 5000 }).toBe(!before);
        await window.keyboard.press('a');
        await expect.poll(() => agentMode(window), { timeout: 5000 }).toBe(before);

        await radialOpens(window);
        await escapeToGallery(window, '.mpi-pano-video-block');

        // ── The Scene: Q and A fly, so no queue and no Agent mode; the rest still answers ──
        await openCard(window, 'e2e-scene', '.mpi-scene-block');
        await window.locator('.mpi-scene-block canvas').first().click();
        const agentBefore = await agentMode(window);
        for (const k of ['q', 'a']) {
            await window.keyboard.down(k);
            await window.waitForTimeout(300);
            await window.keyboard.up(k);
        }
        await window.waitForTimeout(500);
        expect(await queueOpen(window), 'Q flies in the Scene').toBe(false);
        expect(await agentMode(window), 'A flies in the Scene').toBe(agentBefore);
        await window.evaluate(async () => (await import('/js/events.js')).Events.emit('generation-queue:open'));
        await expect.poll(() => queueOpen(window), { timeout: 5000 }).toBe(true);

        // The open queue takes the first Escape; the second leaves.
        await window.keyboard.press('Escape');
        await expect.poll(() => queueOpen(window), { timeout: 5000 }).toBe(false);
        await expect(window.locator('.mpi-scene-block')).toHaveCount(1);
        await radialOpens(window);
        await escapeToGallery(window, '.mpi-scene-block');

        expect(pageErrors, 'no page errors').toEqual([]);
    } finally {
        await closeApp(app);
    }
});
