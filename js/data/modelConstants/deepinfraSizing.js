/**
 * deepinfraSizing.js — turn the app's picked size into the body THIS provider model
 * actually accepts (MPI-853).
 *
 * `deepinfraPricing.js` answers "what will this cost"; this answers the question next to
 * it, "what may I ask for". They are separate because a wrong price misinforms while a
 * wrong size silently bills the user for a picture the wrong shape.
 *
 * THERE IS NO SINGLE SHAPE. Measured 2026-09-21 across the sixteen shipped ids, DeepInfra
 * takes four, and nothing in the id or the model family predicts which:
 *
 *   'wh'      `width` + `height` in pixels        FLUX 2 dev/pro/max, FLUX-1 schnell
 *   'size'    one `size` string, 'WIDTHxHEIGHT'   Seedream 4, 4.5, 5.0 Pro
 *   'aspect'  one `aspect_ratio` label, NO pixels the four Gemini / Nano Banana ids
 *   'video'   `resolution` + a ratio + `duration` Seedance 1.5/2.0, Wan 3.0, Veo 3.1
 *
 * and the four are not even internally consistent: Wan calls its ratio field `ratio`
 * where Seedance calls it `aspect_ratio`, Wan spells its tiers '1080P' where Seedance
 * spells them '1080p', and Veo has no `duration` field at all.
 *
 * SO NOTHING HERE IS HAND-KEPT. Every field name, enum and bound is read from the
 * `limits` block of `dev_configs/deepinfra-prices.json`, which the sync script copies
 * from each model's own `in_fields`. A model that changes its contract upstream fails
 * `node scripts/sync-deepinfra-prices.mjs --check` as a reviewable diff, instead of
 * quietly rejecting every generation — or, worse, accepting one at the wrong size.
 *
 * Two bounds exist ONLY in the field's prose, so they are parsed from it rather than
 * copied into a constant that would drift: Seedream's pixel box, and each video model's
 * duration range. `tests/deepinfra-catalogue.test.cjs` asserts both still parse, so a
 * reworded description fails loudly here rather than at a user's expense.
 */

import SNAPSHOT from '../../../dev_configs/deepinfra-prices.json' with { type: 'json' };

/**
 * FLUX's own grid. The in_fields publish a min and a max but not a step, and Black Forest
 * Labs' API requires dimensions divisible by 32 (docs.bfl.ai) — the same constraint the
 * note on FLUX_RATIOS in js/utils/ratios.js already records. Applied to every 'wh' model:
 * it is the strictest of the four and costs the others nothing.
 */
const WH_STEP = 32;

/** 'adaptive' is a policy, not a shape — it must never win a nearest-ratio search. */
const NON_RATIO_LABELS = new Set(['adaptive']);

/** @returns {object|null} the model's captured sizing contract, or null if unknown. */
export function limitsFor(endpointId) {
    return SNAPSHOT.models?.[endpointId]?.limits || null;
}

/**
 * Which of the four shapes this model speaks.
 * @returns {'wh'|'size'|'aspect'|'video'|null} null when the model is not in the snapshot.
 */
export function sizingModeFor(endpointId) {
    const limits = limitsFor(endpointId);
    if (!limits) return null;
    // Order matters: the video models also carry `aspect_ratio`, so `resolution` — which
    // only they have — is what separates them.
    if (limits.resolution) return 'video';
    if (limits.width && limits.height) return 'wh';
    if (limits.size) return 'size';
    if (limits.aspect_ratio) return 'aspect';
    return null;
}

/**
 * The provider's own native batch, if it has one. Only two of the sixteen do, under two
 * different names — everything else generates exactly one thing per call, so a batch
 * control on those would have to become N calls and N bills, which is a different
 * feature and not this one.
 * @returns {{field:string, max:number}|null}
 */
export function batchFieldFor(endpointId) {
    const limits = limitsFor(endpointId) || {};
    const field = limits.num_images ? 'num_images' : (limits.sample_count ? 'sample_count' : null);
    if (!field) return null;
    return { field, max: Math.max(1, Number(limits[field].maximum) || 1) };
}

