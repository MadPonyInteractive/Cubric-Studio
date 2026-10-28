/**
 * flow-pano360.test.cjs — MPI-623. The 360 Panorama Flow's graph.
 *
 * The Flow lands ONLY the panorama picture; Convert is the user's right-click (Fabio,
 * 2026-10-11). Both branches hang off ONE lazy MpiIfElse on the picture loader's `loaded`,
 * so a run with no picture never touches the outpaint branch (and the reverse).
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

test('graph: one lazy switch on the loader picks text or picture', () => {
    const g = JSON.parse(fs.readFileSync(path.join(root, 'comfy_workflows/flow_pano360.json'), 'utf8'));
    const byTitle = Object.fromEntries(Object.entries(g).map(([id, n]) => [n._meta.title, { id, ...n }]));
    const img = byTitle.Input_Image;
    assert.strictEqual(img.class_type, 'MpiLoadImage');
    assert.strictEqual(img.inputs.block_if_empty, false, 'an empty picture must fall through to text, not block');
    const sw = Object.values(g).find(n => n.class_type === 'MpiIfElse');
    assert.deepStrictEqual(sw.inputs.boolean, [img.id, 4], 'the switch reads the loader\'s `loaded`');
    // the switch reaches the output through an MpiClearVram passthrough (MPI-1324)
    const clear = g[byTitle.Output_Image.inputs.images[0]];
    assert.strictEqual(clear.class_type, 'MpiClearVram');
    assert.strictEqual(clear.inputs.passthrough[0], Object.keys(g).find(k => g[k] === sw));
    // the flat-sky soften sits before the picture branch's 0.45 seam pass (Fabio, 2026-10-06)
    assert.ok(Object.values(g).some(n => n.class_type === 'MpiWrapSoften'));
    for (const t of ['Input_Positive', 'Input_Seed']) assert.ok(byTitle[t], t);
});
