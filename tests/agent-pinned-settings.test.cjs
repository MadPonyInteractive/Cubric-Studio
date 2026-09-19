'use strict';

/**
 * agent-pinned-settings.test.cjs — MPI-774 Phase 7, the pinned settings panel.
 *
 * One boolean decides who owns the model and the settings of an agent-dispatched
 * generation. Fabio has twice rejected a prompt rule as the answer to this, so the gate is
 * code — `resolveSettingsOwner` in `js/shell/agentDispatch.js` — and these tests are what
 * stop a later edit from quietly making it a suggestion again.
 *
 * The half that would fail SILENTLY, and the reason this file exists at all: "the agent
 * uses defaults" is not what the code did. `resolveEffectiveQualityTier` resolves an unset
 * tier against the PROJECT'S SAVED BUCKET first, so a project where 2k was once chosen
 * kept feeding 2k to every agent generation forever — the same stale contamination the
 * panel exists to kill, arriving through the project record instead of the visible panel.
 * The unpinned path passes `project: null` for exactly that reason, and the last test here
 * runs the resolve end to end against a real 2k-contaminated project to prove it.
 */

const assert = require('node:assert/strict');
const test = require('node:test');

const { resolveSettingsOwner } = require('../js/shell/agentDispatch.js');
const { resolveNamedParams } = require('../js/data/generationControls.js');
const { getModelById } = require('../js/data/modelRegistry.js');

const PROJECT = { folderPath: 'C:/projects/demo', name: 'demo' };
const KREA = getModelById('krea2');
const PINNED = getModelById('klein-9b') || getModelById('klein') || null;

test('the registry still carries the models these tests name', () => {
    assert.ok(KREA, 'krea2 must exist');
    assert.ok(PINNED, 'a second, different model must exist to test a mismatch against');
    assert.notEqual(PINNED.id, KREA.id);
});

// ── Cog shut: the agent drives, from MODEL DEFAULTS ───────────────────────────

test('unpinned: the agent keeps its model and its params, and the project is dropped', () => {
    const input = { modelId: KREA.id, ratio: '16:9', qualityTier: '1k', turbo: true };
    const owner = resolveSettingsOwner(input, false, PROJECT, null);
    assert.equal(owner.error, undefined);
    assert.equal(owner.model.id, KREA.id);
    // The whole "model defaults" half. Not decoration: see the file header.
    assert.equal(owner.project, null);
    assert.equal(owner.named.ratio, '16:9');
    assert.equal(owner.named.qualityTier, '1k');
    assert.equal(owner.named.turbo, true);
});

// ── Cog open: the user drives ─────────────────────────────────────────────────

test('pinned: the agent`s named params are DROPPED, not merely discouraged', () => {
    const input = { modelId: PINNED.id, ratio: '16:9', qualityTier: '2k', turbo: true, styleSelect: 3, stylization: 0.9 };
    const owner = resolveSettingsOwner(input, true, PROJECT, PINNED);
    assert.equal(owner.error, undefined);
    assert.equal(owner.model.id, PINNED.id);
    assert.deepEqual(owner.named, {}, 'every named param the agent sent must be gone');
    // Pinned, the project IS the panel: an unset param has to land on what the user is
    // looking at, which is the project's saved bucket.
    assert.equal(owner.project, PROJECT);
});

test('pinned: a model the user did not pick is refused, never silently swapped', () => {
    const owner = resolveSettingsOwner({ modelId: KREA.id }, true, PROJECT, PINNED);
    assert.equal(owner.error?.code, 'MODEL_PINNED');
    assert.equal(owner.model, null, 'a refusal must not hand back a model to run');
    // The refusal has to be actionable in-turn: it names the model to resend with.
    assert.match(owner.error.message, new RegExp(PINNED.id));
    assert.match(owner.error.message, /select a different one|cannot change it/);
});

test('pinned: the same model the user picked goes through', () => {
    const owner = resolveSettingsOwner({ modelId: PINNED.id }, true, PROJECT, PINNED);
    assert.equal(owner.error, undefined);
    assert.equal(owner.model.id, PINNED.id);
});

test('pinned with nothing selected is refused, not run on a guess', () => {
    const owner = resolveSettingsOwner({ modelId: KREA.id }, true, PROJECT, null);
    assert.equal(owner.error?.code, 'NO_PINNED_MODEL');
    assert.equal(owner.model, null);
});

// ── The silent half, end to end ───────────────────────────────────────────────

test('unpinned, a project contaminated with 2k no longer feeds 2k to the agent', () => {
    // A real shape of the trap: the user once chose the expensive tier in this project,
    // months ago, and never opened the panel again.
    const { qualityTiersFor } = require('../js/utils/ratios.js');
    const { resolveEffectiveQualityTier } = require('../js/data/generationControls.js');
    const tiered = qualityTiersFor(KREA.type) || [];
    const cheapest = resolveEffectiveQualityTier(null, KREA);
    assert.ok(cheapest, 'krea2 must have a tier axis for this test to mean anything');
    const expensive = tiered.find((t) => t !== cheapest) || null;
    assert.ok(expensive, `krea2 must offer a second tier (saw ${JSON.stringify(tiered)})`);

    const contaminated = { modelSettings: { [KREA.id]: { qualityTier: expensive } } };
    assert.equal(resolveEffectiveQualityTier(contaminated, KREA), expensive,
        'the project bucket is what the old agent path resolved against');

    // The gate's answer: unpinned drops the project, so the resolve lands on the default.
    const owner = resolveSettingsOwner({ modelId: KREA.id }, false, contaminated, null);
    assert.equal(resolveEffectiveQualityTier(owner.project, KREA), cheapest,
        'an agent generation must start at the model default, not a bucket from last month');

    // And pinned it lands on the panel, which is what that bucket now legitimately is.
    const pinnedOwner = resolveSettingsOwner({ modelId: KREA.id }, true, contaminated, KREA);
    assert.equal(resolveEffectiveQualityTier(pinnedOwner.project, KREA), expensive);
});

test('both paths still produce injection params a real dispatch can use', () => {
    const op = (KREA.supportedOps || [])[0];
    assert.ok(op, 'krea2 must declare an op');
    for (const [label, owner] of [
        ['unpinned', resolveSettingsOwner({ modelId: KREA.id }, false, PROJECT, null)],
        ['pinned', resolveSettingsOwner({ modelId: KREA.id }, true, PROJECT, KREA)],
    ]) {
        const named = resolveNamedParams(owner.project, KREA, op, owner.named);
        assert.equal(named.ok, true, `${label} must resolve cleanly`);
        assert.equal(typeof named.injectionParams, 'object', label);
    }
});
