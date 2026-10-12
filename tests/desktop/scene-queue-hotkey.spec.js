const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('./launch');

/**
 * MPI-623 — Q opens the Cue queue in the 360 player (Fabio, 2026-10-12: "In the 3D video, I should be
 * able to access my queue by pressing Q, and I can't"). Q was bound by Gallery and Group History only;
 * every workspace now binds `bindQueueSlideOver` (js/shell/queueSlideOver.js). In the Scene itself Q
 * flies down, so there it must NOT open the queue, while the status bar's `generation-queue:open` still does.
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

async function openCard(window, id, root) {
    await window.evaluate((gid) => document
        .querySelector(`.mpi-gallery-grid__row-wrap[data-group-id="${gid}"] .mpi-group-card`)
        .dispatchEvent(new MouseEvent('click', { bubbles: true })), id);
    await expect(window.locator(root)).toHaveCount(1, { timeout: 10000 });
    await window.evaluate(() => document.activeElement?.blur?.());
    await window.waitForTimeout(400);
}

async function backToGallery(window) {
    await window.evaluate(async () => {
        const { navigate, PAGE_GALLERY } = await import('/js/router.js');
        navigate(PAGE_GALLERY);
    });
    await expect(window.locator('.mpi-gallery-grid__row-wrap')).toHaveCount(2, { timeout: 15000 });
}

test('Q opens the queue in the 360 player; in the Scene Q flies, the status bar still opens it', async ({}, testInfo) => {
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

        // ── The 360 player: Q toggles the queue open, and shut ──────────────────
        await openCard(window, 'e2e-path', '.mpi-pano-video-block');
        expect(await queueOpen(window), 'closed on arrival').toBe(false);
        await window.keyboard.press('q');
        await expect.poll(() => queueOpen(window), { timeout: 5000 }).toBe(true);
        await window.keyboard.press('q');
        await expect.poll(() => queueOpen(window), { timeout: 5000 }).toBe(false);
        await backToGallery(window);

        // ── The Scene: Q is fly-down, so no queue; the status bar's open still works ──
        await openCard(window, 'e2e-scene', '.mpi-scene-block');
        await window.keyboard.down('q');
        await window.waitForTimeout(300);
        await window.keyboard.up('q');
        await window.waitForTimeout(500);
        expect(await queueOpen(window), 'Q flies in the Scene').toBe(false);
        await window.evaluate(async () => (await import('/js/events.js')).Events.emit('generation-queue:open'));
        await expect.poll(() => queueOpen(window), { timeout: 5000 }).toBe(true);

        expect(pageErrors, 'no page errors').toEqual([]);
    } finally {
        await closeApp(app);
    }
});
