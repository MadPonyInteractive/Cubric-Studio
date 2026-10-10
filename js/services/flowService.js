/**
 * flowService.js — Run path for Flows (MPI-256).
 *
 * A Flow is a second producer into the generation queue: it builds a config from
 * its descriptor + collected inputs and hands it to enqueueGeneration() exactly like
 * the History block's universal tool ops (model:{id:null}, no getNextGeneration).
 *
 * The one thing the universal path does NOT do on its own is a MODEL guard — universal
 * ops resolve their weights at dispatch and would fail deep in the engine if a required
 * model isn't installed. So submitFlowGeneration pre-flights flowRunAvailability and aborts
 * with a toast BEFORE anything enters the queue.
 */

'use strict';

import { enqueueGeneration } from './generationService.js';
import { runCommand } from './commandExecutor.js';
import { cloudRunFields, estimateRunCost, cloudErrorMessage } from './cloudExecutor.js';
import { CLOUD_TAPS } from '../utils/cloudEditGraph.js';
import {
    getFlowById, flowAvailability, flowRunAvailability, flowModelParams, flowLoraPhases, flowModelIds,
    flowOperation, flowLegs, flowRunLegs, flowToggleLeg, flowRunValues,
} from '../data/flowsRegistry.js';
import { getModelById } from '../data/modelRegistry.js';
import { state } from '../state.js';
import { Events } from '../events.js';
import { clientLogger } from './clientLogger.js';
import { describeAsks, describeFlowRun } from './flowEnhance.js';
import { extractAbsPath } from '../utils/mediaActions.js';
import { characterSheetEditor, characterSheetEditorRefusal, characterSheetEditorCardName } from '../data/flowPrompts/characterSheetEditor.js';

/**
 * Flows whose prompt is BUILT in code (FlowDef `promptBuilder`, MPI-1041), by name so the FlowDef
 * stays data. `build(part, values)` gives one leg's `{ positive, injectionParams }`; `refuse(values)`
 * says why a run cannot start; `cardName(values, sourceName)` names the card the run lands.
 */
const PROMPT_BUILDERS = {
    characterSheetEditor: { build: characterSheetEditor, refuse: characterSheetEditorRefusal, cardName: characterSheetEditorCardName },
};

/**
 * The name of the card a run's picture came from: the card in the project holding that file, or
 * the name the picker gave it. Null for a file from outside the project (an agent's path).
 * @param {?Object} media - the run's first media item
 * @param {?Object} project
 * @returns {?string}
 */
export function sourceCardName(media, project) {
    const base = p => String(extractAbsPath(p) || p || '').split(/[\\/]/).pop();
    const file = base(media?.filePath || media?.url);
    const group = file && (project?.itemGroups || []).find(g => (g.history || []).some(it => base(it?.filePath) === file));
    return group ? (group.customName || group.name || null) : (media?.name || null);
}

/**
 * Why this run of a built-prompt Flow cannot start, or null. The agent asks it before
 * dispatching (the submit only toasts and returns null, which an agent cannot read).
 * @param {import('../data/flowsRegistry.js').FlowDef} flow
 * @param {Object} run - the run's inputs
 * @returns {?string}
 */
export function flowRunRefusal(flow, run) {
    return PROMPT_BUILDERS[flow?.promptBuilder]?.refuse(flowRunValues(flow, run)) || null;
}

/**
 * Queue a generation for a Flow.
 *
 * @param {import('../data/flowsRegistry.js').FlowDef|string} flowOrId
 * @param {Object} inputs - Collected by MpiBaseFlow from the FlowDef. Media are passed by
 *                          reference (content-addressed store paths), never base64.
 * @param {Object} [callbacks] - onComplete/onError/onCancel, forwarded to enqueueGeneration.
 * @param {{index?: number, tempId?: string, item?: Object, described?: Object, alone?: boolean}} [_leg] -
 *        INTERNAL, set only by the leg driver below when this call IS a later leg: its place in
 *        `flowLegs`, the run's tempId, the previous leg's result item (a `box` is fractions of
 *        its size), the describe answers leg 1 got, and `alone` for a single leg run by the
 *        result pane. Never passed by a caller.
 * @returns {{queueJobId: string}|null} enqueue result, or null if the guard aborted.
 */
/**
 * What is actually absent, for a toast that names it. MPI-304: a flow can require deps
 * no model owns (a baked LoRA, a node pack), so always saying "models" read as
 * "needs models installed" while the Library showed every model Ready.
 * @param {{missing: string[], missingDeps: string[]}} availability
 * @returns {string}
 */
function _missingLabel({ missing, missingDeps }) {
    if (!missing.length) return 'extra files';
    return missing.length === 1 && !missingDeps.length ? 'a model' : 'models';
}

