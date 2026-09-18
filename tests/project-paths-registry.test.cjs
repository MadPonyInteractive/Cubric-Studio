'use strict';

/**
 * MPI-809 — the project registry: removals stick, and "remove but keep the files"
 * removes exactly one project.
 *
 * Two defects, one file.
 *
 * 1. `list-projects` used to migrate every caller-supplied `extraPaths` entry into
 *    the durable registry, unconditionally. That registry is one shared file under
 *    <Documents> that every app instance and connector client writes to, so an
 *    entry only stayed removed once no client anywhere still held it in its own
 *    localStorage mirror — the next `list-projects` put it straight back. The
 *    registry is now the only input; a stale `extraPaths` is ignored.
 *
 * 2. Delete Project with "Also delete files from disk" unchecked did nothing: it
 *    filtered a localStorage mirror the registry then overrode. It now records the
 *    project in the registry's `hidden` list. Per PROJECT, not per parent dir —
 *    unregistering the parent would take the user's sibling projects with it, and
 *    could not express this at all for a default-root project, because the default
 *    root is always scanned.
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
const { getProjectPathsRegistryFile, getProjectsRoot } = require('../routes/shared');

let nextId = 0;

/** A project folder on disk. Returns its normalized path. */
function makeProject(dir, name) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
        path.join(dir, 'project.json'),
        JSON.stringify({
            id: `demo-0000-4000-8000-${String(++nextId).padStart(12, '0')}`,
            name,
            updatedAt: '2026-09-18T00:00:00Z',
        }),
    );
    return dir.replace(/\\/g, '/');
}

/** A fresh external parent dir, so tests cannot leak into each other. */
function makeParent(label) {
    const parent = path.join(TMP, 'external', label);
    fs.mkdirSync(parent, { recursive: true });
    return parent.replace(/\\/g, '/');
}

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
    const json = await res.json();
    assert.equal(json.success, true, `${route} failed: ${json.error}`);
    return json;
}

/** The registry document as it is on disk, not as a route reports it. */
function registryOnDisk() {
    const file = getProjectPathsRegistryFile();
    if (!fs.existsSync(file)) return { paths: [], hidden: [] };
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    return { paths: raw.paths || [], hidden: raw.hidden || [] };
}

/**
 * Listed project names carrying `prefix`. Scoped per test because the registry is
 * one process-wide file and earlier tests leave their parents registered — which
 * is the behaviour under test, not something to reset between cases.
 */
const names = (r, prefix) => r.projects.map(p => p.name).filter(n => n.startsWith(prefix)).sort();

/** Hidden entries under one parent dir — same scoping reason as `names`. */
const hiddenUnder = (parent) => registryOnDisk().hidden.filter(p => p.startsWith(`${parent}/`)).sort();

test('a removed registry entry stays removed, even when a stale client still sends it', async () => {
    const parent = makeParent('stale');
    makeProject(path.join(parent, 'demo'), 'Stale-Demo');

    const { base, stop } = await serve();
    try {
        // Registered explicitly — this is what opening or adding a project does.
        await post(base, '/add-project-path', { parentDir: parent });
        assert.deepEqual(registryOnDisk().paths, [parent]);
        assert.deepEqual(names(await post(base, '/list-projects', {}), 'Stale-'), ['Stale-Demo']);

        // Unregister. This is the whole point of the card: it has to stick.
        await post(base, '/remove-project-path', { parentDir: parent });
        assert.deepEqual(registryOnDisk().paths, [], 'removed from the registry');

        // A client still holding the path in a stale mirror calls list-projects.
        // Before MPI-809 this both re-listed the project AND wrote the path back.
        const stale = await post(base, '/list-projects', { extraPaths: [parent] });
        assert.deepEqual(stale.projects, [], 'a stale extraPaths entry is not scanned');
        assert.deepEqual(registryOnDisk().paths, [], 'and is not migrated back into the registry');

        assert.deepEqual((await post(base, '/list-projects', {})).projects, []);
    } finally {
        await stop();
    }
});

