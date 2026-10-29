/**
 * generationControls.js — DOM-free resolver for the PromptBox controls an agent
 * submit can name (MPI-547): ratio, qualityTier, turbo (krea2Turbo/h3Turbo),
 * styleSelect, stylization, seed, and batch where the model batches cleanly (agentCanBatch).
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

import { getSharedSettings, getModelSettings, getOpSettings } from './projectModel.js';
import {
    getModelRatios, usesQualityTier, qualityTiersFor, clampQualityTier, defaultQualityTier,
} from '../utils/ratios.js';
import {
    getCommandDefault, modelShowsStyleRack, modelShowsBatch, modelShowsRatio, modelShowsCustomSize,
    getCommandMediaInputs, filterMediaInputsForModel, getCommandComponents,
    AUDIO_CATEGORIES, AUDIO_LENGTH, TTS_LANGUAGES, audioCategoryValue, ttsLanguageValue, ttsLanguageParams,
    TTS_KNOBS, ttsKnobParams,
} from './commandRegistry.js';
import { PROMPT_CONTROL_DEFAULTS } from './promptControlDefaults.js';
import { layoutRows, endsWithBoxTable, boxName, mossLayoutPrompt } from './layoutBoxes.js';
import { MODELS } from './modelConstants/models.js';
import { canonicalModelId } from './modelConstants/resolveModelDeps.js';
import { getExtension, isImageFile, isVideoFile, isAudioFile } from '../utils/file.js';
import { overlapFor } from '../utils/tileCount.js';

// Twin of PromptBoxControls' `_mediaTypeOf`: audio has no shared bucket (MPI-1012).
function _mediaTypeOf(model) {
    const m = model?.mediaType;
    return m === 'video' || m === 'audio' ? m : 'image';
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
 * @returns {{ratios: string[], qualityTiers: string[], tierSizes: Object<string, Object<string, string>>, turbo: boolean, styles: string[]}}
 */
export function namedParamsFor(model, operation) {
    const modelType = model?.type ?? 'flux';
    const qualityTiers = usesQualityTier(modelType) ? [...qualityTiersFor(modelType)] : [];
    const ratios = new Set();
    // A tier NAME says nothing about pixels: asked for "1K" (Fabio, 2026-09-20), the agent
    // picked `high` off the name and got 1664x960 - 1920x1088 is `very_high`. The real
    // canvas per tier and ratio, so a named resolution is matched on numbers.
    const tierSizes = {};
    if (modelShowsRatio(model, operation)) {
        for (const tier of (qualityTiers.length ? qualityTiers : [undefined])) {
            for (const orient of ['portrait', 'landscape']) {
                for (const r of getModelRatios(modelType, orient, tier) || []) {
                    ratios.add(r.label);
                    if (tier && r.w && r.h) (tierSizes[tier] ??= {})[r.label] = `${r.w}x${r.h}`;
                }
            }
        }
    }
    return {
        ratios: [...ratios],
        qualityTiers,
        tierSizes,
        turbo: !!resolveTurboControlId(model),
        styles: modelShowsStyleRack(model, operation) ? [...model.styleLoraLabels] : [],
        // Seconds, on a clip op only (MPI-820). Advertised as a RANGE, not a list: the
        // slider is 1-15 and H3 snaps whatever it is given onto its own frame grid, so a
        // list of legal values would be a different list per model type and wrong anyway.
        // Sound & Music takes its length as `duration` too, on its own 1-190 range (MPI-1012).
        duration: getCommandComponents(operation).includes('audioLength')
            ? { min: AUDIO_LENGTH.min, max: AUDIO_LENGTH.max }
            : modelShowsDuration(model, operation)
                ? { min: DURATION_MIN, max: DURATION_MAX }
                : null,
        // The audio models' pickers (MPI-1012), only where the op has them: every other
        // op's answer keeps exactly its old shape.
        ...(getCommandComponents(operation).includes('audioCategory')
            ? { categories: AUDIO_CATEGORIES.map(c => c.v) } : {}),
        ...(getCommandComponents(operation).includes('ttsLanguage')
            ? { languages: TTS_LANGUAGES.map(l => l.label) } : {}),
        // How far the run may move off the picture it was given (MPI-817): 0 keeps it, 1
        // repaints it. With its default, so "a bit more" has somewhere to start from.
        denoise: modelShowsDenoise(model, operation)
            ? { min: 0, max: 1, default: _denoiseDefault(operation) }
            : null,
        // The upscale op's factor and tile path (MPI-1038). 1 is detail only: tiles only.
        ...(getCommandComponents(operation).includes('upscaleFactor')
            ? { upscaleFactors: modelShowsTiles(model, operation) ? [1, ...UPSCALE_FACTORS] : [...UPSCALE_FACTORS] } : {}),
        ...(modelShowsTiles(model, operation) ? { tiles: true, tileSizes: [...TILE_SIZES] } : {}),
        // No Background (MPI-1049): a transparent result, where the model can make one.
        ...(modelShowsTransparent(model, operation) ? { transparent: true } : {}),
        // Fast Motion (MPI-1285): H3 Reference draws a fast-action scene at full size.
        ...(modelShowsFastMotion(model, operation) ? { fastMotion: true } : {}),
        // An edit whose size sits behind the Custom size button (`customSizeOps`, MPI-1181/1207): ratio and
        // qualityTier are optional there, and leaving both out keeps reference 1's own frame (resolveNamedParams).
        ...(modelShowsCustomSize(model, operation) ? { customSize: true } : {}),
        // Boxes (MPI-1181): where things go in the frame, the PromptBox Boxes panel's list.
        ...(modelTakesBoxes(model, operation) ? { boxes: true } : {}),
    };
}

