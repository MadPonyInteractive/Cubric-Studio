'use strict';
/**
 * model-priority.test.cjs — MPI-774 Phase 5 fix 1.
 *
 * The ranked `{modelId, op}` table the in-app agent picks from. The one failure mode that
 * matters is drift: a table entry naming a model or an op that `models.js` no longer has
 * ranks nothing and nobody notices, because the agent simply goes on choosing badly.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { MODELS } = require('../js/data/modelConstants/models.js');
const { opPriority } = require('../js/data/modelConstants/modelPriority.js');

const opsOf = (id) => MODELS.find((m) => m.id === id)?.supportedOps || [];

/** Every pair the table ranks, read back through the public function. */
const RANKED = [
    ['edit', [['boogu-edit-high', 'edit'], ['boogu-edit-balanced', 'edit'], ['klein-9b', 'kleinEdit'],
        ['klein-4b', 'kleinEdit'], ['krea2', 'krea2Edit'], ['qwen-edit', 'qwenEdit']]],
    ['t2v', [['minimax-h3', 't2v_ms'], ['ltx-23-balanced', 't2v_ms'], ['wan22-5b', 't2v'], ['ltx-23', 't2v_ms']]],
    ['i2v', [['minimax-h3', 'i2v_ms'], ['ltx-23-balanced', 'i2v_ms'], ['wan-22', 'i2v_ms'],
        ['wan22-5b', 'i2v'], ['ltx-23', 'i2v_ms']]],
    ['t2i', [['krea2', 't2i'], ['klein-9b', 't2i'], ['chroma-flash', 't2i'], ['chroma-hyper', 't2i'],
        ['klein-4b', 't2i'], ['sdxl-realistic', 't2i']]],
];

test('every ranked pair is a model that exists and an op it really supports', () => {
    for (const [task, pairs] of RANKED) {
        for (const [modelId, op] of pairs) {
            assert.ok(MODELS.some((m) => m.id === modelId), `${task}: no model "${modelId}"`);
            assert.ok(opsOf(modelId).includes(op), `${task}: ${modelId} does not support "${op}"`);
        }
    }
});

test('the order is the one Fabio gave (2026-09-18)', () => {
    for (const [task, pairs] of RANKED) {
        const ranks = pairs.map(([m, o]) => opPriority(m, o)?.rank);
        assert.deepEqual(ranks, pairs.map((_, i) => i + 1), `${task}: ranks out of order — ${ranks}`);
    }
});

test('an image task takes the shared order, filtered by the models that declare it', () => {
    // chroma has no inpaint, so it drops out of inpaint instead of needing its own list.
    assert.equal(opPriority('chroma-flash', 't2i').rank, 3);
    assert.equal(opPriority('chroma-flash', 'inpaint'), null, 'chroma declares no inpaint op');
    assert.equal(opPriority('klein-4b', 'inpaint').rank, 3, 'klein-4b moves up where chroma is absent');
});

test('the notes carry what a rank cannot, on the entries where they change the pick', () => {
    assert.match(opPriority('qwen-edit', 'qwenEdit').note, /outside the edit area/);
    assert.match(opPriority('boogu-edit-high', 'edit').note, /one image/);
    assert.match(opPriority('ill-anime', 't2i').note, /anime/);
});

test('nothing an agent must not drift to is ranked', () => {
    // An `-nsfw` variant is the user's explicit choice, never a default the ranking makes.
    for (const m of MODELS.filter((x) => x.id.includes('nsfw'))) {
        for (const op of m.supportedOps || []) {
            assert.equal(opPriority(m.id, op), null, `${m.id}:${op} must not be ranked`);
        }
    }
    // A task with one candidate ranks nothing: there is no preference to express.
    assert.equal(opPriority('minimax-h3-ref2va', 'ref2v_ms'), null);
    assert.equal(opPriority('nvidia-pid', 'pid'), null);
});
