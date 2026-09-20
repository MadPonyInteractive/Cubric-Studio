'use strict';

// MPI-839 — a clip asked for in one project landed in another.
//
// Fabio dispatched a 3s video in "Agent tests", switched to "Cubric Studio Mascots"
// while it rendered, and the finished clip saved its media, sidecar AND card into
// Mascots (t2v_047, 2026-09-20T08:46:39Z). Nothing in the origin project recorded
// that it had ever been asked for.
//
// The completion path in generationService read `state.currentProject` again — after
// the render — instead of the project the run was DISPATCHED in. Same class as
// MPI-336's control snapshot: a generation outlives the state it started from, so
// everything the save path needs is frozen at dispatch (`_originProject`).
//
// Two halves are checked here: the source no longer re-reads the live project on the
// save path, and POST /project-groups writes the card into the project that is NOT
// open (the renderer owns `itemGroups` only for the open one).

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('fs-extra');
const path = require('node:path');
const os = require('node:os');
const express = require('express');

const router = require('../routes/projects.js');

async function withProject(itemGroups, fn) {
    const folderPath = await fs.mkdtemp(path.join(os.tmpdir(), 'mpi839-'));
    await fs.writeJson(path.join(folderPath, 'project.json'), { id: 'p1', itemGroups });
    const app = express();
    app.use(express.json({ limit: '10mb' }));
    app.use(router);
    const server = app.listen(0, '127.0.0.1');
    try {
        await new Promise(r => server.once('listening', r));
        const url = `http://127.0.0.1:${server.address().port}/project-groups`;
        const post = body => fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ folderPath, ...body }),
        });
        const read = async () => (await fs.readJson(path.join(folderPath, 'project.json'))).itemGroups;
        await fn({ post, read });
    } finally {
        server.close();
        await fs.remove(folderPath);
    }
}

test('a finished card is registered in a project the app does not have open', async () => {
    await withProject([{ id: 'g-old', name: 'earlier' }], async ({ post, read }) => {
        const res = await post({ groups: [{ id: 'g-new', name: 'Drone follows marathon crowd', history: ['item-1'] }] });
        assert.equal(res.status, 200);
        assert.deepEqual(await res.json(), { success: true, added: 1 });

        // Newest first, and the project's existing cards are untouched.
        assert.deepEqual(await read(), [
            { id: 'g-new', name: 'Drone follows marathon crowd', history: ['item-1'] },
            { id: 'g-old', name: 'earlier' },
        ]);
    });
});

/*
 * Fabio, live 2026-09-20: the cowboy clip finished while he sat in another project. Media,
 * sidecar and thumbs were all in the project he asked in, the log said "card registered" -
 * and the card was in NEITHER project. The closed-project write sent the IN-MEMORY card,
 * whose `history` holds item OBJECTS; on disk it holds item IDS. The write succeeded. Fifteen
 * seconds later he opened that project, the reconciler looked each entry up as an id, found
 * nothing, dropped the card as empty and saved the project without it.
 *
 * This is the whole path with the real shape, which is what the tests above never had: a
 * card in memory -> the serialiser -> the real route -> project.json -> the real reconciler.
 */
test('a card written to a closed project is still a card the next time that project opens', async () => {
    const { serializeGroup } = await import('../js/services/projectService.js');
    const { reconcileAndHydrate } = await import('../js/managers/projectReconciler.js');
    const item = { id: 'a2d5800f-item', filePath: '/Media/t2v_002.mp4', type: 'video' };
    const inMemory = { id: 'g-cowboy', type: 'video', name: 'Cowboy to motorbike', createdAt: 1,
        selectedIndex: 0, history: [item], isGenerating: true, latestPreviewUrl: 'blob:x', width: 1344, height: 768 };

    await withProject([], async ({ post, read }) => {
        // Raw, as ae42ebcf sent it: refused now, where it used to be accepted and self-delete.
        const raw = await post({ groups: [inMemory] });
        assert.equal(raw.status, 400, 'item OBJECTS in history must never reach project.json');
        assert.deepEqual(await read(), []);

        assert.equal((await post({ groups: [serializeGroup(inMemory)] })).status, 200);
        const [onDisk] = await read();
        assert.deepEqual(onDisk.history, [item.id], 'ids on disk, like every card persistGroups writes');
        assert.equal(onDisk.isGenerating, undefined, 'and none of the live-render fields');

        // The next open. The sidecar and the media are there, so the card must survive.
        const realFetch = globalThis.fetch;
        globalThis.fetch = async (url, init) => {
            assert.equal(url, '/load-meta-batch');
            const { ids } = JSON.parse(init.body);
            return { ok: true, json: async () => ({ items: Object.fromEntries(ids.map(id => [id, { meta: item, exists: true }])) }) };
        };
        try {
            const { project, wasModified } = await reconcileAndHydrate({ folderPath: '/p', itemGroups: [onDisk] });
            assert.equal(wasModified, false, 'nothing dropped, so nothing is written back');
            assert.deepEqual(project.itemGroups.map(g => g.id), ['g-cowboy']);
            assert.deepEqual(project.itemGroups[0].history, [item]);
        } finally {
            globalThis.fetch = realFetch;
        }
    });
});

