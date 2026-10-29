// AUDIT D7 — the code the brush layers shared by copy, now one mixin (layerShared.js).
//
// MaskManager, PaintManager and CompositeManager each carried their own stroke box, and
// the first two their own one-shot undo pair, Adjust session and Fill lookup. Three
// copies of the code that feeds Ctrl+Z is three places to open a hole in it. Before
// this, the only cover was source-text matching (mask-adjust / paint-adjust), because
// the managers build canvases through `document`. The mixin is plain methods over
// `this`, so here they RUN — against a fake 2D context — through each manager's own
// prototype, which proves the wiring (which source canvas, which pad) as well as the
// logic.

const assert = require('node:assert');
const test = require('node:test');

const DIR = '../js/components/Primitives/MpiCanvas/managers/';
const load = async () => {
    const [shared, mask, paint, comp] = await Promise.all(
        ['layerShared', 'MaskManager', 'PaintManager', 'CompositeManager'].map(n => import(`${DIR}${n}.js`)),
    );
    return { shared, Mask: mask.MaskManager, Paint: paint.PaintManager, Composite: comp.CompositeManager };
};

// ── fake canvas: an RGBA buffer that resets on resize, like the real one ─────────
class FakeCanvas {
    constructor(w = 0, h = 0) { this._w = w; this._h = h; this.data = new Uint8ClampedArray(w * h * 4); }
    get width() { return this._w; }
    set width(v) { this._w = v; this.data = new Uint8ClampedArray(this._w * this._h * 4); }
    get height() { return this._h; }
    set height(v) { this._h = v; this.data = new Uint8ClampedArray(this._w * this._h * 4); }
    getContext() {
        const c = this;
        return {
            canvas: c,
            getImageData(x, y, w, h) {
                assert.ok(x === 0 && y === 0 && w === c.width && h === c.height, 'only whole-layer reads are faked');
                return { data: c.data.slice() };
            },
            createImageData(w, h) { return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }; },
            drawImage(src, dx, dy) {
                assert.ok(dx === 0 && dy === 0 && src.width === c.width && src.height === c.height,
                    'only same-size copies are faked');
                c.data.set(src.data);
            },
        };
    }
}
globalThis.document = { createElement: () => new FakeCanvas() };

/** A layer with opaque white where `on(x, y)`. */
const layer = (w, h, on) => {
    const c = new FakeCanvas(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (!on(x, y)) continue;
        const i = (y * w + x) * 4;
        c.data[i] = c.data[i + 1] = c.data[i + 2] = c.data[i + 3] = 255;
    }
    return c;
};
const blob = (w, h) => layer(w, h, (x, y) => x >= 20 && x < 30 && y >= 20 && y < 30);
// a 3px-thick square ring: one enclosed hole in the middle
const ring = (w, h) => layer(w, h, (x, y) => x >= 10 && x < 30 && y >= 10 && y < 30 && !(x >= 13 && x < 27 && y >= 13 && y < 27));

test('all three layers run ONE stroke box, two layers ONE undo pair and ONE Adjust session', async () => {
    const { shared, Mask, Paint, Composite } = await load();
    for (const C of [Mask, Paint, Composite]) {
        assert.strictEqual(C.prototype.takeStrokeBox, shared.strokeBoxMethods.takeStrokeBox, `${C.name} has its own takeStrokeBox`);
        assert.strictEqual(C.prototype._growStrokeBox, shared.strokeBoxMethods._growStrokeBox, `${C.name} has its own _growStrokeBox`);
    }
    for (const C of [Mask, Paint]) {
        assert.strictEqual(C.prototype._recordUndo, shared.oneShotUndoMethods._recordUndo, `${C.name} has its own _recordUndo`);
        assert.strictEqual(C.prototype._commitUndo, shared.oneShotUndoMethods._commitUndo, `${C.name} has its own _commitUndo`);
        for (const m of ['beginAdjust', '_ensureAdjustField', 'endAdjust', '_findHoles']) {
            assert.strictEqual(typeof C.prototype[m], 'function', `${C.name}.${m} is not mixed in`);
        }
    }
    // The composite's hole layer records whole with `record()` — it must keep its own.
    assert.notStrictEqual(Composite.prototype._recordUndo, shared.oneShotUndoMethods._recordUndo,
        'CompositeManager took the begin()/commitChanged() pair — its layer records whole');
});

