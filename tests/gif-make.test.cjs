'use strict';

/**
 * gif-make.test.cjs — MPI-770.
 *
 * Guards `routes/gifMake.js` (POST /gif/make): three images of different
 * sizes/aspects, ctrl-clicked in a chosen order, become one GIF sidecar
 * whose frames follow that order, fitted+padded to the first image's size,
 * each still held 1 s, loop forever.
 *
 * Also pins the built `.gif`: the transparent padding kept in the frame STORE
 * comes out of the opaque build as black bars, never the previous frame.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs-extra');
const path = require('node:path');
const { scratchDir, scratchPath } = require('./helpers/scratch.cjs');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const execFileP = promisify(execFile);
const { ffmpegPath } = require('../services/ffmpegBinary');
const sharp = require('sharp');
const gifFrames = require('../services/gifFrames');

async function tmpProject(prefix = 'gif-make-test-') {
    const root = await scratchDir(prefix);
    const mediaDir = path.join(root, 'Media');
    await fs.ensureDir(path.join(mediaDir, '.meta'));
    await fs.writeJson(path.join(root, 'project.json'), { id: 'p', itemGroups: [], sequenceCounters: {} });
    return { root, mediaDir };
}

/** A tiny solid-colour PNG of a given size — distinct content per (colour,size). */
async function solidPng(colour, w, h) {
    const tmp = scratchPath(`solid-${colour}-${w}x${h}-${Date.now()}-${Math.random().toString(36).slice(2)}.png`);
    await execFileP(ffmpegPath, ['-y', '-f', 'lavfi', '-i', `color=c=${colour}:s=${w}x${h}`, '-frames:v', '1', tmp]);
    const buf = await fs.readFile(tmp);
    await fs.remove(tmp);
    return buf;
}

const url = (p) => `/project-file?path=${encodeURIComponent(p)}`;

function absFromUrl(raw) {
    const u = new URL(String(raw), 'http://localhost');
    return decodeURIComponent(u.searchParams.get('path') || '');
}

async function writeImageSidecar(metaDir, mediaDir, { id, colour, w, h }) {
    const buf = await solidPng(colour, w, h);
    const abs = path.join(mediaDir, `${id}.png`);
    await fs.writeFile(abs, buf);
    await fs.writeJson(path.join(metaDir, `${id}.json`), {
        id, type: 'image', filePath: url(abs), displayName: colour,
        pixelDimensions: { w, h }, uploaded: true,
    });
    return abs;
}

