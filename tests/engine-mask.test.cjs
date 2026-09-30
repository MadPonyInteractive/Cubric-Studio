'use strict';

// MPI-971 Phase 2 — a masked op on a photo over the engine cap. The canvas hands over the
// mask at its painted size; a crop-and-stitch op gets the source cut round the mask (the
// graph only ever samples inside its context window), and the result is pasted back into
// the original through the grown, feathered mask. Any other masked op gets the mask at the
// source's size. The cap is shrunk here so the fixtures stay small; the maths is the same.

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('fs-extra');
const path = require('node:path');
const os = require('node:os');
const sharp = require('sharp');

const { prepareMaskedInput, stitchMaskCrop, planMaskCrop, CONTEXT_PAD } = require('../services/engineMask.js');

sharp.cache({ files: 0 });

const noise = (width, height) => sharp({
    create: { width, height, channels: 3, background: '#808080', noise: { type: 'gaussian', mean: 128, sigma: 60 } },
});

/** White-on-black PNG data URL, `w` x `h`, lit inside `box` (inclusive). */
async function maskUrl(w, h, box) {
    const data = Buffer.alloc(w * h);
    for (let y = box.y0; y <= box.y1; y++) data.fill(255, y * w + box.x0, y * w + box.x1 + 1);
    const png = await sharp(data, { raw: { width: w, height: h, channels: 1 } }).png().toBuffer();
    return `data:image/png;base64,${png.toString('base64')}`;
}

const pixels = async (input) => sharp(input).removeAlpha().toColourspace('srgb').raw().toBuffer({ resolveWithObject: true });

async function tmp() {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mpi971p2-'));
    return { dir, outPath: (name) => path.join(dir, name) };
}

/** Pretend to be the engine: paint the crop's masked pixels red, leave the rest alone. */
async function fakeEngine(cropPath, maskPath, outPath) {
    const { width, height } = await sharp(cropPath).metadata();
    const red = await sharp({ create: { width, height, channels: 3, background: '#ff0000' } })
        .joinChannel(await sharp(maskPath).toColourspace('b-w').raw().toBuffer(), { raw: { width, height, channels: 1 } })
        .png().toBuffer();
    await sharp(cropPath).composite([{ input: red }]).png().toFile(outPath);
}

test('the cut is a square round the mask, slid inside the photo, scaled to the cap', () => {
    // A 100x50 box in the middle of a 1000x800 photo, mask drawn at half size.
    let r = planMaskCrop({ box: { x0: 225, y0: 175, x1: 274, y1: 199 }, maskW: 500, maskH: 400, srcW: 1000, srcH: 800, cap: 4096 });
    // Box in source px: x 450..550, y 350..400; side 100 + 2 * 128 = 356, centred on it.
    assert.deepEqual(r, { left: 322, top: 197, width: 100 + 2 * CONTEXT_PAD, height: 100 + 2 * CONTEXT_PAD, outW: 356, outH: 356 });
    // At the corner it slides in rather than hanging off.
    r = planMaskCrop({ box: { x0: 0, y0: 0, x1: 9, y1: 9 }, maskW: 500, maskH: 400, srcW: 1000, srcH: 800, cap: 4096 });
    assert.equal(r.left, 0);
    assert.equal(r.top, 0);
    // A mask spanning the frame clamps to the photo and scales to the cap.
    r = planMaskCrop({ box: { x0: 0, y0: 0, x1: 499, y1: 399 }, maskW: 500, maskH: 400, srcW: 1000, srcH: 800, cap: 500 });
    assert.deepEqual(r, { left: 0, top: 0, width: 1000, height: 800, outW: 500, outH: 400 });
});

test('a photo within the cap is left alone', async () => {
    const { dir, outPath } = await tmp();
    try {
        const src = outPath('src.png');
        await noise(400, 300).png().toFile(src);
        const out = await prepareMaskedInput({ imagePath: src, mask: await maskUrl(400, 300, { x0: 10, y0: 10, x1: 50, y1: 50 }), crop: true, cap: 400, outPath });
        assert.deepEqual(out, {});
    } finally { await fs.remove(dir); }
});

test('a non-crop op gets the mask at the source size', async () => {
    const { dir, outPath } = await tmp();
    try {
        const src = outPath('src.png');
        await noise(1000, 600).png().toFile(src);
        const out = await prepareMaskedInput({ imagePath: src, mask: await maskUrl(500, 300, { x0: 100, y0: 100, x1: 200, y1: 150 }), crop: false, cap: 512, outPath });
        assert.equal(out.image, undefined);
        const meta = await sharp(out.mask).metadata();
        assert.deepEqual([meta.width, meta.height], [1000, 600]);
    } finally { await fs.remove(dir); }
});

