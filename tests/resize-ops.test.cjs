'use strict';

/**
 * MPI-1069 — Resize runs on sharp and ffmpeg, not on a ComfyUI graph.
 *
 * The planner's numbers are worked by hand from KJNodes `ImageResizeKJv2.resize` (the node
 * the graph ran), so a change to the maths shows up as a wrong size here, not as a picture
 * that is a few pixels off in the app. The renderers are checked on REAL pixels: a
 * four-colour quadrant image tells a flip from a rotation from a crop, which a flat image
 * cannot. The clips are generated with ffmpeg's own test source, so no fixture ships.
 */

const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const sharp = require('sharp');
const { scratchDir } = require('./helpers/scratch.cjs');
const { ffmpegPath } = require('../services/ffmpegBinary.js');
const { probeVideo } = require('../services/ffprobeVideo.js');
const { planResize, normalizeResizeParams, resizeImage, resizeVideoFile, pyRound } = require('../services/resizeOps.js');

const RED = { r: 255, g: 0, b: 0 };
const GREEN = { r: 0, g: 255, b: 0 };
const BLUE = { r: 0, g: 0, b: 255 };
const WHITE = { r: 255, g: 255, b: 255 };

test('pyRound is Python round(): half to even', () => {
    assert.deepEqual([0.5, 1.5, 2.5, 3.5, 2.4, 2.6].map(pyRound), [0, 2, 2, 4, 2, 3]);
});

test('crop: the target aspect is cut from the source, then scaled', () => {
    const p = planResize(1920, 1080, { width: 1024, height: 1024, keep_proportion: 'crop', divisible_by: 16 });
    assert.deepEqual(p.crop, { left: 420, top: 0, width: 1080, height: 1080 });
    assert.deepEqual([p.width, p.height, p.outW, p.outH, p.pad], [1024, 1024, 1024, 1024, null]);
    const right = planResize(1920, 1080, { width: 512, height: 512, keep_proportion: 'crop', crop_position: 'right' });
    assert.equal(right.crop.left, 840);
    const top = planResize(1080, 1920, { width: 512, height: 512, keep_proportion: 'crop', crop_position: 'top' });
    assert.deepEqual(top.crop, { left: 0, top: 0, width: 1080, height: 1080 });
});

test('pad: fit inside, pad to the target, round the PADDED frame up on right/bottom', () => {
    const even = planResize(1920, 1080, { width: 1024, height: 1024, keep_proportion: 'pad', divisible_by: 16 });
    assert.deepEqual([even.width, even.height], [1024, 576]);
    assert.deepEqual(even.pad, { left: 0, right: 0, top: 224, bottom: 224 });
    // 1000x700 -> 512x358 floors to 512x352; 352+77+77 = 506 is padded to 512 at the bottom.
    const odd = planResize(1000, 700, { width: 512, height: 512, keep_proportion: 'pad', divisible_by: 16 });
    assert.deepEqual([odd.width, odd.height], [512, 352]);
    assert.deepEqual(odd.pad, { left: 0, right: 0, top: 77, bottom: 83 });
    assert.deepEqual([odd.outW, odd.outH], [512, 512]);
    const bottom = planResize(1000, 1000, { width: 512, height: 256, keep_proportion: 'pad', crop_position: 'bottom', divisible_by: 1 });
    assert.deepEqual(bottom.pad, { left: 128, right: 128, top: 0, bottom: 0 });
    const fits = planResize(512, 512, { width: 512, height: 512, keep_proportion: 'pad' });
    assert.equal(fits.pad, null, 'nothing to pad is no pad');
});

test('resize / total_pixels / stretch keep the node\'s sizes', () => {
    const r = planResize(1000, 700, { width: 512, height: 512, keep_proportion: 'resize', divisible_by: 16 });
    assert.deepEqual([r.outW, r.outH, r.crop, r.pad], [512, 352, null, null]);
    const t = planResize(1000, 700, { width: 512, height: 512, keep_proportion: 'total_pixels', divisible_by: 1 });
    assert.deepEqual([t.outW, t.outH], [611, 428]);
    const s = planResize(1000, 700, { width: 300, height: 200, keep_proportion: 'stretch', divisible_by: 16 });
    assert.deepEqual([s.outW, s.outH], [288, 192]);
});

