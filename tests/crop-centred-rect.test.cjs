'use strict';

/**
 * MPI-949 — largestCentredRect (extracted from CropManager._applyRatioToRect)
 * and roundDownToDivisible (new stack-crop variant in cropRounding.js).
 *
 * Golden checks embed the original _applyRatioToRect logic as a reference
 * implementation and assert byte-identical output for every case.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

let largestCentredRect;
let roundDownToDivisible;

test.before(async () => {
    ({ largestCentredRect } = await import(
        pathToFileURL(path.join(__dirname, '..', 'js', 'utils', 'cropSnap.js')).href
    ));
    ({ roundDownToDivisible } = await import(
        pathToFileURL(path.join(__dirname, '..', 'js', 'utils', 'cropRounding.js')).href
    ));
});

// ── Reference implementation ──────────────────────────────────────────────────
// Verbatim copy of the original CropManager._applyRatioToRect logic (pre-refactor).
// Used as the golden source for byte-identical comparison.
function refRect(imgW, imgH, ratio) {
    if (ratio == null) {
        return { x: 0, y: 0, w: imgW, h: imgH };
    }
    let w = imgW;
    let h = w / ratio;
    if (h > imgH) {
        h = imgH;
        w = h * ratio;
    }
    return { x: (imgW - w) / 2, y: (imgH - h) / 2, w, h };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Assert that a rect is inside the image (no side hangs off). */
function assertInside(rect, imgW, imgH, label) {
    assert.ok(rect.x >= 0,            `${label}: x must be >= 0 (got ${rect.x})`);
    assert.ok(rect.y >= 0,            `${label}: y must be >= 0 (got ${rect.y})`);
    assert.ok(rect.x + rect.w <= imgW, `${label}: x+w must be <= imgW (${rect.x + rect.w} > ${imgW})`);
    assert.ok(rect.y + rect.h <= imgH, `${label}: y+h must be <= imgH (${rect.y + rect.h} > ${imgH})`);
}

/** Assert that a rect is centred on the image (within floating-point precision). */
function assertCentred(rect, imgW, imgH, label) {
    const eps = 1e-9;
    assert.ok(Math.abs(rect.x - (imgW - rect.w) / 2) < eps, `${label}: not centred horizontally`);
    assert.ok(Math.abs(rect.y - (imgH - rect.h) / 2) < eps, `${label}: not centred vertically`);
}

/** Assert that rect.w / rect.h matches the ratio within floating-point precision. */
function assertRatio(rect, ratio, label) {
    const eps = 1e-9;
    assert.ok(Math.abs(rect.w / rect.h - ratio) < eps, `${label}: w/h=${rect.w / rect.h} !== ratio=${ratio}`);
}

/** Deep-equal rect comparison tolerating floating-point identity (same IEEE754 bits). */
function assertDeepEqualRect(a, b, label) {
    assert.equal(a.x, b.x, `${label}: x`);
    assert.equal(a.y, b.y, `${label}: y`);
    assert.equal(a.w, b.w, `${label}: w`);
    assert.equal(a.h, b.h, `${label}: h`);
}

// ── largestCentredRect tests ──────────────────────────────────────────────────

test('landscape image 1920×1080 at 16:9 — fits by width, fills the frame', () => {
    const [imgW, imgH, ratio] = [1920, 1080, 16 / 9];
    const rect = largestCentredRect(imgW, imgH, ratio);
    assertDeepEqualRect(rect, refRect(imgW, imgH, ratio), '1920×1080 16:9 golden');
    assert.equal(rect.x, 0);
    assert.equal(rect.y, 0);
    assert.equal(rect.w, 1920);
    assert.equal(rect.h, 1080);
    assertInside(rect, imgW, imgH, '1920×1080 16:9');
    assertCentred(rect, imgW, imgH, '1920×1080 16:9');
    assertRatio(rect, ratio, '1920×1080 16:9');
});

