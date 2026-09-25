'use strict';

/**
 * deepinfra-pricing.test.cjs — MPI-850.
 *
 * Every positive figure below is a REAL BILL. They were decomposed from
 * `inference_status.cost` on calls that cost $0.68 in total on 2026-09-20 and are written
 * up in `docs/proprietary-models-research/01d-deepinfra-image-video.md` § 2b/2c/3. Nothing
 * here is a model of what DeepInfra might charge — it is what DeepInfra charged. Re-running
 * the calls to "check" costs money and would prove nothing these assertions do not.
 *
 * The NEGATIVE controls matter more than the positives. Three surfaces are about to quote
 * this module's output at a user who then spends their own money, so a shape the module
 * cannot price must come back `null`. A confidently wrong price is the failure that costs
 * somebody real cash; a missing one costs a line of UI copy.
 *
 * Tolerances are deliberate, not slack: the Gemini models bill a variable number of TEXT
 * tokens per call and the prompt's own input tokens are unmodelled, so a pre-dispatch
 * estimate is good to about 2%. Where the arithmetic is exact (Seedance's token count) the
 * assertion is exact.
 */

const assert = require('node:assert/strict');
const test = require('node:test');

const {
    estimateCost, priceFromEntry, formatPrice, videoFrames, videoTokens,
    VIDEO_PIXELS, PRICES_CHECKED_ON,
} = require('../js/data/modelConstants/deepinfraPricing.js');
const SNAPSHOT = require('../dev_configs/deepinfra-prices.json');

/** Measured bills carry rounding; assert the cent, not the float. */
function near(actual, expected, tolerance, what) {
    assert.ok(Number.isFinite(actual), `${what}: expected a number, got ${actual}`);
    assert.ok(Math.abs(actual - expected) <= tolerance,
        `${what}: ${actual} is not within ${tolerance} of the measured ${expected}`);
}

const SCHNELL = 'black-forest-labs/FLUX-1-schnell';
const PRO = 'google/nano-banana-pro';

// ── the open-image formula: linear in area, linear in steps (01d § 2b) ────────────────────

test('FLUX-1-schnell at 1024x1024, 1 step, bills $0.0005', () => {
    near(estimateCost(SCHNELL, { width: 1024, height: 1024, steps: 1 }).usd, 0.0005, 1e-6, '1 MP 1 step');
});

test('halving the area halves the price', () => {
    near(estimateCost(SCHNELL, { width: 1024, height: 512, steps: 1 }).usd, 0.00025, 1e-6, '0.5 MP');
});

test('3.5 MP at one step bills $0.0017575 — flat per megapixel, no tiering', () => {
    near(estimateCost(SCHNELL, { width: 1920, height: 1920, steps: 1 }).usd, 0.0017575, 1e-5, '1920x1920');
});

test('four steps cost four times one step', () => {
    near(estimateCost(SCHNELL, { width: 1024, height: 1024, steps: 4 }).usd, 0.002, 1e-6, '4 steps');
});

test('no dimensions given falls back to the model default, not to zero', () => {
    near(estimateCost(SCHNELL).usd, 0.0005, 1e-6, 'defaults');
});

test('a closed model is flat per image — resolution is irrelevant', () => {
    const small = estimateCost('ByteDance/Seedream-4', { width: 1024, height: 1024 });
    const large = estimateCost('ByteDance/Seedream-4', { width: 2048, height: 2048 });
    assert.equal(small.usd, large.usd);
});

// MPI-919: real `inference_status.cost`, 2026-09-25. BFL bills per started 2^20-px megapixel
// of the output and of every reference (each shrunk to 1 MP by the route).
test('FLUX-2 pro/max price per started megapixel, references included', () => {
    const pro = 'black-forest-labs/FLUX-2-pro';
    const max = 'black-forest-labs/FLUX-2-max';
    near(estimateCost(pro, { width: 1024, height: 1024 }).usd, 0.03, 1e-9, 'pro 1 MP t2i');
    near(estimateCost(pro, { width: 1280, height: 1024 }).usd, 0.045, 1e-9, 'pro 1.25 MP t2i');
    near(estimateCost(pro, { width: 1024, height: 1024, references: 1 }).usd, 0.045, 1e-9, 'pro edit');
    near(estimateCost(pro, { width: 1024, height: 1024, references: 2 }).usd, 0.06, 1e-9, 'pro two refs');
    near(estimateCost(max, { width: 1024, height: 1024 }).usd, 0.07, 1e-9, 'max 1 MP t2i');
    near(estimateCost(max, { width: 1024, height: 1024, references: 1 }).usd, 0.10, 1e-9, 'max edit');
});

test('FLUX-2 dev is priced at the 50 steps it runs, not the 28 its price assumes', () => {
    near(estimateCost('black-forest-labs/FLUX-2-dev', { width: 1024, height: 1024 }).usd, 0.01785, 1e-5, 'dev 1 MP');
});

