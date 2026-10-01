/**
 * routine-model.test.cjs — MPI-970 T1.
 *
 * Pure unit tests for js/data/routineModel.js. Lookups are built from the REAL
 * catalogues (MODELS from models.js, FLOWS from flowsRegistry.js) so the test
 * breaks if those shapes drift, rather than silently passing against stale mocks.
 * Small hand-made fixtures are used only where a realistic sub-object is shorter.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const repo = (p) => path.join(__dirname, '..', p);
const esm = (p) => import('file:///' + repo(p).replace(/\\/g, '/'));

// ── Fixture helpers ───────────────────────────────────────────────────────────

/** Minimal step for a valid routine. */
const toolStep = (op = 'imageUpscale', fields = {}) => ({ operation: op, ...fields && Object.keys(fields).length ? { fields } : {} });
const modelStep = (modelId, operation, extra = {}) => ({ modelId, operation, ...extra });
const flowStep = (flowId, fields = undefined) => fields ? { flowId, fields } : { flowId };

/** Wrap steps into a valid raw routine. */
const raw = (steps, overrides = {}) => ({
    name: 'My Routine',
    summary: 'Does something useful',
    steps,
    ...overrides,
});

// ── Shared setup ──────────────────────────────────────────────────────────────

let normalizeRoutine, validateRoutine, routineSummary, ROUTINE_SCHEMA;
let MODELS, FLOWS, lookups;

test.before(async () => {
    const mod = await esm('js/data/routineModel.js');
    normalizeRoutine = mod.normalizeRoutine;
    validateRoutine = mod.validateRoutine;
    routineSummary = mod.routineSummary;
    ROUTINE_SCHEMA = mod.ROUTINE_SCHEMA;

    const modelsMod = await esm('js/data/modelConstants/models.js');
    MODELS = modelsMod.MODELS;

    const flowsMod = await esm('js/data/flowsRegistry.js');
    FLOWS = flowsMod.FLOWS;

    lookups = { models: MODELS, flows: FLOWS };
});

// ── normalizeRoutine ──────────────────────────────────────────────────────────

test('normalizeRoutine fills schema and created_at from raw input', async () => {
    const r = normalizeRoutine({ name: ' Trim Me ', summary: 'ok', steps: [toolStep()] });
    assert.strictEqual(r.schema, ROUTINE_SCHEMA);
    assert.strictEqual(r.name, 'Trim Me');
    assert.ok(r.created_at, 'created_at must be set');
    assert.ok(typeof r.created_at === 'string', 'created_at must be a string');
});

test('normalizeRoutine preserves an existing created_at', async () => {
    const ts = '2026-01-01T00:00:00.000Z';
    const r = normalizeRoutine({ name: 'x', summary: 'y', steps: [], created_at: ts });
    assert.strictEqual(r.created_at, ts);
});

test('normalizeRoutine coerces a non-object gracefully', async () => {
    const r = normalizeRoutine(null);
    assert.strictEqual(r.name, '');
    assert.deepStrictEqual(r.steps, []);
});

// ── validateRoutine — legal chains ────────────────────────────────────────────

test('legal 3-step chain: tool → model → tool (all image)', async () => {
    // imageUpscale outputs image; klein-4b i2i takes image, outputs image;
    // downscale takes image. All image throughout.
    const r = normalizeRoutine(raw([
        toolStep('imageUpscale'),
        modelStep('klein-4b', 'i2i', { ratio: '1:1' }),
        toolStep('downscale', { fields: { megapixels: 1 } }),
    ]));
    const v = validateRoutine(r, lookups);
    assert.strictEqual(v.ok, true, `expected ok; got ${v.code}: ${v.message}`);
    assert.strictEqual(v.inputKind, 'image');
    // Returned routine steps must not carry internal _kind tags
    assert.ok(!('_kind' in v.routine.steps[0]), 'no _kind tag should leak into returned routine');
    assert.ok(Array.isArray(v.routine.steps) && v.routine.steps.length === 3);
});