test('hiding one project leaves its siblings listed and its files on disk', async () => {
    const parent = makeParent('hide');
    const demo = makeProject(path.join(parent, 'demo'), 'Hide-Demo');
    makeProject(path.join(parent, 'sibling'), 'Hide-Sibling');

    const { base, stop } = await serve();
    try {
        await post(base, '/add-project-path', { parentDir: parent });
        assert.deepEqual(names(await post(base, '/list-projects', {}), 'Hide-'), ['Hide-Demo', 'Hide-Sibling']);

        // "Delete project", "Also delete files from disk" UNCHECKED.
        await post(base, '/hide-project', { folderPath: demo, hidden: true });

        assert.deepEqual(names(await post(base, '/list-projects', {}), 'Hide-'), ['Hide-Sibling'],
            'only the hidden project goes; the sibling under the same parent stays');
        assert.equal(fs.existsSync(path.join(demo, 'project.json')), true, 'nothing deleted on disk');
        assert.deepEqual(registryOnDisk().paths, [parent], 'the parent is still registered');
        assert.deepEqual(hiddenUnder(parent), [demo]);

        // Sticks across calls — it is durable, not per-session state.
        assert.deepEqual(names(await post(base, '/list-projects', {}), 'Hide-'), ['Hide-Sibling']);

        // Re-importing the folder is the way back.
        await post(base, '/hide-project', { folderPath: demo, hidden: false });
        assert.deepEqual(names(await post(base, '/list-projects', {}), 'Hide-'), ['Hide-Demo', 'Hide-Sibling']);
        assert.deepEqual(hiddenUnder(parent), []);
    } finally {
        await stop();
    }
});

test('a DEFAULT-root project can be hidden too — there is no parent to unregister', async () => {
    const root = getProjectsRoot();
    const demo = makeProject(path.join(root, 'default-demo'), 'Default-Demo');

    const { base, stop } = await serve();
    try {
        assert.deepEqual(names(await post(base, '/list-projects', {}), 'Default-'), ['Default-Demo']);

        await post(base, '/hide-project', { folderPath: demo, hidden: true });

        // The default root is always scanned, so nothing but the hidden list can
        // take this project off Landing.
        assert.deepEqual(names(await post(base, '/list-projects', {}), 'Default-'), []);
        assert.equal(fs.existsSync(path.join(demo, 'project.json')), true, 'files untouched');
    } finally {
        await stop();
    }
});

test('a hidden entry is cleared when the path stops being that project', async () => {
    const parent = makeParent('ghost');
    const demo = makeProject(path.join(parent, 'demo'), 'Ghost-Demo');

    const { base, stop } = await serve();
    try {
        await post(base, '/add-project-path', { parentDir: parent });
        const { projects } = await post(base, '/list-projects', {});
        const id = projects.find(p => p.name === 'Ghost-Demo').id;

        await post(base, '/hide-project', { folderPath: demo, hidden: true });
        assert.deepEqual(hiddenUnder(parent), [demo]);

        // Deleting for real removes the folder AND the now-meaningless hidden entry,
        // so it cannot ghost a future project created at the same path.
        await post(base, '/delete-project', { folderPath: demo, expectedId: id });
        assert.equal(fs.existsSync(demo), false);
        assert.deepEqual(hiddenUnder(parent), []);

        // Same guard from the other side: creating a project at a hidden path unhides
        // it. Deleting the only project above pruned the parent, so re-register it —
        // otherwise nothing scans the folder and the assertion would pass for the
        // wrong reason.
        await post(base, '/add-project-path', { parentDir: parent });
        const reused = path.join(parent, 'Ghost-Reused').replace(/\\/g, '/');
        await post(base, '/hide-project', { folderPath: reused, hidden: true });
        const created = await post(base, '/create-project', { name: 'Ghost-Reused', folderPath: parent });
        assert.equal(created.project.folderPath, reused, 'landed on the hidden path');
        assert.deepEqual(hiddenUnder(parent), []);
        assert.deepEqual(names(await post(base, '/list-projects', {}), 'Ghost-'), ['Ghost-Reused'],
            'visible, not a ghost');
    } finally {
        await stop();
    }
});
