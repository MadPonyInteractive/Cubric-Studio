/**
 * agentDispatch.js — renderer end of the agent generation relay (MPI-546).
 *
 * Dispatch lives here, in the renderer, and cannot move: `generationService`
 * imports `MpiToast` and `PromptBoxControls`, `commandExecutor` pulls `state`,
 * `Events` and `downloadService`. So an agent's `POST /connector/generate` is
 * relayed to this listener over an always-on SSE stream, dispatched through the
 * normal queue, and its outcome POSTed back.
 *
 * This module is the DISPOSABLE half of MPI-546 — the HTTP route is the contract.
 * Keep it dumb: one job in, one result out. Anything richer (media staging, job
 * status, cancellation) belongs server-side in `routes/connector.js`, where it
 * survives dispatch ever being extracted out of the renderer.
 *
 * It is a THIRD producer into the generation queue, after the Gallery/History
 * blocks and `flowService` — and like flowService it goes THROUGH
 * `enqueueGeneration`, never around it, so the dispatch guards and the lane/store
 * contract hold exactly as they do for a Cue press.
 *
 * MPI-592 adds a second capability, `project.open`, for the same reason dispatch
 * is here: `openProject` reconciles and hydrates through the renderer's state.
 * A submit runs in `state.currentProject` and nothing server-side can change it,
 * so without this an agent that created a project generated into the PREVIOUS
 * one — successfully, with `ok: true`, into the wrong gallery.
 *
 * MPI-776 adds `card.rename`, and `cardName` on a submit, for the same reason: while
 * a project is open this renderer owns its `itemGroups` and `persistGroups` writes the
 * whole array back on every mutation, so an agent that edits `project.json` directly
 * is silently overwritten on the next save.
 *
 * MPI-547 adds the v1 named params (ratio/qualityTier/turbo/styleSelect/
 * stylization/seed; batch is pinned to 1) — resolved through `js/data/generationControls.js`,
 * NOT reimplemented here. That module is DOM-free and also runs server-side
 * (`routes/connector.js`'s static validation), so this file's only job is
 * calling it with the real `state.currentProject`.
 *
 * MPI-774 adds agent capabilities: `agent.list-models`, `agent.install-model`,
 * `agent.describe`. These build on renderer-only state (install status, plugin
 * availability) and the existing download / enqueue paths, so they live here.
 */

import { enqueueGeneration, findMissingMediaSlot, cancelPendingCueJob, cancelRunningCueJob } from '../services/generationService.js';
import { submitFlowGeneration } from '../services/flowService.js';
import { openProject, renameGroup, markGroup } from '../services/projectService.js';
import { CARD_MARKS, markOf, matchesGallerySort, byGalleryOrder, describeGalleryFilter, isGalleryFiltered } from '../utils/galleryFilter.js';
import { navigate, PAGE_GALLERY } from '../router.js';
import { MODELS, getModelById, isOperationInstalled, getModelDepStatus } from '../data/modelRegistry.js';
import { DEPS } from '../data/modelConstants/dependencies.js';
import { resolveFullUniverse } from '../data/modelConstants/resolveModelDeps.js';
import { sizeToGb } from '../data/modelConstants/footprint.js';
import { getFlowById, listFlows, flowAvailability } from '../data/flowsRegistry.js';
import { resolveFlowFieldValues, flowDeclaredFields, agentFieldSpecs } from '../utils/declaredFields.js';
import { getCommand } from '../data/commandRegistry.js';
import { resolveNamedParams, isValidSeed, resolveAgentMedia, namedParamsFor } from '../data/generationControls.js';
import { resolveActiveModel } from '../utils/modelHelpers.js';
import { CROP_RATIOS } from '../utils/ratios.js';
import { resolveMediaUrl } from '../utils/mediaActions.js';
import { stepValueToMedia } from '../components/Blocks/MpiBaseFlow/stepKinds.js';
import { describeImage } from '../services/llmService.js';
import { downloadService } from '../services/downloadService.js';
import { remoteEngineClient } from '../services/remoteEngineClient.js';
import { state } from '../state.js';
import { runGifJob, GIF_HANDLERS } from './gifJobs.js';
import { clientLogger } from '../services/clientLogger.js';

let _source = null;
/** Job ids already reported — the "one result out" half of the contract. */
const _settled = new Set();
/**
 * Submit job id -> its Cue queue id, while it is in flight. The one thing `generation.cancel`
 * needs: the queue's own cancel functions take a queueJobId, and only this file knows which
 * one a relayed job became. Dropped the moment the job reports.
 */
const _queueJobs = new Map();

