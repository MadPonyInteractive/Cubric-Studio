'use strict';

/**
 * gif-maker.test.cjs — MPI-760.
 *
 * Guards `routes/gifMaker.js` (POST /gif/maker): a video item's clip, sliced
 * to a trim window and resampled to a chosen fps, becomes one GIF card whose
 * frames are the clip's FULL resolution (only the built `.gif` is resized to
 * the size preset).
 *
 * The source clip is four 0.5s solid-colour segments back to back (red,
 * green, blue, yellow) so "frames come from inside the trim window" can be
 * checked by CONTENT, not just count: a 0.5s-1.5s trim must show only green
 * and blue, never the red/yellow segments outside it.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs-extra');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const execFileP = promisify(execFile);
const { ffmpegPath } = require('../services/ffmpegBinary');
const sharp = require('sharp');
const gifFrames = require('../services/gifFrames');

const CLIP_W = 640;
const CLIP_H = 360; // 16:9 landscape — width is the longest edge

async function tmpProject(prefix = 'gif-maker-test-') {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
    const mediaDir = path.join(root, 'Media');
    await fs.ensureDir(path.join(mediaDir, '.meta'));
    await fs.writeJson(path.join(root, 'project.json'), { id: 'p', itemGroups: [], sequenceCounters: {} });
    return { root, mediaDir };
}

/**
 * A 2s, 640x360 clip: four 0.5s solid-colour segments (red, green, blue,
 * yellow) concatenated — "visibly different content over time" per the card's
 * Verify wording, and specifically chosen so a 0.5-1.5s trim covers exactly
 * the middle two (green, blue) with a full segment of margin on each side of
 * the cut, tolerant of ffmpeg's keyframe-accurate (not frame-accurate) seek.
 */
async function makeQuadColourClip(outPath) {
    const colours = ['red', 'green', 'blue', 'yellow'];
    const args = ['-y'];
    for (const c of colours) {
        args.push('-f', 'lavfi', '-i', `color=c=${c}:s=${CLIP_W}x${CLIP_H}:d=0.5:r=30`);
    }
    args.push(
        '-filter_complex', '[0:v][1:v][2:v][3:v]concat=n=4:v=1:a=0[v]',
        '-map', '[v]', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-g', '5',
        outPath,
    );
    await execFileP(ffmpegPath, args, { windowsHide: true });
}

/** A short solid-colour clip at an arbitrary size — used where only the
 * BUILT .gif's final dimensions matter, not frame content. */
async function makeSolidClip(outPath, w, h, durationSec = 1) {
    await execFileP(ffmpegPath, [
        '-y', '-f', 'lavfi', '-i', `color=c=gray:s=${w}x${h}:d=${durationSec}:r=10`,
        '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
        outPath,
    ], { windowsHide: true });
}

async function sha256(p) {
    return crypto.createHash('sha256').update(await fs.readFile(p)).digest('hex');
}