/**
 * LEGS (MPI-623, MPI-997, generalised in MPI-1041). A flow declaring `chain: { operation }` runs
 * as TWO ordinary jobs: leg 1, then leg 2 dispatched from leg 1's completion. The queue runs
 * jobs in order and each leg is one prompt, so both honour the lane-settle invariants
 * MPI-463/461 protect — this is deliberately NOT a two-prompt job inside commandExecutor's
 * lane machinery, which is the expensive version of the same thing.
 *
 * `chain` may be a LIST of legs, run in order (`flowRunLegs` decides which a run takes), and
 * leg 1's op may be routed by a field (`operationBy`, `flowOperation`). Each leg is fed the
 * picture the leg before it made, on its own `input` role; a leg that does not run passes the
 * picture straight on. Each leg resolves its model ids for ITS op (`flowModelIds(flow, { op })`),
 * so a slot the leg does not use cannot pick the graph.
 *
 * WHY two prompts rather than one graph: ComfyUI never evicts what the CURRENT prompt
 * produced (`comfy_execution/caching.py`, and no caller passes `free_active=True`). The
 * 3D Scene bake's second stage spikes to ~43 GB on its own, so it needs the machine
 * otherwise empty — and only a NEW prompt bumps the cache generation that frees the
 * first stage. Nothing flows between the legs at runtime: leg 2 addresses leg 1's output
 * by name, which is known before either starts.
 *
 * The CALLER sees ONE completion, on the LAST leg — the flow is not done until the final half
 * is. Each leg's own card still lands when that leg finishes; the run path commits it, not
 * this callback. If the next leg cannot enqueue (its model guard aborts), the completion of
 * the leg before it is forwarded instead, so the pane reports done rather than hanging on a
 * job that never ran.
 *
 * `submitLeg` is passed in rather than closed over so this branch is reachable from a
 * test — importing flowService is cheap, but reaching `enqueueGeneration` is not.
 *
 * A leg may be OPTIONAL (MPI-997, Character Sheet's head removal; MPI-1041 widened it to a
 * rule on any field): `when` decides, and a leg that does not run passes the picture on.
 *
 * @param {import('../data/flowsRegistry.js').FlowDef} flow
 * @param {Object} callbacks - the CALLER's callbacks.
 * @param {function(Object, {index: number, operation: string, leg: Object}):(Object|null)} submitLeg -
 *        dispatches the next leg, handed the completion and that leg (`flowRunLegs`' entry).
 * @param {Object} [run] - the inputs this run carries, read for the legs' `when`.
 * @param {number} [after] - the place in `flowLegs` of the leg these callbacks are for; -1 is leg 1.
 * @returns {Object} callbacks to hand enqueueGeneration for that leg.
 */
export function chainCallbacks(flow, callbacks, submitLeg, run = {}, after = -1) {
    const next = flowRunLegs(flow, run).find(leg => leg.index > after);
    if (!next) return callbacks;
    return {
        ...callbacks,
        onComplete: (result) => {
            if (!submitLeg(result, next)) callbacks.onComplete?.(result);
        },
    };
}

/**
 * A leg's own injection params: its `params` as declared, and its `box` — fractions of the
 * picture it is fed — as the head-swap injector's integer `box1` (`box2` for an `image2`
 * input) in that picture's pixels. A leg with no `box` sends none: the whole picture, since a
 * sent zero box would become 1x1.
 * @param {import('../data/flowsRegistry.js').FlowLeg} leg
 * @param {?{w?: number, h?: number}} size - the picture's pixels (`pixelDimensions`)
 * @returns {?Object} null when the leg wants a box and the picture's size is unknown, because
 *          running it on the whole picture instead would be a different edit
 */
export function legInjection(leg, size) {
    const { box } = leg;
    if (!box) return { ...leg.params };
    if (!(size?.w > 0 && size?.h > 0)) return null;
    const n = /(\d+)$/.exec(leg.input || '')?.[1] || 1;
    // Edges are rounded, not sizes, so a box ending at 1 ends on the picture's last pixel.
    const [x, y] = [Math.round(box.x * size.w), Math.round(box.y * size.h)];
    return {
        ...leg.params,
        [`box${n}`]: {
            x, y,
            width: Math.round((box.x + box.width) * size.w) - x,
            height: Math.round((box.y + box.height) * size.h) - y,
        },
    };
}

/**
 * A leg's inputs. MPI-623's shape reads the previous leg's output off disk by name, so it gets
 * the inputs unchanged. A leg with an `input` role (MPI-997) instead EDITS the previous
 * picture: that picture goes in as the role's media, and the leg lands as the NEXT VERSION of
 * its card, through the same `runLanding` door a routine's later step uses (MPI-970). So the
 * card shows the edit and keeps the original one step back in its history.
 * @param {import('../data/flowsRegistry.js').FlowDef} flow
 * @param {Object} inputs - the run's first inputs
 * @param {{item?: Object, group?: Object}} result - the previous leg's completion
 * @param {import('../data/flowsRegistry.js').FlowLeg} [leg] - the leg being fed; the first by default
 * @returns {Object}
 */
export function chainLegInputs(flow, inputs, result, leg = flowLegs(flow)[0]) {
    if (!leg?.input) return inputs;
    const item = result?.item;
    const group = result?.group;
    // A project the app does NOT have open is versioned off the frozen copy the run was
    // dispatched with (generationService § `_originLive`), and leg 1's copy predates leg 1's
    // card, so leg 2 found no card, dropped its output and reported CANCELLED (live, an agent
    // run into a closed project). Leg 2 gets that copy WITH the card leg 1 just registered:
    // the routine runner's re-read before each step, for the one card this leg touches.
    const origin = inputs.runOriginProject;
    return {
        ...inputs,
        runMediaItems: item?.filePath
            ? [{ role: leg.input, mediaType: flow.mediaType || 'image', url: item.filePath, filePath: item.filePath }]
            : [],
        ...(group ? { runLanding: { ...(inputs.runLanding || {}), existingGroup: group } } : {}),
        ...(group && origin ? {
            runOriginProject: { ...origin, itemGroups: [...(origin.itemGroups || []).filter(g => g.id !== group.id), group] },
        } : {}),
    };
}

