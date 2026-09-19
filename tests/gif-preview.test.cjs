'use strict';

/**
 * gif-preview.test.cjs — MPI-771 consistency audit.
 *
 * `POST /gif/preview` gives the GIF output tool the preview the video
 * workspace's GIF Maker always had. The point of the route is that it runs the
 * SAME `buildGif()` the Apply runs, so the pane shows what Apply would write —
 * these assertions are about that, and about it writing nothing else.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs-extra');
const path = require('node:path');
const express = require('express');
const sharp = require('sharp');
const { scratchDir } = require('./helpers/scratch.cjs');
const gifRoutes = require('../routes/gif.js');
const gifFrames = require('../services/gifFrames');

async function tmpProject() {
    const root = await scratchDir('gif-preview-test-');
    const mediaDir = path.join(root, 'Media');
    await fs.ensureDir(path.join(mediaDir, '.meta'));
    await fs.writeJson(path.join(root, 'project.json'), { id: 'p', itemGroups: [], sequenceCounters: {} });
    return { root, mediaDir };
}

const solidPng = (w, h, rgb) =>
    sharp({ create: { width: w, height: h, channels: 3, background: rgb } }).png().toBuffer();

async function withServer(fn) {
    const app = express();
    app.use(express.json({ limit: '25mb' }));
    app.use(gifRoutes);
    const server = await new Promise((r) => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
    try {
        return await fn(`http://127.0.0.1:${server.address().port}`);
    } finally {
        await new Promise((r) => server.close(r));
    }
}

const post = (base, body) => fetch(`${base}/gif/preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
});

test('POST /gif/preview builds the real .gif, reports its size, and writes no entry', async () => {
    const { root, mediaDir } = await tmpProject();
    try {
        const frames = [];
        for (const rgb of [{ r: 255, g: 0, b: 0 }, { r: 0, g: 255, b: 0 }, { r: 0, g: 0, b: 255 }]) {
            const { hash } = await gifFrames.writeFrame(mediaDir, await solidPng(32, 24, rgb));
            frames.push({ hash, delay: 8 });
        }
        const framesBefore = (await fs.readdir(gifFrames.framesDir(mediaDir))).length;

        await withServer(async (base) => {
            const res = await post(base, {
                folderPath: root,
                frames,
                loop: 2,
                output: { maxEdge: 32, colours: 64, edgeColour: null },
            });
            assert.equal(res.status, 200);
            const data = await res.json();
            assert.equal(data.success, true);

            // The URL is the generic /project-file route, cache-busted by mtime —
            // Chromium caches decoded image bytes per URL, so a second build at the
            // same path would otherwise show the first one (the E5 reason
            // /gif/entry's update branch re-sequences its filename).
            assert.match(data.url, /^\/project-file\?path=.+&v=\d+$/);
            const previewPath = decodeURIComponent(data.url.match(/path=([^&]+)/)[1]);
            assert.equal(previewPath, path.join(mediaDir, '.gif-preview', 'preview.gif'));
            assert.ok(await fs.pathExists(previewPath), 'the preview file exists');

            // A REAL build, not a placeholder: every frame is in it, at the asked
            // size, and the byte count is the file's own.
            const meta = await sharp(previewPath, { animated: true }).metadata();
            assert.equal(meta.pages, 3);
            assert.equal(meta.width, 32);
            assert.equal(data.byteSize, (await fs.stat(previewPath)).size);
        });

        // Nothing reached the history. A preview that wrote a sidecar would put a
        // card on the board every time the user looked at their settings.
        assert.deepEqual(await fs.readdir(path.join(mediaDir, '.meta')), []);
        assert.deepEqual((await fs.readdir(mediaDir)).filter(f => f.endsWith('.gif')), []);
        assert.equal((await fs.readdir(gifFrames.framesDir(mediaDir))).length, framesBefore,
            'a preview writes no frame files');
    } finally {
        await fs.remove(root);
    }
});

test('POST /gif/preview overwrites ONE file per project rather than piling them up', async () => {
    const { root, mediaDir } = await tmpProject();
    try {
        const { hash } = await gifFrames.writeFrame(mediaDir, await solidPng(16, 16, { r: 9, g: 9, b: 9 }));
        const frames = [{ hash, delay: 10 }];
        await withServer(async (base) => {
            for (const colours of [256, 32, 8]) {
                const res = await post(base, { folderPath: root, frames, loop: 0, output: { maxEdge: 16, colours } });
                assert.equal((await res.json()).success, true);
            }
        });
        // A preview is referenced by no sidecar, so the frame sweep could never
        // collect a second one: the route has to keep it to a single file.
        assert.deepEqual(await fs.readdir(path.join(mediaDir, '.gif-preview')), ['preview.gif']);
    } finally {
        await fs.remove(root);
    }
});

test('POST /gif/preview refuses a bad body before touching disk', async () => {
    const { root, mediaDir } = await tmpProject();
    try {
        await withServer(async (base) => {
            assert.equal((await post(base, { frames: [{ hash: 'x', delay: 1 }] })).status, 400,
                'no folderPath');
            assert.equal((await post(base, { folderPath: root, frames: [] })).status, 400,
                'empty frame list');

            // An unknown hash is the one that matters: `buildGif` would otherwise
            // throw deep in sharp with a path the user cannot act on.
            const res = await post(base, { folderPath: root, frames: [{ hash: 'deadbeef', delay: 10 }] });
            assert.equal(res.status, 400);
            assert.match((await res.json()).error, /unknown frame hash: deadbeef/);
        });
        assert.equal(await fs.pathExists(path.join(mediaDir, '.gif-preview')), false,
            'a refused request leaves no preview dir behind');
    } finally {
        await fs.remove(root);
    }
});
