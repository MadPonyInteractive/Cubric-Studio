'use strict';

/**
 * cloud-price-tag.test.cjs — MPI-852.
 *
 * The prompt box quotes a paid run BEFORE it happens. The only way that quote can be
 * trusted is if it prices the run that is actually dispatched, so this file holds down
 * the seam rather than the arithmetic — `tests/deepinfra-pricing.test.cjs` already pins
 * the formulas against $0.68 of real billing, and nothing here may make a provider call.
 *
 * Four claims, each of which quoted a WRONG number the obvious way round:
 *
 *   1. The price follows the size that is SENT, not the size the user picked. A request
 *      outside a model's published bounds is fitted on the way out and the fitted size is
 *      what gets billed — pricing the pick over-quotes FLUX 2 dev by four times at 4K.
 *   2. A batch multiplies only where the provider has a native batch. Twelve of the
 *      fifteen cloud models have none, so their control never mounts and a multiply there
 *      would invent a charge.
 *   3. A local model is not priced at all. `null`, never `$0.00` — which reads as free.
 *   4. The tag's column is its OWN grid column. `_renderRunCluster` clears
 *      `#bottom-right-slot` with `innerHTML`, and the bar's track count is declared once.
 */

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const { estimateRunCost, cloudRunFields } = require('../js/services/cloudExecutor.js');
const { estimateCost } = require('../js/data/modelConstants/deepinfraPricing.js');
const { buildSizeFields, batchFieldFor } = require('../js/data/modelConstants/deepinfraSizing.js');
const { MODELS } = require('../js/data/modelConstants/models.js');

const byId = (id) => MODELS.find(m => m.id === id);
const CLOSE = (a, b) => Math.abs(a - b) < 1e-9;

// ── 1. the price follows what is SENT ────────────────────────────────────────────────

test('an out-of-bounds size is priced at the size the provider will actually be given', () => {
    const model = byId('flux2-dev-cloud');
    const picked = { Width: 3840, Height: 2176 };

    // FLUX 2 dev caps at 1920, and `buildSizeFields` scales the PAIR so the shape
    // survives — so this 4K request is dispatched, and billed, as 1920x1088.
    const sent = buildSizeFields(model.cloud.endpointId, cloudRunFields(model, picked, []));
    assert.deepEqual(sent, { width: 1920, height: 1088 });

    const quoted = estimateRunCost(model, picked, []);
    const atSent = estimateCost(model.cloud.endpointId, { width: 1920, height: 1088 });
    const atPick = estimateCost(model.cloud.endpointId, { width: 3840, height: 2176 });

    assert.ok(CLOSE(quoted.usd, atSent.usd), `quoted ${quoted.usd} should be the SENT size's ${atSent.usd}`);
    assert.ok(!CLOSE(quoted.usd, atPick.usd), 'pricing the picked size would over-quote — that is the bug');
    assert.ok(atPick.usd > quoted.usd * 3, 'and it would over-quote by about four times');
});

test('a size inside the bounds is priced exactly as picked', () => {
    const model = byId('flux2-dev-cloud');
    const quoted = estimateRunCost(model, { Width: 1920, Height: 1088 }, []);
    const direct = estimateCost(model.cloud.endpointId, { width: 1920, height: 1088 });
    assert.ok(CLOSE(quoted.usd, direct.usd));
});

test("Seedream's one 'WIDTHxHEIGHT' string is read back into pixels, not dropped", () => {
    const model = byId('seedream-5-pro-cloud');
    const sent = buildSizeFields(model.cloud.endpointId, cloudRunFields(model, { Width: 2048, Height: 2048 }, []));
    assert.equal(sent.size, '2048x2048');
    // Dropping it would fall back to the model's default size and quote the wrong figure.
    const quoted = estimateRunCost(model, { Width: 2048, Height: 2048 }, []);
    assert.ok(CLOSE(quoted.usd, estimateCost(model.cloud.endpointId, { width: 2048, height: 2048 }).usd));
});

test('the measured Nano Banana 2 figure still reproduces, to the cent Fabio was charged', () => {
    // DeepInfra billed $0.067257 for a real 1 MP generation on 2026-09-20; the estimate
    // reads 0.06% HIGH, which is the direction that was asked for.
    const quoted = estimateRunCost(byId('nano-banana-2-cloud'), { Width: 1024, Height: 1024 }, []);
    assert.equal(quoted.display, 'about $0.07');
    assert.ok(quoted.usd > 0.067257 && quoted.usd < 0.0673, `estimate ${quoted.usd} drifted off the measured charge`);
});

