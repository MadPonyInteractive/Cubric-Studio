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

// MPI-1232 — overlapFor: 20% of tile, floor 64.
test('overlapFor returns 20% of tile size, clamped to 64', async () => {
    const { overlapFor } = await load('js/utils/tileCount.js');
    assert.equal(overlapFor(256), 64,  '20% of 256 = 51.2 → floor to 64');
    assert.equal(overlapFor(512), 102, '20% of 512 = 102.4 → rounds to 102');
    assert.equal(overlapFor(768), 154, '20% of 768 = 153.6 → rounds to 154');
    assert.equal(overlapFor(1024), 205, '20% of 1024 = 204.8 → rounds to 205');
    assert.equal(overlapFor(1536), 307, '20% of 1536 = 307.2 → rounds to 307');
});

// MPI-1232 — tileRects: port of ImpactMakeTileSEGS, ASC-sorted by (x1, y1).
test('tileRects returns the correct number of rects and sorts ASC by x1, y1', async () => {
    const { tileRects } = await load('js/utils/tileCount.js');
    // 1920x1080 at 2x = 3840x2160, default bbox 1024, overlap overlapFor(1024)=205.
    const rects = tileRects(1920, 1080, 2);
    assert.equal(rects.length, 15, '3840x2160 yields 15 tiles');
    // Every rect is {x1,y1,x2,y2}.
    assert.ok(rects.every(r => typeof r.x1 === 'number' && typeof r.y1 === 'number'));
    // ASC sort: x1 non-decreasing; within same x1, y1 non-decreasing.
    for (let i = 1; i < rects.length; i++) {
        const prev = rects[i - 1], cur = rects[i];
        assert.ok(cur.x1 > prev.x1 || (cur.x1 === prev.x1 && cur.y1 >= prev.y1), `rect ${i} is out of ASC order`);
    }
    // With bbox 512 the count is different (smaller tiles → more tiles).
    const small = tileRects(1920, 1080, 2, { bbox: 512, overlap: 102 });
    assert.ok(small.length > 15, 'smaller bbox yields more tiles');
});

test('tileRects count matches tileCount for the same args', async () => {
    const { tileRects, tileCount } = await load('js/utils/tileCount.js');
    for (const [w, h, f] of [[800, 533, 2], [1344, 768, 2], [1920, 1080, 2], [4000, 6000, 2]]) {
        assert.equal(tileRects(w, h, f).length, tileCount(w, h, f), `${w}x${h}@${f}x`);
    }
});

// MPI-1237 — the status bar's stage total and the number Cosmo is told are ONE function.
test('runTileCount: a resolved tile run counts from the picture on disk, anything else is 0', async () => {
    const { runTileCount } = await load('js/utils/tileCount.js');
    const asked = [];
    global.fetch = async (url) => { asked.push(url); return { ok: true, json: async () => ({ width: 1920, height: 1080 }) }; };
    try {
        // default tile size 1024, 1920x1080 at 2x = 15 tiles (unchanged from old overlap=200 path)
        assert.equal(await runTileCount({ Input_Tile_Upscale: true, Input_Upscale_Factor: 2 }, 'C:/p/a.png'), 15);
        assert.match(asked[0], /image-size\?path=C%3A%2Fp%2Fa\.png/);
        assert.equal(await runTileCount({ Input_Tile_Upscale: false, Input_Upscale_Factor: 2 }, 'C:/p/a.png'), 0, 'tiles off');
        assert.equal(await runTileCount({ Input_Tile_Upscale: true }, 'http://x/a.png'), 0, 'not a disk path');
        // Input_Tile_Size is respected
        global.fetch = async () => ({ ok: true, json: async () => ({ width: 1920, height: 1080 }) });
        const big = await runTileCount({ Input_Tile_Upscale: true, Input_Upscale_Factor: 2, Input_Tile_Size: 512 }, 'C:/p/a.png');
        assert.ok(big > 15, 'smaller tile size yields more tiles');
        global.fetch = async () => ({ ok: false });
        assert.equal(await runTileCount({ Input_Tile_Upscale: true }, 'C:/p/a.png'), 0, 'unreadable size');
    } finally {
        delete global.fetch;
    }
});
