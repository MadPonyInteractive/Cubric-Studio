'use strict';

/**
 * control-custom-size.test.cjs — MPI-1271.
 *
 * Control gets the Custom size button on a model naming `control` in `customSizeOps`: on,
 * the graph pads image 1 to the picked ratio + tier; off, the control follows its source as
 * before. Every other model's control keeps following its source, with no button and no
 * picker, until its graph learns the padded path.
 */

const assert = require('node:assert/strict');
const test = require('node:test');

const { resolveNamedParams } = require('../js/data/generationControls.js');
const { MODELS } = require('../js/data/modelConstants/models.js');

const QWEN21 = MODELS.find((m) => m.id === 'qwen-image-2-1');
const RATIO = { shared: { image: { ratioSelector: { selectedRatio: '1:1', orientation: 'portrait' } } } };
const optedIn = (m) => m.customSizeOps?.includes('control');
const controlModels = MODELS.filter((m) => m.supportedOps?.includes('control'));

test('the button and its picker exist on control exactly where the model opts in', async () => {
    const { modelShowsRatio, modelShowsCustomSize } = await import('../js/data/commandRegistry.js');
    assert.ok(optedIn(QWEN21));
    for (const m of controlModels) {
        assert.equal(modelShowsCustomSize(m, 'control'), !!optedIn(m), m.id);
        assert.equal(modelShowsRatio(m, 'control'), !!optedIn(m), `${m.id}: no picker without the button`);
    }
    // The edit family is unchanged.
    assert.equal(modelShowsCustomSize(QWEN21, 'edit'), true);
});

test('prompt box: the button mounts before ratio + tier on an opted-in control', async () => {
    const { visibleControlIds } = await import('../js/components/Organisms/MpiPromptBox/PromptBoxControls.js');
    const ids = visibleControlIds(QWEN21, 'control', {});
    assert.ok(ids.includes('customSize'));
    assert.ok(ids.indexOf('customSize') < ids.indexOf('ratio'));
    for (const m of controlModels.filter((x) => !optedIn(x))) {
        const other = visibleControlIds(m, 'control', {});
        assert.ok(!other.includes('customSize') && !other.includes('ratio'), m.id);
    }
});

test('agent control: off by default, a named ratio turns it on and sizes the run', () => {
    const off = resolveNamedParams(RATIO, QWEN21, 'control', {});
    assert.equal(off.ok, true);
    assert.equal(off.injectionParams.Input_custom_size, false);
    assert.equal(off.injectionParams.Width, undefined);
    const on = resolveNamedParams(RATIO, QWEN21, 'control', { ratio: '1:1' });
    assert.equal(on.injectionParams.Input_custom_size, true);
    assert.ok(on.injectionParams.Width > 0);
});

test('agent control on a model that has not opted in: no flag, no size', () => {
    for (const m of controlModels.filter((x) => !optedIn(x))) {
        const r = resolveNamedParams(RATIO, m, 'control', {});
        assert.equal(r.ok, true, m.id);
        assert.equal('Input_custom_size' in r.injectionParams, false, m.id);
        assert.equal(r.injectionParams.Width, undefined, m.id);
    }
});

test('every local control graph pads behind ONE Input_custom_size, so every control model opts in', () => {
    const fs = require('node:fs');
    const path = require('node:path');
    for (const m of controlModels.filter((x) => x.workflows?.control)) {
        const graph = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'comfy_workflows', m.workflows.control), 'utf8'));
        const nodes = Object.values(graph);
        assert.equal(nodes.filter((n) => n._meta?.title === 'Input_custom_size').length, 1, m.id);
        assert.ok(nodes.some((n) => n.class_type === 'MpiImageResize' && n.inputs.keep_proportion === 'pad'), m.id);
        assert.ok(optedIn(m), `${m.id}: the graph pads, so customSizeOps must name control`);
    }
});

// SDXL's final resize read its size from image 1, so a 1344x768 latent came out in image 1's
// shape. Walk the control branch up from Output_Image: every Get Image Size on it must read
// through Input_custom_size, or the picked size is lost after the sampler.
test('on the control branch, every size the output reads follows Input_custom_size', () => {
    const fs = require('node:fs');
    const path = require('node:path');
    for (const m of controlModels.filter((x) => x.workflows?.control)) {
        const g = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'comfy_workflows', m.workflows.control), 'utf8'));
        const wf = m.opInject?.control?.Input_wf_type;
        const isWfType = (ref) => Array.isArray(ref) && g[ref[0]]?._meta?.title === 'Input_wf_type';
        const upstream = (id, seen = new Set()) => {
            if (seen.has(id)) return seen;
            seen.add(id);
            const n = g[id];
            const pick = wf !== undefined && /^MpiAnySwitch/.test(n.class_type) && isWfType(n.inputs.select)
                ? [n.inputs[`any_${wf}`]] : Object.values(n.inputs);
            for (const ref of pick) if (Array.isArray(ref) && g[ref[0]]) upstream(ref[0], seen);
            return seen;
        };
        const out = Object.keys(g).find((k) => g[k]._meta?.title === 'Output_Image');
        for (const id of upstream(out)) {
            if (g[id].class_type !== 'GetImageSize') continue;
            const reads = [...upstream(g[id].inputs.image[0])].map((k) => g[k]._meta?.title);
            assert.ok(reads.includes('Input_custom_size'), `${m.id}: Get Image Size ${id} ignores Custom size`);
        }
    }
});
