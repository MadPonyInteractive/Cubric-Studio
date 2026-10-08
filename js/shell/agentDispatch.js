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
 * A submit ran in `state.currentProject` and nothing server-side could change it,
 * so without this an agent that created a project generated into the PREVIOUS
 * one — successfully, with `ok: true`, into the wrong gallery. MPI-873 lets the
 * submit name its project itself (`folderPath`, open or closed, `targetProject`),
 * so `project.open` is now only for moving the user's view.
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
import { submitFlowGeneration, cloudEditQuote } from '../services/flowService.js';
import { openProject, renameGroup, markGroup, serializeGroup, addGroup } from '../services/projectService.js';
import { createItemGroup } from '../data/projectModel.js';
import { STACK_TYPE, resultStackFields } from '../data/stackModel.js';
import { truncateCardName } from '../utils/displayHelpers.js';
import { CARD_MARKS, markOf, matchesGallerySort, byGalleryOrder, describeGalleryFilter, isGalleryFiltered } from '../utils/galleryFilter.js';
import { navigate, PAGE_GALLERY, PAGE_GROUP_HISTORY } from '../router.js';
import { on } from '../utils/dom.js';
import { Overlays } from '../managers/overlayManager.js';
import { activeMask } from './activeMask.js';
import { MODELS, getModelById, isOperationInstalled, getModelDepStatus } from '../data/modelRegistry.js';
import { DEPS } from '../data/modelConstants/dependencies.js';
import { resolveFullUniverse } from '../data/modelConstants/resolveModelDeps.js';
import { sizeToGb } from '../data/modelConstants/footprint.js';
import { getFlowById, listFlows, flowAvailability } from '../data/flowsRegistry.js';
import { retiredFlowMessage } from '../data/retiredFlows.js';
import { resolveFlowFieldValues, agentFieldSpecs } from '../utils/declaredFields.js';
import { enhanceFlowRun } from '../services/flowEnhance.js';
import { getCommand, getCommandMediaInputs, TTS_LANGUAGES, ttsLanguageValue } from '../data/commandRegistry.js';
import { resolveNamedParams, isValidSeed, resolveAgentMedia, namedParamsFor } from '../data/generationControls.js';
import { resolveActiveModel, getLastSelectedMediaType } from '../utils/modelHelpers.js';
import { CROP_RATIOS } from '../utils/ratios.js';
import { resolveMediaUrl, extractAbsPath } from '../utils/mediaActions.js';
import { stepValueToMedia } from '../components/Blocks/MpiBaseFlow/stepKinds.js';
import { composeNextPass } from '../components/Organisms/MpiStepCrop/MpiStepCrop.js';
import { planOutpaintPasses } from '../utils/outpaintPasses.js';
import { loadVoiceLibrary } from '../data/voiceLibrary.js';
import { voiceWavFile } from '../utils/toWavFile.js';
import { describeImage } from '../services/llmService.js';
import { estimateRunCost } from '../services/cloudExecutor.js';
import { formatPrice } from '../data/modelConstants/deepinfraPricing.js';
import { downloadService } from '../services/downloadService.js';
import { remoteEngineClient } from '../services/remoteEngineClient.js';
import { state } from '../state.js';
import { Events } from '../events.js';
import { runGifJob, GIF_HANDLERS } from './gifJobs.js';
import { ROUTINE_HANDLERS } from './routineDispatch.js';
import { AGENT_TOOL_OPS, TOOLS_NEEDING_SIZE, agentToolOp, toolOperation, toolRun } from './agentToolOps.js';
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
 * MPI-870 — one line saying which named params the agent CHOSE and which it inherited.
 *
 * Live on 2026-09-21 the agent said it used "a low denoise" and the sidecar recorded 0.3,
 * which is also the i2i op default: nothing on disk could settle whether it picked that or
 * fell into it, and the same hole covers duration. Deliberately the LOG and not the sidecar
 * — the sidecar route is `generationSettings.controlState`, which `promptReuse` reads back
 * and applies to the user's own settings, so a provenance key there would ride into them.
 */
function _logNamedParamProvenance(model, operation, provenance) {
    const parts = Object.entries(provenance || {}).map(([k, v]) => `${k}=${v.value} (${v.from})`);
    if (!parts.length) return;
    clientLogger.info('connector', `agent named params — ${model?.id}:${operation} — ${parts.join(', ')}`);
}

/**
 * Report a finished generation. A `cardName` (MPI-776) is applied first, through the
 * same `renameGroup` the rename route uses, so the reply describes the named card.
 * The gallery path awaits `addGroup` before it calls `onComplete`, so the card is
 * already in the project here.
 */
async function _reportDone(jobId, { item, group, items }, cardName, duration = null, modelId = null, closedProject = null, stackId = null) {
    // A batch lands as ONE report carrying every card, each with its SHARE of the one bill.
    const costUsd = (items || [item]).reduce((sum, it) => sum + (Number(it?.generationSettings?.cost?.usd) || 0), 0);
    const named = cardName !== undefined && group?.id ? await nameCard(group, cardName, closedProject) : null;
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
            // MPI-950: the new stack this card landed in (an agent fan-out).
            ...(stackId ? { stackId } : {}),
            // MPI-855: what this generation billed, for the chat's session spend.
            ...(costUsd > 0 ? { costUsd } : {}),
        },
    });
}

/**
 * Name a card that just landed. `renameGroup` finds it only in the OPEN project; a card an
 * agent sent to a closed one (MPI-873) is upserted there with its name, through the route
 * that registered it (`/project-groups` -> `updateProjectJson()`). If the user opened that
 * project meanwhile, `renameGroup` finds the card and the server write is never made.
 *
 * @param {object} group - the landed card
 * @param {string|null} cardName
 * @param {object|null} closedProject - the target when it was not the open project
 * @returns {Promise<object|null>} the named card, or null
 */
export async function nameCard(group, cardName, closedProject) {
    const named = await renameGroup(group.id, cardName);
    if (named || !closedProject?.folderPath) return named;
    const updated = { ...group, customName: cardName?.trim() || null };
    try {
        const res = await fetch('/project-groups', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ folderPath: closedProject.folderPath, groups: [serializeGroup(updated)] }),
        });
        if (res.ok) return updated;
        clientLogger.warn('connector', 'could not name the card in its closed project', { status: res.status, folderPath: closedProject.folderPath });
    } catch (err) {
        clientLogger.warn('connector', 'could not name the card in its closed project', { error: err.message, folderPath: closedProject.folderPath });
    }
    return null;
}

/**
 * The project a submit runs in (MPI-873): the one `input.folderPath` names, else the open
 * one. The route matched the name against the project list, so it arrives spelled as the app
 * spells a project it opens.
 *
 * The open project comes back as the LIVE `state.currentProject`, never a copy:
 * generationService decides where a card goes by comparing folderPaths, and a copy that read
 * as closed would have its card written server-side and then overwritten by the open
 * project's next save. A closed project is READ, not opened, so the user's view stays put.
 *
 * @returns {Promise<{project: object|null, open: boolean}|{error: {code: string, message: string}}>}
 */
export async function targetProject(input) {
    const open = state.currentProject;
    const same = (p) => p?.replace(/\\/g, '/').toLowerCase() === String(input.folderPath).replace(/\\/g, '/').toLowerCase();
    if (!input.folderPath || same(open?.folderPath)) return { project: open || null, open: !!open };
    try {
        const res = await fetch('/get-project', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ folderPath: input.folderPath }),
        });
        const data = await res.json();
        if (data?.success && data.project?.id) return { project: data.project, open: false };
        return { error: { code: 'PROJECT_NOT_FOUND', message: `Could not read the project at "${input.folderPath}": ${data?.error || 'no project there'}.` } };
    } catch (err) {
        return { error: { code: 'PROJECT_NOT_FOUND', message: `Could not read the project at "${input.folderPath}": ${err.message}.` } };
    }
}

/**
 * The model the pinned panel is showing — the one the user picked, per mediaType, the
 * way MpiGalleryBlock resolves it. Exported so the App state line can name it to the
 * agent: while pinned the agent still WRITES the prompt, and the Guide rule makes it
 * adapt that prompt to the model's own structure and vocabulary, so a pinned Klein told
 * nothing gets a Krea2-shaped prompt and a worse image than either party intended.
 */
export function pinnedModel() {
    return resolveActiveModel(getLastSelectedMediaType()).model;
}

/**
 * The pinned gate (MPI-774 Phase 7, Fabio 2026-09-19). One boolean decides who owns the
 * model, the op and the settings of an agent-dispatched generation; the agent keeps the
 * prompt, the media and the card name either way.
 *
 * The OP and the BATCH joined the pin in MPI-1017 (Fabio, 2026-10-04: "Cosmo should only
 * take care of reference images, videos, audio, and the prompt"). The panel was on Wan 3.0
 * t2v at $0.40 and the agent sent ref2v with the finished clip as its own reference: the
 * same model, a $1.90 quote. The op strip sits in that panel, so it was always read as one
 * of the user's settings; the op was the one the gate let through.
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
 * @param {string|null} [pinnedOp] the op the panel is showing (state.agentPinnedOp)
 * Raw `injectionParams` (the escape hatch) obey the same owner: pinned, they are dropped
 * with the named params, or the agent could still move a setting the user set (Fabio,
 * 2026-09-26).
 *
 * @returns {{model:object|null, operation:string|undefined, project:object|null, named:object, injectionParams:object, error?:{code:string,message:string}}}
 */
