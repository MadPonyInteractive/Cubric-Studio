'use strict';

/**
 * gif-cutout.test.cjs — MPI-771 (engine half).
 *
 * Guards `routes/gifCutout.js`'s non-GPU half: mask -> alpha, Mask Adjust
 * (must match `distanceField.js`'s own math byte-for-byte — the same module
 * the live preview runs), Invert, and that the frame store only grows by the
 * cut frames. The SAM3 video-track itself (`runGifCutoutTrack`,
 * commandExecutor.js) needs a real engine and was verified live separately
 * (see MPI-771 report) — nothing here touches ComfyUI.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs-extra');
const path = require('node:path');
const os = require('node:os');
const sharp = require('sharp');
const express = require('express');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const execFileP = promisify(execFile);
const { ffprobePath } = require('../services/ffmpegBinary');
const gifCutout = require('../routes/gifCutout.js');
const gifFrames = require('../services/gifFrames');

async function tmpProject(prefix = 'gif-cutout-test-') {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
    const mediaDir = path.join(root, 'Media');
    await fs.ensureDir(path.join(mediaDir, '.meta'));
    await fs.writeJson(path.join(root, 'project.json'), { id: 'p', itemGroups: [], sequenceCounters: {} });
    return { root, mediaDir };
}

/** A tiny solid-colour opaque PNG buffer. */
async function solidPng(w, h, rgb) {
    return sharp({ create: { width: w, height: h, channels: 3, background: rgb } }).png().toBuffer();
}

/** A grey PNG mask: `inside(x,y)` true -> white (255), else black (0). */
async function maskPng(w, h, inside) {
    const raw = Buffer.alloc(w * h);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) raw[y * w + x] = inside(x, y) ? 255 : 0;
    }
    return sharp(raw, { raw: { width: w, height: h, channels: 1 } }).png().toBuffer();
}

function toDataUrl(buf) {
    return `data:image/png;base64,${buf.toString('base64')}`;
}

async function alphaPlane(pngBuffer) {
    const { data, info } = await sharp(pngBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const out = new Uint8Array(info.width * info.height);
    for (let i = 0; i < out.length; i++) out[i] = data[i * info.channels + 3];
    return { alpha: out, width: info.width, height: info.height };
}

test('applyMaskAlpha: no adjust — mask grey becomes the frame alpha 1:1', async () => {
    const w = 8, h = 4;
    const frame = await solidPng(w, h, { r: 200, g: 40, b: 40 });
    const mask = await maskPng(w, h, (x) => x < w / 2); // left half white, right half black

    const cut = await gifCutout.applyMaskAlpha({ frameBuffer: frame, maskBuffer: mask });
    const { alpha, width, height } = await alphaPlane(cut);
    assert.equal(width, w);
    assert.equal(height, h);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const expected = x < w / 2 ? 255 : 0;
            assert.equal(alpha[y * w + x], expected, `pixel (${x},${y})`);
        }
    }
    // RGB must survive untouched (flatten/joinChannel must not tint it).
    const { data, info } = await sharp(cut).raw().toBuffer({ resolveWithObject: true });
    const idx = (0 * w + 0) * info.channels;
    assert.equal(data[idx], 200);
    assert.equal(data[idx + 1], 40);
    assert.equal(data[idx + 2], 40);
});

test('applyMaskAlpha: grow matches distanceField.js on the identical input', async () => {
    const w = 15, h = 15;
    // A single seed pixel in the centre — grow(2) should paint every pixel
    // within distance 2 of it, exactly what signedSquaredDistanceField says.
    const cx = 7, cy = 7;
    const mask = await maskPng(w, h, (x, y) => x === cx && y === cy);
    const frame = await solidPng(w, h, { r: 10, g: 10, b: 10 });

    const cut = await gifCutout.applyMaskAlpha({ frameBuffer: frame, maskBuffer: mask, adjust: { grow: 2 } });
    const { alpha: gotAlpha } = await alphaPlane(cut);

    // Independently recompute the expected grow(2) with distanceField.js
    // itself, on the SAME synthetic alpha-only RGBA buffer applyMaskAlpha
    // builds internally — proves the route reuses the real primitive rather
    // than an approximation of it.
    const { signedSquaredDistanceField, rangeFor, writeRange } =
        await import('../js/components/Primitives/MpiCanvas/managers/distanceField.js');
    const rgba = new Uint8ClampedArray(w * h * 4);
    rgba[(cy * w + cx) * 4 + 3] = 255;
    const field = signedSquaredDistanceField(rgba, w, h);
    const range = rangeFor({ grow: 2 });
    const out32 = new Uint32Array(w * h);
    writeRange(field, out32, range.lo, range.hi);
    const expectedAlpha = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) expectedAlpha[i] = out32[i] & 0xff;

    assert.deepEqual(Array.from(gotAlpha), Array.from(expectedAlpha));
    // Sanity: grow(2) must have actually grown something beyond the seed.
    assert.ok(gotAlpha.some((v, i) => v === 255 && i !== cy * w + cx), 'grow(2) painted nothing beyond the seed pixel');
});

