/**
 * routineDispatch.js — the renderer's `deps` for a routine run (MPI-970).
 *
 * `routineRunner.js` owns the order, landing and failure rules and touches the app only
 * through these. Each step builds through the SAME halves the agent's submit uses
 * (`buildGeneration` / `buildTool` / `buildFlow` in agentDispatch.js), so a routine step
 * passes exactly the checks a one-off generate does. What a routine drops on purpose: the
 * settings pin and the painted mask (a saved step runs on the model and settings it
 * saved), and following the view (a run spans many cards).
 *
 * Landing (the Phase 1 spike, `tasks/MPI-970/plan.md`): step 1 is a gallery gen with a
 * placeholder, later steps `groupHistory` on the result card; a Flow gets the same through
 * `runLanding`. The result stack goes in through `addGroup` when the project is open, and
 * through `/project-groups` when it is closed, which joins each result to it as it lands.
 *
 * The relay (R2): `ROUTINE_HANDLERS` answers the `routine.quote` / `routine.run` jobs the
 * server pushes, in the connector envelope; agentDispatch.js reports them like its own.
 */

import { quoteRoutine, runRoutine } from '../services/routineRunner.js';
import { normalizeRoutine, validateRoutine, routineSummary } from '../data/routineModel.js';
import { enqueueGeneration } from '../services/generationService.js';
import { submitFlowGeneration } from '../services/flowService.js';
import { addGroup, serializeGroup } from '../services/projectService.js';
import { reconcileAndHydrate } from '../managers/projectReconciler.js';
import { estimateRunCost } from '../services/cloudExecutor.js';
import { clientLogger } from '../services/clientLogger.js';
import { createItemGroup } from '../data/projectModel.js';
import { STACK_TYPE, resultStackFields, expandStacks } from '../data/stackModel.js';
import { formatPrice } from '../data/modelConstants/deepinfraPricing.js';
import { MODELS, getModelById, isOperationInstalled } from '../data/modelRegistry.js';
import { FLOWS, getFlowById, flowAvailability } from '../data/flowsRegistry.js';
import { getCommandMediaInputs, filterMediaInputsForModel } from '../data/commandRegistry.js';
import { resolveNamedParams, resolveAgentMedia } from '../data/generationControls.js';
import { truncateCardName } from '../utils/displayHelpers.js';
import { state } from '../state.js';
import { buildGeneration, buildTool, buildFlow, targetProject, resolveSettingsOwner, galleryPlaceholder } from './agentDispatch.js';
import { toolOperation } from './agentToolOps.js';

const _TOOL_MODEL = { id: null, mediaType: 'image' };

/** The one required slot of a step's op: where the card, or the previous result, goes. */
function _cardRole(step) {
    const flow = step.flowId ? getFlowById(step.flowId) : null;
    const op = flow ? flow.operation : step.modelId ? step.operation : toolOperation(step.operation);
    const model = step.modelId ? getModelById(step.modelId) : flow ? null : _TOOL_MODEL;
    return filterMediaInputsForModel(getCommandMediaInputs(op), model).find(s => s.required)?.key;
}

const _isOpen = (project) => !!project?.folderPath
    && project.folderPath.replace(/\\/g, '/').toLowerCase() === state.currentProject?.folderPath?.replace(/\\/g, '/').toLowerCase();

/** Where one step's result lands: a new gallery card, or the next version of `existingGroup`. */
function _landingOpts(landing, type, width, height) {
    if (landing.existingGroup) return { ...landing, scope: 'groupHistory', groupId: landing.existingGroup.id };
    const placeholderGroup = galleryPlaceholder(type, width, height);
    return { ...landing, scope: 'gallery', tempId: placeholderGroup.id, placeholderGroup };
}

