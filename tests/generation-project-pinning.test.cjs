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
    const FREEZE = 'const _originProject = state.currentProject;';
    const start = src.indexOf(FREEZE);
    assert.ok(start > 0, '_originProject must be frozen at dispatch');

    const offenders = [];
    src.slice(start + FREEZE.length).split(/\r?\n/).forEach((line, i) => {
        if (!/state\.currentProject/.test(line)) return;
        if (/^\s*(\/\/|\*)/.test(line)) return;                  // prose about the trap
        if (line.includes('_originIsOpen')) return;              // the comparison itself
        offenders.push(`${i}: ${line.trim()}`);
    });
    assert.deepEqual(offenders, [], 'the completion path must use _originProject');
});