for (const [label, box, cap] of [
    ['a small mask: cut at 1:1', { x0: 100, y0: 60, x1: 160, y1: 110 }, 512],
    ['a mask too big for the cap: cut scaled down', { x0: 150, y0: 60, x1: 300, y1: 200 }, 256],
]) {
    test(`crop and stitch, ${label}`, async () => {
        const { dir, outPath } = await tmp();
        try {
            const src = outPath('src.png');
            await noise(1000, 600).png().toFile(src);
            const prep = await prepareMaskedInput({ imagePath: src, mask: await maskUrl(500, 300, box), crop: true, cap, outPath });
            const { rect } = prep.stitch;
            const [cm, mm] = await Promise.all([sharp(prep.image).metadata(), sharp(prep.mask).metadata()]);
            assert.deepEqual([cm.width, cm.height], [rect.outW, rect.outH], 'the engine gets outW x outH');
            assert.deepEqual([mm.width, mm.height], [cm.width, cm.height], 'mask == image, or InpaintCropImproved asserts');
            assert.ok(Math.max(cm.width, cm.height) <= cap);
            assert.equal(rect.outW < rect.width, label.includes('scaled'), 'the case runs the path it names');

            const orig = await pixels(src);
            if (rect.outW === rect.width) {
                // 1:1: the cut is the source's own pixels.
                const cut = await pixels(prep.image);
                for (let y = 0; y < rect.height; y += 7) {
                    for (let x = 0; x < rect.width; x += 7) {
                        const a = (y * rect.width + x) * 3;
                        const b = ((rect.top + y) * 1000 + rect.left + x) * 3;
                        assert.equal(cut.data[a], orig.data[b]);
                    }
                }
            }

            const result = outPath('result.png');
            await fakeEngine(prep.image, prep.mask, result);
            const stitched = outPath('stitched.png');
            assert.deepEqual(await stitchMaskCrop({ sourcePath: src, resultPath: result, maskPath: prep.mask, rect, outPath: stitched }), { width: 1000, height: 600 });
            const out = await pixels(stitched);
            assert.deepEqual([out.info.width, out.info.height], [1000, 600], 'the card is the source size');

            // Inside the mask (source px = 2x mask px): the edit. Far outside: the original, exactly.
            const reach = Math.ceil(80 * rect.width / rect.outW);
            let inside = 0, outside = 0;
            for (let y = 0; y < 600; y += 3) {
                for (let x = 0; x < 1000; x += 3) {
                    const i = (y * 1000 + x) * 3;
                    const mx = x / 2, my = y / 2;
                    const inMask = mx > box.x0 + 2 && mx < box.x1 - 2 && my > box.y0 + 2 && my < box.y1 - 2;
                    const dx = Math.max(box.x0 * 2 - x, x - box.x1 * 2, 0);
                    const dy = Math.max(box.y0 * 2 - y, y - box.y1 * 2, 0);
                    if (inMask) {
                        inside++;
                        assert.ok(out.data[i] > 200 && out.data[i + 1] < 60, `(${x},${y}) should be the edit`);
                    } else if (Math.max(dx, dy) > reach) {
                        outside++;
                        for (let c = 0; c < 3; c++) assert.equal(out.data[i + c], orig.data[i + c], `(${x},${y}) must be the original`);
                    }
                }
            }
            assert.ok(inside > 100);
            assert.ok(outside > 100, 'the far-outside probe must run');
        } finally { await fs.remove(dir); }
    });
}

test('an EXIF-rotated photo is cut in upright px', async () => {
    const { dir, outPath } = await tmp();
    try {
        // Stored 1000x600, orientation 6: the canvas (and MpiLoadImage) see 600x1000.
        const src = outPath('src.jpg');
        await noise(1000, 600).withMetadata({ orientation: 6 }).jpeg().toFile(src);
        const box = { x0: 100, y0: 300, x1: 150, y1: 350 };
        const prep = await prepareMaskedInput({ imagePath: src, mask: await maskUrl(300, 500, box), crop: true, cap: 512, outPath });
        assert.ok(prep.stitch.rect.top + prep.stitch.rect.height <= 1000);
        assert.ok(prep.stitch.rect.left + prep.stitch.rect.width <= 600);
        const result = outPath('result.png');
        await fakeEngine(prep.image, prep.mask, result);
        const stitched = outPath('stitched.png');
        await stitchMaskCrop({ sourcePath: src, resultPath: result, maskPath: prep.mask, rect: prep.stitch.rect, outPath: stitched });
        const out = await pixels(stitched);
        assert.deepEqual([out.info.width, out.info.height], [600, 1000]);
        const i = (650 * 600 + 250) * 3; // the box's centre, in upright source px
        assert.ok(out.data[i] > 200 && out.data[i + 1] < 60, 'the edit lands where it was painted');
    } finally { await fs.remove(dir); }
});
