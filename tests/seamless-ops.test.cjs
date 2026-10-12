'use strict';

/**
 * seamless-ops.test.cjs — unit tests for services/seamlessOps.js (MPI-1101 A1).
 *
 * Covers:
 *  - roll then unroll is byte-identical (odd and even sizes)
 *  - band math matches [n//2 - hi*n, n//2 + lo*n) for asymmetric handles and handle = 0
 *  - windows cover the full band, none > 4096, target ~1024 along the seam
 *  - paste changes ZERO pixels outside the band
 *  - a 16384x8192 synthetic completes
 *  - lighting flatten at 0 is a no-op; at >0 reduces a synthetic left-to-right gradient
 */

const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('node:fs/promises');
const path   = require('node:path');
const os     = require('node:os');

// sharp resolved relative to the repo root so the test runs from any cwd.
const ROOT  = path.join(__dirname, '..');
const sharp = require(path.join(ROOT, 'node_modules', 'sharp'));
sharp.cache({ files: 0 });

const {
    bandRange, planAxis, rollImage, lightenFlatten, makeMaskBuffer,
    prepare, windowCut, paste, finish,
} = require(path.join(ROOT, 'services', 'seamlessOps'));

// ── helpers ───────────────────────────────────────────────────────────────────

/** Write a solid-colour PNG of size w×h to a temp file. */
async function solidPng(tmpDir, name, w, h, r, g, b) {
    const p = path.join(tmpDir, name);
    await sharp({
        create: { width: w, height: h, channels: 3, background: { r, g, b } },
    }).png().toFile(p);
    return p;
}

/** Write an x-gradient PNG (left dark, right bright). */
async function gradientPng(tmpDir, name, w, h) {
    const buf = Buffer.allocUnsafe(w * h * 3);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const v = Math.round((x / (w - 1)) * 255);
            const base = (y * w + x) * 3;
            buf[base] = v; buf[base + 1] = v; buf[base + 2] = v;
        }
    }
    const p = path.join(tmpDir, name);
    await sharp(buf, { raw: { width: w, height: h, channels: 3 }, limitInputPixels: false })
        .png().toFile(p);
    return p;
}

/** Read all raw pixels of a PNG as a Buffer (RGB, 3 ch). */
async function readPixels(filePath, w, h) {
    const { data } = await sharp(filePath, { limitInputPixels: false })
        .flatten({ background: '#000000' })
        .raw()
        .toBuffer({ resolveWithObject: true });
    return data;
}

// ── Band math ─────────────────────────────────────────────────────────────────

test('bandRange: handle pair at 0 returns null', () => {
    assert.equal(bandRange(1024, 0, 0), null);
});

test('bandRange: symmetric 10% handles', () => {
    const n = 1000;
    const r = bandRange(n, 0.1, 0.1);
    // c = 500; start = 500 - round(0.1*1000) = 400; end = 500 + 100 = 600
    assert.equal(r.start, 400);
    assert.equal(r.end,   600);
});

test('bandRange: asymmetric handles match formula', () => {
    const n = 2048;
    const lo = 0.15, hi = 0.25;
    const c = Math.floor(n / 2);  // 1024
    const r = bandRange(n, lo, hi);
    assert.equal(r.start, Math.max(0, c - Math.round(hi * n)));  // 1024 - 512 = 512
    assert.equal(r.end,   Math.min(n, c + Math.round(lo * n)));  // 1024 + 307 = 1331
});

test('bandRange: one handle at 0 (right-only band)', () => {
    // lo=0 (left=0%), hi=0.2 (right=20%): left half of the seam only
    const n = 1024;
    const r = bandRange(n, 0, 0.2);
    assert.equal(r.start, 512 - Math.round(0.2 * 1024));  // 512 - 205 = 307
    assert.equal(r.end,   512);                            // 512 + 0   = 512
});

test('bandRange: clamped to image bounds', () => {
    // Very large handles should not exceed [0, n)
    const r = bandRange(100, 0.5, 0.5);
    assert.ok(r.start >= 0);
    assert.ok(r.end <= 100);
});

// ── Window plan ───────────────────────────────────────────────────────────────

test('planAxis: null band returns empty array', () => {
    assert.deepEqual(planAxis(1024, 1024, null, 'x'), []);
    assert.deepEqual(planAxis(1024, 1024, null, 'y'), []);
});

