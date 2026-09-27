// MPI-949 Phase 3 — drop a Gallery stack on the prompt box and run: ONE job per member,
// each member in the stack chip's slot with the other chips riding along, under ONE queue
// row, filling a NEW result stack that settles when the run is over.
//
// Both lanes are held busy (the Cue-all spec's stub), so the jobs stay pending and
// nothing reaches an engine: what is checked is what would be dispatched.
const crypto = require('crypto');
const fs = require('fs');
const sharp = require('sharp');
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('./launch');

test.setTimeout(180000);

// A flat local model (no op groups, deps or variants), so `installed` alone makes it
// usable. kleinEdit: one required image slot plus two optional references.
const MODEL_ID = 'klein-4b';

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
        return { groupId, url };
    }, { project, itemId, base64: buf.toString('base64'), prefix });
}

async function ctrlClick(window, ids) {
    await window.evaluate(async (groupIds) => {
        for (const id of groupIds) {
            document.querySelector(`.mpi-gallery-grid__row-wrap[data-group-id="${id}"] .mpi-group-card`)
                .dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: true }));
        }
        await new Promise(r => setTimeout(r, 200));
    }, ids);
}

/** Drop an `application/mpi-media` payload on the prompt box, as a card drag does. */
async function dropOnBox(window, payload) {
    await window.evaluate(async (p) => {
        const dt = new DataTransfer();
        dt.setData('application/mpi-media', typeof p === 'string' ? p : JSON.stringify(p));
        document.querySelector('.mpi-prompt-box')
            .dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
        await new Promise(r => setTimeout(r, 400));
    }, payload);
}

/** The staged chips, the live op, and one op-strip button's state. */
function readBox(window, opKey) {
    return window.evaluate((k) => {
        const box = document.querySelector('.mpi-prompt-box');
        const btn = box.querySelector(`.mpi-prompt-box__op-strip .mpi-radio-group__btn[data-value="${k}"]`);
        return {
            op: box.getRunPayload().operation,
            chips: box.getMediaItems().map(m => ({ stackId: m.stackId || null, count: m.count ?? null, role: m.role })),
            badge: box.querySelector('.mpi-prompt-box-media-strip__stack')?.textContent.trim() ?? null,
            opDisabled: btn?.getAttribute('aria-disabled') === 'true',
            opInfo: btn?.dataset.info ?? null,
        };
    }, opKey);
}