/**
 * One leg ALONE, on a result the user already has (MPI-997: the result pane's chain toggle,
 * "remove the head from this sheet"). The same leg and landing a chained run takes, so it too
 * becomes the card's next version.
 * @param {import('../data/flowsRegistry.js').FlowDef} flow
 * @param {Object} inputs - the inputs the card ran with (its item's `flowInputs`)
 * @param {{item: Object, group: Object}} result - the card version to edit
 * @param {Object} [callbacks]
 * @param {number} [index] - the leg to run, by its place in `flowLegs`; the toggle leg by default
 * @returns {?{queueJobId: string, tempId: string}}
 */
export function submitChainLeg(flow, inputs, result, callbacks = {}, index = flowToggleLeg(flow)) {
    const leg = flowLegs(flow)[index];
    if (!leg?.input) return null;
    return submitFlowGeneration(flow, chainLegInputs(flow, inputs, result, leg), callbacks, { index, item: result?.item, alone: true });
}

/**
 * The NEXT PASS of the same flow on this pass's result (MPI-900 — a big outpaint).
 * Same shape as `chainCallbacks`, and the same one-completion rule: the caller hears the
 * last pass, never an earlier one. The difference is media — the next pass runs on a
 * picture DERIVED from this pass's output, which only exists once it lands, so the caller
 * hands a `next` that turns this completion into the next pass's run media, and says
 * whether that pass is the last.
 *
 * A next pass that cannot be prepared or enqueued is an ERROR, not a done: this pass's
 * card is part of the frame the user asked for, and reporting it as the result would
 * read as the model ignoring the shape.
 *
 * @param {function(Object): Promise<{media: Array<Object>, last: boolean}|null>} next
 * @param {Object} callbacks - the CALLER's callbacks
 * @param {function(Array<Object>, boolean): (Object|null)} submitNext - dispatches the next pass
 * @returns {Object} callbacks to hand enqueueGeneration for this pass
 */
export function nextPassCallbacks(next, callbacks, submitNext) {
    return {
        ...callbacks,
        onComplete: async (result) => {
            let pass = null;
            try {
                pass = await next(result);
            } catch (err) {
                clientLogger.error('flowService', `next pass could not be prepared: ${err?.message || err}`);
            }
            if (!pass?.media || !submitNext(pass.media, pass.last)) callbacks.onError?.(new Error('The next pass could not start.'));
        },
    };
}