test('rotation 90/270 swaps the output; params from an old card normalise', () => {
    const p = planResize(1920, 1080, { width: 1024, height: 512, rotation: '90' });
    assert.deepEqual([p.outW, p.outH, p.rotation], [512, 1024, 90]);
    assert.equal('upscale_method' in normalizeResizeParams({ upscale_method: 'nearest' }), false, 'always Lanczos');
    assert.equal(normalizeResizeParams({ rotation: 'none', flip: 'sideways' }).rotation, 0);
    assert.equal(normalizeResizeParams({ flip: 'sideways' }).flip, 'none');
    assert.equal(planResize(100, 100, { width: 10, height: 10, divisible_by: 16 }).outW, 16, 'a size floored to nothing keeps one step');
});

/** 64x32: top-left red, top-right green, bottom-left blue, bottom-right white. */
async function quadrants(dir) {
    const file = path.join(dir, 'quad.png');
    const q = (c, left, top) => ({ input: { create: { width: 32, height: 16, channels: 3, background: c } }, left, top });
    await sharp({ create: { width: 64, height: 32, channels: 3, background: WHITE } })
        .composite([q(RED, 0, 0), q(GREEN, 32, 0), q(BLUE, 0, 16), q(WHITE, 32, 16)]).png().toFile(file);
    return file;
}

async function pixels(image) {
    const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
    const at = (x, y) => {
        const i = (y * info.width + x) * info.channels;
        return { r: data[i], g: data[i + 1], b: data[i + 2] };
    };
    return { w: info.width, h: info.height, at };
}

const near = (a, b, tol = 2) => ['r', 'g', 'b'].every(k => Math.abs(a[k] - b[k]) <= tol);
const NEAREST = { divisible_by: 1 };   // no rescale in these cases, so no resampling blur

test('image: stretch, flip and rotate land the quadrants where the old graph put them', async () => {
    const quad = await quadrants(await scratchDir('resize-img-'));
    const run = async (params) => pixels((await resizeImage(quad, { ...NEAREST, width: 64, height: 32, keep_proportion: 'stretch', ...params })).image);

    const plain = await run({});
    assert.ok(near(plain.at(0, 0), RED) && near(plain.at(63, 31), WHITE));

    const flipY = await run({ flip: 'y' });           // left-right
    assert.ok(near(flipY.at(0, 0), GREEN), 'flip y mirrors left-right');
    const flipX = await run({ flip: 'x' });           // top-bottom
    assert.ok(near(flipX.at(0, 0), BLUE), 'flip x mirrors top-bottom');

    const cw = await run({ rotation: '90' });         // clockwise: old bottom-left is the new top-left
    assert.deepEqual([cw.w, cw.h], [32, 64]);
    assert.ok(near(cw.at(0, 0), BLUE) && near(cw.at(31, 0), RED), 'rotation 90 turns clockwise');

    const both = await run({ flip: 'y', rotation: '90' }); // flip FIRST, then turn
    assert.ok(near(both.at(0, 0), WHITE) && near(both.at(31, 0), GREEN));
});

test('image: crop position and the four pad modes', async () => {
    const quad = await quadrants(await scratchDir('resize-pad-'));
    const run = async (params) => pixels((await resizeImage(quad, { ...NEAREST, ...params })).image);

    const left = await run({ width: 32, height: 32, keep_proportion: 'crop', crop_position: 'left' });
    assert.ok(near(left.at(0, 0), RED) && near(left.at(31, 31), BLUE), 'left keeps the red/blue half');

    const box = { width: 64, height: 64, crop_position: 'center' };   // 64x32 fits as 64x32, 16 px top and bottom
    const color = await run({ ...box, keep_proportion: 'pad', pad_color: GREEN });
    assert.deepEqual([color.w, color.h], [64, 64]);
    assert.ok(near(color.at(0, 0), GREEN) && near(color.at(0, 16), RED) && near(color.at(0, 63), GREEN));

    const copy = await run({ ...box, keep_proportion: 'pad_edge_pixel' });
    assert.ok(near(copy.at(0, 0), RED) && near(copy.at(63, 0), GREEN) && near(copy.at(0, 63), BLUE), 'edge pixels repeat');

    const mean = await run({ ...box, keep_proportion: 'pad_edge' });
    assert.ok(near(mean.at(10, 5), { r: 128, g: 128, b: 0 }, 3), 'top band is the top row\'s mean (red+green)');
    assert.ok(near(mean.at(10, 60), { r: 128, g: 128, b: 255 }, 3), 'bottom band is the bottom row\'s mean (blue+white)');

    const pillar = await run({ ...box, keep_proportion: 'pillarbox_blur' });
    assert.deepEqual([pillar.w, pillar.h], [64, 64]);
    const band = pillar.at(32, 2);
    assert.ok(band.r + band.g + band.b < 0.4 * 3 * 255, 'the band is the dimmed, blurred picture');
    assert.ok(near(pillar.at(0, 16), RED), 'the picture sits on top, untouched');
});

