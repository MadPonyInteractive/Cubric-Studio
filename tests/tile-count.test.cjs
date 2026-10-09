'use strict';

// MPI-1038 — the Use Tiles tile count is a port of Impact's MakeTileSEGS maths. These
// counts were derived from the node's own source; a change to the port or to the graph's
// tile widgets (1024 / 200 / 0.7) shows up here first.

const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const load = (rel) => import(pathToFileURL(path.join(__dirname, '..', ...rel.split('/'))).href);

test('tile count follows the OUTPUT size, as MakeTileSEGS cuts it', async () => {
    const { tileCount } = await load('js/utils/tileCount.js');
    // A small picture: the tile clamps to the short side, so one row - and at 1.0 that
    // row is three 533 px tiles, each seeing most of the picture through crop 1.5.
    assert.equal(tileCount(800, 533, 2), 2);
    assert.equal(tileCount(800, 533, 1), 3);
    assert.equal(tileCount(1344, 768, 2), 8);
    assert.equal(tileCount(1920, 1080, 2), 15);
    // A camera photo: the reason the count is shown at all.
    assert.equal(tileCount(4000, 6000, 2), 150);
    assert.equal(tileCount(4000, 6000, 1), 40);
    // Portrait and landscape cut the same.
    assert.equal(tileCount(6000, 4000, 2), tileCount(4000, 6000, 2));
});

test('a picture with no size has no tiles', async () => {
    const { tileCount } = await load('js/utils/tileCount.js');
    assert.equal(tileCount(0, 0, 2), 0);
    assert.equal(tileCount(NaN, 512, 2), 0);
});
