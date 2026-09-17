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

import { enqueueGeneration, findMissingMediaSlot } from '../services/generationService.js';
import { submitFlowGeneration } from '../services/flowService.js';
import { openProject, renameGroup } from '../services/projectService.js';
import { navigate, PAGE_GALLERY } from '../router.js';
import { MODELS, getModelById, isOperationInstalled, getModelDepStatus } from '../data/modelRegistry.js';
import { DEPS } from '../data/modelConstants/dependencies.js';
import { resolveFullUniverse } from '../data/modelConstants/resolveModelDeps.js';
import { sizeToGb } from '../data/modelConstants/footprint.js';
import { getFlowById, listFlows, flowAvailability } from '../data/flowsRegistry.js';
import { resolveFlowFieldValues, flowDeclaredFields } from '../utils/declaredFields.js';
import { getCommand } from '../data/commandRegistry.js';
import { resolveNamedParams, isValidSeed, resolveAgentMedia, namedParamsFor } from '../data/generationControls.js';
import { describeImage } from '../services/llmService.js';
import { downloadService } from '../services/downloadService.js';
import { remoteEngineClient } from '../services/remoteEngineClient.js';
import { state } from '../state.js';
import { clientLogger } from '../services/clientLogger.js';

let _source = null;
/** Job ids already reported — the "one result out" half of the contract. */
const _settled = new Set();

/** POST a job's outcome back. Late/duplicate reports are dropped here and no-op'd server-side. */
async function _report(jobId, payload) {
    if (_settled.has(jobId)) return;
    _settled.add(jobId);
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
async function _reportDone(jobId, { item, group }, cardName) {
    const named = cardName !== undefined && group?.id ? await renameGroup(group.id, cardName) : null;
    return _report(jobId, {
        ok: true,
        output: {
            itemId: item?.id,
            groupId: group?.id,
            type: item?.type,
            filePath: item?.filePath,
            seed: item?.seed,
            pixelDimensions: item?.pixelDimensions,
            generationMs: item?.generationMs,
            ...(named ? { cardName: named.customName } : {}),
        },
    });
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
        modelId, operation, positive = '', negative = '', injectionParams = {}, media = [],
        ratio, qualityTier, turbo, styleSelect, stylization, seed,
    } = input;

    if (!state.currentProject) {
        return _fail(jobId, 'NO_PROJECT', 'No project is open in Vision. Open one first.');
    }

    const model = getModelById(modelId);
    if (!model) {
        return _fail(jobId, 'UNKNOWN_MODEL', `No model with id "${modelId}".`);
    }

    // Covers BOTH halves in one call: the op must be in supportedOps and its
    // weights must be on disk for the effective engine. Checked here so the agent
    // gets a named reason — commandExecutor's own net bails with a toast it cannot see.
    if (!isOperationInstalled(model, operation)) {
        return _fail(jobId, 'OP_UNAVAILABLE',
            `"${operation}" is not available on ${model.name || modelId} — unsupported, or its weights are not installed.`);
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
    // project (see generationControls.js's own comment); this call resolves the
    // EFFECTIVE value against the real open project, so an unset param falls back to
    // what the PromptBox currently shows rather than the workflow's baked default —
    // the same fix MPI-546 made for ratio alone, generalised to the whole v1 set.
    const named = resolveNamedParams(state.currentProject, model, operation,
        { ratio, qualityTier, turbo, styleSelect, stylization });
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
        onComplete: (done) => _reportDone(jobId, done, input.cardName),
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
function _submitFlow(jobId, input = {}) {
    const { flowId, fields = {}, media = [], params = {} } = input;

    if (!state.currentProject) {
        return _fail(jobId, 'NO_PROJECT', 'No project is open in Vision. Open one first.');
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
        return _fail(jobId, 'NO_PROJECT', 'No project is open in Vision. Open one first.');
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
    const knownParams = new Set(boxSteps.map(s => s.param));
    for (const [key, val] of Object.entries(params)) {
        if (!knownParams.has(key)) {
            return {
                ok: false, code: 'UNKNOWN_PARAM',
                message: `"${key}" is not a box param of ${flow.title}. Known: ${[...knownParams].join(', ') || 'none'}.`,
            };
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
        return {
            id: flow.id,
            title: flow.title,
            operation: flow.operation,
            installed: avail.available,
            // The label is what a field MEANS: a bare `positive` read as "the prompt" and got an
            // instruction where Head Swap wants an expression (MPI-774 Phase 4). Step fields too.
            fields: flowDeclaredFields(flow).map(f => ({ id: f.id, label: f.label || f.id })),
            boxParams: boxSteps.map(s => ({
                param: s.param,
                role: s.role,
                ...(Number.isFinite(s.ratio) ? { ratio: s.ratio } : {}),
                ...(s.overflow === 'allow' ? { overflow: 'allow' } : {}),
            })),
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

/** Capability name → handler. The relay carries nothing else. */
const _HANDLERS = {
    'generation.submit': _submitGeneration,
    'project.open': _openProject,
    'card.rename': _renameCard,
    'agent.list-models': _listModels,
    'agent.install-model': _installModel,
    'agent.describe': _describeImage,
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
