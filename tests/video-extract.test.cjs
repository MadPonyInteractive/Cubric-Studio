'use strict';

/**
 * video-extract.test.cjs — MPI-1073: the video workspace's Extract, non-GPU half.
 *
 * Guards `routes/videoExtract.js`: the tracker source keeps one frame per frame of the
 * trim, masks pair with frames by INDEX, Transparent writes real VP9 alpha (and zeroes
 * the hidden RGB), Colour fills outside the mask. The SAM3 track itself is
 * `runGifCutoutTrack`, already covered by the GIF cut-out; nothing here touches ComfyUI.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs-extra');
const path = require('node:path');
const sharp = require('sharp');
const express = require('express');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { scratchDir } = require('./helpers/scratch.cjs');
const { ffmpegPath } = require('../services/ffmpegBinary');
const { probeVideo } = require('../services/ffprobeVideo');
const videoExtract = require('../routes/videoExtract.js');

const execFileP = promisify(execFile);
const W = 64, H = 48;

/** 10 frames of opaque grey at 10 fps, 1 s of sine audio. */
async function makeClip(dir) {
    const p = path.join(dir, 'src.mp4');
    await execFileP(ffmpegPath, ['-y',
        '-f', 'lavfi', '-i', `color=c=0x808080:s=${W}x${H}:r=10:d=1`,
        '-f', 'lavfi', '-i', 'sine=frequency=440:duration=1',
        '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', p], { windowsHide: true });
    return p;
}

/** Half-frame mask at the TRACKER's size (smaller than the source): white on `side`. */
async function halfMask(side) {
    const w = 32, h = 24;
    const px = Buffer.alloc(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        px[y * w + x] = (side === 'left' ? x < w / 2 : x >= w / 2) ? 255 : 0;
    }
    return sharp(px, { raw: { width: w, height: h, channels: 1 } }).png().toBuffer();
}