test('Seedream 5.0 Pro bills for every input image after the first', () => {
    const one = estimateCost('ByteDance/Seedream-5.0-Pro', { references: 1 }).usd;
    const three = estimateCost('ByteDance/Seedream-5.0-Pro', { references: 3 }).usd;
    near(one, 0.099, 1e-6, 'one reference');
    near(three - one, 0.0066, 1e-9, 'two extra references');
});

// ── the Gemini family, decomposed to the cent (01d § 3) ───────────────────────────────────

test('one 1K edit with one reference bills the measured figure on all three tiers', () => {
    const edit = (id) => estimateCost(id, { resolution: '1k', references: 1 }).usd;
    near(edit('google/nano-banana-2-lite'), 0.0339, 1e-4, 'lite');
    near(edit('google/nano-banana-2'), 0.0679, 1e-4, 'nano-banana-2');
    near(edit(PRO), 0.1376, 1e-4, 'pro');
});

test('gemini-3-pro-image is nano-banana-pro under a second id, and prices identically', () => {
    const opts = { resolution: '1k', references: 1 };
    assert.equal(estimateCost('google/gemini-3-pro-image', opts).usd, estimateCost(PRO, opts).usd);
});

test('a reference image costs well under a cent, flat, but it is still counted', () => {
    const bare = estimateCost(PRO, { resolution: '1k' }).usd;
    const one = estimateCost(PRO, { resolution: '1k', references: 1 }).usd;
    near(one - bare, 0.00112, 1e-9, 'one reference on Pro');
    assert.ok(one > bare, 'a reference must move the estimate');
});

test('Pro at 4K bills the bigger token bucket', () => {
    near(estimateCost(PRO, { resolution: '4k' }).usd, 0.24, 0.005, '4K bucket');
});

test('a batch multiplies — four Pro images are about $0.54, not $0.13', () => {
    const one = estimateCost(PRO, { resolution: '1k' });
    const four = estimateCost(PRO, { resolution: '1k', batch: 4 });
    assert.equal(four.batch, 4);
    assert.equal(four.usd, one.usd * 4);
    near(four.usd, 0.54, 0.02, 'batch of four');
});

// ── video: frames, not seconds (01d § 2c) ────────────────────────────────────────────────

test('frames = 24 x duration + 1 — the +1 is worth 1%', () => {
    assert.equal(videoFrames(4), 97);
    assert.equal(videoFrames(5), 121);
});

test('a 480p 4 s clip is exactly 40,594 tokens', () => {
    const { width, height } = VIDEO_PIXELS['480p'];
    assert.equal(width, 864, '480p 16:9 is really 864x496, never the label');
    assert.equal(videoTokens(width, height, videoFrames(4)), 40594);
});

test('Seedance 1.5 Pro, 480p, 4 s bills $0.0487', () => {
    near(estimateCost('ByteDance/Seedance-1.5-Pro', { resolution: '480p', duration: 4 }).usd,
        0.0487, 1e-4, 'Seedance 1.5');
});

test('Seedance 2.0 quotes the DEARER band a plain call actually pays', () => {
    near(estimateCost('ByteDance/Seedance-2.0', { resolution: '480p', duration: 4 }).usd,
        0.3126, 1e-4, 'Seedance 2.0 plain');
    // The feed's structured rate is the cheap "with reference video" band ($4.70/M). If a
    // future snapshot is ever read instead of the measured constant, this catches it.
    assert.equal(SNAPSHOT.models['ByteDance/Seedance-2.0'].pricing.cents_per_input_token, 0.00047);
});

test('Wan 3.0 at 1080p for 5 s bills $1.00, and the cheaper tiers are cheaper', () => {
    const wan = (resolution) => estimateCost('Wan-AI/Wan3.0-Video', { resolution, duration: 5 }).usd;
    near(wan('1080p'), 1.00, 1e-9, 'Wan 1080p');
    near(wan('720p'), 0.50, 1e-9, 'Wan 720p');
    near(wan('480p'), 0.25, 1e-9, 'Wan 480p');
});

test('Veo carries no duration field, so its fixed clip length prices it', () => {
    near(estimateCost('google/veo-3.1').usd, 3.20, 1e-9, 'Veo 3.1');
    near(estimateCost('google/veo-3.1-fast').usd, 1.20, 1e-9, 'Veo 3.1 Fast');
});

test('a supplied duration cannot move a fixed-length price (MPI-880)', () => {
    // The provider returns 8 s whatever is sent, so a duration reaching here is a number
    // no run will ever bill. It quoted $1.20 against a $3.20 charge at the duration
    // control's default of 3, and $12.00 against the same $3.20 at 30.
    for (const duration of [3, 30, 0.5]) {
        near(estimateCost('google/veo-3.1', { duration }).usd, 3.20, 1e-9, `Veo 3.1 at ${duration}`);
        near(estimateCost('google/veo-3.1-fast', { duration }).usd, 1.20, 1e-9, `Veo 3.1 Fast at ${duration}`);
    }
    // And a model whose length IS the caller's still honours it.
    near(estimateCost('Wan-AI/Wan3.0-Video', { resolution: '1080p', duration: 5 }).usd, 1.00, 1e-9, 'Wan still reads duration');
});

