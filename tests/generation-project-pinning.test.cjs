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
        const res = await post({ groups: [{ id: 'g-new', name: 'Drone follows marathon crowd' }] });
        assert.equal(res.status, 200);
        assert.deepEqual(await res.json(), { success: true, added: 1 });

        // Newest first, and the project's existing cards are untouched.
        assert.deepEqual(await read(), [
            { id: 'g-new', name: 'Drone follows marathon crowd' },
            { id: 'g-old', name: 'earlier' },
        ]);
    });
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
