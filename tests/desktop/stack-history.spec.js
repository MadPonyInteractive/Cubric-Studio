// MPI-949 Phase 4 — a Gallery stack opens in the History workspace, in its stack mode:
// ONE member on screen with its own history, a member strip to switch, ◀ Version ▶ moving
// every member at once, and a rail tool's Apply running one job per member (or per pick)
// under ONE queue row.
//
// Both lanes are held busy (the Phase 3 spec's stub), so the jobs stay pending and nothing
// reaches an engine: what is checked is what would be dispatched.
const crypto = require('crypto');
const fs = require('fs');
const sharp = require('sharp');
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('./launch');

test.setTimeout(180000);

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

/** Uploads a solid PNG through the real route and waits for its card (gallery-stack.spec.js). */
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
        const url = `/project-file?path=${encodeURIComponent(data.filePath)}`;
        const groupId = await new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error(`no card for ${prefix}`)), 15000);
            const unsub = Events.on('project:group-added', ({ group }) => {
                if (group?.history?.[0]?.id !== itemId) return;
                clearTimeout(timer);
                unsub();
                resolve(group.id);
            });
            Events.emit('media:imported', {
                url, filename: data.filename, itemId,
                thumbPath: data.thumbPath || null, thumbPathLg: data.thumbPathLg || null,
                proxyPath: null, pixelDimensions: { w: 64, h: 48 }, mediaType: 'image',
            });
        });
        return { groupId, url, filePath: data.filePath, itemId };
    }, { project, itemId, base64: buf.toString('base64'), prefix });
}

/** The pending jobs, and the queue rows the panel would show. */
function readQueue(window) {
    return window.evaluate(async () => {
        const { peekCueQueue, getGenerationQueueSnapshot } = await import('/js/services/generationService.js');
        return {
            jobs: peekCueQueue().map(job => ({
                operation: job.config.operation,
                url: job.config.mediaItems[0]?.url,
                groupId: job.opts.groupId,
                existing: job.opts.existingGroup?.id,
                scope: job.opts.scope,
                batchId: job.opts.batchId,
            })),
            rows: getGenerationQueueSnapshot().items.map(r => ({ isBatch: !!r.isBatch, total: r.batchTotal, label: r.batchLabel })),
        };
    });
}

async function cancelAll(window, batchId) {
    await window.evaluate(async (id) => {
        (await import('/js/services/generationService.js')).cancelBatch(id);
        await new Promise(r => setTimeout(r, 300));
    }, batchId);
}

