/**
 * object-stamp-flip.test.cjs — MPI-998.
 *
 * Object Stamp's "Place it" step can mirror the object. A flip that only showed on
 * the preview would be worse than none, so this asserts what REACHES THE RUN:
 *
 *   - `flipObject`            the ONE mirror every consumer shares — pixels, not flags.
 *   - `composePlacedObject`   Auto: the stamp the graph runs on is mirrored, and a
 *                             mirrored object is then ROTATED by the gizmo (flip first,
 *                             rotate second). Manual: the run reads `sourceRole`'s media
 *                             as it is, so a flip must derive a mirrored copy of it;
 *                             an unflipped Manual derives nothing.
 *   - `buildPlaceValue`       the reported value carries `place.flipX/flipY`; a value
 *                             saved before MPI-998 reads as not flipped.
 *   - `stepValueToMedia` / `stepValueToParam` the frame's seams keep the flip.
 *
 * WHY A FAKE CANVAS: bare Node has no canvas (only `sharp`, which cannot draw a
 * rotated, flipped drawImage). The fake below is a small software rasteriser for the
 * one operation this code path uses: a 2D context with save / restore / translate /
 * rotate / scale / drawImage, inverse-mapped per destination pixel. The REAL
 * `CompositeManager.drawPlaced` and `ShapeManager` run on top of it, so the stamp's
 * transform order is the production one.
 *
 * NOT TESTABLE HERE: the toggle buttons and the live preview (no DOM to mount into).
 * That is the orchestrator's live check in an isolated app.
 *
 * Run: node --test tests/object-stamp-flip.test.cjs
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const repo = p => path.join(__dirname, '..', p);
const esm = p => import('file://' + repo(p).replace(/\\/g, '/'));

// ── A software 2D canvas, just enough for flip + stamp ───────────────────────

/** A decoded bitmap: width, height, RGBA bytes. Stands in for an <img> or a canvas. */
class FakeBitmap {
    constructor(width, height, px) {
        this._w = width;
        this._h = height;
        this._buf = px || null;
    }
    get width() { return this._w; }
    set width(v) { this._w = v; this._buf = null; }
    get height() { return this._h; }
    set height(v) { this._h = v; this._buf = null; }
    get naturalWidth() { return this._w; }
    get naturalHeight() { return this._h; }
    get _px() {
        if (!this._buf) this._buf = new Uint8ClampedArray(this._w * this._h * 4);
        return this._buf;
    }
}

class FakeCanvas extends FakeBitmap {
    constructor() { super(0, 0, null); }
    getContext() { return (this._ctx ||= new FakeContext(this)); }
    toBlob(cb) { cb(new Blob([Buffer.from(this._px)])); }
}

/** Matrix as [a, b, c, d, e, f]: x' = a*x + c*y + e, y' = b*x + d*y + f. */
const mul = (m, n) => [
    m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
];

class FakeContext {
    constructor(canvas) {
        this.canvas = canvas;
        this._m = [1, 0, 0, 1, 0, 0];
        this._stack = [];
    }
    save() { this._stack.push(this._m); }
    restore() { this._m = this._stack.pop() || this._m; }
    translate(x, y) { this._m = mul(this._m, [1, 0, 0, 1, x, y]); }
    scale(x, y) { this._m = mul(this._m, [x, 0, 0, y, 0, 0]); }
    rotate(a) { this._m = mul(this._m, [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0]); }
    clearRect() {}
    drawImage(src, dx, dy, dw, dh) {
        const [a, b, c, d, e, f] = this._m;
        const det = a * d - b * c;
        const dst = this.canvas;
        const out = dst._px;
        const sp = src._px;
        for (let y = 0; y < dst.height; y++) {
            for (let x = 0; x < dst.width; x++) {
                // Destination pixel CENTRE, mapped back into the image's local space.
                const px = x + 0.5 - e;
                const py = y + 0.5 - f;
                const lx = (d * px - c * py) / det;
                const ly = (-b * px + a * py) / det;
                if (lx < dx || lx >= dx + dw || ly < dy || ly >= dy + dh) continue;
                const u = Math.floor(((lx - dx) / dw) * src.width);
                const v = Math.floor(((ly - dy) / dh) * src.height);
                const s = (v * src.width + u) * 4;
                if (sp[s + 3] === 0) continue;   // transparent source pixel: leave the destination
                const o = (y * dst.width + x) * 4;
                out[o] = sp[s]; out[o + 1] = sp[s + 1]; out[o + 2] = sp[s + 2]; out[o + 3] = sp[s + 3];
            }
        }
    }
}