test('every closed-project write in generationService goes through the serialiser', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'services', 'generationService.js'), 'utf8');
    const fn = src.slice(src.indexOf('async function _addGroupsToClosedProject'));
    assert.match(fn.slice(0, fn.indexOf('\n}\n')), /groups: groups\.map\(serializeGroup\)/);
    // and nothing else POSTs to the route behind its back
    assert.equal(src.match(/'\/project-groups'/g)?.length, 1);
});

test('a run that added to an existing card replaces it rather than duplicating it', async () => {
    const before = { id: 'g-1', name: 'cowboy', history: ['a'] };
    await withProject([before, { id: 'g-2', name: 'other' }], async ({ post, read }) => {
        await post({ groups: [{ ...before, history: ['a', 'b'] }] });

        const groups = await read();
        assert.equal(groups.length, 2, 'the card is replaced in place, not prepended again');
        assert.deepEqual(groups[0], { id: 'g-1', name: 'cowboy', history: ['a', 'b'] });
        assert.deepEqual(groups[1], { id: 'g-2', name: 'other' });
    });
});

test('the route refuses a call with no folderPath or no groups', async () => {
    await withProject([], async ({ post }) => {
        assert.equal((await post({ groups: [] })).status, 400);
        assert.equal((await post({})).status, 400);
    });
});

// The bug was one stale read among several on the same path, so the source is checked
// too: re-introducing any of them puts the card back in the wrong project, and no
// assertion above would notice.
test('the save path in generationService never re-reads the live project', () => {
    const src = fs.readFileSync(
        path.join(__dirname, '..', 'js', 'services', 'generationService.js'),
        'utf8',
    );
    const FREEZE = 'const _originProject = config._originProject ?? state.currentProject;';
    const start = src.indexOf(FREEZE);
    assert.ok(start > 0, '_originProject must be frozen at dispatch, from the enqueue-time project');

    const offenders = [];
    src.slice(start + FREEZE.length).split(/\r?\n/).forEach((line, i) => {
        if (!/state\.currentProject/.test(line)) return;
        if (/^\s*(\/\/|\*)/.test(line)) return;                  // prose about the trap
        if (line.includes('_originIsOpen')) return;              // the comparison itself
        offenders.push(`${i}: ${line.trim()}`);
    });
    assert.deepEqual(offenders, [], 'the completion path must use _originProject');
});

// A job can sit PENDING behind another render. Frozen only at dispatch, one that
// dispatched after a project switch adopted whichever project was open by then.
test('the project is frozen when the job is ENQUEUED, before it can wait in the queue', () => {
    const src = fs.readFileSync(
        path.join(__dirname, '..', 'js', 'services', 'generationService.js'),
        'utf8',
    );
    const enqueue = src.indexOf('export function enqueueGeneration(');
    const freeze = src.indexOf('config._originProject ??= state.currentProject;', enqueue);
    const push = src.indexOf('_cueQueue.push(', enqueue);
    assert.ok(enqueue > 0 && freeze > enqueue, 'enqueueGeneration must freeze config._originProject');
    assert.ok(freeze < push, 'the freeze must happen before the job enters the queue');
});

// The other half of the card: the in-flight placeholder. The registry is app-wide, so
// the gallery of the project he switched TO painted a spinner for a clip landing
// elsewhere.
test('a gallery only sees the running generations asked for in ITS project', async () => {
    const { activeGenerations } = await import('../js/services/activeGenerations.js');
    const gen = projectPath => activeGenerations.start({
        scope: 'gallery', operation: 't2v_ms', modelId: 'minimax-h3', exec: {}, projectPath,
    }).id;
    const inA = gen('C:/Projects/Agent tests');
    const inB = gen('C:/Projects/Mascots');
    const legacy = gen(undefined);
    try {
        const ids = p => activeGenerations.listFor('gallery', null, p).map(e => e.id);
        assert.deepEqual(ids('C:/Projects/Mascots'), [inB, legacy], 'A\'s render is not painted in B');
        assert.deepEqual(ids('C:/Projects/Agent tests'), [inA, legacy], 'switching back finds it again');
        assert.deepEqual(ids(null), [legacy], 'no project open: nothing project-bound');
        // Busy state and Stop stay app-wide: the engine is one.
        assert.deepEqual(ids(undefined), [inA, inB, legacy]);
    } finally {
        for (const id of [inA, inB, legacy]) activeGenerations.end(id);
    }
});

test('the gallery reads its placeholders through the project-scoped list', () => {
    const src = fs.readFileSync(
        path.join(__dirname, '..', 'js', 'components', 'Blocks', 'MpiGalleryBlock', 'MpiGalleryBlock.js'),
        'utf8',
    );
    assert.match(src, /listFor\('gallery', null, state\.currentProject\?\.folderPath \?\? null\)/);
    assert.match(src, /const _runningGallery = _ownRunningEntries\(\);/);
    assert.match(src, /_firstRunningEntry = \(\) => \{\s*return _ownRunningEntries\(\)\[0\] \|\| null;/);
    // and the service hands the registry the project to scope by
    const svc = fs.readFileSync(
        path.join(__dirname, '..', 'js', 'services', 'generationService.js'),
        'utf8',
    );
    assert.match(svc, /projectPath:\s+_originProject\?\.folderPath \?\? null,/);
});