export function resolveSettingsOwner(input = {}, pinned, project, pinnedM, pinnedOp = null) {
    const { modelId, operation, ratio, qualityTier, turbo, styleSelect, stylization, duration, denoise, batch, category, language, injectionParams } = input;
    if (!pinned) {
        return {
            model: getModelById(modelId),
            operation,
            project: null,
            // `denoise` too: the connector validates it (NAMED_PARAM_KEYS), so dropping it
            // here ran the op default while the agent said it chose a low one.
            named: { ratio, qualityTier, turbo, styleSelect, stylization, duration, denoise, batch, category, language },
            injectionParams: injectionParams || {},
        };
    }
    if (!pinnedM) {
        return { model: null, project, named: {}, injectionParams: {}, error: { code: 'NO_PINNED_MODEL',
            message: 'The settings panel is open, so the user owns the model — but no model is selected. Ask them to pick one, or to close the settings panel and let you choose.' } };
    }
    // Deliberately a REFUSAL, not a silent swap. Dropping a mismatched modelId would run
    // the user's model under the agent's narration — "making this with Krea2" while Klein
    // ran — which is the same class of lie as the `{ started: true }` this phase killed.
    // The agent is told the pinned model in the App state line, so a mismatch is its error
    // to fix, and a concrete tool result beats a prompt rule (MPI-774, proven three times).
    if (modelId && modelId !== pinnedM.id) {
        return { model: null, project, named: {}, injectionParams: {}, error: { code: 'MODEL_PINNED',
            message: `Nothing was generated: the user has the settings panel open, so they own the model — it is "${pinnedM.id}" (${pinnedM.name}), not "${modelId}". Send this again with modelId "${pinnedM.id}", writing the prompt for that model. If it cannot do what was asked, say so and ask them to select a different one; you cannot change it. Also tell them they can close the settings panel instead, and you will pick the model.` } };
    }
    // Refused like the model, for the same reason: the media and the prompt were built for
    // the op the agent named, so running the panel's op under them is a different job.
    if (operation && pinnedOp && operation !== pinnedOp) {
        return { model: null, project, named: {}, injectionParams: {}, error: { code: 'OP_PINNED',
            message: `Nothing was generated: the user has the settings panel open, so they own the operation — it is "${pinnedOp}", not "${operation}". Send this again with operation "${pinnedOp}" and the media that op takes. If it cannot do what was asked, say so and ask them to select a different operation; you cannot change it. Also tell them they can close the settings panel instead, and you will pick.` } };
    }
    // `batch` is the panel's too (MPI-1017, reversing MPI-876's carve-out): dropped with the
    // rest, so the panel's saved number runs. The agent is told that number in its Settings
    // panel line, so it says how many are coming without choosing it.
    return { model: pinnedM, operation: pinnedOp || operation, project, named: {}, injectionParams: {} };
}

/**
 * MPI-877 — whether this submit runs against the user's painted mask, and whether it may
 * run at all without one.
 *
 * The agent does not PAINT a mask; it uses the one the user painted. Two halves, and both
 * were broken live on 2026-09-21:
 *
 * - A mask is attached to EVERY op, with no model or op check, because that is what the
 *   app itself does: `commandExecutor.js:791` injects `Input_Mask` on truthiness alone,
 *   and every local workflow declaring the node honours it. Localised editing is a
 *   property of the app, not of one model. Dispatch carried no mask at all, so an agent
 *   `edit` ran whole-image, silently, with `ok: true` — it repainted a whole subject when
 *   only a reflection was asked for.
 * - A `requiresMask` op is refused only when there is NO mask. The refusal used to be
 *   blanket, and it fired while the mask was already painted and on screen, sending the
 *   user away to run the op himself. So the message now says paint one, and never that
 *   this endpoint cannot supply it.
 *
 * Omitted rather than null when absent: `generationService` reads `config.maskDataUrl`
 * and a null would be indistinguishable from an unpainted canvas anyway.
 *
 * @param {string} operation
 * @param {{dataUrl: string, url: string, groupId: string}|null} mask - the mask painted
 *   right now, the image it was drawn over and the card that owns it, or null.
 * @returns {{ maskDataUrl: string|null, maskUrl: string|null, maskGroupId: string|null, error?: { code: string, message: string } }}
 */
export function resolveMask(operation, mask, areas = null) {
    if (!mask?.dataUrl && getCommand(operation)?.requiresMask) {
        return { maskDataUrl: null, maskUrl: null, maskGroupId: null, error: { code: 'MASK_UNSUPPORTED',
            message: `Nothing was generated: "${operation}" only runs on a painted mask, and none is painted. Ask the user to click the card in the gallery to open it, choose the Mask tool from the toolbar down the left, and paint over the area to change; send this again once they say it is drawn. You cannot paint it yourself.` } };
    }
    if (mask?.dataUrl && areas > 1 && ONE_AREA_OPS.has(operation)) {
        return { maskDataUrl: null, maskUrl: null, maskGroupId: null, error: { code: 'MASK_SEVERAL_AREAS',
            message: `Nothing was generated: the mask has ${areas} separate painted areas, and "${operation}" crops one box around all of them, so the result comes back unchanged. Ask the user to keep ONE area and run each area as its own edit, or use detail, which works each area on its own and takes one noun phrase per area.` } };
    }
    return { maskDataUrl: mask?.dataUrl || null, maskUrl: mask?.url || null, maskGroupId: mask?.groupId || null };
}

/** Ops that crop ONE box around every painted area (InpaintCrop), unlike `detail`. */
export const ONE_AREA_OPS = new Set(['edit', 'kleinEdit', 'krea2Edit', 'qwenEdit', 'inpaint']);

/**
 * Separate painted areas in a white-on-black mask, 8-connected on a coarse grid so a
 * stroke's own gaps do not split it. Specks under 0.5% of the grid are ignored.
 * ponytail: one grid-cell dilation; strokes two cells apart count as one area, which is
 * right for a crop box that small.
 * @param {Uint8ClampedArray} rgba @param {number} w @param {number} h
 */
export function countMaskAreas(rgba, w, h) {
    const on = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) if (rgba[i * 4] > 127) on[i] = 1;
    const grown = on.slice();
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (!on[y * w + x]) continue;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx, ny = y + dy;
            if (nx >= 0 && ny >= 0 && nx < w && ny < h) grown[ny * w + nx] = 1;
        }
    }
    const seen = new Uint8Array(w * h);
    const minCells = Math.max(1, Math.round(w * h * 0.005));
    let areas = 0;
    for (let start = 0; start < w * h; start++) {
        if (!grown[start] || seen[start]) continue;
        let size = 0;
        const stack = [start];
        seen[start] = 1;
        while (stack.length) {
            const i = stack.pop();
            if (on[i]) size++;
            const x = i % w, y = (i / w) | 0;
            for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
                const nx = x + dx, ny = y + dy, j = ny * w + nx;
                if (nx >= 0 && ny >= 0 && nx < w && ny < h && grown[j] && !seen[j]) { seen[j] = 1; stack.push(j); }
            }
        }
        if (size >= minCells) areas++;
    }
    return areas;
}

/** Decode a mask data URL to a 96px grid and count its areas; null when it cannot be read. */
async function _maskAreas(dataUrl) {
    try {
        const bmp = await createImageBitmap(await (await fetch(dataUrl)).blob());
        const scale = 96 / Math.max(bmp.width, bmp.height);
        const w = Math.max(1, Math.round(bmp.width * scale)), h = Math.max(1, Math.round(bmp.height * scale));
        const ctx = new OffscreenCanvas(w, h).getContext('2d');
        ctx.drawImage(bmp, 0, 0, w, h);
        return countMaskAreas(ctx.getImageData(0, 0, w, h).data, w, h);
    } catch {
        return null;
    }
}

/**
 * Where a masked submit LANDS. A mask is painted on an open card, so the edit is the next
 * version of that card — the same destination a Cue press in that workspace sends
 * (`MpiGroupHistoryBlock._generationFromPromptPayload`: `existingGroup` +
 * `scope: 'groupHistory'`). Dispatch had no card to name, so every agent submit went to
 * the gallery. Live 2026-09-22, round 2 of this card: the masked edit finally rendered,
 * correctly, and appeared as a new card `edit_003` — while the History workspace the user
 * was watching, mask still on screen, drew no latents and no result.
 *
 * A maskless submit names no card here; `workspaceGenerationOpts` below routes one that
 * edits an entry of the card the user is standing in. Everything else goes to the gallery.
 *
 * ponytail: resolved from `state.currentProject` rather than passed as an object —
 * `enqueueGeneration` wants the live group, and the reader publishes an id precisely so
 * dispatch never holds a component's object across a job.
 *
 * @param {string|null} maskGroupId
 * @returns {{ existingGroup: object, scope: string, groupId: string }|null} the opts the
 *   history path uses, or null when there is nothing to route to.
 */