test('a reference image is priced, and only the FIRST one is — the route sends one', () => {
    const model = byId('nano-banana-pro-cloud');
    const image = { mediaType: 'image', filePath: 'C:/scratch/ref.png' };
    const none = estimateRunCost(model, { Width: 1024, Height: 1024 }, []);
    const one = estimateRunCost(model, { Width: 1024, Height: 1024 }, [image]);
    const three = estimateRunCost(model, { Width: 1024, Height: 1024 }, [image, image, image]);

    assert.ok(one.usd > none.usd, 'a reference bills input tokens on the Gemini family');
    assert.ok(CLOSE(one.usd, three.usd), 'a second and third reference change no field in the body');
});

test('the duration control is read under the key it actually injects', () => {
    // `Input_Duration` is the control's own node title (PromptBoxControls.js:623) and the
    // only key anything writes a duration under. cloudExecutor read `params.Duration`
    // until MPI-852 — which matched nothing, so every cloud video run was dispatched with
    // no duration and billed at the provider's default length. A video that cannot be
    // priced at all is the symptom this was found by.
    const model = byId('seedance-15-pro-cloud');
    const params = { Input_Duration: 3, Width: 480, Height: 480, Ratio_Label: '1:1' };

    assert.equal(cloudRunFields(model, params, []).duration, 3);
    // Read at all — a dropped duration is omitted from the body entirely, which reaches
    // the provider as "use your own default length" and bills for that instead.
    const sent = buildSizeFields(model.cloud.endpointId, cloudRunFields(model, params, []));
    assert.ok(Number.isFinite(sent.duration), 'the duration must reach the body');
    // Seedance's published floor is 4 s, so a 3 s pick is DISPATCHED as 4 — and the quote
    // has to follow the 4, because that is the clip the user is charged for.
    assert.equal(sent.duration, 4);

    const quoted = estimateRunCost(model, params, []);
    assert.ok(quoted, 'a video with a duration must be priceable');
    assert.ok(CLOSE(quoted.usd, estimateCost(model.cloud.endpointId, { resolution: '480p', duration: 4 }).usd),
        'priced at the clamped 4 s, not the picked 3 s');

    // And the quote follows the slider.
    const longer = estimateRunCost(model, { ...params, Input_Duration: 12 }, []);
    assert.ok(longer.usd > quoted.usd * 2.5, 'three times the clip is about three times the bill');
});

// ── 2. the batch ─────────────────────────────────────────────────────────────────────

test('a batch multiplies on a model with a native batch, clamped to the published max', () => {
    const model = byId('veo-31-cloud');
    const max = batchFieldFor(model.cloud.endpointId).max;
    const one = estimateRunCost(model, { Width: 1280, Height: 720 }, []);
    const full = estimateRunCost(model, { Width: 1280, Height: 720, Input_Batch_Size: max }, []);
    const over = estimateRunCost(model, { Width: 1280, Height: 720, Input_Batch_Size: max + 5 }, []);

    assert.equal(full.batch, max);
    assert.ok(CLOSE(full.usd, one.usd * max));
    assert.equal(over.batch, max, 'a count above the provider maximum is clamped, not quoted');
    assert.ok(CLOSE(over.usd, full.usd));
});

test('a batch does NOT multiply on a model with no native batch', () => {
    // Its control never mounts (`capabilities.batch: false`), so a count can only arrive
    // from a reused prompt — and multiplying it would quote a charge that cannot happen.
    const model = byId('nano-banana-pro-cloud');
    assert.equal(batchFieldFor(model.cloud.endpointId), null);
    const one = estimateRunCost(model, { Width: 1024, Height: 1024 }, []);
    const four = estimateRunCost(model, { Width: 1024, Height: 1024, Input_Batch_Size: 4 }, []);
    assert.equal(four.batch, 1);
    assert.ok(CLOSE(four.usd, one.usd));
});

// ── 3. refusing ──────────────────────────────────────────────────────────────────────

test('a local model is not priced', () => {
    assert.equal(estimateRunCost(byId('krea2'), { Width: 1024, Height: 1024 }, []), null);
    assert.equal(estimateRunCost(null, {}, []), null);
});

