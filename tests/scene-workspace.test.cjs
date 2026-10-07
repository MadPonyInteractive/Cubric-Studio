'use strict';

// MPI-623 (plan A9) — which cards the gallery offers "Convert to 360 pano" on. Offered,
// never guessed: the app cannot tell a pano from a 2:1 banner, so the user says which.
// Wrong one way, the row appears on a card that is already a scene (Convert would
// overwrite its records) or on a GIF/video; wrong the other way, a real pano can never
// become a scene.

const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const esm = (p) => import(pathToFileURL(path.join(__dirname, '..', p)).href);

const still = (w, h, extra = {}) => ({ type: 'image', filePath: '/project-file?path=a.png', pixelDimensions: { w, h }, ...extra });
const card = (history, selectedIndex = 0, type = 'image') => ({ id: 'g1', type, history, selectedIndex });

test('a plain image card at exactly 2:1 is offered Convert', async () => {
    const { canConvertToPano } = await esm('js/utils/assetKinds.js');
    assert.equal(canConvertToPano(card([still(4096, 2048)])), true);
});

test('not 2:1, unknown size, a GIF, a video, a stack: no Convert', async () => {
    const { canConvertToPano } = await esm('js/utils/assetKinds.js');
    assert.equal(canConvertToPano(card([still(4096, 2047)])), false, 'near-2:1 is a banner as far as the maths knows');
    assert.equal(canConvertToPano(card([still(0, 0)])), false, 'an item with no measured size');
    assert.equal(canConvertToPano(card([still(2048, 1024, { gif: { frames: [] } })])), false, 'a GIF');
    assert.equal(canConvertToPano(card([{ type: 'video', pixelDimensions: { w: 2048, h: 1024 } }], 0, 'video')), false);
    assert.equal(canConvertToPano({ id: 's', type: 'stack', members: ['g1'] }), false);
    assert.equal(canConvertToPano(null), false);
});

test('a card that already HAS a scene is never offered Convert, whichever entry is selected', async () => {
    const { canConvertToPano } = await esm('js/utils/assetKinds.js');
    const history = [still(4096, 2048, { scenePath: '/project-file?path=.meta/x.scene.json' }), still(2048, 1024)];
    assert.equal(canConvertToPano(card(history, 1)), false, 'selected picture is a plain 2:1 still, the card is a scene');
    assert.equal(canConvertToPano(card([still(2048, 1024, { splatPath: '/x.ply' })])), false);
});

test('the SELECTED entry decides the shape', async () => {
    const { canConvertToPano } = await esm('js/utils/assetKinds.js');
    const history = [still(1024, 1024), still(4096, 2048)];
    assert.equal(canConvertToPano(card(history, 0)), false);
    assert.equal(canConvertToPano(card(history, 1)), true);
});