export function maskedGenerationOpts(maskGroupId) {
    if (!maskGroupId) return null;
    const group = (state.currentProject?.itemGroups || []).find(g => g.id === maskGroupId);
    return group ? { existingGroup: group, scope: 'groupHistory', groupId: group.id } : null;
}

/**
 * Where a MASKLESS edit of the card the user is standing in lands (MPI-890). The same
 * destination a Cue press in that workspace sends — so latents draw where the user is
 * looking, and the result is the card's next version rather than a new card.
 *
 * Live 2026-09-22, MPI-890 live read 2: with the card open and the agent now TOLD which
 * entry was in front of the user, it edited exactly that entry, whole-picture — and the
 * result landed as a new gallery card while the open workspace drew nothing. The rule
 * above ("a maskless one names no card") predates the agent knowing where the user is.
 *
 * Keyed on the edited picture — the first media item, which `resolveAgentMedia` sorts
 * into the op's declared slot order.
 *
 * MPI-891 (D4, Fabio 2026-09-22) widened it from the OPEN card to the card that OWNS the
 * entry: "If the agent is going to perform something like an edit to an image, that needs
 * to happen in the history workspace." `_followWork` then opens that history. A card that
 * is not open must also hold the output's media type — a still turned into a clip is a new
 * card, not a video entry in an image card. The open card keeps MPI-890's rule unchanged.
 *
 * @param {Array<{url:string}>} mediaItems
 * @param {string} [mediaType] - the output's `model.mediaType`
 * @returns {{ existingGroup: object, scope: string, groupId: string }|null}
 */
export function workspaceGenerationOpts(mediaItems, mediaType = 'image') {
    const openId = state.currentPage === PAGE_GROUP_HISTORY ? state.currentParams?.groupId : null;
    const source = extractAbsPath(mediaItems?.[0]?.url);
    if (!source) return null;
    const same = (p) => p?.replace(/\\/g, '/').toLowerCase() === source.replace(/\\/g, '/').toLowerCase();
    const owns = (g) => g?.history?.some(item => same(extractAbsPath(item?.filePath)));
    const groups = state.currentProject?.itemGroups || [];
    const open = groups.find(g => g.id === openId);
    const group = owns(open) ? open : groups.find(g => g.type === mediaType && owns(g));
    return group ? { existingGroup: group, scope: 'groupHistory', groupId: group.id } : null;
}

// ── MPI-891: the view follows the work ───────────────────────────────────────────────
// Fed by app-lifetime listeners in `initAgentDispatch`. Module state, not `state`: nothing
// renders from either, and a pointer bit in the Proxy would fire `state:changed` per click.
let _pointerHeld = false;
let _overlayDepth = 0;

/** Canvas modes that are the user WORKING: a brush, a crop, a composite slot. */
const BUSY_CANVAS_MODES = new Set(['mask', 'paint', 'composite', 'crop']);

/**
 * Why the view must NOT move now, or null when it may (D2). Never mid-gesture: taking the
 * screen while the user paints a mask or drags a composite slot is hostile. An open
 * overlay (a Flow, the Model Manager, a modal) is its own surface — navigating under it
 * changes nothing they can see.
 *
 * @param {{ pointerHeld?: boolean, overlayDepth?: number, canvasMode?: string|null }} [now]
 * @returns {string|null}
 */
export function followBlocker({ pointerHeld = _pointerHeld, overlayDepth = _overlayDepth, canvasMode = state.canvasMode } = {}) {
    if (pointerHeld) return 'pointer-held';
    if (overlayDepth > 0) return 'overlay-open';
    if (BUSY_CANVAS_MODES.has(canvasMode)) return `canvas-${canvasMode}`;
    return null;
}

/**
 * Take the user to where an agent job renders (D1): its card's history when it lands in a
 * card, else the gallery. Only on `input.follow` — the loop sets it on a turn the user
 * typed, never on a wake or a carry, and a CLI agent never sends it. Called BEFORE the
 * enqueue, so the target workspace is mounted when the first frame arrives.
 *
 * ponytail: no word back to the model on a refusal. `/connector/generate` holds its reply
 * for the whole render, so there is no early channel; the chat's result card is the click
 * (D3). Add a relay ack if the agent ever has to SAY it stayed.
 *
 * @param {{ follow?: boolean }} input
 * @param {{ groupId: string }|null} historyOpts
 * @param {Parameters<typeof followBlocker>[0]} [now] - for tests; the live signals otherwise
 * @returns {{ page: string, params: object }|null} where to go, or null to stay
 */
export function followTarget(input, historyOpts, now) {
    if (!input?.follow || !state.currentProject) return null;
    const page = historyOpts ? PAGE_GROUP_HISTORY : PAGE_GALLERY;
    const here = state.currentPage === page
        && (!historyOpts || state.currentParams?.groupId === historyOpts.groupId);
    if (here) return null;
    const blocked = followBlocker(now);
    if (blocked) {
        clientLogger.info('connector', `agent job renders on ${page}; view stays (${blocked})`);
        return null;
    }
    return { page, params: historyOpts ? { groupId: historyOpts.groupId } : {} };
}

function _followWork(input, historyOpts) {
    const to = followTarget(input, historyOpts);
    if (to) navigate(to.page, to.params);
}

/**
 * A masked edit runs on the picture the mask was painted over — whatever image the model
 * named. The mask and its picture are one thing, and the engine asserts they are the same
 * size (`InpaintCropImproved`): live 2026-09-21 the mask came off the open card at
 * 768x1024 while the model edited the chat attachment it had been handed, a 512x682
 * thumbnail rendition, and five runs across two models died before rendering a pixel.
 *
 * Only `inputImage` moves — that is the slot every masked op edits (`kleinEdit`,
 * `krea2Edit`, `qwenEdit`, `edit`, `inpaint`, `detail`, `i2i`). Later ordinal slots are
 * references and stay exactly as the model sent them.
 *
 * A swap is not a correction to announce: the model named the only picture it could see.
 *
 * @param {Array} mediaItems
 * @param {string|null} maskUrl
 * @returns {Array} the items, with the edited slot pointing at the mask's own picture.
 */
export function bindMaskedSource(mediaItems, maskUrl) {
    if (!maskUrl) return mediaItems;
    return mediaItems.map(item => (
        item.role === 'inputImage' && item.url !== maskUrl ? { ...item, url: maskUrl } : item
    ));
}

/**
 * Run one `generation.submit` job. Every exit path reports exactly once — an
 * unreported job leaves the caller's HTTP request hanging until the route's
 * timeout, which reads as a dead app.
 */
async function _submitGeneration(jobId, input = {}) {
    // A Flow is an OPERATION with no model (`model.id: null`), so it can never
    // arrive as a modelId and needs its own resolution. One capability either way:
    // the caller asks for a generation, and `flowId` is what says which kind.
    if (input.flowId) return _submitFlow(jobId, input);
    // No model and no Flow: one of the agent's image tools (MPI-904).
    if (!input.modelId) return _submitTool(jobId, input);

    const target = await targetProject(input);
    if (target.error) return _fail(jobId, target.error.code, target.error.message);
    if (!target.project) {
        return _fail(jobId, 'NO_PROJECT', 'No project is open in Vision and the request named none. Send folderPath, or create or open a project, then send this request again.');
    }

    // A mask is painted on a card of the OPEN project; a run sent to another project
    // cannot be editing that card.
    const built = await buildGeneration(input, target.project, {
        pinned: state.agentSettingsPinned === true,
        painted: target.open ? activeMask() : null,
    });
    if (!built.ok) return _fail(jobId, built.code, built.message);
    const { config } = built;

    // A masked submit is a new version of the card the mask is painted on, and goes
    // where a Cue press in that workspace goes — no gallery placeholder, because a
    // `groupHistory` gen owns its own frames (MpiGroupHistoryBlock's `scope !==
    // 'groupHistory'` guard is what draws them). Both read the OPEN project's cards, so
    // a run sent to a closed one is always a new card.
    const historyOpts = target.open
        ? maskedGenerationOpts(built.maskGroupId) || workspaceGenerationOpts(config.mediaItems, config.model.mediaType || 'image')
        : null;

    return _enqueueAgentRun(jobId, input, config, target, historyOpts, built.run);
}

const _refuse = (code, message) => ({ ok: false, code, message });

/**
 * The installed models of a refused model's family, for its OP_UNAVAILABLE. Fabio's smoke
 * 2026-10-04: "the same video but with MiniMax H3" went to `minimax-h3`, not installed; the
 * refusal named only that, and the agent offered its 21 GB download with MiniMax H3
 * Reference installed and able to animate the picture. The user named a family, the id was
 * one member of it, and nothing named the member that was there.
 *
 * @param {object} model
 * @returns {string} '' when no other model of its `modelFamily` has an installed op
 */
