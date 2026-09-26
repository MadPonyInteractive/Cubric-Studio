'use strict';
// MPI-943 — a very large photo is shrunk on import to the megapixels the user picked.
// Checks the three things that would silently go wrong: the pixel budget, a portrait
// phone photo (EXIF orientation 6) coming out sideways, and a format the app cannot
// display being passed through instead of converted.
const test = require('node:test');
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const sharp = require('sharp');
const { imageSize, reduceImage } = require('../routes/imageImport');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mpi-import-reduce-'));
const MP = 1024 * 1024;

const make = (name, w, h, fmt) => {
    const file = path.join(tmp, name);
    return sharp({ create: { width: w, height: h, channels: 3, background: '#808080' } })
        .toFormat(fmt).toFile(file).then(() => file);
};

test('reduces to the pixel budget, keeping the aspect ratio and the format', async () => {
    const src = await make('wide.jpg', 6000, 3000, 'jpeg');
    const out = await reduceImage(src, 2 * MP);
    assert.ok(out.w * out.h <= 2 * MP * 1.001, `${out.w}x${out.h} over budget`);
    assert.ok(out.w * out.h > 2 * MP * 0.99, `${out.w}x${out.h} well under budget`);
    assert.strictEqual(Math.round(out.w / out.h), 2);
    assert.strictEqual(path.extname(out.path), '.jpg');
    const meta = await sharp(out.path).metadata();
    assert.deepStrictEqual([meta.width, meta.height], [out.w, out.h]);
    assert.notStrictEqual(out.path, src);
});

test('an EXIF-rotated portrait comes out upright', async () => {
    // Stored landscape 4000x3000 with a white TOP half; orientation 6 displays it as a
    // 3000x4000 portrait whose RIGHT half is white. Dimensions alone cannot tell a
    // rotated result from a squashed one, so read the pixels.
    const src = path.join(tmp, 'portrait.jpg');
    const white = await sharp({ create: { width: 4000, height: 1500, channels: 3, background: '#fff' } }).png().toBuffer();
    await sharp({ create: { width: 4000, height: 3000, channels: 3, background: '#000' } })
        .composite([{ input: white, top: 0, left: 0 }])
        .withMetadata({ orientation: 6 }).jpeg().toFile(src);
    assert.deepStrictEqual(await imageSize(src), { w: 3000, h: 4000 });
    const out = await reduceImage(src, 1 * MP);
    assert.ok(out.h > out.w, `${out.w}x${out.h} is not portrait`);
    const { data, info } = await sharp(out.path).raw().toBuffer({ resolveWithObject: true });
    const lum = (x, y) => data[(y * info.width + x) * info.channels];
    const midY = Math.floor(info.height / 2);
    assert.ok(lum(info.width - 5, midY) > 200, 'right edge should be white');
    assert.ok(lum(5, midY) < 50, 'left edge should be black');
});

test('a TIFF lands as PNG; an image already under budget is left alone', async () => {
    const tif = await make('scan.tif', 3000, 3000, 'tiff');
    assert.strictEqual(path.extname((await reduceImage(tif, 1 * MP)).path), '.png');
    const small = await make('small.png', 800, 600, 'png');
    assert.deepStrictEqual(await reduceImage(small, 2 * MP), { path: small, w: 800, h: 600 });
});

test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
