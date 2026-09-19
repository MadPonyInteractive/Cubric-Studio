/**
 * generationControls.js — DOM-free resolver for the PromptBox controls an agent
 * submit can name (MPI-547): ratio, qualityTier, turbo (krea2Turbo/h3Turbo),
 * styleSelect, stylization, seed. Not batch: an agent submit always runs batch 1.
 *
 * WHY THIS FILE EXISTS: `js/shell/agentDispatch.js` used to carry its OWN copy of
 * the ratio/tier resolve (`_plannedSize`, MPI-546) alongside the real one living
 * inside `PromptBoxControls.js`'s mounted `qualityTier`/`ratio` controls. Two
 * implementations of "what size does this project want" is exactly the class of
 * bug MPI-546 shipped three times (duplicate dispatch, invisible run, ignored
 * ratio — see `.agents/mpi-kanban/tasks/_archived/MPI-546/validation.md`). This
 * module is the ONE place that logic lives now; `PromptBoxControls.js` and
 * `agentDispatch.js` both call it instead of recomputing it.
 *
 * DOM-FREE BY CONSTRUCTION: every import below (`projectModel.js`, `ratios.js`,
 * `commandRegistry.js`, `promptControlDefaults.js`, `modelConstants/*`) is pure
 * data + functions with no DOM/Electron-state dependency, so this file is
 * `require()`-able from the server (`routes/connector.js`, which validates a
 * named param with no project open) and `import()`-able from the renderer
 * (which has the real project). See the module-level comments on each of those
 * files before assuming otherwise.
 *
 * SCOPE: only the v1 params Fabio named 2026-09-14 (plan.md § "Open
 * question... ANSWERED"). The other 15 PROMPT_BOX_CONTROLS entries are out of
 * v1 scope and are untouched by this file.
 */

'use strict';

import { getSharedSettings, getModelSettings } from './projectModel.js';
import {
    getModelRatios, usesQualityTier, qualityTiersFor, clampQualityTier, defaultQualityTier,
} from '../utils/ratios.js';
import {
    getCommandDefault, modelShowsStyleRack, modelShowsBatch, modelShowsRatio,
    getCommandMediaInputs, filterMediaInputsForModel, getCommandComponents,
} from './commandRegistry.js';
import { PROMPT_CONTROL_DEFAULTS } from './promptControlDefaults.js';
import { MODELS } from './modelConstants/models.js';
import { canonicalModelId } from './modelConstants/resolveModelDeps.js';

function _mediaTypeOf(model) {
    return model?.mediaType === 'video' ? 'video' : 'image';
}

function _err(code, message) {
    return { ok: false, code, message };
}

// ── Model lookup (server-safe) ──────────────────────────────────────────────

/**
 * A model def by id, for callers that cannot use `modelRegistry.js`'s
 * `getModelById` — that module imports `state.js` + `remoteEngineClient.js`
 * (renderer-only), so it is unsafe to `require()` from a route. This is the
 * same lookup (`canonicalModelId` + `MODELS.find`) minus the install-status
 * machinery `getModelById` layers on top, which `routes/connector.js`'s static
 * validation never needs.
 * @param {string} modelId
 * @returns {object|null}
 */
export function findModelDef(modelId) {
    const canonical = canonicalModelId(String(modelId || ''));
    return MODELS.find((m) => m.id === canonical) ?? null;
}

// ── Shared three-layer default (op → model → global) ───────────────────────
//
// Lifted out of `PromptBoxControls.js`'s private `_resolveDefault` (MPI-365),
// which the `qualityTier`/`stylization` control mounts and this file's own
// `resolveNamedParams` all need identically. `PromptBoxControls.js`'s
// `_resolveDefault` now delegates here rather than keeping its own copy.

/**
 * The default a control opens on for `model`+`operation`, most specific first:
 * an op-level override (`commandRegistry.js` `commands[op].defaults`), then a
 * model-level override (`ModelDef.controlDefaults`), then `globalDefault`.
 * @param {string} controlId
 * @param {object|null} model
 * @param {string} [operation]
 * @param {*} globalDefault
 * @returns {*}
 */
