'use strict';

/**
 * deepinfra-catalogue.test.cjs — MPI-853, the cloud models (fourteen, after MPI-864
 * dropped the Gemini 3 Pro Image tile as a duplicate of Nano Banana Pro).
 *
 * `deepinfra-pricing.test.cjs` next door asserts what a generation COSTS. This asserts
 * what the app is allowed to ASK FOR, which is the other half of the same promise: a size
 * outside the provider's contract is not an error the user sees, it is a bill for a
 * picture the wrong shape, or a ratio silently replaced by the provider's default.
 *
 * The one idea worth holding: nothing about a model's sizing is written down by hand. The
 * field names, the enums and the bounds all come from `limits` in
 * `dev_configs/deepinfra-prices.json`, copied from each model's own `in_fields` by
 * scripts/sync-deepinfra-prices.mjs. So these tests are not re-stating a table — they
 * check that the SHIPPED ratio tables fit the contract the provider published, and that
 * the four different body shapes are each built correctly.
 *
 * Two bounds exist only in a field's prose (Seedream's pixel box, each clip model's
 * duration range) and are parsed from it. The parses are asserted here so a reworded
 * description upstream fails a test instead of quietly removing a clamp.
 */

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const { MODELS } = require('../js/data/modelConstants/models.js');
const {
    buildSizeFields, sizingModeFor, batchFieldFor, durationRangeFor, pixelBoxFor, limitsFor,
} = require('../js/data/modelConstants/deepinfraSizing.js');
const { estimateCost } = require('../js/data/modelConstants/deepinfraPricing.js');
const { getModelRatios, qualityTiersFor, usesQualityTier, usesOrientation, RATIO_ICONS } =
    require('../js/utils/ratios.js');

const CLOUD = MODELS.filter(m => m.provider === 'deepinfra');

/** DeepInfra's second id for Nano Banana Pro. Priced, but deliberately off the grid. */
const GEMINI_TWIN = 'google/gemini-3-pro-image';

/** Every row of every ratio table a cloud model can reach, with its tier. */
function everyRatioRow(model) {
    const rows = [];
    const tiers = usesQualityTier(model.type) ? qualityTiersFor(model.type) : [undefined];
    const orientations = usesOrientation(model.type) ? ['portrait', 'landscape'] : [undefined];
    for (const tier of tiers) {
        for (const orientation of orientations) {
            for (const row of getModelRatios(model.type, orientation, tier)) {
                rows.push({ ...row, tier });
            }
        }
    }
    return rows;
}

// ── The catalogue is complete and priced ─────────────────────────────────────

test('ships Fabio\'s fourteen models plus the schnell test model', () => {
    assert.equal(CLOUD.length, 15, 'the fourteen catalogue models plus flux-schnell-cloud');
    assert.ok(CLOUD.some(m => m.id === 'flux-schnell-cloud'));
    // Ids are unique, and so are the endpoints they point at.
    assert.equal(new Set(CLOUD.map(m => m.id)).size, CLOUD.length);
    assert.equal(new Set(CLOUD.map(m => m.cloud.endpointId)).size, CLOUD.length);
});

// MPI-864 — every cloud tile showed a placeholder, because no cloud ModelDef carried the
// `image`/`video` a local one does. The tile reads ONE of them by mediaType and has no
// fallback (`MpiModelManager.js` `_tileItem`), so a still on a video model is as blank as
// nothing at all. This fails if a new cloud model arrives without its art, which is exactly
// how the fifteen placeholders happened.
test('every cloud model ships the preview art its tile reads', () => {
    const display = path.join(__dirname, '..', 'comfy_workflows', 'display');
    for (const model of CLOUD) {
        const key = model.mediaType === 'video' ? 'video' : 'image';
        const file = model[key];
        assert.ok(file, `${model.id} (${model.mediaType}) has no \`${key}\` — its tile renders a placeholder`);
        assert.ok(fs.existsSync(path.join(display, file)),
            `${model.id}: comfy_workflows/display/${file} is missing`);

        // A video tile posters itself by filename convention, foo.mp4 -> foo.webp
        // (`MpiTileSheet.js`). A missing poster is a SILENT no-op: the tile paints nothing
        // until the clip's moov atom arrives. Every local video model ships one.
        if (key === 'video') {
            const poster = file.replace(/\.[^.]+$/, '.webp');
            assert.ok(fs.existsSync(path.join(display, poster)),
                `${model.id}: ${poster} is missing, so its tile has no poster frame`);
        }
    }
});

