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
    const [[, show]] = byTitle(g, 'Output_Display');
    assert.deepEqual(show.inputs.images, ['106', 0]);
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

test('a spec naming a node the graph lacks refuses instead of running a wrong graph', async () => {
    const { cloudEditPass1, cloudEditPass2 } = await load();
    assert.throws(() => cloudEditPass1(SCRIBBLE, { ...SPEC, input: '999' }), /cloudEdit\.input/);
    assert.throws(() => cloudEditPass2(SCRIBBLE, { ...SPEC, output: '999' }, { width: 1, height: 1 }), /cloudEdit\.output/);
});
