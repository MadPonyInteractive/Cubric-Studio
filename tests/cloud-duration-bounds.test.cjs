'use strict';

/**
 * cloud-duration-bounds.test.cjs — MPI-879.
 *
 * The duration slider offered 1..30 seconds to every video model. `buildSizeFields`
 * clamps the dispatched value into the provider's published range, so the request was
 * never rejected and never over-billed against the pick — which is exactly why this
 * failed silently: a user dragging Seedance 1.5 Pro to 30 got a 12-second clip, was
 * billed for 12, and nothing on screen said so. Since MPI-852 the price tag quotes the
 * clamped length, so the number and the slider visibly disagreed.
 *
 * Three claims:
 *   1. A cloud model's bounds are the provider's own, for every shipped cloud video
 *      model — the four ranges differ and none of them is 1..30 by accident.
 *   2. A model with no published range keeps the app's 1..30. That is local models, and
 *      Veo 3.1, which has no `duration` field at all.
 *   3. The bounds reach the mounted slider and the injected value, not just the helper.
 */

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const CONTROLS = () => import('../js/components/Organisms/MpiPromptBox/PromptBoxControls.js');
const SIZING = () => import('../js/data/modelConstants/deepinfraSizing.js');
const MODELS = () => import('../js/data/modelConstants/models.js').then(m => m.MODELS);

const byId = async (id) => {
    const model = (await MODELS()).find(m => m.id === id);
    assert.ok(model, `fixture guard: ${id} is still a shipped model`);
    return model;
};

// ── 1. a cloud model gets the provider's range ───────────────────────────────────────

test("Seedance 1.5 Pro's slider stops at the 12 seconds it publishes, not at 30", async () => {
    const { durationBoundsFor } = await CONTROLS();
    // The anchor the bug was measured on. Hardcoded on purpose: asserting only
    // "equals durationRangeFor" would still pass if both collapsed to the default.
    assert.deepEqual(durationBoundsFor(await byId('seedance-15-pro-cloud')), { min: 4, max: 12 });
});

test('every shipped cloud video model is bounded by its own published range', async () => {
    const { durationBoundsFor } = await CONTROLS();
    const { durationRangeFor } = await SIZING();

    const cloudVideo = (await MODELS()).filter(m => m.provider && m.cloud?.endpointId && m.mediaType === 'video');
    assert.ok(cloudVideo.length >= 3, 'fixture guard: the cloud video models are still shipped');

    let bounded = 0;
    for (const model of cloudVideo) {
        const published = durationRangeFor(model.cloud.endpointId);
        if (!published) continue;                       // Veo — covered below
        assert.deepEqual(durationBoundsFor(model), published, `${model.id} is not bounded by its own range`);
        bounded++;
    }
    assert.ok(bounded >= 3, `expected at least three bounded models, got ${bounded}`);
});

// ── 2. no published range means the app's own ────────────────────────────────────────

test('a local video model keeps the app range', async () => {
    const { durationBoundsFor } = await CONTROLS();
    const local = (await MODELS()).find(m => m.mediaType === 'video' && !m.provider);
    assert.ok(local, 'fixture guard: a local video model still ships');
    assert.deepEqual(durationBoundsFor(local), { min: 1, max: 30 });
    // And no model at all — the control mounts before a pick in the demo/legacy path.
    assert.deepEqual(durationBoundsFor(undefined), { min: 1, max: 30 });
});

test('Veo 3.1 publishes no duration field, so it is fixed at the 8 s it returns', async () => {
    const { durationBoundsFor } = await CONTROLS();
    const { durationRangeFor } = await SIZING();
    for (const id of ['veo-31-cloud', 'veo-31-fast-cloud']) {
        const veo = await byId(id);
        assert.equal(durationRangeFor(veo.cloud.endpointId), null, `fixture guard: ${id} still has no duration field`);
        // MPI-880. Not a narrowed slider — a collapsed range, which is what makes the
        // control render as a line. The 8 is CLIP_SECONDS, the number the run is priced on.
        assert.deepEqual(durationBoundsFor(veo), { min: 8, max: 8 }, id);
    }
});