test('applyMaskAlpha: invert flips the whole alpha plane', async () => {
    const w = 6, h = 6;
    const frame = await solidPng(w, h, { r: 5, g: 5, b: 5 });
    const mask = await maskPng(w, h, (x) => x < 3);

    const normal = await gifCutout.applyMaskAlpha({ frameBuffer: frame, maskBuffer: mask });
    const inverted = await gifCutout.applyMaskAlpha({ frameBuffer: frame, maskBuffer: mask, invert: true });
    const { alpha: a1 } = await alphaPlane(normal);
    const { alpha: a2 } = await alphaPlane(inverted);
    for (let i = 0; i < a1.length; i++) {
        assert.equal(a2[i], 255 - a1[i], `pixel ${i} did not invert`);
    }
});

test('resolveMaskBufferInput: accepts a data: URL and rejects a bad value', async () => {
    const buf = await solidPng(2, 2, { r: 1, g: 2, b: 3 });
    const roundTrip = await gifCutout.resolveMaskBufferInput(toDataUrl(buf));
    assert.ok(roundTrip.equals(buf));
    await assert.rejects(() => gifCutout.resolveMaskBufferInput('not-a-url'));
});

/** ffprobe's own frame count — independent of anything `encodeFramesToSourceVideo` counted itself. */
async function probeFrameCount(videoPath) {
    const { stdout } = await execFileP(ffprobePath, [
        '-v', 'error', '-count_frames', '-select_streams', 'v:0',
        '-show_entries', 'stream=nb_read_frames,width,height',
        '-of', 'default=noprint_wrappers=1', videoPath,
    ]);
    const out = {};
    for (const line of stdout.trim().split('\n')) {
        const [k, v] = line.split('=');
        out[k] = v;
    }
    return { frames: Number(out.nb_read_frames), width: Number(out.width), height: Number(out.height) };
}

/** Raw RGB pixel at (x,y) of ffmpeg-decoded frame `page` (0-based) of a video. */
async function videoPixelAt(videoPath, page, x, y, w, h) {
    const { execFile: ef } = require('node:child_process');
    const efp = promisify(ef);
    const { ffmpegPath } = require('../services/ffmpegBinary');
    const { stdout } = await efp(ffmpegPath, [
        '-i', videoPath, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-',
    ], { encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 });
    const frameBytes = w * h * 3;
    const frameBuf = stdout.subarray(page * frameBytes, (page + 1) * frameBytes);
    const idx = (y * w + x) * 3;
    return { r: frameBuf[idx], g: frameBuf[idx + 1], b: frameBuf[idx + 2] };
}

test('encodeFramesToSourceVideo: exact frame count, odd dims preserved, transparency flattened', async () => {
    const { mediaDir } = await tmpProject();
    const w = 101, h = 77; // deliberately odd — no even-dimension codec requirement allowed
    const outDir = path.join(mediaDir, '.gif-cutout-tmp');

    // Frame 0: opaque red. Frame 1: RGBA where a region is BRIGHT GREEN hidden
    // behind alpha 0 — proves flatten() actually ran, not just that some
    // background color happens to show. Frame 2: opaque blue.
    const f0 = await solidPng(w, h, { r: 220, g: 10, b: 10 });
    // RGB stays 10/220/10 (bright green) even though alpha is 0 — sharp's
    // create() does not premultiply/zero it (verified directly), so this is
    // a real "hidden colour behind full transparency" source frame.
    const hiddenGreen = await sharp({ create: { width: w, height: h, channels: 4, background: { r: 10, g: 220, b: 10, alpha: 0 } } })
        .png().toBuffer();
    const f2 = await solidPng(w, h, { r: 10, g: 10, b: 220 });

    const { hash: h0 } = await gifFrames.writeFrame(mediaDir, f0);
    const { hash: h1 } = await gifFrames.writeFrame(mediaDir, hiddenGreen);
    const { hash: h2 } = await gifFrames.writeFrame(mediaDir, f2);

    const result = await gifCutout.encodeFramesToSourceVideo({
        mediaDir,
        frames: [{ hash: h0, delay: 10 }, { hash: h1, delay: 10 }, { hash: h2, delay: 10 }],
        outDir,
    });

    assert.equal(result.frameCount, 3);
    assert.equal(result.width, w);
    assert.equal(result.height, h);
    assert.ok(fs.existsSync(result.videoPath), 'encoded video must exist on disk');
    assert.ok(path.dirname(result.videoPath).endsWith('.gif-cutout-tmp'));

    const probed = await probeFrameCount(result.videoPath);
    assert.equal(probed.frames, 3, 'ffprobe must independently count exactly 3 frames');
    assert.equal(probed.width, w, 'ffprobe must see the ORIGINAL odd width, no silent even-rounding');
    assert.equal(probed.height, h);

    // Frame 1's hidden green must NOT leak into the encode — flatten() must
    // have overwritten it with SOURCE_BACKGROUND (black). If flatten() were
    // removed, ffmpeg's PNG decode ignores alpha and this pixel would come
    // back green.
    const px1 = await videoPixelAt(result.videoPath, 1, 10, 10, w, h);
    assert.ok(px1.g < 20 && px1.r < 20 && px1.b < 20, `hidden colour leaked into the source video: ${JSON.stringify(px1)}`);
});

