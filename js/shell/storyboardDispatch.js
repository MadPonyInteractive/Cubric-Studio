/**
 * storyboardDispatch.js — the app side of the Storyboard Flow (MPI-1231).
 *
 * `storyboardRunner.js` owns the order, landing and failure rules and touches the app only
 * through the `deps` built here. Each panel is an ordinary generation on the Flow's picked
 * panel model (FLUX.3 Klein or Qwen-Image 2.1), built by
 * the SAME `buildGeneration` the agent and the routines use: `edit` with the user's pictures as
 * its references, `t2i` without. So a panel is a normal model card with its own prompt and
 * history, which the user edits, redoes or upscales like any other.
 *
 * `FLOW_DRIVERS` is what the Flow frame calls instead of `submitFlowGeneration` for a FlowDef
 * that declares `driver` (MpiBaseFlow `_run`).
 */

import { runStoryboard, parseStoryboardPlan, recurringActors, panelStyle, MAX_DRAWN_FIRST } from '../services/storyboardRunner.js';
import { enqueueGeneration } from '../services/generationService.js';
import { addGroup, updateGroup, reorderStack } from '../services/projectService.js';
import { clientLogger } from '../services/clientLogger.js';
import { StatusBar } from './statusBar.js';
import { createItemGroup } from '../data/projectModel.js';
import { STACK_TYPE, resultStackFields } from '../data/stackModel.js';
import { truncateCardName } from '../utils/displayHelpers.js';
import { state } from '../state.js';
import { buildGeneration } from './agentDispatch.js';
import { landingOpts } from './routineDispatch.js';
import { runGifJob } from './gifJobs.js';
import { flowModelIds } from '../data/flowsRegistry.js';
import { MODELS } from '../data/modelConstants/models.js';
import { COMMANDS } from '../data/commandRegistry.js';
import { resolveTurboControlId } from '../data/generationControls.js';
import { runMultiAngleFlow } from './multiAngleDispatch.js';

/**
 * How many pictures the model's edit takes: the edit op's slots its capabilities open
 * (FLUX.3 Klein 10, Qwen-Image 2.1 8).
 */
const _maxReferences = model => COMMANDS.edit.mediaInputs
    .filter(i => !i.requiresCapability || model?.capabilities?.[i.requiresCapability]).length;

// 21:9 is a video shape (LTX_RATIOS) that FLUX.3's own size table lacks. It goes as exact
// pixels over the named 16:9, which switches an edit's Custom size on: about the tier's pixel
// count, both edges /32 like every FLUX.3 size.
const WIDE_21_9 = { '1k': { Width: 1568, Height: 672 }, '2k': { Width: 2240, Height: 960 } };

/** The size half of a panel's request. */
function _size(ratio, qualityTier) {
    if (ratio !== '21:9') return { ratio, qualityTier };
    return { ratio: '16:9', qualityTier, injectionParams: { ...WIDE_21_9[qualityTier], Ratio_Label: '21:9' } };
}

/** The user's pictures in slot order, renamed to the edit op's roles from the first. */
function _references(mediaItems, roles) {
    return mediaItems
        .filter(m => m?.url && m.mediaType === 'image')
        .sort((a, b) => roles.indexOf(a.role) - roles.indexOf(b.role))
        .map((m, i) => ({ role: i ? `inputImage${i + 1}` : 'inputImage', url: m.url }));
}

/** The selected item of a group as it stands in the open project now. */
const _liveGroup = (groupId) => (state.currentProject?.itemGroups || []).find(g => g.id === groupId);

