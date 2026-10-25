/**
 * multi-angle-gizmo.test.cjs — MPI-1039 Flow build phase 4. The Multi-angle camera gizmo (the `angle` field):
 *
 *   1. the gizmo offers only the benched stops (flow-spec.md § DECISION), and without Qwen-Image 2.1
 *      only what FLUX.3 runs alone;
 *   2. a restored or untouched value reads as a real stop, and a stop the view cannot take falls back;
 *   3. every slider stop has its Cosmo preview on disk;
 *   4. the FlowDef reaches the driver, the gizmo field and the slots-only op.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const ROOT = path.join(__dirname, '..');
const load = p => import('file://' + path.join(ROOT, p).replace(/\\/g, '/'));
const prompts = () => load('js/data/flowPrompts/multiAngle.js');
const gizmo = () => load('js/components/Compounds/MpiAngleGizmo/MpiAngleGizmo.js');

test('choices: every turn takes every height with Qwen; zoom only where benched, at eye level', async () => {
    const { multiAngleChoices, MULTI_ANGLE_TURNS } = await prompts();
    for (const turn of MULTI_ANGLE_TURNS) {
        assert.deepEqual(multiAngleChoices(turn, 'level').heights, ['level', 'lo', 'hi']);
        assert.deepEqual(multiAngleChoices(turn, 'lo').zooms, ['none']);
    }
    assert.deepEqual(multiAngleChoices('front', 'level').zooms, ['none', 'eye', 'face', 'hs', 'waist', 'full', 'far']);
    assert.deepEqual(multiAngleChoices('tq_br', 'level').zooms, ['none', 'hs']);
    assert.deepEqual(multiAngleChoices('pr_l', 'level').zooms, ['none', 'hs', 'far']);
    assert.deepEqual(multiAngleChoices('tq_bl', 'level').zooms, ['none', 'far']);
});

test('choices without Qwen: only the front high, and one-pass zooms on the front', async () => {
    const { multiAngleChoices } = await prompts();
    const off = { qwen: false };
    assert.deepEqual(multiAngleChoices('front', 'level', off).heights, ['level', 'hi']);
    assert.deepEqual(multiAngleChoices('pr_r', 'level', off).heights, ['level']);
    assert.deepEqual(multiAngleChoices('front', 'level', off).zooms, ['none', 'eye', 'hs', 'waist', 'full']);
    assert.deepEqual(multiAngleChoices('tq_br', 'level', off).zooms, ['none']);
});

test('every choice the gizmo offers is a pick the planner runs', async () => {
    const { multiAngleChoices, multiAnglePlan, MULTI_ANGLE_TURNS } = await prompts();
    for (const turn of MULTI_ANGLE_TURNS) {
        for (const height of multiAngleChoices(turn, 'level').heights) {
            for (const zoom of multiAngleChoices(turn, height).zooms) {
                const pick = { turn, height, ...(zoom === 'none' ? {} : { zoom: { from: 'full', to: zoom } }) };
                const plan = multiAnglePlan(pick, { subject: 'woman', pronoun: 'she' });
                assert.ok(plan.ok, `${turn}/${height}/${zoom}: ${plan.reason}`);
            }
        }
    }
});

test('the Turn slider is a full turn with the front in the middle', async () => {
    const { MULTI_ANGLE_SLIDERS, MULTI_ANGLE_TURNS } = await prompts();
    const t = MULTI_ANGLE_SLIDERS.turn;
    assert.equal(t[Math.floor(t.length / 2)], 'front');
    assert.equal(t[0], 'back');
    assert.equal(t[t.length - 1], 'back');
    assert.deepEqual([...new Set(t)].sort(), [...MULTI_ANGLE_TURNS].sort());
});

test('every turn x height has its Cosmo preview on disk', async () => {
    const { multiAnglePreview, MULTI_ANGLE_TURNS, MULTI_ANGLE_HEIGHTS } = await prompts();
    for (const turn of MULTI_ANGLE_TURNS) {
        for (const height of MULTI_ANGLE_HEIGHTS) {
            assert.ok(fs.existsSync(path.join(ROOT, multiAnglePreview(turn, height))), `${turn}/${height}`);
        }
        assert.ok(fs.existsSync(path.join(ROOT, multiAnglePreview(turn, 'level', 'far'))), `${turn}/far`);
    }
    assert.equal(multiAnglePreview('front', 'level'), 'assets/flows/multi-angle/previews/front.webp');
    // Far away is its own wide render.
    assert.equal(multiAnglePreview('front', 'level', 'far'), 'assets/flows/multi-angle/previews/front_far.webp');
    // A zoom-in rung keeps the view's own preview: the gizmo zooms it with CSS.
    assert.equal(multiAnglePreview('front', 'level', 'face'), 'assets/flows/multi-angle/previews/front.webp');
});

test('every zoom-in rung has its CSS modifier on the preview', async () => {
    const { MULTI_ANGLE_RUNGS } = await prompts();
    const css = fs.readFileSync(path.join(ROOT, 'js/components/Compounds/MpiAngleGizmo/MpiAngleGizmo.css'), 'utf8');
    for (const rung of MULTI_ANGLE_RUNGS.filter(r => r !== 'far')) {
        assert.match(css, new RegExp(`\\.mpi-angle-gizmo__preview--${rung} \\{\\s*transform: scale\\(`), rung);
    }
});

test('normalizeAngle: untouched = front, eye level, as in the picture; the back keeps its end', async () => {
    const { normalizeAngle } = await gizmo();
    assert.deepEqual(normalizeAngle(null), { turn: 'front', turnPos: 4, height: 'level', zoom: 'none' });
    assert.equal(normalizeAngle({ turn: 'back', turnPos: 8 }).turnPos, 8);
    assert.equal(normalizeAngle({ turn: 'back' }).turnPos, 0);
    assert.equal(normalizeAngle({ turn: 'pr_l', turnPos: 8 }).turnPos, 2);
    assert.deepEqual(normalizeAngle({ turn: 'top', height: 'overhead', zoom: 'macro' }),
        { turn: 'front', turnPos: 4, height: 'level', zoom: 'none' });
});

test('fitAngle: a stop the view cannot take falls back', async () => {
    const { fitAngle, normalizeAngle } = await gizmo();
    const on = { qwen: true };
    const off = { qwen: false };
    assert.equal(fitAngle(normalizeAngle({ turn: 'pr_l', zoom: 'face' }), on).zoom, 'none');
    assert.equal(fitAngle(normalizeAngle({ turn: 'tq_br', zoom: 'hs' }), on).zoom, 'hs');
    assert.equal(fitAngle(normalizeAngle({ turn: 'front', height: 'lo', zoom: 'face' }), on).zoom, 'none');
    assert.equal(fitAngle(normalizeAngle({ turn: 'tq_fl', height: 'hi' }), off).height, 'level');
});

test('FlowDef: driver, gizmo field and the slots-only op are all registered', async () => {
    const src = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
    assert.match(src('js/data/flowsRegistry.js'), /id: 'multi-angle',[\s\S]*?driver: 'multiAngle',[\s\S]*?operation: 'flowMultiAngle',[\s\S]*?id: 'angle', type: 'angle'/);
    assert.match(src('js/shell/storyboardDispatch.js'), /multiAngle: runMultiAngleFlow,/);
    assert.ok(require(path.join(ROOT, 'operation_registry.json')).flowMultiAngle);
    assert.match(src('js/core/operationRegistry.js'), /flowMultiAngle: \{/);
    assert.match(src('js/data/commandRegistry.js'), /flowMultiAngle: \{[\s\S]*?key: 'inputImage2'/);
});