test('legal 3-step chain: tool → flow → tool (all image)', async () => {
    // imageUpscale → scribble Flow (image→image) → downscale
    const r = normalizeRoutine(raw([
        toolStep('imageUpscale'),
        flowStep('scribble'),
        toolStep('removeBackground'),
    ]));
    const v = validateRoutine(r, lookups);
    assert.strictEqual(v.ok, true, `expected ok; got ${v.code}: ${v.message}`);
    assert.strictEqual(v.inputKind, 'image');
});

test('NOT_BATCHABLE — a t2i step takes no input, first or later (D1, selectCueAllTargets)', async () => {
    // t2i would drop the card (step 1) or the previous result (later step)
    for (const steps of [
        [modelStep('klein-4b', 't2i'), toolStep('imageUpscale')],
        [toolStep('imageUpscale'), modelStep('klein-4b', 't2i')],
    ]) {
        const v = validateRoutine(normalizeRoutine(raw(steps)), lookups);
        assert.strictEqual(v.ok, false);
        assert.strictEqual(v.code, 'NOT_BATCHABLE');
    }
});

test('image → video chain is legal (i2v_ms on ltx-23)', async () => {
    // imageUpscale → ltx-23/i2v_ms: image in, video out
    const r = normalizeRoutine(raw([
        toolStep('imageUpscale'),
        modelStep('ltx-23', 'i2v_ms'),
    ]));
    const v = validateRoutine(r, lookups);
    assert.strictEqual(v.ok, true, `expected ok; got ${v.code}: ${v.message}`);
    assert.strictEqual(v.inputKind, 'image');
    assert.strictEqual(v.outputKind, 'video', 'the chain ends on the i2v step, so the result cards end on a video');
});

test('a ratio param on a model step is kept (Fabio rule)', async () => {
    // A ratio must not be stripped or cause a refusal
    const r = normalizeRoutine(raw([
        modelStep('klein-4b', 'i2i', { ratio: '16:9' }),
    ]));
    const v = validateRoutine(r, lookups);
    assert.strictEqual(v.ok, true, `expected ok; got ${v.code}: ${v.message}`);
    assert.strictEqual(v.routine.steps[0].ratio, '16:9', 'ratio should be preserved in returned routine');
});

// ── validateRoutine — refusal codes ──────────────────────────────────────────

test('INVALID_ROUTINE — wrong schema', async () => {
    const r = normalizeRoutine(raw([toolStep()]));
    const v = validateRoutine({ ...r, schema: 'cubric/routine/v2' }, lookups);
    assert.strictEqual(v.ok, false);
    assert.strictEqual(v.code, 'INVALID_ROUTINE');
});

test('INVALID_ROUTINE — missing name', async () => {
    const r = normalizeRoutine(raw([toolStep()], { name: '' }));
    const v = validateRoutine(r, lookups);
    assert.strictEqual(v.ok, false);
    assert.strictEqual(v.code, 'INVALID_ROUTINE');
});

test('INVALID_ROUTINE — missing summary', async () => {
    const r = normalizeRoutine(raw([toolStep()], { summary: '' }));
    const v = validateRoutine(r, lookups);
    assert.strictEqual(v.ok, false);
    assert.strictEqual(v.code, 'INVALID_ROUTINE');
});

test('INVALID_ROUTINE — empty steps array', async () => {
    const r = normalizeRoutine(raw([]));
    const v = validateRoutine(r, lookups);
    assert.strictEqual(v.ok, false);
    assert.strictEqual(v.code, 'INVALID_ROUTINE');
});

test('INVALID_ROUTINE — step has both modelId and flowId', async () => {
    const r = normalizeRoutine(raw([{ modelId: 'klein-4b', operation: 'i2i', flowId: 'scribble' }]));
    const v = validateRoutine(r, lookups);
    assert.strictEqual(v.ok, false);
    assert.strictEqual(v.code, 'INVALID_ROUTINE');
});