/** RGBA of decoded frame `n`; libvpx-vp9 as the DECODER, the native one drops alpha. */
async function frameRgba(file, n, vp9) {
    const args = ['-v', 'error'];
    if (vp9) args.push('-c:v', 'libvpx-vp9');
    args.push('-i', file, '-vf', `select=eq(n\\,${n})`, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-');
    const { stdout } = await execFileP(ffmpegPath, args, { encoding: 'buffer', maxBuffer: 1 << 24, windowsHide: true });
    return (x, y) => [...stdout.subarray((y * W + x) * 4, (y * W + x) * 4 + 4)];
}

async function writeMasks(dir, sides) {
    await fs.ensureDir(dir);
    for (let i = 0; i < sides.length; i++) {
        await fs.writeFile(path.join(dir, `m_${String(i).padStart(5, '0')}.png`), await halfMask(sides[i]));
    }
}

test('tracker source: trimmed range, one frame per frame, long edge capped', async () => {
    const dir = await scratchDir('video-extract-src-');
    const src = await makeClip(dir);
    const out = await videoExtract.encodeTrackSource({
        inputPath: src, trimIn: 0.3, trimOut: 0.8, outPath: path.join(dir, 'track.mp4'),
    });
    assert.equal(out.frameCount, 5);
    assert.equal(out.width, W);
});

test('transparent: masks pair by index, alpha is real, hidden RGB is zeroed', async () => {
    const dir = await scratchDir('video-extract-alpha-');
    const src = await makeClip(dir);
    const maskDir = path.join(dir, 'masks');
    // Alternating sides: a mask landing on its neighbour's frame shows up at once.
    await writeMasks(maskDir, Array.from({ length: 10 }, (_, i) => (i % 2 ? 'right' : 'left')));
    const outPath = path.join(dir, 'out.webm');
    await videoExtract.extractThroughMaskSequence({
        inputPath: src, maskDir, width: W, height: H, fps: '10/1', hasAudio: true, background: null, outPath,
    });
    const meta = await probeVideo(outPath);
    assert.equal(meta.frameCount || Math.round(meta.duration * 10), 10);
    assert.ok(meta.hasAudio, 'source audio kept');

    for (const n of [0, 3, 8]) {
        const px = await frameRgba(outPath, n, true);
        const kept = n % 2 ? [56, 24] : [8, 24];
        const cut  = n % 2 ? [8, 24] : [56, 24];
        assert.ok(px(...kept)[3] > 240, `frame ${n}: kept side opaque`);
        assert.ok(px(...cut)[3] < 15, `frame ${n}: cut side transparent`);
        assert.ok(Math.abs(px(...kept)[0] - 128) < 12, `frame ${n}: kept RGB is the source`);
    }
    // An alpha-blind decoder (the poster, the proxy) must not see the background.
    const flat = await frameRgba(outPath, 0, false);
    assert.ok(flat(56, 24)[0] < 20, 'hidden RGB zeroed');
});

test('colour: everything outside the mask is the picked colour', async () => {
    const dir = await scratchDir('video-extract-colour-');
    const src = await makeClip(dir);
    const maskDir = path.join(dir, 'masks');
    await writeMasks(maskDir, Array(10).fill('left'));
    const outPath = path.join(dir, 'out.mp4');
    await videoExtract.extractThroughMaskSequence({
        inputPath: src, maskDir, width: W, height: H, fps: '10/1', hasAudio: true, background: '#00ff00', outPath,
    });
    const px = await frameRgba(outPath, 4, false);
    const [r, g, b] = px(56, 24);
    assert.ok(g > 200 && r < 60 && b < 60, `cut side is green, got ${[r, g, b]}`);
    assert.ok(Math.abs(px(8, 24)[1] - 128) < 15, 'kept side is the source');
});

test('a transparent WebM source stays cut: its alpha is the ceiling', async () => {
    const dir = await scratchDir('video-extract-chain-');
    const src = await makeClip(dir);
    const leftDir = path.join(dir, 'left');
    await writeMasks(leftDir, Array(10).fill('left'));
    const first = path.join(dir, 'first.webm');
    await videoExtract.extractThroughMaskSequence({
        inputPath: src, maskDir: leftDir, width: W, height: H, fps: '10/1', hasAudio: true, background: null, outPath: first,
    });
    // Everything kept, onto green: the half cut the first time must turn green, not black.
    const allDir = path.join(dir, 'all');
    await fs.ensureDir(allDir);
    const white = await sharp({ create: { width: 32, height: 24, channels: 3, background: { r: 255, g: 255, b: 255 } } }).png().toBuffer();
    for (let i = 0; i < 10; i++) await fs.writeFile(path.join(allDir, `m_${String(i).padStart(5, '0')}.png`), white);
    const second = path.join(dir, 'second.mp4');
    await videoExtract.extractThroughMaskSequence({
        inputPath: first, maskDir: allDir, width: W, height: H, fps: '10/1', hasAudio: true, background: '#00ff00', outPath: second, codec: 'vp9',
    });
    const px = await frameRgba(second, 4, false);
    const [r, g, b] = px(56, 24);
    assert.ok(g > 200 && r < 60 && b < 60, `previously cut side is green, got ${[r, g, b]}`);
    assert.ok(Math.abs(px(8, 24)[1] - 128) < 15, 'kept side is the source');
});

test('POST /video-extract/apply lands a webm entry with a sidecar', async () => {
    const root = await scratchDir('video-extract-route-');
    const mediaDir = path.join(root, 'Media');
    await fs.ensureDir(path.join(mediaDir, '.meta'));
    await fs.writeJson(path.join(root, 'project.json'), { id: 'p', itemGroups: [], sequenceCounters: {} });
    const src = await makeClip(mediaDir);
    const mask = `data:image/png;base64,${(await halfMask('left')).toString('base64')}`;

    const app = express();
    app.use(express.json({ limit: '50mb' }));
    app.use(videoExtract);
    const server = app.listen(0);
    try {
        const res = await fetch(`http://127.0.0.1:${server.address().port}/video-extract/apply`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ folderPath: root, sourcePath: src, trimIn: 0.2, trimOut: 0.7, masks: Array(5).fill(mask), background: null }),
        });
        const data = await res.json();
        assert.equal(data.success, true, data.error);
        assert.equal(data.item.operation, 'extract');
        assert.match(decodeURIComponent(data.item.filePath), /videoExtract_\d+\.webm/);
        assert.equal(data.item.frameCount || Math.round(data.item.duration * 10), 5);
        assert.ok(await fs.pathExists(path.join(mediaDir, '.meta', `${data.item.id}.json`)));
        // The temp mask sequence is gone.
        const tmp = path.join(mediaDir, '.video-extract-tmp');
        assert.deepEqual((await fs.readdir(tmp)).filter(n => n.startsWith('masks_')), []);
    } finally {
        server.close();
    }
});

test('ProRes 4444 for an editor keeps a transparent source cut, and its audio', async () => {
    const dir = await scratchDir('video-extract-prores-');
    const src = await makeClip(dir);
    const maskDir = path.join(dir, 'masks');
    await writeMasks(maskDir, Array(10).fill('left'));
    const cut = path.join(dir, 'cut.webm');
    await videoExtract.extractThroughMaskSequence({
        inputPath: src, maskDir, width: W, height: H, fps: '10/1', hasAudio: true, background: null, outPath: cut,
    });
    const outPath = path.join(dir, 'out.mov');
    await videoExtract.encodeProres({ inputPath: cut, codec: 'vp9', hasAudio: true, outPath });
    const meta = await probeVideo(outPath);
    assert.equal(meta.codecName, 'prores');
    assert.ok(meta.hasAudio, 'audio kept');
    const px = await frameRgba(outPath, 4, false);
    assert.ok(px(8, 24)[3] > 240, 'kept side opaque');
    assert.ok(px(56, 24)[3] < 15, 'cut side transparent');
});
