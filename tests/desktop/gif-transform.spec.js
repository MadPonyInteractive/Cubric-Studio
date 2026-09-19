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
 * MPI-773 — GIF transform and export tools, real end to end (no stubs).
 *
 * Three real 1440x1920 stills -> real `POST /gif/make` -> the GIF workspace ->
 * Crop 9:16 (the image Crop panel over the GIF viewer's crop surface) ->
 * Speed 0.33 fps -> GIF to Video (a new 1080x1920 30 fps MP4 card, ~3 s per
 * image, poster + hover proxy, a pixel that matches the source colour) ->
 * Save frame as image, from the stage's right-click (a full-resolution image
 * card, exactly ONE card: a second `media:imported` once built a duplicate).
 */
test.setTimeout(240000);

const execFileP = promisify(execFile);
const W = 1440;
const H = 1920;
const RED = { r: 220, g: 30, b: 30 };
const GREEN = { r: 30, g: 200, b: 30 };
const BLUE = { r: 30, g: 30, b: 220 };

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

const near = (px, c, tol) => Math.abs(px.r - c.r) <= tol && Math.abs(px.g - c.g) <= tol && Math.abs(px.b - c.b) <= tol;

async function videoPixel(videoPath, atSeconds, x, y, width) {
    const { stdout } = await execFileP(ffmpegPath, [
        '-ss', String(atSeconds), '-i', videoPath, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-',
    ], { encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 });
    const i = (y * width + x) * 3;
    return { r: stdout[i], g: stdout[i + 1], b: stdout[i + 2] };
}

