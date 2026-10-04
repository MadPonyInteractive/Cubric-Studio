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

const { installedKin } = require('../js/shell/agentDispatch.js');
const { getModelById } = require('../js/data/modelRegistry.js');

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
    assert.equal(installedKin(h3), '');
    assert.equal(installedKin({ id: 'x', name: 'X' }), '');
});