/** The duration bounds a video model publishes, parsed from its prose. */
export function durationRangeFor(endpointId) {
    const desc = limitsFor(endpointId)?.duration?.description;
    // "duration of the output video in seconds (4-12, or -1 for model to decide)"
    const match = /(\d+)\s*-\s*(\d+)/.exec(String(desc || ''));
    return match ? { min: Number(match[1]), max: Number(match[2]) } : null;
}

/** Seedream's pixel box, parsed from its prose: "between 1280x720 and 4096x4096". */
export function pixelBoxFor(endpointId) {
    const desc = String(limitsFor(endpointId)?.size?.description || '');
    const box = /between (\d+)x(\d+) and (\d+)x(\d+)/i.exec(desc);
    const step = /multiple of (\d+)/i.exec(desc);
    if (!box) return null;
    return {
        minW: Number(box[1]), minH: Number(box[2]),
        maxW: Number(box[3]), maxH: Number(box[4]),
        step: step ? Number(step[1]) : 1,
    };
}

/**
 * Build the size half of a generation body.
 *
 * Everything is optional, because a caller may legitimately know only some of it — a
 * reused prompt carries pixels but no tier, an edit op carries neither. A field this
 * cannot resolve is OMITTED rather than guessed, so the provider applies its own default
 * instead of us inventing one.
 *
 * @param {string} endpointId - the provider's model id (`model.cloud.endpointId`)
 * @param {{width?:number, height?:number, ratioLabel?:string, qualityTier?:string,
 *          duration?:number, batch?:number}} [want]
 * @returns {Record<string, *>} fields to merge into the request body
 */
export function buildSizeFields(endpointId, want = {}) {
    const limits = limitsFor(endpointId);
    if (!limits) return {};

    const out = {};
    const width = Number(want.width) || 0;
    const height = Number(want.height) || 0;

    switch (sizingModeFor(endpointId)) {
        case 'wh': {
            if (width > 0 && height > 0) {
                const fitted = _fitPair(width, height, limits.width, limits.height, WH_STEP);
                out.width = fitted.width;
                out.height = fitted.height;
            }
            break;
        }
        case 'size': {
            // Explicit pixels, not the '2K'/'4K' shorthand. The shorthand is square-ish
            // and would throw away the ratio the user picked — which is the one thing the
            // picker exists to express.
            if (width > 0 && height > 0) {
                const box = pixelBoxFor(endpointId);
                out.size = box
                    ? `${_boxFit(width, box.minW, box.maxW, box.step)}x${_boxFit(height, box.minH, box.maxH, box.step)}`
                    : `${width}x${height}`;
            }
            break;
        }
        case 'aspect': {
            const label = _nearestAllowedRatio(limits.aspect_ratio.allowed, width, height, want.ratioLabel);
            if (label) out.aspect_ratio = label;
            break;
        }
        case 'video': {
            // Whichever name THIS model gave its ratio field. Wan is the odd one out.
            const ratioField = limits.aspect_ratio ? 'aspect_ratio' : (limits.ratio ? 'ratio' : null);
            if (ratioField) {
                const label = _nearestAllowedRatio(limits[ratioField].allowed, width, height, want.ratioLabel);
                if (label) out[ratioField] = label;
            }
            const tier = _matchTier(limits.resolution.allowed, want.qualityTier);
            if (tier) out.resolution = tier;
            const range = durationRangeFor(endpointId);
            if (range && Number(want.duration) > 0) {
                out.duration = Math.round(_clamp(Number(want.duration), range.min, range.max));
            }
            break;
        }
        default:
            break;
    }

    const batch = batchFieldFor(endpointId);
    if (batch) {
        const count = Math.max(1, Math.min(batch.max, Number(want.batch) || 1));
        // Omitted at 1 so the body stays the provider's own default shape.
        if (count > 1) out[batch.field] = count;
    }

    return out;
}

