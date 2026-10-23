'use strict';

// MPI-1232 Phase 3 — Describe each tile. The names reach Impact's tile detailer keyed by LABEL
// (`[CONCAT][LAB][t0]..`), because the person mask empties tiles AFTER they are labelled: an
// ordered list would shift every name after the first emptied tile.

const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const load = (rel) => import(pathToFileURL(path.join(__dirname, '..', ...rel.split('/'))).href);

// Impact's own parser (wildcards.py split_to_dict + WildcardChooserDict.get), so the test reads
// the string the way the graph does.
function impactLab(wildcard) {
    assert.ok(wildcard.startsWith('[CONCAT][LAB]'), wildcard);
    const items = {};
    for (const [, k, v] of wildcard.slice(8).matchAll(/\[([A-Za-z0-9_. ]+)\]([^[]+)(?=\[|$)/g)) items[k] = v.trim();
    return (label) => items[label] ?? '';
}

const config = (extra = {}) => ({
    operation: 'upscale',
    mediaItems: [{ url: '/project-file?path=C%3A%5Cp%5Cpic.png', mediaType: 'image', role: 'inputImage' }],
    injectionParams: { Input_Tile_Upscale: true, Tile_Describe: true, Input_Upscale_Factor: 2, Input_Tile_Size: 1024, Input_Tile_Overlap: 205, ...extra },
});
const runJob = (label, fn) => fn(() => {});

test('every tile is named in MakeTileSEGS cut order, keyed by its label', async () => {
    const { nameTiles } = await load('js/services/tileDescribe.js');
    const { tileRects } = await load('js/utils/tileCount.js');
    const rects = tileRects(1920, 1080, 2, { bbox: 1024, overlap: 205 });
    let outlined;
    const r = await nameTiles(config(), {
        size: async (p) => (assert.equal(p, 'C:\\p\\pic.png'), { width: 1920, height: 1080 }),
        outlines: async (_, fr) => { outlined = fr; return fr.map((_, i) => `img${i}`); },
        describe: async ({ imagePath }) => ({ ok: true, text: `"tile ${imagePath.slice(3)}."` }),
        job: runJob,
    });
    assert.equal(r.total, 15);
    assert.equal(r.named, 15);
    assert.equal(r.failed, 0);
    // The outline of tile i is rect i, as a fraction of the 3840x2160 output.
    assert.deepEqual(outlined[1], { x1: rects[1].x1 / 3840, y1: rects[1].y1 / 2160, x2: rects[1].x2 / 3840, y2: rects[1].y2 / 2160 });
    const lab = impactLab(r.injectionParams.Input_Tile_Prompts);
    for (let i = 0; i < 15; i++) assert.equal(lab(`t${i}`), `tile ${i}`);
    assert.equal(r.injectionParams.Input_Tile_Labels, Array.from({ length: 15 }, (_, i) => `t${i}`).join(','));
});

test('a tile the person mask empties shifts no other name', async () => {
    const { tileWildcard } = await load('js/services/tileDescribe.js');
    const names = ['sky', 'brick wall', 'mural', 'court'];
    const { Input_Tile_Prompts, Input_Tile_Labels } = tileWildcard(names);
    const lab = impactLab(Input_Tile_Prompts);
    // SEGSLabelAssign labels all four; the mask then empties t1 and the detailer skips it.
    const labels = Input_Tile_Labels.split(',');
    const sampled = labels.filter((l) => l !== 't1');
    assert.deepEqual(sampled.map(lab), ['sky', 'mural', 'court']);
});

test('a failed caption leaves that tile prompt-less and never fails the run', async () => {
    const { nameTiles } = await load('js/services/tileDescribe.js');
    const r = await nameTiles(config(), {
        size: async () => ({ width: 1344, height: 768 }),
        outlines: async (_, fr) => fr.map((_, i) => `img${i}`),
        describe: async ({ imagePath }) => (imagePath === 'img2'
            ? { ok: false, error: 'The describer timed out.' }
            : { ok: true, text: `name ${imagePath.slice(3)}` }),
        job: runJob,
    });
    assert.equal(r.total, 8);
    assert.equal(r.named, 7);
    assert.equal(r.failed, 1);
    assert.equal(r.error, 'The describer timed out.');
    const lab = impactLab(r.injectionParams.Input_Tile_Prompts);
    assert.equal(lab('t2'), '', 'no entry: the base prompt alone');
    assert.equal(lab('t3'), 'name 3');
    assert.ok(!r.injectionParams.Input_Tile_Prompts.includes('[t2]'));
});

test('no tile named = the graph default (empty wildcard), outlines failing included', async () => {
    const { nameTiles, tileWildcard } = await load('js/services/tileDescribe.js');
    assert.equal(tileWildcard(['', '']).Input_Tile_Prompts, '');
    const r = await nameTiles(config(), {
        size: async () => ({ width: 1344, height: 768 }),
        outlines: async () => { throw new Error('disk full'); },
        describe: async () => assert.fail('no describe without pictures'),
        job: runJob,
    });
    assert.equal(r.injectionParams, undefined);
    assert.equal(r.failed, 8);
    assert.equal(r.error, 'disk full');
});

test('a Stopped describe stops the naming (and the upscale)', async () => {
    const { nameTiles } = await load('js/services/tileDescribe.js');
    let asked = 0;
    const r = await nameTiles(config(), {
        size: async () => ({ width: 1344, height: 768 }),
        outlines: async (_, fr) => fr.map((_, i) => `img${i}`),
        describe: async () => (++asked === 2 ? { ok: false, cancelled: true } : { ok: true, text: 'grass' }),
        job: runJob,
    });
    assert.equal(r.cancelled, true);
    assert.equal(asked, 2);
});

test('a name dropped for people words is not a failed tile (MPI-1257)', async () => {
    const { nameTiles } = await load('js/services/tileDescribe.js');
    let i = 0;
    const r = await nameTiles(config(), {
        size: async () => ({ width: 1920, height: 1080 }),
        outlines: async (_, fr) => fr.map((_, n) => `img${n}`),
        describe: async () => ({ ok: true, text: i++ === 1 ? "a girl's hand" : 'sky' }),
        job: runJob,
    });
    assert.equal(r.named, r.total - 1);
    assert.equal(r.failed, 0, 'no "could not be named" toast for a dropped name');
});

test('a paid describer\'s bill is summed over every tile (MPI-1257)', async () => {
    const { nameTiles } = await load('js/services/tileDescribe.js');
    const io = (cost) => ({
        size: async () => ({ width: 1920, height: 1080 }),
        outlines: async (_, fr) => fr.map((_, i) => `img${i}`),
        describe: async () => ({ ok: true, text: 'sky', ...(cost && { costUsd: cost }) }),
        job: runJob,
    });
    const paid = await nameTiles(config(), io(0.001));
    assert.equal(paid.total, 15);
    assert.ok(Math.abs(paid.costUsd - 0.015) < 1e-9, String(paid.costUsd));
    assert.equal('costUsd' in await nameTiles(config(), io(0)), false, 'a free describer reports no cost');
});

test('names are cleaned for Impact: one line, no quotes or dot, no brackets', async () => {
    const { cleanTileName, wantsTileNames } = await load('js/services/tileDescribe.js');
    assert.equal(cleanTileName('"A field with green grass."\nThe rest'), 'A field with green grass');
    assert.equal(cleanTileName('  [cloudy] sky  '), 'cloudy sky');
    assert.equal(cleanTileName(undefined), '');
    assert.equal(cleanTileName('a red rectangle outline'), '', 'the marker is never a name');
    // MPI-1257: live names on tiles a person only partly covers never reach the graph.
    assert.equal(cleanTileName('curly gray hair and beard'), '');
    assert.equal(cleanTileName("a man's shoulder and neck"), '');
    assert.equal(cleanTileName('Her Face.'), '');
    assert.equal(cleanTileName('an anime character in flight'), '');
    assert.equal(cleanTileName('a blue superhero costume'), '');
    // Scenery that merely contains a people word's letters stays named.
    assert.equal(cleanTileName('wooden armchair by a window'), 'wooden armchair by a window');
    assert.equal(cleanTileName('a headland over the sea'), 'a headland over the sea');
    assert.equal(cleanTileName('there are shells here'), 'there are shells here');
    assert.equal(wantsTileNames(config()), true);
    assert.equal(wantsTileNames(config({ Tile_Describe: false })), false);
    assert.equal(wantsTileNames(config({ Input_Tile_Upscale: false })), false);
});
