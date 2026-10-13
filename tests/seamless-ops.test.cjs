'use strict';

/**
 * seamless-ops.test.cjs — unit tests for services/seamlessOps.js (MPI-1101 A1).
 *
 * Covers:
 *  - roll then unroll is byte-identical (odd and even sizes)
 *  - band math matches [n//2 - hi*n, n//2 + lo*n) for asymmetric handles and handle = 0
 *  - window paint tiles the band once, each cut carries context and overlap, none > 4096, ~1024 along the seam
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
    bandRange, planAxis, rollImage, lightenFlatten, makeMaskBuffer, rampMaskBuffer,
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

// The contract (MPI-1101 Phase 4): the PAINT rects tile the band exactly once; each CUT shows the
// model picture either side of the band (a cut that was only the band came back a new picture with
// hard edges); each window after the first re-reads the one before; nothing is pasted outside the band.
function checkPlan(w, h, band, axis) {
    const wins = planAxis(w, h, band, axis);
    assert.ok(wins.length > 0, 'at least one window');
    const painted = new Uint8Array(w * h);
    const inBand = (x, y) => { const c = axis === 'x' ? x : y; return c >= band.start && c < band.end; };
    const inside = (r, s) => s.left >= r.left && s.top >= r.top
        && s.left + s.width <= r.left + r.width && s.top + s.height <= r.top + r.height;
    for (const [k, { rect, paint, band: b }] of wins.entries()) {
        assert.ok(Math.max(rect.width, rect.height) <= 4096, `cut ${rect.width}x${rect.height} <= 4096`);
        assert.ok(inside(rect, b) && inside(b, paint), 'paint inside band-part inside cut');
        const ctxLo = axis === 'x' ? b.left - rect.left : b.top - rect.top;
        const ctxHi = axis === 'x' ? (rect.left + rect.width) - (b.left + b.width) : (rect.top + rect.height) - (b.top + b.height);
        if (b.left > 0 && axis === 'x') assert.ok(ctxLo > 0, `window ${k} shows the picture before the band`);
        if (axis === 'x' && b.left + b.width < w) assert.ok(ctxHi > 0, `window ${k} shows the picture after the band`);
        if (axis === 'y' && b.top > 0) assert.ok(ctxLo > 0, `window ${k} shows the picture above the band`);
        if (axis === 'y' && b.top + b.height < h) assert.ok(ctxHi > 0, `window ${k} shows the picture below the band`);
        for (let y = paint.top; y < paint.top + paint.height; y++) {
            for (let x = paint.left; x < paint.left + paint.width; x++) {
                assert.ok(inBand(x, y), `painted ${x},${y} outside the band`);
                assert.equal(painted[y * w + x], 0, `${x},${y} painted twice`);
                painted[y * w + x] = 1;
            }
        }
    }
    for (let y = 0; y < h; y += 7) for (let x = 0; x < w; x += 7) {
        if (inBand(x, y)) assert.equal(painted[y * w + x], 1, `${x},${y} in the band never painted`);
    }
    return wins;
}

test('planAxis x-band: paint tiles the band once, cuts carry context, none > 4096', () => {
    const wins = checkPlan(4096, 8192, { start: 1638, end: 2458 }, 'x');
    // Every window after the first re-reads the end of the one before it.
    for (let k = 1; k < wins.length; k++) assert.ok(wins[k].rect.top < wins[k].paint.top, `window ${k} overlaps the one before`);
});

test('planAxis y-band: paint tiles the band once, cuts carry context, none > 4096', () => {
    checkPlan(8192, 4096, { start: 1434, end: 2662 }, 'y');
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

test('makeMaskBuffer: 0 outside the sub-rect; feathered inward, never past it', () => {
    const rect = { left: 100, top: 0, width: 20, height: 4 };
    const sub = { left: 105, top: 0, width: 10, height: 4 };
    const hard = makeMaskBuffer(rect, sub);
    const soft = makeMaskBuffer(rect, sub, 'x');
    for (let x = 0; x < 20; x++) {
        const insideSub = x >= 5 && x < 15;
        assert.equal(hard[x], insideSub ? 255 : 0, `hard x=${x}`);
        if (!insideSub) assert.equal(soft[x], 0, `soft x=${x} past the band`);
    }
    assert.equal(soft[5], 0, 'the band edge ramps from 0');
    assert.ok(soft[9] > soft[6], 'and rises inward');
});

test('rampMaskBuffer: 0 at the band edges, full strength at the seam, 0 outside paint', () => {
    // band [100, 200) across x; the model may only touch it from 0 at its edges, rising smoothly
    const band = { start: 100, end: 200 };
    const rect = { left: 50, top: 0, width: 200, height: 2 };
    const m = rampMaskBuffer(rect, { left: 100, top: 0, width: 100, height: 2 }, 'x', band);
    const at = x => m[x - rect.left];
    assert.equal(at(99), 0, 'outside the band');
    assert.equal(at(200), 0, 'outside the band');
    assert.equal(at(100), 0, 'the band edge is untouched');
    assert.equal(at(199), 0, 'the band edge is untouched');
    assert.equal(at(150), 255, 'the seam is repainted at full strength');
    for (let x = 101; x < 150; x++) assert.ok(at(x) >= at(x - 1), `rises toward the seam at ${x}`);
    // a band split into columns: the two columns meet at full strength, no ridge between them
    const left = rampMaskBuffer({ left: 50, top: 0, width: 150, height: 1 }, { left: 100, top: 0, width: 50, height: 1 }, 'x', band);
    assert.equal(left[149 - 50], 255, 'a column\'s inner side is not ramped');
});

test('planAxis: wide x-band (>4096) splits into columns, still painted once', () => {
    checkPlan(16384, 1024, { start: 5000, end: 11000 }, 'x');
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
            const xr = (x + state.dx) % w;   // the working copy is unrolled; the band is in frame (dx, 0)
            const inBand = (xr >= state.bandX.start && xr < state.bandX.end);
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

// ── Both ways: no break in the picture's middle ───────────────────────────────

// A "model" that paints each window as a ramp along its seam, so any two windows' (or one window's two)
// ends that meet show as a jump. The first build rolled the whole copy by (w/2, h/2), so a band's one
// window had its two ends meeting at h/2 (side band) and w/2 (top/bottom band): a hard break on every
// both-ways result (MPI-1101, flowMakeSeamless_021/_023).
test('both ways: no break at h/2 in the side band or w/2 in the top/bottom band, nor where the bands wrap', async (t) => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'seamless-test-'));
    t.after(() => fs.rm(tmpDir, { recursive: true, force: true }));

    const w = 512, h = 384;
    const srcPath = await solidPng(tmpDir, 'src.png', w, h, 128, 128, 128);
    const state = await prepare({ sourcePath: srcPath, handles: { left: 10, right: 10, top: 10, bottom: 10 } });
    assert.equal(state.windows.filter((win) => win.fade).length, 1, 'one corner window');

    for (const win of state.windows) {
        const { width: ww, height: wh } = win.rect;
        const buf = Buffer.alloc(ww * wh * 3);
        for (let y = 0; y < wh; y++) for (let x = 0; x < ww; x++) {
            const v = Math.round(255 * (win.axis === 'x' ? y / (wh - 1) : x / (ww - 1)));
            buf.fill(v, (y * ww + x) * 3, (y * ww + x) * 3 + 3);
        }
        const resPath = path.join(tmpDir, `res_${win.i}.png`);
        await sharp(buf, { raw: { width: ww, height: wh, channels: 3 } }).png().toFile(resPath);
        await windowCut(state.runId, win.i);
        await paste(state.runId, win.i, resPath);
    }
    const outPath = path.join(tmpDir, 'out.png');
    await finish(state.runId, outPath);
    const px = await readPixels(outPath, w, h);
    const at = (x, y) => px[(y * w + x) * 3];

    // Side band: columns at the picture's left/right edge; its middle row must not jump.
    const midRow = Math.floor(h / 2);
    for (const x of [0, 3, w - 4, w - 1]) {
        assert.ok(Math.abs(at(x, midRow) - at(x, midRow - 1)) <= 4, `side band x=${x}: step ${at(x, midRow - 1)} -> ${at(x, midRow)} at h/2`);
    }
    // Top/bottom band: rows at the top/bottom edge; its middle column must not jump.
    const midCol = Math.floor(w / 2);
    for (const y of [0, 3, h - 4, h - 1]) {
        assert.ok(Math.abs(at(midCol, y) - at(midCol - 1, y)) <= 4, `top band y=${y}: step ${at(midCol - 1, y)} -> ${at(midCol, y)} at w/2`);
    }
    // Where the y windows' two ends meet (left edge against right edge, in the top/bottom band): the corner joins them.
    for (const y of [0, 3, h - 4, h - 1]) {
        assert.ok(Math.abs(at(0, y) - at(w - 1, y)) <= 8, `wrap y=${y}: ${at(w - 1, y)} | ${at(0, y)}`);
    }
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
