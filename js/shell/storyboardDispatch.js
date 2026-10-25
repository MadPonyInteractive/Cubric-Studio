/**
 * storyboardDispatch.js — the app side of the Storyboard Flow (MPI-1231).
 *
 * `storyboardRunner.js` owns the order, landing and failure rules and touches the app only
 * through the `deps` built here. Each panel is an ordinary FLUX.3 Klein generation, built by
 * the SAME `buildGeneration` the agent and the routines use: `edit` with the user's pictures as
 * its references, `t2i` without. So a panel is a normal model card with its own prompt and
 * history, which the user edits, redoes or upscales like any other.
 *
 * `FLOW_DRIVERS` is what the Flow frame calls instead of `submitFlowGeneration` for a FlowDef
 * that declares `driver` (MpiBaseFlow `_run`).
 */

import { runStoryboard, parseStoryboardPlan } from '../services/storyboardRunner.js';
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

const MODEL_ID = 'flux3-klein';

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

function _deps(project, { idea, references, ratio, qualityTier, turbo }) {
    return {
        isLoopArmed: () => state.loopArmed === true,

        async submit(panel, index, landing) {
            const built = await buildGeneration({
                modelId: MODEL_ID,
                operation: references.length ? 'edit' : 't2i',
                positive: panel.prompt,
                media: references,
                turbo,
                ..._size(ratio, qualityTier),
            }, project);
            if (!built.ok) return built;
            // The user pressed Generate: their toasts show, and the child-safety gate reads
            // their own idea beside the panel prompt the planner wrote from it.
            const config = { ...built.config, byAgent: false, userWords: [idea, panel.prompt] };
            let settle;
            const done = new Promise((resolve) => { settle = resolve; });
            const queued = enqueueGeneration(config, {
                onComplete: ({ item, group }) => settle({ ok: true, item, group }),
                onError: (err) => settle({ ok: false, code: err?.code || 'RUNTIME_ERROR',
                    message: err?.userMessage || 'The panel failed. See the app log for the cause.' }),
                onCancel: (why) => settle(why?.stopped
                    ? { ok: false, code: 'CANCELLED', message: 'The user pressed Stop.' }
                    : { ok: false, code: 'NO_OUTPUT', message: 'Nothing came back for this panel.' }),
            }, landingOpts(landing, 'image', built.run.width, built.run.height));
            if (!queued) return { ok: false, code: 'REJECTED', message: `Panel ${index + 1} was rejected before it entered the queue.` };
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
 * @returns {Promise<boolean>} true once the panels are queued
 */
async function runStoryboardFlow(flow, inputs) {
    const project = state.currentProject;
    if (!project?.folderPath) {
        StatusBar.notify('Open a project first: the storyboard lands in its gallery.', 'warning');
        return false;
    }
    const idea = String(inputs.positive || '').trim();
    const panels = parseStoryboardPlan(inputs.plan, idea);
    if (!panels.length) {
        StatusBar.notify('Press Enhance to write the plan first, or write it yourself as [PANEL 1] Picture: ... Intent: ...', 'warning');
        return false;
    }
    const roles = flow.inputSchema.media[0].roles;
    const name = truncateCardName(idea ? `Storyboard · ${idea}` : 'Storyboard');
    const run = await runStoryboard(panels, { name }, _deps(project, {
        idea,
        references: _references(inputs.mediaItems || [], roles),
        ratio: inputs.ratio,
        qualityTier: inputs.qualityTier,
        turbo: inputs.turbo !== false,
    }));
    if (!run.ok) {
        StatusBar.notify(run.message, 'warning');
        return false;
    }
    run.finished.then((out) => {
        const { text, variant } = _summary(name, out);
        StatusBar.notify(text, variant);
    });
    return true;
}

/** Driver id (a FlowDef's `driver`) -> what Generate runs instead of the Flow's op. */
export const FLOW_DRIVERS = {
    storyboard: runStoryboardFlow,
};
