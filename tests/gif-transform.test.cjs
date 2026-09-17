'use strict';

/**
 * gif-transform.test.cjs — MPI-773 (server half).
 *
 * Guards `routes/gifTransform.js` (POST /gif/crop, POST /gif/resize) and
 * `routes/gifToVideo.js` (POST /gif/to-video): a crop rect applied to every
 * frame produces a new GIF entry with delays/loop preserved; a resize target
 * lands every frame at exactly that size; GIF to Video turns a frame list
 * into a constant-30fps h264 MP4 at (forced-even) frame size, each source
 * frame repeated to hold its own delay, with any transparent area filled by
 * the background colour — built from the full-colour PNG frames, never from
 * a built `.gif` (no `.gif` is even produced by that route).
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs-extra');
const path = require('node:path');
const os = require('node:os');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const execFileP = promisify(execFile);
const sharp = require('sharp');
const express = require('express');
const { ffmpegPath } = require('../services/ffmpegBinary');
const gifFrames = require('../services/gifFrames');

async function tmpProject(prefix = 'gif-transform-test-') {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
    const mediaDir = path.join(root, 'Media');
    await fs.ensureDir(path.join(mediaDir, '.meta'));
    await fs.writeJson(path.join(root, 'project.json'), { id: 'p', itemGroups: [], sequenceCounters: {} });
    return { root, mediaDir };
}

/** A solid, fully-opaque RGBA PNG buffer of a given size and colour. */
async function solidPng(w, h, { r, g, b }) {
    return sharp({ create: { width: w, height: h, channels: 4, background: { r, g, b, alpha: 1 } } }).png().toBuffer();
}

/** A fully TRANSPARENT RGBA PNG whose hidden RGB is `hidden` — proves a flatten actually ran. */
async function transparentPng(w, h, hidden) {
    return sharp({ create: { width: w, height: h, channels: 4, background: { ...hidden, alpha: 0 } } }).png().toBuffer();
}

function buildApp() {
    const app = express();
    app.use(express.json());
    app.use(require('../routes/gifTransform.js'));
    app.use(require('../routes/gifToVideo.js'));
    return app;
}

