'use strict';

/**
 * services/cardView.js — a video becomes ONE contact sheet of frames spread across the clip,
 * with their times. Real ffmpeg on a clip made here: the sheet's size is the proof the tile
 * filled, and its colours the proof the frames came from across the clip, not one frame
 * repeated.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const sharp = require('sharp');
const { ffmpegPath } = require('../services/ffmpegBinary');
const { viewFile } = require('../services/cardView');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'card-view-'));
const clip = path.join(dir, 'clip.mp4');

test.before(() => {
    // 1.86 s at 64x48, 24 fps: red, green, then blue thirds. An uneven length like a real
    // clip's: a sampler by TIME dropped the last frame of one and left a black cell. The noise
    // keeps the sheet over 32 KB: ffmpeg's webp muxer patches its header by seeking back, which
    // a pipe allows only inside its 32 KB buffer, so flat colour hid a sheet that did not decode.
    const colour = (c) => ['-f', 'lavfi', '-i', `color=c=${c}:s=64x48:d=0.62:r=24`];
    execFileSync(ffmpegPath, ['-v', 'error', ...colour('red'), ...colour('lime'), ...colour('blue'),
        '-filter_complex', '[0][1][2]concat=n=3:v=1,noise=alls=30:allf=t', '-pix_fmt', 'yuv420p', clip], { windowsHide: true });
});

test.after(() => fs.rmSync(dir, { recursive: true, force: true }));

test('a clip becomes one sheet of evenly spread frames, with their times', async () => {
    const v = await viewFile(clip, { frames: 6 });
    assert.equal(v.kind, 'video');
    // The middle of each sixth: rising, the first inside the first sixth, the last in the last.
    assert.equal(v.times.length, 6);
    assert.ok(v.times.every((t, i) => i === 0 || t > v.times[i - 1]));
    assert.ok(v.times[0] < v.duration / 6 && v.times[5] > (v.duration * 5) / 6, `${v.times} over ${v.duration}s`);
    assert.equal(v.columns, 3);
    assert.equal(v.hasAudio, false);

    const { width, height } = await sharp(v.data).metadata();
    assert.equal(width, 3 * 512 + 2 * 4, '3 cells of 512 and the padding between them');
    assert.equal(height, 2 * 384 + 4, '2 rows: every cell filled');

    // Cell i's centre colour: frames 0-1 red, 2-3 green, 4-5 blue.
    const px = async (i) => {
        const x = (i % 3) * 516 + 256;
        const y = Math.floor(i / 3) * 388 + 192;
        const { data } = await sharp(v.data).extract({ left: x, top: y, width: 1, height: 1 }).raw().toBuffer({ resolveWithObject: true });
        return ['r', 'g', 'b'][data.indexOf(Math.max(data[0], data[1], data[2]))];
    };
    assert.deepEqual(await Promise.all([0, 1, 2, 3, 4, 5].map(px)), ['r', 'r', 'g', 'g', 'b', 'b']);
});

// MPI-1168 — the MCP options. Colour of a decoded frame: its dominant channel at the centre.
const hue = async (buf) => {
    const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
    const at = (Math.floor(info.height / 2) * info.width + Math.floor(info.width / 2)) * info.channels;
    const px = [data[at], data[at + 1], data[at + 2]];
    return ['r', 'g', 'b'][px.indexOf(Math.max(...px))];
};

test('scene: one frame per shot, from the middle of each, as separate pictures', async () => {
    const v = await viewFile(clip, { frames: 3, scene: true, separate: true });
    assert.equal(v.kind, 'video');
    assert.equal(v.frames.length, 3);
    assert.deepEqual(await Promise.all(v.frames.map((f) => hue(f.data))), ['r', 'g', 'b']);
    // The middle of each 0.62 s shot, give or take a frame.
    v.times.forEach((t, i) => assert.ok(Math.abs(t - (i * 0.62 + 0.31)) < 0.1, `${v.times}`));
    const { width, height } = await sharp(v.frames[0].data).metadata();
    assert.deepEqual([width, height], [64, 48], 'a small clip is never enlarged');
});

test('scene: a shot shorter than a slice is still seen, where even spacing walks past it', async () => {
    // 1 s red, a 3-frame blue flash, 1 s red: the six even slices land on frames 4..46, none on 24-26.
    const flash = path.join(dir, 'flash.mp4');
    const part = (c, d) => ['-f', 'lavfi', '-i', `color=c=${c}:s=64x48:d=${d}:r=24`];
    execFileSync(ffmpegPath, ['-v', 'error', ...part('red', 1), ...part('blue', 0.125), ...part('red', 1),
        '-filter_complex', '[0][1][2]concat=n=3:v=1,noise=alls=30:allf=t', '-pix_fmt', 'yuv420p', flash], { windowsHide: true });
    const even = await viewFile(flash, { frames: 6, separate: true });
    assert.ok(!(await Promise.all(even.frames.map((f) => hue(f.data)))).includes('b'), `even ${even.times}`);
    const v = await viewFile(flash, { frames: 6, scene: true, separate: true });
    assert.equal(v.frames.length, 6);
    assert.ok((await Promise.all(v.frames.map((f) => hue(f.data)))).includes('b'), `scene ${v.times}`);
});

test('scene: a still clip comes back as one picture, not six copies of it', async () => {
    const still = path.join(dir, 'still.mp4');
    execFileSync(ffmpegPath, ['-v', 'error', '-f', 'lavfi', '-i', 'color=c=gray:s=64x48:d=1:r=24', '-pix_fmt', 'yuv420p', still], { windowsHide: true });
    const v = await viewFile(still, { frames: 6, scene: true, separate: true });
    assert.equal(v.frames.length, 1);
});

test('scene: one long take with no cuts falls back to frames spread through it', async () => {
    // A slow pan across a test pattern: every frame differs from far ones, none is a cut.
    const pan = path.join(dir, 'pan.mp4');
    execFileSync(ffmpegPath, ['-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=s=640x48:d=2:r=24', '-vf', "crop=64:48:'t*100':0",
        '-pix_fmt', 'yuv420p', pan], { windowsHide: true });
    const v = await viewFile(pan, { frames: 6, scene: true, separate: true });
    assert.equal(v.frames.length, 6, `${v.times}`);
    assert.ok(v.times[0] < 0.4 && v.times[5] > 1.6, `spread across the take: ${v.times}`);
});

test('from/to narrow the clip and keep its own times', async () => {
    const v = await viewFile(clip, { frames: 4, from: 0.7, to: 1.2 });
    assert.equal(v.times.length, 4);
    assert.ok(v.times.every((t) => t >= 0.7 && t < 1.2), `${v.times}`);
    const s = await viewFile(clip, { frames: 6, from: 0.7, to: 1.2, scene: true, separate: true });
    const hues = await Promise.all(s.frames.map((f) => hue(f.data)));
    assert.ok(hues.length > 0 && hues.every((h) => h === 'g'), `inside the green shot only: ${hues}`);
    await assert.rejects(viewFile(clip, { from: 5, to: 6 }), /no frames between/);
});

test('a still comes back no bigger than the view size, never upscaled', async () => {
    const big = path.join(dir, 'big.png');
    const small = path.join(dir, 'small.png');
    await sharp({ create: { width: 3000, height: 1500, channels: 3, background: '#808080' } }).png().toFile(big);
    await sharp({ create: { width: 300, height: 200, channels: 3, background: '#808080' } }).png().toFile(small);
    assert.equal((await sharp((await viewFile(big)).data).metadata()).width, 1024);
    assert.equal((await sharp((await viewFile(small)).data).metadata()).width, 300);
});
