'use strict';

// MPI-898 — a renamed or moved project folder opened EMPTY.
//
// Every sidecar stores its refs as ABSOLUTE `/project-file?path=<old folder>\Media\...`
// urls. After a rename, /load-meta-batch tested the OLD path, reported every item
// missing, and the reconciler deleted each sidecar. The 2.0 Documents heal renames
// `Cubric Vision` -> `Cubric Studio`, so that was every upgrading user's gallery.
//
// The heal lives in /load-meta-batch, at the existence check: a miss whose path
// rebases onto the current folder is rewritten there and reported present.

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('fs-extra');
const path = require('node:path');
const os = require('node:os');
const express = require('express');

const router = require('../routes/projects.js');

const ID = 'cccccccc-0000-0000-0000-000000000898';

const url = (abs, v) => `/project-file?path=${encodeURIComponent(abs)}${v ? `&v=${v}` : ''}`;
const absOf = (u) => decodeURIComponent(String(u).slice(String(u).indexOf('path=') + 5).split('&')[0]);

/** A project at `<tmp>/A` whose sidecar carries every ref field a real one does. */
async function seed() {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'mpi898-'));
    const A = path.join(tmp, 'A');
    const media = path.join(A, 'Media');
    const meta = path.join(media, '.meta');
    const store = path.join(media, '.preview-assets');
    await fs.ensureDir(meta);
    await fs.ensureDir(store);
    const file = path.join(media, 'krea_001.png');
    const ref = path.join(store, 'abc.png');
    await fs.writeFile(file, 'pixels');
    await fs.writeFile(ref, 'ref');
    const outside = path.join(tmp, 'Other', 'Media', 'x.png');
    await fs.writeJson(path.join(meta, `${ID}.json`), {
        id: ID,
        filePath: url(file, 111),
        thumbPath: url(path.join(meta, `${ID}.thumb.webp`)),
        thumbPathLg: url(path.join(meta, `${ID}.thumb.1280.webp`)),
        proxyPath: url(path.join(meta, `${ID}.proxy.mp4`)),
        wavePath: url(path.join(meta, `${ID}.wave.webp`)),
        prompt: 'a pony',
        generationSettings: { mediaItems: [{ url: url(ref), filePath: url(ref), originalUrl: url(outside) }] },
        previewAssets: { snapshots: [{ filePath: url(ref), originalUrl: url(ref), relativePath: 'Media/.preview-assets/abc.png' }] },
    });
    return { tmp, A, B: path.join(tmp, 'B'), outside };
}

async function post(route, body) {
    const app = express();
    app.use(express.json());
    app.use(router);
    const server = app.listen(0, '127.0.0.1');
    try {
        await new Promise(r => server.once('listening', r));
        const res = await fetch(`http://127.0.0.1:${server.address().port}${route}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        return await res.json();
    } finally {
        server.close();
    }
}

const loadMetaBatch = async (folderPath) => (await post('/load-meta-batch', { folderPath, ids: [ID] })).items[ID];

/** Every /project-file ref string in an object. */
function refs(o, out = []) {
    if (typeof o === 'string') { if (o.includes('/project-file?')) out.push(o); }
    else if (o && typeof o === 'object') for (const v of Object.values(o)) refs(v, out);
    return out;
}

test('a renamed project folder: every item is found, every ref points into the new folder', async () => {
    const s = await seed();
    try {
        await fs.rename(s.A, s.B);
        const item = await loadMetaBatch(s.B);
        assert.equal(item.exists, true, 'media reads missing: the reconciler would delete this sidecar');

        const onDisk = await fs.readJson(path.join(s.B, 'Media', '.meta', `${ID}.json`));
        assert.deepEqual(item.meta, onDisk, 'the healed sidecar is what was persisted');
        assert.match(onDisk.filePath, /&v=111$/, 'the cache-bust survives');
        assert.equal(onDisk.prompt, 'a pony');
        for (const r of refs(onDisk)) {
            const abs = absOf(r);
            if (abs === s.outside) continue;
            assert.ok(abs.startsWith(s.B + path.sep), `still points at the old folder: ${abs}`);
        }
        assert.equal(absOf(onDisk.generationSettings.mediaItems[0].originalUrl), s.outside,
            'a ref outside the old project is left alone');
    } finally {
        await fs.remove(s.tmp);
    }
});

// project.json stores its own absolute `folderPath`, and the reconciler hydrates from
// the project /migrate-project returns. A stale one sends /load-meta-batch to the OLD
// folder, where no sidecar exists, so every item is dropped before the heal can run.
test('/migrate-project hands back the folder it was opened from, and persists it', async () => {
    const s = await seed();
    try {
        await fs.writeJson(path.join(s.A, 'project.json'), {
            id: 'p', name: 'Mine', schemaVersion: 99, folderPath: s.A.replace(/\\/g, '/'), itemGroups: [],
        });
        await fs.rename(s.A, s.B);
        const { project } = await post('/migrate-project', { folderPath: s.B });
        const want = s.B.replace(/\\/g, '/');
        assert.equal(project.folderPath, want, 'the reconciler would read the old folder');
        assert.equal((await fs.readJson(path.join(s.B, 'project.json'))).folderPath, want);
    } finally {
        await fs.remove(s.tmp);
    }
});

test('media genuinely gone: still reported missing, sidecar untouched', async () => {
    const s = await seed();
    try {
        await fs.remove(path.join(s.A, 'Media', 'krea_001.png'));
        const metaPath = path.join(s.A, 'Media', '.meta', `${ID}.json`);
        const before = await fs.readFile(metaPath, 'utf8');
        const item = await loadMetaBatch(s.A);
        assert.equal(item.exists, false);
        assert.equal(await fs.readFile(metaPath, 'utf8'), before);
    } finally {
        await fs.remove(s.tmp);
    }
});