test('every cloud model this app ships can be quoted at its commonest run', () => {
    for (const model of MODELS.filter(m => m.provider && m.cloud?.endpointId)) {
        const video = model.mediaType === 'video';
        const quoted = estimateRunCost(model,
            video ? { Width: 1280, Height: 720, Input_Duration: 5 } : { Width: 1024, Height: 1024 }, []);
        assert.ok(quoted, `${model.id} cannot be priced — the tag would show nothing`);
        assert.ok(quoted.display.startsWith('about $'), `${model.id} quoted "${quoted.display}"`);
        // Sub-cent models quote one significant figure ("about $0.0005"); what must never
        // appear is a two-decimal zero, which reads as free.
        assert.notEqual(quoted.display, 'about $0.00', `${model.id} quoted $0.00, which reads as free`);
    }
});

// ── 4. the seam, and the column ──────────────────────────────────────────────────────

const SRC = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

test('the dispatched body is built from cloudRunFields, so the quote cannot drift from the charge', () => {
    const src = SRC('js/services/cloudExecutor.js');
    assert.match(src, /const fields = cloudRunFields\(model, params, payload\.mediaItems\)/,
        'runCloudCommand must derive its body from the same function the price tag reads');
    assert.match(src, /\.\.\.fields,/, 'and spread it into the request body');
});

test('the price tag is built inside the Cue button, where the innerHTML clear cannot eat it', () => {
    const js = SRC('js/components/Organisms/MpiPromptBox/MpiPromptBox.js');
    const css = SRC('js/components/Organisms/MpiPromptBox/MpiPromptBox.css');

    // `_renderRunCluster` does `innerHTML = ''` on the run slot on every queue-count
    // change, so a span injected from outside is wiped. It has to be CREATED in there,
    // and re-filled at the end of the same function or it comes back empty.
    const cluster = js.slice(js.indexOf('function _renderRunCluster()'));
    const body = cluster.slice(0, cluster.indexOf('\n        }\n'));
    assert.match(body, /priceEl\.className = 'mpi-prompt-box__price hide'/,
        'the price span is created inside _renderRunCluster');
    assert.match(body, /runBtn\.el\.appendChild\(priceEl\)/,
        'and appended to the Cue button itself, not to the slot');
    assert.ok(body.lastIndexOf('_refreshPriceTag()') > body.indexOf('runBtn.el.appendChild(priceEl)'),
        'and refilled after the rebuild, or it comes back blank');

    // It is not in a column any more, and the track count has to have come back down
    // with it — a track with no column leaves a dead gap the width of the gap rule.
    assert.ok(!js.includes('price-tag-slot'), 'the price column is gone');
    const cols = js.match(/class="mpi-prompt-box__col [^"]*" id="([a-z-]+)"/g) || [];
    const tracks = css.match(/grid-template-columns:\s*([^;]+);/);
    assert.ok(tracks, 'the bar declares its tracks once');
    assert.equal(tracks[1].trim().split(/\s+/).length, cols.length,
        'a track with no column, or a column with no track, reflows the whole bar');

    // Armed fills the button solid with --accent-heat. The label is rebound to
    // --ink-on-accent there; a price left at --ink-2 would ship unreadable.
    assert.match(css, /--run \.mpi-prompt-box__cue-btn--armed \.mpi-prompt-box__price \{\s*color: var\(--ink-on-accent\)/,
        'the armed state rebinds the price, not just the label');
});

test('the tag is recomputed where every control is rebuilt, and where media changes', () => {
    const js = SRC('js/components/Organisms/MpiPromptBox/MpiPromptBox.js');
    // _refreshOpSlot destroys and rebuilds every control, so Width and Height can move
    // with no event at all; an event-only price goes stale on every op switch.
    const opSlot = js.slice(js.indexOf('function _refreshOpSlot()'));
    assert.match(opSlot.slice(0, opSlot.indexOf('\n        }\n')), /_refreshPriceTag\(\)/);

    const media = js.slice(js.indexOf('function _emitMediaChange()'));
    assert.match(media.slice(0, media.indexOf("emit('media-change'")), /_refreshPriceTag\(\)/);

    // Every control persists through PromptBoxControls._emitUpdate, which emits exactly
    // one of these two.
    assert.match(js, /Events\.on\('settings:shared:update', \(\) => _refreshPriceTag\(\)\)/);
    assert.match(js, /Events\.on\('settings:model:update', \(\) => _refreshPriceTag\(\)\)/);
});
