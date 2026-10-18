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

// MPI-1175 — the tile count is also the status bar's stage total on a Use Tiles run.
// Each tile is one same-length sampler bar (Krea 2: 0/3 .. 3/3, then 0/3 again), so the
// counter must read 1/N .. N/N and never climb past N.
test('one sampler bar per tile reads 1/N .. N/N under the tile total', async () => {
    const { tileCount } = await load('js/utils/tileCount.js');
    const { createStageProgress } = await load('js/services/phaseProgress.js');
    const tiles = tileCount(800, 533, 1);
    const p = createStageProgress({ stages: tiles });
    const seen = [];
    for (let t = 0; t < tiles; t++) {
        for (let v = 0; v <= 3; v++) p.step(v, 3);
        seen.push(`${p.stage()}/${p.total()}`);
    }
    assert.deepEqual(seen, ['1/3', '2/3', '3/3']);
});