test('planAxis x-band: windows cover full band, none > 4096', () => {
    const w = 4096, h = 8192;
    const band = { start: 1638, end: 2458 };  // ~20% handles, 820 px wide
    const wins = planAxis(w, h, band, 'x');

    assert.ok(wins.length > 0, 'at least one window');

    for (const { rect } of wins) {
        assert.ok(rect.width  <= 4096, `width ${rect.width} <= 4096`);
        assert.ok(rect.height <= 4096, `height ${rect.height} <= 4096`);
        assert.ok(rect.left  >= band.start, 'window left >= band.start');
        assert.ok(rect.left + rect.width <= band.end, 'window right <= band.end');
        assert.equal(rect.axis, undefined); // axis is on the outer object
    }

    // Every y position in [0, h) must be covered by at least one window.
    const covered = new Uint8Array(h);
    for (const { rect } of wins) {
        for (let y = rect.top; y < rect.top + rect.height; y++) covered[y] = 1;
    }
    for (let y = 0; y < h; y++) assert.equal(covered[y], 1, `y=${y} not covered`);
});

test('planAxis y-band: windows cover full band, none > 4096', () => {
    const w = 8192, h = 4096;
    const band = { start: 1434, end: 2662 };  // ~20% handles
    const wins = planAxis(w, h, band, 'y');

    for (const { rect } of wins) {
        assert.ok(rect.width  <= 4096, `width ${rect.width} <= 4096`);
        assert.ok(rect.height <= 4096, `height ${rect.height} <= 4096`);
        assert.ok(rect.top  >= band.start, 'window top >= band.start');
        assert.ok(rect.top + rect.height <= band.end, 'window bottom <= band.end');
    }

    const covered = new Uint8Array(w);
    for (const { rect } of wins) {
        for (let x = rect.left; x < rect.left + rect.width; x++) covered[x] = 1;
    }
    for (let x = 0; x < w; x++) assert.equal(covered[x], 1, `x=${x} not covered`);
});

test('planAxis x-band: target ~1024 window height along seam', () => {
    // For a 1024-height seam, expect at most ceil(1024/1024) = 1 window per x-column.
    const w = 2048, h = 1024;
    const band = { start: 800, end: 1200 };
    const wins = planAxis(w, h, band, 'x');
    for (const { rect } of wins) {
        assert.ok(rect.height <= 1024 + 1, `height ${rect.height} close to 1024`);
    }
});

test('planAxis: wide x-band (>4096) splits into multiple x-columns', () => {
    // Band width 6000 should produce 2 x-columns
    const w = 16384, h = 1024;
    const band = { start: 5000, end: 11000 };  // 6000 wide
    const wins = planAxis(w, h, band, 'x');

    // All x positions within band must be covered.
    const covered = new Uint8Array(w);
    for (const { rect } of wins) {
        for (let x = rect.left; x < rect.left + rect.width; x++) covered[x] = 1;
    }
    for (let x = band.start; x < band.end; x++) assert.equal(covered[x], 1, `x=${x} not covered`);
    // Positions outside band should not be covered.
    for (let x = 0; x < band.start; x++) assert.equal(covered[x], 0, `x=${x} should not be covered`);
    for (let x = band.end; x < w; x++)   assert.equal(covered[x], 0, `x=${x} should not be covered`);
});

// ── Roll / unroll ─────────────────────────────────────────────────────────────

test('rollImage: even dimensions — roll then unroll is byte-identical', async (t) => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'seamless-test-'));
    t.after(() => fs.rm(tmpDir, { recursive: true, force: true }));

    const w = 64, h = 64;
    // Unique pixel values (x+y gradient, not symmetric so a roll cannot produce the same image).
    const buf = Buffer.allocUnsafe(w * h * 3);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const base = (y * w + x) * 3;
            buf[base]     = (x * 4) & 0xff;
            buf[base + 1] = (y * 3) & 0xff;
            buf[base + 2] = ((x + y) * 2) & 0xff;
        }
    }
    const srcPath    = path.join(tmpDir, 'src.png');
    const rolledPath = path.join(tmpDir, 'rolled.png');
    const backPath   = path.join(tmpDir, 'back.png');
    await sharp(buf, { raw: { width: w, height: h, channels: 3 }, limitInputPixels: false })
        .png().toFile(srcPath);

    const dx = Math.floor(w / 2), dy = Math.floor(h / 2);
    await rollImage(srcPath, dx, dy, rolledPath);
    await rollImage(rolledPath, w - dx, h - dy, backPath);

    const orig = await readPixels(srcPath, w, h);
    const back = await readPixels(backPath, w, h);
    assert.deepEqual(orig, back, 'pixel buffers must be byte-identical after roll+unroll');
});