/** Dominant channel of the centre pixel — enough to tell red/green/blue/yellow apart. */
async function dominantColour(pngPath) {
    const { data } = await sharp(pngPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const { width, height, channels } = await sharp(pngPath).metadata().then(m => ({ width: m.width, height: m.height, channels: 4 }));
    const idx = (Math.floor(height / 2) * width + Math.floor(width / 2)) * channels;
    const [r, g, b] = [data[idx], data[idx + 1], data[idx + 2]];
    // ffmpeg's named colours are the CSS/web set — "green" is the dim
    // (0,128,0), not full-brightness lime — so the green test is a relative
    // dominance check, not an absolute magnitude threshold like the others.
    if (r > 150 && g > 150 && b < 100) return 'yellow';
    if (r > 150 && g < 100 && b < 100) return 'red';
    if (g > 80 && r < 80 && b < 80) return 'green';
    if (b > 150 && r < 100 && g < 100) return 'blue';
    return `unknown(${r},${g},${b})`;
}

function buildApp() {
    const express = require('express');
    const app = express();
    app.use(express.json());
    app.use(require('../routes/gifMaker.js'));
    return app;
}

async function startServer(app) {
    return new Promise(r => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
}

const url = (p) => `/project-file?path=${encodeURIComponent(p)}`;

test('GIF Maker: fps + trim -> full-res frames from inside the trim window, built .gif at the size preset', async () => {
    const { root, mediaDir } = await tmpProject();
    const metaDir = path.join(mediaDir, '.meta');

    const clipPath = path.join(mediaDir, 'source_clip.mp4');
    await makeQuadColourClip(clipPath);
    const clipHashBefore = await sha256(clipPath);

    // A sidecar for the source video item, exactly as a real video card would
    // have one — used only to prove GIF Maker never touches it.
    const sourceId = '11111111-0000-0000-0000-000000000001';
    const sourceSidecarPath = path.join(metaDir, `${sourceId}.json`);
    await fs.writeJson(sourceSidecarPath, {
        id: sourceId, type: 'video', filePath: url(clipPath),
        pixelDimensions: { w: CLIP_W, h: CLIP_H }, duration: 2,
    });
    const sourceSidecarBefore = await fs.readFile(sourceSidecarPath, 'utf8');

    const app = buildApp();
    const server = await startServer(app);
    try {
        const res = await fetch(`http://127.0.0.1:${server.address().port}/gif/maker`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                folderPath: root,
                sourcePath: url(clipPath),
                fps: 10,
                sizePreset: '320xauto',
                loop: 0,
                trimIn: 0.5,
                trimOut: 1.5,
            }),
        }).then(r => r.json());

        assert.equal(res.success, true, `gif/maker failed: ${res.error}`);
        const item = res.item;
        assert.equal(item.type, 'image');
        assert.ok(item.gif, 'item must carry a gif field');

        // ── 10 fps over a 1.0s trim -> 10 frames, every delay 10 ────────────
        assert.equal(item.gif.frames.length, 10, `expected 10 frames, got ${item.gif.frames.length}`);
        assert.deepEqual(item.gif.frames.map(f => f.delay), new Array(10).fill(10), '10 fps -> delay 10 (hundredths) on every frame');
        assert.equal(item.gif.loop, 0);

        // ── Frames stay FULL resolution (the clip's own 640x360) ─────────────
        for (const f of item.gif.frames) {
            const framePath = gifFrames.frameAbsPath(mediaDir, f.hash);
            const meta = await sharp(framePath).metadata();
            assert.equal(meta.width, CLIP_W, 'stored frame must be the clip\'s full width');
            assert.equal(meta.height, CLIP_H, 'stored frame must be the clip\'s full height');
        }

        // ── Frames come from INSIDE the trim window (content, not just count) ─
        // 0.5-1.0s is green, 1.0-1.5s is blue; red (0-0.5) and yellow (1.5-2.0)
        // must never appear.
        const colours = [];
        for (const f of item.gif.frames) {
            colours.push(await dominantColour(gifFrames.frameAbsPath(mediaDir, f.hash)));
        }
        assert.ok(colours.every(c => c === 'green' || c === 'blue'), `trim leaked outside content: ${JSON.stringify(colours)}`);
        assert.ok(colours.includes('green'), `expected a green frame from 0.5-1.0s, got ${JSON.stringify(colours)}`);
        assert.ok(colours.includes('blue'), `expected a blue frame from 1.0-1.5s, got ${JSON.stringify(colours)}`);

        // ── Built .gif is resized to the preset's longest edge (320) ─────────
        const builtAbsPath = new URL(item.filePath, 'http://localhost').searchParams.get('path');
        const builtMeta = await sharp(builtAbsPath).metadata();
        assert.equal(Math.max(builtMeta.width, builtMeta.height), 320, `built .gif longest edge should be the 320xauto preset, got ${builtMeta.width}x${builtMeta.height}`);
        assert.equal(item.pixelDimensions.w, builtMeta.width);
        assert.equal(item.pixelDimensions.h, builtMeta.height);

        // ── A new sidecar exists on disk, matching the response ──────────────
        const onDisk = await fs.readJson(path.join(metaDir, `${item.id}.json`));
        assert.deepEqual(onDisk.gif.frames.map(f => f.hash), item.gif.frames.map(f => f.hash));

        // ── The source video item is untouched ────────────────────────────────
        assert.equal(await sha256(clipPath), clipHashBefore, 'source video file bytes must be unchanged');
        assert.equal(await fs.readFile(sourceSidecarPath, 'utf8'), sourceSidecarBefore, 'source video sidecar must be unchanged');
    } finally {
        await new Promise(r => server.close(r));
        await fs.remove(root);
    }
});

