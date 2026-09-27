'use strict';

/**
 * MPI-949 — deriveResizeDims longEdge and percent modes.
 *
 * longEdge resizes so max(w,h) = L, keeping aspect.
 * percent scales both sides by p/100, keeping aspect.
 * Both use the same rounding as the existing megapixels/scale modes:
 *   Math.max(1, Math.round(srcW * k)).
 * Existing modes (scale, megapixels, unknown) must be byte-identical.
 */

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

let deriveResizeDims;

test.before(async () => {
    ({ deriveResizeDims } = await import(pathToFileURL(path.join(__dirname, '..', 'js', 'utils', 'ratios.js')).href));
});

// ── longEdge ──────────────────────────────────────────────────────────────────

test('longEdge 1024 on 4000x3000 (landscape)', () => {
    // k = 1024/4000 = 0.256 → 1024x768
    assert.deepStrictEqual(
        deriveResizeDims('longEdge', 4000, 3000, { longEdge: 1024 }),
        { width: 1024, height: 768 }
    );
});

test('longEdge 1024 on 1080x1920 (portrait)', () => {
    // k = 1024/1920 ≈ 0.5333 → 576x1024
    assert.deepStrictEqual(
        deriveResizeDims('longEdge', 1080, 1920, { longEdge: 1024 }),
        { width: 576, height: 1024 }
    );
});

test('longEdge on a square keeps it square', () => {
    // k = 512/1000 = 0.512 → 512x512
    assert.deepStrictEqual(
        deriveResizeDims('longEdge', 1000, 1000, { longEdge: 512 }),
        { width: 512, height: 512 }
    );
});

test('longEdge equal to the long side is a no-op', () => {
    assert.deepStrictEqual(
        deriveResizeDims('longEdge', 1920, 1080, { longEdge: 1920 }),
        { width: 1920, height: 1080 }
    );
});

test('longEdge 0 or missing returns null', () => {
    assert.strictEqual(deriveResizeDims('longEdge', 4000, 3000, { longEdge: 0 }),   null);
    assert.strictEqual(deriveResizeDims('longEdge', 4000, 3000, { longEdge: -1 }),  null);
    assert.strictEqual(deriveResizeDims('longEdge', 4000, 3000, {}),                null);
});

// ── percent ───────────────────────────────────────────────────────────────────

test('percent 50 on 4000x3000', () => {
    // k = 0.5 → 2000x1500
    assert.deepStrictEqual(
        deriveResizeDims('percent', 4000, 3000, { percent: 50 }),
        { width: 2000, height: 1500 }
    );
});

test('percent 25 on 4000x3000', () => {
    // k = 0.25 → 1000x750
    assert.deepStrictEqual(
        deriveResizeDims('percent', 4000, 3000, { percent: 25 }),
        { width: 1000, height: 750 }
    );
});

test('percent 100 is a no-op', () => {
    assert.deepStrictEqual(
        deriveResizeDims('percent', 1920, 1080, { percent: 100 }),
        { width: 1920, height: 1080 }
    );
});

test('percent 0 or negative returns null', () => {
    assert.strictEqual(deriveResizeDims('percent', 4000, 3000, { percent: 0 }),  null);
    assert.strictEqual(deriveResizeDims('percent', 4000, 3000, { percent: -5 }), null);
    assert.strictEqual(deriveResizeDims('percent', 4000, 3000, {}),              null);
});

// ── rounding matches existing modes ───────────────────────────────────────────

test('longEdge rounding uses Math.round (same as megapixels/scale)', () => {
    // 4001x3001 @ longEdge=1000: k=1000/4001, w=Math.round(4001*(1000/4001))=1000, h=Math.round(3001*(1000/4001))
    const k = 1000 / 4001;
    const expectedW = Math.max(1, Math.round(4001 * k));
    const expectedH = Math.max(1, Math.round(3001 * k));
    assert.deepStrictEqual(
        deriveResizeDims('longEdge', 4001, 3001, { longEdge: 1000 }),
        { width: expectedW, height: expectedH }
    );
});

test('percent rounding uses Math.round (same as megapixels/scale)', () => {
    // 3001x2001 @ 33%: k=0.33
    const k = 0.33;
    const expectedW = Math.max(1, Math.round(3001 * k));
    const expectedH = Math.max(1, Math.round(2001 * k));
    assert.deepStrictEqual(
        deriveResizeDims('percent', 3001, 2001, { percent: 33 }),
        { width: expectedW, height: expectedH }
    );
});

// ── existing modes byte-identical ─────────────────────────────────────────────

test('SCALE mode is unchanged by the new opts', () => {
    assert.deepStrictEqual(deriveResizeDims('scale', 3000, 2000, { scale: '2' }), { width: 1500, height: 1000 });
    assert.deepStrictEqual(deriveResizeDims('scale', 3000, 2000, { scale: '4' }), { width: 750, height: 500 });
    // With extra longEdge/percent opts present — must still use scale
    assert.deepStrictEqual(
        deriveResizeDims('scale', 3000, 2000, { scale: '2', longEdge: 512, percent: 50 }),
        { width: 1500, height: 1000 }
    );
});

test('megapixels mode is unchanged', () => {
    assert.deepStrictEqual(deriveResizeDims('megapixels', 4096, 4096, { megapixels: 1 }), { width: 1024, height: 1024 });
});

test('unknown family still returns null', () => {
    assert.strictEqual(deriveResizeDims('free', 3000, 2000, { scale: '2', megapixels: 1 }), null);
    assert.strictEqual(deriveResizeDims('sdxl', 3000, 2000, {}), null);
});

test('unknown source dims return null', () => {
    assert.strictEqual(deriveResizeDims('longEdge', 0, 0, { longEdge: 1024 }), null);
    assert.strictEqual(deriveResizeDims('percent', 0, 100, { percent: 50 }),   null);
});