// ── Fast Motion (MPI-1285) ───────────────────────────────────────────────────

/** Does `operation` on `model` carry Fast Motion? The op's control AND the model's flag (H3 Reference only). */
export function modelShowsFastMotion(model, operation) {
    return getCommandComponents(operation).includes('h3FastMotion') && model?.capabilities?.h3FastMotionToggle === true;
}

// ── No Background (MPI-1049) ─────────────────────────────────────────────────

/** Does `operation` on `model` carry No Background? The op's control AND the model's RGBA sentences. */
export function modelShowsTransparent(model, operation) {
    return getCommandComponents(operation).includes('transparentBackground') && !!model?.transparentPrompt;
}

/**
 * `prompt` wrapped in the model's RGBA sentences. Idempotent, so a prompt that already
 * carries them (the Qwen recipe writes them itself on Enhance, and older prompts were
 * told to) is not doubled. A prompt typed without a closing full stop gets one, or the
 * suffix runs on as part of its last sentence ("up to her knees The image has...").
 */
export function withTransparentPrompt(model, prompt) {
    const tp = model?.transparentPrompt;
    if (!tp) return prompt;
    let text = String(prompt || '').trim();
    if (!text.startsWith(tp.prefix)) text = `${tp.prefix} ${text}`.trim();
    if (!text.endsWith(tp.suffix)) text = `${/[.!?]["')\]]*$/.test(text) ? text : `${text}.`} ${tp.suffix}`;
    return text;
}

/**
 * The run's prompt for a `canvasPrompt` model on a custom-size edit (MPI-1207, Qwen Edit):
 * opens with the frame and asks for the scene to be EXTENDED to it. Wording benched on the
 * shipped graph (2026-10-20, 1:1 and 16:9 from a portrait): "fill ... no borders" alone left
 * black bands at 1:1 and a three-panel collage at 16:9; "extend the scene outward on every
 * side" filled both cleanly. Same contract as withTransparentPrompt: the prompt of record
 * stays the user's own words.
 * @param {string} prompt
 * @param {string} frame - the ratio label ('3:4'), or 'WxH' when there is none
 * @returns {string}
 */
export function withCanvasPrompt(prompt, frame) {
    const text = String(prompt || '').trim();
    if (text.startsWith('TARGET CANVAS:')) return text;
    return `TARGET CANVAS: ${frame}\n${text}\nExtend the scene outward on every side so it fills the whole picture edge to edge. No black bars, no borders, no padding.`;
}

// ── Boxes (MPI-1181) ─────────────────────────────────────────────────────────

const KEEP_LINE = 'Keep everything else in the picture exactly the same.';
// ponytail: English keyword match; a keep clause worded otherwise just gets a second one.
const KEEP_CLAUSE = /\bunchanged\b|\b(keep|leave|preserve)\b[^.]*\b(same|intact|as (it|they) (is|are))\b/i;

/** Does `model` take layout boxes on `operation`? (`ModelDef.layoutBoxes.ops`) */
export function modelTakesBoxes(model, operation) {
    return !!model?.layoutBoxes?.ops?.includes(operation);
}