export function submitFlowGeneration(flowOrId, inputs = {}, callbacks = {}, _leg = {}) {
    const flow = typeof flowOrId === 'string' ? getFlowById(flowOrId) : flowOrId;
    if (!flow) {
        Events.emit('ui:warning', { message: 'That flow could not be found.' });
        return null;
    }

    // Build config from the descriptor + inputs. Positive/negative stay empty unless
    // the flow declares them.
    //
    // A flow still runs with `model.id: null` — it is an OPERATION, not a model, and
    // that null is what keeps `getModelSettings` (keyed by model id) out of the path.
    // A `requiredModels` slot marked `loras: true` is the deliberate exception: it says
    // "this phase of my graph carries a user LoRA rack, and the running model's settings
    // are what fill it".
    //
    // This reverses the "RUN CLEAN, no project LoRAs" rule that stood here — Fabio's
    // call on MPI-504: a user who already has a character LoRA should be able to load
    // it and describe only the wardrobe and face on top. The LoRA carries identity, the
    // sheet carries the layout. It stays OPT-IN per SLOT, so every flow that declares
    // nothing still runs exactly as clean as before — which two shipped LTX flows rely
    // on, since both carry Input_Lora nodes they deliberately never fill (MPI-608).
    //
    // WHAT RUNS vs WHAT REUSE RESTORES — they are not always the same media (MPI-594).
    // A step kind may redraw the input before the graph sees it (the outpaint crop
    // composes source + black bars into one file). That derived file is a RUN detail:
    // the snapshot has to keep the user's own image plus the rect, or a reuse would
    // outpaint an already-outpainted picture. So `runMediaItems` is stripped here and
    // never reaches `flowInputs`.
    //
    // `runInputs` is the same rule for FIELDS (MPI-677, 2026-09-14): the inputs as they
    // RUN, e.g. with the raw prompt standing in for an enhance target nobody filled.
    // That fallback once rode in the snapshot, so reopening or reusing Character Sheet
    // put the brief back into the phrase box as text Enhance did not own — and Enhance,
    // which never overwrites the user's writing, then silently refused to run again.
    // A caller with nothing run-only to say omits it and runs its snapshot.
    // `runNextPass` is run-only too (MPI-900): a function, and a plan for THIS press.
    // `runOriginProject` is the project an agent's submit named (MPI-873), open or not; a
    // project record, so it must never ride into the sidecar's `flowInputs`.
    // `runLanding` is where a routine step lands (MPI-970): queue opts, run-only for the same
    // reason. It rides every leg and every pass, so each part is one more History version.
    const { runMediaItems, runInputs, runNextPass, runOriginProject, runLanding, ...snapshot } = inputs;
    const run = runInputs || snapshot;

    // WHICH LEG THIS CALL DISPATCHES (MPI-1041). `index` is its place in `flowLegs`; -1 is leg 1,
    // the Flow's own op, which `operationBy` may route by a field and may SKIP (`null`): the first
    // wanted leg then runs first, on the user's own picture. `later` is a leg the driver below
    // dispatched on the one before it, which is what decides its media and its describe.
    const later = _leg.index !== undefined;
    let index = _leg.index ?? -1;
    if (!later && flowOperation(flow, run) === null) {
        const first = flowRunLegs(flow, run)[0];
        if (!first) {
            Events.emit('ui:warning', { message: `${flow.title} has nothing to do with those settings.` });
            return null;
        }
        index = first.index;
    }
    const leg = index >= 0 ? flowLegs(flow)[index] : null;
    const operation = leg ? leg.operation : flowOperation(flow, run);

    // A built prompt's own refusal (no words for the change), before anything is checked or queued.
    const builder = PROMPT_BUILDERS[flow.promptBuilder];
    const refusal = !later && flowRunRefusal(flow, run);
    if (refusal) {
        Events.emit('ui:warning', { message: refusal });
        return null;
    }

    // Pre-flight MODEL + DEP guard — universal ops have none of their own. MPI-304:
    // a flow can also require deps no model owns (a baked LoRA, a node pack); those
    // block exactly like a missing model, so name whichever is actually absent rather
    // than always saying "models" (with models present and only a dep missing, the old
    // copy read "needs models installed" while the library showed every model Ready).
    // MPI-1041: it asks about THIS run, so an optional model blocks only the ops it serves.
    const availability = flowRunAvailability(flow, run);
    if (!availability.available) {
        Events.emit('ui:warning', {
            // A broken Flow package has nothing to install, only a reason (MPI-532).
            message: availability.reason
                ? `${flow.title} can't run: ${availability.reason}`
                : `${flow.title} needs ${_missingLabel(availability)} installed first — open it in Flows to install.`,
        });
        return null;
    }

    // ponytail: a later leg takes NO media unless it names an `input` role. Its graph reads
    // what the leg before wrote to disk, addressed by name (`Input_Name`), so re-sending the
    // source image would only stage a file nothing loads. The exception is a leg with an
    // `input` role (MPI-997), which is handed the previous picture by `chainLegInputs`.
    const mediaItems = later && !leg?.input ? []
        : Array.isArray(runMediaItems) ? runMediaItems
        : Array.isArray(snapshot.mediaItems) ? snapshot.mediaItems : [];

    // A leg's own params, and its `box` resolved against the picture it is fed: the previous
    // leg's result, or (a leg that starts the run) the user's own picture on its input role.
    // A box that cannot be sized stops the leg rather than running it on the whole picture.
    const described = { ..._leg.described };
    const modelIds = flowModelIds(flow, { op: operation });
    let legParams = {};
    if (leg) {
        const picture = later ? _leg.item : mediaItems.find(m => m?.role === leg.input);
        legParams = legInjection(leg, picture?.pixelDimensions);
        if (!legParams) {
            clientLogger.error('flowService', `${flow.id}: leg ${leg.operation} has a box but its picture's size is unknown`);
            Events.emit('ui:warning', { message: `${flow.title} could not read the size of its picture for the next step.` });
            return null;
        }
    }
    const config = {
        // The op picks the GRAPH (universal_workflows.js). A multi-leg flow declares one
        // op per leg, which is why the chain needs no second `workflow` field on FlowDef.
        operation,
        model: { id: null, mediaType: flow.mediaType || 'image' },
        positive: run.positive || '',
        negative: run.negative || '',
        mediaItems,
        // MPI-590: the params that identify WHICH member of an any-of set is running go
        // in FIRST, so a collected field of the same name still wins. Empty `{}` for every
        // flow that declares no `modelParams`. This is the hop that makes the picker real
        // — the same hop `loraModelId` was missing in MPI-504, where the panel saved real
        // slots and the image came back identical.
        // MPI-1041: the params of the models THIS op runs (`op`), then what leg 1's describe
        // answered for a later leg, then the leg's own `params` and `box`, which are fixed.
        injectionParams: { ...flowModelParams(flow, { op: operation }), ...(run.injectionParams || {}), ...described, ...legParams },
        // Which model's LoRA rack fills which PHASE of this flow's graph — one
        // `{ phase, modelId }` per `requiredModels` slot that declared `loras: true`, and
        // `[]` for every flow that declared none. NOT a model selection: it never reaches
        // model resolution or workflow lookup, which stay driven by `operation`. Each id is
        // resolved through its any-of set so the rack follows the member actually running
        // (MPI-590), not the id the descriptor happens to list first.
        //
        // Was a single `loraModelId` string (MPI-504). One string named one rack, so a flow
        // picking a model PER PHASE could fill neither correctly (MPI-608).
        // MPI-1041: only the phases whose slot THIS op runs (`modelIds`), as for the params.
        loraPhases: flowLoraPhases(flow).filter(({ phase }) => modelIds[phase - 1]),
        // Additive, threaded to the sidecar save path (Phase 2 item 4) so Reuse can
        // reopen this Flow with its inputs restored.
        flowId: flow.id,
        flowInputs: snapshot,
        // WHICH model ran in each slot, one id per `requiredModels` slot in declaration
        // order (MPI-620). A flow card carries `modelId: null` by design, so without this
        // nothing on disk says whether Scribble rendered on klein-9b or klein-4b. The tier
        // WAS recoverable from `injectionParams.Input_Edit_Model`, but only by mapping
        // weight FILENAMES back to model ids — which breaks the day a weight is re-exported.
        // Rides in `generationSettings` (generationService), not as a new item field: that
        // blob is already the sidecar's free-form run snapshot, so this needs no route,
        // projectModel or migration change.
        // Resolved FOR THIS OP (MPI-1041): a slot the leg does not use is `null`. Every slot's
        // id used to go out, and `getUniversalWorkflow` takes the FIRST id with a `byModel` arm,
        // so a second slot's leg ran the first slot's graph.
        flowModelIds: modelIds,
        // Absent, `enqueueGeneration` freezes the project open at enqueue, as it always has.
        ...(runOriginProject ? { _originProject: runOriginProject } : {}),
    };

    // The chained leg REUSES leg 1's tempId. MpiBaseFlow matches live latents and Stop
    // through the tempId its run token carries, so a fresh id on leg 2 would leave the
    // pane unable to stop or preview the second half. The two legs are sequential —
    // leg 1 has ended before leg 2 enqueues — so nothing shares it at once, and leg 2's
    // own placeholder below cannot collide with leg 1's landed card (a committed card
    // takes a real group id from the media commit, never the tempId).
    const tempId = _leg.tempId || crypto.randomUUID();

    // NO getNextGeneration — arming the loop would re-fire flow gens. forceLocal only
    // when the user has explicitly pinned the local engine (mirrors state.engineOverride).
    //
    // A GALLERY PLACEHOLDER, ALWAYS (MPI-827). This deliberately reverses MPI-306,
    // whose premise expired twice: it withheld the placeholder because "the flow's own
    // result pane shows the run, so a second in-progress card behind the overlay is
    // noise", and because a result only landed if the user pressed Apply.
    //   - Apply was removed, so a flow result commits to the gallery on completion
    //     regardless. The placeholder is simply where that card is going to be.
    //   - An AGENT-dispatched flow has no overlay open at all (agentDispatch.js
    //     `_submitFlow`), so there is no result pane and the run was invisible
    //     everywhere but the status bar — Fabio, 2026-09-19: *"when the agent runs a
    //     flow and I'm in the gallery, I can't see what's happening"*.
    // Everything else on that path was already wired: the gen is `scope: 'gallery'`,
    // it enters `_myGenIds`, and `preview:frame` reaches MpiGalleryBlock — which then
    // had no card to paint into. Both surfaces can paint the same frame: the flow pane
    // resolves by tempId, the gallery by its placeholder, neither keyed on the other.
    //
    // Same shape agentDispatch builds for a model gen. `Generating...` is the name the
    // grid renders while `isGenerating` is true. Size comes from what the flow injects
    // and otherwise falls back like every other placeholder — the real item replaces it.
    const placeholderGroup = {
        id: tempId,
        type: flow.mediaType || 'image',
        name: 'Generating...',
        history: [],
        selectedIndex: 0,
        width:  Number(config.injectionParams.Width)  || 1024,
        height: Number(config.injectionParams.Height) || 1024,
        isGenerating: true,
    };

    const opts = {
        scope: 'gallery',
        tempId,
        placeholderGroup,
    };
    if (state.engineOverride === 'local') opts.forceLocal = true;
    // A built-prompt Flow names the card it lands after the card it edits and the change ("John -
    // beaten up", MPI-1041), so the result and the sheet it came from read apart. The run's first
    // call only: each later leg is that card's next version. An agent's own `cardName` renames it after.
    if (builder?.cardName && !later) {
        opts.cardName = builder.cardName(flowRunValues(flow, run),
            sourceCardName(snapshot.mediaItems?.[0], runOriginProject || state.currentProject));
    }
    // A routine step (MPI-970) lands where the routine says: a later step is the next
    // version of its result card (no gallery card at all), step 1 a gallery card that also
    // joins the run's result stack.
    // `tempId` rides a version landing too: a chained leg 2 lands on leg 1's card, and the
    // flow pane finds that leg's live latents and Stop by it.
    const landing = !runLanding ? opts
        : runLanding.existingGroup
            ? { ...runLanding, scope: 'groupHistory', groupId: runLanding.existingGroup.id, forceLocal: opts.forceLocal, tempId }
            : { ...opts, ...runLanding };

    // Each leg hands the run on to the next wanted one, so the caller hears the LAST. A leg the
    // result pane runs `alone` ends there. Every leg gets the first call's `inputs` plus the leg
    // before it, and the describe answers collected so far (run-only: `_leg`, never `inputs`).
    const legCallbacks = _leg.alone ? callbacks : chainCallbacks(flow, callbacks,
        (result, next) => submitFlowGeneration(flow, chainLegInputs(flow, inputs, result, next.leg), callbacks,
            { index: next.index, tempId, item: result?.item, described }),
        run, index);
    // Every pass but the last carries `runNextPass` on; the last gets none, so it ends
    // there. Each keeps the tempId for the same reason a later leg does.
    const runCallbacks = runNextPass
        ? nextPassCallbacks(runNextPass, callbacks,
            (media, last) => submitFlowGeneration(flow,
                { ...snapshot, runInputs, runMediaItems: media, runOriginProject, runLanding, ...(last ? {} : { runNextPass }) }, callbacks, { tempId }))
        : legCallbacks;

    // A cloud model in the edit slot (MPI-918): pass 1 and the cloud call run first, and
    // pass 2 enters the queue when the picture is back. So there is no queue id yet.
    // ponytail: an agent's cancel before pass 2 enqueues answers NOT_IN_FLIGHT, like leg 2 of a chain.
    const cloudModel = leg ? null : cloudEditModel(flow);
    const start = () => {
        // The leg's BUILT prompt (MPI-1041), here because the describe answers are in by now and
        // the child-safety gate reads `positive` when the job is queued.
        if (builder) {
            const built = builder.build(leg?.prompt || 'change', { ...flowRunValues(flow, run), ...described });
            config.positive = built.positive;
            Object.assign(config.injectionParams, built.injectionParams);
        }
        if (cloudModel) {
            runCloudEdit(flow, cloudModel, config, runCallbacks, { enqueue: (cfg) => enqueueGeneration(cfg, runCallbacks, landing) });
            return { queueJobId: null, tempId };
        }
        return enqueueGeneration(config, runCallbacks, landing);
    };

    // The picture put into words first (MPI-1036, flowEnhance.js § describe), on the describer
    // picked in Remote: every caller reaches the graph through here, so hand, agent and routine
    // runs are described alike. Like the cloud edit there is no queue id until it is done.
    // First call only. The answers go on to each later leg through `described` (MPI-1041); a
    // multi-pass Flow that describes would need them carried into `runInputs` for each pass.
    // The rules read every field the run has (`change`, `words` are not graph params), and a
    // CHECK's refusal carries its own code (a child-safety one: CHILD_SAFETY), so the hand, agent
    // and routine runs report the same code and words.
    const describeRun = { mediaItems, injectionParams: { ...flowRunValues(flow, run), ...config.injectionParams } };
    if (!_leg.tempId && describeAsks(flow, describeRun.injectionParams, mediaItems).length) {
        describeFlowRun(flow, describeRun, runOriginProject || state.currentProject).then((d) => {
            if (!d.ok) {
                if (d.cancelled) return runCallbacks.onCancel?.();
                Events.emit('ui:warning', { message: d.message });
                return runCallbacks.onError?.(Object.assign(new Error(d.message), { code: d.code || 'DESCRIBE_FAILED', userMessage: d.message }));
            }
            Object.assign(config.injectionParams, d.injectionParams);
            Object.assign(described, d.injectionParams);
            if (!start()) runCallbacks.onError?.(new Error('The job was rejected before it entered the queue.'));
        });
        return { queueJobId: null, tempId };
    }

    const res = start();
    // Return the tempId so the caller (MpiBaseFlow) can match this job's live latent
    // previews (preview:frame → activeGenerations.byPromptId → entry.tempId; MPI-271).
    return res ? { ...res, tempId } : null;
}

