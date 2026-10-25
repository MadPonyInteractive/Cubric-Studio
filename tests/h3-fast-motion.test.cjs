'use strict';

/**
 * MPI-1285 — H3 Reference Fast Motion. The routing lives in the r2va graph's MpiMath nodes;
 * the app keeps ONE copy of the one-pass decision (`h3FastMotionOnePass`, ratios.js) for the
 * Preview gate and the bar count. These tests hold the two together and pin the agent param
 * to H3 Reference only (Fabio: never MiniMax H3). docs/models/h3/fast-motion.md.
 */

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const { h3FastMotionOnePass, MINIMAX_H3_RATIOS } = require('../js/utils/ratios.js');
const { resolveNamedParams, namedParamsFor } = require('../js/data/generationControls.js');
const { MODELS } = require('../js/data/modelConstants/models.js');

const REPO = path.join(__dirname, '..');
const RUNTIME = JSON.parse(fs.readFileSync(path.join(REPO, 'comfy_workflows/minimax_h3_r2va.json'), 'utf8'));
const byTitle = (t) => Object.values(RUNTIME).find((n) => n._meta?.title === t);
const REF = MODELS.find((m) => m.id === 'minimax-h3-ref2va');
const FL2VA = MODELS.find((m) => m.id === 'minimax-h3');

/** The graph's expressions, verbatim: an edit to the graph has to be an edit here too. */
const GRAPH = {
    'Base Width': '768 if a == b else ((1536 if a > 2.2 * b else 1344) if a > b else 768)',
    'Fast Motion Mode': '(0 if a <= b else (1 if a <= 2 * b else 2)) if c else 3',
    'One Pass': 'a == 0',
};

test('the r2va runtime carries the switch, defaulting off, and the routing nodes', () => {
    assert.equal(byTitle('Input_Fast_Motion')?.inputs.boolean, false);
    for (const [title, expr] of Object.entries(GRAPH)) {
        assert.equal(byTitle(title)?.inputs.math_expression, expr, title);
    }
    assert.equal(byTitle('sol-attn')?.class_type, 'BlockSparseAttention');
    assert.equal(byTitle('sol-attn')?.inputs.selection, 'sol-attn');
});

test('MiniMax H3 (fl2va) carries the same sol-attn on its stage-1 model, and no Fast Motion', () => {
    const fl2va = JSON.parse(fs.readFileSync(path.join(REPO, 'comfy_workflows/minimax_h3_fl2va.json'), 'utf8'));
    const nodes = Object.entries(fl2va);
    const sol = nodes.filter(([, n]) => n.class_type === 'BlockSparseAttention');
    assert.equal(sol.length, 1);
    const [solId, solNode] = sol[0];
    const { model: _m, ...settings } = solNode.inputs;
    const { model: _r, ...refSettings } = byTitle('sol-attn').inputs;
    assert.deepEqual(settings, refSettings, 'same settings as H3 Reference');
    // Fed by the turbo/non-turbo switch, read by both stage-1 schedulers and the guider.
    assert.equal(fl2va[solNode.inputs.model[0]].class_type, 'MpiIfElse');
    const readers = nodes.filter(([, n]) => n.inputs.model?.[0] === solId).map(([, n]) => n.class_type).sort();
    assert.deepEqual(readers, ['BasicGuider', 'BasicScheduler', 'BasicScheduler']);
    assert.ok(nodes.some(([, n]) => n.class_type === 'EasyCache'), 'EasyCache stays on non-turbo');
    assert.ok(!nodes.some(([, n]) => n._meta?.title === 'Input_Fast_Motion'));
});

test('the JS one-pass copy agrees with the graph on every H3 cell', () => {
    // Mode 0 in the graph = target width <= base width, Fast Motion on.
    const baseW = (w, h) => (w === h ? 768 : (w > h ? (w > 2.2 * h ? 1536 : 1344) : 768));
    for (const [tier, cells] of Object.entries(MINIMAX_H3_RATIOS)) {
        for (const { label, w, h } of cells) {
            const graphOnePass = w <= baseW(w, h);
            assert.equal(h3FastMotionOnePass(w, h), graphOnePass, `${tier} ${label}`);
            assert.equal(graphOnePass, ['very_low', 'low', 'medium'].includes(tier), `${tier} ${label}: one pass exactly up to native`);
        }
    }
});

test('the native base is the medium cell of each shape', () => {
    for (const { label, w, h } of MINIMAX_H3_RATIOS.medium) {
        assert.equal(h3FastMotionOnePass(w, h), true, label);
        assert.equal(h3FastMotionOnePass(w + 64, h + 64 * h / w), false, `${label} one step bigger, same shape`);
    }
});

test('fastMotion is offered on H3 Reference only', () => {
    assert.equal(namedParamsFor(REF, 'ref2v_ms').fastMotion, true);
    assert.equal(namedParamsFor(FL2VA, 't2v_ms').fastMotion, undefined);
    assert.equal(namedParamsFor(FL2VA, 'i2v_ms').fastMotion, undefined);
});

test('fastMotion: asked wins, else off, and it refuses where it does not exist', () => {
    assert.equal(resolveNamedParams(null, REF, 'ref2v_ms', { fastMotion: true }).injectionParams.Input_Fast_Motion, true);
    assert.equal(resolveNamedParams(null, REF, 'ref2v_ms', {}).injectionParams.Input_Fast_Motion, false);
    assert.equal(resolveNamedParams(null, REF, 'ref2v_ms', { fastMotion: 'yes' }).code, 'INVALID_FAST_MOTION');
    assert.equal(resolveNamedParams(null, FL2VA, 't2v_ms', { fastMotion: true }).code, 'INVALID_FAST_MOTION');
    assert.equal('Input_Fast_Motion' in resolveNamedParams(null, FL2VA, 't2v_ms', {}).injectionParams, false);
});