export function resolveThreeLayerDefault(controlId, model, operation, globalDefault) {
    if (operation) {
        const opDefault = getCommandDefault(operation, controlId);
        if (opDefault !== undefined) return opDefault;
    }
    const modelDefault = model?.controlDefaults?.[controlId];
    if (modelDefault !== undefined) return modelDefault;
    return globalDefault;
}

// ── qualityTier ──────────────────────────────────────────────────────────────

/**
 * The quality tier actually in effect for `model` in `project` — the same
 * precedence the mounted `qualityTier`/`ratio` controls use: the per-model
 * bucket (MPI-133) wins, the legacy `shared.ratioSelector.qualityTier` is the
 * migration fallback for a project saved before that move, and a project with
 * neither opens on the model's cheapest tier (never a foreign 'medium').
 * Returns `null` for a model whose ratio set has no tier axis at all.
 * @param {object|null} project
 * @param {object|null} model
 * @returns {string|null}
 */
export function resolveEffectiveQualityTier(project, model) {
    const modelType = model?.type ?? 'flux';
    if (!usesQualityTier(modelType)) return null;
    const modelBucket = getModelSettings(project || {}, model?.id);
    const sharedBucket = getSharedSettings(project || {}, _mediaTypeOf(model));
    const saved = modelBucket.qualityTier ?? sharedBucket.ratioSelector?.qualityTier;
    return saved != null ? clampQualityTier(modelType, saved) : defaultQualityTier(modelType);
}

/** Is `tier` one this model actually declares? */
export function isValidQualityTier(model, tier) {
    const modelType = model?.type;
    return usesQualityTier(modelType) && qualityTiersFor(modelType).includes(tier);
}

// ── ratio ────────────────────────────────────────────────────────────────────

/**
 * Pixel dims for a ratio LABEL against a model TYPE — the pure lookup half of
 * the resolve, with no project involved. A label is searched across BOTH
 * orientations (a caller names "9:16" without needing to also know it lives in
 * the portrait table), so the resolved `orientation` is a return value, not an
 * input, unless the caller pins one.
 * @param {string} modelType
 * @param {{orientation?: string, qualityTier?: string, ratioLabel?: string}} params
 * @returns {{width: number, height: number, orientation?: string}}
 */
export function resolveRatioDimensions(modelType, { orientation, qualityTier, ratioLabel } = {}) {
    if (!ratioLabel) return { width: 0, height: 0 };
    const orientations = orientation ? [orientation] : ['portrait', 'landscape'];
    for (const orient of orientations) {
        const list = getModelRatios(modelType, orient, qualityTier) || [];
        const match = list.find((r) => r.label === ratioLabel);
        if (match) return { width: match.w || 0, height: match.h || 0, orientation: orient };
    }
    return { width: 0, height: 0 };
}

/** Is `label` a real ratio for `model` on `operation`, at ANY tier it declares? */
export function isValidRatio(model, operation, label) {
    if (typeof label !== 'string' || !label) return false;
    if (!modelShowsRatio(model, operation)) return false;
    const modelType = model?.type ?? 'flux';
    const tiers = usesQualityTier(modelType) ? qualityTiersFor(modelType) : [undefined];
    return tiers.some((tier) => ['portrait', 'landscape'].some(
        (orient) => (getModelRatios(modelType, orient, tier) || []).some((r) => r.label === label),
    ));
}

/**
 * The ratio dims this generation should use: an explicit `overrides.ratioLabel`/
 * `qualityTier` wins, an unset one falls back to the project's saved
 * `shared.ratioSelector` (selectedRatio/orientation) and `resolveEffectiveQualityTier`
 * — the same combination `js/shell/agentDispatch.js`'s old `_plannedSize` computed
 * inline. Returns `{width:0,height:0}` when nothing resolves (no override, no saved
 * ratio), which is the honest "let the baked workflow default win" signal MPI-546
 * relies on — never a guessed size.
 * @param {object|null} project
 * @param {object|null} model
 * @param {{ratioLabel?: string, qualityTier?: string, orientation?: string}} [overrides]
 * @returns {{width: number, height: number, label: string|null, qualityTier: string|null}}
 */