// ── Cloud edit stage (MPI-918) ───────────────────────────────────────────────────────────
//
// A Flow declaring `cloudEdit` can run its edit stage on a cloud model picked into its edit
// slot. The graph runs TWICE around the cloud call (utils/cloudEditGraph.js): pass 1 hands
// back the picture and the prompt the local edit model would have received, the cloud
// model edits that picture through the same route a cloud generation uses (key, credit
// gate, billed cost), and pass 2 runs the rest of the graph on the result. Only pass 2 is a
// queued job and only pass 2 lands a card, carrying the cost.

/**
 * The cloud model this run's edit slot resolved to, or null for a local run.
 * @param {import('../data/flowsRegistry.js').FlowDef} flow
 * @returns {?Object} the ModelDef
 */
export function cloudEditModel(flow) {
    if (!flow?.cloudEdit) return null;
    return flowModelIds(flow).map(id => getModelById(id)).find(m => m?.provider) || null;
}

async function _blobOf(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`could not read ${url} (HTTP ${res.status})`);
    return res.blob();
}

/**
 * What one run of this Flow bills, for the agent's spend gate and its catalogue: the cloud
 * edit at the 1 MP every `cloudEdit` graph scales its edit input to. null for a local run.
 * @param {import('../data/flowsRegistry.js').FlowDef} flow
 * @returns {?{model: Object, usd: ?number, display: ?string}}
 */