export function installedKin(model) {
    if (!model?.modelFamily) return '';
    const kin = MODELS
        .filter(m => m.id !== model.id && m.modelFamily === model.modelFamily)
        .map(m => ({ m, ops: (m.supportedOps || []).filter(op => isOperationInstalled(m, op)) }))
        .filter(k => k.ops.length);
    if (!kin.length) return '';
    const names = kin.map(k => `${k.m.name} ("${k.m.id}": ${k.ops.join(', ')})`).join('; ');
    return ` Installed from the same family: ${names}. When one of those ops can do the ask (its note in list_models says what it does), run it there and say so in one line, rather than offering an install.`;
}

/**
 * The BUILD half of a model submit (MPI-970): who owns the model and settings, whether
 * the op is installed, the mask, the media, the seed and the named params, resolved into
 * the config `enqueueGeneration` takes. Enqueues nothing, so a routine step builds through
 * the same checks as the agent's submit; a routine passes no pin and no mask, and runs on
 * the model and settings it saved.
 *
 * @param {object} input - the `generation.submit` body, or a filled routine step + its media
 * @param {object} project - where the card lands (`_originProject`): the LIVE open project,
 *   or a closed one's record
 * @param {{pinned?: boolean, painted?: object|null}} [ctx] - the settings pin, and the mask
 *   painted on the open project right now
 * @returns {Promise<{ok: true, config: object, maskGroupId: string|null,
 *   run: {width: number, height: number, batchSize: number, duration: object|null}}
 *   |{ok: false, code: string, message: string}>}
 */
export async function buildGeneration(input, project, { pinned = false, painted = null } = {}) {
    const {
        modelId, positive = '', negative = '', media = [], seed,
    } = input;

    // Who owns the model, the op and the settings — see resolveSettingsOwner. `owner.project`
    // is NOT always state.currentProject: unpinned it is null on purpose, so the resolve
    // below lands on model defaults instead of the project's saved bucket.
    const owner = resolveSettingsOwner(input, pinned, state.currentProject,
        pinned ? pinnedModel() : null, pinned ? state.agentPinnedOp : null);
    if (owner.error) {
        return _refuse(owner.error.code, owner.error.message);
    }
    const operation = owner.operation;

    const model = owner.model;
    if (!model) {
        return _refuse('UNKNOWN_MODEL', `No model with id "${modelId}".`);
    }

    // Covers BOTH halves in one call: the op must be in supportedOps and its
    // weights must be on disk for the effective engine. Checked here so the agent
    // gets a named reason — commandExecutor's own net bails with a toast it cannot see.
    if (!isOperationInstalled(model, operation)) {
        // While pinned the agent cannot answer this by switching models, so the refusal
        // says what it CAN do instead: tell the user (Fabio's own example — "that makes
        // video, it doesn't make images, you need to select another model").
        return _refuse('OP_UNAVAILABLE', pinned
            ? `"${operation}" is not available on ${model.name || model.id} — unsupported, or its weights are not installed. The user has the settings panel open, so that model is theirs and you cannot change it: tell them this model cannot do it and ask them to select one that can - or to close the settings panel, and you will pick the model.`
            : `"${operation}" is not available on ${model.name || modelId} — unsupported, or its weights are not installed.${installedKin(model)}`);
    }

    const areas = painted && ONE_AREA_OPS.has(operation) ? await _maskAreas(painted.dataUrl) : null;
    const mask = resolveMask(operation, painted, areas);
    if (mask.error) {
        return _refuse(mask.error.code, mask.error.message);
    }

    // MPI-1012: a library voice on a model op's voice slot (Chatterbox's `audio1`) becomes
    // the same placed file a Flow's does.
    const voiced = await resolveVoices(operation, media, project, model.name);
    if (!voiced.ok) return _refuse(voiced.code, voiced.message);

    // MPI-765: media by reference, resolved exactly as the Flow branch resolves it.
    // Checked here for the same reason as the op: the enqueue guard's refusal is a toast.
    const resolvedMedia = resolveAgentMedia(operation, model, voiced.media);
    if (!resolvedMedia.ok) {
        return _refuse(resolvedMedia.code, resolvedMedia.message);
    }
    const mediaItems = bindMaskedSource(resolvedMedia.mediaItems, mask.maskUrl);

    if (seed !== undefined && !isValidSeed(seed)) {
        return _refuse('INVALID_SEED', 'seed must be an integer between 0 and 4294967295.');
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
        return _refuse(named.code, named.message);
    }
    _logNamedParamProvenance(model, operation, named.provenance);

    // Raw injectionParams is the documented escape hatch and wins over the resolved
    // named values (plan.md decision #3) - unless the user pinned the panel, when the
    // owner has already dropped them.
    const mergedInjection = { ...named.injectionParams, ...owner.injectionParams };
    const width = mergedInjection.Width || 0;
    const height = mergedInjection.Height || 0;

    const config = {
        operation,
        model,
        positive,
        negative,
        mediaItems,
        ...(mask.maskDataUrl ? { maskDataUrl: mask.maskDataUrl } : {}),
        // Explicit only — an unset seed must stay random, never pinned to 0.
        ...(seed !== undefined ? { seed } : {}),
        injectionParams: mergedInjection,
        byAgent: true,
        // MPI-873: where the card lands. The open project is the object enqueue would
        // freeze anyway; a closed one gets its card registered server-side.
        _originProject: project,
    };

    return {
        ok: true,
        config,
        maskGroupId: mask.maskGroupId,
        run: { width, height, batchSize: Number(mergedInjection.Input_Batch_Size) || 1, duration: named.duration },
    };
}

/**
 * `generation.submit` with no model and no Flow: one of the agent's image tools
 * (`agentToolOps.js`, MPI-904). The universal op the History rail runs, with the params
 * the rail sends, dispatched the way the rail dispatches it (`model.id: null`). An edited
 * card entry gets the result as its next entry, exactly as a model edit does.
 */
async function _submitTool(jobId, input = {}) {
    if (!agentToolOp(input.operation)) {
        return _fail(jobId, 'UNKNOWN_OPERATION', `"${input.operation}" needs a modelId. With no model, operation must be one of: ${AGENT_TOOL_OPS.map(t => t.op).join(', ')}.`);
    }
    const target = await targetProject(input);
    if (target.error) return _fail(jobId, target.error.code, target.error.message);
    if (!target.project) {
        return _fail(jobId, 'NO_PROJECT', 'No project is open in Vision and the request named none. Send folderPath, or create or open a project, then send this request again.');
    }
    const built = await buildTool(input, target.project);
    if (!built.ok) return _fail(jobId, built.code, built.message);
    const historyOpts = target.open ? workspaceGenerationOpts(built.config.mediaItems, 'image') : null;
    return _enqueueAgentRun(jobId, input, built.config, target, historyOpts);
}

/**
 * The BUILD half of a tool submit (MPI-970), shared with a routine's tool step: the
 * universal op and its params, resolved into an `enqueueGeneration` config.
 *
 * @param {{operation: string, fields?: object, media?: Array}} input
 * @param {object} project - where the card lands (`_originProject`)
 * @returns {Promise<{ok: true, config: object}|{ok: false, code: string, message: string}>}
 */
export async function buildTool(input, project) {
    const { operation, fields = {}, media = [] } = input;
    if (!agentToolOp(operation)) {
        return _refuse('UNKNOWN_OPERATION', `"${operation}" is not one of: ${AGENT_TOOL_OPS.map(t => t.op).join(', ')}.`);
    }
    const model = { id: null, mediaType: 'image' };
    const resolved = resolveAgentMedia(toolOperation(operation), model, media);
    if (!resolved.ok) return _refuse(resolved.code, resolved.message);

    // ponytail: decodes the picture for its size (crop, downscale); read the entry's
    // pixelDimensions instead if one over hundreds of 16K photos proves slow.
    let natural = null;
    if (TOOLS_NEEDING_SIZE.has(operation)) {
        try { natural = await _naturalSize(resolved.mediaItems[0].url); } catch { /* toolRun refuses it */ }
    }
    const run = toolRun(operation, fields, natural);
    if (!run.ok) return _refuse(run.code, run.message);

    return {
        ok: true,
        config: {
            operation: run.operation,
            model,
            positive: '',
            negative: '',
            mediaItems: resolved.mediaItems,
            injectionParams: run.injectionParams,
            byAgent: true,
            _originProject: project,
        },
    };
}

/**
 * The in-progress card a gallery gen draws until its result lands; its id is the gen's
 * `tempId`. Same shape the Cue path builds; `Generating...` is the name the grid renders
 * while `isGenerating` is true.
 */
export function galleryPlaceholder(type, width = 0, height = 0) {
    return {
        id: crypto.randomUUID(),
        type,
        name: 'Generating...',
        history: [],
        selectedIndex: 0,
        width,
        height,
        isGenerating: true,
    };
}