// `_loadImage` inside MpiStepPlace does `new Image()`, sets `.src`, awaits `onload`.
const IMAGES = new Map();
class FakeImage extends FakeBitmap {
    constructor() { super(0, 0, null); }
    set src(url) {
        setImmediate(() => {
            const hit = IMAGES.get(url);
            if (!hit) { this.onerror?.(); return; }
            this._w = hit.w; this._h = hit.h; this._buf = hit.px;
            this.onload?.();
        });
    }
}

globalThis.document = { createElement: (tag) => { assert.strictEqual(tag, 'canvas'); return new FakeCanvas(); } };
globalThis.Image = FakeImage;
// stepKinds.js pulls every step kind in, and one of them opens an SSE stream at import.
globalThis.EventSource ||= class { addEventListener() {} close() {} };

// ── Fixtures ─────────────────────────────────────────────────────────────────

/** Every pixel a distinct opaque colour, so ANY permutation of them is detectable. */
function makeObject(w, h, seed = 0) {
    const px = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) {
        px[i * 4] = 10 + i * 7 + seed;
        px[i * 4 + 1] = 200 - i * 5;
        px[i * 4 + 2] = 30 + seed;
        px[i * 4 + 3] = 255;
    }
    return px;
}
const colourAt = (px, w, x, y) => Array.from(px.slice((y * w + x) * 4, (y * w + x) * 4 + 4)).join(',');
const register = (url, w, h, px) => IMAGES.set(url, { w, h, px });

const OBJ_W = 4;
const OBJ_H = 2;
const OBJ = makeObject(OBJ_W, OBJ_H);
register('http://test/object.png', OBJ_W, OBJ_H, OBJ);
/** What the cutout stage handed the run — a different picture from the user's upload. */
const CUT = makeObject(OBJ_W, OBJ_H, 90);
register('http://test/cut.png', OBJ_W, OBJ_H, CUT);

const SCENE = { w: 8, h: 4 };
/** Object at 1:1, centred in the scene. */
const RECT = { cx: 4, cy: 2, halfW: OBJ_W / 2, halfH: OBJ_H / 2 };

function value({ mode = 'auto', rot = 0, flipX, flipY } = {}) {
    return {
        mode,
        sourceUrl: 'http://test/object.png',
        place: { ...RECT, rot, ...(flipX !== undefined ? { flipX } : {}), ...(flipY !== undefined ? { flipY } : {}) },
        size: { ...SCENE },
        objectSize: { w: OBJ_W, h: OBJ_H },
    };
}

/** Read a produced File back as a bitmap of the given size. */
async function decode(file, w, h) {
    assert.ok(file, 'a file was derived');
    return new FakeBitmap(w, h, new Uint8ClampedArray(await file.arrayBuffer()));
}

// ── flipObject ───────────────────────────────────────────────────────────────

test('flipObject mirrors the object pixel for pixel, on each axis and on both', async () => {
    const { flipObject } = await esm('js/components/Organisms/MpiStepPlace/MpiStepPlace.js');
    const src = new FakeBitmap(OBJ_W, OBJ_H, OBJ);

    const fx = flipObject(src, true, false);
    const fy = flipObject(src, false, true);
    const fxy = flipObject(src, true, true);
    for (let y = 0; y < OBJ_H; y++) {
        for (let x = 0; x < OBJ_W; x++) {
            assert.strictEqual(colourAt(fx._px, OBJ_W, x, y), colourAt(OBJ, OBJ_W, OBJ_W - 1 - x, y), `flipX (${x},${y})`);
            assert.strictEqual(colourAt(fy._px, OBJ_W, x, y), colourAt(OBJ, OBJ_W, x, OBJ_H - 1 - y), `flipY (${x},${y})`);
            assert.strictEqual(colourAt(fxy._px, OBJ_W, x, y), colourAt(OBJ, OBJ_W, OBJ_W - 1 - x, OBJ_H - 1 - y), `both (${x},${y})`);
        }
    }
    assert.strictEqual(fx.width, OBJ_W, 'the mirror keeps the object\'s own size');
    assert.strictEqual(fx.height, OBJ_H);
});

