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
    assert.equal('Input_custom_size' in resolveNamedParams(RATIO, KREA2, 'krea2Edit', {}).injectionParams, false);
});

test('the button mounts only where the picker can, before ratio + tier', async () => {
    const { visibleControlIds, PROMPT_BOX_CONTROLS } =
        await import('../js/components/Organisms/MpiPromptBox/PromptBoxControls.js');
    const ids = visibleControlIds(FLUX3, 'edit', {});
    assert.ok(ids.includes('customSize'));
    assert.ok(ids.indexOf('customSize') < ids.indexOf('ratio'));
    assert.ok(ids.indexOf('customSize') < ids.indexOf('qualityTier'));
    assert.ok(!visibleControlIds(FLUX3, 't2i', {}).includes('customSize'));
    assert.ok(!visibleControlIds(KREA2, 'krea2Edit', {}).includes('customSize'));
    for (const m of MODELS.filter((x) => x.supportedOps?.includes('edit') && !x.customSizeOps)) {
        assert.ok(!visibleControlIds(m, 'edit', {}).includes('customSize'), m.id);
    }
    assert.deepEqual(PROMPT_BOX_CONTROLS.customSize.getInjectionParams.call({ value: false }), { Input_custom_size: false });
});