test('INVALID_ROUTINE — step is not a tool, model or flow op', async () => {
    const r = normalizeRoutine(raw([{ someField: 'x' }]));
    const v = validateRoutine(r, lookups);
    assert.strictEqual(v.ok, false);
    assert.strictEqual(v.code, 'INVALID_ROUTINE');
});

test('TOO_MANY_STEPS — 11 steps', async () => {
    const r = normalizeRoutine(raw(Array(11).fill(toolStep())));
    const v = validateRoutine(r, lookups);
    assert.strictEqual(v.ok, false);
    assert.strictEqual(v.code, 'TOO_MANY_STEPS');
});

test('10 steps is the maximum and must be accepted', async () => {
    const r = normalizeRoutine(raw(Array(10).fill(toolStep())));
    const v = validateRoutine(r, lookups);
    assert.strictEqual(v.ok, true, `exactly 10 steps must be valid; got ${v.code}: ${v.message}`);
});

test('STEP_HAS_MEDIA — step with a fixed file in media', async () => {
    const r = normalizeRoutine(raw([{ modelId: 'klein-4b', operation: 'kleinEdit', media: [{ role: 'inputImage2', url: 'C:/p/ref.png' }] }]));
    const v = validateRoutine(r, lookups);
    assert.strictEqual(v.ok, false);
    assert.strictEqual(v.code, 'STEP_HAS_MEDIA');
});

test('STEP_HAS_MEDIA — step with cards field', async () => {
    const r = normalizeRoutine(raw([{ operation: 'imageUpscale', cards: [] }]));
    const v = validateRoutine(r, lookups);
    assert.strictEqual(v.ok, false);
    assert.strictEqual(v.code, 'STEP_HAS_MEDIA');
});

test('STEP_HAS_MEDIA — step with count field', async () => {
    const r = normalizeRoutine(raw([{ operation: 'imageUpscale', count: 3 }]));
    const v = validateRoutine(r, lookups);
    assert.strictEqual(v.ok, false);
    assert.strictEqual(v.code, 'STEP_HAS_MEDIA');
});

test('UNKNOWN_MODEL — modelId not in catalogue', async () => {
    const r = normalizeRoutine(raw([modelStep('no-such-model', 'i2i')]));
    const v = validateRoutine(r, lookups);
    assert.strictEqual(v.ok, false);
    assert.strictEqual(v.code, 'UNKNOWN_MODEL');
});

test('UNKNOWN_OPERATION — operation not in model supportedOps', async () => {
    const r = normalizeRoutine(raw([modelStep('klein-4b', 'i2v_ms')]));
    const v = validateRoutine(r, lookups);
    assert.strictEqual(v.ok, false);
    assert.strictEqual(v.code, 'UNKNOWN_OPERATION');
});

test('UNKNOWN_FLOW — flowId not in catalogue', async () => {
    const r = normalizeRoutine(raw([flowStep('no-such-flow')]));
    const v = validateRoutine(r, lookups);
    assert.strictEqual(v.ok, false);
    assert.strictEqual(v.code, 'UNKNOWN_FLOW');
});

test('INVALID_FIELD — bad tool field value', async () => {
    // upscaler must be one of the known values; pass it directly in the step
    const r = normalizeRoutine(raw([{ operation: 'imageUpscale', fields: { upscaler: 'bad-value' } }]));
    const v = validateRoutine(r, lookups);
    assert.strictEqual(v.ok, false);
    assert.strictEqual(v.code, 'INVALID_FIELD');
});

test('INVALID_FIELD — unknown flow field', async () => {
    // pass a key the flow does not declare
    const r = normalizeRoutine(raw([flowStep('scribble', { no_such_field: 'x' })]));
    const v = validateRoutine(r, lookups);
    assert.strictEqual(v.ok, false);
    assert.strictEqual(v.code, 'INVALID_FIELD');
});