test('flipObject with no flip hands the SAME picture back: no canvas, no re-encode', async () => {
    const { flipObject } = await esm('js/components/Organisms/MpiStepPlace/MpiStepPlace.js');
    const src = new FakeBitmap(OBJ_W, OBJ_H, OBJ);
    assert.strictEqual(flipObject(src, false, false), src);
    assert.strictEqual(flipObject(null, true, true), null);
});

// ── Auto: the stamp the graph runs on ────────────────────────────────────────

test('Auto: the stamp is the object MIRRORED about its own centre (flipX)', async () => {
    const { composePlacedObject } = await esm('js/components/Organisms/MpiStepPlace/MpiStepPlace.js');

    const plain = await decode(await composePlacedObject(value({ flipX: false }), null), SCENE.w, SCENE.h);
    const flipped = await decode(await composePlacedObject(value({ flipX: true }), null), SCENE.w, SCENE.h);

    // The object spans scene x 2..5, y 1..2.
    for (let y = 0; y < OBJ_H; y++) {
        for (let x = 0; x < OBJ_W; x++) {
            assert.strictEqual(colourAt(plain._px, SCENE.w, 2 + x, 1 + y), colourAt(OBJ, OBJ_W, x, y),
                `unflipped stamp is the object as it is (${x},${y})`);
            assert.strictEqual(colourAt(flipped._px, SCENE.w, 2 + x, 1 + y), colourAt(OBJ, OBJ_W, OBJ_W - 1 - x, y),
                `flipped stamp is the object mirrored (${x},${y})`);
        }
    }
    // Everywhere else stays transparent: the graph reads the stamp's alpha as the region.
    assert.strictEqual(colourAt(flipped._px, SCENE.w, 0, 0), '0,0,0,0');
});

test('Auto: a value with NO flip keys (saved before MPI-998) stamps exactly as before', async () => {
    const { composePlacedObject } = await esm('js/components/Organisms/MpiStepPlace/MpiStepPlace.js');
    const legacy = await decode(await composePlacedObject(value(), null), SCENE.w, SCENE.h);
    for (let y = 0; y < OBJ_H; y++) {
        for (let x = 0; x < OBJ_W; x++) {
            assert.strictEqual(colourAt(legacy._px, SCENE.w, 2 + x, 1 + y), colourAt(OBJ, OBJ_W, x, y));
        }
    }
});

test('Auto: flip then ROTATE, never rotate then flip — a mirrored object turned by the gizmo', async () => {
    const { composePlacedObject } = await esm('js/components/Organisms/MpiStepPlace/MpiStepPlace.js');
    const rot = Math.PI / 2;   // clockwise on screen
    const got = await decode(
        await composePlacedObject(value({ rot, flipX: true }), null), SCENE.w, SCENE.h);

    // Independent oracle, written from the geometry and not from the code under test.
    // Object pixel (u,v) is first mirrored to column (W-1-u), then sits at local offset
    // from the rect centre, then the canvas rotation (x' = x cos - y sin, y' = x sin + y cos)
    // carries it to the scene.
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    const expectFlipFirst = new Map();
    const expectFlipLast = new Map();
    for (let v = 0; v < OBJ_H; v++) {
        for (let u = 0; u < OBJ_W; u++) {
            const colour = colourAt(OBJ, OBJ_W, u, v);
            const place = (lx, ly, into) => {
                const sx = Math.floor(RECT.cx + lx * cos - ly * sin);
                const sy = Math.floor(RECT.cy + lx * sin + ly * cos);
                into.set(`${sx},${sy}`, colour);
            };
            // flip → rotate
            place((OBJ_W - 1 - u) + 0.5 - OBJ_W / 2, v + 0.5 - OBJ_H / 2, expectFlipFirst);
            // rotate → flip about the SCREEN's vertical axis (the wrong order)
            const lx = u + 0.5 - OBJ_W / 2;
            const ly = v + 0.5 - OBJ_H / 2;
            const sx = Math.floor(RECT.cx - (lx * cos - ly * sin));
            const sy = Math.floor(RECT.cy + lx * sin + ly * cos);
            expectFlipLast.set(`${sx},${sy}`, colour);
        }
    }

    // The oracle has teeth: the two orders disagree for this object, so a test that
    // passed both would prove nothing.
    assert.notDeepStrictEqual([...expectFlipFirst].sort(), [...expectFlipLast].sort());

    assert.strictEqual(expectFlipFirst.size, OBJ_W * OBJ_H, 'every object pixel lands on its own scene pixel');
    for (const [key, colour] of expectFlipFirst) {
        const [sx, sy] = key.split(',').map(Number);
        assert.strictEqual(colourAt(got._px, SCENE.w, sx, sy), colour, `scene pixel (${key})`);
    }
});