test('every cloud model is in the price snapshot and can quote a price', () => {
    for (const model of CLOUD) {
        const id = model.cloud.endpointId;
        assert.ok(limitsFor(id), `${model.id}: ${id} has no limits in the snapshot`);
        // A video model priced per second needs a length before it can answer; an image
        // model must answer from nothing. Neither may come back unpriced.
        const quote = model.mediaType === 'video'
            ? (estimateCost(id) || estimateCost(id, { duration: 5, resolution: '1080p', width: 1920, height: 1080 }))
            : estimateCost(id);
        assert.ok(quote?.display, `${model.id}: no price copy — a paid tile would read "price unknown"`);
    }
});

test('a cloud ModelDef declares no install machinery', () => {
    // An empty `dependencies: []` reads as INSTALLED by accident in two places, so the
    // contract is ABSENT, not empty. `workflows: {}` is the one exception: it is required
    // by the ModelDef shape and an empty graph map is what "ships no graph" looks like.
    for (const model of CLOUD) {
        for (const field of ['dependencies', 'commonDeps', 'operations', 'engines', 'variants']) {
            assert.equal(model[field], undefined, `${model.id} declares ${field}`);
        }
        assert.deepEqual(model.workflows, {}, `${model.id} ships a workflow`);
    }
});

// ── The shipped ratio tables fit the published contract ──────────────────────

test('every ratio row survives its own model\'s sizing contract unchanged', () => {
    for (const model of CLOUD) {
        const id = model.cloud.endpointId;
        const mode = sizingModeFor(id);
        assert.ok(mode, `${model.id}: no sizing mode could be derived`);
        if (mode !== 'wh' && mode !== 'size') continue; // the other two send no pixels

        for (const row of everyRatioRow(model)) {
            const built = buildSizeFields(id, { width: row.w, height: row.h, ratioLabel: row.label });
            const got = mode === 'wh' ? `${built.width}x${built.height}` : built.size;
            assert.equal(got, `${row.w}x${row.h}`,
                `${model.id} ${row.tier || ''} ${row.label}: the table asks ${row.w}x${row.h} but the model ` +
                `only accepts ${got} — the user would be billed for a different shape`);
        }
    }
});

test('every ratio label a cloud model offers has an icon to draw it', () => {
    // A label with no rect_ icon renders an empty button. 2:3 and 3:2 are the reason this
    // test exists: Nano Banana publishes both and neither has an icon, so neither ships.
    for (const model of CLOUD) {
        for (const row of everyRatioRow(model)) {
            assert.ok(RATIO_ICONS[row.icon], `${model.id} ${row.label}: no icon ${row.icon}`);
        }
    }
});

test('a cloud model\'s quality tiers are ones the provider actually offers', () => {
    for (const model of CLOUD) {
        const allowed = limitsFor(model.cloud.endpointId)?.resolution?.allowed;
        if (!allowed) continue; // only the video models name their tiers upstream
        const lower = allowed.map(a => String(a).toLowerCase());
        for (const tier of qualityTiersFor(model.type)) {
            assert.ok(lower.includes(tier.toLowerCase()),
                `${model.id}: tier '${tier}' is not one of ${allowed.join(', ')}`);
        }
    }
});

test('portrait and landscape tables stay index-mirrors', () => {
    // The ratio flip maps by INDEX, so a mismatch returns a different aspect rather than
    // the transpose — the failure FLUX_RATIOS' own note records.
    for (const model of CLOUD) {
        if (!model.ratios?.portrait) continue;
        assert.equal(model.ratios.portrait.length, model.ratios.landscape.length,
            `${model.id}: orientation lists differ in length`);
    }
});

// ── The four body shapes ─────────────────────────────────────────────────────