test('INVALID_RATIO — bad ratio on a model step', async () => {
    const r = normalizeRoutine(raw([modelStep('klein-4b', 'i2i', { ratio: 'INVALID_RATIO_STRING' })]));
    const v = validateRoutine(r, lookups);
    assert.strictEqual(v.ok, false);
    // resolveNamedParams returns INVALID_RATIO; validateRoutine forwards the code
    assert.strictEqual(v.code, 'INVALID_RATIO');
});

test('NOT_BATCHABLE — flow with two required inputs', async () => {
    // scribble-object declares image1 + image2 as required — not usable in a chain
    const r = normalizeRoutine(raw([flowStep('scribble-object')]));
    const v = validateRoutine(r, lookups);
    assert.strictEqual(v.ok, false);
    assert.strictEqual(v.code, 'NOT_BATCHABLE');
});

test('MEDIA_KIND_BREAK — image → video → image chain', async () => {
    // imageUpscale (out:image) → ltx-23 i2v_ms (in:image, out:video)
    // → imageUpscale (in:image) — but previous step outputs video → break
    const r = normalizeRoutine(raw([
        toolStep('imageUpscale'),
        modelStep('ltx-23', 'i2v_ms'),
        toolStep('imageUpscale'),
    ]));
    const v = validateRoutine(r, lookups);
    assert.strictEqual(v.ok, false);
    assert.strictEqual(v.code, 'MEDIA_KIND_BREAK');
    assert.ok(v.message.includes('video'), 'message should mention the type mismatch');
    assert.ok(v.message.includes('image'), 'message should mention the expected type');
});

test('crop and downscale with natural=null are treated as fields-legal (IMAGE_NOT_FOUND is ok)', async () => {
    // These require pixel dimensions at run time. The validator must accept them.
    const r = normalizeRoutine(raw([
        { operation: 'crop', fields: { ratio: '1:1' } },
    ]));
    const v = validateRoutine(r, lookups);
    assert.strictEqual(v.ok, true,
        `crop with valid fields should pass validation; got ${v.code}: ${v.message}`);
});

// ── routineSummary ────────────────────────────────────────────────────────────

test('routineSummary returns name — summary (step chain)', async () => {
    const r = normalizeRoutine(raw([
        toolStep('imageUpscale'),
        modelStep('klein-4b', 'i2i'),
        toolStep('downscale'),
    ]));
    const s = routineSummary(r);
    assert.ok(s.includes('My Routine'), 'must include name');
    assert.ok(s.includes('Does something useful'), 'must include summary');
    assert.ok(s.includes('imageUpscale'), 'must include tool op');
    assert.ok(s.includes('klein-4b/i2i'), 'must include model/op');
    assert.ok(s.includes('→'), 'must include step separator');
});

test('routineSummary works on a flow step', async () => {
    const r = normalizeRoutine(raw([flowStep('scribble')]));
    const s = routineSummary(r);
    assert.ok(s.includes('scribble'), 'must include flow id');
});

// ── Run inputs (D9) ───────────────────────────────────────────────────────────

/** Klein Edit with the card in its edited-picture slot and a run input as the reference. */
const placeStep = (extra = {}) => modelStep('klein-4b', 'kleinEdit', {
    positive: 'the person from the second picture in this scene, {mood} light',
    media: [{ role: 'inputImage2', input: 'character' }],
    ...extra,
});
const INPUTS = [{ id: 'character', kind: 'image', label: 'the person to place' }, { id: 'mood', kind: 'text' }];

test('D9: a reference-slot picture input and a {text} input validate, and list shows what run needs', async () => {
    const r = normalizeRoutine(raw([toolStep('imageUpscale'), placeStep()], { inputs: INPUTS }));
    const v = validateRoutine(r, lookups);
    assert.strictEqual(v.ok, true, v.message);
    assert.deepStrictEqual(v.routine.inputs, INPUTS);
    assert.strictEqual(v.inputKind, 'image', 'the card still goes in the one required slot');
    assert.match(routineSummary(v.routine), /; needs character \(image, the person to place\), mood \(text\)$/);
    assert.deepStrictEqual(normalizeRoutine(raw([toolStep()])).inputs, [], 'no inputs = an empty list');
});

