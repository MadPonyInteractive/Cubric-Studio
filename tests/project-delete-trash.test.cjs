'use strict';

/**
 * MPI-1205 — deleting one project must never take another with it, and a deleted
 * project goes to the Recycle Bin.
 *
 * A tester made a clean project with his old messy project's folder as its location,
 * so the clean one landed INSIDE the messy one. Deleting the messy one ran a recursive
 * remove over its folder and both were gone for good. Now:
 *   - create-project refuses a location inside another project's folder;
 *   - delete-project refuses a folder that holds another project (already-nested ones);
 *   - delete-project moves the folder to the Recycle Bin, and a failed move deletes nothing.
 */

const assert = require('node:assert/strict');
const test = require('node:test');
const express = require('express');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'mpi1205-'));
process.env.APP_DOCUMENTS = TMP;

const projectRoutes = require('../routes/projects');

const binned = [];
projectRoutes._setTrashFnForTests(async (p) => { binned.push(p); fs.rmSync(p, { recursive: true, force: true }); });

async function serve() {
    const app = express();
    app.use(express.json());
    app.use(projectRoutes);
    const server = await new Promise((resolve) => {
        const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    return {
        base: `http://127.0.0.1:${server.address().port}`,
        stop: () => new Promise((resolve) => server.close(resolve)),
    };
}

async function post(base, route, body) {
    const res = await fetch(`${base}${route}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    return { status: res.status, ...(await res.json()) };
}

test('a new project cannot be made inside another project', async () => {
    const { base, stop } = await serve();
    try {
        const parent = path.join(TMP, 'create');
        fs.mkdirSync(parent, { recursive: true });
        const messy = await post(base, '/create-project', { name: 'Messy', folderPath: parent });
        assert.equal(messy.success, true);

        // The tester's move: the messy project's folder as the location.
        const inside = await post(base, '/create-project', { name: 'Clean', folderPath: messy.project.folderPath });
        assert.equal(inside.status, 400);
        assert.match(inside.error, /inside the project "Messy"/);
        assert.equal(fs.existsSync(path.join(messy.project.folderPath, 'Clean')), false);

        // Deeper too: its Media folder.
        const deeper = await post(base, '/create-project', { name: 'Clean', folderPath: path.join(messy.project.folderPath, 'Media') });
        assert.equal(deeper.status, 400);

        // A sibling location is fine.
        const beside = await post(base, '/create-project', { name: 'Clean', folderPath: parent });
        assert.equal(beside.success, true);
    } finally {
        await stop();
    }
});

test('deleting a project that holds another one deletes nothing', async () => {
    const { base, stop } = await serve();
    try {
        // Nested the way a pre-fix build made it.
        const messy = path.join(TMP, 'nested', 'Messy');
        const clean = path.join(messy, 'Clean');
        fs.mkdirSync(path.join(clean, 'Media'), { recursive: true });
        fs.writeFileSync(path.join(messy, 'project.json'), JSON.stringify({ id: 'messy', name: 'Messy' }));
        fs.writeFileSync(path.join(clean, 'project.json'), JSON.stringify({ id: 'clean', name: 'Clean' }));

        const res = await post(base, '/delete-project', { folderPath: messy, expectedId: 'messy' });
        assert.equal(res.status, 409);
        assert.match(res.error, /"Clean"/);
        assert.equal(fs.existsSync(path.join(clean, 'project.json')), true, 'the inner project survived');
        assert.equal(fs.existsSync(path.join(messy, 'project.json')), true, 'the outer one was not touched either');
        assert.deepEqual(binned, []);
    } finally {
        await stop();
    }
});

test('a deleted project goes to the Recycle Bin; a failed move deletes nothing', async () => {
    const { base, stop } = await serve();
    try {
        const parent = path.join(TMP, 'bin');
        fs.mkdirSync(parent, { recursive: true });
        const a = (await post(base, '/create-project', { name: 'A', folderPath: parent })).project;
        const res = await post(base, '/delete-project', { folderPath: a.folderPath, expectedId: a.id });
        assert.equal(res.success, true);
        assert.deepEqual(binned.map(p => p.replace(/\\/g, '/')), [a.folderPath]);

        // The bin refuses (over its quota): the project stays, and the user is told.
        const b = (await post(base, '/create-project', { name: 'B', folderPath: parent })).project;
        projectRoutes._setTrashFnForTests(async () => { throw new Error('exit 255'); });
        const refused = await post(base, '/delete-project', { folderPath: b.folderPath, expectedId: b.id });
        assert.equal(refused.success, false);
        assert.match(refused.error, /Recycle Bin/);
        assert.equal(fs.existsSync(path.join(b.folderPath, 'project.json')), true);
    } finally {
        await stop();
    }
});
