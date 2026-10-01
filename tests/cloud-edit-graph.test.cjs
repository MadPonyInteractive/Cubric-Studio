'use strict';

/**
 * cloud-edit-graph.test.cjs — MPI-918, the two passes that run a Flow's edit stage in the
 * cloud. The point of both is what is NOT left in the graph: ComfyUI validates every node an
 * output reaches, so a local loader still wired in refuses the prompt for a user who lacks
 * that model, the very user a cloud pick serves.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const SCRIBBLE = require(path.join(__dirname, '..', 'comfy_workflows', 'flow_scribble.json'));
const SPEC = { input: '106', prompt: '185', output: '168' };
const LOCAL_ONLY = ['UNETLoader', 'CLIPLoader', 'VAELoader', 'MpiLoraModel', 'SamplerCustomAdvanced', 'VAEDecode'];

const load = () => import('../js/utils/cloudEditGraph.js');
const classes = (g) => Object.values(g).map(n => n.class_type);
const byTitle = (g, t) => Object.entries(g).filter(([, n]) => n._meta?.title === t);

test('pass 1 keeps only what the edit stage is fed, and taps the picture and the prompt', async () => {
    const { cloudEditPass1 } = await load();
    const g = cloudEditPass1(SCRIBBLE, SPEC);
    for (const c of LOCAL_ONLY) assert.ok(!classes(g).includes(c), `${c} must not be in pass 1`);
    assert.equal(byTitle(g, 'Output_Image').length, 0, 'no card-making output survives');
    const [[showId, show]] = byTitle(g, 'Output_Display');
    assert.deepEqual(show.inputs.images, ['106', 0]);
    assert.equal(showId, (await load()).CLOUD_TAPS.input, 'the tap is read back by this id');
    const [[, text]] = byTitle(g, 'Output_prompt');
    assert.deepEqual(text.inputs.source, ['185', 0]);
    // The drawing loader and every string the prompt is joined from are still there.
    for (const id of ['1', '106', '17', '18', '103', '184', '185']) assert.ok(g[id], `node ${id} kept`);
    assert.ok(SCRIBBLE['102'], 'the source graph itself is untouched');
});

test('pass 2 swaps the decode for the fitted cloud picture and drops the local branch', async () => {
    const { cloudEditPass2, CLOUD_RESULT_TITLE } = await load();
    const g = cloudEditPass2(SCRIBBLE, SPEC, { width: 896, height: 1152 });
    for (const c of LOCAL_ONLY) assert.ok(!classes(g).includes(c), `${c} must not be in pass 2`);
    assert.equal(g['168'].class_type, 'ImageScale');
    assert.equal(g['168'].inputs.width, 896);
    assert.equal(g['168'].inputs.height, 1152);
    const [[loadId, loader]] = byTitle(g, CLOUD_RESULT_TITLE);
    assert.equal(loader.class_type, 'MpiLoadImage');
    assert.deepEqual(g['168'].inputs.image, [loadId, 0]);
    // Everything after the edit runs as it does locally, still reading node 168.
    assert.deepEqual(g['170'].inputs.passthrough, ['168', 0]);
    assert.equal(byTitle(g, 'Output_Image').length, 1);
    assert.equal(SCRIBBLE['168'].class_type, 'VAEDecode', 'the source graph itself is untouched');
});

// Object Stamp: two references, the second chosen by `Input_Mode` (220) as the graph's own
// `Ref2_Select` chooses it. The pass reads the mode the graph was INJECTED with.
const STAMP = require(path.join(__dirname, '..', 'comfy_workflows', 'flow_object_stamp.json'));
const STAMP_SPEC = { input: '211', input2: { mode: '220', 1: '106', 2: '201' }, prompt: '185', output: '168' };
const stampIn = (mode) => ({ ...STAMP, 220: { ...STAMP['220'], inputs: { ...STAMP['220'].inputs, int: mode } } });

for (const [mode, ref2, name] of [[1, '106', 'Auto: the stamped crop'], [2, '201', 'Manual: the clean object']]) {
    test(`Object Stamp pass 1, ${name}: image one is the clean crop, image two follows the mode`, async () => {
        const { cloudEditPass1, CLOUD_TAPS } = await load();
        const g = cloudEditPass1(stampIn(mode), STAMP_SPEC);
        for (const c of LOCAL_ONLY) assert.ok(!classes(g).includes(c), `${c} must not be in pass 1`);
        assert.equal(byTitle(g, 'Output_Image').length, 0, 'no card-making output survives');
        assert.deepEqual(g[CLOUD_TAPS.input].inputs.images, ['211', 0]);
        assert.deepEqual(g[CLOUD_TAPS.input2].inputs.images, [ref2, 0]);
        assert.equal(byTitle(g, 'Output_Display').length, 2, 'both taps are display nodes, never cards');
        assert.deepEqual(byTitle(g, 'Output_prompt')[0][1].inputs.source, ['185', 0]);
        // Both scene and object loaders, and the mode-switched prompt, are still fed.
        for (const id of ['1', '2', '185', '220', '223', ref2]) assert.ok(g[id], `node ${id} kept`);
    });
}

test('Object Stamp pass 1 refuses a mode it has no image two for', async () => {
    const { cloudEditPass1 } = await load();
    assert.throws(() => cloudEditPass1(stampIn(3), STAMP_SPEC), /cloudEdit\.input2/);
});

test('Object Stamp pass 2 stitches the cloud picture back through the mode\'s own crop', async () => {
    const { cloudEditPass2, CLOUD_RESULT_TITLE } = await load();
    const g = cloudEditPass2(stampIn(2), STAMP_SPEC, { width: 1024, height: 1024 });
    for (const c of LOCAL_ONLY) assert.ok(!classes(g).includes(c), `${c} must not be in pass 2`);
    assert.equal(g['168'].class_type, 'ImageScale');
    assert.deepEqual(g['168'].inputs.image, [byTitle(g, CLOUD_RESULT_TITLE)[0][0], 0]);
    assert.deepEqual(g['192'].inputs.image_target, ['168', 0], 'colour match reads the cloud picture');
    // The crop the stitch undoes is still the one Input_Mode chose.
    for (const id of ['163', '169', '221', '220']) assert.ok(g[id], `node ${id} kept`);
    assert.equal(byTitle(g, 'Output_Image').length, 1);
});

test('a spec naming a node the graph lacks refuses instead of running a wrong graph', async () => {
    const { cloudEditPass1, cloudEditPass2 } = await load();
    assert.throws(() => cloudEditPass1(SCRIBBLE, { ...SPEC, input: '999' }), /cloudEdit\.input/);
    assert.throws(() => cloudEditPass2(SCRIBBLE, { ...SPEC, output: '999' }, { width: 1, height: 1 }), /cloudEdit\.output/);
});
