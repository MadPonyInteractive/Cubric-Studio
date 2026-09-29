const { test, expect } = require('@playwright/test');
const crypto = require('crypto');
const fs = require('fs-extra');
const sharp = require('sharp');
const { launchApp, closeApp } = require('./launch');

/**
 * MPI-961 — Mask Adjust went dead after switching History entry. The canvas is REUSED
 * across entries, and `loadImage()` -> `MaskManager.init()` ended the Adjust session
 * (dropped the pristine snapshot), while the Adjust panel stays mounted and begins its
 * session only once, at mount. Every later slider move previewed nothing until the
 * user left History and came back (Fabio, 2026-09-29: Grow / Shrink / Edge all dead).
 *
 * Driven through the real slider (keyboard on its range input), with a Grow preview
 * left pending across the switch - the case he hit - and the new entry's mask loaded
 * from its own layers, which is what the preview must now be computed from.
 */
test.setTimeout(180000);

const N = 512;

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

async function importStill(window, project, png, filename) {
    const itemId = crypto.randomUUID();
    const groupId = await window.evaluate(async ({ project, itemId, base64, size, filename }) => {
        const { Events } = await import('/js/events.js');
        const res = await fetch(`/project-media/${project.id}/upload?folderPath=${encodeURIComponent(project.folderPath)}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename, base64Data: base64, autoSequence: true, itemId, mediaType: 'image', width: size, height: size }),
        });
        const data = await res.json();
        if (!data.success) throw new Error(`upload failed: ${data.error}`);
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('project:group-added never fired')), 30000);
            const unsub = Events.on('project:group-added', ({ group }) => {
                if (group?.history?.[0]?.id !== itemId) return;
                clearTimeout(timer); unsub(); resolve(group.id);
            });
            Events.emit('media:imported', {
                url: `/project-file?path=${encodeURIComponent(data.filePath)}`,
                filename: data.filename, itemId, thumbPath: data.thumbPath || null, thumbPathLg: data.thumbPathLg || null,
                proxyPath: null, pixelDimensions: { w: size, h: size }, mediaType: 'image',
            });
        });
    }, { project, itemId, base64: png.toString('base64'), size: N, filename });
    return { itemId, groupId };
}

const CANVAS = '.mpi-canvas-viewer .mpi-canvas';

test('Mask Adjust keeps working after switching History entry with a preview pending', async ({}, testInfo) => {
    let app, window, projectFolderPath = null;
    try {
        ({ app, window } = await launchApp(testInfo));
        await window.waitForTimeout(6000);
        await clearBootModals(window);

        const project = await window.evaluate(async ({ name, folderPath }) => {
            const { createProject, openProject } = await import('/js/services/projectService.js');
            const p = await createProject(name, folderPath);
            await openProject(p);
            return p;
        }, { name: `mpi961-adjust-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`, folderPath: testInfo.outputPath('projects') });
        projectFolderPath = project.folderPath;

        const png = await sharp({ create: { width: N, height: N, channels: 3, background: { r: 90, g: 120, b: 160 } } }).png().toBuffer();
        const a = await importStill(window, project, png, 'e2e-adjA_001.png');
        const b = await importStill(window, project, png, 'e2e-adjB_001.png');
        // One card, two entries: B folded into A's card, A selected.
        await window.evaluate(async ({ a, b }) => {
            const [{ state }, { updateGroup, removeGroup }] = await Promise.all([
                import('/js/state.js'), import('/js/services/projectService.js'),
            ]);
            const find = (id) => state.currentProject.itemGroups.find(g => g.id === id);
            const card = find(a.groupId);
            await updateGroup({ ...card, history: [...card.history, find(b.groupId).history[0]], selectedIndex: 0 });
            await removeGroup(b.groupId);
        }, { a, b });

        await window.evaluate(async (id) => {
            const { navigate, PAGE_GROUP_HISTORY } = await import('/js/router.js');
            navigate(PAGE_GROUP_HISTORY, { groupId: id });
        }, a.groupId);
        await expect(window.locator('.mpi-history-tools')).toBeVisible();
        const rail = (m) => window.evaluate((m) => document.querySelector('.mpi-history-tools').setMode(m), m);
        const onEntry = (tag) => window.waitForFunction(({ sel, tag }) => {
            const c = document.querySelector(sel);
            return c?.activeMode === 'mask' && c.img?.src?.includes(tag) && c.img.complete;
        }, { sel: CANVAS, tag }, { timeout: 60000 });

        // A mask on each entry, painted with the real pointer (the viewer persists it
        // per entry and restores it on the switch).
        const paintBlob = async () => {
            const r = await window.evaluate((sel) => {
                const s = document.querySelector(sel).querySelector('.mpi-canvas__stack').getBoundingClientRect();
                return { x: s.left, y: s.top, w: s.width, h: s.height };
            }, CANVAS);
            await window.mouse.move(r.x + r.w * 0.35, r.y + r.h * 0.5);
            await window.mouse.down();
            await window.mouse.move(r.x + r.w * 0.65, r.y + r.h * 0.5, { steps: 10 });
            await window.mouse.up();
            await window.waitForTimeout(300);
        };
        await rail('maskBrush');
        await onEntry('e2e-adjA_');
        await paintBlob();
        await window.locator('.mpi-history-list__card').nth(1).click();
        await onEntry('e2e-adjB_');
        await paintBlob();
        await window.locator('.mpi-history-list__card').nth(0).click();
        await onEntry('e2e-adjA_');

        // Into Adjust; nudge Grow through the real slider and leave the preview PENDING.
        await rail('maskAdjust');
        const grow = window.locator('#right-top-slot #grow-slot input[type="range"]');
        await expect(grow).toBeVisible();
        const nudge = async () => {
            await grow.focus();
            for (let i = 0; i < 3; i++) await window.keyboard.press('ArrowRight');
        };
        const previewUp = () => window.waitForFunction(
            (sel) => document.querySelector(sel)?.hasMaskAdjustPreview?.() === true,
            CANVAS, { timeout: 5000 },
        );
        await nudge();
        await previewUp();

        // Switch entry with the preview pending, then move the slider again.
        await window.locator('.mpi-history-list__card').nth(1).click();
        await onEntry('e2e-adjB_');
        await window.waitForTimeout(500);
        expect(await window.evaluate((sel) => document.querySelector(sel).hasMaskAdjustPreview(), CANVAS),
            'a preview of the OLD entry must not survive the switch').toBe(false);
        await nudge();
        await previewUp();

        // And back again: same tool, still alive, previewing entry A's own mask.
        await window.locator('.mpi-history-list__card').nth(0).click();
        await onEntry('e2e-adjA_');
        await window.waitForTimeout(500);
        await nudge();
        await previewUp();
        const applied = await window.evaluate((sel) => document.querySelector(sel).applyMaskAdjust(), CANVAS);
        expect(applied, 'Apply bakes the preview after two switches').toBe(true);
    } finally {
        await closeApp(app);
        if (projectFolderPath) await fs.remove(projectFolderPath).catch(() => {});
    }
});
