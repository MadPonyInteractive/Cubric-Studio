/**
 * flow-passes.test.cjs — D3 planner registry (MPI-1101 Phase 3a).
 *
 * Verifies:
 *  - The seamless planner calls /seamless/prepare, reads the window count, and
 *    returns firstPassMedia containing window 0's files.
 *  - Subsequent next() calls fetch /seamless/window and return passIndex/passCount.
 *  - 1024×1024 with left+right 10% → 1 window.
 *  - 8192×4096 pano with left+right 10% → N windows (planAxis math).
 *  - The outpaint planner is registered and can be retrieved.
 *
 * Fetch is stubbed — no server required.
 *
 * Run: node --test tests/flow-passes.test.cjs
 */

'use strict';

const test  = require('node:test');
const assert = require('node:assert/strict');
const path   = require('node:path');

const esm = p => import('file://' + path.join(__dirname, '..', p).replace(/\\/g, '/'));

// ── helpers ─────────────────────────────────────────────────────────────────

/** Build the expected window count using the real seamlessOps math. */
function expectedWindowCount(w, h, handles) {
    const { bandRange, planAxis } = require(path.join(__dirname, '..', 'services', 'seamlessOps.js'));
    const bandX = (handles.left > 0 || handles.right > 0)
        ? bandRange(w, handles.left / 100, handles.right / 100) : null;
    const bandY = (handles.top > 0 || handles.bottom > 0)
        ? bandRange(h, handles.top / 100, handles.bottom / 100) : null;
    return planAxis(w, h, bandX, 'x').length + planAxis(w, h, bandY, 'y').length;
}

/** Minimal synthetic flow with an edges step. */
function _makeSeamlessFlow() {
    return {
        id: 'test-seamless',
        operation: 'flowMakeSeamless',
        passes: 'seamless',
        steps: [
            { kind: 'edges', role: 'image1' },
        ],
        fields: [],
    };
}

/** A stub fetch that records calls and returns prepared responses. */
function _makeFetch(prepareResponse) {
    const calls = [];
    const fetch = async (url, opts) => {
        const body = opts?.body ? JSON.parse(opts.body) : {};
        calls.push({ url, body });
        if (url.includes('/seamless/prepare')) {
            return {
                ok: true,
                json: async () => prepareResponse,
            };
        }
        if (url.includes('/seamless/window')) {
            const i = body.i;
            return {
                ok: true,
                json: async () => ({
                    ok: true,
                    image: `/project-file?path=win_${i}_img.png`,
                    mask:  `/project-file?path=win_${i}_mask.png`,
                }),
            };
        }
        return { ok: false, json: async () => ({ ok: false }) };
    };
    return { fetch, calls };
}

/** Build a fake prepare response for w×h with left/right pct handles. */
function _prepareResponse(w, h, handles, runId = 'test-run-id') {
    const count = expectedWindowCount(w, h, handles);
    const windows = Array.from({ length: count }, (_, i) => ({
        i, rect: { left: 0, top: 0, width: 100, height: 100 }, axis: 'x',
    }));
    return { ok: true, runId, width: w, height: h, windows };
}

// ── Outpaint planner is registered ──────────────────────────────────────────

test('getPlanner("outpaint") returns a function', async () => {
    const { getPlanner } = await esm('js/utils/flowPasses.js');
    assert.equal(typeof getPlanner('outpaint'), 'function');
});

// The lookup MpiBaseFlow._planPasses and agentDispatch use. A planner registered under a name no
// FlowDef carries (it was `flowMakeOutpaint`, the op is `flowOutpaint`) silently ran Outpaint's
// multi-pass frame as ONE pass.
test('every built-in multi-pass FlowDef resolves its planner', async () => {
    const { getPlanner } = await esm('js/utils/flowPasses.js');
    const { FLOWS } = await esm('js/data/flowsRegistry.js');
    const multi = FLOWS.filter(f => (f.steps || []).some(s => (s.kind === 'crop' && s.maxGrow) || s.kind === 'edges'));
    assert.ok(multi.some(f => f.id === 'outpaint'), 'Outpaint is in the set');
    for (const flow of multi) {
        assert.equal(typeof (getPlanner(flow.passes) || getPlanner(flow.operation)), 'function', flow.id);
    }
});

test('getPlanner("seamless") returns a function', async () => {
    const { getPlanner } = await esm('js/utils/flowPasses.js');
    assert.equal(typeof getPlanner('seamless'), 'function');
});

// ── Seamless planner: 1024×1024, left+right 10% → 1 window ─────────────────