test('POST /gif-cutout/source: rejects a missing frames array', async () => {
    const { root } = await tmpProject();
    try {
        const app = express();
        app.use(express.json());
        app.use(gifCutout);
        const server = await new Promise((r) => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
        try {
            const res = await fetch(`http://127.0.0.1:${server.address().port}/gif-cutout/source`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ folderPath: root }),
            });
            assert.equal(res.status, 400);
        } finally {
            await new Promise((r) => server.close(r));
        }
    } finally {
        await fs.remove(root);
    }
});

function buildApp() {
    const app = express();
    app.use(express.json({ limit: '25mb' }));
    app.use(gifCutout);
    return app;
}

function startServer(app) {
    return new Promise((r) => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
}

test('POST /gif-cutout/apply: frame store gains only the cut frames', async () => {
    const { root, mediaDir } = await tmpProject();
    try {
        // Two distinct original frames, already in the content-addressed store.
        const orig0 = await solidPng(6, 6, { r: 250, g: 0, b: 0 });
        const orig1 = await solidPng(6, 6, { r: 0, g: 250, b: 0 });
        const { hash: hash0 } = await gifFrames.writeFrame(mediaDir, orig0);
        const { hash: hash1 } = await gifFrames.writeFrame(mediaDir, orig1);

        const mask0 = await maskPng(6, 6, (x) => x < 3);
        const mask1 = await maskPng(6, 6, () => true);

        const before = (await fs.readdir(gifFrames.framesDir(mediaDir))).filter(f => f.endsWith('.png') && !f.includes('.thumb.'));
        assert.equal(before.length, 2, 'seed: exactly the two original frames on disk');

        const app = buildApp();
        const server = await startServer(app);
        try {
            const res = await fetch(`http://127.0.0.1:${server.address().port}/gif-cutout/apply`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    folderPath: root,
                    frames: [{ hash: hash0, delay: 10 }, { hash: hash1, delay: 20 }],
                    loop: 0,
                    masks: [toDataUrl(mask0), toDataUrl(mask1)],
                    invert: false,
                }),
            }).then((r) => r.json());

            assert.equal(res.success, true, `apply failed: ${res.error}`);
            assert.equal(res.item.gif.frames.length, 2);
            assert.deepEqual(res.item.gif.frames.map((f) => f.delay), [10, 20]);
            assert.deepEqual(res.item.pixelDimensions, { w: 6, h: 6 }, 'never {w:0,h:0}, which lists as ?×?');

            const newHashes = res.item.gif.frames.map((f) => f.hash);
            // The cut frames carry alpha now — content differs from the opaque
            // originals, so their hashes must be NEW, not a collision with them.
            for (const h of newHashes) assert.ok(!([hash0, hash1].includes(h)), 'cut frame reused an original hash');

            const after = (await fs.readdir(gifFrames.framesDir(mediaDir))).filter(f => f.endsWith('.png') && !f.includes('.thumb.'));
            assert.equal(after.length, 4, `store must hold exactly the 2 originals + 2 cut frames, got ${after.length}`);

            // The first cut frame's alpha matches mask0 (left half kept).
            const cutFrame0Path = gifFrames.frameAbsPath(mediaDir, newHashes[0]);
            const { alpha } = await alphaPlane(await fs.readFile(cutFrame0Path));
            assert.equal(alpha[0], 255, 'left half should be kept (opaque)');
            assert.equal(alpha[5], 0, 'right half should be cut (transparent)');
        } finally {
            await new Promise((r) => server.close(r));
        }
    } finally {
        await fs.remove(root);
    }
});

test('POST /gif-cutout/apply: rejects a masks/frames length mismatch', async () => {
    const { root, mediaDir } = await tmpProject();
    try {
        const { hash } = await gifFrames.writeFrame(mediaDir, await solidPng(4, 4, { r: 1, g: 1, b: 1 }));
        const app = buildApp();
        const server = await startServer(app);
        try {
            const res = await fetch(`http://127.0.0.1:${server.address().port}/gif-cutout/apply`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ folderPath: root, frames: [{ hash, delay: 10 }], masks: [] }),
            });
            assert.equal(res.status, 400);
        } finally {
            await new Promise((r) => server.close(r));
        }
    } finally {
        await fs.remove(root);
    }
});