/**
 * The run's prompt with the user's boxes appended as the model's layout table. Boxes are
 * stored as fractions of the output frame, `{ x, y, w, h, desc, name }`; the name is the
 * row id, which the prompt cites as `<name>` (`layoutRows`).
 *
 * `flux3`: what core `Flux3LayoutPrompt` does - prompt, one space, a JSON list of
 * `{ id, bbox: [y_min, x_min, y_max, x_max] on a 0-1000 grid, desc }`, background first.
 * The table must be the LAST thing in the prompt (BFL's `bbox.split` reads from the last
 * `[`), so this runs after every other prompt wrapper. Benched 2026-10-20: the boxes move
 * the subjects on t2i and place an added object on edit.
 *
 * An EDIT with an empty prompt gets its instruction written from the boxes: with only the
 * table, FLUX.3 drew a new picture from the box text and dropped the subject (Fabio's tiger,
 * 2026-10-20).
 *
 * `moss`: the whole prompt becomes MOSS-Image's layout JSON (`mossLayoutPrompt`), which places
 * boxes in output pixels, hence `size`.
 *
 * @param {object} model - the ModelDef; `layoutBoxes.format` picks the table
 * @param {string} prompt
 * @param {Array<{x:number,y:number,w:number,h:number,desc?:string}>} boxes
 * @param {string} [operation]
 * @param {{width:number,height:number}} [size] - the output frame (`moss` only)
 * @returns {string}
 */
export function withLayoutBoxes(model, prompt, boxes, operation, size) {
    let text = String(prompt || '').trim();
    const format = model?.layoutBoxes?.format;
    if (!Array.isArray(boxes) || !boxes.length) return text;
    if (format === 'moss' && size?.width && size?.height) return mossLayoutPrompt(text, boxes, size.width, size.height);
    if (format !== 'flux3') return text;
    // An Enhance in box mode already wrote the table (the user's boxes, reconciled): keep it.
    if (endsWithBoxTable(text)) return text;
    const rows = layoutRows(boxes);
    if (!text && operation === 'edit') {
        text = `${rows.map((r) => `In <${r.id}>: ${r.desc}.`).join(' ')} ${KEEP_LINE}`;
    } else if (operation === 'edit' && !KEEP_CLAUSE.test(text)) {
        // A typed box edit with no keep clause gets one (Fabio, 2026-10-20): the boxes say
        // what changes, nothing said what stays.
        text = `${/[.!?]$/.test(text) ? text : `${text}.`} ${KEEP_LINE}`;
    }
    return `${text} ${JSON.stringify(rows)}`;
}

// ── upscale factor + Use Tiles (MPI-1038) ────────────────────────────────────

/** The upscale op's factors without tiles; Use Tiles adds 1 (detail only). Mirrors the
 *  PromptBox `upscaleFactor` control's options. */
export const UPSCALE_FACTORS = Object.freeze([1.5, 2, 3, 4]);

/** Use Tiles' tile sizes in px (MakeTileSEGS bbox_size, MPI-1232). Mirrors the PromptBox `tileSize` control. */
export const TILE_SIZES = Object.freeze([256, 512, 768, 1024, 1536]);

/** Does `operation` on `model` carry Use Tiles? The op's control AND the graph's "Tile Upscale" group. */
export function modelShowsTiles(model, operation) {
    return getCommandComponents(operation).includes('useTiles') && model?.capabilities?.tileUpscale === true;
}

// ── agent batch (MPI-876) ────────────────────────────────────────────────────

/** The largest batch one agent submit runs: the batch picker's 1..4, and the cloud's own cap. */
export const AGENT_BATCH_MAX = 4;

/**
 * Can an agent run `operation` on `model` as ONE batched job? Narrower than
 * `modelShowsBatch` on purpose: a batch that runs is not a batch that comes back clean.
 * On most models images 2+ artefact (Fabio, 2026-09-22); only the SDXL family's t2i
 * and the cloud models batch safely. Everything else gets N queued jobs from the agent.
 * ponytail: "t2i or cloud" is the rule today; a t2i model that artefacts must turn its
 * batch off (`capabilities.batch: false`, as Chroma does) or this lets it through.
 */
export function agentCanBatch(model, operation) {
    return modelShowsBatch(model, operation) && (model?.provider === 'deepinfra' || operation === 't2i');
}

// ── denoise (MPI-817) ────────────────────────────────────────────────────────

/** Does `operation` carry the denoise slider? The op's own component list is the authority,
 *  as it is for duration. `model` is unused today and kept for the symmetry callers rely on. */
export function modelShowsDenoise(model, operation) {
    return getCommandComponents(operation).includes('denoise');
}

function _denoiseDefault(operation) {
    const opDefault = getCommandDefault(operation, 'denoise');
    return typeof opDefault === 'number' ? opDefault : PROMPT_CONTROL_DEFAULTS.denoise;
}

/**
 * The denoise default for `operation`, accounting for whether tiles is on (MPI-1232).
 * When tiles is on the default rises to `PROMPT_CONTROL_DEFAULTS.tilesDenoise` (0.3)
 * because each tile is re-denoised from its crop; too low and seams read through.
 * A user's saved value still wins — this is only the fallback when nothing is saved.
 * @param {string} operation
 * @param {boolean} tilesOn
 * @returns {number}
 */