/**
 * The half of an agent submit that is the same for a model op and a tool: the gallery
 * placeholder, following the work, the enqueue and its reports.
 */
/**
 * MPI-950 — the stack an agent fan-out item lands in: `{ id, total, kind }`, or null. Only a
 * NEW card joins one; an edit is its own card's next version (`historyOpts`) and stays put.
 * A stack holds pictures or videos. ponytail: open project only; a closed one's cards land loose.
 */
export function agentResultStack(input, model, historyOpts, target) {
    const kind = model?.mediaType || 'image';
    if (!input?.resultStack || historyOpts || !target?.open || !['image', 'video'].includes(kind)) return null;
    return { ...input.resultStack, kind };
}

/** Result stacks already added, by id: a fan-out's items arrive faster than `addGroup` lands. ponytail: never pruned, one uuid per fan-out. */
const _agentStacks = new Set();

function _enqueueAgentRun(jobId, input, config, target, historyOpts, { width = 0, height = 0, batchSize = 1, duration = null } = {}) {
    const { model } = config;
    // A gallery gen MUST carry a tempId + placeholderGroup or the run is invisible
    // until it finishes: MpiGalleryBlock draws in-progress cards from the
    // activeGenerations entry's `placeholderGroup`, and live latents route by
    // tempId (preview:frame -> activeGenerations.byPromptId -> entry.tempId).
    // Without them an agent submit ran for its full duration behind an empty
    // gallery, then the card appeared at the end — the Cue panel was the only
    // sign anything was happening.
    const placeholderGroup = galleryPlaceholder(model.mediaType || 'image', width, height);
    const tempId = placeholderGroup.id;
    // A batch draws one card per image up front (MPI-876), the same shape the gallery's
    // own Cue builds (MpiGalleryBlock `_galleryGenerationOptions`).
    const extraTempIds = Array.from({ length: Math.max(1, batchSize) - 1 }, () => crypto.randomUUID());
    const extraPlaceholders = extraTempIds.map((id) => ({ ...placeholderGroup, id, history: [] }));

    const stack = agentResultStack(input, model, historyOpts, target);

    // Following a run into a project the user does not have open would open it for them.
    if (target.open) _followWork(input, historyOpts);
    const queued = enqueueGeneration(config, {
        // A card name names a NEW card. Added to the user's own card, it would rename theirs.
        onComplete: (done) => _reportDone(jobId, done, historyOpts ? undefined : input.cardName, duration, model.id,
            target.open ? null : target.project, stack?.id),
        // An `outputKind: 'text'` op produces a caption and no item (MPI-310).
        onText: (text) => _report(jobId, { ok: true, output: { text } }),
        // A cloud failure names itself (MPI-869: e.g. LOW_BALANCE with the cost and what
        // is left), so the agent can tell the user why; anything else stays generic.
        onError: (err) => _fail(jobId, err?.code || 'RUNTIME_ERROR',
            err?.userMessage || 'The generation failed. See the app log for the cause.'),
        onCancel: () => _fail(jobId, 'CANCELLED',
            'The generation was cancelled or produced no output.'),
    }, historyOpts || { scope: 'gallery', tempId, placeholderGroup, extraTempIds, extraPlaceholders, ...(stack ? { stackId: stack.id } : {}) });

    // A guard inside enqueueGeneration rejects by returning null — it fires
    // onCancel on its way out, so the report is already in flight. Belt and braces
    // for a future guard that returns null silently.
    if (!queued) {
        return _fail(jobId, 'REJECTED', 'Vision rejected the job before it entered the queue.');
    }
    // The job FIRST, the stack after: the settle drops a filling stack with no live job.
    if (stack && !_agentStacks.has(stack.id)) {
        _agentStacks.add(stack.id);
        addGroup({ ...createItemGroup(STACK_TYPE, resultStackFields({ kind: stack.kind, name: truncateCardName(getCommand(config.operation)?.label || config.operation), expected: stack.total })), id: stack.id });
    }
    if (!_settled.has(jobId)) _queueJobs.set(jobId, queued.queueJobId);
    return null;
}

/**
 * `generation.quote` — what this submit would cost, without submitting it (MPI-876).
 *
 * The agent has to name a figure BEFORE it spends, and it holds a ratio LABEL and no
 * pixels. The price is a function of the pixels actually sent: `priceImageUnits` scales
 * by (w x h) / 1 MP, and `deepinfraSizing` fits a size to the endpoint's own bounds on
 * the way out. So the quote has to be taken HERE, where the run is resolved, and through
 * `estimateRunCost` — the same call the prompt box's price tag makes (MPI-852). Pricing
 * it in the loop would be a second copy of the arithmetic, and the two surfaces would
 * quote different money for one run.
 *
 * A READ: it resolves and prices, and dispatches nothing. It has its OWN capability and
 * its own route rather than a flag on the submit, so a mistyped field can never turn a
 * quote into a generation, or a generation into a silent no-op.
 *
 * `billed: false` means "no card needed" and is the answer for every local model. It is
 * deliberately what an unresolvable call falls back to: that call is about to fail in
 * `_submitGeneration` for the same reason, spending nothing. `billed: true` with
 * `display: null` is the opposite case and must still raise a card — the model bills and
 * the price is not knowable, which is a sentence, not a reason to skip the question.
 *
 * @param {object} input - the `generation.submit` body, plus `count` for a fan-out.
 */
