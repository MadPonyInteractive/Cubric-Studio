'use strict';

const test = require('node:test');
const assert = require('node:assert');

/**
 * MPI-736 phase 1c — the stage overlays (crop handles, shape handles, the brush ring, the
 * negative mask dot) froze `--accent-heat` as a rose literal, because a `ctx.fillStyle`
 * cannot hold a CSS var. That was right while the token WAS the rose. It is wrong now
 * that `[data-accent]` rebinds it per workspace: a crop handle kept drawing pink over an
 * orange video UI.
 *
 * Two things are worth pinning and neither shows up in a screenshot diff:
 *
 *   1. `accentHeat` must READ at draw time and fall back, not throw, on a canvas that
 *      computes nothing — a detached overlay is ordinary during teardown.
 *   2. `brushDab.js` must stay DOM-free (`tests/brush-presets.test.cjs` says so), so the
 *      accent arrives as `opts.accent`. If someone "simplifies" that back to reading the
 *      canvas inside, the ring goes right on working and the node test suite goes red.
 */

/** Swap in a `getComputedStyle` for one call; restores whatever was there. */
function withComputedStyle(value, fn) {
    const had = Object.prototype.hasOwnProperty.call(globalThis, 'getComputedStyle');
    const prev = globalThis.getComputedStyle;
    globalThis.getComputedStyle = () => ({ getPropertyValue: () => value });
    try {
        return fn();
    } finally {
        if (had) globalThis.getComputedStyle = prev;
        else delete globalThis.getComputedStyle;
    }
}

test('accentHeat reads the live --accent-heat off the element it is handed', async () => {
    const { accentHeat } = await import('../js/utils/dom.js');

    const orange = withComputedStyle(' oklch(0.74 0.16 48) ', () => accentHeat({}));
    assert.strictEqual(orange, 'oklch(0.74 0.16 48)',
        'a canvas in the video workspace must draw the video accent, trimmed');
});

test('accentHeat falls back to the rose when the element computes nothing', async () => {
    const { accentHeat } = await import('../js/utils/dom.js');

    assert.strictEqual(accentHeat(null), 'oklch(0.76 0.17 355)');
    assert.strictEqual(withComputedStyle('', () => accentHeat({})), 'oklch(0.76 0.17 355)',
        'a detached overlay computes an empty string, and must still draw something');
});

/** Records every colour a draw assigns, in order. */
const recordingCtx = () => {
    const seen = [];
    return {
        seen,
        canvas: {},
        save() {}, restore() {}, beginPath() {}, arc() {}, stroke() {}, fill() {},
        setLineDash() {},
        set strokeStyle(v) { seen.push(v); },
        set fillStyle(v) { seen.push(v); },
        set lineWidth(v) {}, set lineDashOffset(v) {},
    };
};

test('drawBrushRing draws in the accent the caller passes', async () => {
    const { drawBrushRing } = await import(
        '../js/components/Primitives/MpiCanvas/managers/brushDab.js');

    const ctx = recordingCtx();
    drawBrushRing(ctx, 10, 10, 8, { accent: 'oklch(0.74 0.16 48)' });
    assert.ok(ctx.seen.includes('oklch(0.74 0.16 48)'),
        'the ring and its centre dot must both take the passed accent');
    assert.ok(!ctx.seen.includes('oklch(0.76 0.17 355)'),
        'no rose may survive once an accent was supplied');
});

test('drawBrushRing keeps the eraser frost, whatever the workspace accent is', async () => {
    const { drawBrushRing, BRUSH_ERASER } = await import(
        '../js/components/Primitives/MpiCanvas/managers/brushDab.js');

    const ctx = recordingCtx();
    drawBrushRing(ctx, 10, 10, 8, { eraser: true, accent: 'oklch(0.74 0.16 48)' });
    assert.ok(ctx.seen.includes(BRUSH_ERASER),
        'frost is a TOOL signal — a video workspace must not recolour the eraser');
    assert.ok(!ctx.seen.includes('oklch(0.74 0.16 48)'));
});

test('drawBrushRing still draws when no accent is passed', async () => {
    const { drawBrushRing, BRUSH_CURSOR } = await import(
        '../js/components/Primitives/MpiCanvas/managers/brushDab.js');

    const ctx = recordingCtx();
    drawBrushRing(ctx, 10, 10, 8);
    assert.ok(ctx.seen.includes(BRUSH_CURSOR));
});