test('Auto: flipY mirrors top to bottom', async () => {
    const { composePlacedObject } = await esm('js/components/Organisms/MpiStepPlace/MpiStepPlace.js');
    const got = await decode(await composePlacedObject(value({ flipY: true }), null), SCENE.w, SCENE.h);
    for (let y = 0; y < OBJ_H; y++) {
        for (let x = 0; x < OBJ_W; x++) {
            assert.strictEqual(colourAt(got._px, SCENE.w, 2 + x, 1 + y), colourAt(OBJ, OBJ_W, x, OBJ_H - 1 - y));
        }
    }
});

// ── Manual: the run reads sourceRole's media as it is ────────────────────────

test('Manual with no flip derives NOTHING: the run keeps the media it already has', async () => {
    const { composePlacedObject } = await esm('js/components/Organisms/MpiStepPlace/MpiStepPlace.js');
    assert.strictEqual(await composePlacedObject(value({ mode: 'manual' }), { url: 'http://test/cut.png' }), null);
    assert.strictEqual(await composePlacedObject(value({ mode: 'manual', flipX: false, flipY: false }), { url: 'http://test/cut.png' }), null);
});

test('Manual with a flip derives a MIRRORED COPY of the cutout stage\'s object, full frame, unstamped', async () => {
    const { composePlacedObject } = await esm('js/components/Organisms/MpiStepPlace/MpiStepPlace.js');
    const file = await composePlacedObject(value({ mode: 'manual', flipX: true }), { url: 'http://test/cut.png' });
    assert.strictEqual(file.type, 'image/png');

    // The object's own frame (4x2), not the scene's (8x4): this replaces `image2`.
    assert.strictEqual(file.size, OBJ_W * OBJ_H * 4);
    const got = await decode(file, OBJ_W, OBJ_H);
    for (let y = 0; y < OBJ_H; y++) {
        for (let x = 0; x < OBJ_W; x++) {
            // From `source.url` (the cut object) and not `value.sourceUrl` (the upload):
            // the cutout stage's work must survive the flip.
            assert.strictEqual(colourAt(got._px, OBJ_W, x, y), colourAt(CUT, OBJ_W, OBJ_W - 1 - x, y), `(${x},${y})`);
        }
    }
});

test('Manual flipY and both-axes flips derive the matching mirror', async () => {
    const { composePlacedObject } = await esm('js/components/Organisms/MpiStepPlace/MpiStepPlace.js');
    const both = await decode(
        await composePlacedObject(value({ mode: 'manual', flipX: true, flipY: true }), { url: 'http://test/cut.png' }), OBJ_W, OBJ_H);
    const vert = await decode(
        await composePlacedObject(value({ mode: 'manual', flipY: true }), { url: 'http://test/cut.png' }), OBJ_W, OBJ_H);
    for (let y = 0; y < OBJ_H; y++) {
        for (let x = 0; x < OBJ_W; x++) {
            assert.strictEqual(colourAt(both._px, OBJ_W, x, y), colourAt(CUT, OBJ_W, OBJ_W - 1 - x, OBJ_H - 1 - y));
            assert.strictEqual(colourAt(vert._px, OBJ_W, x, y), colourAt(CUT, OBJ_W, x, OBJ_H - 1 - y));
        }
    }
});