test('stroke box: grows over every dab, is taken padded by 1px, and the take is the stroke boundary', async () => {
    const { Mask } = await load();
    const m = { _strokeBox: null, _lastDab: { x: 1, y: 1 } };
    assert.strictEqual(Mask.prototype.takeStrokeBox.call(m), null, 'an empty stroke has a box');
    assert.strictEqual(m._lastDab, null, 'the previous dab survived the boundary — the next stroke joins the last');

    Mask.prototype._growStrokeBox.call(m, 10, 20, 5);
    Mask.prototype._growStrokeBox.call(m, 40, 12, 3);
    m._lastDab = { x: 40, y: 12 };
    assert.deepStrictEqual(Mask.prototype.takeStrokeBox.call(m), { x: 4, y: 8, w: 40, h: 18 });
    assert.strictEqual(m._strokeBox, null, 'the box was not reset — the next stroke would store this one too');
    assert.strictEqual(m._lastDab, null);
});

test('one-shot undo opens a capture on the layers and closes it with the changed-box commit', async () => {
    const { Mask, Paint } = await load();
    for (const C of [Mask, Paint]) {
        const calls = [];
        const layers = [{ canvas: 'a' }];
        const mgr = {
            undoLayers: () => layers,
            undo: { begin: l => calls.push(['begin', l]), commitChanged: () => calls.push(['commitChanged']) },
        };
        C.prototype._recordUndo.call(mgr);
        C.prototype._commitUndo.call(mgr);
        assert.deepStrictEqual(calls, [['begin', layers], ['commitChanged']], `${C.name} undo pair`);

        // No layers yet (before init) = no capture, and no stack = no throw.
        const none = [];
        C.prototype._recordUndo.call({ undoLayers: () => [], undo: { begin: () => none.push(1) } });
        assert.strictEqual(none.length, 0, `${C.name} opened a capture with no layers`);
        C.prototype._recordUndo.call({ undoLayers: () => layers, undo: null });
        C.prototype._commitUndo.call({ undo: null });
    }
});

test('beginAdjust snapshots each layer\'s own source and drops the previous field', async () => {
    const { Mask, Paint } = await load();
    for (const [C, key] of [[Mask, 'maskCanvas'], [Paint, 'paintCanvas']]) {
        const src = blob(50, 40);
        const mgr = { [key]: src, _adjustField: 'stale', _adjustImg: 'stale', _adjustBox: 'stale', _adjustPad: 9, hasAdjustPreview: true };
        C.prototype.beginAdjust.call(mgr);
        assert.deepStrictEqual(mgr._adjustPristine.data, src.data, `${C.name} did not snapshot ${key}`);
        assert.notStrictEqual(mgr._adjustPristine, src, 'the snapshot is the live layer, not a copy');
        assert.strictEqual(mgr._adjustField, null, 'the field describes the previous snapshot');
        assert.strictEqual(mgr._adjustImg, null);
        assert.strictEqual(mgr._adjustBox, null);
        assert.strictEqual(mgr._adjustPad, 0);
        assert.strictEqual(mgr.hasAdjustPreview, false);
        assert.strictEqual(mgr.adjustCanvas.width, 50);
        assert.strictEqual(mgr.adjustCanvas.height, 40);
        assert.ok(mgr.adjustCtx, 'no preview context');

        const empty = { [key]: new FakeCanvas(0, 0) };
        C.prototype.beginAdjust.call(empty);
        assert.strictEqual(empty._adjustPristine, undefined, 'a zero-size layer was snapshotted');
    }
    const none = {};
    Mask.prototype.beginAdjust.call(none); // mask before init: no maskCanvas yet
    assert.strictEqual(none._adjustPristine, undefined);
});