export function resolvePlannedRatio(project, model, overrides = {}) {
    const modelType = model?.type ?? 'flux';
    const shared = getSharedSettings(project || {}, _mediaTypeOf(model));
    const sel = shared?.ratioSelector || {};
    const qualityTier = overrides.qualityTier ?? resolveEffectiveQualityTier(project, model);
    const ratioLabel = overrides.ratioLabel ?? sel.selectedRatio;
    if (!ratioLabel) return { width: 0, height: 0, label: null, qualityTier };

    const dims = resolveRatioDimensions(modelType, {
        orientation: overrides.orientation ?? sel.orientation,
        qualityTier,
        ratioLabel,
    });
    return {
        width: dims.width,
        height: dims.height,
        label: (dims.width && dims.height) ? ratioLabel : null,
        qualityTier,
    };
}

// ── turbo (krea2Turbo / h3Turbo) ─────────────────────────────────────────────

/**
 * Which perModel control id this model's turbo toggle is, or `null` when the
 * model has neither. Both inject the same `Input_is_Turbo` node title; the
 * control id only matters for which `modelSettings[id]` bucket key to read/write
 * (see PromptBoxControls.js's own comment on why they are siblings, not a
 * shared control).
 * @param {object|null} model
 * @returns {'krea2Turbo'|'h3Turbo'|null}
 */
export function resolveTurboControlId(model) {
    if (model?.capabilities?.turboToggle === true) return 'krea2Turbo';
    if (model?.capabilities?.h3TurboToggle === true) return 'h3Turbo';
    return null;
}

// ── What an agent may set (MPI-774) ──────────────────────────────────────────

/**
 * The v1 named params `model` offers on `operation`, as `GET /connector/models`
 * lists them per op. Every value here passes `resolveNamedParams`, and a param it
 * leaves out is one that refuses: built on the validator's own helpers so the two
 * cannot disagree. Without it "turbo where offered" was unanswerable, and an agent
 * learned each model's controls by collecting INVALID_* errors.
 * @param {object|null} model
 * @param {string} operation
 * @returns {{ratios: string[], qualityTiers: string[], turbo: boolean, styles: string[]}}
 */
export function namedParamsFor(model, operation) {
    const modelType = model?.type ?? 'flux';
    const qualityTiers = usesQualityTier(modelType) ? [...qualityTiersFor(modelType)] : [];
    const ratios = new Set();
    if (modelShowsRatio(model, operation)) {
        for (const tier of (qualityTiers.length ? qualityTiers : [undefined])) {
            for (const orient of ['portrait', 'landscape']) {
                for (const r of getModelRatios(modelType, orient, tier) || []) ratios.add(r.label);
            }
        }
    }
    return {
        ratios: [...ratios],
        qualityTiers,
        turbo: !!resolveTurboControlId(model),
        styles: modelShowsStyleRack(model, operation) ? [...model.styleLoraLabels] : [],
        // Seconds, on a clip op only (MPI-820). Advertised as a RANGE, not a list: the
        // slider is 1-30 and H3 snaps whatever it is given onto its own frame grid, so a
        // list of legal values would be a different list per model type and wrong anyway.
        duration: modelShowsDuration(model, operation)
            ? { min: DURATION_MIN, max: DURATION_MAX }
            : null,
    };
}

// ── duration (MPI-820) ───────────────────────────────────────────────────────

/** Video length bounds, matching the PromptBox slider so both paths share one contract. */
export const DURATION_MIN = 1;
export const DURATION_MAX = 30;

// H3's frame grid, mirrored from the node that actually applies it:
// `ComfyUi-MpiNodes/h3.py` § snap_h3_frames / MpiH3Length. Duplicated across a
// LANGUAGE boundary on purpose — the node stays the authority and does the snapping at
// graph time; this copy only PREDICTS it, so an answer can say what the run will really
// be instead of echoing what was asked for. `tests/agent-duration.test.cjs` pins the
// pairing, so a change to the node that is not mirrored here fails a test rather than
// quietly making every reported duration wrong.
const H3_FPS = 24;
const H3_GRID = 17;
const H3_OFFSET = 5;
const H3_TRAINED_MIN = 124;   // core's own tooltip: "trained range is ~124-362"
const H3_TRAINED_MAX = 362;