// ── Internals ────────────────────────────────────────────────────────────────

function _clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

/**
 * Fit a width/height PAIR into the captured bounds, scaling both by one factor so the
 * shape survives.
 *
 * Clamping each side on its own is the tempting version and it is wrong: 1920x1088 at
 * FLUX 2 Pro (max 1440) becomes 1440x1088, which is 4:3 — the user picked 16:9 and would
 * be billed for a different picture. This only fires on a size the model cannot do at
 * all, which in practice means a prompt reused from another model; the shipped ratio
 * tables are inside every bound already.
 */
function _fitPair(width, height, wLimit, hLimit, step) {
    const wMin = Number.isFinite(wLimit?.minimum) ? wLimit.minimum : 1;
    const wMax = Number.isFinite(wLimit?.maximum) ? wLimit.maximum : width;
    const hMin = Number.isFinite(hLimit?.minimum) ? hLimit.minimum : 1;
    const hMax = Number.isFinite(hLimit?.maximum) ? hLimit.maximum : height;

    // One factor for both sides: shrink to get under the maxima, grow to clear the
    // minima. Down first, so a pair that is too wide AND too short still ends up legal.
    const scale = Math.min(wMax / width, hMax / height, 1) * Math.max(wMin / width, hMin / height, 1);
    return {
        width: _snap(width * scale, wMin, wMax, step),
        height: _snap(height * scale, hMin, hMax, step),
    };
}

/** Land on the grid, then back inside the bound when the bound itself is off-grid. */
function _snap(value, min, max, step) {
    let fitted = _clamp(Math.round(_clamp(value, min, max) / step) * step, min, max);
    // A max of 1450 rounds UP to 1472, a min of 250 rounds DOWN to 224 — walk one step in.
    if (fitted > max) fitted -= step;
    if (fitted < min) fitted += step;
    return fitted;
}

/** Seedream's own rule: inside the box, rounded UP to the step. */
function _boxFit(value, min, max, step) {
    const stepped = step > 1 ? Math.ceil(value / step) * step : value;
    return _clamp(stepped, min, max);
}

/** "16:9" -> 1.777…; anything unparseable -> null. */
function _ratioValue(label) {
    const match = /^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/.exec(String(label || '').trim());
    if (!match) return null;
    const h = Number(match[2]);
    return h > 0 ? Number(match[1]) / h : null;
}

/**
 * The allowed label closest to the requested shape. An exact label match wins outright,
 * so a picker row labelled '4:5' reaches the provider as '4:5' even where our nominal
 * pixels for it are not exactly 4/5. Otherwise nearest by log distance, which treats
 * "twice as wide" and "twice as tall" as equally far — a plain difference does not.
 */
function _nearestAllowedRatio(allowed, width, height, label) {
    const list = (allowed || []).filter(a => !NON_RATIO_LABELS.has(String(a).toLowerCase()));
    if (!list.length) return null;
    if (label && list.includes(label)) return label;
    if (!(width > 0 && height > 0)) return null;

    const target = width / height;
    let best = null;
    let bestDistance = Infinity;
    for (const candidate of list) {
        const value = _ratioValue(candidate);
        if (!value) continue;
        const distance = Math.abs(Math.log(target / value));
        if (distance < bestDistance) { bestDistance = distance; best = candidate; }
    }
    return best;
}

/**
 * Match our tier id to the provider's spelling of it — '1080p' to Wan's '1080P'.
 *
 * An unmatched tier resolves to the LOWEST allowed, never to the provider's default.
 * Video price scales with resolution, and Wan's own default is its dearest band: a tier
 * lost in a cross-model reuse must cost the user less than they expected, not more.
 */
function _matchTier(allowed, tier) {
    const list = allowed || [];
    if (!list.length) return null;
    const wanted = String(tier || '').toLowerCase();
    return list.find(a => String(a).toLowerCase() === wanted) || list[0];
}
