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

test('a still comes back no bigger than the view size, never upscaled', async () => {
    const big = path.join(dir, 'big.png');
    const small = path.join(dir, 'small.png');
    await sharp({ create: { width: 3000, height: 1500, channels: 3, background: '#808080' } }).png().toFile(big);
    await sharp({ create: { width: 300, height: 200, channels: 3, background: '#808080' } }).png().toFile(small);
    assert.equal((await sharp((await viewFile(big)).data).metadata()).width, 1024);
    assert.equal((await sharp((await viewFile(small)).data).metadata()).width, 300);
});
