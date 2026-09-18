'use strict';
// MPI-771 Decision 15: mask by colour (js/utils/colourKeyMask.js).
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

let colourKeyMask, cornerColour, hexToRgb;
before(async () => {
    ({ colourKeyMask, cornerColour, hexToRgb } = await import(
        pathToFileURL(path.join(__dirname, '..', 'js', 'utils', 'colourKeyMask.js')).href));
});

// 5x5: grey background, a dark ring at x/y 1..3 enclosing a grey pocket at (2,2).
const BG = [200, 198, 200], RING = [40, 20, 30];
function image({ pocket = BG, corner = BG, transparentAt = -1 } = {}) {
    const w = 5, h = 5, rgba = new Uint8Array(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const ring = x >= 1 && x <= 3 && y >= 1 && y <= 3;
        const c = (x === 2 && y === 2) ? pocket : ring ? RING : (i === 0 ? corner : BG);
        rgba.set([...c, i === transparentAt ? 0 : 255], i * 4);
    }
    return { rgba, w, h };
}
const at = (mask, x, y) => mask[y * 5 + x];

test('keys out the background and the enclosed pocket; keeps the subject', () => {
    const { rgba, w, h } = image();
    const m = colourKeyMask(rgba, w, h, { key: BG, tolerance: 16 });
    assert.equal(at(m, 0, 0), 0);
    assert.equal(at(m, 4, 4), 0);
    assert.equal(at(m, 1, 1), 255);
    assert.equal(at(m, 2, 2), 0, 'pocket keyed when edgesOnly is off');
});

test('edgesOnly keeps a same-coloured patch the subject encloses', () => {
    const { rgba, w, h } = image();
    const m = colourKeyMask(rgba, w, h, { key: BG, tolerance: 16, edgesOnly: true });
    assert.equal(at(m, 0, 0), 0);
    assert.equal(at(m, 4, 2), 0);
    assert.equal(at(m, 2, 2), 255, 'enclosed pocket survives');
    assert.equal(at(m, 3, 3), 255);
});

test('tolerance is the largest per-channel difference, inclusive', () => {
    const { rgba, w, h } = image({ pocket: [200, 198 + 20, 200] });
    assert.equal(at(colourKeyMask(rgba, w, h, { key: BG, tolerance: 20 }), 2, 2), 0);
    assert.equal(at(colourKeyMask(rgba, w, h, { key: BG, tolerance: 19 }), 2, 2), 255);
});

test('an already transparent pixel is keyed out whatever its colour', () => {
    const { rgba, w, h } = image({ transparentAt: 6 }); // (1,1), a ring pixel
    assert.equal(at(colourKeyMask(rgba, w, h, { key: BG, tolerance: 0 }), 1, 1), 0);
});

test('selectMatching flips the polarity (the image tools select the colour)', () => {
    const { rgba, w, h } = image();
    const m = colourKeyMask(rgba, w, h, { key: BG, tolerance: 16, edgesOnly: true, selectMatching: true });
    assert.equal(at(m, 0, 0), 255);
    assert.equal(at(m, 1, 1), 0);
    assert.equal(at(m, 2, 2), 0, 'the enclosed pocket is not selected with edgesOnly');
});

test('cornerColour / hexToRgb round-trip', () => {
    const { rgba } = image({ corner: [10, 171, 255] });
    assert.equal(cornerColour(rgba), '#0aabff');
    assert.deepEqual(hexToRgb('#0aabff'), [10, 171, 255]);
});

test('no default key colour when the corner is transparent (MPI-771)', () => {
    // An already-cut frame: the corner is alpha 0 and its RGB is whatever the old
    // mask hid (a real cut of Fabio's robot reads #c8c6c8 there), so keying it
    // would remove a colour nobody can see and eat the subject's dark outline.
    const { rgba } = image({ corner: [200, 198, 200], transparentAt: 0 });
    assert.equal(cornerColour(rgba), null);
});
