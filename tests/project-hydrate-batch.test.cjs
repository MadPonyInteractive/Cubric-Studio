'use strict';

/**
 * MPI-804 — opening a project hydrates in ONE request.
 *
 * The reconciler used to ask the server twice per history item (`/load-meta`, then
 * `/file-exists`), awaited in series, so a 150-item project was 300 round-trips
 * before the gallery could open. `POST /load-meta-batch` answers for every id at
 * once, and each answer carries the same two facts the pair used to: the sidecar,
 * and whether the media it points at is still on disk.
 */

const assert = require('node:assert/strict');
const test = require('node:test');
const express = require('express');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'mpi804-'));
process.env.APP_USER_DATA = TMP;

const projectRoutes = require('../routes/projects');

const PROJECT = path.join(TMP, 'Projects', 'demo');
const MEDIA = path.join(PROJECT, 'Media');
const META = path.join(MEDIA, '.meta');
fs.mkdirSync(META, { recursive: true });

/** A sidecar plus (optionally) the media file it points at. */
function item(id, { withMedia = true } = {}) {
    const mediaPath = path.join(MEDIA, `${id}.png`);
    fs.writeFileSync(path.join(META, `${id}.json`), JSON.stringify({
        id,
        type: 'image',
        filePath: `/project-file?path=${encodeURIComponent(mediaPath)}`,
        prompt: `prompt for ${id}`,
    }));
    if (withMedia) fs.writeFileSync(mediaPath, 'pixels');
    return id;
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

test('one request answers for every item: hydrated, orphaned, and unknown', async () => {
    const live = item('aaaaaaaa-0000-4000-8000-000000000001');
    const orphan = item('bbbbbbbb-0000-4000-8000-000000000002', { withMedia: false });
    const unknown = 'cccccccc-0000-4000-8000-000000000003';

    const { base, stop } = await serve();
    try {
        const res = await fetch(`${base}/load-meta-batch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ folderPath: PROJECT, ids: [live, orphan, unknown] }),
        });
        assert.equal(res.status, 200);
        const { success, items } = await res.json();

        assert.equal(success, true);
        // Sidecar read whole — the reconciler pushes this object straight into history.
        assert.equal(items[live].meta.prompt, `prompt for ${live}`);
        assert.equal(items[live].exists, true, 'media on disk');
        // Sidecar present, media gone: the caller deletes the sidecar (wasModified).
        assert.equal(items[orphan].meta.id, orphan);
        assert.equal(items[orphan].exists, false, 'media missing');
        // No sidecar at all — the 404 branch, now an entry rather than a failed request.
        assert.deepEqual(items[unknown], { meta: null, exists: false });
    } finally {
        await stop();
    }
});

test('the client asks ONCE for a whole project, not twice per item', async () => {
    const ids = Array.from({ length: 40 }, (_, i) => item(`dddddddd-0000-4000-8000-${String(i).padStart(12, '0')}`));

    const { base, stop } = await serve();
    const realFetch = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = (url, opts) => { calls++; return realFetch(String(url).startsWith('/') ? base + url : url, opts); };
    try {
        const { reconcileAndHydrate } = await import('../js/managers/projectReconciler.js');
        const { project, wasModified } = await reconcileAndHydrate({
            folderPath: PROJECT,
            itemGroups: [{ id: 'g1', history: ids, selectedIndex: 0 }],
        });

        assert.equal(calls, 1, `one request for ${ids.length} items (was ${ids.length * 2})`);
        assert.equal(project.itemGroups[0].history.length, ids.length);
        assert.equal(project.itemGroups[0].history[0].prompt, `prompt for ${ids[0]}`, 'hydrated from the sidecar');
        assert.equal(wasModified, false, 'nothing was missing, so nothing to re-persist');
    } finally {
        globalThis.fetch = realFetch;
        await stop();
    }
});

test('a failed hydration request throws instead of rewriting the project', async () => {
    const ids = [item('eeeeeeee-0000-4000-8000-000000000001')];

    const realFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response('nope', { status: 500 });
    try {
        const { reconcileAndHydrate } = await import('../js/managers/projectReconciler.js');
        // An empty answer would read as "no sidecar" for every id: synthetic
        // `uploaded` items, dropped groups, and wasModified true — persisted.
        await assert.rejects(
            () => reconcileAndHydrate({ folderPath: PROJECT, itemGroups: [{ id: 'g1', history: ids, selectedIndex: 0 }] }),
            /Could not read this project's items/,
        );
    } finally {
        globalThis.fetch = realFetch;
    }
});

test('a request without ids is refused, not answered with a half-truth', async () => {
    const { base, stop } = await serve();
    try {
        const res = await fetch(`${base}/load-meta-batch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ folderPath: PROJECT }),
        });
        assert.equal(res.status, 400);
    } finally {
        await stop();
    }
});
