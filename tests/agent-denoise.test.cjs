'use strict';

/**
 * agent-denoise.test.cjs — MPI-817.
 *
 * `denoise` was missing from the agent's named params, twice over. The agent could not ASK
 * for it (zero hits in the loop, the tools, the dispatch and the connector), so "make it
 * anime but keep the picture" had no dial on a model with no edit op. And an agent run
 * injected NO denoise at all: the PromptBox control returns `{ Denoise: v }`,
 * `resolveNamedParams` never set it, so the graph ran its BAKED value while the sidecar's
 * `controlState.op.denoise` recorded the project's slider. Same defect as `duration` before
 * MPI-820 (`agent-duration.test.cjs`): the record and the run could disagree.
 *
 * Fabio, 2026-09-20: "the higher it is, the more the generation changes the image."
 */

const assert = require('node:assert/strict');
const test = require('node:test');

const { resolveNamedParams, namedParamsFor, modelShowsDenoise } = require('../js/data/generationControls.js');
const { getCommandDefault } = require('../js/data/commandRegistry.js');
const { MODELS } = require('../js/data/modelConstants/models.js');

const KREA2 = MODELS.find((m) => m.id === 'krea2');
const DENOISE_OPS = (KREA2.supportedOps || []).filter((op) => modelShowsDenoise(KREA2, op));
const PLAIN_OPS = (KREA2.supportedOps || []).filter((op) => !modelShowsDenoise(KREA2, op));

test('Krea 2 still has ops with a denoise slider and ops without — the rest assumes both', () => {
    assert.ok(DENOISE_OPS.includes('i2i'), 'i2i is the op the live round ran');
    assert.ok(PLAIN_OPS.includes('t2i'), 't2i has nothing to keep, so no denoise');
});

test('an asked denoise reaches the graph under the key the PromptBox control uses', () => {
    for (const op of DENOISE_OPS) {
        const r = resolveNamedParams(null, KREA2, op, { denoise: 0.55 });
        assert.equal(r.ok, true, op);
        assert.equal(r.injectionParams.Denoise, 0.55, op);
    }
});

test('an UNSET denoise still injects the op`s own default, so the baked value never decides', () => {
    for (const op of DENOISE_OPS) {
        const r = resolveNamedParams(null, KREA2, op, {});
        assert.equal(r.ok, true, op);
        assert.equal(r.injectionParams.Denoise, getCommandDefault(op, 'denoise'), op);
    }
});

test('with a project, an unset denoise is what that project`s slider says for THAT op', () => {
    const project = { modelSettings: { krea2: { operations: { i2i: { denoise: 0.62 } } } } };
    assert.equal(resolveNamedParams(project, KREA2, 'i2i', {}).injectionParams.Denoise, 0.62);
    assert.equal(resolveNamedParams(project, KREA2, 'i2i', { denoise: 0.2 }).injectionParams.Denoise, 0.2, 'asked wins');
});

test('a denoise outside 0-1, or on an op with no slider, is refused by name', () => {
    for (const bad of [-0.1, 1.5, '0.5', NaN]) {
        assert.equal(resolveNamedParams(null, KREA2, 'i2i', { denoise: bad }).code, 'INVALID_DENOISE', String(bad));
    }
    const r = resolveNamedParams(null, KREA2, 't2i', { denoise: 0.5 });
    assert.equal(r.code, 'INVALID_DENOISE');
    assert.equal(resolveNamedParams(null, KREA2, 't2i', {}).injectionParams.Denoise, undefined, 'and nothing is injected there');
});

test('describe_model advertises it as a range with its default, only where the op has it', () => {
    for (const op of DENOISE_OPS) {
        assert.deepEqual(namedParamsFor(KREA2, op).denoise, { min: 0, max: 1, default: getCommandDefault(op, 'denoise') }, op);
    }
    for (const op of PLAIN_OPS) assert.equal(namedParamsFor(KREA2, op).denoise, null, op);
});

test('the route carries it and the tool offers it, with the meaning in the description', () => {
    const fs = require('node:fs');
    const path = require('node:path');
    const read = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8');
    assert.match(read('routes', 'connector.js'), /const NAMED_PARAM_KEYS = \[[^\]]*'denoise'/);
    const loop = read('services', 'agentLoop.mjs');
    assert.match(loop, /denoise: \{ type: 'number', description: '[^']*more[^']*changes/i, 'Fabio`s meaning, in the tool description, not a prompt line');
    assert.match(loop, /if \(args\.denoise !== undefined\) body\.denoise = args\.denoise;/);
});
