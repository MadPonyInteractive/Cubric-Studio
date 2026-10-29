'use strict';

/**
 * agent-installed-kin.test.cjs — Fabio's smoke 2026-10-04 (MPI-595): "the same video but
 * with MiniMax H3" went to `minimax-h3`, which is not installed. Its OP_UNAVAILABLE named
 * only that model, and the agent offered the 21 GB download with MiniMax H3 Reference
 * installed and able to animate the picture. The refusal now names the installed models of
 * the same `modelFamily` (`installedKin` in js/shell/agentDispatch.js).
 */

const assert = require('node:assert/strict');
const test = require('node:test');

// The cloud key's only door (secretsClient -> ipc), stubbed so a test can save and clear it.
let keySaved = false;
globalThis.window = { require: (m) => (m === 'electron' ? { ipcRenderer: { invoke: async () => ({ has: keySaved }) } } : undefined) };

const { installedKin, opUnavailable } = require('../js/shell/agentDispatch.js');
const { getModelById, MODELS, refreshCloudKey } = require('../js/data/modelRegistry.js');

// MPI-1234 (live 2026-10-21): FLUX Schnell (Cloud) with no key read "its weights are not
// installed"; the agent read the RunPod setup guide, then ran FLUX.3 Klein instead.
test('a cloud model with no key is refused for the key, never for weights', async () => {
    const cloud = MODELS.find(m => m.provider);
    keySaved = false;
    await refreshCloudKey();
    const why = opUnavailable(cloud, cloud.supportedOps[0]);
    assert.match(why, /API key/);
    assert.doesNotMatch(why, /weights/);

    keySaved = true;
    await refreshCloudKey();
    assert.match(opUnavailable(cloud, 'no-such-op'), /unsupported, or its weights are not installed/,
        'with a key, an op it lacks keeps the old reason');
});

test('an uninstalled family member names the installed one and its ops', () => {
    const h3 = getModelById('minimax-h3');
    const ref = getModelById('minimax-h3-ref2va');
    assert.equal(h3.modelFamily, ref.modelFamily, 'the two H3 models must share a family, or the refusal names nothing');
    // No dep-status cache in a test: isOperationInstalled trusts the server's flag.
    h3.installed = false;
    ref.installed = true;
    const hint = installedKin(h3);
    assert.match(hint, /MiniMax H3 Reference \("minimax-h3-ref2va": ref2v_ms\)/);
    assert.match(hint, /rather than offering an install/);
});

test('nothing installed in the family, or no family, adds nothing', () => {
    const h3 = getModelById('minimax-h3');
    getModelById('minimax-h3-ref2va').installed = false;
    getModelById('minimax-h3-singularity').installed = false;
    assert.equal(installedKin(h3), '');
    assert.equal(installedKin({ id: 'x', name: 'X' }), '');
});

// MPI-1327, live 2026-10-29: a Pod holding only Singularity H3 (no `modelFamily`, the tier
// letter) got the 21 GB MiniMax H3 offer for a words-only clip.
test('a member with no modelFamily is kin by its type', () => {
    const h3 = getModelById('minimax-h3');
    const sing = getModelById('minimax-h3-singularity');
    assert.equal(sing.modelFamily, undefined);
    getModelById('minimax-h3-ref2va').installed = false;
    sing.installed = true;
    assert.match(installedKin(h3), /Singularity H3 \("minimax-h3-singularity": ref2v_ms\)/);
    assert.equal(installedKin(getModelById('sdxl-realistic')), '', 'no family on either side stays no kin');
    sing.installed = false;
});