test('Stack History: switch members, step every version, batch Apply on all or picked', async ({}, testInfo) => {
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
        }, { name: `mpi949-history-${Date.now()}`, folderPath: testInfo.outputPath('projects') });
        const saved = () => JSON.parse(fs.readFileSync(`${project.folderPath}/project.json`, 'utf8')).itemGroups;

        // Three cards with TWO versions each: v2 is a second import folded into the card.
        const members = [];
        for (const [i, [r, g, b]] of [[226, 32, 32], [32, 210, 32], [32, 32, 226]].entries()) {
            const v1 = await importStill(window, project, { r, g, b, prefix: `e2e-m${i}` });
            const v2 = await importStill(window, project, { r: 255 - r, g: 255 - g, b: 255 - b, prefix: `e2e-m${i}v2` });
            members.push({ ...v1, v2 });
        }
        const stackId = await window.evaluate(async (ms) => {
            const [{ state }, { updateGroup, removeGroup, stackGroups }] = await Promise.all([
                import('/js/state.js'), import('/js/services/projectService.js'),
            ]);
            const find = (id) => state.currentProject.itemGroups.find(g => g.id === id);
            for (const m of ms) {
                const card = find(m.groupId);
                const extra = find(m.v2.groupId).history[0];
                await updateGroup({ ...card, history: [...card.history, extra], selectedIndex: 1 });
                await removeGroup(m.v2.groupId);
            }
            const stack = await stackGroups(ms.map(m => m.groupId));
            return stack.id;
        }, members);
        expect(saved().find(g => g.id === stackId)?.members).toEqual(members.map(m => m.groupId));

        // ── 1. Open the stack from the Gallery: member 1 on screen, strip of 3 ──────
        await window.evaluate(async () => {
            const { navigate, PAGE_GALLERY } = await import('/js/router.js');
            navigate(PAGE_GALLERY);
            await new Promise(r => setTimeout(r, 1200));
        });
        await window.locator(`.mpi-gallery-grid__row-wrap[data-group-id="${stackId}"] .mpi-group-card`).click();
        await expect(window.locator('.mpi-thumb-strip__thumb')).toHaveCount(3, { timeout: 15000 });
        await expect(window.locator('.mpi-history-list__card')).toHaveCount(2);
        await expect(window.locator('.mpi-thumb-strip__thumb.is-current')).toHaveAttribute('data-index', '0');

        // The rail: batch-safe tools only — Mask, Paint and Composite are absent, not dimmed.
        const rail = await window.evaluate(() => [...document.querySelectorAll('.mpi-history-tools__slot')].map(s => s.dataset.mode));
        expect(rail).toEqual(['prompt', 'transform', 'enhance']);

        // ── 2. Click member 3: its history, and the strip follows ──────────────────
        await window.locator('.mpi-thumb-strip__thumb[data-index="2"]').click();
        await expect(window.locator('.mpi-thumb-strip__thumb.is-current')).toHaveAttribute('data-index', '2');
        const route = await window.evaluate(async () => (await import('/js/state.js')).state.currentParams?.groupId);
        expect(route, 'the route keeps the STACK; only the member on screen changed').toBe(stackId);
        // The history list is member 3's: its first entry is the `e2e-m2` import, whose row
        // shows that entry's sidecar thumb (MPI-963), named by its item id.
        await expect.poll(() => window.evaluate(() =>
            decodeURIComponent(document.querySelector('.mpi-history-list__card img')?.getAttribute('src') || '')))
            .toContain(`${members[2].itemId}.thumb`);

        // ── 3. ◀ Version: every member one back, persisted; ▶ puts them back ────────
        await window.locator('.mpi-group-history-block__version-back button').click();
        await expect.poll(() => members.map(m => saved().find(g => g.id === m.groupId).selectedIndex)).toEqual([0, 0, 0]);
        await window.locator('.mpi-group-history-block__version-back button').click();
        await window.waitForTimeout(300);
        expect(members.map(m => saved().find(g => g.id === m.groupId).selectedIndex), 'clamped at the first version').toEqual([0, 0, 0]);
        await window.locator('.mpi-group-history-block__version-on button').click();
        await expect.poll(() => members.map(m => saved().find(g => g.id === m.groupId).selectedIndex)).toEqual([1, 1, 1]);

        // ── 4. Upscale with both lanes busy: three jobs, one per member, ONE row ────
        await window.evaluate(async () => {
            const { generationStore } = await import('/js/services/generationStore.js');
            const real = generationStore.getSnapshot;
            generationStore.getSnapshot = () => {
                const snap = real();
                return { ...snap, running: [...snap.running, { lane: 'local' }, { lane: 'remote' }] };
            };
        });
        await window.locator('.mpi-history-tools__slot[data-mode="enhance"] button').first().click();
        await window.locator('#right-top-slot button:has-text("Upscale")').click();
        await expect.poll(async () => (await readQueue(window)).jobs.length).toBe(3);
        let q = await readQueue(window);
        const current = members.map(m => `/project-file?path=${encodeURIComponent(m.v2.filePath)}`);
        expect(q.jobs.map(j => j.groupId)).toEqual(members.map(m => m.groupId));
        expect(q.jobs.map(j => j.url), 'each job runs on its member\'s CURRENT version').toEqual(current);
        expect(q.jobs.every(j => j.operation === 'imageUpscale' && j.scope === 'groupHistory' && j.existing === j.groupId)).toBe(true);
        expect(new Set(q.jobs.map(j => j.batchId)).size).toBe(1);
        expect(q.rows).toEqual([{ isBatch: true, total: 3, label: 'Upscale' }]);
        await cancelAll(window, q.jobs[0].batchId);
        expect((await readQueue(window)).jobs).toHaveLength(0);

        // ── 5. Pick members 1 and 3 (Ctrl-click): only they run ──────────────────────
        await window.locator('.mpi-thumb-strip__thumb[data-index="0"]').click({ modifiers: ['Control'] });
        await window.locator('.mpi-thumb-strip__thumb[data-index="2"]').click({ modifiers: ['Control'] });
        await window.locator('#right-top-slot button:has-text("Upscale")').click();
        await expect.poll(async () => (await readQueue(window)).jobs.length).toBe(2);
        q = await readQueue(window);
        expect(q.jobs.map(j => j.groupId)).toEqual([members[0].groupId, members[2].groupId]);
        expect(q.rows).toEqual([{ isBatch: true, total: 2, label: 'Upscale' }]);
        await cancelAll(window, q.jobs[0].batchId);

        // ── 6. Remove from stack: the card goes back to the gallery, the strip shrinks ─
        await window.locator('.mpi-thumb-strip__thumb[data-index="1"]').click({ button: 'right' });
        await window.locator('text=Remove from stack').first().click();
        await expect.poll(() => saved().find(g => g.id === stackId)?.members).toEqual([members[0].groupId, members[2].groupId]);
        expect(saved().find(g => g.id === members[1].groupId).stackId).toBeUndefined();
        await expect(window.locator('.mpi-thumb-strip__thumb')).toHaveCount(2);

        expect(pageErrors, `page errors: ${pageErrors.join(' | ')}`).toHaveLength(0);
    } finally {
        await closeApp(app);
    }
});

