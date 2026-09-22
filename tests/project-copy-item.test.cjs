'use strict';

// MPI-887 — POST /project-media/:projectId/copy-item.
//
// Composite's slot only ever reached an entry already in the open card's history, so
// two pictures in two gallery cards could never be composited. The copy is what lets
// one become a history entry on the other's card.
//
// It has to be a COPY: deleting a history entry deletes its file on disk
// (MpiGroupHistoryBlock's delete handler), so two cards pointing at one path means
// deleting either one guts the other. And it has to clone the sidecar, or the entry
// arrives with the prompt that made it gone.
//
// The route shares `copyItemIntoProject()` with `add-from-cards`, which is the reason
// the second test here exists at all: that extraction must not have moved anything.

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('fs-extra');
const path = require('node:path');
const os = require('node:os');
const express = require('express');

const router = require('../routes/projects.js');

const SRC_ID = 'bbbbbbbb-0000-0000-0000-000000000001';

/** A project folder holding one image card with a full sidecar and a thumb. */
async function seedProject() {
    const folderPath = await fs.mkdtemp(path.join(os.tmpdir(), 'mpi887-'));
    const mediaDir = path.join(folderPath, 'Media');
    const metaDir = path.join(mediaDir, '.meta');
    await fs.ensureDir(metaDir);

    const absMedia = path.join(mediaDir, 'krea_012.png');
    await fs.writeFile(absMedia, Buffer.from('the original pixels'));
    const absThumb = path.join(metaDir, `${SRC_ID}.thumb.jpg`);
    await fs.writeFile(absThumb, Buffer.from('thumb'));

    const filePath = `/project-file?path=${encodeURIComponent(absMedia)}`;
    const thumbPath = `/project-file?path=${encodeURIComponent(absThumb)}`;
    await fs.writeJson(path.join(metaDir, `${SRC_ID}.json`), {
        id: SRC_ID,
        type: 'image',
        filePath,
        thumbPath,
        displayName: 'krea_012',
        prompt: 'a demon looking into a mirror',
        negativePrompt: 'blurry',
        seed: 8812,
        model: 'krea2',
        operation: 't2i',
        pixelDimensions: { w: 1024, h: 1024 },
    });

    return { folderPath, mediaDir, metaDir, absMedia, absThumb, item: { id: SRC_ID, filePath, thumbPath } };
}

async function withServer(fn) {
    const app = express();
    app.use(express.json({ limit: '10mb' }));
    app.use(router);
    const server = app.listen(0, '127.0.0.1');
    try {
        await new Promise(r => server.once('listening', r));
        await fn(`http://127.0.0.1:${server.address().port}`);
    } finally {
        server.close();
    }
}

/** The absolute path back out of a `/project-file?path=<encoded>` URL. */
function absOf(url) {
    return decodeURIComponent(String(url).slice(String(url).indexOf('path=') + 5).split('&')[0]);
}

test('copy-item writes its own media and sidecar, keeps the prompt, leaves the source alone', async () => {
    const seed = await seedProject();
    try {
        await withServer(async (base) => {
            const res = await fetch(`${base}/project-media/p1/copy-item`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ folderPath: seed.folderPath, item: seed.item, type: 'image', name: 'krea_012' }),
            });
            const body = await res.json();
            assert.equal(res.status, 200);
            assert.equal(body.success, true);

            // A fresh id, never the source's — the sidecar is keyed by it.
            assert.notEqual(body.itemId, SRC_ID);

            // Its own file, with the same bytes, and the source still on disk.
            const copyAbs = absOf(body.filePath);
            assert.notEqual(copyAbs, seed.absMedia, 'the copy must not point at the source file');
            assert.equal(await fs.readFile(copyAbs, 'utf8'), 'the original pixels');
            assert.ok(await fs.pathExists(seed.absMedia), 'the source media must survive');

            // The provenance the whole copy-rather-than-reupload choice exists for.
            assert.equal(body.prompt, 'a demon looking into a mirror');
            assert.equal(body.seed, 8812);
            assert.equal(body.model, 'krea2');
            assert.deepEqual(body.pixelDimensions, { w: 1024, h: 1024 });

            // The sidecar on disk agrees with the response, under the new id.
            const meta = await fs.readJson(path.join(seed.metaDir, `${body.itemId}.json`));
            assert.equal(meta.id, body.itemId);
            assert.equal(meta.filePath, body.filePath);
            assert.equal(meta.prompt, 'a demon looking into a mirror');

            // The companion thumb copied too, and to its own path.
            const thumbAbs = absOf(body.thumbPath);
            assert.notEqual(thumbAbs, seed.absThumb);
            assert.ok(await fs.pathExists(thumbAbs));

            // NO project.json write — the renderer owns itemGroups for the open project.
            assert.equal(await fs.pathExists(path.join(seed.folderPath, 'project.json')), false);
        });
    } finally {
        await fs.remove(seed.folderPath);
    }
});

test('copy-item 404s when the source media is gone, and 400s with no item', async () => {
    const seed = await seedProject();
    try {
        await fs.remove(seed.absMedia);
        await withServer(async (base) => {
            const gone = await fetch(`${base}/project-media/p1/copy-item`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ folderPath: seed.folderPath, item: seed.item }),
            });
            assert.equal(gone.status, 404);

            const empty = await fetch(`${base}/project-media/p1/copy-item`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ folderPath: seed.folderPath }),
            });
            assert.equal(empty.status, 400);
        });
    } finally {
        await fs.remove(seed.folderPath);
    }
});

test('add-from-cards still builds a card per copy after the extraction', async () => {
    const seed = await seedProject();
    const dest = await fs.mkdtemp(path.join(os.tmpdir(), 'mpi887-dest-'));
    // `updateProjectJson` reads before it writes — a destination project already exists.
    await fs.writeJson(path.join(dest, 'project.json'), { id: 'p2', name: 'Dest', itemGroups: [] });
    try {
        await withServer(async (base) => {
            const res = await fetch(`${base}/project-media/p2/add-from-cards`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    folderPath: dest,
                    cards: [{ type: 'image', name: 'Demon', item: seed.item }],
                }),
            });
            const body = await res.json();
            assert.equal(res.status, 200);
            assert.deepEqual(body, { success: true, added: 1 });

            const project = await fs.readJson(path.join(dest, 'project.json'));
            assert.equal(project.itemGroups.length, 1);
            const group = project.itemGroups[0];
            assert.equal(group.type, 'image');
            assert.equal(group.name, 'Demon');
            assert.equal(group.history.length, 1);

            // The copy landed in the DESTINATION project, sidecar and all.
            const meta = await fs.readJson(path.join(dest, 'Media', '.meta', `${group.history[0]}.json`));
            assert.equal(meta.prompt, 'a demon looking into a mirror');
            assert.ok(absOf(meta.filePath).startsWith(dest), 'the copy must live in the destination project');
            assert.ok(await fs.pathExists(seed.absMedia), 'the source project is never touched');
        });
    } finally {
        await fs.remove(seed.folderPath);
        await fs.remove(dest);
    }
});