test('Manual with a flip and an object that will not load returns null (the same fallback as Auto)', async () => {
    const { composePlacedObject } = await esm('js/components/Organisms/MpiStepPlace/MpiStepPlace.js');
    assert.strictEqual(await composePlacedObject(value({ mode: 'manual', flipX: true }), { url: 'http://test/missing.png' }), null);
});

// ── The reported value ───────────────────────────────────────────────────────

test('the reported value carries the flip inside `place`, and Reuse reads it back', async () => {
    const { buildPlaceValue, placeFlips } = await esm('js/components/Organisms/MpiStepPlace/MpiStepPlace.js');
    const shape = { cx: 4, cy: 2, halfW: 2, halfH: 1, rot: 0.5 };
    const v = buildPlaceValue({
        mode: 'auto', sourceUrl: 'http://test/object.png', shape,
        flipX: true, flipY: false, scene: SCENE, object: { w: OBJ_W, h: OBJ_H },
    });
    assert.strictEqual(v.place.flipX, true);
    assert.strictEqual(v.place.flipY, false);
    assert.strictEqual(v.place.rot, 0.5, 'the gizmo numbers are untouched');
    assert.deepStrictEqual(placeFlips(v), { flipX: true, flipY: false });

    // Through the persisted snapshot (JSON) and back, which is what Reuse restores from.
    assert.deepStrictEqual(placeFlips(JSON.parse(JSON.stringify(v))), { flipX: true, flipY: false });

    // A value saved before the flip existed, or no value at all: not flipped.
    assert.deepStrictEqual(placeFlips({ place: { cx: 1 } }), { flipX: false, flipY: false });
    assert.deepStrictEqual(placeFlips(null), { flipX: false, flipY: false });
});

// ── The frame's seams ────────────────────────────────────────────────────────

test('stepValueToMedia and stepValueToParam keep the flip at the frame\'s seams', async (t) => {
    let kinds;
    try {
        kinds = await esm('js/components/Blocks/MpiBaseFlow/stepKinds.js');
    } catch (err) {
        // stepKinds pulls every step kind in; if one of them needs a browser-only path
        // the seam is pinned below as a source contract instead. Say so, never skip silently.
        t.diagnostic(`stepKinds.js not importable in bare Node (${err.message}); asserting the source contract`);
        const fs = require('node:fs');
        const src = fs.readFileSync(repo('js/components/Blocks/MpiBaseFlow/stepKinds.js'), 'utf8');
        assert.match(src, /place: \(value, media, step, source\) => composePlacedObject\(value, source\)/);
        return;
    }
    const { stepValueToMedia, stepValueToParam } = kinds;
    const step = { kind: 'place', role: 'image1', sourceRole: 'image2', mediaRole: 'image2' };

    // Manual + flip: a file, and it is the mirrored cut object.
    const manual = value({ mode: 'manual', flipX: true });
    const file = await stepValueToMedia('place', manual, { url: 'http://test/scene.png' }, step, { url: 'http://test/cut.png' });
    const got = await decode(file, OBJ_W, OBJ_H);
    assert.strictEqual(colourAt(got._px, OBJ_W, 0, 0), colourAt(CUT, OBJ_W, OBJ_W - 1, 0));

    // Manual, no flip: nothing derived, as before.
    assert.strictEqual(
        await stepValueToMedia('place', value({ mode: 'manual' }), null, step, { url: 'http://test/cut.png' }), null);

    // The graph params are unaffected by a flip: still the region and the mode, nothing else.
    const plain = stepValueToParam('place', value({ mode: 'manual' }));
    const flipped = stepValueToParam('place', value({ mode: 'manual', flipX: true, flipY: true }));
    assert.deepStrictEqual(flipped, plain);
    assert.deepStrictEqual(Object.keys(flipped).sort(), ['mode', 'region']);
    assert.strictEqual(flipped.mode, 2);
});