test('rollImage: odd dimensions — roll then unroll is byte-identical', async (t) => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'seamless-test-'));
    t.after(() => fs.rm(tmpDir, { recursive: true, force: true }));

    const w = 63, h = 65;
    const buf = Buffer.allocUnsafe(w * h * 3);
    for (let i = 0; i < buf.length; i++) buf[i] = (i * 7 + 13) & 0xff;
    const srcPath    = path.join(tmpDir, 'src.png');
    const rolledPath = path.join(tmpDir, 'rolled.png');
    const backPath   = path.join(tmpDir, 'back.png');
    await sharp(buf, { raw: { width: w, height: h, channels: 3 }, limitInputPixels: false })
        .png().toFile(srcPath);

    const dx = Math.floor(w / 2), dy = Math.floor(h / 2);
    await rollImage(srcPath, dx, dy, rolledPath);
    await rollImage(rolledPath, w - dx, h - dy, backPath);

    const orig = await readPixels(srcPath, w, h);
    const back = await readPixels(backPath, w, h);
    assert.deepEqual(orig, back, 'odd-dimension roll+unroll must be byte-identical');
});

test('rollImage: x-only roll (dy=0) is byte-identical after unroll', async (t) => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'seamless-test-'));
    t.after(() => fs.rm(tmpDir, { recursive: true, force: true }));

    const w = 100, h = 80;
    const buf = Buffer.from(Array.from({ length: w * h * 3 }, (_, i) => (i * 11) & 0xff));
    const srcPath    = path.join(tmpDir, 'src.png');
    const rolledPath = path.join(tmpDir, 'rolled.png');
    const backPath   = path.join(tmpDir, 'back.png');
    await sharp(buf, { raw: { width: w, height: h, channels: 3 }, limitInputPixels: false })
        .png().toFile(srcPath);

    const dx = Math.floor(w / 2);
    await rollImage(srcPath, dx, 0, rolledPath);
    await rollImage(rolledPath, w - dx, 0, backPath);

    const orig = await readPixels(srcPath, w, h);
    const back = await readPixels(backPath, w, h);
    assert.deepEqual(orig, back);
});

// ── Paste: pixels outside the band unchanged ──────────────────────────────────

test('paste: ZERO pixels outside the band are modified', async (t) => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'seamless-test-'));
    t.after(() => fs.rm(tmpDir, { recursive: true, force: true }));

    const w = 256, h = 128;
    // Source: solid grey (128, 128, 128)
    const srcPath = await solidPng(tmpDir, 'src.png', w, h, 128, 128, 128);

    // Prepare with left=20%, right=20% handles (x-axis only).
    const state = await prepare({
        sourcePath:     srcPath,
        handles:        { left: 20, right: 20, top: 0, bottom: 0 },
        lightingFlatten: 0,
    });

    // Solid grey rolled is still solid grey; band pixels are grey.
    const win0     = state.windows[0];
    const { rect } = win0;

    // Read working copy before paste.
    const workPath = path.join(os.tmpdir(), 'cubric-seamless', state.runId, 'working.png');
    const before   = await readPixels(workPath, w, h);

    // Create a solid WHITE result of the same size as the window.
    const whitePath = await solidPng(tmpDir, 'white.png', rect.width, rect.height, 255, 255, 255);
    await paste(state.runId, 0, whitePath);

    const after = await readPixels(workPath, w, h);

    // Count modified pixels outside the band.
    let outsideChanged = 0;
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const inBand = (x >= state.bandX.start && x < state.bandX.end);
            if (!inBand) {
                const idx = (y * w + x) * 3;
                if (before[idx] !== after[idx] || before[idx + 1] !== after[idx + 1] || before[idx + 2] !== after[idx + 2]) {
                    outsideChanged++;
                }
            }
        }
    }
    assert.equal(outsideChanged, 0, `${outsideChanged} pixels outside the band were changed`);
});

