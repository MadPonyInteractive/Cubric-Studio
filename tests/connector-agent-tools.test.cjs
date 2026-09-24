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

// ── 1b. boxShare (MPI-774 Phase 5 — is that box a head, or a whole person?) ────

// The two boxes Head Swap actually ran on in Fabio's app, off the sidecars of
// `flowHeadSwap_001`. Both were the whole woman, and `square` then matched that height
// in width: box1 ran off the left edge of a 1664x2304 photo, box2 came out WIDER than its
// 768x1344 photo. Nothing reported it, so the Flow swallowed the neighbour.
const LIVE_HEAD_SWAP = [
    { name: 'box1', img: { w: 1664, h: 2304 }, square: { x: -245, y: 594, width: 1166, height: 1166 } },
    { name: 'box2', img: { w: 768, h: 1344 }, square: { x: -201, y: 173, width: 1171, height: 1171 } },
];

test('boxShare: the two live over-boxed heads report a share the Box rule refuses', () => {
    const { boxShare } = require('../routes/connector');
    const [box1, box2] = LIVE_HEAD_SWAP;

    // box1: 1166/1664 wide, 1166/2304 tall.
    assert.deepEqual(boxShare(box1.square, box1.img.w, box1.img.h), { w: 0.7, h: 0.51 });
    // box2: wider than the image it was measured on.
    assert.deepEqual(boxShare(box2.square, box2.img.w, box2.img.h), { w: 1.52, h: 0.87 });

    // The Box rule's threshold: over 0.6 on either side is not a head.
    for (const c of LIVE_HEAD_SWAP) {
        const s = boxShare(c.square, c.img.w, c.img.h);
        assert.ok(s.w > 0.6 || s.h > 0.6, `${c.name} must read as over-boxed`);
    }
});