test('image: a transparent PNG keeps its alpha', async () => {
    const dir = await scratchDir('resize-alpha-');
    const file = path.join(dir, 'alpha.png');
    await sharp({ create: { width: 40, height: 40, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 0 } } }).png().toFile(file);
    const { data, info } = await (await resizeImage(file, { width: 20, height: 20, keep_proportion: 'stretch', divisible_by: 1 })).image
        .raw().toBuffer({ resolveWithObject: true });
    assert.equal(info.channels, 4);
    assert.equal(data[3], 0);
});

/** A 2 s 320x240 clip with a sine track. */
function clip(dir) {
    const file = path.join(dir, 'src.mp4');
    execFileSync(ffmpegPath, ['-y', '-loglevel', 'error',
        '-f', 'lavfi', '-i', 'testsrc2=s=320x240:r=24:d=2', '-f', 'lavfi', '-i', 'sine=d=2',
        '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', file], { windowsHide: true });
    return file;
}

test('video: streams through ffmpeg - size, audio and trim', async () => {
    const dir = await scratchDir('resize-vid-');
    const src = clip(dir);

    const out = path.join(dir, 'crop.mp4');
    const dims = await resizeVideoFile(src, out, { width: 160, height: 160, keep_proportion: 'crop', divisible_by: 16 });
    const meta = await probeVideo(out);
    assert.deepEqual([dims.width, dims.height, meta.width, meta.height, meta.hasAudio], [160, 160, 160, 160, true]);

    const trimmed = path.join(dir, 'trim.mp4');
    await resizeVideoFile(src, trimmed, { width: 160, height: 120, keep_proportion: 'stretch' }, { trimIn: 0.5, trimOut: 1.5 });
    const t = await probeVideo(trimmed);
    assert.ok(Math.abs(t.duration - 1) < 0.15, `trimmed to ~1 s, got ${t.duration}`);

    const turned = path.join(dir, 'turn.mp4');
    await resizeVideoFile(src, turned, { width: 320, height: 160, keep_proportion: 'pad', divisible_by: 16, rotation: '270', flip: 'y' });
    const r = await probeVideo(turned);
    assert.deepEqual([r.width, r.height], [160, 320]);

    const odd = path.join(dir, 'odd.mp4');
    const oddDims = await resizeVideoFile(src, odd, { width: 161, height: 121, keep_proportion: 'stretch', divisible_by: 1 });
    const o = await probeVideo(odd);
    assert.deepEqual([oddDims.width, oddDims.height, o.width, o.height], [160, 120, 160, 120], 'yuv420p needs even sides');
});

test('video: every pad mode renders, and the bands match the still renderer', async () => {
    const dir = await scratchDir('resize-vpad-');
    const src = clip(dir);
    const frame0 = path.join(dir, 'frame0.png');
    execFileSync(ffmpegPath, ['-y', '-loglevel', 'error', '-i', src, '-frames:v', '1', frame0], { windowsHide: true });

    for (const keep_proportion of ['pad', 'pad_edge', 'pad_edge_pixel', 'pillarbox_blur']) {
        const params = { width: 320, height: 320, keep_proportion, divisible_by: 16, pad_color: GREEN };
        const out = path.join(dir, `${keep_proportion}.mp4`);
        await resizeVideoFile(src, out, params);
        const meta = await probeVideo(out);
        assert.deepEqual([meta.width, meta.height], [320, 320], keep_proportion);

        const first = path.join(dir, `${keep_proportion}.png`);
        execFileSync(ffmpegPath, ['-y', '-loglevel', 'error', '-i', out, '-frames:v', '1', first], { windowsHide: true });
        const video = await pixels(sharp(first));
        const still = await pixels((await resizeImage(frame0, params)).image);
        // A band ROW's mean colour, not one pixel: testsrc2's bars meet at x=160, and on a
        // bar edge 4:2:0 chroma interpolates differently per conversion path.
        const rowMean = (img, y) => {
            const sum = { r: 0, g: 0, b: 0 };
            for (let x = 0; x < img.w; x++) for (const k of ['r', 'g', 'b']) sum[k] += img.at(x, y)[k];
            return { r: sum.r / img.w, g: sum.g / img.w, b: sum.b / img.w };
        };
        for (const y of [20, 300]) {
            const v = rowMean(video, y);
            const s = rowMean(still, y);
            assert.ok(near(v, s, 8), `${keep_proportion} band row ${y}: video ${JSON.stringify(v)} vs still ${JSON.stringify(s)}`);
        }
    }
});