export function cloudEditQuote(flow) {
    const model = cloudEditModel(flow);
    if (!model) return null;
    const quote = cloudEditPrice(model.id);
    return { model, usd: quote?.usd ?? null, display: quote?.display ?? null };
}

/**
 * One Flow run's price on a cloud slot candidate, as its slot label shows it; null for a
 * local one, or one whose price cannot be known before it runs.
 * @param {string} modelId
 * @returns {?{usd: number, display: string}}
 */
export function cloudEditPrice(modelId) {
    const model = getModelById(modelId);
    if (!model?.provider) return null;
    return estimateRunCost(model, { Width: 1024, Height: 1024 }, [{ mediaType: 'image', url: 'reference' }]) || null;
}

/** A picture as a data URL: what the engine staging route and a run param both take. */
function _dataUrlOf(blob) {
    return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(/** @type {string} */ (r.result));
        r.onerror = () => reject(r.error);
        r.readAsDataURL(blob);
    });
}

/** Pass 1 as a direct run: outside the queue and never a card (MpiToolOptionsResize's shape). */
function _runPass1(flow, config) {
    return new Promise((resolve, reject) => {
        const exec = runCommand({
            operation: config.operation,
            modelId: null,
            positive: config.positive,
            negative: config.negative,
            mediaItems: config.mediaItems,
            injectionParams: config.injectionParams,
            flowModelIds: config.flowModelIds,
            cloudEdit: { pass: 1, spec: flow.cloudEdit },
            suppressLifecycleEvents: true,
            forceLocal: state.engineOverride === 'local',
        });
        // Resolves null when the run finished without a picture; rejects only with the
        // engine's own error, which commandExecutor has already shown the user.
        exec.onComplete = (_urls, info) => resolve(pass1Shown(flow.cloudEdit, info));
        exec.onError = reject;
    });
}