test('portrait image 1080×1920 at 16:9 — fits by width, letterboxed vertically', () => {
    const [imgW, imgH, ratio] = [1080, 1920, 16 / 9];
    const rect = largestCentredRect(imgW, imgH, ratio);
    assertDeepEqualRect(rect, refRect(imgW, imgH, ratio), '1080×1920 16:9 golden');
    assertInside(rect, imgW, imgH, '1080×1920 16:9');
    assertCentred(rect, imgW, imgH, '1080×1920 16:9');
    assertRatio(rect, ratio, '1080×1920 16:9');
    assert.equal(rect.x, 0);
    assert.ok(rect.y > 0, 'should have top/bottom letterbox');
});

test('square image 1000×1000 at 16:9 — fits by width, letterboxed vertically', () => {
    const [imgW, imgH, ratio] = [1000, 1000, 16 / 9];
    const rect = largestCentredRect(imgW, imgH, ratio);
    assertDeepEqualRect(rect, refRect(imgW, imgH, ratio), '1000×1000 16:9 golden');
    assertInside(rect, imgW, imgH, '1000×1000 16:9');
    assertCentred(rect, imgW, imgH, '1000×1000 16:9');
    assertRatio(rect, ratio, '1000×1000 16:9');
    assert.equal(rect.x, 0);
    assert.ok(rect.y > 0);
});

test('landscape image 1920×1080 at 9:16 — height-limited, pillarboxed', () => {
    const [imgW, imgH, ratio] = [1920, 1080, 9 / 16];
    const rect = largestCentredRect(imgW, imgH, ratio);
    assertDeepEqualRect(rect, refRect(imgW, imgH, ratio), '1920×1080 9:16 golden');
    assertInside(rect, imgW, imgH, '1920×1080 9:16');
    assertCentred(rect, imgW, imgH, '1920×1080 9:16');
    assertRatio(rect, ratio, '1920×1080 9:16');
    assert.ok(rect.x > 0, 'should have left/right pillarbox');
    assert.equal(rect.y, 0);
});

test('portrait image 1080×1920 at 9:16 — fits by width, fills the frame', () => {
    const [imgW, imgH, ratio] = [1080, 1920, 9 / 16];
    const rect = largestCentredRect(imgW, imgH, ratio);
    assertDeepEqualRect(rect, refRect(imgW, imgH, ratio), '1080×1920 9:16 golden');
    assert.equal(rect.x, 0);
    assert.equal(rect.y, 0);
    assert.equal(rect.w, 1080);
    assert.equal(rect.h, 1920);
    assertInside(rect, imgW, imgH, '1080×1920 9:16');
    assertCentred(rect, imgW, imgH, '1080×1920 9:16');
    assertRatio(rect, ratio, '1080×1920 9:16');
});

test('square image 1000×1000 at 1:1 — fills the frame', () => {
    const [imgW, imgH, ratio] = [1000, 1000, 1];
    const rect = largestCentredRect(imgW, imgH, ratio);
    assertDeepEqualRect(rect, refRect(imgW, imgH, ratio), '1000×1000 1:1 golden');
    assert.equal(rect.x, 0);
    assert.equal(rect.y, 0);
    assert.equal(rect.w, 1000);
    assert.equal(rect.h, 1000);
    assertInside(rect, imgW, imgH, '1000×1000 1:1');
    assertRatio(rect, ratio, '1000×1000 1:1');
});

test('landscape at 1:1 — pillarboxed', () => {
    const [imgW, imgH, ratio] = [1920, 1080, 1];
    const rect = largestCentredRect(imgW, imgH, ratio);
    assertDeepEqualRect(rect, refRect(imgW, imgH, ratio), '1920×1080 1:1 golden');
    assert.equal(rect.w, 1080);
    assert.equal(rect.h, 1080);
    assertInside(rect, imgW, imgH, '1920×1080 1:1');
    assertCentred(rect, imgW, imgH, '1920×1080 1:1');
});

