// MPI-949 — Gallery stacks: select N cards, Stack them into ONE card, unstack them back.
// Replaces the Cue all spec (MPI-733/945): Stack took Cue all's slot on the selection
// bar, and the bar's marks and Archive ride along here, as they did there.
//
// A real project on disk (create-project + openProject, real uploads with real
// sidecars), because "the stack survives a reload" is only true if the reconciler keeps
// a history-less card and repairs membership — a fixture written straight into
// `state.currentProject` never goes through either.
const fs = require('fs');
const crypto = require('crypto');
const sharp = require('sharp');
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('./launch');

test.setTimeout(180000);

// A real shipped clip, so the video card has a playable file and never takes the
// missing-media path (which removes the card) mid-test.
const CLIP = '/comfy_workflows/display/flow-draw-it-in.mp4';

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

/** Uploads a solid PNG through the real route and waits for its card (gif-make.spec.js). */
async function importStill(window, project, { r, g, b, prefix }) {
    const buf = await sharp({ create: { width: 64, height: 48, channels: 3, background: { r, g, b } } }).png().toBuffer();
    const itemId = crypto.randomUUID();
    return window.evaluate(async ({ project, itemId, base64, prefix }) => {
        const { Events } = await import('/js/events.js');
        const res = await fetch(`/project-media/${project.id}/upload?folderPath=${encodeURIComponent(project.folderPath)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: `${prefix}_001.png`, base64Data: base64, autoSequence: true, itemId, mediaType: 'image', width: 64, height: 48 }),
        });
        const data = await res.json();
        if (!data.success) throw new Error(`upload failed for ${prefix}: ${data.error}`);
        const groupId = await new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error(`no card for ${prefix}`)), 15000);
            const unsub = Events.on('project:group-added', ({ group }) => {
                if (group?.history?.[0]?.id !== itemId) return;
                clearTimeout(timer);
                unsub();
                resolve(group.id);
            });
            Events.emit('media:imported', {
                url: `/project-file?path=${encodeURIComponent(data.filePath)}`,
                filename: data.filename, itemId,
                thumbPath: data.thumbPath || null, thumbPathLg: data.thumbPathLg || null,
                proxyPath: null, pixelDimensions: { w: 64, h: 48 }, mediaType: 'image',
            });
        });
        return { groupId, file: data.filePath };
    }, { project, itemId, base64: buf.toString('base64'), prefix });
}

/** Ctrl-click every id (a toggle), in order. */
async function ctrlClick(window, ids) {
    await window.evaluate(async (groupIds) => {
        for (const id of groupIds) {
            document.querySelector(`.mpi-gallery-grid__row-wrap[data-group-id="${id}"] .mpi-group-card`)
                .dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: true }));
        }
        await new Promise(r => setTimeout(r, 200));
    }, ids);
}

async function barAction(window, key) {
    await window.evaluate(async (k) => {
        document.querySelector(`.mpi-gallery-grid__selection-bar [data-action="${k}"]`).click();
        await new Promise(r => setTimeout(r, 500));
    }, key);
}

async function markFromBar(window, mark) {
    await window.evaluate(async (m) => {
        document.querySelector(`.mpi-gallery-grid__selection-bar [data-mark="${m}"]`).click();
        await new Promise(r => setTimeout(r, 300));
    }, mark);
}

/** What the gallery shows: every card id on the grid, and the stack card if any. */
function readGrid(window) {
    return window.evaluate(() => {
        const stack = document.querySelector('.mpi-group-card--stack');
        return {
            ids: [...document.querySelectorAll('.mpi-gallery-grid__row-wrap')].map(w => w.dataset.groupId),
            stackCount: stack ? stack.querySelector('.mpi-group-card__stack-count')?.textContent : null,
            stackBadgeInfo: stack ? stack.querySelector('.mpi-group-card__stack-badge')?.getAttribute('data-info') : null,
        };
    });
}

/** Right-click a card and pick a menu row. */
async function menuPick(window, groupId, key) {
    await window.evaluate(async ({ id, k }) => {
        document.querySelector(`.mpi-gallery-grid__row-wrap[data-group-id="${id}"] .mpi-group-card`)
            .dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 80, clientY: 80 }));
        await new Promise(r => setTimeout(r, 250));
        document.querySelector(`.mpi-ctx-menu__item[data-key="${k}"]`).click();
        await new Promise(r => setTimeout(r, 400));
    }, { id: groupId, k: key });
}

/** The open stack-delete dialog's buttons, or a click on one of them. */
async function stackDialog(window, clickLabel = null) {
    return window.evaluate(async (label) => {
        const dlg = [...document.querySelectorAll('.mpi-ok-cancel')]
            .find(d => d.textContent.includes('Delete stack') && d.offsetParent);
        if (!dlg) return null;
        const buttons = [...dlg.querySelectorAll('.mpi-ok-cancel__actions .mpi-btn')];
        if (label) {
            buttons.find(b => b.textContent.trim() === label).click();
            await new Promise(r => setTimeout(r, 1500));
        }
        return buttons.map(b => b.textContent.trim());
    }, clickLabel);
}

test('Stack: selection bar -> one card, survives a reload, drags as its members, unstacks and deletes both ways', async ({}, testInfo) => {
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
        }, { name: `mpi949-${Date.now()}`, folderPath: testInfo.outputPath('projects') });
        const saved = () => JSON.parse(fs.readFileSync(`${project.folderPath}/project.json`, 'utf8')).itemGroups;

        const a = await importStill(window, project, { r: 226, g: 32, b: 32, prefix: 'e2e-a' });
        const b = await importStill(window, project, { r: 32, g: 210, b: 32, prefix: 'e2e-b' });
        const c = await importStill(window, project, { r: 32, g: 32, b: 226, prefix: 'e2e-c' });
        // A video card for the mixed-kind refusal. No sidecar, so the reload drops it.
        await window.evaluate(async (clip) => {
            const { addGroup } = await import('/js/services/projectService.js');
            await addGroup({
                id: 'e2e-vid', type: 'video', name: 'clip', createdAt: new Date().toISOString(), selectedIndex: 0,
                history: [{ id: 'e2e-vid-item', type: 'video', filePath: clip, pixelDimensions: { w: 1280, h: 720 } }],
            });
            const { navigate, PAGE_GALLERY } = await import('/js/router.js');
            navigate(PAGE_GALLERY);
            await new Promise(r => setTimeout(r, 1200));
        }, CLIP);
        await expect(window.locator('.mpi-gallery-grid__row-wrap')).toHaveCount(4, { timeout: 15000 });

        // ── 1. Mixed image + video: Stack greys, and says why ─────────────────────
        await ctrlClick(window, [a.groupId, 'e2e-vid']);
        const bar = await window.evaluate(() => ({
            actions: [...document.querySelectorAll('.mpi-gallery-grid__selection-bar [data-action]')]
                .map(el => ({ key: el.dataset.action, disabled: el.disabled, info: !!el.dataset.info })),
            stackInfo: document.querySelector('.mpi-gallery-grid__selection-bar [data-action="stack"]').dataset.info,
            // The bar stands in for the prompt box: one shows, the other hides.
            barShown: !!document.querySelector('.mpi-gallery-grid__selection-bar').offsetParent,
            promptHidden: document.querySelector('.mpi-prompt-box')?.classList.contains('hide') ?? true,
        }));
        expect(bar.actions.map(x => x.key)).toEqual(['stack', 'compare', 'combine', 'make-gif', 'download', 'archive', 'delete', 'close']);
        expect(bar.actions.every(x => x.info), 'every bar action explains itself').toBe(true);
        expect(bar.actions.find(x => x.key === 'stack').disabled).toBe(true);
        expect(bar.stackInfo).toBe('A stack holds images or videos, not both');
        expect({ barShown: bar.barShown, promptHidden: bar.promptHidden }).toEqual({ barShown: true, promptHidden: true });
        await ctrlClick(window, [a.groupId, 'e2e-vid']); // toggle off -> selection exits

        // ── 2. Marks from the bar: every selected card, persisted ──────────────────
        const marks = () => saved().filter(g => g.id !== 'e2e-vid').map(g => g.favourite ?? false);
        await ctrlClick(window, [a.groupId, b.groupId, c.groupId]);
        await markFromBar(window, 'square');
        await expect.poll(marks).toEqual(['square', 'square', 'square']);
        await markFromBar(window, 'none');
        await expect.poll(marks).toEqual([false, false, false]);
        await ctrlClick(window, [a.groupId, b.groupId, c.groupId]);

        // ── 3. Stack three stills, in a click order that is NOT creation order ─────
        await ctrlClick(window, [b.groupId, c.groupId, a.groupId]);
        expect(await window.evaluate(() => document.querySelector('.mpi-gallery-grid__selection-bar [data-action="stack"]').disabled)).toBe(false);
        await barAction(window, 'stack');
        await expect.poll(async () => (await readGrid(window)).ids.length).toBe(2);
        const stacked = saved().find(g => g.type === 'stack');
        expect(stacked.kind).toBe('image');
        expect(stacked.members).toEqual([b.groupId, c.groupId, a.groupId]);
        expect(saved().filter(g => g.stackId === stacked.id).map(g => g.id).sort())
            .toEqual([a.groupId, b.groupId, c.groupId].sort());
        const grid = await readGrid(window);
        expect(grid.ids.sort()).toEqual([stacked.id, 'e2e-vid'].sort());
        expect(grid.stackCount).toBe('3');
        expect(grid.stackBadgeInfo).toBe('Stack of 3 images');

        // ── 4. A drag carries the members: the agent reads ONE "3 cards" set ───────
        const drag = await window.evaluate(async () => {
            const thumb = document.querySelector('.mpi-group-card--stack .mpi-group-card__thumb[data-mpi-drag-bound]');
            const dt = new DataTransfer();
            thumb.dispatchEvent(new DragEvent('dragstart', { dataTransfer: dt, bubbles: true }));
            const payload = JSON.parse(dt.getData('application/mpi-media'));
            const { cardReference } = await import('/js/utils/mediaActions.js');
            const ref = cardReference(payload);
            return { type: payload.type, kind: payload.kind, count: payload.count, cards: payload.cards.map(x => x.groupId), refName: ref?.name, refCount: ref?.count };
        });
        expect(drag).toEqual({
            type: 'stack', kind: 'image', count: 3,
            cards: [b.groupId, c.groupId, a.groupId],
            refName: '3 cards', refCount: 3,
        });

        // ── 5. It survives a reload (reconciler keeps a history-less card) ─────────
        await window.evaluate(async (p) => {
            const { openProject } = await import('/js/services/projectService.js');
            const { navigate, PAGE_GALLERY } = await import('/js/router.js');
            await openProject(p);
            navigate(PAGE_GALLERY);
            await new Promise(r => setTimeout(r, 1500));
        }, project);
        // The sidecar-less video is gone; the stack and its three members are not.
        await expect.poll(async () => (await readGrid(window)).ids).toEqual([stacked.id]);
        expect((await readGrid(window)).stackCount).toBe('3');

        // ── 6. Right-click Unstack: the three cards come back, nothing else changes ─
        await menuPick(window, stacked.id, 'unstack');
        await expect.poll(async () => (await readGrid(window)).ids.sort()).toEqual([a.groupId, b.groupId, c.groupId].sort());
        await expect.poll(() => saved().some(g => g.type === 'stack' || g.stackId)).toBe(false);

        // ── 7. Delete a stack -> "Unstack" deletes nothing ────────────────
        await ctrlClick(window, [a.groupId, b.groupId]);
        await barAction(window, 'stack');
        await expect.poll(async () => (await readGrid(window)).ids.length).toBe(2);
        let stackId = saved().find(g => g.type === 'stack').id;
        await menuPick(window, stackId, 'delete');
        expect(await stackDialog(window)).toEqual(['Cancel', 'Unstack', 'Delete all']);
        await stackDialog(window, 'Unstack');
        await expect.poll(async () => (await readGrid(window)).ids.length).toBe(3);
        expect([a, b, c].every(x => fs.existsSync(x.file)), 'Unstack deleted a file').toBe(true);

        // ── 8. Delete a stack -> "Delete all" deletes its cards and their files ────
        await ctrlClick(window, [a.groupId, b.groupId]);
        await barAction(window, 'stack');
        await expect.poll(async () => (await readGrid(window)).ids.length).toBe(2);
        stackId = saved().find(g => g.type === 'stack').id;
        await menuPick(window, stackId, 'delete');
        await stackDialog(window, 'Delete all');
        await expect.poll(async () => (await readGrid(window)).ids).toEqual([c.groupId]);
        await expect.poll(() => saved().map(g => g.id)).toEqual([c.groupId]);
        expect([a, b].some(x => fs.existsSync(x.file)), 'Delete all left a file behind').toBe(false);
        expect(fs.existsSync(c.file)).toBe(true);

        // ── 9. Archive from the bar: saved, and the card leaves the gallery ────────
        await ctrlClick(window, [c.groupId]);
        await barAction(window, 'archive');
        await expect.poll(() => saved().filter(g => g.archived).map(g => g.id)).toEqual([c.groupId]);
        expect((await readGrid(window)).ids).toEqual([]);

        expect(pageErrors, `page errors: ${pageErrors.join(' | ')}`).toHaveLength(0);
    } finally {
        await closeApp(app);
    }
});