export function denoiseDefaultFor(operation, tilesOn) {
    return tilesOn ? PROMPT_CONTROL_DEFAULTS.tilesDenoise : _denoiseDefault(operation);
}

const _isValidDenoise = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;

// ── duration (MPI-820) ───────────────────────────────────────────────────────

/** Video length bounds. The PromptBox slider reads these same two, so both paths share one
 *  contract. 15, not 30 (Fabio, 2026-10-29): it is the top of H3's trained range (362
 *  frames, ~15.1 s), and anything longer is Infinite Video's job (MPI-1336), which
 *  chains short windows instead of stretching one. The cap holds on cloud models too,
 *  under whatever the provider publishes (`durationBoundsFor`). */
export const DURATION_MIN = 1;
export const DURATION_MAX = 15;

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
 * `provenance` is the record of WHICH SIDE chose each effective value (MPI-870). The agent
 * said it used "a low denoise"; the sidecar said 0.3, which is also the i2i op default, so
 * nothing on disk could tell whether it chose that or inherited it. Same for duration. It
 * describes the resolve only — the caller decides where to record it.
 *
 * @param {object|null} project
 * @param {object|null} model
 * @param {string} operation
 * @param {{ratio?, qualityTier?, turbo?, styleSelect?, stylization?}} named
 * @returns {{ok:true, injectionParams:object, width:number, height:number,
 *            provenance:Object<string,{from:'asked'|'defaulted', value:*}>}|{ok:false, code:string, message:string}}
 */
