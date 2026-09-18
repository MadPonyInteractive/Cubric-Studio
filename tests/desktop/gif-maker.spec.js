const { test, expect } = require('@playwright/test');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs-extra');
const sharp = require('sharp');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { ffmpegPath } = require('../../services/ffmpegBinary');
const { launchApp, closeApp } = require('./launch');

/**
 * MPI-760 — GIF Maker (formerly Export GIF), real end to end (no stubs).
 *
 * A real 2 s 640x360 clip (1 s red, 1 s blue) on a video card, trimmed to the
 * blue second, with GIF Maker settings already saved under the OLD key
 * `toolSettings.exportGif` -> the rail reads "GIF Maker", the panel loads the
 * saved settings and says Apply -> Apply builds a NEW GIF card (5 blue frames at
 * 320x180, delay 20, loop 2) that opens in the GIF workspace, and the video
 * card's history is unchanged.
 */
test.setTimeout(180000);

const execFileP = promisify(execFile);

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

function absFromUrl(raw) {
    const u = new URL(String(raw), 'http://localhost');
    return decodeURIComponent(u.searchParams.get('path') || '');
}

test('GIF Maker: Apply on a trimmed video makes a new GIF card; the video history is unchanged', async ({}, testInfo) => {
    let app, window, pageErrors = [], consoleErrors = [];
    let projectFolderPath = null;

    try {
        ({ app, window, pageErrors, consoleErrors } = await launchApp(testInfo));
        await window.waitForTimeout(6000);
        await clearBootModals(window);

        const project = await window.evaluate(async ({ name, folderPath }) => {
            const { createProject, openProject } = await import('/js/services/projectService.js');
            const p = await createProject(name, folderPath);
            await openProject(p);
            return p;
        }, { name: `mpi760-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`, folderPath: testInfo.outputPath('projects') });
        projectFolderPath = project.folderPath;
        expect(projectFolderPath, 'the project must land on real disk').toBeTruthy();

        // ── A real clip: 1 s red then 1 s blue ───────────────────────────────
        const clipPath = path.join(projectFolderPath, 'Media', 'e2e-clip_001.mp4');
        // A real video card always has its sidecar here; /gif/maker 404s without the folder.
        await fs.ensureDir(path.join(projectFolderPath, 'Media', '.meta'));
        await execFileP(ffmpegPath, [
            '-y',
            '-f', 'lavfi', '-i', 'color=c=red:s=640x360:r=30:d=1',
            '-f', 'lavfi', '-i', 'color=c=blue:s=640x360:r=30:d=1',
            '-filter_complex', '[0:v][1:v]concat=n=2:v=1:a=0',
            '-pix_fmt', 'yuv420p', clipPath,
        ]);

        const videoGroupId = await window.evaluate(async ({ clipPath }) => {
            const { state } = await import('/js/state.js');
            const { addGroup } = await import('/js/services/projectService.js');
            const { createVideoItem, createItemGroup, appendToHistory } = await import('/js/data/projectModel.js');
            state.currentProject = {
                ...state.currentProject,
                toolSettings: {
                    ...(state.currentProject.toolSettings || {}),
                    exportGif: { fps: 5, sizePreset: '320xauto', loop: 2 },
                },
            };
            const item = createVideoItem({
                filePath: `/project-file?path=${encodeURIComponent(clipPath)}`,
                displayName: 'e2e-clip_001',
                pixelDimensions: { w: 640, h: 360 },
                duration: 2, fps: 30, frameCount: 60,
                trim: { in: 1, out: 2 },
            });
            const group = appendToHistory(createItemGroup('video', { name: 'e2e-clip', fps: 30, duration: 2 }), item);
            await addGroup(group);
            const { navigate, PAGE_GROUP_HISTORY } = await import('/js/router.js');
            navigate(PAGE_GROUP_HISTORY, { groupId: group.id });
            return group.id;
        }, { clipPath });

        const groups = () => window.evaluate(async () => {
            const { state } = await import('/js/state.js');
            return state.currentProject.itemGroups.map(g => ({ id: g.id, type: g.type, history: g.history }));
        });
        const videoBefore = (await groups()).find(g => g.id === videoGroupId).history;

        // The trim the block will send is the loaded one.
        await expect.poll(() => window.evaluate(() => document.querySelector('.mpi-video-viewer')?.getRange?.()), { timeout: 20000 })
            .toMatchObject({ in: 1, out: 2 });

        // ── The rail reads GIF Maker; the saved settings load ────────────────
        const tools = window.locator('.mpi-history-tools__slot[data-mode="export"]');
        expect(await tools.locator('.mpi-history-tools__btn[data-info="Export GIF"]').count()).toBe(0);
        await tools.locator('.mpi-history-tools__btn[data-info="GIF Maker"] button').click();
        const panel = window.locator('.mpi-tool-options-gif');
        await panel.waitFor();
        expect(await panel.locator('#gif-fps-slot input').inputValue()).toBe('5');
        expect(await panel.locator('#gif-loop-slot input').inputValue()).toBe('2');
        const apply = panel.locator('#gif-actions-slot button');
        await expect(apply).toHaveText(/Apply/);

        // ── Apply -> one new GIF card ────────────────────────────────────────
        const groupCount = (await groups()).length;
        await apply.click();
        await expect.poll(async () => (await groups()).length, { timeout: 60000 }).toBe(groupCount + 1);
        await window.waitForTimeout(1000); // a duplicate card would land by now
        const after = await groups();
        expect(after.length, 'exactly one new card').toBe(groupCount + 1);
        const gifGroup = after.find(g => g.id !== videoGroupId && g.history[0]?.gif);
        expect(gifGroup, 'a GIF card').toBeTruthy();
        expect(gifGroup.type).toBe('image');
        const entry = gifGroup.history[0];
        expect(entry.operation).toBe('gif-maker');
        expect(entry.pixelDimensions).toEqual({ w: 320, h: 180 });
        expect(entry.gif.loop).toBe(2);
        expect(entry.gif.frames.map(f => f.delay)).toEqual([20, 20, 20, 20, 20]);

        const gifPath = absFromUrl(entry.filePath);
        const meta = await sharp(gifPath).metadata();
        expect(meta).toMatchObject({ format: 'gif', width: 320, height: 180, pages: 5 });
        const { data, info } = await sharp(gifPath).raw().toBuffer({ resolveWithObject: true });
        const i = (90 * info.width + 160) * info.channels;
        expect(data[i + 2] > 180 && data[i] < 60, `trimmed to the blue second, got ${data[i]},${data[i + 1]},${data[i + 2]}`).toBe(true);

        // The video card is untouched.
        expect(after.find(g => g.id === videoGroupId).history).toEqual(videoBefore);

        // ── The new card opens in the GIF workspace ──────────────────────────
        await window.evaluate(async (id) => {
            const { navigate, PAGE_GROUP_HISTORY } = await import('/js/router.js');
            navigate(PAGE_GROUP_HISTORY, { groupId: id });
        }, gifGroup.id);
        await expect.poll(() => window.evaluate(() => document.querySelectorAll('.mpi-frame-strip__thumb').length), { timeout: 20000 }).toBe(5);
        expect(await window.evaluate(() => !!document.querySelector('.mpi-gif-viewer'))).toBe(true);
    } finally {
        if (pageErrors.length || consoleErrors.length) console.log('[gif-maker] renderer errors:', pageErrors, consoleErrors);
        if (app) await closeApp(app);
        if (projectFolderPath) await fs.remove(projectFolderPath).catch(() => {});
    }
});