async function startServer(app) {
    return new Promise((r) => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
}

async function postJson(base, urlPath, body) {
    return fetch(`${base}${urlPath}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
}

/** Raw RGBA pixel at (x,y) of a PNG file on disk. */
async function pngPixelAt(pngPath, x, y) {
    const { data, info } = await sharp(pngPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const idx = (y * info.width + x) * info.channels;
    return { r: data[idx], g: data[idx + 1], b: data[idx + 2], a: data[idx + 3] };
}

/** One video frame's raw RGB pixel at (x,y), decoded at `atSeconds`. */
async function videoFramePixelAt(videoPath, atSeconds, x, y, w, h) {
    const { stdout } = await execFileP(ffmpegPath, [
        '-ss', String(atSeconds), '-i', videoPath,
        '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-',
    ], { encoding: 'buffer', maxBuffer: 32 * 1024 * 1024 });
    void w;
    const idx = (y * w + x) * 3;
    return { r: stdout[idx], g: stdout[idx + 1], b: stdout[idx + 2] };
}

function closeTo(actual, expected, tolerance, label) {
    assert.ok(Math.abs(actual - expected) <= tolerance,
        `${label}: expected ~${expected} (±${tolerance}), got ${actual}`);
}

test('Crop then GIF to Video: 9:16 crop preserves delay/loop, GIF to Video gives a ~9s 30fps MP4 with even dims, poster+proxy, and a codec-faithful sampled pixel', async () => {
    const { root, mediaDir } = await tmpProject();
    const app = buildApp();
    const server = await startServer(app);
    const base = `http://127.0.0.1:${server.address().port}`;
    try {
        // Three frames of a 500x800 source, deliberately non-web-safe colours —
        // if GIF to Video ever accidentally read from a palette-quantised .gif
        // instead of these full-colour PNGs, these exact values would not survive.
        const c0 = { r: 91, g: 167, b: 38 };
        const c1 = { r: 203, g: 52, b: 129 };
        const c2 = { r: 44, g: 98, b: 214 };
        const { hash: h0 } = await gifFrames.writeFrame(mediaDir, await solidPng(500, 800, c0));
        const { hash: h1 } = await gifFrames.writeFrame(mediaDir, await solidPng(500, 800, c1));
        const { hash: h2 } = await gifFrames.writeFrame(mediaDir, await solidPng(500, 800, c2));

        // 405x723 ≈ 9:16, deliberately ODD on both axes (forces GIF to Video's
        // even-dimension padding below), fully inside the 500x800 source.
        const rect = { x: 40, y: 30, w: 405, h: 723 };

        const cropRes = await postJson(base, '/gif/crop', {
            folderPath: root,
            frames: [{ hash: h0, delay: 300 }, { hash: h1, delay: 300 }, { hash: h2, delay: 300 }],
            loop: 3,
            output: { maxEdge: 2048, colours: 256, edgeColour: null },
            ...rect,
        }).then((r) => r.json());

        assert.equal(cropRes.success, true, `gif/crop failed: ${cropRes.error}`);
        const cropped = cropRes.item;
        assert.equal(cropped.gif.frames.length, 3);
        assert.deepEqual(cropped.gif.frames.map((f) => f.delay), [300, 300, 300], 'delays must survive Crop');
        assert.equal(cropped.gif.loop, 3, 'loop must survive Crop');
        assert.deepEqual(cropped.pixelDimensions, { w: 405, h: 723 });

        // Every cropped frame is a solid crop of its source colour — centre pixel
        // must match exactly (no antialiasing possible on a flat interior crop).
        const expected = [c0, c1, c2];
        for (let i = 0; i < 3; i++) {
            const framePath = gifFrames.frameAbsPath(mediaDir, cropped.gif.frames[i].hash);
            const meta = await sharp(framePath).metadata();
            assert.equal(meta.width, 405);
            assert.equal(meta.height, 723);
            const px = await pngPixelAt(framePath, 200, 300);
            assert.deepEqual({ r: px.r, g: px.g, b: px.b }, expected[i], `cropped frame ${i} colour`);
            assert.equal(px.a, 255, `cropped frame ${i} must be fully opaque (crop rect was fully inside the source)`);
        }

        // ── GIF to Video on the cropped frames ──────────────────────────────
        const videoRes = await postJson(base, '/gif/to-video', {
            folderPath: root,
            frames: cropped.gif.frames, // [{hash, delay:300}] x3
            background: '#000000',
        }).then((r) => r.json());

        assert.equal(videoRes.success, true, `gif/to-video failed: ${videoRes.error}`);
        const video = videoRes.item;
        assert.equal(video.type, 'video');
        assert.equal(video.pixelDimensions.w % 2, 0, 'width must be forced even');
        assert.equal(video.pixelDimensions.h % 2, 0, 'height must be forced even');
        assert.deepEqual(video.pixelDimensions, { w: 406, h: 724 }, 'odd 405x723 must pad to even 406x724');
        closeTo(video.fps, 30, 0.5, 'fps');
        closeTo(video.duration, 9.0, 0.3, 'duration (3 frames x 3s each)');
        closeTo(video.frameCount, 270, 8, 'frameCount (3 x round(3s x 30fps))');
        assert.ok(video.thumbPath, 'poster must be written');
        assert.ok(video.proxyPath, 'hover proxy must be written (height 724 > 720 proxy threshold)');

        const videoAbsPath = new URL(video.filePath.replace(/&v=\d+$/, ''), 'http://localhost').searchParams.get('path');
        assert.ok(await fs.pathExists(videoAbsPath), 'the mp4 file must exist on disk');

        // Sample well inside frame 0's 0-3s window, well inside the un-padded
        // region (right/bottom padding is only 1px) — must read back c0 within
        // ordinary h264 codec tolerance on a flat region, never the .gif's
        // quantised value (this scene never touches a .gif at all).
        const px = await videoFramePixelAt(videoAbsPath, 1.5, 200, 300, video.pixelDimensions.w, video.pixelDimensions.h);
        closeTo(px.r, c0.r, 16, 'sampled video pixel r');
        closeTo(px.g, c0.g, 16, 'sampled video pixel g');
        closeTo(px.b, c0.b, 16, 'sampled video pixel b');
    } finally {
        await new Promise((r) => server.close(r));
        await fs.remove(root);
    }
});

test('Resize gives the target size on every frame; delays and loop survive', async () => {
    const { root, mediaDir } = await tmpProject();
    const app = buildApp();
    const server = await startServer(app);
    const base = `http://127.0.0.1:${server.address().port}`;
    try {
        const { hash: hA } = await gifFrames.writeFrame(mediaDir, await solidPng(50, 80, { r: 12, g: 200, b: 90 }));
        const { hash: hB } = await gifFrames.writeFrame(mediaDir, await solidPng(90, 40, { r: 230, g: 60, b: 15 }));

        const res = await postJson(base, '/gif/resize', {
            folderPath: root,
            frames: [{ hash: hA, delay: 15 }, { hash: hB, delay: 42 }],
            loop: 5,
            output: { maxEdge: 800, colours: 128, edgeColour: null },
            width: 64,
            height: 96,
        }).then((r) => r.json());

        assert.equal(res.success, true, `gif/resize failed: ${res.error}`);
        const item = res.item;
        assert.equal(item.gif.frames.length, 2);
        assert.deepEqual(item.gif.frames.map((f) => f.delay), [15, 42], 'delays must survive Resize');
        assert.equal(item.gif.loop, 5, 'loop must survive Resize');
        assert.deepEqual(item.pixelDimensions, { w: 64, h: 96 });

        for (const f of item.gif.frames) {
            const meta = await sharp(gifFrames.frameAbsPath(mediaDir, f.hash)).metadata();
            assert.equal(meta.width, 64, 'every resized frame must be the target width');
            assert.equal(meta.height, 96, 'every resized frame must be the target height');
        }
    } finally {
        await new Promise((r) => server.close(r));
        await fs.remove(root);
    }
});

test('GIF to Video: a fully transparent frame comes out as the background colour, not the hidden RGB', async () => {
    const { root, mediaDir } = await tmpProject();
    const app = buildApp();
    const server = await startServer(app);
    const base = `http://127.0.0.1:${server.address().port}`;
    try {
        const hiddenRgb = { r: 250, g: 10, b: 10 }; // bright red, fully hidden behind alpha 0
        const { hash } = await gifFrames.writeFrame(mediaDir, await transparentPng(64, 64, hiddenRgb));

        const bg = '#3f7a2c'; // deliberately non-default, non-black — catches an ignored `background` field
        const res = await postJson(base, '/gif/to-video', {
            folderPath: root,
            frames: [{ hash, delay: 50 }],
            background: bg,
        }).then((r) => r.json());

        assert.equal(res.success, true, `gif/to-video failed: ${res.error}`);
        const item = res.item;
        assert.deepEqual(item.pixelDimensions, { w: 64, h: 64 });

        const videoAbsPath = new URL(item.filePath.replace(/&v=\d+$/, ''), 'http://localhost').searchParams.get('path');
        const px = await videoFramePixelAt(videoAbsPath, 0.1, 32, 32, 64, 64);
        closeTo(px.r, 0x3f, 12, 'transparent area r must become the background colour');
        closeTo(px.g, 0x7a, 12, 'transparent area g must become the background colour');
        closeTo(px.b, 0x2c, 12, 'transparent area b must become the background colour');
        // Must NOT be anywhere near the hidden colour — proves flatten() actually ran.
        assert.ok(Math.abs(px.r - hiddenRgb.r) > 40 || Math.abs(px.g - hiddenRgb.g) > 40,
            `hidden colour leaked through: got ${JSON.stringify(px)}`);
    } finally {
        await new Promise((r) => server.close(r));
        await fs.remove(root);
    }
});

test('GIF to Video: cumulative rounding keeps total duration accurate across many small delays', async () => {
    const { root, mediaDir } = await tmpProject();
    const app = buildApp();
    const server = await startServer(app);
    const base = `http://127.0.0.1:${server.address().port}`;
    try {
        const { hash } = await gifFrames.writeFrame(mediaDir, await solidPng(20, 20, { r: 80, g: 140, b: 200 }));

        // 20 frames at delay 5 (50ms each): rounding EACH frame independently
        // gives round(0.05*30)=round(1.5)=2 frames every time -> 40 frames
        // (1.333s, +33% long). The true total is 20 x 50ms = 1.0s = 30 frames.
        const framesA = Array.from({ length: 20 }, () => ({ hash, delay: 5 }));
        const resA = await postJson(base, '/gif/to-video', { folderPath: root, frames: framesA }).then((r) => r.json());
        assert.equal(resA.success, true, `gif/to-video failed: ${resA.error}`);
        closeTo(resA.item.frameCount, 30, 1, '20 frames x 50ms frameCount');
        closeTo(resA.item.duration, 1.0, 1 / 30 + 0.02, '20 frames x 50ms duration');

        // 30 frames at delay 7 (70ms each): rounding EACH frame independently
        // gives round(0.07*30)=round(2.1)=2 frames every time -> 60 frames
        // (2.0s, ~5% short). The true total is 30 x 70ms = 2.1s = 63 frames.
        const framesB = Array.from({ length: 30 }, () => ({ hash, delay: 7 }));
        const resB = await postJson(base, '/gif/to-video', { folderPath: root, frames: framesB }).then((r) => r.json());
        assert.equal(resB.success, true, `gif/to-video failed: ${resB.error}`);
        closeTo(resB.item.frameCount, 63, 1, '30 frames x 70ms frameCount');
        closeTo(resB.item.duration, 2.1, 1 / 30 + 0.02, '30 frames x 70ms duration');
    } finally {
        await new Promise((r) => server.close(r));
        await fs.remove(root);
    }
});

test('POST /gif/crop rejects an unknown frame hash', async () => {
    const { root, mediaDir } = await tmpProject();
    const app = buildApp();
    const server = await startServer(app);
    try {
        const res = await postJson(`http://127.0.0.1:${server.address().port}`, '/gif/crop', {
            folderPath: root,
            frames: [{ hash: 'not-a-real-hash', delay: 10 }],
            x: 0, y: 0, w: 10, h: 10,
        });
        assert.equal(res.status, 400);
    } finally {
        await new Promise((r) => server.close(r));
        await fs.remove(root);
        void mediaDir;
    }
});

test('POST /gif/crop rejects a non-positive rect', async () => {
    const { root, mediaDir } = await tmpProject();
    const { hash } = await gifFrames.writeFrame(mediaDir, await solidPng(20, 20, { r: 1, g: 2, b: 3 }));
    const app = buildApp();
    const server = await startServer(app);
    try {
        const res = await postJson(`http://127.0.0.1:${server.address().port}`, '/gif/crop', {
            folderPath: root,
            frames: [{ hash, delay: 10 }],
            x: 0, y: 0, w: 0, h: 10,
        });
        assert.equal(res.status, 400);
    } finally {
        await new Promise((r) => server.close(r));
        await fs.remove(root);
    }
});

test('POST /gif/crop with outW/outH resamples every cut to exactly that size (RESOLUTION family); one without the other is rejected', async () => {
    const { root, mediaDir } = await tmpProject();
    const { hash } = await gifFrames.writeFrame(mediaDir, await solidPng(40, 30, { r: 200, g: 20, b: 20 }));
    const app = buildApp();
    const server = await startServer(app);
    const base = `http://127.0.0.1:${server.address().port}`;
    try {
        // A 20x40 box hanging 5px off the left edge, resampled to 30x60.
        const res = await postJson(base, '/gif/crop', {
            folderPath: root, frames: [{ hash, delay: 7 }, { hash, delay: 9 }],
            x: -5, y: -5, w: 20, h: 40, fill: '#00ff00', outW: 30, outH: 60,
        });
        const data = await res.json();
        assert.equal(data.success, true, data.error);
        assert.deepEqual(data.item.pixelDimensions, { w: 30, h: 60 });
        assert.deepEqual(data.item.gif.frames.map(f => f.delay), [7, 9]);
        const framePath = gifFrames.frameAbsPath(mediaDir, data.item.gif.frames[0].hash);
        const meta = await sharp(framePath).metadata();
        assert.deepEqual([meta.width, meta.height], [30, 60]);
        const inside = await pngPixelAt(framePath, 20, 30);
        assert.deepEqual([inside.r, inside.g, inside.b], [200, 20, 20], 'source pixels inside');
        const outside = await pngPixelAt(framePath, 0, 0);
        assert.deepEqual([outside.r, outside.g, outside.b], [0, 255, 0], 'fill outside the frame');

        const half = await postJson(base, '/gif/crop', {
            folderPath: root, frames: [{ hash, delay: 7 }], x: 0, y: 0, w: 10, h: 10, outW: 30,
        });
        assert.equal(half.status, 400);
    } finally {
        await new Promise((r) => server.close(r));
        await fs.remove(root);
    }
});

test('POST /gif/resize rejects a non-positive target size', async () => {
    const { root, mediaDir } = await tmpProject();
    const { hash } = await gifFrames.writeFrame(mediaDir, await solidPng(20, 20, { r: 1, g: 2, b: 3 }));
    const app = buildApp();
    const server = await startServer(app);
    try {
        const res = await postJson(`http://127.0.0.1:${server.address().port}`, '/gif/resize', {
            folderPath: root,
            frames: [{ hash, delay: 10 }],
            width: 64,
            height: -1,
        });
        assert.equal(res.status, 400);
    } finally {
        await new Promise((r) => server.close(r));
        await fs.remove(root);
    }
});

test('POST /gif/to-video rejects a missing frames array', async () => {
    const { root } = await tmpProject();
    const app = buildApp();
    const server = await startServer(app);
    try {
        const res = await postJson(`http://127.0.0.1:${server.address().port}`, '/gif/to-video', { folderPath: root });
        assert.equal(res.status, 400);
    } finally {
        await new Promise((r) => server.close(r));
        await fs.remove(root);
    }
});

test('POST /gif/to-video rejects frames whose sizes disagree', async () => {
    const { root, mediaDir } = await tmpProject();
    const { hash: h0 } = await gifFrames.writeFrame(mediaDir, await solidPng(20, 20, { r: 1, g: 2, b: 3 }));
    const { hash: h1 } = await gifFrames.writeFrame(mediaDir, await solidPng(30, 20, { r: 4, g: 5, b: 6 }));
    const app = buildApp();
    const server = await startServer(app);
    try {
        const res = await postJson(`http://127.0.0.1:${server.address().port}`, '/gif/to-video', {
            folderPath: root,
            frames: [{ hash: h0, delay: 10 }, { hash: h1, delay: 10 }],
        });
        assert.equal(res.status, 400);
    } finally {
        await new Promise((r) => server.close(r));
        await fs.remove(root);
    }
});