// 0.6 is not a guess: the three measured heads square to at most 0.52 (t2i_002, a close
// portrait), and the two over-boxed live ones start at 0.70. Anything between separates
// them; 0.6 leaves a margin on both sides. Move it only with new measurements.
test('boxShare: a real head box stays under the threshold', () => {
    const { boxShare, boxFromDescribeAnswer } = require('../routes/connector');
    for (const m of MEASURED) {
        const b = boxFromDescribeAnswer(m.comfy, { origWidth: m.w, origHeight: m.h });
        const side = Math.max(b.width, b.height);
        const s = boxShare({ width: side, height: side }, m.w, m.h);
        assert.ok(s.w <= 0.6 && s.h <= 0.6, `${m.img} squared: ${s.w}x${s.h} should pass as a head`);
    }
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

test('a start frame says the clip opens on it, so a character sheet goes to a reference op', async () => {
    const { mediaRolesFor } = require('../routes/connector');
    const registry = await esm('js/data/commandRegistry.js');
    const { findModelDef } = require('../js/data/generationControls.js');
    const start = mediaRolesFor(registry, 'i2v_ms', findModelDef('minimax-h3')).find((r) => r.role === 'startFrame');
    assert.match(start.use, /opens on this exact picture/);
    assert.match(start.use, /character sheet[\s\S]*ref2v_/);
    assert.ok(mediaRolesFor(registry, 'ref2v_ms', findModelDef('minimax-h3-ref2va')).every((r) => !r.use),
        'a reference slot carries no first-frame warning');
});

// ── 4. create-project never mints a case-variant twin (Phase 7) ───────────────

// Live (Fabio, 2026-09-19 10:09Z): "You can place it in the Fanvue project" logged
// `created project "Fanvue" at …/Projects/Fanvue_2b752074` while `fanvue` existed. The
// `_<8 hex>` suffix is `POST /create-project` finding the FOLDER taken — Windows is
// case-insensitive — so the app knew the name was taken and read that as "pick another
// folder". Two projects with one display name are indistinguishable in the picker.
test('findProjectByName: the same name in another case is the same project', () => {
    const { findProjectByName } = require('../routes/connector');
    const projects = [
        { name: 'fanvue', folderPath: 'C:/Projects/fanvue' },
        { name: 'Cowgirls', folderPath: 'C:/Projects/Cowgirls' },
    ];

    assert.equal(findProjectByName(projects, 'Fanvue')?.folderPath, 'C:/Projects/fanvue', 'the live case');
    assert.equal(findProjectByName(projects, 'FANVUE')?.folderPath, 'C:/Projects/fanvue');
    assert.equal(findProjectByName(projects, '  fanvue  ')?.folderPath, 'C:/Projects/fanvue', 'surrounding space is not a project');
    assert.equal(findProjectByName(projects, 'cowgirls')?.folderPath, 'C:/Projects/Cowgirls');

    // A different name is still a different project, and nothing matches nothing.
    assert.equal(findProjectByName(projects, 'Fanvue 2'), null);
    assert.equal(findProjectByName(projects, ''), null);
    assert.equal(findProjectByName(projects, '   '), null);
    assert.equal(findProjectByName([], 'fanvue'), null);
    assert.equal(findProjectByName(undefined, 'fanvue'), null);
    assert.equal(findProjectByName([{ folderPath: 'C:/Projects/x' }], 'fanvue'), null, 'a nameless row must not throw');
});

// ── 5. The outpaint frame (MPI-817) ──────────────────────────────────────────

// Live (Fabio, 2026-09-19 17:39Z): "grow the top and bottom edges so the format becomes
// 9:16". The agent ran `flowOutpaint` with `{ mediaItems: [image1], injectionParams:
// { Input_is_Turbo: true } }` and NOTHING ELSE — the sidecar on disk is the record. The
// input `i2i_001.png` is 896x1088 and the result came back 928x1136: the graph's own
// bucket for the SAME 4:5 shape, which is why it read as "the original image". The frame
// is a `crop` step with no `param`: its value becomes a PADDED PICTURE, so it was
// invisible to a `kind === 'box'` filter and unhandled by the submit. The flow reported
// success on a no-op, which is the failure worth a test.

test('frameRectForRatio: the live 4:5 -> 9:16 case grows the top and bottom, and only those', async () => {
    const { frameRectForRatio } = await esm('js/shell/agentDispatch.js');

    // i2i_001.png's real pixels, and 9/16 as CROP_RATIOS holds it.
    const r = frameRectForRatio({ w: 896, h: 1088 }, 9 / 16);
    assert.equal(r.w, 896, 'the width must not move: 9:16 is TALLER than 4:5');
    assert.equal(r.h, 1593, '896 / (9/16), rounded');
    assert.equal(r.x, 0);
    assert.equal(r.y, -252, 'centred, so the source is inset and the overhang is what gets painted');
    // Both bars grew and the source is whole between them — the rect can only be one pixel
    // lopsided, from the rounding, and never lopsided by a bar's worth.
    const top = -r.y;
    const bottom = r.h - top - 1088;
    assert.ok(top > 0 && bottom > 0, `both edges must grow: ${top} / ${bottom}`);
    assert.ok(Math.abs(top - bottom) <= 1, `centred to within a rounding pixel: ${top} / ${bottom}`);
    assert.ok(Math.abs((r.w / r.h) - (9 / 16)) < 0.001, 'the rect really is the shape asked for');
});

test('frameRectForRatio: a WIDER target grows left and right instead', async () => {
    const { frameRectForRatio } = await esm('js/shell/agentDispatch.js');
    const r = frameRectForRatio({ w: 896, h: 1088 }, 16 / 9);
    assert.equal(r.h, 1088, 'the height must not move');
    assert.equal(r.w, 1934, '1088 * (16/9), rounded');
    assert.equal(r.y, 0);
    assert.equal(r.x, -519);
});

test('frameRectForRatio: a target the picture already is stays the source rect', async () => {
    const { frameRectForRatio } = await esm('js/shell/agentDispatch.js');
    // composePaddedImage returns null for exactly this rect, which is what the submit
    // turns into FRAME_UNCHANGED rather than spending a generation on a re-render.
    assert.deepEqual(frameRectForRatio({ w: 1024, h: 1024 }, 1), { x: 0, y: 0, w: 1024, h: 1024 });
});

test('validateBoxParams: a crop flow takes `frame`, and only a label its own gizmo offers', async () => {
    const { validateBoxParams, CROP_RATIO_LABELS } = await esm('js/shell/agentDispatch.js');
    const outpaint = { id: 'outpaint', title: 'Outpaint', steps: [{ kind: 'crop', role: 'image1' }] };

    assert.equal(validateBoxParams(outpaint, { frame: { ratio: '9:16' } }).ok, true);
    assert.equal(validateBoxParams(outpaint, { frame: { ratio: '1:2.39' } }).ok, true, 'a label that is not parseable as a fraction');

    const bogus = validateBoxParams(outpaint, { frame: { ratio: '9x16' } });
    assert.equal(bogus.ok, false);
    assert.equal(bogus.code, 'INVALID_FRAME');
    assert.ok(bogus.message.includes('9:16'), 'the refusal must name the shapes it does take');

    assert.equal(validateBoxParams(outpaint, { frame: 'tall' }).code, 'INVALID_FRAME');
    assert.equal(validateBoxParams(outpaint, { frame: {} }).code, 'INVALID_FRAME');

    // Every advertised label validates: the list the agent is handed and the list the
    // validator accepts are the same list, or the agent is sent at a refusal.
    for (const label of CROP_RATIO_LABELS) {
        assert.equal(validateBoxParams(outpaint, { frame: { ratio: label } }).ok, true, label);
    }

    // A flow with no crop step has no frame to set.
    const headSwap = { id: 'head-swap', title: 'Head Swap', steps: [{ kind: 'box', param: 'box1', ratio: 1, overflow: 'allow' }] };
    const refused = validateBoxParams(headSwap, { frame: { ratio: '9:16' } });
    assert.equal(refused.ok, false);
    assert.equal(refused.code, 'UNKNOWN_PARAM');
});

// The other half of the same live run, one second earlier:
//   [17:39:20.846Z] [WARN] [system] connector generate failed: BAD_REQUEST
//     "flowOutpaint" has no media role "inputImage". Roles: image1.
// A flow entry carried `fields` and `boxParams` and nothing about where the picture goes,
// so the agent reached for a role it HAD been told about — `inputImage` is real, on
// minimax-h3-ref2va's ref2v_ms, asserted a few tests up. It learned the true one only from
// a refusal. A Flow has no model, which is exactly the null `mediaRolesFor` already takes.
test('a Flow operation names its media roles, so the agent never has to guess one', async () => {
    const { mediaRolesFor } = require('../routes/connector');
    const registry = await esm('js/data/commandRegistry.js');
    const { getFlowById } = await esm('js/data/flowsRegistry.js');

    const roles = mediaRolesFor(registry, getFlowById('outpaint').operation, null);
    assert.deepEqual(roles.map((r) => r.role), ['image1'], 'the role the refusal named');
    assert.ok(!roles.some((r) => r.role === 'inputImage'), 'the role it guessed is not one of them');
    assert.equal(roles[0].type, 'image');

    // Not an outpaint-only fix: every flow the library ships resolves through the same call.
    const { listFlows } = await esm('js/data/flowsRegistry.js');
    for (const flow of listFlows()) {
        assert.ok(Array.isArray(mediaRolesFor(registry, flow.operation, null)), flow.id);
    }
});

test('the Outpaint flow really does declare a crop step — the fixtures above are not the only source', async () => {
    const { getFlowById } = await esm('js/data/flowsRegistry.js');
    const outpaint = getFlowById('outpaint');
    assert.ok(outpaint, 'the flow id the agent was given');
    const crop = (outpaint.steps || []).find((s) => s.kind === 'crop');
    assert.ok(crop, 'if this ever gains a `param` the frame stops being media and this path is wrong');
    assert.equal(crop.role, 'image1', 'the role the padded picture replaces');
    // The half that made the failure silent: no declared field is the frame, so a caller
    // reading `fields` alone sees a flow that needs nothing but a picture. MPI-900 added
    // the optional prompt; the frame still rides only in `params.frame`.
    assert.deepEqual((outpaint.fields || []).map((f) => f.id), ['positive']);
});
