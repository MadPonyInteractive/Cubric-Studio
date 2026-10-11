/**
 * flow-pano360.test.cjs — MPI-623. The 360 Panorama Flow ENDS WITH CONVERT.
 *
 * The card it lands goes through the same `convertToPano` as the gallery's right-click, so
 * it opens in the Scene workspace like any converted card (plan A9). `sceneCallbacks` takes
 * the convert as an argument so it runs here without an engine. The graph half: both
 * branches hang off ONE lazy MpiIfElse on the picture loader's `loaded`, so a run with no
 * picture never touches the outpaint branch (and the reverse).
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const load = () => import('file://' + path.join(root, 'js/services/flowService.js').replace(/\\/g, '/'));
const PROJECT = { id: 'p1', folderPath: 'C:/x' };
const RESULT = { item: { id: 'i1' }, group: { id: 'g1' } };

test('the scene is built BEFORE the caller hears the run is done', async () => {
    const { sceneCallbacks } = await load();
    const order = [];
    const cb = sceneCallbacks({ onComplete: (r) => order.push(['done', r]) }, PROJECT,
        async (project, group, item) => { order.push(['convert', project, group, item]); });
    await cb.onComplete(RESULT);
    assert.deepStrictEqual(order, [['convert', PROJECT, RESULT.group, RESULT.item], ['done', RESULT]]);
});

test('a failed convert still reports done (the pano card is real), never throws', async () => {
    const { sceneCallbacks } = await load();
    let done = null;
    const cb = sceneCallbacks({ onComplete: (r) => { done = r; } }, PROJECT, async () => { throw new Error('no moge'); });
    await cb.onComplete(RESULT);
    assert.strictEqual(done, RESULT);
});

test('only a landsAsScene flow is wrapped, on its first call only', () => {
    const src = fs.readFileSync(path.join(root, 'js/services/flowService.js'), 'utf8');
    assert.match(src, /if \(flow\.landsAsScene && _leg\.index === undefined && !runMediaItems\) \{\s*callbacks = sceneCallbacks\(/);
});

test('graph: one lazy switch on the loader picks text or picture', () => {
    const g = JSON.parse(fs.readFileSync(path.join(root, 'comfy_workflows/flow_pano360.json'), 'utf8'));
    const byTitle = Object.fromEntries(Object.entries(g).map(([id, n]) => [n._meta.title, { id, ...n }]));
    const img = byTitle.Input_Image;
    assert.strictEqual(img.class_type, 'MpiLoadImage');
    assert.strictEqual(img.inputs.block_if_empty, false, 'an empty picture must fall through to text, not block');
    const sw = Object.values(g).find(n => n.class_type === 'MpiIfElse');
    assert.deepStrictEqual(sw.inputs.boolean, [img.id, 4], 'the switch reads the loader\'s `loaded`');
    assert.strictEqual(byTitle.Output_Image.inputs.images[0], Object.keys(g).find(k => g[k] === sw));
    // the flat-sky soften sits before the picture branch's 0.45 seam pass (Fabio, 2026-10-06)
    assert.ok(Object.values(g).some(n => n.class_type === 'MpiWrapSoften'));
    for (const t of ['Input_Positive', 'Input_Seed']) assert.ok(byTitle[t], t);
});