function _deps(project, { flow, inputs, unit, modelId, idea, references, ratio, qualityTier, turbo }, frame) {
    return {
        isLoopArmed: () => state.loopArmed === true,

        async submit(panel, index, landing) {
            const built = await buildGeneration({
                modelId,
                operation: references.length ? 'edit' : 't2i',
                positive: panel.prompt,
                media: references,
                turbo,
                ..._size(panel.ratio || ratio, qualityTier),
            }, project);
            if (!built.ok) return built;
            // Stop was pressed while the panels were still going in (each waits on its build) or while the cast was drawn: nothing more is queued (MPI-1293).
            if (frame?.stopped?.()) return { ok: false, code: 'CANCELLED', message: 'The user pressed Stop.' };
            // The user pressed Generate: their toasts show, and the child-safety gate reads
            // their own idea beside the panel prompt the planner wrote from it.
            // `flowId` + `flowInputs` ride to the sidecar, so Reuse > Apply to App reopens the
            // Storyboard with the idea, pictures and plan that drew this panel (Fabio, 2026-10-25).
            // `flowStep` is the status bar's "panel 5/6", which also hides the graph's bare stage "1".
            const config = { ...built.config, byAgent: false, userWords: [idea, panel.prompt],
                flowId: flow.id, flowInputs: inputs,
                flowStep: landing.batchTotal > 1 ? `${unit} ${index + 1}/${landing.batchTotal}` : null };
            let settle;
            const done = new Promise((resolve) => { settle = resolve; });
            const opts = landingOpts(landing, 'image', built.run.width, built.run.height);
            const queued = enqueueGeneration(config, {
                onComplete: ({ item, group }) => settle({ ok: true, item, group }),
                onError: (err) => settle({ ok: false, code: err?.code || 'RUNTIME_ERROR',
                    message: err?.userMessage || 'The panel failed. See the app log for the cause.' }),
                onCancel: (why) => settle(why?.stopped
                    ? { ok: false, code: 'CANCELLED', message: 'The user pressed Stop.' }
                    : { ok: false, code: 'NO_OUTPUT', message: 'Nothing came back for this panel.' }),
            }, opts);
            if (!queued) return { ok: false, code: 'REJECTED', message: `Panel ${index + 1} was rejected before it entered the queue.` };
            // The Flow frame follows each panel by its queue id: live latents, sweep, Stop, the result.
            frame?.onJob?.(queued.queueJobId, done);
            return { ok: true, done };
        },

        async addStack({ id, name, kind, expected }) {
            await addGroup({ ...createItemGroup(STACK_TYPE, resultStackFields({ kind, name, expected })), id });
        },

        async writeNote(item, notes) {
            try {
                const res = await fetch(
                    `/project-media/${project.id}/update-meta?folderPath=${encodeURIComponent(project.folderPath)}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ itemId: item.id, updates: { notes } }),
                    },
                );
                const data = await res.json().catch(() => ({}));
                if (!res.ok || !data.success) throw new Error(data.error || `HTTP ${res.status}`);
                const live = (state.currentProject?.itemGroups || []).find(g => g.history?.some(h => h?.id === item.id));
                if (live) await updateGroup({ ...live, history: live.history.map(h => (h.id === item.id ? { ...h, notes } : h)) });
            } catch (err) {
                // The panel landed; only its note is missing, and the user can write it.
                clientLogger.error('storyboard', 'could not write a panel note', { itemId: item.id, error: err.message });
            }
        },

        reorderStack: (stackId, groupIds) => reorderStack(stackId, groupIds),

        async makeOverview(groupIds, name) {
            const itemIds = groupIds.map(_liveGroup).map(g => g?.history?.[g.selectedIndex ?? 0]?.id).filter(Boolean);
            if (itemIds.length < 2) return;
            const res = await runGifJob('sheet.make', { itemIds, numbered: true, whole: true });
            if (!res?.ok) {
                clientLogger.error('storyboard', 'overview sheet failed', res?.error);
                StatusBar.notify(`${name}: the panels are in, but the numbered sheet could not be made. Right-click the stack and pick Create Sheet.`, 'warning');
            }
        },

        newId: () => crypto.randomUUID(),
    };
}

/** What the user reads when the whole board has ended. */
function _summary(name, out) {
    const failed = out.panels.filter(p => !p.groupId).map(p => p.index + 1);
    if (!out.ok) return { text: `${name}: no panel was drawn.`, variant: 'warning' };
    if (out.cancelled) return { text: `${name} stopped: ${out.panels.length - failed.length} panels kept, in order.`, variant: 'info' };
    if (failed.length) return { text: `${name} is ready, but panel ${failed.join(', ')} failed. The rest are in the stack in order.`, variant: 'warning' };
    return { text: `${name} is ready: ${out.panels.length} panels in the stack, and a numbered sheet.`, variant: 'success' };
}

/**
 * Generate on the Storyboard Flow.
 * @param {Object} flow - the FlowDef
 * @param {Object} inputs - the frame's collected inputs (`positive`, `plan`, `ratio`,
 *   `qualityTier`, `turbo`, `mediaItems`)
 * @param {{onJob?: function(string, Promise<Object>): void, stopped?: function(): boolean}} [frame] -
 *   the Flow frame, told of every queued picture (its queue id and its `done`) so its result pane
 *   can follow it, and asked before each one goes in whether Stop was pressed
 * @returns {Promise<false|{finished: Promise<Object>}>} false when nothing started, else the end
 *   of the whole run
 */
async function runStoryboardFlow(flow, inputs, frame) {
    const project = state.currentProject;
    if (!project?.folderPath) {
        StatusBar.notify('Open a project first: the storyboard lands in its gallery.', 'warning');
        return false;
    }
    // The notes under the pictures arrive as "Picture N is ..." sentences (`pictureNotes`); they
    // join the idea, which is what the cast lines and the child-safety gate read.
    const idea = [inputs.positive, inputs.pictureNotes].map(s => String(s || '').trim()).filter(Boolean).join(' ');
    const panels = parseStoryboardPlan(inputs.plan, idea);
    if (!panels.length) {
        StatusBar.notify('Press Plan with Cosmo to write the plan first, or write it yourself as [PANEL 1] Picture: ... Intent: ...', 'warning');
        return false;
    }
    const roles = flow.inputSchema.media[0].roles;
    const [modelId] = flowModelIds(flow);
    const model = MODELS.find(m => m.id === modelId);
    const references = _references(inputs.mediaItems || [], roles);
    const max = _maxReferences(model);
    if (references.length > max) {
        StatusBar.notify(`${model?.name || modelId} takes up to ${max} pictures and this storyboard has ${references.length}. Remove ${references.length - max}, or pick FLUX.3 Klein as the panel model.`, 'warning');
        return false;
    }
    const words = String(inputs.positive || '').trim();
    const name = truncateCardName(words ? `Storyboard · ${words}` : 'Storyboard');
    const opts = {
        flow,
        inputs,
        unit: 'panel',
        modelId,
        idea,
        ratio: inputs.ratio,
        qualityTier: inputs.qualityTier,
        // A model with no turbo switch refuses one (INVALID_TURBO); the hidden toggle keeps its value.
        turbo: resolveTurboControlId(model) ? inputs.turbo !== false : undefined,
    };
    // A recurring actor or place with no picture gets one drawn first, so every panel draws the
    // SAME dragon on the SAME ledge: up to MAX_DRAWN_FIRST, fewer when the model's free reference
    // slots run out, characters first, then places, then objects. Each is drawn in the panels' style.
    const wanted = recurringActors(inputs.plan, idea);
    const free = max - references.length;
    const actors = wanted.slice(0, Math.max(0, Math.min(MAX_DRAWN_FIRST, free)));
    if (!actors.length) return _drawPanels(panels, name, _deps(project, { ...opts, references }, frame));

    // One actor lands as a plain card under its own name; two or more as a Cast stack.
    const style = panelStyle(panels);
    const castName = truncateCardName(actors.length > 1 ? `${name} · Cast` : actors[0].name);
    const cast = await runStoryboard(actors.map(a => ({ prompt: _castPrompt(a, style), intent: `${a.name}: ${a.desc}`,
        ratio: a.kind === 'place' ? inputs.ratio : '1:1' })),
        { name: castName, sheet: false },
        _deps(project, { ...opts, unit: 'picture', references: [] }, frame));
    if (!cast.ok) {
        StatusBar.notify(cast.message, 'warning');
        return false;
    }
    const left = wanted.slice(actors.length).map(a => a.name);
    StatusBar.notify(`${name}: drawing ${actors.map(a => a.name).join(', ')} first, so every panel shows the same one. The panels follow.`
        + (left.length ? ` ${left.join(', ')} stays in words: ${free > MAX_DRAWN_FIRST
            ? `at most ${MAX_DRAWN_FIRST} pictures are drawn first.`
            : `${model?.name || modelId} takes ${max} pictures.`}` : ''), 'info');
    return { finished: cast.finished.then(async (out) => {
        if (out.cancelled) {
            StatusBar.notify(`${name} stopped while drawing the cast: no panel was drawn.`, 'info');
            return out;
        }
        const drawn = out.panels.filter(r => r.item?.filePath);
        const missing = out.panels.filter(r => !r.item?.filePath).map(r => actors[r.index].name);
        if (missing.length) StatusBar.notify(`${name}: the picture of ${missing.join(', ')} failed, so the panels describe them in words.`, 'warning');
        // The cast pictures follow the user's in the edit, so each is image (user pictures + its place).
        const actorImages = Object.fromEntries(drawn.map((r, k) => [actors[r.index].name.toLowerCase(), references.length + k + 1]));
        const refs = [...references, ...drawn.map(r => ({ url: r.item.filePath }))]
            .map((r, i) => ({ role: i ? `inputImage${i + 1}` : 'inputImage', url: r.url }));
        const drawing = await _drawPanels(parseStoryboardPlan(inputs.plan, idea, actorImages), name, _deps(project, { ...opts, references: refs }, frame));
        return drawing ? drawing.finished : { ok: false, cancelled: !!frame?.stopped?.() };
    }) };
}

/**
 * A cast member alone and whole, so the panel model can lift it into any shot; a place empty
 * and wide, so every panel set there shows the same one. The panels' style opens AND closes the
 * prompt: "Anime film still. Reference picture of ... in even studio light" came back as 3D
 * product renders of a squirrel and a gold elephant (Fabio's bat-cave board, 2026-10-25), and a
 * cast drawn in mixed styles mixes every panel drawn from it.
 */
function _castPrompt({ name, desc, kind }, style) {
    const place = kind === 'place';
    const what = place
        ? `the place ${name}: ${desc}. A wide view of the whole place, empty: no people, animals or characters in it.`
        : `${name}: ${desc}. The whole of it in view and centred, alone on a plain light grey background. Nothing else in the picture.`;
    if (!style) return `Reference picture of ${what}${place ? '' : ' Even studio light.'}`;
    return `${style} of ${what} The same style as every panel: ${style.toLowerCase()}.`;
}

/** Queues the panels; the status bar names the end. */
async function _drawPanels(panels, name, deps) {
    const run = await runStoryboard(panels, { name }, deps);
    if (!run.ok) {
        if (run.code === 'CANCELLED') StatusBar.notify(`${name} stopped: no panel was drawn.`, 'info');
        else StatusBar.notify(run.message, 'warning');
        return false;
    }
    return { finished: run.finished.then((out) => {
        const { text, variant } = _summary(name, out);
        StatusBar.notify(text, variant);
        return out;
    }) };
}

/** Driver id (a FlowDef's `driver`) -> what Generate runs instead of the Flow's op. */
export const FLOW_DRIVERS = {
    storyboard: runStoryboardFlow,
    multiAngle: runMultiAngleFlow,
};
