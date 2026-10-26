// @ts-check
/**
 * flowPasses.js — registry of multi-pass planners (D3, MPI-1101).
 *
 * A FlowDef opts in with `passes: '<planner id>'`.  Both MpiBaseFlow and
 * agentDispatch import this module so the per-planner logic lives in ONE place.
 *
 * Planner contract
 * ────────────────
 * async planner(flow, stepValues, mediaItems, deps) → PlanResult | null
 *
 *   flow        — the FlowDef (read-only; used to find the relevant step).
 *   stepValues  — keyed by step role or field id (from `_stepValues` / field
 *                 values).  May be null when the caller has no step state
 *                 (agentDispatch's outpaint path, where it already derived the
 *                 plan externally).
 *   mediaItems  — the run's media, same shape as submitFlowGeneration takes.
 *   deps        — environment-specific helpers:
 *                   placeAsset?: async (file: File) → string | null
 *                   cropPlan?:   Array<{x,y,w,h}>   (pre-computed; skips
 *                                planCropPasses when provided)
 *                   fetch?:      window.fetch override (tests stub this)
 *
 * PlanResult
 * ──────────
 * {
 *   count:          number,           total passes (≥ 1)
 *   values?:        Object,           step values for pass 1 (Outpaint: shrunk crop)
 *   firstPassMedia?: Array<Object>,   media to use for pass 1 (Seamless: window files)
 *   runPass?:       RunPass,          pass 1's run-only data, when count > 1 or a window rides
 *   next:           async ({item}) → PassPayload | null
 * }
 *
 * RunPass (flowService's run-only `runPass` input; never reaches the sidecar)
 * { index, count, seamless?: { runId, i }, replaceItemId? }
 *
 * PassPayload (returned by `next` after each pass completes)
 * ──────────────────────────────────────────────────────────
 * {
 *   media:       Array<Object>,   media for the next pass
 *   last:        boolean,         true when this IS the final pass
 *   runPass:     RunPass,         the next pass's i/N (+ Seamless's window and version to replace)
 * }
 *
 * Pass-index stamping
 * ───────────────────
 * flowService.submitFlowGeneration reads `runPass` and stamps
 * `config.flowStep = "i/N"` so the status bar counts the passes. The first
 * submission carries the PlanResult's `runPass`; later ones the PassPayload's.
 */

import { planCropPasses, composeNextPass } from '../components/Organisms/MpiStepCrop/MpiStepCrop.js';
import { edgesFor } from '../components/Organisms/MpiStepEdges/MpiStepEdges.js';
import { extractAbsPath } from './mediaActions.js';

// ── Planner registry ────────────────────────────────────────────────────────

/** @type {Record<string, Function>} */
const PLANNERS = {};

/**
 * Register a planner under `id`.
 * @param {string} id
 * @param {Function} fn
 */
export function registerPlanner(id, fn) {
    PLANNERS[id] = fn;
}

/**
 * Look up a planner by id.  Returns null when not found.
 * @param {string|undefined} id
 * @returns {Function|null}
 */
export function getPlanner(id) {
    return (id && PLANNERS[id]) || null;
}

// ── Shared helpers ──────────────────────────────────────────────────────────

/**
 * Build the `next` callback shared by any compositing-style multi-pass planner
 * (Outpaint).  Each pass result is composited onto the next frame with
 * `composeNextPass`, placed in the project, and the updated media array is
 * returned together with pass-index metadata for the status bar.
 *
 * @param {Array<{x:number,y:number,w:number,h:number}>} plan  pass frames in source px
 * @param {Array<Object>} mediaItems  the run's full media array
 * @param {Object} source             the item in mediaItems that gets replaced each pass
 * @param {Function} placeAsset       async (file: File) → string | null
 * @returns {{ count: number, runPass: {index: number, count: number}|null, next: (r?: {item?: Object}) => Promise<*> }}
 */
export function buildCropPassNext(plan, mediaItems, source, placeAsset) {
    let ran = 0;
    const count = plan.length;
    return {
        count,
        runPass: count > 1 ? { index: 1, count } : null,
        next: async ({ item } = {}) => {
            const file = await composeNextPass(item, plan[ran], plan[ran + 1]);
            ran += 1;
            const url = file ? await placeAsset(file) : null;
            if (!url) return null;
            return {
                media: mediaItems.map(m => (m === source ? { ...m, url, filePath: url } : m)),
                last: ran === count - 1,
                runPass: { index: ran + 1, count },
            };
        },
    };
}

// ── Outpaint planner ────────────────────────────────────────────────────────
//
// When `deps.cropPlan` is provided (agentDispatch already computed it), the
// planner skips `planCropPasses` (which loads the image via the browser).
// `values` is only meaningful for MpiBaseFlow's `_deriveRunMedia`; agentDispatch
// derives pass 1's padded image itself before calling the planner.

