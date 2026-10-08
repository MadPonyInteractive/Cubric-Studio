// MPI-623 — Group History: several selected entries -> Add to gallery makes ONE stack of
// plain cards (one per entry), named after the card. A scene card's pictures leave this way,
// so no new card may carry the scene (`scenePath`): the first entry here has one to prove it.
const fs = require('fs');
const crypto = require('crypto');
const sharp = require('sharp');
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('./launch');

test.setTimeout(150000);

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

/** Uploads a solid PNG through the real route; returns its upload reply (no card). */
async function uploadStill(window, project, { r, g, b, prefix }) {
    const buf = await sharp({ create: { width: 64, height: 48, channels: 3, background: { r, g, b } } }).png().toBuffer();
    return window.evaluate(async ({ project, base64, prefix, itemId }) => {
        const res = await fetch(`/project-media/${project.id}/upload?folderPath=${encodeURIComponent(project.folderPath)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: `${prefix}_001.png`, base64Data: base64, autoSequence: true, itemId, mediaType: 'image', width: 64, height: 48 }),
        });
        const data = await res.json();
        if (!data.success) throw new Error(`upload failed for ${prefix}: ${data.error}`);
        return { itemId, filePath: data.filePath, thumbPath: data.thumbPath || null };
    }, { project, base64: buf.toString('base64'), prefix, itemId: crypto.randomUUID() });
}

test('History: three selected entries -> Add to gallery -> one stack of three plain image cards', async ({}, testInfo) => {
    const { app, window, pageErrors } = await launchApp(testInfo);
    try {
        await window.waitForTimeout(6000);
        await window.evaluate(async () => {
            const { Events } = await import('/js/events.js');
            Events.emit('engine:install-skipped');
            await new Promise(r => setTimeout(r, 300));
        });
        await clearBootModals(window);

        const project = await window.evaluate(async ({ name, folderPath }) => {
            const { createProject, openProject } = await import('/js/services/projectService.js');
            const p = await createProject(name, folderPath);
            await openProject(p);
            return p;
        }, { name: `mpi623-stack-${Date.now()}`, folderPath: testInfo.outputPath('projects') });
        const saved = () => JSON.parse(fs.readFileSync(`${project.folderPath}/project.json`, 'utf8')).itemGroups;

        const ups = [
            await uploadStill(window, project, { r: 226, g: 32, b: 32, prefix: 'e2e-a' }),
            await uploadStill(window, project, { r: 32, g: 210, b: 32, prefix: 'e2e-b' }),
            await uploadStill(window, project, { r: 32, g: 32, b: 226, prefix: 'e2e-c' }),
        ];
        const srcId = await window.evaluate(async (ups) => {
            const { createItemGroup, createImageItem, appendToHistory } = await import('/js/data/projectModel.js');
            const { addGroup } = await import('/js/services/projectService.js');
            let g = createItemGroup('image', { name: 'Ring pano', width: 64, height: 48 });
            ups.forEach((u, i) => {
                g = appendToHistory(g, createImageItem({
                    id: u.itemId,
                    filePath: `/project-file?path=${encodeURIComponent(u.filePath)}`,
                    thumbPath: u.thumbPath,
                    displayName: `shot ${i}`,
                    pixelDimensions: { w: 64, h: 48 },
                    // The scene lives on the card's first item, as after a Convert.
                    scenePath: i === 0 ? '/project-file?path=fake.scene.json' : null,
                }));
            });
            await addGroup(g);
            const { navigate, PAGE_GROUP_HISTORY } = await import('/js/router.js');
            navigate(PAGE_GROUP_HISTORY, { groupId: g.id });
            return g.id;
        }, ups);

        const cards = window.locator('.mpi-history-list__card');
        await expect(cards).toHaveCount(3, { timeout: 30000 });

        // Click entry 0, ctrl-click 1 and 2: the selection is [0, 1, 2] in click order.
        const label = await window.evaluate(async () => {
            const c = [...document.querySelectorAll('.mpi-history-list__card')];
            c[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
            await new Promise(r => setTimeout(r, 300));
            for (const i of [1, 2]) c[i].dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: true }));
            await new Promise(r => setTimeout(r, 300));
            c[1].dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 80, clientY: 80 }));
            await new Promise(r => setTimeout(r, 400));
            const row = document.querySelector('.mpi-ctx-menu__item[data-key="add-to-gallery"]');
            const text = row?.textContent.trim();
            row?.click();
            return text;
        });
        expect(label).toBe('Add to gallery as a stack');

        const read = () => window.evaluate(async (srcId) => {
            const { state } = await import('/js/state.js');
            const { getSceneItem } = await import('/js/utils/assetKinds.js');
            const groups = state.currentProject.itemGroups;
            const stack = groups.find(g => g.type === 'stack');
            const members = (stack?.members || []).map(id => groups.find(g => g.id === id));
            return {
                stackName: stack?.name ?? null,
                stackKind: stack?.kind ?? null,
                members: members.map(m => ({
                    type: m?.type, stackId: m?.stackId, entries: m?.history?.length,
                    itemType: m?.history?.[0]?.type, scenePath: m?.history?.[0]?.scenePath ?? null,
                    sceneItem: !!(m && getSceneItem(m)),
                })),
                srcEntries: groups.find(g => g.id === srcId)?.history.length,
            };
        }, srcId);

        await expect.poll(async () => (await read()).members.length, { timeout: 30000 }).toBe(3);
        const r = await read();
        expect(r.stackName, 'the stack is named after the card').toBe('Ring pano');
        expect(r.stackKind).toBe('image');
        for (const m of r.members) {
            expect(m, 'a plain one-entry image card in the stack').toMatchObject({ type: 'image', entries: 1, itemType: 'image', scenePath: null, sceneItem: false });
            expect(m.stackId).toBeTruthy();
        }
        expect(r.srcEntries, 'the source card keeps its entries').toBe(3);
        await expect.poll(() => saved().find(g => g.type === 'stack')?.members?.length ?? 0).toBe(3);

        expect(pageErrors, `page errors: ${pageErrors.join(' | ')}`).toHaveLength(0);
    } finally {
        await closeApp(app);
    }
});