// ── Lighting flatten ──────────────────────────────────────────────────────────

test('lightenFlatten: amount=0 is a no-op (byte-identical output)', async (t) => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'seamless-test-'));
    t.after(() => fs.rm(tmpDir, { recursive: true, force: true }));

    const srcPath = await gradientPng(tmpDir, 'grad.png', 64, 64);
    const outPath = path.join(tmpDir, 'flat.png');
    await lightenFlatten(srcPath, 0, outPath);

    const orig = await readPixels(srcPath, 64, 64);
    const out  = await readPixels(outPath,  64, 64);
    assert.deepEqual(orig, out, 'amount=0 should produce a byte-identical copy');
});

test('lightenFlatten: amount>0 reduces left-to-right gradient variance', async (t) => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'seamless-test-'));
    t.after(() => fs.rm(tmpDir, { recursive: true, force: true }));

    const w = 128, h = 64;
    const srcPath = await gradientPng(tmpDir, 'grad.png', w, h);
    const outPath = path.join(tmpDir, 'flat.png');
    await lightenFlatten(srcPath, 0.8, outPath);

    const orig = await readPixels(srcPath, w, h);
    const out  = await readPixels(outPath,  w, h);

    // Measure standard deviation of column means (luminance along x).
    const colMeanOrig = new Float32Array(w);
    const colMeanOut  = new Float32Array(w);
    for (let x = 0; x < w; x++) {
        let sumO = 0, sumF = 0;
        for (let y = 0; y < h; y++) {
            const i = (y * w + x) * 3;
            sumO += (orig[i] + orig[i + 1] + orig[i + 2]) / 3;
            sumF += (out[i]  + out[i + 1]  + out[i + 2])  / 3;
        }
        colMeanOrig[x] = sumO / h;
        colMeanOut[x]  = sumF / h;
    }
    const stdDev = (arr) => {
        const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
        return Math.sqrt(arr.reduce((s, v) => s + (v - mean) ** 2, 0) / arr.length);
    };
    const origStd = stdDev(colMeanOrig);
    const outStd  = stdDev(colMeanOut);
    assert.ok(outStd < origStd,
        `flatten did not reduce gradient: std ${outStd.toFixed(2)} >= original ${origStd.toFixed(2)}`);
});

// ── Large synthetic (16384 × 8192) ───────────────────────────────────────────

test('16384x8192 synthetic: prepare + window + paste + finish completes', async (t) => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'seamless-test-'));
    t.after(() => fs.rm(tmpDir, { recursive: true, force: true }));

    const w = 16384, h = 8192;

    // Build a minimal synthetic: a tiny sharp create that sharp scales up on toFile.
    // We go small-to-large via resize so we don't allocate 384 MB in JS.
    const srcPath = path.join(tmpDir, 'big.png');
    await sharp({
        create: { width: 64, height: 32, channels: 3, background: { r: 80, g: 120, b: 160 } },
    }).resize(w, h, { fit: 'fill', kernel: 'nearest' }).png().toFile(srcPath);

    const state = await prepare({
        sourcePath:      srcPath,
        handles:         { left: 10, right: 10, top: 0, bottom: 0 },
        lightingFlatten: 0,
    });

    assert.equal(state.width,  w);
    assert.equal(state.height, h);
    assert.ok(state.bandX !== null, 'bandX expected');
    assert.ok(state.windows.length > 0, 'at least one window');

    // Process just the first window: cut → paste with the cut itself (identity).
    const win0 = state.windows[0];
    const { imagePath } = await windowCut(state.runId, 0);

    // Paste the cut back as the result (identity — changes nothing).
    await paste(state.runId, 0, imagePath);

    // Roll back.
    const outPath = path.join(tmpDir, 'out.png');
    await finish(state.runId, outPath);

    const meta = await sharp(outPath, { limitInputPixels: false }).metadata();
    assert.equal(meta.width,  w, 'output width matches source');
    assert.equal(meta.height, h, 'output height matches source');
}, { timeout: 300_000 });   // large image is slow; allow 5 min