test('a fixed-length model injects its own length whatever was saved against another', async () => {
    const { PROMPT_BOX_CONTROLS, durationBoundsFor } = await CONTROLS();
    const ctrl = PROMPT_BOX_CONTROLS.duration;
    const bounds = durationBoundsFor(await byId('veo-31-cloud'));
    // The bucket is `shared`: a 3 set on Wan is the value the entry is holding when Veo
    // is picked, and 3 is the shipped default — the live under-quote the card measured.
    assert.deepEqual(ctrl.getInjectionParams.call({ ...ctrl, value: 3, _bounds: bounds }), { Input_Duration: 8 });
    assert.deepEqual(ctrl.getInjectionParams.call({ ...ctrl, value: 30, _bounds: bounds }), { Input_Duration: 8 });
});

// ── 3. the bounds reach the slider and the injection ─────────────────────────────────

test('an out-of-range value is clamped into the picked model\'s range on the way out', async () => {
    const { PROMPT_BOX_CONTROLS, durationBoundsFor } = await CONTROLS();
    const ctrl = PROMPT_BOX_CONTROLS.duration;
    const bounds = durationBoundsFor(await byId('seedance-15-pro-cloud'));

    // A 30 persisted against another model — the bucket is `shared`, so one number is
    // carried across every video model.
    assert.deepEqual(ctrl.getInjectionParams.call({ ...ctrl, value: 30, _bounds: bounds }), { Input_Duration: 12 });
    assert.deepEqual(ctrl.getInjectionParams.call({ ...ctrl, value: 2, _bounds: bounds }), { Input_Duration: 4 });
    assert.deepEqual(ctrl.getInjectionParams.call({ ...ctrl, value: 8, _bounds: bounds }), { Input_Duration: 8 });
    // Spread without `_bounds` — the shape control-snapshot-injection.test.cjs uses.
    assert.deepEqual(ctrl.getInjectionParams.call({ ...ctrl, value: 30 }), { Input_Duration: 30 });
});

test('the mounted slider takes its min and max from the bounds, not from constants', () => {
    // The mount needs a DOM, so this holds the seam by source: a helper that nothing
    // wires into MpiProgressBar would pass every assertion above and ship the bug.
    const src = fs.readFileSync(
        path.join(__dirname, '..', 'js/components/Organisms/MpiPromptBox/PromptBoxControls.js'), 'utf8');
    const entry = src.slice(src.indexOf('    duration: {'), src.indexOf('    motionIntensity: {'));
    assert.ok(entry.length > 0, 'fixture guard: the duration control entry still parses out');
    assert.ok(/min: bounds\.min/.test(entry) && /max: bounds\.max/.test(entry),
        'the duration slider must mount with the model bounds');
    assert.ok(!/Math\.min\(30,/.test(entry), 'a hardcoded 30 is left in the duration control');
    // MPI-880 — the 8 is CLIP_SECONDS', never retyped here.
    assert.ok(!/\b8\b/.test(entry), 'a literal 8 is left in the duration control');
});

// ── 4. a fixed-length model gets a line, not a slider (MPI-880) ──────────────────────

/**
 * Enough DOM for the mount and no more. The point is which ELEMENTS get created: a
 * slider host would appear as a second child under `.mpi-prompt-box__slider-track`, and
 * MpiProgressBar would paint `width: NaN%` into it at min === max.
 */
function fakeDocument() {
    const make = (tag) => ({
        tagName: tag, className: '', textContent: '', style: {}, children: [],
        appendChild(kid) { this.children.push(kid); return kid; },
    });
    return { createElement: make, host: make('div') };
}

test('Veo mounts a static line — no slider, and it reads the length the run is billed at', async () => {
    const { PROMPT_BOX_CONTROLS } = await CONTROLS();
    const doc = fakeDocument();
    const prior = global.document;
    global.document = doc;
    try {
        // value 3 in the shared bucket — the shipped default, and the live under-quote.
        PROMPT_BOX_CONTROLS.duration.mount(doc.host, { model: await byId('veo-31-cloud'), value: 3 });
    } finally {
        if (prior === undefined) delete global.document; else global.document = prior;
    }

    const classes = doc.host.children.map(c => c.className);
    assert.deepEqual(classes, ['mpi-prompt-box__slider-lbl'], 'the label row must be the only child — no slider track');
    const [name, value] = doc.host.children[0].children.map(c => c.textContent);
    assert.equal(name, 'Duration');
    assert.equal(value, '8 s');
});