/** POST a job's outcome back. Late/duplicate reports are dropped here and no-op'd server-side. */
async function _report(jobId, payload) {
    if (_settled.has(jobId)) return;
    _settled.add(jobId);
    _queueJobs.delete(jobId);
    try {
        await fetch(`/connector/jobs/${jobId}/result`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    } catch (err) {
        clientLogger.error('connector', `Failed to report job ${jobId}`, err);
    }
}

const _fail = (jobId, code, message) => _report(jobId, { ok: false, error: { code, message } });

/**
 * Report a finished generation. A `cardName` (MPI-776) is applied first, through the
 * same `renameGroup` the rename route uses, so the reply describes the named card.
 * The gallery path awaits `addGroup` before it calls `onComplete`, so the card is
 * already in the project here.
 */
async function _reportDone(jobId, { item, group }, cardName, duration = null, modelId = null) {
    const named = cardName !== undefined && group?.id ? await renameGroup(group.id, cardName) : null;
    return _report(jobId, {
        ok: true,
        output: {
            itemId: item?.id,
            groupId: group?.id,
            type: item?.type,
            filePath: item?.filePath,
            // MPI-817: which model made this. The agent lists every image it can look at
            // and `look` reads pixels, so without this it has no way to tell one card's
            // origin from another's — and it does not know that it cannot. Live, 2026-09-19:
            // Fabio pinned Krea 2 after two ILL Anime runs and asked for a cartoon; the
            // agent looked at the ill-anime image, called it "the Krea 2 result", and
            // therefore generated nothing. The sidecars said `modelId: ill-anime`.
            modelId,
            seed: item?.seed,
            pixelDimensions: item?.pixelDimensions,
            generationMs: item?.generationMs,
            // MPI-820: what the clip REALLY is, not what was asked for. H3 can only land
            // on a 17k+5 frame grid, so a 6 s ask is 141 frames = 5.875 s — and a caller
            // that repeats the ask tells the user a number the file does not have.
            ...(duration ? { durationSeconds: duration.seconds, ...(duration.frames ? { frames: duration.frames } : {}) } : {}),
            ...(named ? { cardName: named.customName } : {}),
        },
    });
}

/**
 * The model the pinned panel is showing — the one the user picked, per mediaType, the
 * way MpiGalleryBlock resolves it. Exported so the App state line can name it to the
 * agent: while pinned the agent still WRITES the prompt, and the Guide rule makes it
 * adapt that prompt to the model's own structure and vocabulary, so a pinned Klein told
 * nothing gets a Krea2-shaped prompt and a worse image than either party intended.
 */
export function pinnedModel() {
    const type = state.s_lastSelectedMediaType === 'video' ? 'video' : 'image';
    return resolveActiveModel(type).model;
}

/**
 * The pinned gate (MPI-774 Phase 7, Fabio 2026-09-19). One boolean decides who owns the
 * model and the settings of an agent-dispatched generation; the agent keeps the prompt,
 * the media, the op and the card name either way.
 *
 * Enforcement is HERE, in code, and never a prompt rule: a prompt rule can be ignored, a
 * dropped field cannot. Fabio has now rejected a prompt-rule answer to this twice.
 *
 * PINNED (cog open) — the user's model, and the project's saved buckets, which is exactly
 * what the open panel is showing them. The agent's own named params are dropped.
 *
 * NOT PINNED (cog shut) — the agent's model and params, and `project: null`. That null is
 * the whole of the "model defaults" half, and it is not decoration:
 * `resolveEffectiveQualityTier` resolves an unset tier against the PROJECT'S SAVED BUCKET
 * first, so a project where 2k was once chosen would keep feeding 2k to every agent
 * generation forever — the same stale contamination the panel exists to kill, arriving
 * through the project record instead of the visible panel. With no project, every unset
 * param falls to the model's own default (and an unset ratio to the workflow's baked one).
 *
 * @param {object} input        the `generation.submit` body
 * @param {boolean} pinned      state.agentSettingsPinned
 * @param {object|null} project state.currentProject
 * @param {object|null} pinnedM the model the panel is showing, when pinned
 * @returns {{model:object|null, project:object|null, named:object, error?:{code:string,message:string}}}
 */
export function resolveSettingsOwner(input = {}, pinned, project, pinnedM) {
    const { modelId, ratio, qualityTier, turbo, styleSelect, stylization, duration } = input;
    if (!pinned) {
        return {
            model: getModelById(modelId),
            project: null,
            named: { ratio, qualityTier, turbo, styleSelect, stylization, duration },
        };
    }
    if (!pinnedM) {
        return { model: null, project, named: {}, error: { code: 'NO_PINNED_MODEL',
            message: 'The settings panel is open, so the user owns the model — but no model is selected. Ask them to pick one, or to close the panel and let you choose.' } };
    }
    // Deliberately a REFUSAL, not a silent swap. Dropping a mismatched modelId would run
    // the user's model under the agent's narration — "making this with Krea2" while Klein
    // ran — which is the same class of lie as the `{ started: true }` this phase killed.
    // The agent is told the pinned model in the App state line, so a mismatch is its error
    // to fix, and a concrete tool result beats a prompt rule (MPI-774, proven three times).
    if (modelId && modelId !== pinnedM.id) {
        return { model: null, project, named: {}, error: { code: 'MODEL_PINNED',
            message: `Nothing was generated: the user has the settings panel open, so they own the model — it is "${pinnedM.id}" (${pinnedM.name}), not "${modelId}". Send this again with modelId "${pinnedM.id}", writing the prompt for that model. If it cannot do what was asked, say so and ask them to select a different one; you cannot change it.` } };
    }
    return { model: pinnedM, project, named: {} };
}

/**
 * Run one `generation.submit` job. Every exit path reports exactly once — an
 * unreported job leaves the caller's HTTP request hanging until the route's
 * timeout, which reads as a dead app.
 */
function _submitGeneration(jobId, input = {}) {
    // A Flow is an OPERATION with no model (`model.id: null`), so it can never
    // arrive as a modelId and needs its own resolution. One capability either way:
    // the caller asks for a generation, and `flowId` is what says which kind.
    if (input.flowId) return _submitFlow(jobId, input);

    const {
        modelId, operation, positive = '', negative = '', injectionParams = {}, media = [], seed,
    } = input;

    if (!state.currentProject) {
        return _fail(jobId, 'NO_PROJECT', 'No project is open in Vision. Create or open one, then send this request again.');
    }

    // Who owns the model and the settings — see resolveSettingsOwner. `owner.project` is
    // NOT always state.currentProject: unpinned it is null on purpose, so the resolve
    // below lands on model defaults instead of the project's saved bucket.
    const pinned = state.agentSettingsPinned === true;
    const owner = resolveSettingsOwner(input, pinned, state.currentProject, pinned ? pinnedModel() : null);
    if (owner.error) {
        return _fail(jobId, owner.error.code, owner.error.message);
    }

    const model = owner.model;
    if (!model) {
        return _fail(jobId, 'UNKNOWN_MODEL', `No model with id "${modelId}".`);
    }

    // Covers BOTH halves in one call: the op must be in supportedOps and its
    // weights must be on disk for the effective engine. Checked here so the agent
    // gets a named reason — commandExecutor's own net bails with a toast it cannot see.
    if (!isOperationInstalled(model, operation)) {
        // While pinned the agent cannot answer this by switching models, so the refusal
        // says what it CAN do instead: tell the user (Fabio's own example — "that makes
        // video, it doesn't make images, you need to select another model").
        return _fail(jobId, 'OP_UNAVAILABLE', pinned
            ? `"${operation}" is not available on ${model.name || model.id} — unsupported, or its weights are not installed. The user has the settings panel open, so that model is theirs and you cannot change it: tell them this model cannot do it and ask them to select one that can.`
            : `"${operation}" is not available on ${model.name || modelId} — unsupported, or its weights are not installed.`);
    }

    // A painted mask has no agent form. Refused by name: the enqueue guard would toast
    // and cancel instead, which reaches the agent as a bare CANCELLED it can't act on.
    if (getCommand(operation)?.requiresMask) {
        return _fail(jobId, 'MASK_UNSUPPORTED',
            `"${operation}" needs a painted mask, which this endpoint cannot supply.`);
    }

    // MPI-765: media by reference, resolved exactly as the Flow branch resolves it.
    // Checked here for the same reason as the op: the enqueue guard's refusal is a toast.
    const resolvedMedia = resolveAgentMedia(operation, model, media);
    if (!resolvedMedia.ok) {
        return _fail(jobId, resolvedMedia.code, resolvedMedia.message);
    }
    const { mediaItems } = resolvedMedia;

    if (seed !== undefined && !isValidSeed(seed)) {
        return _fail(jobId, 'INVALID_SEED', 'seed must be an integer between 0 and 4294967295.');
    }

    // MPI-547 — the v1 named params (ratio/qualityTier/turbo/styleSelect/stylization/
    // batch pinned to 1). `routes/connector.js` already ran the same static validation with no
    // project (see generationControls.js's own comment).
    //
    // MPI-774 Phase 7 made WHICH project this resolves against the gate itself. Pinned, it
    // is the open project, so an unset param lands on what the panel is showing the user.
    // Unpinned it is `null`, so an unset param lands on the MODEL's default instead of a
    // bucket some earlier session saved — see resolveSettingsOwner for why that is the
    // whole point rather than a detail.
    const named = resolveNamedParams(owner.project, model, operation, owner.named);
    if (!named.ok) {
        return _fail(jobId, named.code, named.message);
    }

    // Raw injectionParams is the documented escape hatch and always wins over the
    // resolved named values (plan.md decision #3).
    const mergedInjection = { ...named.injectionParams, ...injectionParams };
    const width = mergedInjection.Width || 0;
    const height = mergedInjection.Height || 0;

    const config = {
        operation,
        model,
        positive,
        negative,
        mediaItems,
        // Explicit only — an unset seed must stay random, never pinned to 0.
        ...(seed !== undefined ? { seed } : {}),
        injectionParams: mergedInjection,
    };

    // A gallery gen MUST carry a tempId + placeholderGroup or the run is invisible
    // until it finishes: MpiGalleryBlock draws in-progress cards from the
    // activeGenerations entry's `placeholderGroup`, and live latents route by
    // tempId (preview:frame -> activeGenerations.byPromptId -> entry.tempId).
    // Without them an agent submit ran for its full duration behind an empty
    // gallery, then the card appeared at the end — the Cue panel was the only
    // sign anything was happening. Same shape the Cue path builds; `Generating...`
    // is the name the grid renders while `isGenerating` is true.
    const tempId = crypto.randomUUID();
    const placeholderGroup = {
        id: tempId,
        type: model.mediaType || 'image',
        name: 'Generating...',
        history: [],
        selectedIndex: 0,
        width,
        height,
        isGenerating: true,
    };

    const queued = enqueueGeneration(config, {
        onComplete: (done) => _reportDone(jobId, done, input.cardName, named.duration, model.id),
        // An `outputKind: 'text'` op produces a caption and no item (MPI-310).
        onText: (text) => _report(jobId, { ok: true, output: { text } }),
        onError: () => _fail(jobId, 'RUNTIME_ERROR',
            'The generation failed. See the app log for the cause.'),
        onCancel: () => _fail(jobId, 'CANCELLED',
            'The generation was cancelled or produced no output.'),
    }, { scope: 'gallery', tempId, placeholderGroup });

    // A guard inside enqueueGeneration rejects by returning null — it fires
    // onCancel on its way out, so the report is already in flight. Belt and braces
    // for a future guard that returns null silently.
    if (!queued) {
        return _fail(jobId, 'REJECTED', 'Vision rejected the job before it entered the queue.');
    }
    if (!_settled.has(jobId)) _queueJobs.set(jobId, queued.queueJobId);
    return null;
}

/**
 * Run one `generation.submit` job that named a `flowId`.
 *
 * The declared-field vocabulary is read through `resolveFlowFieldValues`, the same
 * module the flow frame renders from — routing each id by the `Input_` law, applying
 * any hidden `mapTo`, and computing `derived` after the caller's overrides. Reading
 * it any other way here would be a second implementation of the dialect, which is
 * exactly what `declaredFields.js` exists to prevent (MPI-580).
 *
 * MEDIA IS BY REFERENCE, never bytes. The caller stages its own file through
 * `POST /project-media/:id/place-preview-asset` (which takes a plain absolute
 * path) and passes back the `/project-file?path=…` url it returns, so an agent's
 * audio lands in the same content-addressed store a dropped file does.
 */

/**
 * Every shape the crop gizmo offers, both orientations, deduped and in the gizmo's own
 * order. The agent picks a LABEL from this list rather than inventing one, and the label
 * is the same string the user sees on the ratio bar.
 */
export const CROP_RATIO_LABELS = [...new Set(
    [...(CROP_RATIOS.portrait || []), ...(CROP_RATIOS.landscape || [])].map(r => r.label),
)];

/** A crop-gizmo label → its numeric aspect, or null. `1:1.85` and `1:2.39` are why this
 *  reads the table instead of parsing the string: those are already numbers there. */
function _cropRatioValue(label) {
    const want = String(label ?? '').trim();
    const row = [...(CROP_RATIOS.portrait || []), ...(CROP_RATIOS.landscape || [])]
        .find(r => r.label === want);
    return row ? row.ratio : null;
}

/**
 * The rect the outpaint frame becomes: the source centred inside the target shape, grown
 * on the two edges that shape needs and no others. In the SOURCE's own pixels, and
 * deliberately allowed to go negative — `composePaddedImage` draws at `-x, -y`, so a rect
 * that starts off-canvas simply insets the picture and the overhang is what gets painted.
 *
 * @param {{w:number,h:number}} natural  the source image's real pixels
 * @param {number} ratio                 target aspect, w/h
 * @returns {{x:number,y:number,w:number,h:number}}
 */
export function frameRectForRatio(natural, ratio) {
    const { w: nw, h: nh } = natural;
    let w = nw;
    let h = nh;
    if (ratio < nw / nh) h = Math.round(nw / ratio);  // taller than the source → grow top+bottom
    else if (ratio > nw / nh) w = Math.round(nh * ratio); // wider → grow left+right
    return { x: Math.round((nw - w) / 2), y: Math.round((nh - h) / 2), w, h };
}

/** An image url's real pixels. Rejects rather than resolving a guess — the rect is built
 *  from this, and a wrong size pads the wrong edges. */
function _naturalSize(url) {
    return new Promise((resolve, reject) => {
        const im = new Image();
        im.onload = () => resolve({ w: im.naturalWidth || im.width, h: im.naturalHeight || im.height });
        im.onerror = () => reject(new Error('The image could not be read.'));
        im.src = resolveMediaUrl(url);
    });
}

/**
 * Put a derived File in the project's content-addressed preview-asset store and return its
 * `/project-file` url, or null. The same store a dropped file lands in, so it dedupes by
 * sha256 and Cleanup GCs it.
 *
 * ponytail: MpiBaseFlow has the same fetch as a closure inside its setup. Left duplicated
 * rather than lifted — that file is a Flow-frame hot spot with live work on it, and this is
 * a dozen lines. Lift both into a util the day a third caller appears.
 */
async function _placePreviewAsset(file, project) {
    const dataUrl = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(/** @type {string} */ (r.result));
        r.onerror = reject;
        r.readAsDataURL(file);
    });
    const res = await fetch(
        `/project-media/${project.id}/place-preview-asset?folderPath=${encodeURIComponent(project.folderPath)}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dataUrl, ext: '.png' }) },
    );
    if (!res.ok) throw new Error(`place failed: ${res.status}`);
    const data = await res.json();
    return data?.success ? data.filePath : null;
}

async function _submitFlow(jobId, input = {}) {
    const { flowId, fields = {}, media = [], params = {} } = input;

    if (!state.currentProject) {
        return _fail(jobId, 'NO_PROJECT', 'No project is open in Vision. Create or open one, then send this request again.');
    }

    const flow = getFlowById(flowId);
    if (!flow) {
        return _fail(jobId, 'UNKNOWN_FLOW', `No flow with id "${flowId}".`);
    }

    // submitFlowGeneration pre-flights this itself, but it reports through a TOAST
    // and returns a bare null — an agent sees neither. Ask the same question here
    // so the weights that are missing come back BY NAME.
    const availability = flowAvailability(flow);
    if (!availability.available) {
        const absent = [...(availability.missing || []), ...(availability.missingDeps || [])];
        return _fail(jobId, 'OP_UNAVAILABLE',
            `${flow.title} is not installed — missing: ${absent.join(', ') || 'required files'}.`);
    }

    // The op owns the slot vocabulary; the caller names a role. One resolver for both
    // branches (generationControls.js § resolveAgentMedia).
    const resolvedMedia = resolveAgentMedia(flow.operation, null, media);
    if (!resolvedMedia.ok) {
        return _fail(jobId, resolvedMedia.code, resolvedMedia.message);
    }
    const { mediaItems } = resolvedMedia;

    // The SHARED predicate, not a copy — three guards answering "is a required slot
    // empty?" must never be able to disagree (generationService § findMissingMediaSlot).
    // Text to Speech is the case that matters: its `audio1` is required because the
    // graph's MpiLoadAudio carries `block_if_empty`, and without this the run comes
    // back a SUCCESS with no output.
    const missingSlot = findMissingMediaSlot(flow.operation, mediaItems);
    if (missingSlot) {
        return _fail(jobId, 'MEDIA_REQUIRED',
            `${flow.title} needs ${missingSlot.mediaType} in its "${missingSlot.key}" slot.`);
    }

    // Validate and merge box `params` (MPI-774). Each key in `params` must name
    // a step with `kind: 'box'` and a matching `param` id; the box values are
    // integers; ratio:1 steps require a square box; bounds are checked unless the
    // step declares `overflow: 'allow'` or image dimensions are unavailable.
    const boxParamValidation = validateBoxParams(flow, params);
    if (!boxParamValidation.ok) {
        return _fail(jobId, boxParamValidation.code, boxParamValidation.message);
    }

    // ── The frame (MPI-817) ───────────────────────────────────────────────────
    //
    // A `crop` step is the flow's whole subject and has no `param`: its value becomes a
    // PADDED PICTURE, black where the new area goes, and the graph loads that one image.
    // The UI derives it in `_deriveRunMedia`; this path did not derive it at all, so the
    // agent's run went out with the user's own unpadded picture — nothing to paint, and a
    // result the same shape as the input that read as "the model ignored me".
    //
    // REFUSING an absent frame is the point, not the derivation. Running was never a
    // neutral fallback: it burns a minute of GPU and reports success on a no-op.
    //
    // A RATIO, not a rect. The model names the shape it wants and the arithmetic happens
    // here — the same reason `BOX_NOT_MEASURED` exists a few lines up.
    const cropStep = (flow.steps || []).find(s => s.kind === 'crop' && s.role);
    if (cropStep) {
        const label = params.frame?.ratio;
        const ratio = _cropRatioValue(label);
        if (!ratio) {
            return _fail(jobId, 'FRAME_REQUIRED',
                `Nothing was generated: ${flow.title} grows a picture past its edges, so it needs the shape you want it to become — ${label ? `"${label}" is not one it offers` : 'your call passed none'}. Send it again with params: { frame: { ratio: "<one of these>" } }: ${CROP_RATIO_LABELS.join(', ')}.`);
        }

        const source = mediaItems.find(m => m?.role === cropStep.role);
        if (!source?.url) {
            return _fail(jobId, 'MEDIA_REQUIRED',
                `${flow.title} needs an image in its "${cropStep.role}" slot to grow.`);
        }

        let padded = null;
        try {
            const natural = await _naturalSize(source.url);
            const rect = frameRectForRatio(natural, ratio);
            // `composePaddedImage` returns null for a rect that matches the source exactly.
            // That is this flow doing nothing, so say so rather than spending a generation
            // to hand back a re-render of what the user already has.
            const file = await stepValueToMedia(cropStep.kind, { crop: rect }, source, cropStep, null);
            if (!file) {
                return _fail(jobId, 'FRAME_UNCHANGED',
                    `Nothing was generated: that picture is already ${label} (${natural.w}x${natural.h}), so there is nothing to grow. Pick a different shape, or tell the user it is already the one they asked for.`);
            }
            padded = await _placePreviewAsset(file, state.currentProject);
        } catch (err) {
            clientLogger.error('connector', 'agent frame derivation failed', err);
            return _fail(jobId, 'RUNTIME_ERROR', `The frame could not be built: ${err.message}`);
        }
        if (!padded) {
            return _fail(jobId, 'RUNTIME_ERROR', 'The framed image could not be stored in the project.');
        }
        // A padded picture REPLACES the picture it padded (stepKinds.js § STEP_MEDIA);
        // `crop` is deliberately not one of the kinds that delivers to a second role.
        source.url = padded;
        source.filePath = padded;
    }

    const { inputs, injectionParams: fieldInjection, unknown } = resolveFlowFieldValues(flow, fields);
    if (unknown.length) {
        const known = flowDeclaredFields(flow).map(f => f.id).join(', ');
        return _fail(jobId, 'BAD_REQUEST',
            `${flow.title} declares no field ${unknown.map(k => `"${k}"`).join(', ')}. Fields: ${known || 'none'}.`);
    }

    // Merge box params into injectionParams: each box key becomes its Input_ title
    // exactly as the workflow expects (agentDispatch._buildParams does the rename,
    // but flow submissions go through submitFlowGeneration directly, so inject with
    // the `Input_` prefix — matching the node titles the flow declares).
    const boxInjection = {};
    const boxSteps = (flow.steps || []).filter(s => s.kind === 'box' && s.param);
    for (const [key, val] of Object.entries(params)) {
        const step = boxSteps.find(s => s.param === key);
        if (step) {
            // Find the matching Input_Box node title from the workflow:
            // Head Swap uses Input_Box and Input_Box_2. The step's `role` correlates
            // to image1→Input_Box, image2→Input_Box_2, but future flows may differ.
            // Safest: pass through with the key as-is and let commandExecutor's rename
            // pass (box1→Input_Box, box2→Input_Box_2). Values match MpiBox shape.
            boxInjection[key] = val;
        }
    }

    const injectionParams = { ...fieldInjection, ...boxInjection };

    const queued = submitFlowGeneration(flow, {
        ...inputs,
        mediaItems,
        ...(Object.keys(injectionParams).length ? { injectionParams } : {}),
    }, {
        onComplete: (done) => _reportDone(jobId, done, input.cardName),
        onText: (text) => _report(jobId, { ok: true, output: { text } }),
        onError: () => _fail(jobId, 'RUNTIME_ERROR',
            'The generation failed. See the app log for the cause.'),
        onCancel: () => _fail(jobId, 'CANCELLED',
            'The generation was cancelled or produced no output.'),
    });

    if (!queued) {
        return _fail(jobId, 'REJECTED', 'Vision rejected the job before it entered the queue.');
    }
    // ponytail: a two-leg flow's second leg enqueues under a NEW queue id, so a cancel that
    // arrives during leg 2 answers NOT_IN_FLIGHT. Thread the leg's id back if that bites.
    if (!_settled.has(jobId)) _queueJobs.set(jobId, queued.queueJobId);
    return null;
}

/**
 * Run one `project.open` job — the same pair of calls every project row in
 * `projectUI.js` makes, because opening a project IS `openProject` + navigate.
 * `openProject` needs only `folderPath`; it migrates, reconciles and hydrates the
 * record itself, so a stale or partial one from the caller cannot get in.
 *
 * No guard against switching mid-generation: the landing rows have none either,
 * and inventing one here would make the agent path stricter than the click.
 */
async function _openProject(jobId, input = {}) {
    const { folderPath } = input;
    if (!folderPath) {
        return _fail(jobId, 'BAD_REQUEST', 'No folderPath given.');
    }
    try {
        await openProject({ folderPath });
    } catch (err) {
        return _fail(jobId, 'NO_SUCH_PROJECT',
            `Could not open "${folderPath}": ${err?.message || 'unknown error'}.`);
    }
    navigate(PAGE_GALLERY);
    // Only the AGENT reaches this path, and it just moved the user to a project they did
    // not click. Leaving the box in Prompt mode drops them somewhere new with the
    // conversation that brought them here hidden — the agent keeps talking into a panel
    // they cannot see (Fabio, 2026-09-19). The PromptBox toggle follows this state, so
    // setting it is the whole fix.
    state.agentMode = true;
    return _report(jobId, {
        ok: true,
        output: {
            folderPath: state.currentProject?.folderPath,
            name: state.currentProject?.name,
            groupCount: state.currentProject?.itemGroups?.length ?? 0,
        },
    });
}

/**
 * Run one `card.rename` job (MPI-776). Through this renderer and never a write to
 * `project.json`: while a project is open the renderer owns its `itemGroups`, and the
 * next save writes the whole array back over any edit made on disk.
 */
async function _renameCard(jobId, input = {}) {
    const { groupId, name } = input;
    if (!state.currentProject) {
        return _fail(jobId, 'NO_PROJECT', 'No project is open in Vision. Create or open one, then send this request again.');
    }
    const group = await renameGroup(groupId, name);
    if (!group) {
        return _fail(jobId, 'NO_SUCH_CARD',
            `No card "${groupId}" in the open project "${state.currentProject.name}". Open the project it belongs to first.`);
    }
    const selected = group.history?.[group.selectedIndex];
    return _report(jobId, {
        ok: true,
        output: {
            groupId: group.id,
            cardName: group.customName,
            displayName: group.customName || selected?.name || group.name,
        },
    });
}

/**
 * Run one `card.mark` job (MPI-817 Phase F): set or clear a card's mark, through this
 * renderer for the reason `_renameCard` gives. The mark is checked HERE against CARD_MARKS:
 * a free string would persist and then match no row of the filter panel, leaving a card
 * marked and un-findable.
 */
async function _markCard(jobId, input = {}) {
    const { groupId, mark } = input;
    if (!state.currentProject) {
        return _fail(jobId, 'NO_PROJECT', 'No project is open in Vision. Create or open one, then send this request again.');
    }
    if (mark && !CARD_MARKS.some(m => m.id === mark)) {
        return _fail(jobId, 'INVALID_MARK', `mark must be one of: ${CARD_MARKS.map(m => m.id).join(', ')}, or false to clear it.`);
    }
    const group = await markGroup(groupId, mark || false);
    if (!group) {
        return _fail(jobId, 'NO_SUCH_CARD',
            `No card "${groupId}" in the open project "${state.currentProject.name}". Open the project it belongs to first.`);
    }
    return _report(jobId, { ok: true, output: { groupId: group.id, mark: markOf(group) } });
}

/**
 * Run one `gallery.visible` job (MPI-817 Phase F): the cards the gallery grid is SHOWING,
 * in the grid's order. `state.gallerySort` lives only in this window (`order` is the one
 * key that persists), so nothing reading project.json can answer this.
 *
 * The predicate and the comparator are the grid's own (`MpiGalleryGrid` filters with this
 * exact pair): a second copy of a filter drifts, and the agent then acts on cards the user
 * cannot see. Ids only — the route builds the rows off disk with the one row builder.
 *
 * No gallery on screen is a named refusal, never the unfiltered project: "everything I can
 * see" must not silently become every card.
 * ponytail: a Flow overlay open over the gallery still answers with the grid beneath it.
 */
function _visibleCards(jobId) {
    if (!state.currentProject) {
        return _fail(jobId, 'NO_PROJECT', 'No project is open in Vision, so no gallery is showing.');
    }
    if (state.currentPage !== PAGE_GALLERY) {
        return _fail(jobId, 'GALLERY_NOT_OPEN', 'The gallery is not on screen, so there is no set of cards the user is looking at. Ask them to open the gallery, or use list_cards for the whole project.');
    }
    const sort = state.gallerySort;
    const groups = (state.currentProject.itemGroups || [])
        .filter(g => matchesGallerySort(g, g.history?.[g.selectedIndex] ?? { type: g.type }, sort))
        .sort(byGalleryOrder(sort.order));
    return _report(jobId, {
        ok: true,
        output: {
            folderPath: state.currentProject.folderPath,
            groupIds: groups.map(g => g.id),
            order: sort.order,
            scope: sort.scope,
            filtered: isGalleryFiltered(sort),
            filter: describeGalleryFilter(sort),
        },
    });
}

/**
 * Validate the `params` object against a flow's box steps (MPI-774).
 * Returns `{ ok: true }` or `{ ok: false, code, message }`.
 * Pure function — no side effects, exported for tests.
 *
 * ponytail: no bounds check. A box param is checked for a known name, integers and
 * the step's locked ratio, NOT for staying inside the image: `resolveAgentMedia`
 * items carry a url and nothing else, so the branch that used to read
 * `pixelDimensions` never ran on a real submit and only read as protection. Every
 * shipped box step declares `overflow: 'allow'` (`flowsRegistry.js` — both Head Swap
 * steps and Bernini), so nothing is unguarded today. Upgrade path for the first step
 * WITHOUT overflow: read the image's size with `sharp` in `POST /connector/generate`,
 * where the media url is already resolved, and check it there.
 *
 * @param {object} flow         FlowDef
 * @param {object} params       e.g. `{ box1: { x, y, width, height } }`
 */
export function validateBoxParams(flow, params) {
    if (!params || !Object.keys(params).length) return { ok: true };
    const boxSteps = (flow.steps || []).filter(s => s.kind === 'box' && s.param);
    const hasCrop = (flow.steps || []).some(s => s.kind === 'crop' && s.role);
    const knownParams = new Set(boxSteps.map(s => s.param));
    // MPI-817: `frame` is the one param that is not a box. A `crop` step has no `param`
    // of its own — its value becomes a padded picture rather than a widget — so it enters
    // through this same object under a fixed name, and is rejected here when the flow has
    // no crop step at all rather than silently ignored in `_submitFlow`.
    if (hasCrop) knownParams.add('frame');
    for (const [key, val] of Object.entries(params)) {
        if (!knownParams.has(key)) {
            return {
                ok: false, code: 'UNKNOWN_PARAM',
                message: `"${key}" is not a box param of ${flow.title}. Known: ${[...knownParams].join(', ') || 'none'}.`,
            };
        }
        if (key === 'frame') {
            if (!val || typeof val !== 'object') {
                return { ok: false, code: 'INVALID_FRAME', message: 'frame: expected an object { ratio: "9:16" }.' };
            }
            if (!_cropRatioValue(val.ratio)) {
                return {
                    ok: false, code: 'INVALID_FRAME',
                    message: `frame.ratio "${val.ratio ?? ''}" is not a shape this flow offers. One of: ${CROP_RATIO_LABELS.join(', ')}.`,
                };
            }
            continue;
        }
        const step = boxSteps.find(s => s.param === key);
        if (!val || typeof val !== 'object') {
            return { ok: false, code: 'INVALID_BOX', message: `${key}: expected an object {x,y,width,height}.` };
        }
        const { x, y, width, height } = val;
        if (!Number.isInteger(x) || !Number.isInteger(y) || !Number.isInteger(width) || !Number.isInteger(height)) {
            return { ok: false, code: 'INVALID_BOX', message: `${key}: x, y, width, height must be integers.` };
        }
        if (width <= 0 || height <= 0) {
            return { ok: false, code: 'INVALID_BOX', message: `${key}: width and height must be positive.` };
        }
        if (step.ratio === 1 && width !== height) {
            return { ok: false, code: 'INVALID_BOX', message: `${key}: box must be square (got ${width}×${height}).` };
        }
    }
    return { ok: true };
}

// ── Agent capabilities (MPI-774) ──────────────────────────────────────────────

/**
 * `agent.list-models` — build the full model/flow list with current install state.
 * Called by GET /connector/models; the route adds hardware fit + download sizes.
 */
function _listModels(jobId) {
    const engine = remoteEngineClient.effectiveEngine();

    const models = MODELS.map(model => {
        // `params`: what the agent may set on this op, so it never guesses a turbo
        // or a tier the model lacks (namedParamsFor mirrors resolveNamedParams).
        const ops = (model.supportedOps || []).map(op => ({
            op,
            installed: isOperationInstalled(model, op),
            params: namedParamsFor(model, op),
        }));

        // Compute missing dep IDs for this engine so the route can sum their sizes.
        const allDepIds = resolveFullUniverse(model, null, engine);
        const depStatus = getModelDepStatus(model.id);
        const missingDepIds = allDepIds.filter(id => {
            if (!depStatus) return true; // no cache = assume missing
            const s = depStatus.get(id);
            return s !== true && (typeof s !== 'object' || s?.installed !== true);
        }).filter(id => {
            // Skip custom_nodes and json config entries — they aren't downloaded as
            // weights and have no meaningful byte size to sum.
            const dep = DEPS[id];
            return dep && dep.size && dep.type !== 'custom_nodes' && dep.type !== 'json';
        });

        return {
            id: model.id,
            name: model.name,
            type: model.mediaType,
            installed: isOperationInstalled(model, null),
            ops,
            missingDepIds,
        };
    });

    const flows = listFlows().map(flow => {
        const avail = flowAvailability(flow);
        const boxSteps = (flow.steps || []).filter(s => s.kind === 'box' && s.param);
        const cropStep = (flow.steps || []).find(s => s.kind === 'crop' && s.role);
        return {
            id: flow.id,
            title: flow.title,
            operation: flow.operation,
            installed: avail.available,
            // The label is what a field MEANS: a bare `positive` read as "the prompt" and got an
            // instruction where Head Swap wants an expression (MPI-774 Phase 4). Step fields too.
            //
            // MPI-816: the id and the label alone are not enough to FILL one — what a caller
            // needs to choose a legal value is `agentFieldSpecs`, in the module that owns the
            // dialect.
            fields: agentFieldSpecs(flow),
            boxParams: boxSteps.map(s => ({
                param: s.param,
                role: s.role,
                ...(Number.isFinite(s.ratio) ? { ratio: s.ratio } : {}),
                ...(s.overflow === 'allow' ? { overflow: 'allow' } : {}),
            })),
            // MPI-817: a `crop` step is the whole point of the flow that declares it, and
            // it was invisible here — this filtered for `kind: 'box'` only, so Outpaint
            // advertised one toggle and nothing about the frame. The agent then ran it with
            // no frame at all, Krea 2 re-rendered the picture at its own shape, and the run
            // reported success (Fabio, 2026-09-19: "came back as the original image").
            // A crop step has no `param` by design — its value becomes a PADDED PICTURE,
            // not a widget — so it cannot ride in `boxParams` and gets its own key.
            ...(cropStep ? { frame: { param: 'frame', role: cropStep.role, ratios: CROP_RATIO_LABELS } } : {}),
        };
    });

    return _report(jobId, { ok: true, output: { engine, models, flows } });
}

/**
 * `agent.install-model` — start the download of any missing deps for a model.
 * Called by POST /connector/install; the route has already validated the model id
 * exists and that the app is online.
 */
async function _installModel(jobId, input = {}) {
    const { modelId } = input;
    const model = getModelById(modelId);
    if (!model) return _fail(jobId, 'UNKNOWN_MODEL', `No model with id "${modelId}".`);

    const engine = remoteEngineClient.effectiveEngine();
    const allDepIds = resolveFullUniverse(model, null, engine);
    const depStatus = getModelDepStatus(model.id);

    const missingDepIds = allDepIds.filter(id => {
        if (!depStatus) return true;
        const s = depStatus.get(id);
        return s !== true && (typeof s !== 'object' || s?.installed !== true);
    });

    const missingDeps = missingDepIds.map(id => DEPS[id]).filter(Boolean);
    if (!missingDeps.length) {
        return _report(jobId, { ok: false, error: { code: 'ALREADY_INSTALLED', message: `${model.name} is already installed.` } });
    }

    const downloadGb = missingDeps.reduce((sum, dep) => sum + (dep.size ? sizeToGb(dep.size) : 0), 0);

    // `start()` returns the install CHAIN, which settles when the download FINISHES. The
    // contract is `started` (progress is /comfy/downloads/status): awaited, an 8.8 GB install
    // held the agent's one-turn lock for four minutes, and a download past the relay's
    // 30-minute budget would answer TIMEOUT while it carried on (MPI-774 Phase 4).
    try {
        Promise.resolve(downloadService.start(model.id, missingDeps)).catch((err) => {
            clientLogger.warn('agentDispatch', `install ${model.id} failed after it started: ${err?.message}`);
        });
    } catch (err) {
        return _fail(jobId, 'RUNTIME_ERROR', err?.message || 'Download start failed.');
    }

    return _report(jobId, { ok: true, output: { modelId, downloadGb: Math.round(downloadGb * 10) / 10, started: true } });
}

/**
 * `agent.describe` — run the image describer with an optional injected question.
 * The imagePath (possibly a cropped file) is passed by the server-side route.
 * Returns `{ text }` via _report. Errors: DESCRIBER_MISSING, REJECTED, CANCELLED, RUNTIME_ERROR
 * (ComfyUI) or the /llm/describe codes NO_PROFILE, NO_KEY, NOT_VISION, BAD_IMAGE, ENDPOINT_ERROR (Remote).
 *
 * MPI-737: delegates to `llmService.describeImage` — the ONE describe switch
 * point — so the agent automatically uses whichever backend the user chose
 * (ComfyUI or Remote). D1: on failure, the error text goes back to the agent.
 */
async function _describeImage(jobId, input = {}) {
    const { imagePath, question } = input;
    if (!imagePath) return _fail(jobId, 'BAD_REQUEST', 'imagePath is required.');

    const result = await describeImage({ imagePath, question, scope: 'gallery' });
    if (result.ok) {
        return _report(jobId, { ok: true, output: { text: result.text } });
    }
    const code = result.errorCode || (result.cancelled ? 'CANCELLED' : 'RUNTIME_ERROR');
    const message = result.error || 'The description failed. See the app log for the cause.';
    return _fail(jobId, code, message);
}

/**
 * Run one `generation.cancel` job: stop the submit that went out under `input.jobId`, whether
 * it is still waiting in the Cue queue or already rendering. Through the queue's OWN cancel
 * functions — the same ones the Cue panel's buttons call — so the lane drains, the next job
 * promotes and the placeholder clears exactly as they do for a user's Stop. The cancelled
 * submit reports `CANCELLED` by itself, through the `onCancel` it was enqueued with.
 *
 * Found live (Fabio, 2026-09-20): "Scratch that. Leave it." was meant to cancel a clip, and
 * the agent had no way to — so it read "leave it" as "leave it running" and said so.
 */
function _cancelGeneration(jobId, input) {
    const queueJobId = _queueJobs.get(input?.jobId);
    const was = !queueJobId ? null
        : cancelPendingCueJob(queueJobId).length ? 'pending'
        : cancelRunningCueJob(queueJobId) ? 'running'
        : null;
    if (!was) {
        return _fail(jobId, 'NOT_IN_FLIGHT',
            'Nothing in flight by that requestId: it already finished or was already cancelled.');
    }
    return _report(jobId, { ok: true, output: { cancelled: true, was } });
}

/** Capability name → handler. The relay carries nothing else. */
const _HANDLERS = {
    'generation.submit': _submitGeneration,
    'generation.cancel': _cancelGeneration,
    'project.open': _openProject,
    'card.rename': _renameCard,
    'card.mark': _markCard,
    'gallery.visible': _visibleCards,
    'agent.list-models': _listModels,
    'agent.install-model': _installModel,
    'agent.describe': _describeImage,
    // MPI-830: the GIF verbs. They live in gifJobs.js — this file's contract is
    // one job in, one result out, and those four run whole pipelines (ffmpeg
    // routes, the cut-out engine, landing the card). They answer in the
    // connector envelope, so reporting is all that happens here.
    ...Object.fromEntries(Object.keys(GIF_HANDLERS).map(cap =>
        [cap, (jobId, input) => runGifJob(cap, input).then(payload => _report(jobId, payload))])),
};

/**
 * Subscribe to the relay. Idempotent, and safe in the browser dev build — a
 * failed EventSource just retries; nothing else in the app depends on it.
 */
export function initAgentDispatch() {
    if (_source) return;

    _source = new EventSource('/connector/jobs/stream');

    _source.addEventListener('job', (evt) => {
        let job;
        try {
            job = JSON.parse(evt.data);
        } catch (err) {
            clientLogger.error('connector', 'Malformed agent job frame', err);
            return;
        }
        const handler = _HANDLERS[job.capability];
        if (!handler) {
            _fail(job.jobId, 'UNSUPPORTED_CAPABILITY', `Unknown capability "${job.capability}".`);
            return;
        }
        // A submit's id can be the caller's own `requestId`, and the route only refuses one
        // that is still in flight — so a reused id must not be read as "already reported".
        _settled.delete(job.jobId);
        clientLogger.info('connector', `Agent job ${job.jobId}: ${job.capability}`);
        // Through a promise so an async handler's rejection reports too — a bare
        // try/catch only sees a synchronous throw, and an unreported job hangs the
        // caller until the route's timeout.
        Promise.resolve().then(() => handler(job.jobId, job.input)).catch((err) => {
            clientLogger.error('connector', `Agent job ${job.jobId} threw`, err);
            _fail(job.jobId, 'RUNTIME_ERROR', err?.message || 'The job threw.');
        });
    });

    // EventSource reconnects on its own; log once so a permanently dead relay is
    // findable in app.log rather than silently absent.
    _source.addEventListener('error', () => {
        clientLogger.info('connector', 'Agent job stream dropped — reconnecting.');
    });
}
