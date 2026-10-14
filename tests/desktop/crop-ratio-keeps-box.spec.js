// MPI-1141 — picking another crop ratio keeps the box where the user put it, and the box
// stays on screen. Before: every ratio click threw the box away for the largest centred
// box, and the view could lose it entirely until the user left for the gallery and back.
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('./launch');

test.setTimeout(90000);

const SIZE = 1024;

async function makeProject(testInfo) {
    const folder = testInfo.outputPath('project');
    const media = path.join(folder, 'Media');
    fs.mkdirSync(media, { recursive: true });
    const src = path.join(media, 'src.png');
    fs.writeFileSync(src, await sharp({ create: { width: SIZE, height: SIZE, channels: 3, background: { r: 200, g: 120, b: 40 } } }).png().toBuffer());
    const now = new Date().toISOString();
    const group = { id: 'gRatio', type: 'image', selectedIndex: 0 };
    const item = { id: 'iRatio', type: 'image', displayName: 'src', filePath: `/project-file?path=${encodeURIComponent(src)}`, pixelDimensions: { w: SIZE, h: SIZE } };
    const project = { id: 'pRatio', name: 'Ratio', folderPath: folder, createdAt: now, updatedAt: now, toolSettings: {}, itemGroups: [{ ...group, history: [item] }] };
    fs.writeFileSync(path.join(folder, 'project.json'), JSON.stringify({ ...project, itemGroups: [{ ...group, history: ['iRatio'] }] }, null, 2));
    return project;
}

/** The crop box in image px and where it sits on the stage, in stage px. */
const snapshot = (window) => window.evaluate(() => {
    const viewer = document.querySelector('.mpi-canvas-viewer');
    const cv = viewer.querySelector('.mpi-canvas');
    const r = viewer.getCropRect();
    const stage = cv.getBoundingClientRect();
    return {
        rect: r,
        managed: cv.isManagedView,
        screen: { x: cv.offsetX + r.x * cv.scale, y: cv.offsetY + r.y * cv.scale, w: r.w * cv.scale, h: r.h * cv.scale },
        stage: { w: stage.width, h: stage.height },
    };
});

const onStage = ({ screen, stage }) =>
    screen.x >= -1 && screen.y >= -1 && screen.x + screen.w <= stage.w + 1 && screen.y + screen.h <= stage.h + 1;

test('another ratio keeps the box centre and keeps it on screen', async ({}, testInfo) => {
    const project = await makeProject(testInfo);
    const { app, window, pageErrors } = await launchApp(testInfo);
    try {
        await window.evaluate(async (p) => {
            const { state } = await import('/js/state.js');
            state.currentProject = p;
            const { navigate, PAGE_GROUP_HISTORY } = await import('/js/router.js');
            navigate(PAGE_GROUP_HISTORY, { groupId: p.itemGroups[0].id });
        }, project);
        await expect(window.locator('.mpi-history-tools')).toBeVisible();
        await window.evaluate(() => document.querySelector('.mpi-history-tools').setMode('crop'));
        const panel = window.locator('.mpi-tool-options-crop');
        await expect(panel).toBeVisible({ timeout: 20000 });
        await expect.poll(() => window.evaluate(() =>
            document.querySelector('.mpi-canvas-viewer').getSourceElement()?.naturalWidth ?? 0)).toBe(SIZE);

        await panel.locator('.mpi-tool-options-crop__orientation [data-value="landscape"]').click();
        await panel.locator('.mpi-tool-options-crop__ratios [data-value="2:1"]').click();

        // 1. A box inside the picture, moved off-centre: a ratio change keeps its centre.
        await window.evaluate(() => document.querySelector('.mpi-canvas-viewer').setCropRect({ x: 100, y: 500, w: 600, h: 300 }));
        await panel.locator('.mpi-tool-options-crop__ratios [data-value="4:3"]').click();
        let s = await snapshot(window);
        testInfo.attach('inside', { body: JSON.stringify(s, null, 2), contentType: 'application/json' });
        expect(Math.abs(s.rect.x + s.rect.w / 2 - 400)).toBeLessThanOrEqual(1);
        expect(Math.abs(s.rect.y + s.rect.h / 2 - 650)).toBeLessThanOrEqual(1);
        expect(Math.abs(s.rect.w / s.rect.h - 4 / 3)).toBeLessThan(0.01);
        expect(s.rect.y + s.rect.h).toBeLessThanOrEqual(SIZE);   // was inside, stays inside
        expect(onStage(s), JSON.stringify(s)).toBe(true);

        // 2. The screenshot's case: a 2:1 box hanging off the right of the picture.
        await panel.locator('.mpi-tool-options-crop__ratios [data-value="2:1"]').click();
        await window.evaluate(() => document.querySelector('.mpi-canvas-viewer').setCropRect({ x: 0, y: 0, w: 2048, h: 1024 }));
        await expect.poll(async () => onStage(await snapshot(window))).toBe(true);
        // A wheel zoom drops the managed view: the picture fills the stage, the box is off it.
        const stage = await window.locator('.mpi-canvas-viewer .mpi-canvas').boundingBox();
        await window.mouse.move(stage.x + stage.width / 4, stage.y + stage.height / 2);
        for (let i = 0; i < 15; i++) await window.mouse.wheel(0, -200);
        await expect.poll(async () => onStage(await snapshot(window)), 'zoomed in, the box leaves the stage').toBe(false);
        await panel.locator('.mpi-tool-options-crop__ratios [data-value="16:9"]').click();
        s = await snapshot(window);
        testInfo.attach('outside', { body: JSON.stringify(s, null, 2), contentType: 'application/json' });
        expect(Math.abs(s.rect.x + s.rect.w / 2 - 1024)).toBeLessThanOrEqual(1);
        expect(Math.abs(s.rect.y + s.rect.h / 2 - 512)).toBeLessThanOrEqual(1);
        expect(Math.abs(s.rect.w / s.rect.h - 16 / 9)).toBeLessThan(0.01);
        await expect.poll(async () => onStage(await snapshot(window)), 'the box is on the stage').toBe(true);

        // 3. Zoomed off the box again, then a tool round-trip: the box comes back, on screen.
        await window.mouse.move(stage.x + stage.width / 4 + 5, stage.y + stage.height / 2);
        for (let i = 0; i < 15; i++) await window.mouse.wheel(0, -200);
        await expect.poll(async () => onStage(await snapshot(window))).toBe(false);
        await window.evaluate(() => document.querySelector('.mpi-history-tools').setMode('mask'));
        await window.evaluate(() => document.querySelector('.mpi-history-tools').setMode('crop'));
        await expect.poll(async () => onStage(await snapshot(window)), 'still on the stage after a tool switch').toBe(true);

        expect(pageErrors).toEqual([]);
    } finally {
        await closeApp(app);
    }
});