test('D9: every wrong input reference is refused at save', async () => {
    const cases = [
        ['an undeclared media input', [placeStep({ media: [{ role: 'inputImage2', input: 'nobody' }] })], INPUTS, 'INVALID_INPUT'],
        ['the required slot', [placeStep({ media: [{ role: 'inputImage', input: 'character' }] })], INPUTS, 'INVALID_INPUT'],
        ['a role the op lacks', [placeStep({ media: [{ role: 'inputVideo', input: 'character' }] })], INPUTS, 'INVALID_INPUT'],
        ['a sound in a picture slot', [placeStep({ positive: 'x', media: [{ role: 'inputImage2', input: 'voice' }] })],
            [{ id: 'voice', kind: 'audio' }], 'INVALID_INPUT'],
        ['one role twice', [placeStep({ media: [{ role: 'inputImage2', input: 'character' }, { role: 'inputImage2', input: 'character' }] })], INPUTS, 'INVALID_INPUT'],
        ['media on a tool step', [{ operation: 'imageUpscale', media: [{ role: 'inputImage2', input: 'character' }] }, placeStep()], INPUTS, 'INVALID_INPUT'],
        ['an undeclared {word}', [placeStep({ positive: '{mood} under {weather}' })], INPUTS, 'INVALID_INPUT'],
        ['a picture input in the text', [placeStep({ positive: 'put {character} here, {mood}' })], INPUTS, 'INVALID_INPUT'],
        ['a declared input no step uses', [placeStep()], [...INPUTS, { id: 'logo', kind: 'image' }], 'INVALID_INPUT'],
        ['a bad id', [placeStep()], [...INPUTS, { id: 'Bad Id', kind: 'text' }], 'INVALID_INPUT'],
        ['a bad kind', [placeStep()], [INPUTS[0], { id: 'mood', kind: 'number' }], 'INVALID_INPUT'],
        ['an id twice', [placeStep()], [...INPUTS, INPUTS[1]], 'INVALID_INPUT'],
        ['media that is not a list', [placeStep({ media: { role: 'inputImage2', input: 'character' } })], INPUTS, 'STEP_HAS_MEDIA'],
    ];
    for (const [why, steps, inputs, code] of cases) {
        const v = validateRoutine(normalizeRoutine(raw(steps, { inputs })), lookups);
        assert.strictEqual(v.ok, false, `${why}: must be refused`);
        assert.strictEqual(v.code, code, `${why}: ${v.message}`);
    }
    const notList = validateRoutine({ ...normalizeRoutine(raw([toolStep()])), inputs: { mood: 'text' } }, lookups);
    assert.strictEqual(notList.code, 'INVALID_ROUTINE');
});

test('D9: a text input fills a Flow field too', async () => {
    const v = validateRoutine(normalizeRoutine(raw([flowStep('outpaint', { positive: 'a {mood} sky' })],
        { inputs: [{ id: 'mood', kind: 'text' }] })), lookups);
    assert.strictEqual(v.ok, true, v.message);
});

test('MPI-1009: a key a step would silently drop is refused, as /connector/generate refuses it', async () => {
    const check = (step) => validateRoutine(normalizeRoutine(raw([step])), lookups);
    const prompt = check(modelStep('klein-4b', 'i2i', { ratio: '1:1', prompt: 'snowy evening' }));
    assert.strictEqual(prompt.code, 'INVALID_FIELD');
    assert.match(prompt.message, /positive/);
    const loose = check({ operation: 'crop', ratio: '1:1' });
    assert.strictEqual(loose.code, 'INVALID_FIELD');
    assert.match(loose.message, /ratio goes in fields for crop/);
    // The same values where the step reads them still pass.
    assert.strictEqual(check(modelStep('klein-4b', 'i2i', { ratio: '1:1', positive: 'snowy evening' })).ok, true);
    assert.strictEqual(check({ operation: 'crop', fields: { ratio: '1:1' } }).ok, true);
});