export function resolveNamedParams(project, model, operation, named = {}) {
    const { ratio, qualityTier, turbo, styleSelect, stylization, duration: durationWanted, denoise: denoiseWanted, batch, category, language, tiles, tileSize, upscaleFactor, transparent, fastMotion, boxes: askedBoxes } = named;
    const injectionParams = {};
    const modelName = model?.name || model?.id || 'this model';
    const provenance = {};
    const _from = (key, asked, value) => { provenance[key] = { from: asked ? 'asked' : 'defaulted', value }; };

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
    // FLUX.3's edit (MPI-1181): the size picker sits behind the Custom size button. A
    // named ratio or tier turns it on; unasked, the project's own button decides; off, the
    // edit follows reference 1 and no size is injected (the PromptBox parks the picker).
    const sizeGated = modelShowsCustomSize(model, operation);
    const customSize = sizeGated && (ratio !== undefined || qualityTier !== undefined
        || getOpSettings(project || {}, model?.id, operation).customSize === true);
    if (sizeGated) {
        injectionParams.Input_custom_size = customSize;
        _from('customSize', ratio !== undefined || qualityTier !== undefined, customSize);
    }
    const ratioDims = modelShowsRatio(model, operation) && (!sizeGated || customSize)
        ? resolvePlannedRatio(project, model, { ratioLabel: ratio, qualityTier })
        : { width: 0, height: 0, label: null };
    // A tier alone turned Custom size on with no size to send: unpinned (no project) nothing
    // resolves the ratio, and the edit ran at the workflow's baked 9:16 (Fabio, 2026-10-20).
    if (sizeGated && customSize && qualityTier !== undefined && !ratioDims.width) {
        return _err('INVALID_RATIO', `${modelName}'s ${operation} needs a ratio with qualityTier. Send both, or leave both out to keep the first picture's own frame.`);
    }
    if (ratioDims.width && ratioDims.height) {
        injectionParams.Width = ratioDims.width;
        injectionParams.Height = ratioDims.height;
        if (ratioDims.label) injectionParams.Ratio_Label = ratioDims.label;
        _from('ratio', ratio !== undefined, ratioDims.label || `${ratioDims.width}x${ratioDims.height}`);
        _from('qualityTier', qualityTier !== undefined, qualityTier ?? null);
    }

    const turboControlId = resolveTurboControlId(model);
    if (turbo !== undefined) {
        if (typeof turbo !== 'boolean') return _err('INVALID_TURBO', 'turbo must be a boolean.');
        if (!turboControlId) return _err('INVALID_TURBO', `${modelName} has no turbo toggle.`);
        injectionParams.Input_is_Turbo = turbo;
        _from('turbo', true, turbo);
    } else if (turboControlId) {
        const saved = getModelSettings(project || {}, model?.id)[turboControlId];
        injectionParams.Input_is_Turbo = typeof saved === 'boolean'
            ? saved
            : !!resolveThreeLayerDefault(turboControlId, model, operation, PROMPT_CONTROL_DEFAULTS[turboControlId]);
        _from('turbo', false, injectionParams.Input_is_Turbo);
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
        _from('styleSelect', styleSelect !== undefined, injectionParams['Input_Style_Selector.selector']);
        _from('stylization', stylization !== undefined, injectionParams['Input_Style_Selector.strength_model']);
    }

    // batch (MPI-876). Asked for, it runs as ONE job only where the model batches cleanly
    // (agentCanBatch), and is refused by name elsewhere so the caller queues N instead.
    // Unasked: see below.
    if (batch !== undefined) {
        if (!Number.isInteger(batch) || batch < 1 || batch > AGENT_BATCH_MAX) {
            return _err('INVALID_BATCH', `batch must be an integer 1-${AGENT_BATCH_MAX}.`);
        }
        if (batch > 1 && !agentCanBatch(model, operation)) {
            return _err('BATCH_UNSUPPORTED', `${modelName} cannot batch "${operation}" cleanly. Send separate submits instead; they queue.`);
        }
    }
    // Unasked, the PROJECT's saved number — which only a pinned run passes (MPI-1017: the
    // panel's batch is the user's); every other caller passes no project and gets 1.
    if (modelShowsBatch(model, operation)) {
        const saved = Number(getSharedSettings(project || {}, _mediaTypeOf(model)).batch);
        injectionParams.Input_Batch_Size = batch ?? (Number.isInteger(saved) && saved >= 1 && saved <= AGENT_BATCH_MAX ? saved : 1);
    }

    // duration (MPI-820). It was missing from this set entirely, so NO agent video ever
    // carried `Input_Duration` and every one ran the workflow's baked value — 2 for H3,
    // which snaps to 56 frames / 2.33 s, BELOW the 124-362 trained range. The app's own
    // slider said 5 the whole time. Same shape as turbo: explicit wins, else the project's
    // saved value, else the three-layer default.
    let duration = null;
    const components = getCommandComponents(operation);
    if (components.includes('audioLength')) {
        // Sound & Music's length (MPI-1012). Asked for as `duration`, the word anyone uses,
        // but it is the audioLength control: 1..190 s, per model, never the video slider's
        // shared 1..15. Exact, so there is nothing to report back beyond the ask.
        if (durationWanted !== undefined && !(typeof durationWanted === 'number' && Number.isFinite(durationWanted)
            && durationWanted >= AUDIO_LENGTH.min && durationWanted <= AUDIO_LENGTH.max)) {
            return _err('INVALID_DURATION', `duration must be a number of seconds between ${AUDIO_LENGTH.min} and ${AUDIO_LENGTH.max}.`);
        }
        const saved = getModelSettings(project || {}, model?.id).audioLength;
        injectionParams.Input_Duration = Math.round(durationWanted ?? (typeof saved === 'number'
            ? saved
            : resolveThreeLayerDefault('audioLength', model, operation, PROMPT_CONTROL_DEFAULTS.audioLength)));
        _from('duration', durationWanted !== undefined, injectionParams.Input_Duration);
    } else if (modelShowsDuration(model, operation)) {
        if (durationWanted !== undefined) {
            if (!isValidDuration(durationWanted)) {
                return _err('INVALID_DURATION', `duration must be a number of seconds between ${DURATION_MIN} and ${DURATION_MAX}.`);
            }
            duration = durationWanted;
        } else {
            const saved = getSharedSettings(project || {}, _mediaTypeOf(model)).duration;
            // A saved length is clamped, not dropped: a 20 saved before the cap (MPI-1349)
            // runs at 15, the same number the slider opens at, rather than at the default.
            duration = typeof saved === 'number' && Number.isFinite(saved)
                ? Math.min(DURATION_MAX, Math.max(DURATION_MIN, Math.round(saved)))
                : resolveThreeLayerDefault('duration', model, operation, PROMPT_CONTROL_DEFAULTS.duration);
        }
        injectionParams.Input_Duration = duration;
        _from('duration', durationWanted !== undefined, duration);
    } else if (durationWanted !== undefined) {
        return _err('INVALID_DURATION', `"${operation}" does not produce a clip, so it has no duration to set.`);
    }

    // showsTiles / tilesOn — computed once and shared by the denoise default (below) and
    // the tile injection block (further down). The INVALID_TILES validation stays in the
    // tile block because it only fires when `tiles` was explicitly sent; moving it here
    // would validate the named param before the rest of the named-param checks finish.
    const showsTiles = modelShowsTiles(model, operation);
    const tilesOn = showsTiles && (tiles ?? getSharedSettings(project || {}, _mediaTypeOf(model)).useTiles === true);

    // denoise (MPI-817). The same hole duration had: the PromptBox control injects
    // `{ Denoise: v }` and this function never did, so an agent run kept the workflow's BAKED
    // value while the sidecar recorded the project's slider. Same ladder: asked, else the
    // project's own value for this op, else the op's default.
    // MPI-1232: denoiseDefaultFor raises the default to 0.3 when tiles is on; the non-tile
    // path keeps 0.2 (or the op's own override). A user's saved value wins either way.
    if (modelShowsDenoise(model, operation)) {
        if (denoiseWanted !== undefined && !_isValidDenoise(denoiseWanted)) {
            return _err('INVALID_DENOISE', 'denoise must be a number between 0 and 1.');
        }
        const saved = getOpSettings(project || {}, model?.id, operation).denoise;
        injectionParams.Denoise = denoiseWanted !== undefined
            ? denoiseWanted
            : (_isValidDenoise(saved) ? saved : denoiseDefaultFor(operation, tilesOn));
        _from('denoise', denoiseWanted !== undefined, injectionParams.Denoise);
    } else if (denoiseWanted !== undefined) {
        return _err('INVALID_DENOISE', `"${operation}" has no denoise: it does not start from a picture it keeps.`);
    }

    // Use Tiles + tile params + upscale factor (MPI-1038, MPI-1232).
    // Same ladder: asked, else the project's own (tiles + tile size shared, factor per op),
    // else the default. Tiles on is the only way to 1x (detail only).
    // Input_Auto_Grid is no longer injected (MPI-1232): the app always takes the non-grid
    // USDU path when tiles is off; the grid nodes remain in the graph, baked off.
    // showsTiles / tilesOn already computed above.
    if (tiles !== undefined && (typeof tiles !== 'boolean' || !showsTiles)) {
        return _err('INVALID_TILES', showsTiles ? 'tiles must be a boolean.' : `${modelName} has no tile upscale on "${operation}".`);
    }
    if (tileSize !== undefined && (!showsTiles || !TILE_SIZES.includes(tileSize))) {
        return _err('INVALID_TILE_SIZE', showsTiles ? `tileSize must be one of: ${TILE_SIZES.join(', ')}.` : `${modelName} has no tile upscale on "${operation}".`);
    }
    if (showsTiles) {
        injectionParams.Input_Tile_Upscale = tilesOn;
        _from('tiles', tiles !== undefined, tilesOn);
        if (tilesOn) {
            const shared = getSharedSettings(project || {}, _mediaTypeOf(model));
            const tileSz = tileSize ?? (TILE_SIZES.includes(Number(shared.tileSize)) ? Number(shared.tileSize) : PROMPT_CONTROL_DEFAULTS.tileSize);
            _from('tileSize', tileSize !== undefined, tileSz);
            const tileOvlp = overlapFor(tileSz);
            const tileGuide = Math.max(1024, tileSz);
            injectionParams.Input_Tile_Size    = tileSz;
            injectionParams.Input_Tile_Overlap = tileOvlp;
            injectionParams.Input_Tile_Guide   = tileGuide;
            injectionParams.Input_Tile_Max     = Math.round(1.5 * tileGuide);
            // App-only flag: generationService names the tiles first (tileDescribe.js, MPI-1232).
            injectionParams.Tile_Describe      = shared.tileDescribe !== false;
        }
    }
    const opSaved = getOpSettings(project || {}, model?.id, operation);
    if (components.includes('upscaleFactor')) {
        const allowed = tilesOn ? [1, ...UPSCALE_FACTORS] : UPSCALE_FACTORS;
        if (upscaleFactor !== undefined && !allowed.includes(upscaleFactor)) {
            return _err('INVALID_UPSCALE_FACTOR', `upscaleFactor must be one of: ${allowed.join(', ')}${tilesOn || !showsTiles ? '' : ' (1, detail only, needs tiles: true)'}.`);
        }
        const saved = Number(opSaved.upscaleFactor);
        injectionParams.Input_Upscale_Factor = upscaleFactor ?? (allowed.includes(saved)
            ? saved
            : resolveThreeLayerDefault('upscaleFactor', model, operation, PROMPT_CONTROL_DEFAULTS.upscaleFactor));
        _from('upscaleFactor', upscaleFactor !== undefined, injectionParams.Input_Upscale_Factor);
    } else if (upscaleFactor !== undefined) {
        return _err('INVALID_UPSCALE_FACTOR', `"${operation}" has no upscale factor.`);
    }

    // No Background (MPI-1049). Same ladder as turbo: asked, else the model's saved value, else off.
    const showsTransparent = modelShowsTransparent(model, operation);
    if (transparent !== undefined && (typeof transparent !== 'boolean' || !showsTransparent)) {
        return _err('INVALID_TRANSPARENT', showsTransparent
            ? 'transparent must be a boolean.'
            : `${modelName} cannot make a transparent background on "${operation}".`);
    }
    if (showsTransparent) {
        injectionParams.Transparent_Background = transparent
            ?? getModelSettings(project || {}, model?.id).transparentBackground === true;
        _from('transparent', transparent !== undefined, injectionParams.Transparent_Background);
    }

    // Fast Motion (MPI-1285). Same ladder: asked, else the model's saved value, else off.
    const showsFastMotion = modelShowsFastMotion(model, operation);
    if (fastMotion !== undefined && (typeof fastMotion !== 'boolean' || !showsFastMotion)) {
        return _err('INVALID_FAST_MOTION', showsFastMotion
            ? 'fastMotion must be a boolean.'
            : `${modelName} has no Fast Motion on "${operation}".`);
    }
    if (showsFastMotion) {
        injectionParams.Input_Fast_Motion = fastMotion
            ?? getModelSettings(project || {}, model?.id).h3FastMotion === true;
        _from('fastMotion', fastMotion !== undefined, injectionParams.Input_Fast_Motion);
    }

    // Boxes (MPI-1181), the panel's `{ x, y, w, h, desc, name }` in fractions of the output
    // frame. Asked, else the project's saved boxes - and an agent run passes a project only
    // with the settings panel open, so unpinned the panel's boxes ride only when sent.
    const savedBoxes = askedBoxes === undefined && project && modelTakesBoxes(model, operation)
        ? getOpSettings(project, model?.id, operation).boxes : undefined;
    const boxes = Array.isArray(savedBoxes) && savedBoxes.length ? savedBoxes : askedBoxes;
    if (boxes !== undefined) {
        if (!modelTakesBoxes(model, operation)) {
            return _err('INVALID_BOXES', `${modelName} takes no boxes on "${operation}".`);
        }
        const frac = (v) => typeof v === 'number' && v >= 0 && v <= 1;
        if (!Array.isArray(boxes) || !boxes.length || boxes.some((b) => !b || !['x', 'y', 'w', 'h'].every((k) => frac(b[k])) || !b.w || !b.h)) {
            return _err('INVALID_BOXES', 'boxes must be a list of { name, x, y, w, h, desc }: x, y the top-left corner and w, h the size, each 0-1 of the output frame.');
        }
        injectionParams.Layout_Boxes = boxes.map((b) => ({ x: b.x, y: b.y, w: b.w, h: b.h, desc: String(b.desc || '').trim(), name: boxName(b.name) }));
        _from('boxes', askedBoxes !== undefined, injectionParams.Layout_Boxes.length);
    }

    // The audio models' two pickers (MPI-1012). Same ladder as turbo: asked, else the
    // model's saved value, else its default. Without them an agent run kept the graph's
    // BAKED values — Chatterbox's bake is the multilingual arm reading English.
    if (components.includes('audioCategory')) {
        const asked = category !== undefined ? audioCategoryValue(category) : null;
        if (category !== undefined && !asked) {
            return _err('INVALID_CATEGORY', `category must be one of: ${AUDIO_CATEGORIES.map(c => c.v).join(', ')}.`);
        }
        const saved = audioCategoryValue(getModelSettings(project || {}, model?.id).audioCategory);
        injectionParams.Input_Category = asked ?? saved
            ?? resolveThreeLayerDefault('audioCategory', model, operation, PROMPT_CONTROL_DEFAULTS.audioCategory);
        _from('category', category !== undefined, injectionParams.Input_Category);
    } else if (category !== undefined) {
        return _err('INVALID_CATEGORY', `${modelName} has no category on "${operation}".`);
    }
    if (components.includes('ttsLanguage')) {
        const asked = language !== undefined ? ttsLanguageValue(language) : null;
        if (language !== undefined && !asked) {
            return _err('INVALID_LANGUAGE', `language must be one of: ${TTS_LANGUAGES.map(l => l.label).join(', ')}.`);
        }
        const saved = ttsLanguageValue(getModelSettings(project || {}, model?.id).ttsLanguage);
        Object.assign(injectionParams, ttsLanguageParams(asked ?? saved
            ?? resolveThreeLayerDefault('ttsLanguage', model, operation, PROMPT_CONTROL_DEFAULTS.ttsLanguage)));
        _from('language', language !== undefined, injectionParams['Input_Language.language']);
    } else if (language !== undefined) {
        return _err('INVALID_LANGUAGE', `${modelName} has no language on "${operation}".`);
    }
    // Chatterbox's Speed + Exaggeration sliders (MPI-1012 P9). No named param: an agent run
    // speaks at the user's own setting for the model, else the default.
    // ponytail: add `speed`/`exaggeration` named params when an agent needs to pick its own.
    for (const key of Object.keys(TTS_KNOBS)) {
        if (!components.includes(key)) continue;
        const saved = getModelSettings(project || {}, model?.id)[key];
        Object.assign(injectionParams, ttsKnobParams(key, typeof saved === 'number'
            ? saved
            : resolveThreeLayerDefault(key, model, operation, PROMPT_CONTROL_DEFAULTS[key])));
    }

    return {
        ok: true,
        injectionParams,
        provenance,
        width: ratioDims.width,
        height: ratioDims.height,
        // What the run will ACTUALLY be, so a caller reports the truth rather than the
        // ask — H3 snaps to its frame grid and 2 s is really 2.33 s. Null off a clip op.
        duration: duration === null ? null : effectiveDuration(model, duration),
    };
}

