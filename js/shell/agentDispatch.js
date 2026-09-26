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
import { navigate, PAGE_GALLERY, PAGE_GROUP_HISTORY } from '../router.js';
import { on } from '../utils/dom.js';
import { Overlays } from '../managers/overlayManager.js';
import { activeMask } from './activeMask.js';
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
import { resolveMediaUrl, extractAbsPath } from '../utils/mediaActions.js';
import { stepValueToMedia } from '../components/Blocks/MpiBaseFlow/stepKinds.js';
import { composeNextPass } from '../components/Organisms/MpiStepCrop/MpiStepCrop.js';
import { planOutpaintPasses } from '../utils/outpaintPasses.js';
import { describeImage } from '../services/llmService.js';
import { estimateRunCost } from '../services/cloudExecutor.js';
import { formatPrice } from '../data/modelConstants/deepinfraPricing.js';
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
async function _reportDone(jobId, { item, group, items }, cardName, duration = null, modelId = null) {
    // A batch lands as ONE report carrying every card, each with its SHARE of the one bill.
    const costUsd = (items || [item]).reduce((sum, it) => sum + (Number(it?.generationSettings?.cost?.usd) || 0), 0);
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
            // MPI-855: what this generation billed, for the chat's session spend.
            ...(costUsd > 0 ? { costUsd } : {}),
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
    const { modelId, ratio, qualityTier, turbo, styleSelect, stylization, duration, batch } = input;
    if (!pinned) {
        return {
            model: getModelById(modelId),
            project: null,
            named: { ratio, qualityTier, turbo, styleSelect, stylization, duration, batch },
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
    // `batch` survives the pin: it is HOW MANY the user asked for (MPI-876), not a setting,
    // and dropping it would run one picture where the agent says four are coming.
    return { model: pinnedM, project, named: batch !== undefined ? { batch } : {} };
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

    const painted = activeMask();
    const areas = painted && ONE_AREA_OPS.has(operation) ? await _maskAreas(painted.dataUrl) : null;
    const mask = resolveMask(operation, painted, areas);
    if (mask.error) {
        return _fail(jobId, mask.error.code, mask.error.message);
    }

    // MPI-765: media by reference, resolved exactly as the Flow branch resolves it.
    // Checked here for the same reason as the op: the enqueue guard's refusal is a toast.
    const resolvedMedia = resolveAgentMedia(operation, model, media);
    if (!resolvedMedia.ok) {
        return _fail(jobId, resolvedMedia.code, resolvedMedia.message);
    }
    const mediaItems = bindMaskedSource(resolvedMedia.mediaItems, mask.maskUrl);

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
    _logNamedParamProvenance(model, operation, named.provenance);

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
        ...(mask.maskDataUrl ? { maskDataUrl: mask.maskDataUrl } : {}),
        // Explicit only — an unset seed must stay random, never pinned to 0.
        ...(seed !== undefined ? { seed } : {}),
        injectionParams: mergedInjection,
        byAgent: true,
    };

    // A masked submit is a new version of the card the mask is painted on, and goes
    // where a Cue press in that workspace goes — no gallery placeholder, because a
    // `groupHistory` gen owns its own frames (MpiGroupHistoryBlock's `scope !==
    // 'groupHistory'` guard is what draws them).
    const historyOpts = maskedGenerationOpts(mask.maskGroupId) || workspaceGenerationOpts(mediaItems, model.mediaType || 'image');

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
    // A batch draws one card per image up front (MPI-876), the same shape the gallery's
    // own Cue builds (MpiGalleryBlock `_galleryGenerationOptions`).
    const extraTempIds = Array.from({ length: Math.max(1, Number(mergedInjection.Input_Batch_Size) || 1) - 1 }, () => crypto.randomUUID());
    const extraPlaceholders = extraTempIds.map((id) => ({ ...placeholderGroup, id, history: [] }));

    _followWork(input, historyOpts);
    const queued = enqueueGeneration(config, {
        // A card name names a NEW card. Added to the user's own card, it would rename theirs.
        onComplete: (done) => _reportDone(jobId, done, historyOpts ? undefined : input.cardName, named.duration, model.id),
        // An `outputKind: 'text'` op produces a caption and no item (MPI-310).
        onText: (text) => _report(jobId, { ok: true, output: { text } }),
        // A cloud failure names itself (MPI-869: e.g. LOW_BALANCE with the cost and what
        // is left), so the agent can tell the user why; anything else stays generic.
        onError: (err) => _fail(jobId, err?.code || 'RUNTIME_ERROR',
            err?.userMessage || 'The generation failed. See the app log for the cause.'),
        onCancel: () => _fail(jobId, 'CANCELLED',
            'The generation was cancelled or produced no output.'),
    }, historyOpts || { scope: 'gallery', tempId, placeholderGroup, extraTempIds, extraPlaceholders });

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
    // A Flow carries no model id (`model.id: null`), so nothing behind one is a cloud
    // model and there is nothing here to price.
    if (input.flowId) return _report(jobId, { ok: true, output: { billed: false } });

    const pinned = state.agentSettingsPinned === true;
    const owner = resolveSettingsOwner(input, pinned, state.currentProject, pinned ? pinnedModel() : null);
    const model = owner.model;
    // `provider` is the whole discriminator (MPI-851): a model that has one runs on the
    // user's own key and bills them, and a model that has none cannot cost anything.
    if (!model?.provider) return _report(jobId, { ok: true, output: { billed: false } });

    const modelName = model.name || model.id;
    // Best effort from here down. Every failure below loses the NUMBER, never the card:
    // the answer stays `billed: true` and the gate says it cannot be quoted.
    const named = resolveNamedParams(owner.project, model, String(input.operation || ''), owner.named);
    const params = { ...(named.ok ? named.injectionParams : {}), ...(input.injectionParams || {}) };
    const media = resolveAgentMedia(String(input.operation || ''), model, input.media || []);
    const quote = estimateRunCost(model, params, media.ok ? media.mediaItems : []);

    // A fan-out is N separate calls and N bills of this same run, so the total is the
    // unit times the count — multiplied as a NUMBER and formatted once. `display` itself
    // can never be multiplied: below a cent it carries one significant figure, so six
    // lots of "about $0.0005" cannot be read back out of the string.
    const count = Math.max(1, Math.round(Number(input.count) || 1));
    const usd = quote ? quote.usd * count : null;

    return _report(jobId, { ok: true, output: {
        billed: true,
        modelName,
        count,
        usd,
        display: usd === null ? null : formatPrice(usd),
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

/**
 * The `runNextPass` hook flowService calls as each pass completes (MPI-900): the previous
 * RESULT padded out to the next frame, swapped into the source's slot. MpiBaseFlow's
 * `_planPasses` is the same hook over the user's frame; this one runs with no frame open.
 *
 * @param {Array<Object>} plan - every pass's frame in source px (`planOutpaintPasses`)
 * @param {Array<Object>} mediaItems - the run's media, pass 1's padded picture in it
 * @param {Object} source - the item in `mediaItems` each pass replaces
 */
function _nextPassFor(plan, mediaItems, source) {
    let ran = 0; // index of the pass that just completed
    return async ({ item } = {}) => {
        const file = await composeNextPass(item, plan[ran], plan[ran + 1]);
        ran += 1;
        const url = file ? await _placePreviewAsset(file, state.currentProject) : null;
        return url ? {
            media: mediaItems.map(m => (m === source ? { ...m, url, filePath: url } : m)),
            last: ran === plan.length - 1,
        } : null;
    };
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
    let passPlan = null;
    let cropSource = null;
    if (cropStep) {
        const label = params.frame?.ratio;
        const ratio = _cropRatioValue(label);
        if (!ratio) {
            return _fail(jobId, 'FRAME_REQUIRED',
                `Nothing was generated: ${flow.title} grows a picture past its edges, so it needs the shape you want it to become — ${label ? `"${label}" is not one it offers` : 'your call passed none'}. Send it again with params: { frame: { ratio: "<one of these>" } }, plus grow: "up", "down", "left" or "right" when the new room goes on one side only: ${CROP_RATIO_LABELS.join(', ')}.`);
        }

        const grow = params.frame?.grow; // a side, or absent: validateBoxParams checked it
        const source = mediaItems.find(m => m?.role === cropStep.role);
        if (!source?.url) {
            return _fail(jobId, 'MEDIA_REQUIRED',
                `${flow.title} needs an image in its "${cropStep.role}" slot to grow.`);
        }

        let padded = null;
        try {
            const natural = await _naturalSize(source.url);
            const rect = frameRectForRatio(natural, ratio, grow);
            if (!rect) {
                const taller = ratio < natural.w / natural.h;
                return _fail(jobId, 'FRAME_DIRECTION',
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
        cropSource = source;
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

    // A Flow always lands in the gallery (Fabio, 2026-09-22), so that is where it is watched.
    _followWork(input, null);
    const queued = submitFlowGeneration(flow, {
        ...inputs,
        mediaItems,
        ...(Object.keys(injectionParams).length ? { injectionParams } : {}),
        ...(passPlan ? { runNextPass: _nextPassFor(passPlan, mediaItems, cropSource) } : {}),
    }, {
        onComplete: (done) => _reportDone(jobId, done, input.cardName),
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
            ...(cropStep ? { frame: { param: 'frame', role: cropStep.role, ratios: CROP_RATIO_LABELS, grow: FRAME_GROW_SIDES } } : {}),
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
    'generation.quote': _quoteGeneration,
    'generation.cancel': _cancelGeneration,
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
