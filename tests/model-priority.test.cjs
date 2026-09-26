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

test('an i2i op carries the technique note as well as the model note (MPI-817)', () => {
    // Live 2026-09-21: "make this anime" went to klein's editor, which dressed the subject, and
    // "can you use a different technique?" could not be answered — no i2i op had a note at all.
    // The model half says which look it paints, the op half says how a restyle is run; a restyle
    // needs both, so one must never replace the other.
    const illAnime = opPriority('ill-anime', 'i2i').note;
    assert.match(illAnime, /anime/, 'the model note survives');
    assert.match(illAnime, /repaints the whole picture from the WORDS/, 'the i2i note is appended');
    assert.match(illAnime, /denoise/, 'and it names the brake');
    // MPI-867, Fabio 2026-09-26: a "convert to 3D" i2i missed and the agent kept re-running it
    // at other denoise values. A miss switches technique; it never turns the same slider again.
    assert.match(illAnime, /next try is an edit op, never this op at another denoise/);

    // Every i2i op gets it, not just the one that broke.
    assert.match(opPriority('krea2', 'i2i').note, /repaints the whole picture/);

    // Scoped to i2i: an edit op and another image task are untouched.
    assert.doesNotMatch(opPriority('klein-9b', 'kleinEdit').note, /repaints the whole picture/);
    assert.doesNotMatch(opPriority('krea2', 'upscale').note, /repaints the whole picture/);
});

test('klein 9B edit declares the habit that made a restyle wrong (MPI-817)', () => {
    assert.match(opPriority('klein-9b', 'kleinEdit').note, /cover a bare subject/);
});

test('a PAID model ranks below every local one, and says what it costs (MPI-875)', () => {
    // Live on 2026-09-21 the agent picked `nano-banana-2-cloud` for a plain t2i and billed
    // the user unasked. It was not ignoring the ranking: no cloud model was in the table at
    // all, so `opPriority` answered null — and null reads as "unranked", not as "avoid".
    const cloud = MODELS.filter((m) => m.provider);
    assert.ok(cloud.length > 0, 'no cloud models — re-anchor this test');

    for (const model of cloud) {
        for (const op of model.supportedOps || []) {
            const entry = opPriority(model.id, op);
            assert.ok(entry, `${model.id}:${op} is unranked, which reads to the agent as "unranked", not "avoid"`);

            // Below the last LOCAL model that does the same task. Rank 1 for a paid model
            // would be the same bug wearing a number.
            const localsBelow = MODELS.filter((m) => !m.provider && (m.supportedOps || []).includes(op))
                .map((m) => opPriority(m.id, op)?.rank)
                .filter((r) => Number.isFinite(r) && r >= entry.rank);
            assert.equal(localsBelow.length, 0,
                `${model.id}:${op} ranks ${entry.rank}, at or above a local model doing the same task`);

            // The note is the half a rank cannot carry: what it costs, so the agent can
            // answer for it when a user asks for the cloud on purpose.
            assert.match(entry.note, /^PAID: /, `${model.id}:${op} has no paid warning`);
            assert.match(entry.note, /about \$\d/, `${model.id}:${op} names no price`);
        }
    }
});

test('every ranked op names its task, and a paid one says so (MPI-916)', () => {
    // The op ids differ per model (kleinEdit, krea2Edit), so only `task` tells the agent's
    // catalogue which ops compete for its `best` mark; `paid` keeps a cloud op off it.
    for (const [task, pairs] of RANKED) {
        for (const [m, o] of pairs) assert.equal(opPriority(m, o).task, task, `${m}:${o}`);
    }
    assert.equal(opPriority('klein-9b', 'kleinEdit').paid, undefined, 'a local op is not paid');
    for (const model of MODELS.filter((m) => m.provider)) {
        for (const op of model.supportedOps || []) assert.equal(opPriority(model.id, op).paid, true, `${model.id}:${op}`);
    }
});

test('the local order is untouched by the paid models being ranked (MPI-875)', () => {
    // The paid entries are appended after the locals are ranked, so adding one must not
    // renumber anything a local model was promised.
    assert.equal(opPriority('krea2', 't2i').rank, 1);
    assert.equal(opPriority('boogu-edit-high', 'edit').rank, 1);
    assert.equal(opPriority('minimax-h3', 't2v_ms').rank, 1);
});

test('nothing an agent must not drift to is ranked', () => {
    // An `-nsfw` variant is the user's explicit choice, never a default the ranking makes.
    // It carries a note instead (Fabio, MPI-916): an explicit adult request takes it when installed.
    for (const m of MODELS.filter((x) => x.id.includes('nsfw'))) {
        for (const op of m.supportedOps || []) {
            const entry = opPriority(m.id, op);
            assert.equal(entry.rank, undefined, `${m.id}:${op} must not be ranked`);
            assert.equal(entry.task, undefined, `${m.id}:${op} must never compete for best`);
            assert.match(entry.note, /explicit adult request/);
        }
    }
    // A task with one candidate ranks nothing: there is no preference to express.
    assert.equal(opPriority('nvidia-pid', 'pid'), null);
});

test('a character sheet is steered to the reference op, and a re-run away from i2i (MPI-916)', () => {
    // ref2v is a list of one, ranked only so its note reaches the agent: unranked and
    // unannotated, it lost to i2v's rank 1 and the sheet went in as a first frame.
    const ref = opPriority('minimax-h3-ref2va', 'ref2v_ms');
    assert.equal(ref.task, 'ref2v');
    assert.match(ref.note, /character sheet/);
    for (const [m, o] of RANKED.find(([t]) => t === 'i2v')[1]) {
        assert.match(opPriority(m, o).note, /never a start frame/, `${m}:${o}`);
    }
    assert.match(opPriority('ill-anime', 'i2i').note, /re-run: that model's t2i, with no media/);
});