// A video stack puts TWO things in `#controls-mount` — the member strip and the video bar —
// each in its own host, and leaving takes both hosts with it. An in-memory project, as
// history-modes.spec.js does: no decodable clip is needed to pin the mount.
test('a video stack mounts the strip above the video bar, and leaving removes both', async ({}, testInfo) => {
    const { app, window, pageErrors } = await launchApp(testInfo);
    try {
        await window.evaluate(async () => {
            const { state } = await import('/js/state.js');
            const vid = (id) => ({ id, type: 'video', selectedIndex: 0, stackId: 'sVid', history: [{ id: `${id}-1`, type: 'video', displayName: id }] });
            state.currentProject = {
                id: 'pStackVideo', name: 'Stack video', folderPath: 'C:/tmp/stack-video-test',
                itemGroups: [vid('v1'), vid('v2'), { id: 'sVid', type: 'stack', kind: 'video', members: ['v1', 'v2'], history: [], selectedIndex: 0, name: 'clips' }],
            };
            const { navigate, PAGE_GROUP_HISTORY } = await import('/js/router.js');
            navigate(PAGE_GROUP_HISTORY, { groupId: 'sVid' });
        });
        await expect(window.locator('#controls-mount .mpi-thumb-strip__thumb')).toHaveCount(2, { timeout: 15000 });
        const dom = await window.evaluate(() => ({
            hosts: [...document.getElementById('controls-mount').children].map(c => (c.querySelector('.mpi-thumb-strip') ? 'strip' : c.querySelector('.mpi-video-control-bar') ? 'bar' : '?')),
            videoViewer: !!document.querySelector('.mpi-video-viewer'),
            rail: [...document.querySelectorAll('.mpi-history-tools__slot')].map(s => s.dataset.mode),
            accent: document.querySelector('.app-shell, [data-accent]')?.dataset.accent,
        }));
        expect(dom).toEqual({ hosts: ['strip', 'bar'], videoViewer: true, rail: ['prompt', 'transform', 'enhance'], accent: 'video' });

        await window.evaluate(async () => {
            const { navigate, PAGE_GALLERY } = await import('/js/router.js');
            navigate(PAGE_GALLERY);
        });
        await expect.poll(() => window.evaluate(() => document.getElementById('controls-mount').children.length)).toBe(0);
        expect(pageErrors, `page errors: ${pageErrors.join(' | ')}`).toHaveLength(0);
    } finally {
        await closeApp(app);
    }
});