test('the field is built from the PRISTINE copy with each layer\'s pad, reused until a bigger radius', async () => {
    const { Mask, Paint } = await load();
    for (const [C, key, pad] of [[Mask, 'maskCanvas', 135], [Paint, 'paintCanvas', 52]]) {
        const mgr = { [key]: blob(60, 50) };
        C.prototype.beginAdjust.call(mgr);
        assert.ok(C.prototype._ensureAdjustField.call(mgr, 0), `${C.name} built no field over content`);
        assert.strictEqual(mgr._adjustPad, pad, `${C.name} used the wrong ADJUST_PAD`);
        assert.ok(mgr._adjustField && mgr._adjustBox, 'no field / box');
        assert.strictEqual(mgr._adjustImg.width, mgr._adjustBox.w, 'the preview buffer is not the box size');

        const field = mgr._adjustField;
        assert.ok(C.prototype._ensureAdjustField.call(mgr, pad - 2));
        assert.strictEqual(mgr._adjustField, field, 'a field padded far enough was rebuilt — a freeze per slider tick');
        assert.ok(C.prototype._ensureAdjustField.call(mgr, pad + 10));
        assert.notStrictEqual(mgr._adjustField, field, 'a bigger radius reused a field padded short of it');
        assert.strictEqual(mgr._adjustPad, pad + 12);
    }

    // Empty pristine + a full preview buffer: reading adjustCanvas would find content
    // and compound the adjustment frame over frame. It must report nothing to build.
    const mgr = { paintCanvas: new FakeCanvas(30, 30) };
    Paint.prototype.beginAdjust.call(mgr);
    mgr.adjustCanvas.data.fill(255);
    assert.strictEqual(Paint.prototype._ensureAdjustField.call(mgr, 0), false, 'the field came from the preview, not the pristine copy');
    assert.strictEqual(Paint.prototype._ensureAdjustField.call({}, 0), false, 'no session must build nothing');
});

test('endAdjust frees the buffers, reports whether a preview was up, and is idempotent', async () => {
    const { Mask, Paint } = await load();
    for (const [C, key] of [[Mask, 'maskCanvas'], [Paint, 'paintCanvas']]) {
        const mgr = { [key]: blob(40, 40) };
        C.prototype.beginAdjust.call(mgr);
        C.prototype._ensureAdjustField.call(mgr, 0);
        const { adjustCanvas, _adjustPristine } = mgr;
        mgr.hasAdjustPreview = true;
        assert.strictEqual(C.prototype.endAdjust.call(mgr), true);
        assert.strictEqual(adjustCanvas.width + _adjustPristine.width, 0, 'a buffer was left allocated');
        for (const k of ['adjustCanvas', 'adjustCtx', '_adjustPristine', '_adjustField', '_adjustImg', '_adjustBox']) {
            assert.strictEqual(mgr[k], null, `${C.name} kept ${k}`);
        }
        assert.strictEqual(mgr._adjustPad, 0);
        assert.strictEqual(mgr.hasAdjustPreview, false);
        assert.strictEqual(C.prototype.endAdjust.call(mgr), false, 'a second end reported a preview');
    }
});

test('Fill finds the holes in what is ON SCREEN — the preview when one is up, the layer otherwise', async () => {
    const { Mask, Paint } = await load();
    for (const [C, key] of [[Mask, 'maskCanvas'], [Paint, 'paintCanvas']]) {
        const mgr = { [key]: ring(40, 40) };
        const found = C.prototype._findHoles.call(mgr);
        assert.ok(found, `${C.name} found no hole in a ring`);
        assert.strictEqual(found.src, mgr[key], 'with no preview, Fill must read the layer');
        const { box } = found.region;
        assert.ok(box.x <= 13 && box.y <= 13 && box.x + box.w >= 27 && box.y + box.h >= 27, 'the region does not cover the hole');

        // A preview with no hole over a layer with one: the preview is what the user sees.
        C.prototype.beginAdjust.call(mgr);
        mgr.adjustCanvas.data.set(blob(40, 40).data);
        mgr.hasAdjustPreview = true;
        assert.strictEqual(C.prototype._findHoles.call(mgr), null, 'Fill read the layer under a live preview');
        // And the other way round: preview with a hole, layer without.
        mgr[key] = blob(40, 40);
        mgr.adjustCanvas.data.set(ring(40, 40).data);
        assert.strictEqual(C.prototype._findHoles.call(mgr)?.src, mgr.adjustCanvas);

        assert.strictEqual(C.prototype._findHoles.call({ [key]: blob(40, 40) }), null, 'a solid shape has a hole');
        assert.strictEqual(C.prototype._findHoles.call({ [key]: null }), null);
    }
});