test('FREE mode (null ratio) — full image rect', () => {
    const [imgW, imgH] = [1920, 1080];
    const rect = largestCentredRect(imgW, imgH, null);
    assertDeepEqualRect(rect, refRect(imgW, imgH, null), 'FREE golden');
    assert.equal(rect.x, 0);
    assert.equal(rect.y, 0);
    assert.equal(rect.w, imgW);
    assert.equal(rect.h, imgH);
});

test('non-standard image 1000×563 at 16:9 — centred, inside, correct ratio', () => {
    const [imgW, imgH, ratio] = [1000, 563, 16 / 9];
    const rect = largestCentredRect(imgW, imgH, ratio);
    assertDeepEqualRect(rect, refRect(imgW, imgH, ratio), '1000×563 16:9 golden');
    assertInside(rect, imgW, imgH, '1000×563 16:9');
    assertCentred(rect, imgW, imgH, '1000×563 16:9');
    assertRatio(rect, ratio, '1000×563 16:9');
});

// ── roundDownToDivisible tests ────────────────────────────────────────────────

test('roundDownToDivisible: result is a multiple of n', () => {
    assert.equal(roundDownToDivisible(1000, 16) % 16, 0);
    assert.equal(roundDownToDivisible(562, 16) % 16, 0);
    assert.equal(roundDownToDivisible(999, 8) % 8, 0);
    assert.equal(roundDownToDivisible(100, 3) % 3, 0);
});

test('roundDownToDivisible: never exceeds input', () => {
    assert.ok(roundDownToDivisible(1000, 16) <= 1000);
    assert.ok(roundDownToDivisible(562.5, 16) <= 562.5);
    assert.ok(roundDownToDivisible(563, 16) <= 563);
    assert.ok(roundDownToDivisible(17, 16) <= 17);
    assert.ok(roundDownToDivisible(32, 16) <= 32);
    assert.ok(roundDownToDivisible(1, 16) <= 16); // min-n floor applies, may return n
});

test('roundDownToDivisible: never returns less than n', () => {
    assert.ok(roundDownToDivisible(1000, 16) >= 16);
    assert.ok(roundDownToDivisible(16, 16) >= 16);
    assert.ok(roundDownToDivisible(1, 16) >= 16);
    assert.ok(roundDownToDivisible(5, 2) >= 2);
});

test('roundDownToDivisible: 1000×563 image at 16:9 with n=16 stays inside', () => {
    // The largest centred rect is w=1000, h=562.5 (fits by width, 562.5 < 563).
    // Rounding DOWN to multiples of 16 must keep both dimensions inside the image.
    const rW = roundDownToDivisible(1000, 16);
    const rH = roundDownToDivisible(562.5, 16);
    assert.ok(rW <= 1000, `rounded width ${rW} must not exceed image width 1000`);
    assert.ok(rH <= 563,  `rounded height ${rH} must not exceed image height 563`);
    assert.equal(rW % 16, 0, 'width must be a multiple of 16');
    assert.equal(rH % 16, 0, 'height must be a multiple of 16');
    assert.equal(rW, 992, 'expected floor(1000/16)*16 = 992');
    assert.equal(rH, 560, 'expected floor(562.5/16)*16 = 560');
});

test('roundDownToDivisible: exact multiples are unchanged', () => {
    assert.equal(roundDownToDivisible(992, 16), 992);
    assert.equal(roundDownToDivisible(560, 16), 560);
    assert.equal(roundDownToDivisible(1024, 8), 1024);
});

test('roundDownToDivisible: n=1 always returns floor(v)', () => {
    assert.equal(roundDownToDivisible(562.5, 1), 562);
    assert.equal(roundDownToDivisible(1000.9, 1), 1000);
    assert.equal(roundDownToDivisible(1000, 1), 1000);
});
