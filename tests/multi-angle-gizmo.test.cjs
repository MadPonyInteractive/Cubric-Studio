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

test('choices: every turn takes every height with Qwen; zoom only where benched', async () => {
    const { multiAngleChoices, MULTI_ANGLE_TURNS } = await prompts();
    for (const turn of MULTI_ANGLE_TURNS) {
        assert.deepEqual(multiAngleChoices(turn, 'level').heights, ['level', 'lo', 'hi']);
        // Round 51: far on every low and high; hs from above on a turned view only.
        assert.deepEqual(multiAngleChoices(turn, 'lo').zooms, ['none', 'far']);
        assert.deepEqual(multiAngleChoices(turn, 'hi').zooms, turn === 'front' ? ['none', 'far'] : ['none', 'hs', 'far']);
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
    // The front high is FLUX.3, so its zoom pass would be Qwen.
    assert.deepEqual(multiAngleChoices('front', 'hi', off).zooms, ['none']);
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

test('from every matched start, every choice offered is a pick the planner runs', async () => {
    const { multiAngleChoices, multiAnglePlan, MULTI_ANGLE_TURNS, MULTI_ANGLE_HEIGHTS } = await prompts();
    for (const st of MULTI_ANGLE_TURNS) {
        for (const sh of MULTI_ANGLE_HEIGHTS) {
            const from = { turn: st, height: sh };
            for (const turn of multiAngleChoices(st, sh, { from }).turns) {
                for (const height of multiAngleChoices(turn, 'level', { from }).heights) {
                    for (const zoom of multiAngleChoices(turn, height, { from }).zooms) {
                        const pick = { turn, height, from, ...(zoom === 'none' ? {} : { zoom: { from: 'full', to: zoom } }) };
                        const plan = multiAnglePlan(pick, { subject: 'woman', pronoun: 'she' });
                        assert.ok(plan.ok, `${st}/${sh} -> ${turn}/${height}/${zoom}: ${plan.reason}`);
                    }
                }
            }
        }
    }
});

test('choices from a matched start: a low or high start zooms only; Front from a turned start is alone', async () => {
    const { multiAngleChoices } = await prompts();
    const hi = { from: { turn: 'pr_r', height: 'hi' } };
    assert.deepEqual(multiAngleChoices('pr_r', 'hi', hi), { turns: ['pr_r'], heights: ['hi'], zooms: ['none', 'hs', 'far'] });
    assert.deepEqual(multiAngleChoices('front', 'lo', { from: { turn: 'front', height: 'lo' } }).zooms, ['none', 'far']);
    assert.deepEqual(multiAngleChoices('front', 'level', { from: { turn: 'tq_bl' } }), {
        turns: multiAngleChoices('front', 'level').turns, heights: ['level'], zooms: ['none'] });
    // Without Qwen a zoom with no pass before it is FLUX.3, on any matched view.
    assert.deepEqual(multiAngleChoices('pr_l', 'level', { qwen: false, from: { turn: 'pr_l' } }).zooms, ['none', 'hs']);
});

test('fitAngle from a matched start: what the start cannot reach goes back to it', async () => {
    const { fitAngle, normalizeAngle } = await gizmo();
    const from = normalizeAngle({ turn: 'pr_r', height: 'hi' });
    const v = fitAngle(normalizeAngle({ turn: 'front', height: 'lo', zoom: 'far' }), { qwen: true, from });
    assert.deepEqual([v.turn, v.turnPos, v.height, v.zoom], ['pr_r', 6, 'hi', 'far']);
});

test('the Turn slider is a full turn with the front in the middle', async () => {
    const { MULTI_ANGLE_SLIDERS, MULTI_ANGLE_TURNS } = await prompts();
    const t = MULTI_ANGLE_SLIDERS.turn;
    assert.equal(t[Math.floor(t.length / 2)], 'front');
    assert.equal(t[0], 'back');
    assert.equal(t[t.length - 1], 'back');
    assert.deepEqual([...new Set(t)].sort(), [...MULTI_ANGLE_TURNS].sort());
});

test('the Zoom slider: left always zooms out, right always zooms in', async () => {
    const { MULTI_ANGLE_SLIDERS, MULTI_ANGLE_RUNGS, multiAngleZoomSlider } = await prompts();
    // The ladder is closest first, so the slider reads it widest first.
    assert.deepEqual(MULTI_ANGLE_SLIDERS.zoom, [...MULTI_ANGLE_RUNGS].reverse());
    // The pick puts "as in your picture" on the matched framing (untouched = whole body).
    assert.deepEqual(multiAngleZoomSlider(), ['far', 'none', 'waist', 'hs', 'face', 'eye']);
    assert.deepEqual(multiAngleZoomSlider('hs'), ['far', 'full', 'waist', 'none', 'face', 'eye']);
});

test('fitAngle: the matched framing itself is "as in your picture"', async () => {
    const { fitAngle, normalizeAngle } = await gizmo();
    const from = normalizeAngle({ turn: 'front', zoom: 'hs' });
    assert.equal(fitAngle(normalizeAngle({ zoom: 'hs' }), { qwen: true, from }).zoom, 'none');
    assert.equal(fitAngle(normalizeAngle({ zoom: 'face' }), { qwen: true, from }).zoom, 'face');
});

test('every turn x height has its Cosmo preview on disk', async () => {
    const { multiAnglePreview, MULTI_ANGLE_TURNS, MULTI_ANGLE_HEIGHTS } = await prompts();
    for (const turn of MULTI_ANGLE_TURNS) {
        for (const height of MULTI_ANGLE_HEIGHTS) {
            assert.ok(fs.existsSync(path.join(ROOT, multiAnglePreview(turn, height))), `${turn}/${height}`);
        }
        for (const height of MULTI_ANGLE_HEIGHTS) {
            assert.ok(fs.existsSync(path.join(ROOT, multiAnglePreview(turn, height, 'far'))), `${turn}/${height}/far`);
        }
    }
    assert.equal(multiAnglePreview('front', 'level'), 'assets/flows/multi-angle/previews/front.webp');
    // Far away is its own wide render.
    assert.equal(multiAnglePreview('front', 'level', 'far'), 'assets/flows/multi-angle/previews/front_far.webp');
    assert.equal(multiAnglePreview('tq_fl', 'lo', 'far'), 'assets/flows/multi-angle/previews/tq_fl_lo_far.webp');
    // A zoom-in rung keeps the view's own preview: the gizmo zooms it with CSS.
    assert.equal(multiAnglePreview('front', 'level', 'face'), 'assets/flows/multi-angle/previews/front.webp');
});

test('every zoom-in rung has its CSS modifier on the preview', async () => {
    const { MULTI_ANGLE_RUNGS } = await prompts();
    const css = fs.readFileSync(path.join(ROOT, 'js/components/Compounds/MpiAngleGizmo/MpiAngleGizmo.css'), 'utf8');
    // Whole body is the render as it is; far its own render.
    for (const rung of MULTI_ANGLE_RUNGS.filter(r => r !== 'far' && r !== 'full')) {
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
    assert.match(src('js/data/flowsRegistry.js'), /id: 'multi-angle',[\s\S]*?driver: 'multiAngle',[\s\S]*?operation: 'flowMultiAngle',[\s\S]*?title: 'Match your picture',[\s\S]*?id: 'start', type: 'angle', mode: 'match', pictureRole: 'inputImage'[\s\S]*?id: 'angle', type: 'angle', label: 'New view', startField: 'start'/);
    assert.match(src('js/shell/storyboardDispatch.js'), /multiAngle: runMultiAngleFlow,/);
    assert.ok(require(path.join(ROOT, 'operation_registry.json')).flowMultiAngle);
    assert.match(src('js/core/operationRegistry.js'), /flowMultiAngle: \{/);
    assert.match(src('js/data/commandRegistry.js'), /flowMultiAngle: \{[\s\S]*?key: 'inputImage2'/);
});
