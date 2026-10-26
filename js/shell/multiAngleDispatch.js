/**
 * multiAngleDispatch.js — the app side of the Multi-angle Flow (MPI-1039).
 *
 * `multiAngleRunner.js` owns the describe, the plan and the chain, and touches the app only through
 * the `deps` built here. Each pass is an ordinary `edit` generation on FLUX.3 Klein or Qwen-Image 2.1,
 * built by the SAME `buildGeneration` the agent and the routines use, exactly as the bench ran it over
 * the connector (rounds 24-49): image 1 = the picture so far, image 2 = the doll ref or the user's
 * outfit picture, no ratio or tier, so each pass keeps image 1's frame (flow-spec.md § Model settings).
 *
 * `runMultiAngleFlow` is what the Flow frame calls for a FlowDef with `driver: 'multiAngle'`, once the
 * FlowDef exists (build phase 4).
 */

import { runMultiAngle } from '../services/multiAngleRunner.js';
import { MULTI_ANGLE_DESCRIBE_ASK, MULTI_ANGLE_LABELS, FLUX3, multiAngleMatchedZoom } from '../data/flowPrompts/multiAngle.js';
import { enqueueGeneration } from '../services/generationService.js';
import { describeImage } from '../services/llmService.js';
import { clientLogger } from '../services/clientLogger.js';
import { StatusBar } from './statusBar.js';
import { state } from '../state.js';
import { buildGeneration, nameCard } from './agentDispatch.js';
import { landingOpts } from './routineDispatch.js';

/** The card's name: the camera it shows. */
function _name(pick) {
    const { turn, height, zoom } = MULTI_ANGLE_LABELS;
    const parts = [turn[pick.turn] || turn.front, pick.height !== 'level' && height[pick.height],
        pick.zoom && zoom[pick.zoom]].filter(Boolean);
    return `Multi-angle · ${parts.join(', ')}`;
}

function _deps(project, { outfitWords, flow, inputs }, frame) {
    return {
        isLoopArmed: () => state.loopArmed === true,

        async describe(url) {
            // Queued: the read shows as its own row with Stop, before the first edit (no silent work).
            const r = await describeImage({ imagePath: url, question: MULTI_ANGLE_DESCRIBE_ASK, greedy: true, queued: true });
            clientLogger.info('multi-angle', r.ok ? `source read: ${String(r.text).replace(/\s+/g, ' ').slice(0, 300)}`
                : `source read failed: ${r.error}`);
            return r.ok ? { ok: true, text: r.text } : { ok: false, code: r.errorCode, message: r.error };
        },

        async ref(ref, imagePath) {
            try {
                const res = await fetch('/flows/multi-angle/ref', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ref, imagePath, folderPath: project.folderPath }),
                });
                const body = await res.json().catch(() => ({}));
                if (!body.ok) return { ok: false, message: body.error?.message || `HTTP ${res.status}` };
                return { ok: true, url: body.url };
            } catch (err) {
                return { ok: false, message: err.message };
            }
        },

        async submit(step, media, landing, { index, total }) {
            const built = await buildGeneration({
                modelId: step.model,
                operation: 'edit',
                positive: step.prompt,
                media,
                ...(step.model === FLUX3 ? { turbo: true } : {}),
            }, project);
            if (!built.ok) return built;
            // Stop was pressed during the describe, a ref fetch or this build: the chain ends here,
            // as stopped, and nothing more is queued (MPI-1293).
            if (frame?.stopped?.()) return { ok: false, code: 'CANCELLED', message: 'The user pressed Stop.' };
            // The user pressed Generate: their toasts show, and the child-safety gate reads their
            // own outfit words beside the pass prompt built from the picture.
            // `flowId` + `flowInputs` ride to the sidecar, so Reuse > Apply to App reopens Multi-angle with
            // the picture and camera that made this pass, not a bare edit.
            // flowStep: the status bar reads "Editing 1/2", so a chain does not look like the same pass twice.
            const config = { ...built.config, byAgent: false, userWords: [outfitWords, step.prompt].filter(Boolean),
                flowId: flow.id, flowInputs: inputs,
                ...(total > 1 ? { flowStep: `${index}/${total}` } : {}) };
            let settle;
            const done = new Promise((resolve) => { settle = resolve; });
            const opts = landingOpts(landing, 'image', built.run.width, built.run.height);
            const queued = enqueueGeneration(config, {
                onComplete: ({ item, group }) => settle({ ok: true, item, group }),
                onError: (err) => settle({ ok: false, code: err?.code || 'RUNTIME_ERROR',
                    message: err?.userMessage || 'The edit failed. See the app log for the cause.' }),
                onCancel: (why) => settle(why?.stopped
                    ? { ok: false, code: 'CANCELLED', message: 'The user pressed Stop.' }
                    : { ok: false, code: 'NO_OUTPUT', message: 'Nothing came back for this pass.' }),
            }, opts);
            if (!queued) return { ok: false, code: 'REJECTED', message: `The ${step.kind} pass was rejected before it entered the queue.` };
            // The Flow frame follows each pass by its queue id: live latents, sweep, Stop, the result.
            // Never the tempId: pass 2 on lands in pass 1's card and has none (MPI-1293).
            frame?.onJob?.(queued.queueJobId, done);
            return { ok: true, done };
        },
    };
}

