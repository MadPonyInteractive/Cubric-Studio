'use strict';

/**
 * transparent-background.test.cjs — MPI-1049.
 *
 * Qwen-Image 2.1's transparency is PROMPT-ONLY: the model returns alpha when the prompt opens
 * and closes with its vendor's two RGBA sentences, and only t2i and edit keep the alpha. So
 * No Background is a toggle on those two ops, an agent's `transparent` named param, and a
 * wrap of the prompt at dispatch (commandExecutor._buildParams calls withTransparentPrompt and
 * drops the `Transparent_Background` key). The prompt of record stays the user's own words.
 */

const assert = require('node:assert/strict');
const test = require('node:test');

const { resolveNamedParams, namedParamsFor, withTransparentPrompt } = require('../js/data/generationControls.js');
const { MODELS } = require('../js/data/modelConstants/models.js');

const QWEN21 = MODELS.find((m) => m.id === 'qwen-image-2-1');
const KREA2 = MODELS.find((m) => m.id === 'krea2');
const PREFIX = 'This is an RGBA image with transparency.';
const SUFFIX = 'The image has alpha channel and the background is transparent.';

test('fixture guard: Qwen 2.1 carries the vendor sentences', () => {
    assert.deepEqual(QWEN21.transparentPrompt, { prefix: PREFIX, suffix: SUFFIX });
});

test('offered on Qwen 2.1 t2i and edit only, never on a model without the sentences', () => {
    assert.equal(namedParamsFor(QWEN21, 't2i').transparent, true);
    assert.equal(namedParamsFor(QWEN21, 'edit').transparent, true);
    for (const op of ['i2i', 'control', 'inpaint', 'detail', 'upscale']) {
        assert.equal(namedParamsFor(QWEN21, op).transparent, undefined, op);
    }
    assert.equal(namedParamsFor(KREA2, 't2i').transparent, undefined);
});

test('asked, else the saved toggle, else off', () => {
    assert.equal(resolveNamedParams(null, QWEN21, 't2i', { transparent: true }).injectionParams.Transparent_Background, true);
    assert.equal(resolveNamedParams(null, QWEN21, 'edit', {}).injectionParams.Transparent_Background, false);
    const project = { modelSettings: { 'qwen-image-2-1': { transparentBackground: true } } };
    const saved = resolveNamedParams(project, QWEN21, 't2i', {});
    assert.equal(saved.ok, true);
    assert.equal(saved.injectionParams.Transparent_Background, true, 'the project toggle');
    assert.equal(resolveNamedParams(project, QWEN21, 't2i', { transparent: false }).injectionParams.Transparent_Background, false, 'asked wins');
    assert.equal('Transparent_Background' in resolveNamedParams(null, KREA2, 't2i', {}).injectionParams, false);
});

test('refused where it cannot work, and when not a boolean', () => {
    assert.equal(resolveNamedParams(null, QWEN21, 'i2i', { transparent: true }).code, 'INVALID_TRANSPARENT');
    assert.equal(resolveNamedParams(null, KREA2, 't2i', { transparent: true }).code, 'INVALID_TRANSPARENT');
    assert.equal(resolveNamedParams(null, QWEN21, 't2i', { transparent: 'yes' }).code, 'INVALID_TRANSPARENT');
});

test('the prompt is wrapped once, however often it passes', () => {
    // Fabio's typed prompt had no full stop and ran on into the suffix (2026-10-10).
    const once = withTransparentPrompt(QWEN21, 'a red fox sitting');
    assert.equal(once, `${PREFIX} a red fox sitting. ${SUFFIX}`);
    assert.equal(withTransparentPrompt(QWEN21, 'a red fox sitting.'), once, 'a closed sentence is left alone');
    assert.equal(withTransparentPrompt(QWEN21, once), once, 'an Enhance reply that already carries them');
    assert.equal(withTransparentPrompt(QWEN21, ''), `${PREFIX} ${SUFFIX}`, 'an empty edit prompt (the style filter)');
    assert.equal(withTransparentPrompt(KREA2, 'a red fox'), 'a red fox', 'no sentences, no wrap');
});

test('the PromptBox control: Qwen t2i/edit only, and a run that injected it reconciles', async () => {
    const { visibleControlIds, reconcileControlsFromInjection, resolveControlDefaults } =
        await import('../js/components/Organisms/MpiPromptBox/PromptBoxControls.js');
    assert.ok(visibleControlIds(QWEN21, 't2i', {}).includes('transparentBackground'));
    assert.ok(visibleControlIds(QWEN21, 'edit', {}).includes('transparentBackground'));
    assert.ok(!visibleControlIds(QWEN21, 'i2i', {}).includes('transparentBackground'));
    assert.ok(!visibleControlIds(KREA2, 't2i', {}).includes('transparentBackground'));

    // An agent run asked for it while the project toggle sat off: the sidecar records the run.
    const buckets = resolveControlDefaults(QWEN21, 't2i', {});
    assert.equal(buckets.model.transparentBackground, false, 'fixture guard: default off');
    reconcileControlsFromInjection(buckets, { Transparent_Background: true, Width: 1024, Height: 1024 }, QWEN21, 't2i', {});
    assert.equal(buckets.model.transparentBackground, true);
});

test('Enhance gets a system rule that outranks the brief on the setting', async () => {
    const { TRANSPARENT_BACKGROUND_RULE } = await import('../js/data/recipes/registry.js');
    assert.match(TRANSPARENT_BACKGROUND_RULE, /^NO BACKGROUND\./);
    assert.match(TRANSPARENT_BACKGROUND_RULE, /outranks the brief on ONE point only: the setting/);
    assert.ok(TRANSPARENT_BACKGROUND_RULE.includes(PREFIX) && TRANSPARENT_BACKGROUND_RULE.includes(SUFFIX), 'the vendor sentences, verbatim');
});