// ── media (agent path) ───────────────────────────────────────────────────────

/**
 * What a media ref really is, read off its file name (a `/project-file?path=` URL or a
 * bare path). Null when the name does not say, and for a GIF, which is a picture to some
 * slots and a clip to others.
 */
function _refMediaType(url) {
    let p = String(url);
    try { p = new URL(p, 'file:///').searchParams.get('path') || p; } catch (_) { /* a bare path */ }
    if (getExtension(p) === 'gif') return null;
    return isVideoFile(p) ? 'video' : isAudioFile(p) ? 'audio' : isImageFile(p) ? 'image' : null;
}

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
 * @param {{allowEmpty?: boolean}} [opts] - `allowEmpty`: an empty required slot is not an
 *   error. A Flow the agent OPENS for the user (MPI-892) leaves it for them to fill.
 * @returns {{ok:true, mediaItems:Array}|{ok:false, code:string, message:string}}
 */
export function resolveAgentMedia(operation, model, media = [], { allowEmpty = false } = {}) {
    const slots = filterMediaInputsForModel(getCommandMediaInputs(operation), model);
    const mediaItems = [];
    for (const m of (Array.isArray(media) ? media : [])) {
        const slot = slots.find(s => s.key === m?.role);
        if (!slot) {
            return _err('BAD_REQUEST',
                `"${operation}" has no media role "${m?.role}". Roles: ${slots.map(s => s.key).join(', ') || 'none'}.`);
        }
        if (!m.url) return _err('BAD_REQUEST', `Media role "${m.role}" has no url.`);
        // The slot names the type, so a ref that contradicts it must stop here: a video
        // card sent as an edit's picture reached the cloud route as "an image", failed to
        // decode, and the user saw only "the provider could not complete" (MPI-979). A clip
        // in a picture slot normally arrives here as its first frame already (the connector
        // route, MPI-980); one that still reads as a video is a Flow's slot or a clip that
        // could not be read.
        const actual = _refMediaType(m.url);
        if (actual && actual !== slot.mediaType) {
            return _err('BAD_REQUEST', actual === 'video' && slot.mediaType === 'image'
                ? `Nothing was generated: media role "${m.role}" takes a picture, and that is a video. Ask the user to open the video, pause on the frame they want, right-click it and choose "Create snapshot". The frame lands in the gallery as a picture card; use that card.`
                : `Nothing was generated: media role "${m.role}" takes ${slot.mediaType}, and that is ${actual}.`);
        }
        if (mediaItems.some(item => item.role === slot.key)) {
            return _err('BAD_REQUEST', `Media role "${m.role}" was given twice.`);
        }
        // `seconds`: a reference clip's length, which only `/connector/quote` attaches, for its price (MPI-1017).
        mediaItems.push({ url: m.url, mediaType: slot.mediaType, role: slot.key, source: model ? 'agent' : 'flow-agent',
            ...(m.seconds > 0 ? { seconds: m.seconds } : {}) });
    }
    // Roles are explicit here, so a required slot is filled BY ROLE. The shared
    // `findMissingMediaSlot` also accepts any item of the slot's type, which suits an
    // unroled PromptBox chip; on this path it let a lone `inputImage2` through, and
    // ordinal injection then made the REFERENCE the picture being edited (caught live).
    // A `planned` slot is the app's to fill (MPI-1101), never the caller's. A slot with
    // `satisfiedBy` is also filled when that named slot is (i2v_ms: an end frame alone).
    const filled = key => mediaItems.some(item => item.role === key);
    const missing = !allowEmpty && slots.find(s => s.required !== false && !s.planned && !filled(s.key)
        && !(s.satisfiedBy && slots.some(o => o.key === s.satisfiedBy) && filled(s.satisfiedBy)));
    if (missing) {
        return _err('MEDIA_REQUIRED', `"${operation}" needs ${missing.mediaType} in its "${missing.key}" slot.`);
    }
    const order = key => slots.findIndex(s => s.key === key);
    mediaItems.sort((a, b) => order(a.role) - order(b.role));
    return { ok: true, mediaItems };
}