/** Raw RGBA pixel at (x,y) from a PNG buffer read from disk. */
async function pixelAt(pngPath, x, y) {
    const { data, info } = await sharp(pngPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const idx = (y * info.width + x) * info.channels;
    return { r: data[idx], g: data[idx + 1], b: data[idx + 2], a: data[idx + 3], channels: info.channels };
}

/** Raw pixel at (x,y) from ONE page of a multi-frame GIF (no alpha assumed). */
async function gifPixelAt(gifPath, page, x, y) {
    const { data, info } = await sharp(gifPath, { page }).raw().toBuffer({ resolveWithObject: true });
    const idx = (y * info.width + x) * info.channels;
    const px = { r: data[idx], g: data[idx + 1], b: data[idx + 2], channels: info.channels };
    if (info.channels >= 4) px.a = data[idx + 3];
    return px;
}

function buildApp() {
    const express = require('express');
    const app = express();
    app.use(express.json());
    app.use(require('../routes/gifMake.js'));
    return app;
}

async function startServer(app) {
    return new Promise(r => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
}

test('Make GIF: three images of different sizes/aspects -> one GIF sidecar in click order', async () => {
    const { root, mediaDir } = await tmpProject();
    const metaDir = path.join(mediaDir, '.meta');

    // First = the target canvas (square). Second = wide/short. Third = narrow/tall
    // — both have a different aspect from the first, so `contain` pads them on
    // opposite axes and (0,0) is guaranteed inside the padding for both.
    const idRed = 'aaaaaaaa-0000-0000-0000-000000000001';
    const idGreen = 'bbbbbbbb-0000-0000-0000-000000000002';
    const idBlue = 'cccccccc-0000-0000-0000-000000000003';
    await writeImageSidecar(metaDir, mediaDir, { id: idRed, colour: 'red', w: 64, h: 64 });
    await writeImageSidecar(metaDir, mediaDir, { id: idGreen, colour: 'green', w: 100, h: 20 });
    await writeImageSidecar(metaDir, mediaDir, { id: idBlue, colour: 'blue', w: 20, h: 100 });

    // Chosen click order — deliberately NOT the write order above, so an
    // ordering bug (e.g. re-sorting by id) would be caught.
    const chosenOrder = [idGreen, idRed, idBlue];

    const app = buildApp();
    const server = await startServer(app);
    try {
        const res = await fetch(`http://127.0.0.1:${server.address().port}/gif/make`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ folderPath: root, itemIds: chosenOrder }),
        }).then(r => r.json());

        assert.equal(res.success, true, `gif/make failed: ${res.error}`);
        const item = res.item;
        assert.equal(item.type, 'image');
        assert.ok(item.gif, 'item must carry a gif field');
        assert.equal(item.gif.frames.length, 3);
        assert.deepEqual(item.gif.frames.map(f => f.delay), [100, 100, 100], 'each still holds 1 s -> delay 100 hundredths on every frame');
        assert.equal(item.gif.loop, 0, 'loop forever (plan Decision 8)');
        // chosenOrder[0] is idGreen (100x20) — the canvas must be ITS size, not idRed's.
        assert.equal(item.pixelDimensions.w, 100);
        assert.equal(item.pixelDimensions.h, 20);

        // ── Frame order follows chosenOrder, not write order or id order ──────
        // Re-derive canvas size from the response (100x20) and read each stored
        // frame's CENTER pixel colour — always inside the painted region
        // regardless of padding axis.
        const [wCanvas, hCanvas] = [item.pixelDimensions.w, item.pixelDimensions.h];
        const cx = Math.floor(wCanvas / 2);
        const cy = Math.floor(hCanvas / 2);
        const centres = [];
        for (const f of item.gif.frames) {
            const framePath = gifFrames.frameAbsPath(mediaDir, f.hash);
            const meta = await sharp(framePath).metadata();
            assert.equal(meta.width, wCanvas, 'every stored frame must be the canvas width');
            assert.equal(meta.height, hCanvas, 'every stored frame must be the canvas height');
            centres.push(await pixelAt(framePath, cx, cy));
        }
        // green (canvas itself, full-bleed), red (fit inside), blue (fit inside)
        assert.ok(centres[0].g > centres[0].r && centres[0].g > centres[0].b, `frame 0 should be green, got ${JSON.stringify(centres[0])}`);
        assert.ok(centres[1].r > centres[1].g && centres[1].r > centres[1].b, `frame 1 should be red, got ${JSON.stringify(centres[1])}`);
        assert.ok(centres[2].b > centres[2].r && centres[2].b > centres[2].g, `frame 2 should be blue, got ${JSON.stringify(centres[2])}`);

        // ── Padding pixel check on the STORED frames (per instructions) ──────
        // Frame 0 (green) IS the canvas — full-bleed, no padding: corner opaque.
        const corner0 = await pixelAt(gifFrames.frameAbsPath(mediaDir, item.gif.frames[0].hash), 0, 0);
        assert.equal(corner0.a, 255, 'the canvas-defining frame has no padding — its corner must be opaque');
        // Frame 1 (red, 64x64 square fit inside a 100x20 canvas) is padded on
        // the vertical axis — a top corner must be exactly transparent.
        const corner1 = await pixelAt(gifFrames.frameAbsPath(mediaDir, item.gif.frames[1].hash), 0, 0);
        assert.deepEqual(corner1, { r: 0, g: 0, b: 0, a: 0, channels: 4 }, 'padding pixel must be exactly RGBA(0,0,0,0) — no leaked RGB');
        // Frame 2 (blue, 20x100 fit inside a 100x20 canvas) is padded on the
        // horizontal axis — a corner must also be exactly transparent.
        const corner2 = await pixelAt(gifFrames.frameAbsPath(mediaDir, item.gif.frames[2].hash), 0, 0);
        assert.deepEqual(corner2, { r: 0, g: 0, b: 0, a: 0, channels: 4 }, 'padding pixel must be exactly RGBA(0,0,0,0) — no leaked RGB');

        // ── Sidecar on disk matches the response ──────────────────────────────
        const onDisk = await fs.readJson(path.join(metaDir, `${item.id}.json`));
        assert.deepEqual(onDisk.gif.frames.map(f => f.hash), item.gif.frames.map(f => f.hash));

        // ── The BUILT .gif's padding pixel ────────────────────────────────────
        // Make GIF builds opaque (edgeColour: null, plan Decision 8), so the
        // transparent padding must come out as the builder's opaque background
        // (black), never the previous frame showing through it (the ghosting
        // this test caught before buildGif flattened opaque builds).
        const builtAbsPath = absFromUrl(item.filePath);
        const paddingCoord = { x: 0, y: 0 }; // inside every non-canvas frame's padded region
        for (const page of [1, 2]) {
            const px = await gifPixelAt(builtAbsPath, page, paddingCoord.x, paddingCoord.y);
            assert.deepEqual([px.r, px.g, px.b, px.a ?? 255], [0, 0, 0, 255],
                `page ${page} padding must be opaque black, not the previous frame`);
        }
    } finally {
        await new Promise(r => server.close(r));
        await fs.remove(root);
    }
});

test('Make GIF rejects a selection with fewer than 2 items', async () => {
    const { root, mediaDir } = await tmpProject();
    const metaDir = path.join(mediaDir, '.meta');
    const id = 'dddddddd-0000-0000-0000-000000000004';
    await writeImageSidecar(metaDir, mediaDir, { id, colour: 'red', w: 32, h: 32 });

    const app = buildApp();
    const server = await startServer(app);
    try {
        const res = await fetch(`http://127.0.0.1:${server.address().port}/gif/make`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ folderPath: root, itemIds: [id] }),
        });
        assert.equal(res.status, 400);
    } finally {
        await new Promise(r => server.close(r));
        await fs.remove(root);
    }
});

test('Make GIF rejects a non-still-image item (video)', async () => {
    const { root, mediaDir } = await tmpProject();
    const metaDir = path.join(mediaDir, '.meta');
    const idImg = 'eeeeeeee-0000-0000-0000-000000000005';
    const idVid = 'ffffffff-0000-0000-0000-000000000006';
    await writeImageSidecar(metaDir, mediaDir, { id: idImg, colour: 'red', w: 32, h: 32 });
    await fs.writeJson(path.join(metaDir, `${idVid}.json`), { id: idVid, type: 'video', filePath: url(path.join(mediaDir, 'x.mp4')) });

    const app = buildApp();
    const server = await startServer(app);
    try {
        const res = await fetch(`http://127.0.0.1:${server.address().port}/gif/make`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ folderPath: root, itemIds: [idImg, idVid] }),
        });
        assert.equal(res.status, 400);
    } finally {
        await new Promise(r => server.close(r));
        await fs.remove(root);
    }
});