/** @type {import('../services/routineRunner.js').RoutineDeps} */
export const routineDeps = {
    lookups: { models: MODELS, flows: FLOWS },

    check(step) {
        if (step.flowId) {
            const flow = getFlowById(step.flowId);
            return flow && flowAvailability(flow).available ? null : (flow?.title || step.flowId);
        }
        if (step.modelId) {
            const model = getModelById(step.modelId);
            if (isOperationInstalled(model, step.operation)) return null;
            return model?.provider ? `${model.name} (no cloud key set)` : (model?.name || step.modelId);
        }
        // ponytail: a tool is a universal ComfyUI op with no per-op install record; a missing
        // weight fails that card's step (D3). Check it up front if users hit it.
        return null;
    },

    price(step) {
        const model = step.modelId ? getModelById(step.modelId) : null;
        // `provider` is the whole discriminator (MPI-851); a Flow or a tool bills nothing.
        if (!model?.provider) return { billed: false, usd: null };
        const owner = resolveSettingsOwner(step, false, null, null);
        const named = resolveNamedParams(null, model, step.operation, owner.named);
        // ponytail: stand-in urls. The run's files are unknown at quote time, and the price
        // reads only how many pictures go in (an edit bills its references).
        const media = resolveAgentMedia(step.operation, model, [
            { role: _cardRole(step), url: 'card' },
            ...(step.media || []).map(m => ({ role: m.role, url: m.input })),
        ]);
        const quote = estimateRunCost(model, { ...(named.ok ? named.injectionParams : {}), ...owner.injectionParams },
            media.ok ? media.mediaItems : []);
        return { billed: true, usd: quote ? quote.usd : null };
    },

    async readProject(folderPath) {
        const target = await targetProject({ folderPath });
        if (target.error || !target.project) return null;
        // A closed project comes off disk with each history as item ids, and the runner
        // reads files: hydrate it as opening does (an imported card has no sidecar, and
        // only the reconciler rebuilds it). Its orphan-sidecar cleanup is the same an open does.
        return target.open ? target.project : (await reconcileAndHydrate(target.project)).project;
    },

    async submit(step, input, landing, project) {
        const req = { ...step, media: [{ role: _cardRole(step), url: input.url }, ...(step.media || [])] };
        const built = step.flowId ? await buildFlow(req, project)
            : step.modelId ? await buildGeneration(req, project)
                : await buildTool(req, project);
        if (!built.ok) return built;

        let settle;
        const done = new Promise((resolve) => { settle = resolve; });
        const callbacks = {
            onComplete: ({ item, group }) => settle({ ok: true, item, group }),
            // A routine chains pictures, video and sound; words have no card to version.
            onText: () => settle({ ok: false, code: 'NO_OUTPUT', message: 'This step answered in words, and a routine step must make a picture, video or sound.' }),
            onError: (err) => settle({ ok: false, code: err?.code || 'RUNTIME_ERROR',
                message: err?.userMessage || 'The generation failed. See the app log for the cause.' }),
            onCancel: () => settle({ ok: false, code: 'CANCELLED', message: 'The generation was cancelled or produced no output.' }),
        };
        const queued = step.flowId
            ? submitFlowGeneration(built.flow, { ...built.inputs, runLanding: landing }, callbacks)
            : enqueueGeneration(built.config, callbacks,
                _landingOpts(landing, built.config.model.mediaType || 'image', built.run?.width || 0, built.run?.height || 0));
        if (!queued) return { ok: false, code: 'REJECTED', message: 'Vision rejected the step before it entered the queue.' };
        return { ok: true, done };
    },

    async addStack({ id, name, kind, expected }, project) {
        const stack = { ...createItemGroup(STACK_TYPE, resultStackFields({ kind, name: truncateCardName(name), expected })), id };
        if (_isOpen(project)) return addGroup(stack);
        try {
            const res = await fetch('/project-groups', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ folderPath: project.folderPath, groups: [serializeGroup(stack)] }),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
        } catch (err) {
            // The cards still land, each on its own; only the stack holding them is lost.
            clientLogger.error('routine', 'could not add the result stack to its closed project', { folderPath: project.folderPath, error: err.message });
        }
    },

    newId: () => crypto.randomUUID(),
};

/** A runner refusal in the connector envelope; `missing` and the like ride along. */
const _refusal = ({ ok: _ok, code, message, ...extra }) => ({ ok: false, error: { code, message, ...extra } });

/**
 * The project a routine job names (open or closed, as a submit's `folderPath`), and the
 * card ids to run on: a stack stands for its cards (D9: "put her in these scenes" names
 * the scenes' stack). An unknown id is kept, so the runner refuses it by name.
 */
async function _runTarget(input) {
    const target = await targetProject(input);
    if (target.error) return _refusal(target.error);
    if (!target.project) {
        return _refusal({ code: 'NO_PROJECT', message: 'No project is open in Vision and the request named none. Send folderPath, or create or open a project, then send this request again.' });
    }
    const groups = target.project.itemGroups || [];
    const picked = (Array.isArray(input.cards) ? input.cards : []).map(id => groups.find(g => g.id === id) || { id });
    return { ok: true, project: target.project, cardIds: expandStacks(picked, groups).map(g => g.id) };
}

/**
 * Relay capabilities: `input` = `{ routine, cards, inputs?, folderPath? }`, the routine
 * as saved (the server reads the file). Each resolves to the job's one report.
 */
export const ROUTINE_HANDLERS = {
    /**
     * The save-time check, HERE because a package Flow exists only in this window's
     * `FLOWS`: the routine as it should be stored, or the refusal the agent fixes it by.
     */
    async 'routine.validate'(input = {}) {
        const v = validateRoutine(normalizeRoutine(input.routine), routineDeps.lookups);
        return v.ok ? { ok: true, output: { routine: v.routine, summary: routineSummary(v.routine) } } : _refusal(v);
    },

    /** What the run needs and costs, dispatching nothing. */
    async 'routine.quote'(input = {}) {
        const t = await _runTarget(input);
        if (!t.ok) return t;
        const q = quoteRoutine(input.routine, t.cardIds.length, routineDeps, input.inputs);
        if (!q.ok) return _refusal(q);
        return { ok: true, output: {
            missing: q.missing, billed: q.billed, count: t.cardIds.length, usd: q.usd,
            display: q.billed && q.usd !== null ? formatPrice(q.usd) : null,
        } };
    },

    /** Runs it, answering once every card's chain has ended: the run's summary. */
    async 'routine.run'(input = {}) {
        const t = await _runTarget(input);
        if (!t.ok) return t;
        const run = await runRoutine(input.routine, t.cardIds, { projectFolder: t.project.folderPath, inputs: input.inputs }, routineDeps);
        if (!run.ok) return _refusal(run);
        return { ok: true, output: await run.finished };
    },
};
