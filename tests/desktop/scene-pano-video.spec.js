const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('./launch');
const { ffmpegPath } = require('../../services/ffmpegBinary');

/**
 * MPI-623 — "Convert to 360 video" (Fabio, 2026-10-12: a 360 video of your own opens in the 360 player too).
 * Offered on a 2:1 video only; choosing it marks the entry `pano360`, opens the player, and from then on
 * a left-click on the card opens the player instead of Group History.
 */
test.setTimeout(180000);

const STILL = '/comfy_workflows/display/flow-head-swap.webp';

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

/** Right-click a card; return the menu's row keys, then pick `pick` (or close it). */
const menu = (window, groupId, pick = null) => window.evaluate(async ({ id, pick }) => {
    document.querySelector(`.mpi-gallery-grid__row-wrap[data-group-id="${id}"] .mpi-group-card`)
        .dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 80, clientY: 80 }));
    await new Promise(r => setTimeout(r, 250));
    const rows = [...document.querySelectorAll('.mpi-ctx-menu__item')];
    const keys = rows.map(r => r.dataset.key);
    const row = pick && rows.find(r => r.dataset.key === pick);
    if (row) row.click();
    else (await import('/js/events.js')).Events.emit('ui:close-all-popups');
    await new Promise(r => setTimeout(r, 200));
    return keys;
}, { id: groupId, pick });

const toGallery = async (window) => {
    await window.evaluate(async () => {
        const { navigate, PAGE_GALLERY } = await import('/js/router.js');
        navigate(PAGE_GALLERY);
    });
    await expect(window.locator('.mpi-gallery-grid__row-wrap')).toHaveCount(2, { timeout: 15000 });
};

test('Convert to 360 video: 2:1 only, opens the 360 player, and the card stays a 360 video', async ({}, testInfo) => {
    const { app, window, pageErrors } = await launchApp(testInfo);
    try {
        await window.waitForTimeout(6000);
        await window.evaluate(async () => {
            const { Events } = await import('/js/events.js');
            Events.emit('engine:install-skipped');
            await new Promise(r => setTimeout(r, 300));
        });
        await clearBootModals(window);

        const projectDir = await window.evaluate(async ({ name, folderPath }) => {
            const { createProject, openProject } = await import('/js/services/projectService.js');
            const p = await createProject(name, folderPath);
            await openProject(p);
            return p.folderPath;
        }, { name: `mpi623-v360-${Date.now()}`, folderPath: testInfo.outputPath('projects') });
        // A real 2:1 clip in the project, as an import lands one: the player must load and play it.
        const src = path.join(projectDir, 'Media', 'clip360.mp4');
        fs.mkdirSync(path.dirname(src), { recursive: true });
        execFileSync(ffmpegPath, ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc2=s=640x320:r=24:d=2',
            '-c:v', 'libx264', '-pix_fmt', 'yuv420p', src], { windowsHide: true });

        await window.evaluate(async ({ still, clip }) => {
            const { addGroup } = await import('/js/services/projectService.js');
            const at = new Date().toISOString();
            const video = (id, w, h) => ({ id, type: 'video', operation: 'imported', filePath: clip, thumbPath: still, createdAt: at,
                pixelDimensions: { w, h }, fps: 24, frameCount: 48, duration: 2 });
            await addGroup({ id: 'e2e-360', type: 'video', name: '360', createdAt: at, selectedIndex: 0, history: [video('e2e-360-1', 3840, 1920)] });
            await addGroup({ id: 'e2e-flat', type: 'video', name: 'flat', createdAt: at, selectedIndex: 0, history: [video('e2e-flat-1', 1920, 1080)] });
            const { navigate, PAGE_GALLERY } = await import('/js/router.js');
            navigate(PAGE_GALLERY);
            await new Promise(r => setTimeout(r, 1200));
        }, { still: STILL, clip: `/project-file?path=${encodeURIComponent(src)}` });
        await expect(window.locator('.mpi-gallery-grid__row-wrap')).toHaveCount(2, { timeout: 15000 });

        expect(await menu(window, 'e2e-flat'), 'a flat clip is not offered').not.toContain('convert-pano-video');
        expect(await menu(window, 'e2e-360', 'convert-pano-video')).toContain('convert-pano-video');

        // The player opens and loads the clip, its slider sized off the import's own frame count.
        await expect(window.locator('.mpi-pano-video-block')).toHaveCount(1, { timeout: 10000 });
        await expect.poll(() => window.evaluate(() => document.querySelector('.mpi-pano-video-block')?.isLoaded?.()), { timeout: 15000 }).toBe(true);
        expect(await window.evaluate(async () => {
            const { state } = await import('/js/state.js');
            return state.currentProject.itemGroups.find(g => g.id === 'e2e-360').history[0].pano360;
        })).toBe(true);
        // project.json keeps ids only: the mark must be in the item's sidecar or a reload loses it.
        const meta = JSON.parse(fs.readFileSync(path.join(projectDir, 'Media', '.meta', 'e2e-360-1.json'), 'utf8'));
        expect(meta.pano360, 'the sidecar carries the mark').toBe(true);
        await expect(window.locator('.mpi-pano-video-block')).toContainText('of 48');

        // Back in the gallery: a left-click opens the player now, and Convert is not offered again.
        await toGallery(window);
        expect(await menu(window, 'e2e-360')).not.toContain('convert-pano-video');
        await window.evaluate(() => document
            .querySelector('.mpi-gallery-grid__row-wrap[data-group-id="e2e-360"] .mpi-group-card')
            .dispatchEvent(new MouseEvent('click', { bubbles: true })));
        await expect(window.locator('.mpi-pano-video-block')).toHaveCount(1, { timeout: 10000 });

        expect(pageErrors, 'no page errors').toEqual([]);
    } finally {
        await closeApp(app);
    }
});
