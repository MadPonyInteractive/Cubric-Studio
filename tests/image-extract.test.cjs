// MPI-1072. Extract keeps ONLY the masked area of an image: the mask becomes the
// alpha, everything outside it is removed — transparent, or flattened onto a
// colour. Asserted on PIXELS: a reversed mask, a dropped alpha join or a
// transparent pixel turning opaque all look plausible on screen.

const assert = require('node:assert');
const test = require('node:test');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const sharp = require('sharp');

const { extractThroughMask } = require('../services/imageComposite');

const W = 100;
const H = 100;

/** Mask with the RIGHT half white (keep) and the left half black (remove). */
async function rightHalfMask() {
    const white = await sharp({ create: { width: W / 2, height: H, channels: 3, background: { r: 255, g: 255, b: 255 } } }).png().toBuffer();
    return sharp({ create: { width: W, height: H, channels: 3, background: { r: 0, g: 0, b: 0 } } })
        .composite([{ input: white, left: W / 2, top: 0 }])
        .png()
        .toBuffer();
}

async function rgba(file, x, y) {
    const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const i = (y * info.width + x) * info.channels;
    return [data[i], data[i + 1], data[i + 2], data[i + 3]];
}

function tmp(t) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mpi-extract-'));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    return dir;
}

test('extract keeps the masked area and makes the rest transparent', async (t) => {
    const dir = tmp(t);
    // A JPEG source: no alpha of its own, and the output must still be a PNG with one.
    const basePath = path.join(dir, 'base.jpg');
    await sharp({ create: { width: W, height: H, channels: 3, background: { r: 255, g: 0, b: 0 } } }).jpeg({ quality: 100 }).toFile(basePath);

    const out = path.join(dir, 'out.png');
    const dims = await extractThroughMask({ basePath, maskBuffer: await rightHalfMask(), outPath: out });
    assert.deepStrictEqual(dims, { width: W, height: H });

    const kept = await rgba(out, 90, 50);
    assert.ok(kept[0] > 240 && kept[3] === 255, `inside the mask stays opaque red, got ${kept}`);
    assert.deepStrictEqual(await rgba(out, 10, 50), [0, 0, 0, 0], 'outside the mask is removed, RGB included');
});

test('extract onto a colour fills the removed area with it', async (t) => {
    const dir = tmp(t);
    const basePath = path.join(dir, 'base.png');
    await sharp({ create: { width: W, height: H, channels: 3, background: { r: 255, g: 0, b: 0 } } }).png().toFile(basePath);

    const out = path.join(dir, 'out.png');
    await extractThroughMask({ basePath, maskBuffer: await rightHalfMask(), outPath: out, background: '#00ff00' });

    assert.deepStrictEqual((await rgba(out, 10, 50)).slice(0, 3), [0, 255, 0], 'outside the mask is the background colour');
    assert.deepStrictEqual((await rgba(out, 90, 50)).slice(0, 3), [255, 0, 0], 'inside the mask keeps the image');
    assert.strictEqual((await sharp(out).metadata()).hasAlpha, false, 'a coloured extract is opaque');
});

test("the image's own alpha is the ceiling: a transparent pixel the mask keeps stays transparent", async (t) => {
    const dir = tmp(t);
    // Already cut: fully transparent everywhere.
    const basePath = path.join(dir, 'base.png');
    await sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 255, alpha: 0 } } }).png().toFile(basePath);

    const out = path.join(dir, 'out.png');
    await extractThroughMask({ basePath, maskBuffer: await rightHalfMask(), outPath: out });
    assert.strictEqual((await rgba(out, 90, 50))[3], 0, 'mask white must not turn a transparent pixel opaque');
});

test('a greyscale source extracts as RGBA', async (t) => {
    const dir = tmp(t);
    const basePath = path.join(dir, 'grey.png');
    await sharp({ create: { width: W, height: H, channels: 3, background: { r: 128, g: 128, b: 128 } } }).greyscale().toColourspace('b-w').png().toFile(basePath);

    const out = path.join(dir, 'out.png');
    await extractThroughMask({ basePath, maskBuffer: await rightHalfMask(), outPath: out });
    assert.deepStrictEqual(await rgba(out, 90, 50), [128, 128, 128, 255]);
    assert.deepStrictEqual(await rgba(out, 10, 50), [0, 0, 0, 0]);
});