test('wh — FLUX sends real pixels, and its own batch field', () => {
    assert.equal(sizingModeFor('black-forest-labs/FLUX-1-schnell'), 'wh');
    assert.deepEqual(
        buildSizeFields('black-forest-labs/FLUX-1-schnell', { width: 896, height: 1088, batch: 4 }),
        { width: 896, height: 1088, num_images: 4 });
    // A batch of one is omitted entirely, so the body stays the provider's default shape.
    assert.equal('num_images' in buildSizeFields('black-forest-labs/FLUX-1-schnell',
        { width: 1024, height: 1024, batch: 1 }), false);
});

test('wh — an out-of-range pair is scaled, not squashed', () => {
    // FLUX 2 Pro stops at 1440 where its Dev sibling reaches 1920. A pair from another
    // model (a reused prompt) must arrive the shape the user picked, at a legal size.
    const built = buildSizeFields('black-forest-labs/FLUX-2-pro', { width: 1920, height: 1088 });
    assert.ok(built.width <= 1440 && built.height <= 1440, 'not clamped into the box');
    assert.ok(Math.abs((built.width / built.height) - (1920 / 1088)) < 0.05,
        `aspect drifted: ${built.width}x${built.height} is not 16:9-ish`);
});

test('size — Seedream sends one WIDTHxHEIGHT string and no pixel fields', () => {
    assert.equal(sizingModeFor('ByteDance/Seedream-4'), 'size');
    const built = buildSizeFields('ByteDance/Seedream-4', { width: 1664, height: 2048 });
    assert.deepEqual(built, { size: '1664x2048' });
    // Its box is prose-only. A size under the floor is raised to it rather than refused.
    assert.deepEqual(buildSizeFields('ByteDance/Seedream-4', { width: 100, height: 60 }),
        { size: '1280x720' });
});

test('aspect — Nano Banana sends a label and NEVER a dimension', () => {
    assert.equal(sizingModeFor('google/nano-banana-pro'), 'aspect');
    const built = buildSizeFields('google/nano-banana-pro', { width: 896, height: 1088, ratioLabel: '4:5' });
    assert.deepEqual(built, { aspect_ratio: '4:5' });
    // With no label, the nearest allowed shape — a width/height it cannot use must not
    // simply vanish.
    assert.equal(buildSizeFields('google/nano-banana-2', { width: 1920, height: 816 }).aspect_ratio, '21:9');
});

test('video — each model gets its own field names and its own spelling', () => {
    const seedance = buildSizeFields('ByteDance/Seedance-1.5-Pro',
        { width: 1920, height: 1080, qualityTier: '1080p', duration: 5 });
    assert.deepEqual(seedance, { aspect_ratio: '16:9', resolution: '1080p', duration: 5 });

    // Wan is the odd one out on BOTH axes: the field is `ratio`, the tier is uppercase.
    const wan = buildSizeFields('Wan-AI/Wan3.0-Video',
        { width: 1920, height: 1080, qualityTier: '1080p', duration: 5 });
    assert.deepEqual(wan, { ratio: '16:9', resolution: '1080P', duration: 5 });

    // Veo has no duration field at all — fixed-length clips — and its batch is
    // `sample_count`. Sending a duration it cannot hear would be silently ignored.
    const veo = buildSizeFields('google/veo-3.1',
        { width: 1920, height: 1080, qualityTier: '1080p', duration: 8, batch: 4 });
    assert.deepEqual(veo, { aspect_ratio: '16:9', resolution: '1080p', sample_count: 4 });
});

test('video — an over-long clip is clamped to the published range', () => {
    // Wan's own prose says 2-30 seconds; Seedance 1.5 says 4-12.
    assert.equal(buildSizeFields('Wan-AI/Wan3.0-Video', { qualityTier: '1080p', duration: 99 }).duration, 30);
    assert.equal(buildSizeFields('ByteDance/Seedance-1.5-Pro', { qualityTier: '720p', duration: 99 }).duration, 12);
});

test('video — an unknown tier costs LESS, never more', () => {
    // A cross-model reuse can carry a tier this model does not have. Falling through to
    // the provider's own default would pick Wan's dearest band and spend the user's money
    // on a resolution they did not ask for.
    assert.equal(buildSizeFields('Wan-AI/Wan3.0-Video', { qualityTier: 'very_high' }).resolution, '480P');
});