/**
 * What pass 1 handed back, read BY TAP ID: a run reports its taps in the order they executed,
 * so with two references "the first display" can be image two. null when anything is missing.
 * @param {{input2?: *}} spec - the FlowDef's `cloudEdit`
 * @param {{displayUrlsByNode?: Object<string, string[]>, promptText?: ?string}} info - runCommand's completion
 * @returns {?{url: string, url2: ?string, prompt: string}}
 */
export function pass1Shown(spec, { displayUrlsByNode = {}, promptText = null } = {}) {
    const url = displayUrlsByNode[CLOUD_TAPS.input]?.[0];
    const url2 = spec.input2 ? displayUrlsByNode[CLOUD_TAPS.input2]?.[0] : null;
    return url && promptText && (url2 || !spec.input2) ? { url, url2: url2 || null, prompt: promptText } : null;
}

/**
 * Pass 1 -> the cloud edit -> pass 2. A failure before pass 2 reaches the caller's onError
 * with the cloud route's own code (LOW_BALANCE, NO_KEY...), so an agent can say why.
 * @param {Object} flow
 * @param {Object} model - the cloud ModelDef in the edit slot
 * @param {Object} config - the run's config, as a local run would enqueue it
 * @param {Object} callbacks
 * @param {{enqueue: function(Object):(Object|null), pass1?: function}} io - pass 2's enqueue, and pass 1;
 *        both passed in so a test can run this without the queue or the engine
 * @returns {Promise<void>}
 */
export async function runCloudEdit(flow, model, config, callbacks, { enqueue, pass1 = _runPass1 }) {
    const fail = (code, message) => {
        const userMessage = cloudErrorMessage(code, message);
        Events.emit('ui:warning', { message: `${flow.title}: ${userMessage}` });
        callbacks.onError?.(Object.assign(new Error(userMessage), { code, userMessage }));
    };
    let shown;
    try {
        shown = await pass1(flow, config);
    } catch (err) {
        // Pass 1 runs on the user's own engine and nothing has reached the provider: the
        // engine's error passes through as it is, code and all, and commandExecutor has
        // already said why (a Pod still connecting, a workflow error), as for any Flow.
        clientLogger.warn('flowService', `${flow.id} edit stage (pass 1) failed: ${err?.message || err}`);
        callbacks.onError?.(err);
        return;
    }
    if (!shown) {
        fail('EDIT_STAGE_EMPTY', 'The edit stage handed back no picture to send.');
        return;
    }
    try {
        const picture = await _blobOf(shown.url);
        // The fit size is image one's, whatever image two is (Object Stamp's Manual object
        // keeps its own aspect): the local decode is the size of image one's latent.
        const bitmap = await createImageBitmap(picture);
        const size = { width: bitmap.width, height: bitmap.height };
        bitmap.close();
        const stage = async (blob) => {
            const stageRes = await fetch('/comfy/stage-media-data-url', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dataUrl: await _dataUrlOf(blob) }),
            });
            const staged = await stageRes.json().catch(() => null);
            if (!stageRes.ok || !staged?.path) throw new Error(staged?.error || `staging failed (HTTP ${stageRes.status})`);
            return { mediaType: 'image', role: 'inputImage', url: staged.path };
        };

        // The request cloudExecutor builds for an edit, so the credit gate and the bill are
        // the ones every cloud run gets. The size is pass 1's picture: the edit keeps it.
        // Strip order is reference order, so image two follows image one.
        const media = [await stage(picture), ...(shown.url2 ? [await stage(await _blobOf(shown.url2))] : [])];
        const params = { Width: size.width, Height: size.height };
        const res = await fetch('/deepinfra/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                modelId: model.id,
                operation: 'edit',
                prompt: shown.prompt,
                seed: null,
                ...cloudRunFields(model, params, media),
                estimateUsd: estimateRunCost(model, params, media)?.usd || 0,
            }),
        });
        const body = await res.json().catch(() => null);
        if (!res.ok || !body?.ok || !body.viewUrls?.[0]) {
            fail(body?.error?.code || 'PROVIDER_ERROR', body?.error?.message);
            return;
        }
        const image = await _dataUrlOf(await _blobOf(body.viewUrls[0]));
        const queued = enqueue({
            ...config,
            cloudEdit: { pass: 2, spec: flow.cloudEdit, image, ...size, cost: body.cost },
        });
        if (!queued) callbacks.onError?.(new Error('The edited picture could not be finished.'));
    } catch (err) {
        clientLogger.error('flowService', `${flow.id} cloud edit failed: ${err?.message || err}`);
        fail('PROVIDER_ERROR', null);
    }
}