/** Nearest valid H3 frame count (n % 17 == 5), minimum 5. NEAREST, never up: core snaps
 *  up, which maximises the error — 4 s asks 96 frames and gets 107 (4.46 s) when 90
 *  (3.75 s) is closer. */
export function snapH3Frames(frames) {
    const k = Math.round((frames - H3_OFFSET) / H3_GRID);
    return Math.max(H3_OFFSET, k * H3_GRID + H3_OFFSET);
}

/** Does `model` take a duration on `operation`? The op's own component list is the
 *  source of truth — it is what decides whether the slider mounts at all. */
export function modelShowsDuration(model, operation) {
    return getCommandComponents(operation).includes('duration');
}

/** Is `value` a legal video length? */
export function isValidDuration(value) {
    return typeof value === 'number' && Number.isFinite(value)
        && value >= DURATION_MIN && value <= DURATION_MAX;
}

/**
 * What `wanted` seconds will ACTUALLY produce on this model.
 *
 * Only H3 snaps; every other video model takes the seconds it is given, so they report
 * back unchanged. Returned so a caller can tell the truth rather than repeat the ask:
 * "2 seconds" on H3 is 56 frames, i.e. 2.33 s, and below the trained range.
 * @returns {{seconds: number, frames: number|null, inTrainedRange: boolean|null}}
 */
export function effectiveDuration(model, wanted) {
    if (model?.type !== 'h3') return { seconds: wanted, frames: null, inTrainedRange: null };
    const frames = snapH3Frames(Math.round(wanted * H3_FPS));
    return {
        seconds: frames / H3_FPS,
        frames,
        inTrainedRange: frames >= H3_TRAINED_MIN && frames <= H3_TRAINED_MAX,
    };
}

// ── styleSelect / stylization ────────────────────────────────────────────────

/** Is `value` a real index into this model's style rack? */
export function isValidStyleSelect(model, value) {
    const labels = Array.isArray(model?.styleLoraLabels) ? model.styleLoraLabels : null;
    return !!labels && Number.isInteger(value) && value >= 0 && value < labels.length;
}