// ── negative controls: refuse, never guess ───────────────────────────────────────────────

test('an unknown model id refuses', () => {
    assert.equal(estimateCost('acme/not-a-model'), null);
    assert.equal(estimateCost(''), null);
    assert.equal(estimateCost(undefined), null);
});

test('a time-priced model refuses — GPU seconds are not knowable before the run', () => {
    const entry = { type: 'text-to-image', pricing: { type: 'time', cents_per_sec: 0.05 } };
    assert.equal(priceFromEntry('stability-ai/sdxl-legacy', entry, { width: 1024, height: 1024 }), null);
});

test('a pricing shape we do not ship refuses rather than falling through to a default', () => {
    assert.equal(priceFromEntry('x/frames', { type: 'text-to-video', pricing: { type: 'frame_units' } }, {}), null);
    assert.equal(priceFromEntry('x/none', { type: 'text-to-image' }, {}), null);
});

test('a token-priced image model with no measured token count refuses', () => {
    const entry = { type: 'text-to-image', pricing: { type: 'input_tokens', cents_per_input_token: 0.01 } };
    assert.equal(priceFromEntry('google/some-new-gemini', entry, { resolution: '1k' }), null);
});

test('a per-second video model with no duration anywhere refuses', () => {
    const entry = { type: 'text-to-video', pricing: { type: 'output_length', cents_per_output_sec: 20 } };
    assert.equal(priceFromEntry('acme/clipper', entry, { resolution: '1080p' }), null);
});

// ── the copy: never a four-decimal quote, never "$0.00" ──────────────────────────────────

test('sub-cent generations quote a real figure instead of rendering $0.00', () => {
    // MPI-853: the Model Library shows this string on a tile, where "under $0.01" tells a
    // user nothing about whether a batch of four is affordable. One significant figure.
    assert.equal(formatPrice(0.0005), 'about $0.0005');
    assert.equal(formatPrice(0.0017578), 'about $0.002');
    assert.equal(estimateCost(SCHNELL, { width: 1024, height: 1024, steps: 1 }).display, 'about $0.0005');
});

test('no sub-cent quote belongs to a model whose price is uncertain', () => {
    // The four-decimal ban exists because the Gemini family emits a variable number of
    // text tokens, worth about 2%. This asserts the two rules cannot collide: every such
    // model is dearer than a cent, so it always takes the two-decimal "about $X.XX" path.
    for (const id of ['google/nano-banana-2-lite', 'google/nano-banana-2', 'google/nano-banana-pro']) {
        const quote = estimateCost(id, { resolution: '1k', references: 1 });
        assert.ok(quote.usd >= 0.01, `${id} is sub-cent — the copy rules now overlap`);
        assert.match(quote.display, /^about \$\d+\.\d{2}$/);
    }
});

test('a price is always approximate — the models emit variable text tokens', () => {
    assert.equal(formatPrice(0.137632), 'about $0.14');
    assert.equal(formatPrice(3.2), 'about $3.20');
});

test('nothing free ever renders', () => {
    assert.equal(formatPrice(0), null);
    assert.equal(formatPrice(-1), null);
    assert.equal(formatPrice(NaN), null);
});

// ── the snapshot itself ──────────────────────────────────────────────────────────────────

test('the snapshot carries a checked-on date — a stale price is worse than none', () => {
    assert.match(PRICES_CHECKED_ON, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(SNAPSHOT.schema, 'cubric/deepinfra-prices/v1');
});

test('every model MPI-849 ships can be priced', () => {
    const video = { resolution: '1080p', duration: 5 };
    for (const [id, entry] of Object.entries(SNAPSHOT.models)) {
        const opts = entry.type === 'text-to-video' ? video : { resolution: '1k', references: 1 };
        const quote = estimateCost(id, opts);
        assert.ok(quote && quote.usd > 0, `${id} priced ${JSON.stringify(quote)}`);
        assert.ok(quote.display, `${id} has no display copy`);
    }
});

test('the hand-held Gemini rates still agree with the feed they were decomposed from', () => {
    // Our constants carry the token COUNTS and the unpublished input/text rates; the output
    // image rate is DeepInfra's own structured field. If they drift apart, the snapshot moved
    // and the constants next to it did not.
    const expected = { 'google/nano-banana-2-lite': 30, 'google/nano-banana-2': 60, 'google/nano-banana-pro': 120, 'google/gemini-3-pro-image': 120 };
    for (const [id, ratePerM] of Object.entries(expected)) {
        assert.equal(SNAPSHOT.models[id].pricing.cents_per_input_token * 1e4, ratePerM, `${id} output rate`);
    }
});