function _quoteGeneration(jobId, input = {}) {
    const count = Math.max(1, Math.round(Number(input.count) || 1));
    // A Flow carries no model id (`model.id: null`), but its edit slot can resolve to a
    // cloud model (MPI-918), and then every run bills like one.
    if (input.flowId) {
        const flow = getFlowById(String(input.flowId));
        const quote = flow ? cloudEditQuote(flow) : null;
        if (!quote) return _report(jobId, { ok: true, output: { billed: false } });
        const usd = quote.usd === null ? null : quote.usd * count;
        return _report(jobId, { ok: true, output: {
            billed: true,
            modelName: `${flow.title} on ${quote.model.name}`,
            count,
            usd,
            display: usd === null ? null : formatPrice(usd),
        } });
    }

    const pinned = state.agentSettingsPinned === true;
    const owner = resolveSettingsOwner(input, pinned, state.currentProject,
        pinned ? pinnedModel() : null, pinned ? state.agentPinnedOp : null);
    const model = owner.model;
    const operation = String(owner.operation || '');
    // `provider` is the whole discriminator (MPI-851): a model that has one runs on the
    // user's own key and bills them, and a model that has none cannot cost anything.
    if (!model?.provider) return _report(jobId, { ok: true, output: { billed: false } });

    const modelName = model.name || model.id;
    // Best effort from here down. Every failure below loses the NUMBER, never the card:
    // the answer stays `billed: true` and the gate says it cannot be quoted.
    const named = resolveNamedParams(owner.project, model, operation, owner.named);
    const params = { ...(named.ok ? named.injectionParams : {}), ...owner.injectionParams };
    const media = resolveAgentMedia(operation, model, input.media || []);
    const quote = estimateRunCost(model, params, media.ok ? media.mediaItems : []);

    // A fan-out is N separate calls and N bills of this same run, so the total is the
    // unit times the count — multiplied as a NUMBER and formatted once. `display` itself
    // can never be multiplied: below a cent it carries one significant figure, so six
    // lots of "about $0.0005" cannot be read back out of the string.
    const usd = quote ? quote.usd * count : null;
    // A ceiling stays one (MPI-1017): re-formatting the total dropped the "up to" off a
    // reference clip of unknown length, and the card read "costs about $1.90".
    const display = usd === null ? null : formatPrice(usd);

    return _report(jobId, { ok: true, output: {
        billed: true,
        modelName,
        count,
        usd,
        display: display && quote.display?.startsWith('up to ') ? display.replace(/^about /, 'up to ') : display,
    } });
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
 * `grow` puts ALL the new area on one side (MPI-900): "expand it up" for text above an
 * Instagram post is `up`, and centring it split the room in two, half of it where nobody
 * wanted it. A shape only grows one axis, so a side on the other axis is null, not a guess.
 *
 * @param {{w:number,h:number}} natural  the source image's real pixels
 * @param {number} ratio                 target aspect, w/h
 * @param {'up'|'down'|'left'|'right'} [grow]  the one side to grow; omitted = both, evenly
 * @returns {{x:number,y:number,w:number,h:number}|null} null when `grow` is on the axis
 *   this shape does not grow
 */
export function frameRectForRatio(natural, ratio, grow) {
    const { w: nw, h: nh } = natural;
    let w = nw;
    let h = nh;
    if (ratio < nw / nh) h = Math.round(nw / ratio);  // taller than the source → grow top+bottom
    else if (ratio > nw / nh) w = Math.round(nh * ratio); // wider → grow left+right
    const vertical = h !== nh;
    if (grow && vertical !== (grow === 'up' || grow === 'down')) return null;
    const x = grow === 'left' ? nw - w : grow === 'right' ? 0 : Math.round((nw - w) / 2);
    const y = grow === 'up' ? nh - h : grow === 'down' ? 0 : Math.round((nh - h) / 2);
    return { x, y, w, h };
}

/** The sides `frame.grow` takes. */
export const FRAME_GROW_SIDES = ['up', 'down', 'left', 'right'];

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
async function _placePreviewAsset(file, project, ext = '.png') {
    const dataUrl = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(/** @type {string} */ (r.result));
        r.onerror = reject;
        r.readAsDataURL(file);
    });
    const res = await fetch(
        `/project-media/${project.id}/place-preview-asset?folderPath=${encodeURIComponent(project.folderPath)}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dataUrl, ext }) },
    );
    if (!res.ok) throw new Error(`place failed: ${res.status}`);
    const data = await res.json();
    return data?.success ? data.filePath : null;
}

/**
 * The `runNextPass` hook flowService calls as each pass completes (MPI-900): the previous
 * RESULT padded out to the next frame, swapped into the source's slot. MpiBaseFlow's
 * `_planPasses` is the same hook over the user's frame; this one runs with no frame open.
 *
 * @param {Array<Object>} plan - every pass's frame in source px (`planOutpaintPasses`)
 * @param {Array<Object>} mediaItems - the run's media, pass 1's padded picture in it
 * @param {Object} source - the item in `mediaItems` each pass replaces
 * @param {Object} project - the project the run lands in, open or not (MPI-873)
 */
function _nextPassFor(plan, mediaItems, source, project) {
    let ran = 0; // index of the pass that just completed
    return async ({ item } = {}) => {
        const file = await composeNextPass(item, plan[ran], plan[ran + 1]);
        ran += 1;
        const url = file ? await _placePreviewAsset(file, project) : null;
        return url ? {
            media: mediaItems.map(m => (m === source ? { ...m, url, filePath: url } : m)),
            last: ran === plan.length - 1,
        } : null;
    };
}

async function _submitFlow(jobId, input = {}) {
    const target = await targetProject(input);
    if (target.error) return _fail(jobId, target.error.code, target.error.message);
    if (!target.project) {
        return _fail(jobId, 'NO_PROJECT', 'No project is open in Vision and the request named none. Send folderPath, or create or open a project, then send this request again.');
    }
    const built = await buildFlow(input, target.project);
    if (!built.ok) return _fail(jobId, built.code, built.message);

    // A Flow always lands in the gallery (Fabio, 2026-09-22), so that is where it is watched,
    // unless it lands in a project the user does not have open.
    if (target.open) _followWork(input, null);
    const queued = submitFlowGeneration(built.flow, built.inputs, {
        onComplete: (done) => _reportDone(jobId, done, input.cardName, null, null, target.open ? null : target.project),
        onText: (text) => _report(jobId, { ok: true, output: { text } }),
        // A cloud failure names itself (MPI-869: e.g. LOW_BALANCE with the cost and what
        // is left), so the agent can tell the user why; anything else stays generic.
        onError: (err) => _fail(jobId, err?.code || 'RUNTIME_ERROR',
            err?.userMessage || 'The generation failed. See the app log for the cause.'),
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

// ── Library voices (MPI-1004) ────────────────────────────────────────────────────────────
//
// A voice slot (`inputSchema.media[].voiceLibrary`, index-aligned with `roles`) takes a
// shipped library voice by id as well as a file: `{ role, voice }`. The catalogue lists the
// voices on the slot; a submit or an open turns the id into the same file the picker makes.

let _voiceLibLoad = null;
/** The shipped voice library, fetched once. A failed fetch is tried again next time. */
function _voiceLib() {
    _voiceLibLoad ??= loadVoiceLibrary().catch((err) => { _voiceLibLoad = null; throw err; });
    return _voiceLibLoad;
}

/**
 * role -> the library route that slot offers ('character' / 'narration'), for one Flow, or
 * for one model OP (a string) whose slot declares `voiceLibrary` — Chatterbox's `tts`
 * (MPI-1012), which carried its library over from the Text to Speech Flow.
 */
function _voiceRoutes(source) {
    const routes = {};
    if (typeof source === 'string') {
        for (const s of getCommandMediaInputs(source)) if (s.voiceLibrary) routes[s.key] = s.voiceLibrary;
        return routes;
    }
    for (const g of source?.inputSchema?.media || []) {
        (g.roles || []).forEach((role, i) => { if (g.voiceLibrary?.[i]) routes[role] = g.voiceLibrary[i]; });
    }
    return routes;
}

/**
 * The voices each voice slot offers, for the catalogue: one row per SECTION, its variation
 * ids beside it. The library is fifteen performers, not fifty-six voices (voiceLibrary.js
 * § listSections), and fifteen rows is what an agent can match "an old man" against.
 * @returns {Object<string, Array<{name:string, gender?:string, age?:string, ids:string[]}>>|null}
 */
export function slotVoices(source, lib) {
    const routes = Object.entries(_voiceRoutes(source));
    if (!lib || !routes.length) return null;
    return Object.fromEntries(routes.map(([role, kind]) => [role, lib.listSections({ kind }).map((s) => {
        const { gender, age } = s.voices[0];
        return { name: s.label, ...(gender ? { gender } : {}), ...(age ? { age } : {}), ids: s.voices.map(v => v.id) };
    })]));
}

/**
 * `{ role, voice }` refs become the `{ role, url }` every other ref is: the sample through
 * the picker's own decode (`voiceWavFile`), placed in the project's store. An id the slot's
 * library lacks, or a slot with no library, is refused by name (INVALID_ so the caller's
 * "call describe_model" hint fires).
 * @returns {Promise<{ok:true, media:Array}|{ok:false, code:string, message:string}>}
 */
export async function resolveVoices(source, media, project, title = source?.title) {
    const list = Array.isArray(media) ? media : [];
    if (!list.some(m => m?.voice)) return { ok: true, media: list };
    const routes = _voiceRoutes(source);
    try {
        const lib = await _voiceLib();
        const out = [];
        for (const m of list) {
            if (!m?.voice) { out.push(m); continue; }
            if (!routes[m.role]) return { ok: false, code: 'INVALID_VOICE', message: `${title}'s "${m.role}" slot takes no library voice.` };
            const voice = lib.listVoices({ kind: routes[m.role] }).find(v => v.id === String(m.voice));
            if (!voice) return { ok: false, code: 'INVALID_VOICE', message: `No library voice "${m.voice}" for ${title}'s "${m.role}" slot.` };
            const url = await _placePreviewAsset(await voiceWavFile(voice), project, '.wav');
            if (!url) throw new Error('the project would not take the file');
            out.push({ role: m.role, url });
        }
        return { ok: true, media: out };
    } catch (err) {
        return { ok: false, code: 'RUNTIME_ERROR', message: `The library voice could not be loaded: ${err?.message || err}` };
    }
}

/**
 * The BUILD half of a Flow submit (MPI-970), shared with a routine's Flow step: the Flow,
 * its installed check, media, box params, the frame and the declared fields, resolved into
 * the inputs `submitFlowGeneration` takes. Enqueues nothing; a frame's padded picture IS
 * stored in the project here, since the run needs it as a file.
 *
 * @param {{flowId: string, fields?: object, media?: Array, params?: object}} input
 * @param {object} project - where the card lands (`runOriginProject`)
 * @returns {Promise<{ok: true, flow: object, inputs: object}|{ok: false, code: string, message: string}>}
 */