async function _outpaintPlanner(flow, stepValues, mediaItems, deps) {
    const step = (flow?.steps || []).find(s => s.kind === 'crop' && s.role && s.maxGrow);
    if (!step) return null;

    const source = mediaItems.find(m => m?.role === step.role);
    const plan = deps?.cropPlan != null
        ? deps.cropPlan
        : (source ? await planCropPasses(source, stepValues?.[step.role]?.crop, step.maxGrow) : null);
    if (!plan || !plan.length) return null;

    const firstPassValues = stepValues
        ? { ...stepValues, [step.role]: { ...(stepValues[step.role] || {}), crop: plan[0] } }
        : undefined;

    const { count, runPass, next } = buildCropPassNext(plan, mediaItems, source, deps.placeAsset);
    return { count, runPass, values: firstPassValues, next };
}

registerPlanner('outpaint', _outpaintPlanner);
// Also register by the built-in operation id so FlowDefs need no `passes` key.
registerPlanner('flowOutpaint', _outpaintPlanner);

// ── Seamless planner ────────────────────────────────────────────────────────
//
// Called after the source image is staged (has a filePath).  Calls
// /seamless/prepare to plan the window grid, then fetches each window's
// cut image + mask from /seamless/window, delivering them as `image1` / `mask`
// roles.  Each pass's `runPass.seamless` tells commandExecutor which window it
// pastes back (D2, `pastesToWorkingCopy`).

async function _seamlessWindowMedia(fetchFn, runId, i) {
    const res = await fetchFn('/seamless/window', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId, i }),
    });
    if (!res.ok) return null;
    return res.json();
}

async function _seamlessPlanner(flow, stepValues, mediaItems, deps) {
    const source = mediaItems.find(m => m?.role === 'image1');
    // The server reads a DISK path; a slot's media is usually a `/project-file?path=` URL.
    const raw = source?.filePath || source?.url;
    const sourcePath = extractAbsPath(raw) || raw;
    // A planning Flow never falls back to ONE pass on the whole picture (a different, wrong
    // result): every failure here refuses the run, with words the Flow screen shows.
    const fail = (why) => {
        throw Object.assign(new Error(why), { userMessage: `${flow?.title || 'Make seamless'} ${why} Nothing was generated.` });
    };
    if (!sourcePath) fail('needs a picture: add one on the first step.');

    // The gizmo's value is stored by role; the Flow's own fields (`direction`, `lightingFlatten`)
    // arrive flat on both paths (the Flow screen merges `_fieldValues` in, the agent sends them flat).
    const edgesStep = (flow?.steps || []).find(s => s.kind === 'edges');
    const edgesValue = edgesStep ? stepValues?.[edgesStep.role] : null;
    const handles = edgesFor(edgesValue, stepValues?.direction);
    const lightingFlatten = stepValues?.lightingFlatten ?? 0;

    const fetchFn = deps?.fetch || globalThis.fetch;

    // ── prepare: plan the window grid ──────────────────────────────────────
    const prepRes = await fetchFn('/seamless/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourcePath, handles, lightingFlatten }),
    });
    const prepared = prepRes.ok ? await prepRes.json() : null;
    if (!prepared?.ok) fail('could not prepare the picture.');
    if (!prepared.windows?.length) fail('has no edge to join: drag at least one handle in from an edge.');

    const { runId } = prepared;
    const count = prepared.windows.length;

    // ── window 0: media for pass 1 ─────────────────────────────────────────
    const win0 = await _seamlessWindowMedia(fetchFn, runId, 0);
    if (!win0?.ok) fail('could not cut the first window of the picture.');

    const _makeMedia = (win) => [
        ...mediaItems.filter(m => m !== source && m?.role !== 'mask'),
        { ...source, url: win.image, filePath: win.image, role: 'image1' },
        { url: win.mask, filePath: win.mask, mediaType: 'image', role: 'mask' },
    ];
    // Each pass's content line is described from its own window (`everyPass`, flowService).
    const firstPassMedia = _makeMedia(win0);

    let served = 0; // index of the last window we have already served
    return {
        count,
        values: stepValues,
        firstPassMedia,
        // Every window, pass 1 included, pastes into the run's working copy (D2): commandExecutor
        // lands the whole picture as it stands, and each later window REPLACES that version.
        runPass: { index: 1, count, seamless: { runId, i: 0 } },
        next: async (/** @type {{item?: Object}} */ { item } = {}) => {
            served += 1;
            if (served >= count) return null;

            const win = await _seamlessWindowMedia(fetchFn, runId, served);
            if (!win?.ok) return null;

            return {
                media: _makeMedia(win),
                last: served === count - 1,
                runPass: { index: served + 1, count, seamless: { runId, i: served }, replaceItemId: item?.id },
            };
        },
    };
}

registerPlanner('seamless', _seamlessPlanner);
registerPlanner('flowMakeSeamless', _seamlessPlanner);