test('GIF transform: Make GIF -> Crop 9:16 -> Speed 0.33 -> GIF to Video card; Save frame gives one full-res image card', async ({}, testInfo) => {
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
        }, { name: `mpi773-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`, folderPath: testInfo.outputPath('projects') });
        projectFolderPath = project.folderPath;
        expect(projectFolderPath, 'the project must land on real disk').toBeTruthy();

        // ── Three real stills, uploaded the way an import writes them ────────
        const itemIds = [];
        for (const [i, c] of [RED, GREEN, BLUE].entries()) {
            const base64 = (await sharp({ create: { width: W, height: H, channels: 3, background: c } }).png().toBuffer()).toString('base64');
            itemIds.push(await window.evaluate(async ({ project, base64, i, w, h }) => {
                const itemId = crypto.randomUUID();
                const res = await fetch(
                    `/project-media/${project.id}/upload?folderPath=${encodeURIComponent(project.folderPath)}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            filename: `e2e-still${i}_001.png`, base64Data: base64, autoSequence: true,
                            itemId, mediaType: 'image', width: w, height: h,
                        }),
                    });
                const data = await res.json();
                if (!data.success) throw new Error(`upload failed: ${data.error}`);
                return itemId;
            }, { project, base64, i, w: W, h: H }));
        }

        // ── Real Make GIF, card built the way the gallery builds it; the 9:16
        //    crop settings are seeded (the Crop panel itself is the image tool's) ──
        const gifGroupId = await window.evaluate(async ({ itemIds }) => {
            const { state } = await import('/js/state.js');
            const { addGroup } = await import('/js/services/projectService.js');
            const { createImageItem, createItemGroup, appendToHistory } = await import('/js/data/projectModel.js');
            const res = await fetch('/gif/make', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ folderPath: state.currentProject.folderPath, itemIds }),
            });
            const data = await res.json();
            if (!data.success) throw new Error(`gif/make failed: ${data.error}`);
            const ext = data.item;
            const item = createImageItem({
                id: ext.id, filePath: ext.filePath, thumbPath: ext.thumbPath ?? null,
                operation: ext.operation, displayName: ext.displayName,
                pixelDimensions: ext.pixelDimensions, gif: ext.gif,
            });
            const group = appendToHistory(createItemGroup('image', { name: item.displayName }), item);
            await addGroup(group);
            state.currentProject = {
                ...state.currentProject,
                toolSettings: {
                    ...(state.currentProject.toolSettings || {}),
                    crop: { family: 'ratio', orientation: 'portrait', label: '9:16', divisible_by: 8 },
                },
            };
            const { navigate, PAGE_GROUP_HISTORY } = await import('/js/router.js');
            navigate(PAGE_GROUP_HISTORY, { groupId: group.id });
            return group.id;
        }, { itemIds });

        const thumbs = () => window.evaluate(() => document.querySelectorAll('.mpi-frame-strip__thumb').length);
        await expect.poll(thumbs, { timeout: 15000 }).toBe(3);

        const groups = () => window.evaluate(async () => {
            const { state } = await import('/js/state.js');
            return state.currentProject.itemGroups.map(g => ({ id: g.id, type: g.type, history: g.history }));
        });
        const gifHistory = async () => (await groups()).find(g => g.id === gifGroupId).history;
        const openTool = async (slot, info) => {
            await window.locator(`.mpi-history-tools__slot[data-mode="${slot}"] .mpi-history-tools__btn[data-info="${info}"] button`).click();
        };
        const viewer = (fn) => window.evaluate(fn);

        // No tool is up when the GIF opens.
        expect(await viewer(() => document.querySelector('.mpi-gif-viewer').getCropRect())).toBeNull();

        // ── Crop 9:16 ────────────────────────────────────────────────────────
        await openTool('transform', 'Crop');
        await window.waitForSelector('.mpi-tool-options-crop');
        await expect.poll(() => viewer(() => document.querySelector('.mpi-gif-viewer').getCropRect()), { timeout: 15000 })
            .toEqual({ x: 180, y: 0, w: 1080, h: 1920 });
        // The box survives a frame step (frames share a size).
        await viewer(() => {
            const cv = document.querySelector('.mpi-gif-viewer__edit .mpi-canvas');
            cv.setCropRect({ x: 100, y: 0, w: 1080, h: 1920 });
        });
        await window.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })));
        await expect.poll(() => viewer(() => document.querySelector('.mpi-gif-control-bar__current').textContent)).toBe('0001');
        await expect.poll(() => viewer(() => {
            const cv = document.querySelector('.mpi-gif-viewer__edit .mpi-canvas');
            return cv.img?.src.includes(document.querySelector('.mpi-gif-viewer').getFrames()[1].hash) ? cv.getCropRect() : null;
        }), { timeout: 15000 }).toEqual({ x: 100, y: 0, w: 1080, h: 1920 });
        await viewer(() => document.querySelector('.mpi-gif-viewer__edit .mpi-canvas').setCropRect({ x: 180, y: 0, w: 1080, h: 1920 }));

        let before = (await gifHistory()).length;
        await window.locator('.mpi-tool-options-crop #actions-slot button').click();
        await expect.poll(async () => (await gifHistory()).length, { timeout: 60000 }).toBe(before + 1);
        // The header's ENTRIES count follows the new entry (it once kept the count from when the card opened).
        await expect.poll(() => window.evaluate(() => document.querySelector('.mpi-project-name__stats-count')?.textContent), { timeout: 15000 })
            .toBe(String(before + 1));
        let entry = (await gifHistory()).at(-1);
        expect(entry.pixelDimensions).toEqual({ w: 1080, h: 1920 });
        expect(entry.gif.frames.map(f => f.delay)).toEqual([100, 100, 100]);
        const frame0 = path.join(projectFolderPath, 'Media', '.gif-frames', `${entry.gif.frames[0].hash}.png`);
        expect(await sharp(frame0).metadata()).toMatchObject({ width: 1080, height: 1920 });

        // ── Speed 0.33 fps -> each image holds 3.03 s ────────────────────────
        await openTool('timing', 'Speed');
        await window.locator('.mpi-tool-options-gif-timing input[inputmode="decimal"]').fill('0.33');
        before = (await gifHistory()).length;
        await window.locator('.mpi-tool-options-gif-timing #actions-slot button').click();
        await expect.poll(async () => (await gifHistory()).length, { timeout: 60000 }).toBe(before + 1);
        entry = (await gifHistory()).at(-1);
        expect(entry.gif.frames.map(f => f.delay)).toEqual([303, 303, 303]);

        // ── GIF to Video -> a new video card, the GIF history untouched ──────
        await openTool('export', 'GIF to Video');
        await window.waitForSelector('.mpi-tool-options-gif-transform');
        const groupCount = (await groups()).length;
        before = (await gifHistory()).length;
        await window.locator('.mpi-tool-options-gif-transform #actions-slot button').click();
        await expect.poll(async () => (await groups()).length, { timeout: 120000 }).toBe(groupCount + 1);
        const videoGroup = (await groups()).find(g => g.type === 'video');
        expect(videoGroup, 'a video card').toBeTruthy();
        const video = videoGroup.history[0];
        expect(video.pixelDimensions).toEqual({ w: 1080, h: 1920 });
        expect(video.fps).toBe(30);
        expect(Math.abs(video.duration - 9.09), `duration ${video.duration}`).toBeLessThan(0.1);
        const videoPath = absFromUrl(video.filePath);
        expect(await fs.pathExists(videoPath)).toBe(true);
        expect(await fs.pathExists(absFromUrl(video.thumbPath)), 'poster').toBe(true);
        expect(await fs.pathExists(absFromUrl(video.proxyPath)), 'hover proxy').toBe(true);
        expect(near(await videoPixel(videoPath, 1.5, 540, 960, 1080), RED, 12), 'first image holds ~3 s').toBe(true);
        expect(near(await videoPixel(videoPath, 4.5, 540, 960, 1080), GREEN, 12), 'second image').toBe(true);
        expect(near(await videoPixel(videoPath, 7.5, 540, 960, 1080), BLUE, 12), 'third image').toBe(true);
        expect((await gifHistory()).length, 'GIF to Video adds a card, not a GIF entry').toBe(before);

        // ── Save frame as image -> ONE full-res image card ───────────────────
        // From the STAGE's right-click (MPI-771 audit): it left the rail, the way
        // the video workspace has always offered Create snapshot.
        const beforeSave = (await groups()).length;
        await window.locator('.mpi-gif-viewer__stage').click({ button: 'right' });
        await expect.poll(() => window.evaluate(() => !!document.querySelector('.mpi-ctx-menu'))).toBe(true);
        await window.locator('.mpi-ctx-menu__item[data-key="save-frame"]').click();
        await expect.poll(async () => (await groups()).length, { timeout: 30000 }).toBe(beforeSave + 1);
        await window.waitForTimeout(1500); // a duplicate card would land by now
        const after = await groups();
        expect(after.length, 'exactly one new card').toBe(beforeSave + 1);
        const still = after.at(-1).history[0];
        expect(still.pixelDimensions).toEqual({ w: 1080, h: 1920 });
        const stillPath = absFromUrl(still.filePath);
        const { data, info } = await sharp(stillPath).raw().toBuffer({ resolveWithObject: true });
        const i = (960 * info.width + 540) * info.channels;
        expect(near({ r: data[i], g: data[i + 1], b: data[i + 2] }, RED, 0), 'full-colour frame 0').toBe(true);
    } finally {
        if (pageErrors.length || consoleErrors.length) console.log('[gif-transform] renderer errors:', pageErrors, consoleErrors);
        if (app) await closeApp(app);
        if (projectFolderPath) await fs.remove(projectFolderPath).catch(() => {});
    }
});