test('Stack run: one job per member in the chip\'s slot, one queue row, a result stack that settles', async ({}, testInfo) => {
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
        }, { name: `mpi949-run-${Date.now()}`, folderPath: testInfo.outputPath('projects') });
        const saved = () => JSON.parse(fs.readFileSync(`${project.folderPath}/project.json`, 'utf8')).itemGroups;

        const a = await importStill(window, project, { r: 226, g: 32, b: 32, prefix: 'e2e-a' });
        const b = await importStill(window, project, { r: 32, g: 210, b: 32, prefix: 'e2e-b' });
        const c = await importStill(window, project, { r: 32, g: 32, b: 226, prefix: 'e2e-c' });
        const ref = await importStill(window, project, { r: 200, g: 200, b: 32, prefix: 'e2e-ref' });

        await window.evaluate(async (modelId) => {
            const [{ state }, { Events }, { MODELS }, { navigate, PAGE_GALLERY }] = await Promise.all([
                import('/js/state.js'), import('/js/events.js'), import('/js/data/modelRegistry.js'), import('/js/router.js'),
            ]);
            // Re-stubbed after every boot model sync (docs/testing-desktop-specs.md, trap 5).
            const model = MODELS.find(m => m.id === modelId);
            const stub = () => {
                model.installed = true;
                const ids = state.s_installedModelIds || [];
                if (!ids.includes(modelId)) state.s_installedModelIds = [...ids, modelId];
            };
            stub();
            Events.on('models:checked', stub);
            state.s_selectedModelIdByType = { image: modelId, video: null };
            state.s_lastSelectedMediaType = 'image';
            navigate(PAGE_GALLERY);
            await new Promise(r => setTimeout(r, 1200));
        }, MODEL_ID);
        await expect(window.locator('.mpi-gallery-grid__row-wrap')).toHaveCount(4, { timeout: 15000 });
        await expect(window.locator('.mpi-prompt-box')).toHaveCount(1);

        // ── 1. Stack three stills (click order b, c, a) ─────────────────────────────
        await ctrlClick(window, [b.groupId, c.groupId, a.groupId]);
        await window.evaluate(async () => {
            document.querySelector('.mpi-gallery-grid__selection-bar [data-action="stack"]').click();
            await new Promise(r => setTimeout(r, 600));
        });
        await expect.poll(() => saved().filter(g => g.type === 'stack').length).toBe(1);
        const source = saved().find(g => g.type === 'stack');
        expect(source.members).toEqual([b.groupId, c.groupId, a.groupId]);

        // ── 2. Drop the stack on the box: ONE chip, layers badge, a text op refused ──
        const stackPayload = await window.evaluate(() => {
            const thumb = document.querySelector('.mpi-group-card--stack .mpi-group-card__thumb[data-mpi-drag-bound]');
            const dt = new DataTransfer();
            thumb.dispatchEvent(new DragEvent('dragstart', { dataTransfer: dt, bubbles: true }));
            return dt.getData('application/mpi-media');
        });
        await dropOnBox(window, stackPayload);
        let box = await readBox(window, 't2i');
        expect(box.chips).toEqual([{ stackId: source.id, count: 3, role: 'inputImage' }]);
        expect(box.badge).toBe('3');
        expect(box.op, 'a text op cannot run a stack, so the box moved off it').not.toBe('t2i');
        expect(box.opDisabled).toBe(true);
        expect(box.opInfo).toContain('remove the staged media');

        // A second stack drop REPLACES the chip (one stack per box).
        await dropOnBox(window, stackPayload);
        expect((await readBox(window, 't2i')).chips).toHaveLength(1);

        // ── 3. A reference rides along in slot 2, Klein Edit picked ─────────────────
        await dropOnBox(window, { filePath: ref.url, type: 'image', name: 'ref' });
        await window.evaluate(async () => {
            const { Events } = await import('/js/events.js');
            Events.emit('workspace:set-operation', { operation: 'kleinEdit' });
            await new Promise(r => setTimeout(r, 300));
        });
        box = await readBox(window, 'kleinEdit');
        expect(box.op).toBe('kleinEdit');
        expect(box.opDisabled).toBe(false);
        expect(box.chips.map(ch => [ch.stackId, ch.role])).toEqual([[source.id, 'inputImage'], [null, 'inputImage2']]);

        // ── 4. Run with both lanes busy: three pending jobs, one row, a result stack ─
        await window.evaluate(async () => {
            const { generationStore } = await import('/js/services/generationStore.js');
            const real = generationStore.getSnapshot;
            generationStore.getSnapshot = () => {
                const snap = real();
                return { ...snap, running: [...snap.running, { lane: 'local' }, { lane: 'remote' }] };
            };
            document.querySelector('.mpi-prompt-box__cue-btn').click();
            await new Promise(r => setTimeout(r, 800));
        });
        const run = await window.evaluate(async () => {
            const { peekCueQueue, getGenerationQueueSnapshot } = await import('/js/services/generationService.js');
            const snap = getGenerationQueueSnapshot();
            return {
                jobs: peekCueQueue().map(job => ({
                    operation: job.config.operation,
                    items: job.config.mediaItems.map(m => [m.url, m.role, m.stackId ?? null]),
                    batchId: job.opts.batchId,
                    stackId: job.opts.stackId,
                    hasNext: typeof job.callbacks.getNextGeneration === 'function',
                })),
                rows: snap.items.map(r => ({ isBatch: !!r.isBatch, total: r.batchTotal, label: r.batchLabel })),
            };
        });
        expect(run.jobs).toHaveLength(3);
        // Each member in slot 1, in stack order; the reference untouched in slot 2.
        expect(run.jobs.map(j => j.items)).toEqual([b, c, a].map(m => [
            [m.url, 'inputImage', null],
            [ref.url, 'inputImage2', null],
        ]));
        expect(new Set(run.jobs.map(j => j.batchId)).size).toBe(1);
        expect(run.jobs.every(j => j.operation === 'kleinEdit' && !j.hasNext)).toBe(true);
        expect(run.rows).toEqual([{ isBatch: true, total: 3, label: 'Edit' }]);

        const resultId = run.jobs[0].stackId;
        await expect.poll(() => saved().find(g => g.id === resultId)?.expected).toBe(3);
        const result = saved().find(g => g.id === resultId);
        expect(result).toMatchObject({ type: 'stack', kind: 'image', members: [] });
        expect(result.name).toContain(' · Edit');
        await expect.poll(() => window.evaluate((id) =>
            document.querySelector(`.mpi-gallery-grid__row-wrap[data-group-id="${id}"] .mpi-group-card__stack-count`)?.textContent, resultId))
            .toBe('0/3');

        // ── 5. One result lands (the completion path's own mutation): 1/3 ──────────
        await window.evaluate(async ({ from, stackId }) => {
            const [{ state }, { addGroupsToStack }] = await Promise.all([
                import('/js/state.js'), import('/js/services/projectService.js'),
            ]);
            const { stackId: _member, ...card } = state.currentProject.itemGroups.find(g => g.id === from);
            await addGroupsToStack([{ ...card, id: 'e2e-result-1', name: 'result 1' }], stackId);
        }, { from: a.groupId, stackId: resultId });
        await expect.poll(() => saved().find(g => g.id === resultId)?.members).toEqual(['e2e-result-1']);
        expect(saved().find(g => g.id === 'e2e-result-1').stackId).toBe(resultId);
        await expect.poll(() => window.evaluate((id) =>
            document.querySelector(`.mpi-gallery-grid__row-wrap[data-group-id="${id}"] .mpi-group-card__stack-count`)?.textContent, resultId))
            .toBe('1/3');
        // The result card is inside the stack, not loose in the grid.
        expect(await window.locator('.mpi-gallery-grid__row-wrap[data-group-id="e2e-result-1"]').count()).toBe(0);

        // ── 6. Cancel all: nothing pending, and the result stack settles to 1 ───────
        await window.evaluate(async (batchId) => {
            const { cancelBatch } = await import('/js/services/generationService.js');
            cancelBatch(batchId);
            await new Promise(r => setTimeout(r, 300));
        }, run.jobs[0].batchId);
        expect(await window.evaluate(async () => (await import('/js/services/generationService.js')).peekCueQueue().length)).toBe(0);
        await expect.poll(() => 'expected' in (saved().find(g => g.id === resultId) || {})).toBe(false);
        expect(saved().find(g => g.id === resultId).members).toEqual(['e2e-result-1']);
        await expect.poll(() => window.evaluate((id) =>
            document.querySelector(`.mpi-gallery-grid__row-wrap[data-group-id="${id}"] .mpi-group-card__stack-count`)?.textContent, resultId))
            .toBe('1');

        // ── 7. A run cancelled before anything lands leaves no empty stack behind ────
        await window.evaluate(async () => {
            document.querySelector('.mpi-prompt-box__cue-btn').click();
            await new Promise(r => setTimeout(r, 800));
        });
        const second = await window.evaluate(async () => {
            const { peekCueQueue } = await import('/js/services/generationService.js');
            const q = peekCueQueue();
            return { batchId: q[0]?.opts.batchId, stackId: q[0]?.opts.stackId, n: q.length };
        });
        expect(second.n).toBe(3);
        await expect.poll(() => saved().some(g => g.id === second.stackId)).toBe(true);
        await window.evaluate(async (batchId) => {
            (await import('/js/services/generationService.js')).cancelBatch(batchId);
            await new Promise(r => setTimeout(r, 300));
        }, second.batchId);
        await expect.poll(() => saved().some(g => g.id === second.stackId)).toBe(false);
        await expect.poll(() => window.locator(`.mpi-gallery-grid__row-wrap[data-group-id="${second.stackId}"]`).count()).toBe(0);

        // ── 8. Loop refuses a staged stack ─────────────────────────────────────────
        await window.evaluate(() => document.activeElement?.blur?.());
        await window.keyboard.press('Control+l'); // generation.loop
        await window.waitForTimeout(300);
        const loop = await window.evaluate(async () => ({
            armed: (await import('/js/state.js')).state.loopArmed === true,
            // Not vacuous: the hotkey reached the box and it said no.
            refused: document.body.textContent.includes('Loop cannot run a stack'),
        }));
        expect(loop).toEqual({ armed: false, refused: true });

        expect(pageErrors, `page errors: ${pageErrors.join(' | ')}`).toHaveLength(0);
    } finally {
        await closeApp(app);
    }
});