/** Is `value` a legal stylization strength (0..1)? */
export function isValidStylization(value) {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

// ── seed ─────────────────────────────────────────────────────────────────────

/** Is `value` a legal explicit seed (the same range `generateRandomSeed` draws from)? */
export function isValidSeed(value) {
    return Number.isInteger(value) && value >= 0 && value < 2 ** 32;
}

// ── Combined resolve (agent path) ───────────────────────────────────────────

/**
 * Validate + resolve every v1 named param present in `named` against `model` in
 * `project`, returning ONE of:
 *   { ok:true, injectionParams, width, height }
 *   { ok:false, code, message }
 *
 * `project` may be `null` — `routes/connector.js` calls this with no project
 * (it has none, server-side) purely for the STATIC validation half, discarding
 * `injectionParams`/`width`/`height` and keeping only `ok`/`code`/`message`. That
 * is the same function `agentDispatch.js` calls with the real project to get the
 * actual injection values, so the two can never validate a param differently —
 * one implementation, not a route-side copy and a renderer-side copy.
 *
 * Every control this model/operation actually supports gets an EFFECTIVE value
 * injected even when `named` left it unset — `named.X ?? the project's own
 * current setting ?? that control's own default` — because the whole point of
 * a named param is that an agent run stops silently diverging from what the
 * PromptBox currently shows (MPI-546's ratio bug, generalised: decision #1 in
 * plan.md, "unset params keep falling back to the project's state exactly as
 * today"). A control the model/operation does NOT support is simply skipped,
 * matching `visibleControlIds` hiding it in the UI.
 *
 * @param {object|null} project
 * @param {object|null} model
 * @param {string} operation
 * @param {{ratio?, qualityTier?, turbo?, styleSelect?, stylization?}} named
 * @returns {{ok:true, injectionParams:object, width:number, height:number}|{ok:false, code:string, message:string}}
 */
export function resolveNamedParams(project, model, operation, named = {}) {
    const { ratio, qualityTier, turbo, styleSelect, stylization, duration: durationWanted } = named;
    const injectionParams = {};
    const modelName = model?.name || model?.id || 'this model';

    // qualityTier gates which ratio table `ratio` is checked against, so it is
    // validated first.
    if (qualityTier !== undefined && !isValidQualityTier(model, qualityTier)) {
        const tiers = usesQualityTier(model?.type) ? qualityTiersFor(model?.type) : [];
        return _err('INVALID_QUALITY_TIER', tiers.length
            ? `qualityTier must be one of: ${tiers.join(', ')}.`
            : `${modelName} has no quality tiers.`);
    }
    if (ratio !== undefined && !isValidRatio(model, operation, ratio)) {
        return _err('INVALID_RATIO', modelShowsRatio(model, operation)
            ? `ratio "${ratio}" is not a ratio ${modelName} offers.`
            : `"${operation}" does not size its own output — it has no ratio to set.`);
    }
    // An op that sizes its own output (the model's `imageSizedOps`: Klein's edit follows
    // the source image) takes no ratio, so the project's saved one is not injected either.
    // It was: the card recorded 1024x1024 for an 832x1248 edit (MPI-774, 2026-09-17).
    const ratioDims = modelShowsRatio(model, operation)
        ? resolvePlannedRatio(project, model, { ratioLabel: ratio, qualityTier })
        : { width: 0, height: 0, label: null };
    if (ratioDims.width && ratioDims.height) {
        injectionParams.Width = ratioDims.width;
        injectionParams.Height = ratioDims.height;
        if (ratioDims.label) injectionParams.Ratio_Label = ratioDims.label;
    }

    const turboControlId = resolveTurboControlId(model);
    if (turbo !== undefined) {
        if (typeof turbo !== 'boolean') return _err('INVALID_TURBO', 'turbo must be a boolean.');
        if (!turboControlId) return _err('INVALID_TURBO', `${modelName} has no turbo toggle.`);
        injectionParams.Input_is_Turbo = turbo;
    } else if (turboControlId) {
        const saved = getModelSettings(project || {}, model?.id)[turboControlId];
        injectionParams.Input_is_Turbo = typeof saved === 'boolean'
            ? saved
            : !!resolveThreeLayerDefault(turboControlId, model, operation, PROMPT_CONTROL_DEFAULTS[turboControlId]);
    }

    const showsStyle = modelShowsStyleRack(model, operation);
    if (styleSelect !== undefined && (!showsStyle || !isValidStyleSelect(model, styleSelect))) {
        return _err('INVALID_STYLE_SELECT', showsStyle
            ? `styleSelect must be an integer 0-${(model.styleLoraLabels.length - 1)}.`
            : `${modelName} has no style rack on "${operation}".`);
    }
    if (stylization !== undefined && (!showsStyle || !isValidStylization(stylization))) {
        return _err('INVALID_STYLIZATION', showsStyle
            ? 'stylization must be a number between 0 and 1.'
            : `${modelName} has no style rack on "${operation}".`);
    }
    if (showsStyle) {
        const modelBucket = getModelSettings(project || {}, model?.id);
        injectionParams['Input_Style_Selector.selector'] = styleSelect !== undefined
            ? styleSelect
            : (Number.isInteger(modelBucket.styleSelect) ? modelBucket.styleSelect : PROMPT_CONTROL_DEFAULTS.styleSelect);
        injectionParams['Input_Style_Selector.strength_model'] = stylization !== undefined
            ? stylization
            : (typeof modelBucket.stylization === 'number'
                ? modelBucket.stylization
                : resolveThreeLayerDefault('stylization', model, operation, PROMPT_CONTROL_DEFAULTS.stylization));
    }

    // Agents never batch (Fabio, 2026-09-15): a batch of N holds N latents in VRAM at
    // once, N queued submits hold one. So an agent run pins batch to 1 instead of
    // inheriting a project saved at 3; the route refuses a `batch` field by name.
    if (modelShowsBatch(model, operation)) injectionParams.Input_Batch_Size = 1;

    // duration (MPI-820). It was missing from this set entirely, so NO agent video ever
    // carried `Input_Duration` and every one ran the workflow's baked value — 2 for H3,
    // which snaps to 56 frames / 2.33 s, BELOW the 124-362 trained range. The app's own
    // slider said 5 the whole time. Same shape as turbo: explicit wins, else the project's
    // saved value, else the three-layer default.
    let duration = null;
    if (modelShowsDuration(model, operation)) {
        if (durationWanted !== undefined) {
            if (!isValidDuration(durationWanted)) {
                return _err('INVALID_DURATION', `duration must be a number of seconds between ${DURATION_MIN} and ${DURATION_MAX}.`);
            }
            duration = durationWanted;
        } else {
            const saved = getSharedSettings(project || {}, _mediaTypeOf(model)).duration;
            duration = typeof saved === 'number' && isValidDuration(saved)
                ? saved
                : resolveThreeLayerDefault('duration', model, operation, PROMPT_CONTROL_DEFAULTS.duration);
        }
        injectionParams.Input_Duration = duration;
    } else if (durationWanted !== undefined) {
        return _err('INVALID_DURATION', `"${operation}" does not produce a clip, so it has no duration to set.`);
    }

    return {
        ok: true,
        injectionParams,
        width: ratioDims.width,
        height: ratioDims.height,
        // What the run will ACTUALLY be, so a caller reports the truth rather than the
        // ask — H3 snaps to its frame grid and 2 s is really 2.33 s. Null off a clip op.
        duration: duration === null ? null : effectiveDuration(model, duration),
    };
}

// ── media (agent path) ───────────────────────────────────────────────────────

/**
 * Turn an agent's `media: [{ role, url }]` into the `mediaItems` a dispatch takes,
 * resolved through the op's own declared slots (MPI-765). One implementation for
 * both branches of `agentDispatch.js` — the model op and the Flow.
 *
 * The op owns the slot vocabulary (`key` + `mediaType`); the caller only names a
 * role. Resolving through the op rather than trusting a caller-sent mediaType is
 * what keeps a wav from being announced as an image and failing in the graph.
 *
 * Items come back in the op's DECLARED slot order, not the caller's. Klein Edit's
 * slots are `ordinal`: `stripOrdinalMediaRoles` drops the role at injection and item
 * order becomes the meaning, so `inputImage2` sent before `inputImage` would
 * otherwise swap which image gets edited — with ok:true.
 *
 * `model` null = a Flow, whose declared slots are the contract as they stand
 * (`filterMediaInputsForModel`). A model drops the slots it cannot take (WAN's audio).
 *
 * @param {string} operation
 * @param {object|null} model
 * @param {Array<{role:string, url:string}>} media
 * @returns {{ok:true, mediaItems:Array}|{ok:false, code:string, message:string}}
 */
export function resolveAgentMedia(operation, model, media = []) {
    const slots = filterMediaInputsForModel(getCommandMediaInputs(operation), model);
    const mediaItems = [];
    for (const m of (Array.isArray(media) ? media : [])) {
        const slot = slots.find(s => s.key === m?.role);
        if (!slot) {
            return _err('BAD_REQUEST',
                `"${operation}" has no media role "${m?.role}". Roles: ${slots.map(s => s.key).join(', ') || 'none'}.`);
        }
        if (!m.url) return _err('BAD_REQUEST', `Media role "${m.role}" has no url.`);
        if (mediaItems.some(item => item.role === slot.key)) {
            return _err('BAD_REQUEST', `Media role "${m.role}" was given twice.`);
        }
        mediaItems.push({ url: m.url, mediaType: slot.mediaType, role: slot.key, source: model ? 'agent' : 'flow-agent' });
    }
    // Roles are explicit here, so a required slot is filled BY ROLE. The shared
    // `findMissingMediaSlot` also accepts any item of the slot's type, which suits an
    // unroled PromptBox chip; on this path it let a lone `inputImage2` through, and
    // ordinal injection then made the REFERENCE the picture being edited (caught live).
    const missing = slots.find(s => s.required !== false && !mediaItems.some(item => item.role === s.key));
    if (missing) {
        return _err('MEDIA_REQUIRED', `"${operation}" needs ${missing.mediaType} in its "${missing.key}" slot.`);
    }
    const order = key => slots.findIndex(s => s.key === key);
    mediaItems.sort((a, b) => order(a.role) - order(b.role));
    return { ok: true, mediaItems };
}