test('GIF Maker: NxAuto/autoxN presets fix the NAMED axis, not just the longest edge', async () => {
    const { root, mediaDir } = await tmpProject();

    // Portrait clip: '320xauto' must fix WIDTH to 320, regardless of width
    // being the SHORTER edge — a naive longest-edge-box maxEdge=320 would
    // instead cap the (longer) height and leave width narrower than 320.
    const portraitPath = path.join(mediaDir, 'portrait.mp4');
    await makeSolidClip(portraitPath, 360, 640);

    // Landscape clip: 'autox320' must fix HEIGHT to 320, regardless of
    // height being the SHORTER edge.
    const landscapePath = path.join(mediaDir, 'landscape.mp4');
    await makeSolidClip(landscapePath, 640, 360);

    const app = buildApp();
    const server = await startServer(app);
    try {
        const post = (body) => fetch(`http://127.0.0.1:${server.address().port}/gif/maker`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        }).then(r => r.json());

        const portraitRes = await post({ folderPath: root, sourcePath: url(portraitPath), fps: 5, sizePreset: '320xauto' });
        assert.equal(portraitRes.success, true, `portrait gif/maker failed: ${portraitRes.error}`);
        const portraitAbs = new URL(portraitRes.item.filePath, 'http://localhost').searchParams.get('path');
        const portraitMeta = await sharp(portraitAbs).metadata();
        assert.ok(Math.abs(portraitMeta.width - 320) <= 1, `320xauto on a portrait clip must give WIDTH ~320, got ${portraitMeta.width}x${portraitMeta.height}`);
        assert.ok(portraitMeta.height > portraitMeta.width, `portrait aspect must be preserved (height > width), got ${portraitMeta.width}x${portraitMeta.height}`);

        const landscapeRes = await post({ folderPath: root, sourcePath: url(landscapePath), fps: 5, sizePreset: 'autox320' });
        assert.equal(landscapeRes.success, true, `landscape gif/maker failed: ${landscapeRes.error}`);
        const landscapeAbs = new URL(landscapeRes.item.filePath, 'http://localhost').searchParams.get('path');
        const landscapeMeta = await sharp(landscapeAbs).metadata();
        assert.ok(Math.abs(landscapeMeta.height - 320) <= 1, `autox320 on a landscape clip must give HEIGHT ~320, got ${landscapeMeta.width}x${landscapeMeta.height}`);
        assert.ok(landscapeMeta.width > landscapeMeta.height, `landscape aspect must be preserved (width > height), got ${landscapeMeta.width}x${landscapeMeta.height}`);
    } finally {
        await new Promise(r => server.close(r));
        await fs.remove(root);
    }
});

test('GIF Maker rejects an fps outside 1-60 rather than silently clamping it', async () => {
    const { root, mediaDir } = await tmpProject();
    const clipPath = path.join(mediaDir, 'source_clip.mp4');
    await makeQuadColourClip(clipPath);

    const app = buildApp();
    const server = await startServer(app);
    try {
        const res = await fetch(`http://127.0.0.1:${server.address().port}/gif/maker`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ folderPath: root, sourcePath: url(clipPath), fps: 500 }),
        });
        assert.equal(res.status, 400);
        const data = await res.json();
        assert.equal(data.success, false);
    } finally {
        await new Promise(r => server.close(r));
        await fs.remove(root);
    }
});

test('GIF Maker rejects a missing source file', async () => {
    const { root, mediaDir } = await tmpProject();

    const app = buildApp();
    const server = await startServer(app);
    try {
        const res = await fetch(`http://127.0.0.1:${server.address().port}/gif/maker`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ folderPath: root, sourcePath: url(path.join(mediaDir, 'nope.mp4')), fps: 10 }),
        });
        assert.equal(res.status, 404);
    } finally {
        await new Promise(r => server.close(r));
        await fs.remove(root);
    }
});