test('seamless planner: 1024×1024 left+right 10% → 1 window', async () => {
    const { getPlanner } = await esm('js/utils/flowPasses.js');
    const planner = getPlanner('seamless');

    const handles = { left: 10, right: 10, top: 0, bottom: 0 };
    const expected = expectedWindowCount(1024, 1024, handles);
    assert.equal(expected, 1, 'precondition: math gives 1 window');

    const prepResp = _prepareResponse(1024, 1024, handles);
    const { fetch, calls } = _makeFetch(prepResp);

    const flow = _makeSeamlessFlow();
    const stepValues = { image1: handles };
    // A slot carries a /project-file URL; the server must be handed the DISK path.
    const mediaItems = [{ role: 'image1', filePath: '/project-file?path=C%3A%5Csrc%5Cphoto.png' }];

    const result = await planner(flow, stepValues, mediaItems, { fetch });

    assert.ok(result, 'planner returns a result');
    assert.equal(result.count, 1, 'count = 1 window');
    assert.ok(Array.isArray(result.firstPassMedia), 'firstPassMedia is an array');

    const img1 = result.firstPassMedia.find(m => m.role === 'image1');
    const mask = result.firstPassMedia.find(m => m.role === 'mask');
    assert.ok(img1, 'firstPassMedia has image1 role');
    assert.ok(mask, 'firstPassMedia has mask role');
    assert.equal(img1.filePath, '/project-file?path=win_0_img.png', 'image1 is the cut of window 0');
    // Each window is described from itself (`everyPass`): pass 1 carries no whole picture.
    assert.ok(!result.firstPassMedia.some(m => m.role === 'source'), 'no whole picture on `source`');
    assert.deepEqual(result.runPass, { index: 1, count: 1, seamless: { runId: 'test-run-id', i: 0 } }, 'pass 1 pastes window 0');

    // /seamless/prepare was called with the right handles
    const prepCall = calls.find(c => c.url.includes('/seamless/prepare'));
    assert.ok(prepCall, '/seamless/prepare was called');
    assert.deepEqual(prepCall.body.handles, handles, 'handles forwarded correctly');
    assert.equal(prepCall.body.sourcePath, decodeURIComponent('C%3A%5Csrc%5Cphoto.png'), 'sourcePath decoded to disk');

    // /seamless/window for i=0 was called
    const win0Call = calls.find(c => c.url.includes('/seamless/window') && c.body.i === 0);
    assert.ok(win0Call, '/seamless/window?i=0 was called');
});

// ── Seamless planner: next() stamps passIndex / passCount ───────────────────

test('seamless planner: next() carries runPass i/N, the window and the version to replace', async () => {
    const { getPlanner } = await esm('js/utils/flowPasses.js');
    const planner = getPlanner('seamless');

    // Use 3 windows so we can check the sequence.
    const runId = 'run-3-win';
    const prepResp = {
        ok: true, runId, width: 1024, height: 3072,
        windows: [
            { i: 0, rect: {}, axis: 'x' },
            { i: 1, rect: {}, axis: 'x' },
            { i: 2, rect: {}, axis: 'x' },
        ],
    };
    const { fetch } = _makeFetch(prepResp);
    const flow = _makeSeamlessFlow();
    const stepValues = { image1: { left: 10, right: 10, top: 0, bottom: 0 } };
    const mediaItems = [{ role: 'image1', filePath: '/src/photo.png', url: '/src/photo.png' }];

    const result = await planner(flow, stepValues, mediaItems, { fetch });
    assert.equal(result.count, 3);

    // Call next() twice (after pass 1 and pass 2 complete).
    assert.deepEqual(result.runPass, { index: 1, count: 3, seamless: { runId, i: 0 } });
    // Each later window REPLACES the version the pass before it landed: one card per run.
    const pass2 = await result.next({ item: { id: 'v1' } });
    assert.equal(pass2.last, false, 'not last after pass 1');
    assert.deepEqual(pass2.runPass, { index: 2, count: 3, seamless: { runId, i: 1 }, replaceItemId: 'v1' });

    const pass3 = await result.next({ item: { id: 'v1' } });
    assert.equal(pass3.last, true, 'last = true on final pass');
    assert.deepEqual(pass3.runPass, { index: 3, count: 3, seamless: { runId, i: 2 }, replaceItemId: 'v1' });
    assert.equal(await result.next({ item: { id: 'v1' } }), null, 'no pass after the last');
});

// ── Seamless planner: 16384×8192 left+right 10% → N windows ─────────────────

test('seamless planner: 16384×8192 left+right 10% → N windows (planAxis maths)', async () => {
    const { getPlanner } = await esm('js/utils/flowPasses.js');
    const planner = getPlanner('seamless');

    const handles = { left: 10, right: 10, top: 0, bottom: 0 };
    const expected = expectedWindowCount(16384, 8192, handles);
    assert.ok(expected >= 2, `pano has >= 2 windows (got ${expected})`);

    const prepResp = _prepareResponse(16384, 8192, handles, 'pano-run');
    const { fetch } = _makeFetch(prepResp);

    const flow = _makeSeamlessFlow();
    const stepValues = { image1: handles };
    const mediaItems = [{ role: 'image1', filePath: '/src/pano.png', url: '/src/pano.png' }];

    const result = await planner(flow, stepValues, mediaItems, { fetch });
    assert.ok(result, 'planner returns a result');
    assert.equal(result.count, expected, `count = ${expected} windows`);

    // Walk all next() calls and verify passIndex runs 2..N
    for (let i = 2; i <= expected; i++) {
        const p = await result.next({ item: null });
        assert.ok(p, `pass ${i} payload exists`);
        assert.equal(p.runPass.index, i, `pass ${i}`);
        assert.equal(p.runPass.count, expected);
        assert.equal(p.runPass.seamless.i, i - 1, `window ${i - 1}`);
        assert.equal(p.last, i === expected, `last = ${i === expected} at pass ${i}`);
    }
});

// ── buildCropPassNext: exported and callable ─────────────────────────────────

test('buildCropPassNext is exported from flowPasses.js', async () => {
    const { buildCropPassNext } = await esm('js/utils/flowPasses.js');
    assert.equal(typeof buildCropPassNext, 'function');
});
