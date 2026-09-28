// MPI-949 Phase 5 — Crop on a stack in the History workspace: ONE ratio for every member,
// a box per member. Each member starts on its own largest centred box; a box the user moves
// is kept per member across member switches (and marked on the strip); Apply cuts every
// member to its box as that member's next version, sizes rounded DOWN (D2) so no box
// leaves its picture.
//
// Real files on disk, the real /project/crop-media route: what is measured is what was written.
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('./launch');

test.setTimeout(120000);

// Three sizes: landscape, portrait, square. A left-to-right red ramp, so a crop's
// left edge says where it was cut from.
const SIZES = [[400, 300], [300, 400], [256, 256]];

async function makeProject(testInfo) {
    const folder = testInfo.outputPath('project');
    const media = path.join(folder, 'Media');
    fs.mkdirSync(media, { recursive: true });
    const now = new Date().toISOString();
    const members = [];
    for (const [i, [w, h]] of SIZES.entries()) {
        const raw = Buffer.alloc(w * h * 3);
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) raw[(y * w + x) * 3] = Math.floor((x / w) * 255);
        const file = path.join(media, `m${i}.png`);
        fs.writeFileSync(file, await sharp(raw, { raw: { width: w, height: h, channels: 3 } }).png().toBuffer());
        members.push({
            id: `g${i}`, type: 'image', selectedIndex: 0, stackId: 'sCrop', createdAt: now,
            history: [{ id: `i${i}`, type: 'image', displayName: `m${i}`, filePath: `/project-file?path=${encodeURIComponent(file)}`, pixelDimensions: { w, h } }],
        });
    }
    const stack = { id: 'sCrop', type: 'stack', kind: 'image', members: members.map(m => m.id), history: [], selectedIndex: 0, name: 'm0', createdAt: now };
    const project = { id: 'pStackCrop', name: 'Stack crop', folderPath: folder, createdAt: now, updatedAt: now, toolSettings: {}, itemGroups: [...members, stack] };
    fs.writeFileSync(path.join(folder, 'project.json'), JSON.stringify({
        ...project, itemGroups: [...members.map(m => ({ ...m, history: m.history.map(it => it.id) })), stack],
    }, null, 2));
    return project;
}

const sourceWidth = (window) => window.evaluate(() =>
    document.querySelector('.mpi-canvas-viewer').getSourceElement()?.naturalWidth ?? 0);
const cropRect = (window) => window.evaluate(() => document.querySelector('.mpi-canvas-viewer').getCropRect());

test('Stack crop: one ratio, a moved box kept per member, Apply cuts every member inside its picture', async ({}, testInfo) => {
    const project = await makeProject(testInfo);
    const { app, window, pageErrors } = await launchApp(testInfo);
    try {
        await window.evaluate(async (p) => {
            const { state } = await import('/js/state.js');
            state.currentProject = p;
            const { navigate, PAGE_GROUP_HISTORY } = await import('/js/router.js');
            navigate(PAGE_GROUP_HISTORY, { groupId: 'sCrop' });
        }, project);
        await expect(window.locator('.mpi-thumb-strip__thumb')).toHaveCount(3, { timeout: 15000 });

        // ── 1. Crop is on a stack's rail; its panel offers RATIO only ────────────────
        await window.evaluate(() => document.querySelector('.mpi-history-tools').setMode('crop'));
        const panel = window.locator('.mpi-tool-options-crop');
        await expect(panel).toBeVisible();
        await expect(panel.locator('.mpi-tool-options-crop__family')).toBeHidden();
        await expect.poll(() => sourceWidth(window)).toBe(400);
        await panel.locator('.mpi-tool-options-crop__ratios [data-value="9:16"]').click();
        // The largest centred 9:16 box on 400 x 300.
        await expect.poll(() => cropRect(window)).toEqual({ x: 116, y: 0, w: 169, h: 300 });

        // ── 2. Move member 1's box; it survives a trip to member 2 and back ──────────
        await window.evaluate(() => document.querySelector('.mpi-canvas-viewer').setCropRect({ x: 20, y: 0, w: 168, h: 300 }));
        await window.locator('.mpi-thumb-strip__thumb[data-index="1"]').click();
        await expect.poll(() => sourceWidth(window)).toBe(300);
        await expect.poll(() => cropRect(window), 'member 2 starts on ITS centred box').toEqual({ x: 38, y: 0, w: 225, h: 400 });
        await expect(window.locator('.mpi-thumb-strip__thumb[data-index="0"]')).toHaveClass(/mpi-group-history-block__member--crop-moved/);
        await expect(window.locator('.mpi-thumb-strip__thumb[data-index="1"]')).not.toHaveClass(/crop-moved/);
        await window.locator('.mpi-thumb-strip__thumb[data-index="0"]').click();
        await expect.poll(() => sourceWidth(window)).toBe(400);
        await expect.poll(() => cropRect(window), 'the moved box is back').toEqual({ x: 20, y: 0, w: 168, h: 300 });

        // ── 3. Apply: every member gets a new version, cut to its own box ────────────
        await panel.getByRole('button', { name: 'Apply' }).click();
        const results = await expect.poll(() => window.evaluate(async () => {
            const { state } = await import('/js/state.js');
            return ['g0', 'g1', 'g2'].map(id => state.currentProject.itemGroups.find(g => g.id === id).history.length);
        }), { timeout: 20000 }).toEqual([2, 2, 2]).then(() => window.evaluate(async () => {
            const { state } = await import('/js/state.js');
            return ['g0', 'g1', 'g2'].map((id) => {
                const g = state.currentProject.itemGroups.find(x => x.id === id);
                const it = g.history[1];
                return { op: it.operation, selected: g.selectedIndex, file: new URL(it.filePath, location.href).searchParams.get('path') };
            });
        }));
        expect(results.every(r => r.op === 'crop' && r.selected === 1)).toBe(true);

        const measured = [];
        for (const r of results) {
            const { data, info } = await sharp(fs.readFileSync(r.file)).raw().toBuffer({ resolveWithObject: true });
            measured.push({ w: info.width, h: info.height, leftRed: data[Math.floor(info.height / 2) * info.width * info.channels] });
        }
        // Sizes round DOWN to 16 and each box shrinks about its centre: the moved box
        // (20,0 168x300) -> 160x288 at x 24; the centred ones -> 224x400 and 144x256.
        expect(measured.map(({ w, h }) => [w, h])).toEqual([[160, 288], [224, 400], [144, 256]]);
        for (const { w, h } of measured) expect(Math.abs(w / h - 9 / 16)).toBeLessThan(0.02);
        // The ramp at x 24 of 400 is ~15; a centred cut (x 120) would start at ~76.
        expect(measured[0].leftRed).toBeLessThan(30);
        // Square member, centred at x 56 of 256: ~55.
        expect(Math.abs(measured[2].leftRed - Math.floor((56 / 256) * 255))).toBeLessThan(4);
        await expect(window.locator('.mpi-thumb-strip__thumb[data-index="0"]')).not.toHaveClass(/crop-moved/);

        // Persisted: project.json lists the new version on every member.
        const saved = JSON.parse(fs.readFileSync(path.join(project.folderPath, 'project.json'), 'utf8')).itemGroups;
        expect(['g0', 'g1', 'g2'].map(id => saved.find(g => g.id === id).history.length)).toEqual([2, 2, 2]);

        expect(pageErrors, `page errors: ${pageErrors.join(' | ')}`).toHaveLength(0);
    } finally {
        await closeApp(app);
    }
});