/** What the user reads when the chain has ended. */
function _summary(name, out) {
    if (out.done === out.total) return { text: `${name} is ready.`, variant: 'success' };
    if (out.cancelled) return { text: `${name} stopped after ${out.done} of ${out.total} steps.`, variant: 'info' };
    const kept = out.done ? ` The first ${out.done} of ${out.total} steps are on the card.` : '';
    return { text: `${name} failed: ${out.error?.message || 'a step failed'}.${kept}`, variant: 'warning' };
}

/**
 * Generate on the Multi-angle Flow.
 * @param {Object} flow - the FlowDef
 * @param {Object} inputs - the frame's inputs: `angle` (the gizmo's { turn, height, zoom: a target rung
 *   or 'none' }), `outfitWords`, `mediaItems` (`inputImage` the person, optional `inputImage2` the outfit
 *   picture)
 * @param {{onJob?: function(string, Promise<Object>): void, stopped?: function(): boolean}} [frame] - the Flow
 *   frame, told of each pass it queues (its queueJobId and its `done`); `stopped()` is true once its Stop was pressed
 * @returns {Promise<false|{finished: Promise<Object>}>} false when nothing started; else the chain's end
 */
export async function runMultiAngleFlow(flow, inputs, frame) {
    const project = state.currentProject;
    if (!project?.folderPath) {
        StatusBar.notify('Open a project first: the new view lands in its gallery.', 'warning');
        return false;
    }
    const media = inputs.mediaItems || [];
    const url = role => media.find(m => m?.role === role && m.url && m.mediaType === 'image')?.url;
    // Step 2's match: an untouched one SHOWS front, eye level, whole body. An untouched
    // Generate gizmo has reported nothing: it SHOWS the matched view, so nothing moved.
    const start = { turn: inputs.start?.turn || 'front', height: inputs.start?.height || 'level',
        zoom: multiAngleMatchedZoom(inputs.start?.zoom) };
    const angle = inputs.angle || start;
    const pick = { turn: angle.turn || start.turn, height: angle.height || start.height,
        zoom: angle.zoom && angle.zoom !== 'none' && angle.zoom !== start.zoom ? angle.zoom : null, from: start };
    if (pick.turn === start.turn && pick.height === start.height && !pick.zoom) {
        StatusBar.notify('Pick a new view first: move Turn, Height or Zoom away from the view you matched.', 'warning');
        return false;
    }
    const outfitWords = String(inputs.outfitWords || '').trim();
    const name = _name(pick);
    const run = await runMultiAngle({ source: url('inputImage'), pick, outfit: { words: outfitWords, url: url('inputImage2') } },
        _deps(project, { outfitWords, flow, inputs }, frame));
    if (!run.ok) {
        StatusBar.notify(run.message, 'warning');
        return false;
    }
    return { finished: run.finished.then(async (out) => {
        if (out.group) await nameCard(out.group, name);
        const { text, variant } = _summary(name, out);
        StatusBar.notify(text, variant);
        return out;
    }) };
}
