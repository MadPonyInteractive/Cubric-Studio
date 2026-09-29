'use strict';

// MPI-976 — save-generation's GC could delete a card that another request was rewriting.
//
// Two routes rewrite a sidecar IN PLACE: a preview->final Continue (save-generation with
// `replaceItemId`) and a GIF update (`/gif/entry` mode 'update'). Each writes the new
// sidecar at the SAME id, then deletes the previous media file. Another save's GC reads a
// sidecar, then checks its media: read the OLD sidecar, let the rewrite land and drop the
// old media, then check it — the media is "gone", so the GC removed the NEW sidecar and
// every thumb with it. The card vanished on reload.
//
// fs-extra is one shared module object, so patching `pathExists` / `remove` on it forces
// that exact interleave: the GC's check of the old media starts the rewrite and waits for
// the old media to be deleted; the rewrite is then held right there, still in flight,
// until the GC's save has answered.

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('fs-extra');
const path = require('node:path');
const http = require('node:http');
const express = require('express');
const sharp = require('sharp');
const { scratchDir } = require('./helpers/scratch.cjs');
const gifFrames = require('../services/gifFrames');

const fileUrl = (p) => `/project-file?path=${encodeURIComponent(p)}`;
const fromUrl = (u) => decodeURIComponent(/[?&]path=([^&]+)/.exec(u)[1]);

async function harness() {
    const root = await scratchDir('mpi976-');
    const mediaDir = path.join(root, 'Media');
    const metaDir = path.join(mediaDir, '.meta');
    await fs.ensureDir(metaDir);
    await fs.writeJson(path.join(root, 'project.json'), { id: 'p', itemGroups: [] });

    const png = await sharp({ create: { width: 64, height: 64, channels: 4, background: '#f00' } }).png().toBuffer();
    const view = http.createServer((req, res) => res.end(png));
    await new Promise(r => view.listen(0, '127.0.0.1', r));
    const app = express();
    app.use(express.json());
    app.use(require('../routes/projects.js'));
    app.use(require('../routes/gif.js'));
    const server = await new Promise(r => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
    const post = (route, body) => fetch(`http://127.0.0.1:${server.address().port}${route}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    }).then(r => r.json());
    const viewUrl = (name) => `http://127.0.0.1:${view.address().port}/view?filename=${name}`;
    const close = async () => {
        await new Promise(r => server.close(r));
        await new Promise(r => view.close(r));
    };
    return { root, mediaDir, metaDir, png, post, viewUrl, close };
}

/**
 * Run a plain save whose GC meets `prevMedia` mid-rewrite: its check of that file starts
 * `rewrite()`, waits until the rewrite has deleted it, and only then answers. The rewrite
 * stays parked inside that delete until the save has responded.
 */
async function saveDuringRewrite(h, prevMedia, rewrite) {
    const { pathExists, remove } = fs;
    const prev = path.normalize(prevMedia);
    let raced = false;
    let saveDone;
    let rewriteDone;
    let prevGone;
    const gone = new Promise(r => { prevGone = r; });
    fs.pathExists = async (p) => {
        if (!raced && path.normalize(String(p)) === prev) {
            raced = true;
            rewriteDone = rewrite();
            await gone;
        }
        return pathExists(p);
    };
    fs.remove = async (p) => {
        const out = await remove(p);
        if (path.normalize(String(p)) === prev) {
            prevGone();
            await saveDone.catch(() => {});
        }
        return out;
    };
    try {
        saveDone = h.post('/project/save-generation', {
            folderPath: h.root,
            comfyViewUrl: h.viewUrl('removeBackground_001.png'),
            itemId: 'bbbbbbbb-0000-0000-0000-000000000976',
            operation: 'removeBackground',
            mediaType: 'image',
        });
        const saved = await saveDone;
        assert.equal(saved.success, true, JSON.stringify(saved));
        assert.ok(raced, 'interleave not forced: the GC never checked the rewritten item\'s old media');
        return await rewriteDone;
    } finally {
        fs.pathExists = pathExists;
        fs.remove = remove;
    }
}

async function assertCardIntact(h, id) {
    const metaPath = path.join(h.metaDir, `${id}.json`);
    assert.ok(await fs.pathExists(metaPath), `${id}.json was deleted by another save's GC`);
    const meta = await fs.readJson(metaPath);
    assert.ok(await fs.pathExists(fromUrl(meta.filePath)), 'sidecar points at media that is not on disk');
    assert.ok(await fs.pathExists(path.join(h.metaDir, `${id}.thumb.webp`)), 'its thumb was deleted');
    return meta;
}

test('a preview->final replace survives another save\'s GC', { timeout: 60000 }, async () => {
    const h = await harness();
    try {
        const id = 'aaaaaaaa-0000-0000-0000-000000000976';
        const preview = path.join(h.mediaDir, 't2i_001.png');
        await fs.writeFile(preview, h.png);
        await fs.writeFile(path.join(h.metaDir, `${id}.thumb.webp`), 'x');
        await fs.writeJson(path.join(h.metaDir, `${id}.json`), {
            id, type: 'image', operation: 't2i', stage: 'preview',
            filePath: fileUrl(preview),
            thumbPath: fileUrl(path.join(h.metaDir, `${id}.thumb.webp`)),
        });

        const replaced = await saveDuringRewrite(h, preview, () => h.post('/project/save-generation', {
            folderPath: h.root,
            comfyViewUrl: h.viewUrl('t2i_002.png'),
            replaceItemId: id,
            operation: 't2i',
            mediaType: 'image',
        }));
        assert.equal(replaced.success, true, JSON.stringify(replaced));

        const meta = await assertCardIntact(h, id);
        assert.equal(meta.stage, 'final');
        assert.equal(await fs.pathExists(preview), false, 'the preview media should be gone');
    } finally {
        await h.close();
    }
});

test('a GIF update survives another save\'s GC', { timeout: 60000 }, async () => {
    const h = await harness();
    try {
        const id = 'cccccccc-0000-0000-0000-000000000976';
        const frames = [];
        for (const background of ['#f00', '#00f']) {
            const buf = await sharp({ create: { width: 32, height: 24, channels: 3, background } }).png().toBuffer();
            frames.push({ hash: (await gifFrames.writeFrame(h.mediaDir, buf)).hash, delay: 10 });
        }
        const oldGif = path.join(h.mediaDir, 'gif_001.gif');
        await fs.writeFile(oldGif, 'x');
        await fs.writeFile(path.join(h.metaDir, `${id}.thumb.webp`), 'x');
        await fs.writeJson(path.join(h.metaDir, `${id}.json`), {
            id, type: 'image', operation: 'gif',
            filePath: fileUrl(oldGif),
            thumbPath: fileUrl(path.join(h.metaDir, `${id}.thumb.webp`)),
        });

        const updated = await saveDuringRewrite(h, oldGif, () => h.post('/gif/entry', {
            folderPath: h.root, mode: 'update', itemId: id, frames, loop: 0, output: {},
        }));
        assert.equal(updated.success, true, JSON.stringify(updated));

        await assertCardIntact(h, id);
        assert.equal(await fs.pathExists(oldGif), false, 'the previous .gif should be gone');
    } finally {
        await h.close();
    }
});