export async function buildFlow(input, project) {
    const { flowId, fields = {}, media = [], params = {} } = input;

    const flow = getFlowById(flowId);
    if (!flow) {
        return _refuse('UNKNOWN_FLOW', retiredFlowMessage(flowId) || `No flow with id "${flowId}".`);
    }

    // submitFlowGeneration pre-flights this itself, but it reports through a TOAST
    // and returns a bare null — an agent sees neither. Ask the same question here
    // so the weights that are missing come back BY NAME.
    const availability = flowAvailability(flow);
    if (!availability.available) {
        const absent = [...(availability.missing || []), ...(availability.missingDeps || [])];
        return _refuse('OP_UNAVAILABLE',
            `${flow.title} is not installed — missing: ${absent.join(', ') || 'required files'}.`);
    }

    const voiced = await resolveVoices(flow, media, project);
    if (!voiced.ok) return _refuse(voiced.code, voiced.message);

    // The op owns the slot vocabulary; the caller names a role. One resolver for both
    // branches (generationControls.js § resolveAgentMedia).
    const resolvedMedia = resolveAgentMedia(flow.operation, null, voiced.media);
    if (!resolvedMedia.ok) {
        return _refuse(resolvedMedia.code, resolvedMedia.message);
    }
    const { mediaItems } = resolvedMedia;

    // The SHARED predicate, not a copy — three guards answering "is a required slot
    // empty?" must never be able to disagree (generationService § findMissingMediaSlot).
    // Text to Speech is the case that matters: its `audio1` is required because the
    // graph's MpiLoadAudio carries `block_if_empty`, and without this the run comes
    // back a SUCCESS with no output.
    const missingSlot = findMissingMediaSlot(flow.operation, mediaItems);
    if (missingSlot) {
        return _refuse('MEDIA_REQUIRED',
            `${flow.title} needs ${missingSlot.mediaType} in its "${missingSlot.key}" slot.`);
    }

    // Validate and merge box `params` (MPI-774). Each key in `params` must name
    // a step with `kind: 'box'` and a matching `param` id; the box values are
    // integers; ratio:1 steps require a square box; bounds are checked unless the
    // step declares `overflow: 'allow'` or image dimensions are unavailable.
    const boxParamValidation = validateBoxParams(flow, params);
    if (!boxParamValidation.ok) {
        return _refuse(boxParamValidation.code, boxParamValidation.message);
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
    let passPlan = null;
    let cropSource = null;
    if (cropStep) {
        const label = params.frame?.ratio;
        const ratio = _cropRatioValue(label);
        if (!ratio) {
            return _refuse('FRAME_REQUIRED',
                `Nothing was generated: ${flow.title} grows a picture past its edges, so it needs the shape you want it to become — ${label ? `"${label}" is not one it offers` : 'your call passed none'}. Send it again with params: { frame: { ratio: "<one of these>" } }, plus grow: "up", "down", "left" or "right" when the new room goes on one side only: ${CROP_RATIO_LABELS.join(', ')}.`);
        }

        const grow = params.frame?.grow; // a side, or absent: validateBoxParams checked it
        const source = mediaItems.find(m => m?.role === cropStep.role);
        if (!source?.url) {
            return _refuse('MEDIA_REQUIRED',
                `${flow.title} needs an image in its "${cropStep.role}" slot to grow.`);
        }

        let padded = null;
        try {
            const natural = await _naturalSize(source.url);
            const rect = frameRectForRatio(natural, ratio, grow);
            if (!rect) {
                const taller = ratio < natural.w / natural.h;
                return _refuse('FRAME_DIRECTION',
                    `Nothing was generated: ${label} makes this ${natural.w}x${natural.h} picture ${taller ? 'TALLER, so it grows up or down' : 'WIDER, so it grows left or right'}, never ${grow}. Pick a ${taller ? 'wider' : 'taller'} shape to grow ${grow}, or grow ${taller ? '"up" or "down"' : '"left" or "right"'}.`);
            }
            // More than one pass holds (MPI-900): pass 1 runs at the first capped frame and
            // each next pass on the previous RESULT, the same plan the flow frame runs.
            passPlan = cropStep.maxGrow ? planOutpaintPasses(natural, rect, cropStep.maxGrow) : null;
            // `composePaddedImage` returns null for a rect that matches the source exactly.
            // That is this flow doing nothing, so say so rather than spending a generation
            // to hand back a re-render of what the user already has.
            const file = await stepValueToMedia(cropStep.kind, { crop: passPlan ? passPlan[0] : rect }, source, cropStep, null);
            if (!file) {
                return _refuse('FRAME_UNCHANGED',
                    `Nothing was generated: that picture is already ${label} (${natural.w}x${natural.h}), so there is nothing to grow. Pick a different shape, or tell the user it is already the one they asked for.`);
            }
            padded = await _placePreviewAsset(file, project);
        } catch (err) {
            clientLogger.error('connector', 'agent frame derivation failed', err);
            return _refuse('RUNTIME_ERROR', `The frame could not be built: ${err.message}`);
        }
        if (!padded) {
            return _refuse('RUNTIME_ERROR', 'The framed image could not be stored in the project.');
        }
        // A padded picture REPLACES the picture it padded (stepKinds.js § STEP_MEDIA);
        // `crop` is deliberately not one of the kinds that delivers to a second role.
        source.url = padded;
        source.filePath = padded;
        cropSource = source;
    }

    const { inputs, injectionParams: fieldInjection, unknown } = resolveFlowFieldValues(flow, fields);
    if (unknown.length) {
        // The fields the agent was SHOWN: a hidden one (Song's caption blocks) is the Flow's own.
        const known = agentFieldSpecs(flow).map(f => f.id).join(', ');
        return _refuse('BAD_REQUEST',
            `${flow.title} declares no field ${unknown.map(k => `"${k}"`).join(', ')}. Fields: ${known || 'none'}.`);
    }

    // The Flow's own enhance pass (MPI-1002), on the enhancer picked in Remote, exactly as a
    // hand run's Generate does it — the agent and routines reach a Flow only through here.
    // It writes only blank targets, and a failed enhancer submits nothing.
    const enhanced = await enhanceFlowRun(flow, { inputs, injectionParams: fieldInjection });
    if (!enhanced.ok) return _refuse(enhanced.code, enhanced.message);

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

    const injectionParams = { ...fieldInjection, ...enhanced.injectionParams, ...boxInjection };

    return {
        ok: true,
        flow,
        inputs: {
            ...inputs,
            ...enhanced.inputs,
            mediaItems,
            ...(Object.keys(injectionParams).length ? { injectionParams } : {}),
            ...(passPlan ? { runNextPass: _nextPassFor(passPlan, mediaItems, cropSource, project) } : {}),
            runOriginProject: project,
        },
    };
}

/** What `followBlocker` found, in words the agent can pass on. */
const BUSY_WORDS = {
    'pointer-held': 'in the middle of a click or drag',
    'overlay-open': 'using something open over the app (a Flow or a window)',
};

/** A step's hint as one line: a string, lines, or per-mode lines (the first mode). */
function _hintText(hint) {
    const lines = hint && typeof hint === 'object' && !Array.isArray(hint) ? Object.values(hint)[0] : hint;
    return [].concat(lines || []).join(' ');
}

/**
 * `flow.open` (MPI-892) — the agent hands a Flow over instead of running it. The Flow opens on
 * the user's screen with what the agent filled, at the step the user works in, and NOTHING
 * runs until they press Generate. Fabio, 2026-09-30: the three Flows that need the user's hands
 * (Draw It In, Scribble, Object Stamp) declare `agentOpens`; any other Flow opens this way when
 * the agent is asked to (Song's "Review lyrics"), or lacks an input only the user has (a voice
 * sample).
 *
 * Its own capability and route (`POST /connector/open-flow`), never a flag on a submit: the
 * `/connector/quote` rule — a dropped flag must fall towards not running.
 *
 * Filled through the store Reuse restores through (`openFlowFromReuse`): `s_flowInputs`,
 * seeded before `flow:open` and read by MpiBaseFlow on mount. Media and declared fields
 * resolve exactly as a run's do; an empty slot, a box or a frame is the user's to fill there,
 * so the run's refusals for those do not apply. Only on `follow` (a turn the user typed), and
 * never over something the user is doing: the same guard as the view moving (MPI-891).
 */
export async function openFlow(jobId, input = {}) {
    if (!input.follow) {
        return _fail(jobId, 'NOT_NOW', 'A Flow opens on the user\'s screen only in reply to something they typed.');
    }
    if (!state.currentProject) {
        return _fail(jobId, 'NO_PROJECT', 'No project is open, and a Flow opens in the open project.');
    }
    const flow = getFlowById(input.flowId);
    if (!flow) return _fail(jobId, 'UNKNOWN_FLOW', retiredFlowMessage(input.flowId) || `No flow with id "${input.flowId}".`);
    const blocked = followBlocker();
    if (blocked) {
        return _fail(jobId, 'VIEW_BUSY', `Nothing was opened: the user is ${BUSY_WORDS[blocked] || 'working on the picture'}. Tell them you will open ${flow.title} once they are done, and send it again when they say so.`);
    }
    const voiced = await resolveVoices(flow, input.media, state.currentProject);
    if (!voiced.ok) return _fail(jobId, voiced.code, voiced.message);
    const resolved = resolveAgentMedia(flow.operation, null, voiced.media, { allowEmpty: true });
    if (!resolved.ok) return _fail(jobId, resolved.code, resolved.message);
    const { mediaItems } = resolved;
    const { inputs, injectionParams, unknown } = resolveFlowFieldValues(flow, input.fields || {});
    if (unknown.length) {
        const known = agentFieldSpecs(flow).map(f => f.id).join(', ');
        return _fail(jobId, 'BAD_REQUEST',
            `${flow.title} declares no field ${unknown.map(k => `"${k}"`).join(', ')}. Fields: ${known || 'none'}.`);
    }

    // A step that CREATES its picture fills the slot at run time (Scribble's blank canvas), so
    // an empty one is not missing — MpiBaseFlow's `_stepDerivesOwnMedia`, the same question.
    const empty = (flow.steps || []).some(s => s?.composite) ? null : findMissingMediaSlot(flow.operation, mediaItems);
    // MPI-1004: the user chose to pick the voice themselves, so the Flow opens on its inputs with
    // that slot's picker already in the library. Only a slot that HAS a library.
    const pickVoice = _voiceRoutes(flow)[input.pickVoice] ? input.pickVoice : null;
    // A missing input comes first: its step is where the user adds it. Else the Flow's own step,
    // else the first after Inputs: an open with everything filled is the user reviewing it (Song's
    // lyrics, Fabio), so Generate only for a Flow with no middle step.
    const openAt = empty || pickVoice ? 'inputs' : (flow.agentOpens || flow.steps?.[0]?.kind || 'run');
    state.s_flowInputs = {
        ...state.s_flowInputs,
        [flow.id]: { ...inputs, mediaItems, ...(Object.keys(injectionParams).length ? { injectionParams } : {}) },
    };
    Events.emit('flow:open', { flowId: flow.id, openAt, ...(pickVoice ? { pickVoice } : {}) });

    const step = (flow.steps || []).find(s => s.kind === openAt);
    const hint = _hintText(step?.hint);
    return _report(jobId, { ok: true, output: {
        opened: flow.title,
        at: step?.title || (openAt === 'run' ? 'Generate' : 'Inputs'),
        ...(hint ? { hint } : {}),
        ...(empty ? { empty: `${empty.mediaType} in the "${empty.key}" slot` } : {}),
    } });
}

/**
 * `prompt.open` (MPI-1012) — the model twin of `flow.open`, for the voice card's "Pick from the
 * voice library" on a model op (Chatterbox's `tts`). The gallery's prompt box goes onto the
 * model and op with the line in it and the language the agent chose, and its `+` picker opens
 * in the voice library. Nothing runs until the user presses Cue. Same guards as `flow.open`.
 *
 * Handed over through `state.s_promptOpen`, which the gallery takes on mount or on
 * `prompt:open`: navigation is async, so an event alone reaches no gallery when the user is in
 * another workspace.
 */
export function openPrompt(jobId, input = {}) {
    if (!input.follow) {
        return _fail(jobId, 'NOT_NOW', 'The prompt box is filled on the user\'s screen only in reply to something they typed.');
    }
    if (!state.currentProject) {
        return _fail(jobId, 'NO_PROJECT', 'No project is open, and the prompt box belongs to the open project.');
    }
    const model = getModelById(input.modelId);
    if (!model) return _fail(jobId, 'UNKNOWN_MODEL', `No model with id "${input.modelId}".`);
    if (!isOperationInstalled(model, input.operation)) {
        return _fail(jobId, 'OP_UNAVAILABLE', `"${input.operation}" is not available on ${model.name || model.id}: unsupported, or its weights are not installed.`);
    }
    // ponytail: the one control a voice op carries; generalise when a second op needs this.
    let controls = null;
    if (input.language !== undefined) {
        const value = getCommand(input.operation)?.components?.includes('ttsLanguage') ? ttsLanguageValue(input.language) : null;
        if (!value) return _fail(jobId, 'INVALID_LANGUAGE', `language must be one of: ${TTS_LANGUAGES.map(l => l.label).join(', ')}.`);
        controls = { ttsLanguage: value };
    }
    const blocked = followBlocker();
    if (blocked) {
        return _fail(jobId, 'VIEW_BUSY', `Nothing was opened: the user is ${BUSY_WORDS[blocked] || 'working on the picture'}. Tell them you will open ${model.name} once they are done, and send it again when they say so.`);
    }
    state.s_promptOpen = {
        modelId: model.id, operation: input.operation, prompt: String(input.prompt || ''), controls,
        pickVoice: !!input.pickVoice,
    };
    if (state.currentPage === PAGE_GALLERY) Events.emit('prompt:open');
    else navigate(PAGE_GALLERY);
    return _report(jobId, { ok: true, output: { opened: model.name || model.id } });
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
 * Run one `project.current` job (MPI-593): which project the window has open. The in-app
 * agent gets it with every turn; an outside agent (the MCP server) has no other way to
 * know the user switched project since it last opened one.
 */
function _currentProject(jobId) {
    if (!state.currentProject) {
        return _fail(jobId, 'NO_PROJECT', 'No project is open in Vision.');
    }
    return _report(jobId, {
        ok: true,
        output: { folderPath: state.currentProject.folderPath, name: state.currentProject.name },
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
            if (val.grow !== undefined && !FRAME_GROW_SIDES.includes(val.grow)) {
                return {
                    ok: false, code: 'INVALID_FRAME',
                    message: `frame.grow "${val.grow}" is not a side. One of: ${FRAME_GROW_SIDES.join(', ')}, or leave it out to grow both sides evenly.`,
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
/** A Flow's description cut to one clause: its first sentence, up to a dash or a colon. */
export function flowDoes(description) {
    const first = String(description || '').split(/(?<=[.!?])\s/)[0];
    return first.split(/\s[—–]\s|:\s/)[0].replace(/[.!?]$/, '').trim();
}

async function _listModels(jobId) {
    const engine = remoteEngineClient.effectiveEngine();
    // MPI-1004: no voice list beats no catalogue at all.
    const voiceLib = await _voiceLib().catch((err) => {
        clientLogger.warn('connector', `voice library not loaded for the catalogue: ${err?.message || err}`);
        return null;
    });

    const models = MODELS.map(model => {
        // `params`: what the agent may set on this op, so it never guesses a turbo
        // or a tier the model lacks (namedParamsFor mirrors resolveNamedParams).
        const ops = (model.supportedOps || []).map(op => {
            // MPI-1012: a model op with a voice slot lists its library voices the way a
            // Flow does (Chatterbox's `tts`).
            const voices = slotVoices(op, voiceLib);
            return {
                op,
                installed: isOperationInstalled(model, op),
                params: namedParamsFor(model, op),
                ...(voices ? { voices } : {}),
            };
        });

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
        const voices = slotVoices(flow, voiceLib);
        // MPI-918: its edit slot resolved to a cloud model, so every run bills the user.
        const cloud = cloudEditQuote(flow);
        return {
            id: flow.id,
            title: flow.title,
            // What it does, in its own words: "DramaBox" says nothing a title like "Text to
            // Speech" says, so a voice with no sample went to the uninstalled Text to Speech
            // over the installed DramaBox (Fabio, 2026-09-30). A package Flow brings its own.
            does: flowDoes(flow.description),
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
            ...(cropStep ? { frame: { param: 'frame', role: cropStep.role, ratios: CROP_RATIO_LABELS, grow: FRAME_GROW_SIDES } } : {}),
            // MPI-892: the agent never runs this one; it opens it for the user at this step.
            ...(flow.agentOpens ? { opens: flow.agentOpens } : {}),
            // MPI-1005: the app asks before running this one, showing this field.
            ...(flow.agentReview ? { review: flow.agentReview } : {}),
            // MPI-1004: role -> the library voices that slot takes; the route folds each list
            // into its slot's `media` row.
            ...(voices ? { voices } : {}),
            ...(cloud ? { cloud: `its edit runs on ${cloud.model.name} at DeepInfra and charges the user's own account ${cloud.display || 'an amount known only after the run'} a run. The app asks the user before each run.` } : {}),
        };
    });

    // MPI-904: the image tools that run with no model. They install with the engine, as
    // every universal op does, so there is no install state to report.
    return _report(jobId, { ok: true, output: { engine, models, flows, tools: AGENT_TOOL_OPS } });
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
    // held the agent's one-turn lock for four minutes (MPI-774 Phase 4).
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
 * Returns `{ text }` via _report. Errors: REJECTED, CANCELLED, RUNTIME_ERROR
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
        // `describer`: which vision model wrote this, kept beside the text in the card's
        // sidecar, because a description outlives the describer (Fabio, 2026-09-21).
        // `costUsd`: what a Remote describer billed, for the agent's spend figure (MPI-941 Phase 8).
        return _report(jobId, { ok: true, output: { text: result.text, ...(result.model && { describer: result.model }), ...(result.costUsd > 0 && { costUsd: result.costUsd }) } });
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
    'generation.quote': _quoteGeneration,
    'generation.cancel': _cancelGeneration,
    'flow.open': openFlow,
    'prompt.open': openPrompt,
    'project.open': _openProject,
    'project.current': _currentProject,
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
    // MPI-970: routines, the same way. Looked up at CALL time: routineDispatch.js imports
    // this file's build halves, so the two modules are a cycle.
    ...Object.fromEntries(['routine.validate', 'routine.quote', 'routine.run'].map(cap =>
        [cap, (jobId, input) => ROUTINE_HANDLERS[cap](input).then(payload => _report(jobId, payload))])),
};

/**
 * Subscribe to the relay. Idempotent, and safe in the browser dev build — a
 * failed EventSource just retries; nothing else in the app depends on it.
 */
export function initAgentDispatch() {
    if (_source) return;

    _source = new EventSource('/connector/jobs/stream');

    // MPI-891 — `followBlocker`'s inputs, app-lifetime like the stream (never torn down).
    // Capture phase, so a canvas that stops propagation still counts as a held button.
    const release = () => { _pointerHeld = false; };
    on(document, 'pointerdown', () => { _pointerHeld = true; }, true);
    on(document, 'pointerup', release, true);
    on(document, 'pointercancel', release, true);
    on(window, 'blur', release);
    Overlays.onDepthChange((depth) => { _overlayDepth = depth; });

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
