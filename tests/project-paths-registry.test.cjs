'use strict';

/**
 * MPI-809 — a removed project-paths entry must stay removed.
 *
 * `list-projects` used to migrate every caller-supplied `extraPaths` entry into
 * the durable registry, unconditionally. The registry is one shared file under
 * <Documents> that every app instance and connector client writes to, so an
 * entry only stayed removed once no client anywhere still held it in its own
 * localStorage mirror — the next `list-projects` from any other client put it
 * straight back. There was no sequence of user actions that removed an entry for
 * good.
 *
 * The registry is now the only input. A stale `extraPaths` from an old client is
 * ignored, not re-registered.
 */

const assert = require('node:assert/strict');
const test = require('node:test');
const express = require('express');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'mpi809-'));
process.env.APP_DOCUMENTS = TMP;

const projectRoutes = require('../routes/projects');
const { getProjectPathsRegistryFile } = require('../routes/shared');

// An external parent dir holding one project, outside the default root.
const PARENT = path.join(TMP, 'external').replace(/\\/g, '/');
const PROJECT = path.join(PARENT, 'demo');
fs.mkdirSync(PROJECT, { recursive: true });
fs.writeFileSync(
    path.join(PROJECT, 'project.json'),
    JSON.stringify({ id: 'demo-0000-4000-8000-000000000001', name: 'Demo', updatedAt: '2026-09-18T00:00:00Z' }),
);

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
    assert.equal(res.status, 200, `${route} answered ${res.status}`);
    return res.json();
}

/** The registry as it is on disk, not as a route reports it. */
function registryOnDisk() {
    const file = getProjectPathsRegistryFile();
    if (!fs.existsSync(file)) return [];
    return JSON.parse(fs.readFileSync(file, 'utf8')).paths;
}

test('a removed registry entry stays removed, even when a stale client still sends it', async () => {
    const { base, stop } = await serve();
    try {
        // Registered explicitly — this is what opening or adding a project does.
        await post(base, '/add-project-path', { parentDir: PARENT });
        assert.deepEqual(registryOnDisk(), [PARENT]);

        const listed = await post(base, '/list-projects', {});
        assert.equal(listed.projects.length, 1, 'the registered parent is scanned');
        assert.equal(listed.projects[0].name, 'Demo');

        // Unregister. This is the whole point of the card: it has to stick.
        await post(base, '/remove-project-path', { parentDir: PARENT });
        assert.deepEqual(registryOnDisk(), [], 'removed from the registry');

        // A client still holding the path in a stale mirror calls list-projects.
        // Before MPI-809 this both re-listed the project AND wrote the path back.
        const stale = await post(base, '/list-projects', { extraPaths: [PARENT] });
        assert.deepEqual(stale.projects, [], 'a stale extraPaths entry is not scanned');
        assert.deepEqual(registryOnDisk(), [], 'and is not migrated back into the registry');

        // Still gone on an ordinary call afterwards.
        const after = await post(base, '/list-projects', {});
        assert.deepEqual(after.projects, []);
    } finally {
        await stop();
    }
});

test('deleting the last project under a parent prunes the parent', async () => {
    const { base, stop } = await serve();
    try {
        await post(base, '/add-project-path', { parentDir: PARENT });
        assert.deepEqual(registryOnDisk(), [PARENT]);

        await post(base, '/delete-project', {
            folderPath: PROJECT,
            expectedId: 'demo-0000-4000-8000-000000000001',
        });

        assert.equal(fs.existsSync(PROJECT), false, 'project folder gone');
        assert.deepEqual(registryOnDisk(), [], 'no sibling project.json left, so the parent is pruned');
    } finally {
        await stop();
    }
});