test('a ratio search never returns "adaptive"', () => {
    // Seedance and Wan both publish it. It is a policy, not a shape, and choosing it
    // would hand the frame size to the model.
    for (const id of ['ByteDance/Seedance-1.5-Pro', 'ByteDance/Seedance-2.0', 'Wan-AI/Wan3.0-Video']) {
        const built = buildSizeFields(id, { width: 1000, height: 1000, qualityTier: '720p' });
        const label = built.aspect_ratio ?? built.ratio;
        assert.notEqual(label, 'adaptive', `${id} chose adaptive`);
    }
});

// ── Batch is the provider's, not ours ────────────────────────────────────────

test('only the two models with a native batch can batch', () => {
    const batched = CLOUD.filter(m => batchFieldFor(m.cloud.endpointId));
    assert.deepEqual(batched.map(m => m.id).sort(),
        ['flux-schnell-cloud', 'veo-31-cloud', 'veo-31-fast-cloud']);
    // Everything else generates one output per call, so the batch control must be off:
    // N outputs would mean N calls and N bills, which is a different feature.
    for (const model of CLOUD) {
        if (batchFieldFor(model.cloud.endpointId)) continue;
        assert.equal(model.capabilities?.batch, false, `${model.id} offers a batch it cannot do`);
    }
});

test('a batch is capped at the provider\'s own published maximum', () => {
    assert.equal(batchFieldFor('black-forest-labs/FLUX-1-schnell').max, 4);
    assert.equal(batchFieldFor('google/veo-3.1').field, 'sample_count');
    assert.equal(buildSizeFields('black-forest-labs/FLUX-1-schnell',
        { width: 1024, height: 1024, batch: 99 }).num_images, 4);
});

// ── The prose-only bounds still parse ────────────────────────────────────────

test('Seedream still publishes its pixel box in prose', () => {
    for (const id of ['ByteDance/Seedream-4', 'ByteDance/Seedream-4.5']) {
        const box = pixelBoxFor(id);
        assert.ok(box, `${id}: the pixel box no longer parses — the clamp is gone`);
        assert.deepEqual([box.minW, box.minH, box.maxW, box.maxH, box.step],
            [1280, 720, 4096, 4096, 64]);
    }
});

test('every clip model still publishes its duration range in prose', () => {
    const expected = {
        'ByteDance/Seedance-1.5-Pro': { min: 4, max: 12 },
        'ByteDance/Seedance-2.0': { min: 4, max: 15 },
        'Wan-AI/Wan3.0-Video': { min: 2, max: 30 },
    };
    for (const [id, range] of Object.entries(expected)) {
        assert.deepEqual(durationRangeFor(id), range, `${id}: duration range no longer parses`);
    }
    // Veo publishes none because it has no duration field. That is not a parse failure.
    assert.equal(durationRangeFor('google/veo-3.1'), null);
});

// ── The Gemini twin, which is NOT on the grid ────────────────────────────────

test('gemini-3-pro-image is Nano Banana Pro and ships as ONE tile, not two', () => {
    // It shipped briefly as its own tile so both searchable names were on the grid.
    // Fabio dropped it on 2026-09-21 (MPI-864): two tiles for one model sells one thing
    // twice, and the two cards had identical price, identical fields and identical output.
    assert.equal(CLOUD.filter(m => m.cloud.endpointId === GEMINI_TWIN).length, 0,
        'google/gemini-3-pro-image is Nano Banana Pro under a second DeepInfra id — one tile only');

    const pro = CLOUD.find(m => m.id === 'nano-banana-pro-cloud');
    assert.ok(pro, 'the surviving tile is nano-banana-pro-cloud');
    // The name it lost still has to be findable, or someone searching "Gemini 3" finds
    // nothing and concludes the app cannot run it.
    assert.match(pro.description, /Gemini 3 Pro Image/);

    // The pricing module keeps the second endpoint, because a saved history item naming it
    // must still quote. That is a fact about DeepInfra, not about the roster.
    assert.equal(estimateCost(GEMINI_TWIN).usd, estimateCost(pro.cloud.endpointId).usd);
});
