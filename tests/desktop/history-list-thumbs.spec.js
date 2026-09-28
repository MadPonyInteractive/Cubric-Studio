const { test, expect } = require('@playwright/test');
const crypto = require('crypto');
const fs = require('fs-extra');
const sharp = require('sharp');
const { launchApp, closeApp } = require('./launch');

/**
 * MPI-963 — a History entry row is 64x44 px, so an IMAGE row shows the sidecar thumb,
 * not the original. On a 16K card the rows loaded the 345 MB originals: they painted
 * top-down one at a time and every re-raster re-decoded them for seconds, which was 32
 * of the 37 s it took History to open; a 32K original cannot decode at all (a broken row).
 */
test.setTimeout(120000);

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

test('an image History row shows the sidecar thumb, not the original', async ({}, testInfo) => {
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
        }, { name: `mpi963-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`, folderPath: testInfo.outputPath('projects') });
        projectFolderPath = project.folderPath;

        const N = 2048;
        const png = await sharp({ create: { width: N, height: N, channels: 3, background: { r: 60, g: 140, b: 90 } } }).png().toBuffer();
        const itemId = crypto.randomUUID();
        const { groupId, thumbPath } = await window.evaluate(async ({ project, itemId, base64, size }) => {
            const { Events } = await import('/js/events.js');
            const res = await fetch(`/project-media/${project.id}/upload?folderPath=${encodeURIComponent(project.folderPath)}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename: 'e2e-row_001.png', base64Data: base64, autoSequence: true, itemId, mediaType: 'image', width: size, height: size }),
            });
            const data = await res.json();
            if (!data.success) throw new Error(`upload failed: ${data.error}`);
            if (!data.thumbPath) throw new Error('upload wrote no thumbPath');
            return new Promise((resolve, reject) => {
                const timer = setTimeout(() => reject(new Error('project:group-added never fired')), 30000);
                const unsub = Events.on('project:group-added', ({ group }) => {
                    if (group?.history?.[0]?.id !== itemId) return;
                    clearTimeout(timer); unsub(); resolve({ groupId: group.id, thumbPath: data.thumbPath });
                });
                Events.emit('media:imported', {
                    url: `/project-file?path=${encodeURIComponent(data.filePath)}`,
                    filename: data.filename, itemId, thumbPath: data.thumbPath || null, thumbPathLg: data.thumbPathLg || null,
                    proxyPath: null, pixelDimensions: { w: size, h: size }, mediaType: 'image',
                });
            });
        }, { project, itemId, base64: png.toString('base64'), size: N });

        await window.evaluate(async (id) => {
            const { navigate, PAGE_GROUP_HISTORY } = await import('/js/router.js');
            navigate(PAGE_GROUP_HISTORY, { groupId: id });
        }, groupId);
        const row = window.locator('img.mpi-history-list__thumb').first();
        await expect(row).toBeAttached({ timeout: 30000 });
        const src = decodeURIComponent(await row.getAttribute('src'));
        expect(src, 'the row loads the thumb').toContain(decodeURIComponent(thumbPath).split('?path=')[1]);
        expect(src, 'the row does not load the original').not.toContain('e2e-row_001.png');
        await expect.poll(() => row.evaluate((i) => (i.complete ? i.naturalWidth : 0)), { timeout: 15000 })
            .toBeGreaterThan(0);
        expect(await row.evaluate((i) => i.naturalWidth), 'a thumb-sized decode').toBeLessThanOrEqual(512);
    } finally {
        if (app) await closeApp(app);
        if (projectFolderPath) await fs.remove(projectFolderPath).catch(() => {});
    }
});
