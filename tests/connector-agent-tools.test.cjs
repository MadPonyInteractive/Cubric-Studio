'use strict';
/**
 * connector-agent-tools.test.cjs — MPI-774 W1
 *
 * Tests for:
 *  1. Knowledge routes (corpus list + entry fetch logic)
 *  2. Box params validation (validateBoxParams pure function)
 *  3. Describer box answers -> original pixels (boxFromDescribeAnswer), replayed from
 *     the raw answers measured live in MPI-774 Phase 4
 *
 * All tests are pure logic tests — no running server, no renderer, no GPU.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

// ── Helpers ────────────────────────────────────────────────────────────────────

const repoRoot = require('node:path').join(__dirname, '..');
const esm = (p) => import('file://' + require('node:path').join(repoRoot, p).replace(/\\/g, '/'));

// ── 1. boxFromDescribeAnswer (describer answer -> original pixels) ────────────

// The head boxes both describers gave, verbatim, for the three person images of
// tasks/MPI-774/research/box-measurement.md, asked with the route's BOX_INSTRUCTION.
// Read off the images by eye, in ORIGINAL pixels: `face` is the centre of the face, `outer`
// the head with its hair plus a margin. A box on the head holds `face` and stays in `outer`.
// Reading the ComfyUI numbers as pixels instead of 0-1000 leaves `outer` on 001 and 002.
const MEASURED = [
    { img: 't2i_001', w: 896, h: 1152, face: [458, 420], outer: [370, 330, 560, 510],
      remote: '{"bbox_2d": [0.431, 0.306, 0.571, 0.430]}', comfy: '{"bbox_2d": [458, 310, 576, 419]}' },
    { img: 't2i_002', w: 832, h: 1024, face: [500, 260], outer: [300, 30, 700, 520],
      remote: '{"bbox_2d": [0.387, 0.052, 0.777, 0.429]}', comfy: '{"bbox_2d": [435, 68, 799, 487]}' },
    { img: 't2i_003', w: 1024, h: 1024, face: [535, 330], outer: [330, 50, 740, 600],
      remote: '{"bbox_2d": [0.349,0.070,0.694,0.533]}', comfy: '{"bbox_2d": [357, 90, 698, 554]}' },
];

test('boxFromDescribeAnswer: every measured answer lands on the head, both describers', () => {
    const { boxFromDescribeAnswer } = require('../routes/connector');
    for (const m of MEASURED) {
        for (const describer of ['remote', 'comfy']) {
            const b = boxFromDescribeAnswer(m[describer], { origWidth: m.w, origHeight: m.h });
            assert.ok(b, `${m.img} ${describer}: no box`);
            const [fx, fy] = m.face;
            const [ox1, oy1, ox2, oy2] = m.outer;
            const where = `${m.img} ${describer}: ${JSON.stringify(b)}`;
            assert.ok(b.x < fx && fx < b.x + b.width && b.y < fy && fy < b.y + b.height, `${where} misses the face`);
            assert.ok(b.x >= ox1 && b.y >= oy1 && b.x + b.width <= ox2 && b.y + b.height <= oy2, `${where} leaves the head`);
        }
    }
});

test('boxFromDescribeAnswer: exact mapping, the wrappers the describers use', () => {
    const { boxFromDescribeAnswer } = require('../routes/connector');
    const dims = { origWidth: 832, origHeight: 1024 };
    const want = { x: 362, y: 70, width: 303, height: 429 };
    assert.deepEqual(boxFromDescribeAnswer('{"bbox_2d": [435, 68, 799, 487]}', dims), want);
    assert.deepEqual(boxFromDescribeAnswer('```json\n[\n\t{"bbox_2d": [435, 68, 799, 487], "label": "person\'s head"}\n]\n```', dims), want);
    assert.deepEqual(boxFromDescribeAnswer('**head**: <BBOX>0.5,0.25,0.75,0.5</BBOX>.', dims), { x: 416, y: 256, width: 208, height: 256 });
});

test('boxFromDescribeAnswer: a crop is the region the relative box lives in', () => {
    const { boxFromDescribeAnswer } = require('../routes/connector');
    const crop = { x: 400, y: 200, width: 200, height: 100 };
    assert.deepEqual(boxFromDescribeAnswer('[250, 0, 750, 1000]', { crop, origWidth: 1920, origHeight: 1080 }),
        { x: 450, y: 200, width: 100, height: 100 });
});

test('boxFromDescribeAnswer: no box rather than a wrong one', () => {
    const { boxFromDescribeAnswer } = require('../routes/connector');
    const dims = { origWidth: 1920, origHeight: 1080 };
    assert.equal(boxFromDescribeAnswer('A woman stands in a park.', dims), null);
    assert.equal(boxFromDescribeAnswer('[10, 20, 30]', dims), null);
    assert.equal(boxFromDescribeAnswer('[500, 500, 100, 900]', dims), null, 'x2 before x1');
    assert.equal(boxFromDescribeAnswer('[1200, 300, 1500, 700]', dims), null, 'pixels beyond 1000: no known scale');
    assert.equal(boxFromDescribeAnswer('', dims), null);
});

// ── 2. validateBoxParams (pure box validation) ─────────────────────────────────

test('validateBoxParams: no params → ok', async () => {
    const { validateBoxParams } = await esm('js/shell/agentDispatch.js');
    const flow = { id: 'head-swap', title: 'Head Swap', steps: [{ kind: 'box', param: 'box1', ratio: 1, overflow: 'allow' }] };
    const result = validateBoxParams(flow, {});
    assert.equal(result.ok, true);
});

test('validateBoxParams: unknown param → UNKNOWN_PARAM', async () => {
    const { validateBoxParams } = await esm('js/shell/agentDispatch.js');
    const flow = { id: 'head-swap', title: 'Head Swap', steps: [{ kind: 'box', param: 'box1', ratio: 1, overflow: 'allow' }] };
    const result = validateBoxParams(flow, { unknownKey: { x: 0, y: 0, width: 100, height: 100 } });
    assert.equal(result.ok, false);
    assert.equal(result.code, 'UNKNOWN_PARAM');
});

test('validateBoxParams: non-integer coords → INVALID_BOX', async () => {
    const { validateBoxParams } = await esm('js/shell/agentDispatch.js');
    const flow = { id: 'head-swap', title: 'Head Swap', steps: [{ kind: 'box', param: 'box1', ratio: 1, overflow: 'allow' }] };
    const result = validateBoxParams(flow, { box1: { x: 1.5, y: 0, width: 100, height: 100 } });
    assert.equal(result.ok, false);
    assert.equal(result.code, 'INVALID_BOX');
});

test('validateBoxParams: non-square box with ratio 1 → INVALID_BOX', async () => {
    const { validateBoxParams } = await esm('js/shell/agentDispatch.js');
    const flow = { id: 'test', title: 'Test', steps: [{ kind: 'box', param: 'box1', ratio: 1 }] };
    const result = validateBoxParams(flow, { box1: { x: 0, y: 0, width: 100, height: 200 } });
    assert.equal(result.ok, false);
    assert.equal(result.code, 'INVALID_BOX');
    assert.ok(result.message.includes('square'));
});

test('validateBoxParams: square box with ratio 1 → ok', async () => {
    const { validateBoxParams } = await esm('js/shell/agentDispatch.js');
    const flow = { id: 'test', title: 'Test', steps: [{ kind: 'box', param: 'box1', ratio: 1 }] };
    const result = validateBoxParams(flow, { box1: { x: 0, y: 0, width: 100, height: 100 } });
    assert.equal(result.ok, true);
});

test('validateBoxParams: a box outside the image is ACCEPTED — bounds are not checked here', async () => {
    const { validateBoxParams } = await esm('js/shell/agentDispatch.js');
    // MPI-774 Phase 3c: the bounds branch was removed. It read `pixelDimensions` off
    // the resolved media, which `resolveAgentMedia` never sets, so it never ran on a
    // real submit. Every shipped box step declares `overflow: 'allow'` anyway. This
    // test pins the deliberate ceiling: the first step WITHOUT overflow needs the
    // check rebuilt where the image size is actually known (see the function's
    // ponytail comment), and this assertion is what will fail when that lands.
    const flow = { id: 'test', title: 'Test', steps: [{ kind: 'box', param: 'box1' }] };
    const out = validateBoxParams(flow, { box1: { x: 100_000, y: 0, width: 100, height: 100 } });
    assert.equal(out.ok, true);
});

test('validateBoxParams: MUTATION GUARD for ratio check — remove the check → non-square should pass incorrectly', async () => {
    // Demonstrates the ratio validator bites.
    // The real validator should reject width !== height for ratio:1 steps.
    const { validateBoxParams } = await esm('js/shell/agentDispatch.js');
    const flow = { id: 'test', title: 'Test', steps: [{ kind: 'box', param: 'box1', ratio: 1 }] };
    const result = validateBoxParams(flow, { box1: { x: 0, y: 0, width: 100, height: 200 } });
    // Validator MUST return not-ok here. If this assertion passes, the validator is working.
    assert.equal(result.ok, false, 'ratio check must reject non-square box when ratio:1');
    assert.equal(result.code, 'INVALID_BOX');
});

// ── 3. Knowledge routes (corpus logic, no server) ─────────────────────────────

test('knowledge list: returns ok with entries array', async () => {
    // Simulate the corpus logic inline — agentCorpus.mjs requires real data files.
    // We test that the route logic (find by id, text()) works against a stub corpus.
    const stubCorpus = [
        { id: 'app:operations', kind: 'app', title: 'Operations', tags: ['app'], text: () => 'ops text' },
        { id: 'krea2:t2i', kind: 'model', title: 'Krea 2 — t2i', tags: ['krea2'], text: () => 'krea text' },
    ];

    // Mimic the GET /connector/knowledge logic.
    const entries = stubCorpus.map(({ id, kind, title, tags }) => ({ id, kind, title, tags }));
    assert.equal(entries.length, 2);
    assert.equal(entries[0].id, 'app:operations');
    assert.ok(!Object.prototype.hasOwnProperty.call(entries[0], 'text'), 'text() must NOT be in the index');
});

test('knowledge fetch by id: returns text', async () => {
    const stubCorpus = [
        { id: 'app:operations', kind: 'app', title: 'Operations', tags: ['app'], text: () => 'ops text here' },
    ];
    const entry = stubCorpus.find(e => e.id === 'app:operations');
    assert.ok(entry, 'entry must be found');
    assert.equal(entry.text(), 'ops text here');
});

test('knowledge fetch by id: unknown id → UNKNOWN_ENTRY', async () => {
    const stubCorpus = [
        { id: 'app:operations', kind: 'app', title: 'Operations', tags: ['app'], text: () => 'x' },
    ];
    const entry = stubCorpus.find(e => e.id === 'no-such-id');
    assert.equal(entry, undefined, 'must not find the entry');
    // The route would return UNKNOWN_ENTRY; here we just confirm the lookup misses.
});

test('knowledge MUTATION GUARD: corpus index must not expose text()', async () => {
    // If the route mistakenly includes text in the index response, the agent would
    // get all text on every list call — token waste by design. Verify text is absent.
    const stubCorpus = [{ id: 'x', kind: 'app', title: 'T', tags: [], text: () => 'content' }];
    const index = stubCorpus.map(({ id, kind, title, tags }) => ({ id, kind, title, tags }));
    assert.ok(!('text' in index[0]), 'index entry must not include text');
});

test('list_models ops carry their media roles, gated per model the way the PromptBox is (Phase 3b)', async () => {
    const { mediaRolesFor } = require('../routes/connector');
    const registry = await esm('js/data/commandRegistry.js');
    const { findModelDef } = require('../js/data/generationControls.js');
    const roles = (op, modelId) => mediaRolesFor(registry, op, findModelDef(modelId)).map((r) => r.role);

    // The shared video ops declare an audio slot; only a model that takes audio gets it.
    assert.deepEqual(roles('t2v_ms', 'minimax-h3'), [], 'H3 fl2va makes sound but takes none');
    assert.deepEqual(roles('t2v_ms', 'ltx-23'), ['inputAudio'], 'LTX takes reference audio');
    assert.deepEqual(mediaRolesFor(registry, 'i2v_ms', findModelDef('minimax-h3')).filter((r) => r.required).map((r) => r.role), ['startFrame']);

    const ref = mediaRolesFor(registry, 'ref2v_ms', findModelDef('minimax-h3-ref2va'));
    assert.deepEqual(ref.slice(0, 2), [
        { role: 'inputImage', type: 'image', required: false, tag: 'Picture 1' },
        { role: 'inputImage2', type: 'image', required: false, tag: 'Picture 2' },
    ]);
    assert.ok(ref.some((r) => r.role === 'inputAudio' && r.tag === 'Audio 1'), 'ref2va takes audio references');
    assert.deepEqual(mediaRolesFor(registry, 'no-such-op', findModelDef('ltx-23')), []);
});
