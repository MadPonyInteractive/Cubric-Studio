'use strict';

/**
 * flux3-custom-size.test.cjs — MPI-1181.
 *
 * FLUX.3 Klein's edit can set its own output frame, but only behind a Custom size button,
 * off by default (Fabio, 2026-10-19). Off = follow reference 1: `Input_custom_size: false`
 * and no Width/Height. On = the ratio + tier picker sets it. The flag comes from the
 * `customSize` control (and an agent's named ratio/tier), never from the ModelDef's opInject.
 */

const assert = require('node:assert/strict');
const test = require('node:test');

const { resolveNamedParams } = require('../js/data/generationControls.js');
const { MODELS } = require('../js/data/modelConstants/models.js');

const FLUX3 = MODELS.find((m) => m.id === 'flux3-klein');
const KREA2 = MODELS.find((m) => m.id === 'krea2');
const RATIO = { shared: { image: { ratioSelector: { selectedRatio: '1:1', orientation: 'portrait' } } } };

test('opInject no longer forces custom size on edit', () => {
    assert.equal('Input_custom_size' in FLUX3.opInject.edit, false);
});

test('agent edit: off by default, no size injected', () => {
    const r = resolveNamedParams(RATIO, FLUX3, 'edit', {});
    assert.equal(r.ok, true);
    assert.equal(r.injectionParams.Input_custom_size, false);
    assert.equal(r.injectionParams.Width, undefined);
});

test('agent edit: a named ratio turns it on and sizes the run', () => {
    const r = resolveNamedParams(RATIO, FLUX3, 'edit', { ratio: '1:1' });
    assert.equal(r.injectionParams.Input_custom_size, true);
    assert.ok(r.injectionParams.Width > 0);
});

test('agent edit: the project`s own button decides when nothing is asked', () => {
    const project = { ...RATIO, modelSettings: { 'flux3-klein': { operations: { edit: { customSize: true } } } } };
    const r = resolveNamedParams(project, FLUX3, 'edit', {});
    assert.equal(r.injectionParams.Input_custom_size, true);
    assert.ok(r.injectionParams.Width > 0);
});

test('t2i and every other model never carry the flag', () => {
    assert.equal('Input_custom_size' in resolveNamedParams(RATIO, FLUX3, 't2i', {}).injectionParams, false);
    assert.equal('Input_custom_size' in resolveNamedParams(RATIO, KREA2, 't2i', {}).injectionParams, false);
});

test('the button mounts only where the picker can, before ratio + tier', async () => {
    const { visibleControlIds, PROMPT_BOX_CONTROLS } =
        await import('../js/components/Organisms/MpiPromptBox/PromptBoxControls.js');
    const ids = visibleControlIds(FLUX3, 'edit', {});
    assert.ok(ids.includes('customSize'));
    assert.ok(ids.indexOf('customSize') < ids.indexOf('ratio'));
    assert.ok(ids.indexOf('customSize') < ids.indexOf('qualityTier'));
    assert.ok(!visibleControlIds(FLUX3, 't2i', {}).includes('customSize'));
    assert.ok(!visibleControlIds(KREA2, 't2i', {}).includes('customSize'));
    // Every source-sized op: the button only on a model naming that op in customSizeOps.
    const { commands } = await import('../js/data/commandRegistry.js');
    for (const op of Object.keys(commands).filter((o) => commands[o].sizeOptIn)) {
        for (const m of MODELS.filter((x) => x.supportedOps?.includes(op) && !x.customSizeOps?.includes(op))) {
            assert.ok(!visibleControlIds(m, op, {}).includes('customSize'), `${m.id} ${op}`);
        }
    }
    assert.deepEqual(PROMPT_BOX_CONTROLS.customSize.getInjectionParams.call({ value: false }), { Input_custom_size: false });
});

// MPI-1207: the edit family copies FLUX.3's button, model by model.
const FAMILY = [
    ['klein-4b', 'kleinEdit'], ['klein-9b', 'kleinEdit'],
    ['krea2', 'krea2Edit'], ['krea2-nsfw', 'krea2Edit'],
    ['qwen-image-2-1', 'edit'], ['boogu-edit-high', 'edit'], ['boogu-edit-balanced', 'edit'],
    ['qwen-edit', 'qwenEdit'],
    // Cloud: the ones whose probe filled a new frame cleanly (validation.md, 2026-10-20).
    ['seedream-4-cloud', 'edit'], ['seedream-45-cloud', 'edit'], ['seedream-5-pro-cloud', 'edit'],
    ['flux2-dev-cloud', 'edit'], ['klein-9b-cloud', 'edit'],
];

test('cloud models whose probe failed keep following the source, no button', async () => {
    const { visibleControlIds } = await import('../js/components/Organisms/MpiPromptBox/PromptBoxControls.js');
    // FLUX-2 pro/max centre-crop the subject away; Nano Banana stretches (Fabio, 2026-10-20).
    for (const id of ['flux2-pro-cloud', 'flux2-max-cloud',
        'nano-banana-2-lite-cloud', 'nano-banana-2-cloud', 'nano-banana-pro-cloud']) {
        const m = MODELS.find((x) => x.id === id);
        assert.ok(m, id);
        assert.ok(!visibleControlIds(m, 'edit', {}).includes('customSize'), id);
        assert.equal(resolveNamedParams(RATIO, m, 'edit', {}).injectionParams.Width, undefined, id);
    }
});

test('edit family: the button mounts before the picker, off by default, a ratio turns it on', async () => {
    const { visibleControlIds } = await import('../js/components/Organisms/MpiPromptBox/PromptBoxControls.js');
    for (const [id, op] of FAMILY) {
        const m = MODELS.find((x) => x.id === id);
        assert.ok(m?.customSizeOps?.includes(op) && !m.imageSizedOps?.includes(op), id);
        assert.equal('Input_custom_size' in (m.opInject?.[op] || {}), false, id);
        const ids = visibleControlIds(m, op, {});
        assert.ok(ids.includes('customSize') && ids.indexOf('customSize') < ids.indexOf('ratio'), id);
        const off = resolveNamedParams(RATIO, m, op, {}).injectionParams;
        assert.equal(off.Input_custom_size, false, id);
        assert.equal(off.Width, undefined, id);
        const on = resolveNamedParams(RATIO, m, op, { ratio: '1:1' }).injectionParams;
        assert.equal(on.Input_custom_size, true, id);
        assert.ok(on.Width > 0 && on.Height > 0, id);
    }
});

test('the canvas line: Qwen Edit alone, once, the user words kept', () => {
    const { withCanvasPrompt } = require('../js/data/generationControls.js');
    assert.deepEqual(MODELS.filter((m) => m.canvasPrompt).map((m) => m.id), ['qwen-edit']);
    const once = withCanvasPrompt('make her top red', '3:4');
    assert.ok(once.startsWith('TARGET CANVAS: 3:4\nmake her top red\n'));
    assert.equal(withCanvasPrompt(once, '3:4'), once);
});