/**
 * Reuse routing for Flow cards (MPI-256 Phase 5). A flow gen's sidecar carries
 * `flowId` + `flowInputs`; Reuse on such a card must reopen the APP with those inputs
 * restored, NOT fill the PromptBox. Both Gallery + History reuse entry points call
 * this at the TOP of their reuse path and `return` when it handles the item.
 *
 * Seeds `state.s_flowInputs[flowId]` (top-level replace) BEFORE emitting `flow:open`,
 * so the freshly-mounted MpiBaseFlow reads the restored inputs on mount.
 *
 * REUSE ALWAYS OPENS THE FLOW, whatever is installed (MPI-620, Fabio's call). It used to
 * refuse on `!flowAvailability().available` and bounce the user to the Flow Library — so
 * the flow never mounted and the saved `flowInputs` were never restored. For Scribble
 * those inputs ARE the user's drawing, and a missing weight cost them the picture. A model
 * that is gone is a SUBSTITUTION, not a failure: `flowModelIds` already resolves a card
 * made on klein-9b to klein-4b when only 4B is installed. So the outcome is a toast over
 * the open flow (see `_reuseModelToast`) and the user installs and presses Generate
 * instead of redrawing.
 *
 * @param {Object} item - The reused history item (payload.item).
 * @returns {boolean} true if the item was a flow card and was handled.
 */
export function openFlowFromReuse(item) {
    // ponytail: `appId`/`appInputs` are the pre-rename key names (MPI-256 shipped
    // dev-gated only, so this is local dev data — never a released user's). The Flow
    // ids themselves did NOT change, so getFlowById resolves an old card unchanged.
    // Drop both fallbacks after the next release.
    const flowId = item?.flowId ?? item?.appId;
    if (!flowId) return false;
    const flow = getFlowById(flowId);
    if (!flow) return false; // unknown flow id → let normal reuse handle it

    // Restore the saved inputs, then open the flow. Seed first — MpiBaseFlow reads
    // s_flowInputs[flowId] on mount.
    const savedInputs = item.flowInputs ?? item.appInputs;
    if (savedInputs && typeof savedInputs === 'object') {
        state.s_flowInputs = { ...state.s_flowInputs, [flowId]: savedInputs };
    }
    // THE CARD'S OWN RESULT COMES WITH IT (MPI-727, Fabio 2026-09-12): a reused flow
    // opens with that result already in the pane, and — because `s_flowResults` is the
    // one store MpiBaseFlow paints a result from — it rides in the floating window the
    // moment the user steps off the last step to read the inputs that produced it. That
    // is the whole point: reuse a song, read and edit the lyrics in the Lyrics box that
    // wrote them, and listen while you do. Only Generate replaces it.
    //
    // It is something to LOOK AT, never an input: this writes `s_flowResults` and never
    // `s_flowInputs`. The snapshot Reuse restores stays frozen at Run
    // (docs/playbooks/add-flow/03-storage-and-reuse.md § "Snapshot at Run").
    //
    // `pending: false` and no status line — the "Saved to your gallery" note and a
    // "Done…" line are both claims about a run THIS session never made. A file that is
    // gone needs nothing extra either: MpiBaseFlow HEAD-probes a seeded result on mount
    // and falls back to the empty pane.
    if (item.filePath || item.url) {
        state.s_flowResults = {
            ...state.s_flowResults,
            [flowId]: { items: [item], mode: null, status: '', pending: false },
        };
    }
    // Defer the open by a tick: Reuse is triggered from a context menu / reuse
    // dialog whose teardown fires a bare `ui:close-all-popups` AFTER this returns —
    // which the Flow overlay (MpiOverlay) obeys and would immediately hide. Emitting
    // on the next tick lets that close settle first, so the flow actually opens.
    // The toast goes in the SAME tick, after the open, so it lands over the flow.
    setTimeout(() => {
        Events.emit('flow:open', { flowId });
        _reuseModelToast(flow, item);
    }, 0);
    return true;
}

/**
 * Tell the user what will actually run, once the reused flow is open (MPI-620).
 *
 * Two cases, and only two — silence otherwise, because the common reuse runs exactly
 * what the card ran:
 *  - nothing installed for a slot → DANGER toast. The flow stays open with the inputs
 *    intact, so this is "install it and press Generate", not a dead end.
 *  - a different candidate resolves than the one recorded → WARNING toast naming both
 *    tiers. Needs `generationSettings.flowModelIds`, which flow gens have carried since
 *    MPI-620; a card saved before that says nothing, so it gets no toast rather than a
 *    guess made from weight filenames.
 *
 * @param {import('../data/flowsRegistry.js').FlowDef} flow
 * @param {Object} item
 */
function _reuseModelToast(flow, item) {
    const availability = flowAvailability(flow);
    if (!availability.available) {
        Events.emit('ui:danger', {
            message: `${flow.title} needs ${_missingLabel(availability)} installed — install from Flows, then press Generate. Your inputs are kept.`,
        });
        return;
    }
    const ran = item.generationSettings?.flowModelIds;
    if (!Array.isArray(ran)) return;
    const swapped = flowModelIds(flow)
        .map((id, i) => ({ id, was: ran[i] }))
        .filter(slot => slot.was && slot.was !== slot.id);
    if (!swapped.length) return;
    const names = swapped
        .map(slot => `${_modelName(slot.id)} instead of ${_modelName(slot.was)}`)
        .join(', ');
    Events.emit('ui:warning', {
        message: `${flow.title} will run on ${names} — the model this was made with isn't installed.`,
    });
}

/** Display name for a model id, falling back to the id itself for an unknown one. */
function _modelName(id) {
    return getModelById(id)?.name || id;
}
