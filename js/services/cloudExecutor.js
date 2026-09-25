/**
 * cloudExecutor.js — `runCommand`'s twin for a model that runs at a provider (MPI-851).
 *
 * The app's whole generation path below the dispatch — save, sidecar, gallery card,
 * terminals, toasts — is already written against a generic `exec` object with no
 * ComfyUI in it. So a cloud generation is not a second pipeline: it is the same
 * pipeline with a different head, and this module IS that head. It returns the same
 * handle `runCommand` returns and speaks the same four callbacks, which is the entire
 * contract `generationService` needs.
 *
 * WHAT IS DIFFERENT, and why each one matters:
 *
 *   - **It never touches ComfyUI.** `generationService` branches on `model.provider`
 *     BEFORE calling `runCommand`, because `comfyController.runWorkflow` calls
 *     `ensureServerRunning` — dispatching a cloud job through it would cold-start a
 *     local engine, for nothing, on a machine that may have no GPU at all.
 *
 *   - **It takes the `cloud` lane.** `remote` means the user's Pod in this app, so a
 *     cloud job there would hold the Pod's only slot and wear a badge that lies.
 *
 *   - **There is no progress to stream.** One blocking POST, no SSE, no step events.
 *     The store moves queued → submitting → accepted → finalizing → done so the status
 *     bar has a shape to follow, and `tool:indeterminate` drives the pulse the same way
 *     the ESRGAN upscale already does.
 *
 *   - **Cancel is not a refund, and this module must not pretend otherwise.** Aborting
 *     the fetch stops us WAITING; the provider may well finish the job and bill it.
 *     The abort is real, the saving stops, the money is gone. The UI says so.
 *
 * THE ONE INVARIANT: every exit path must reach a terminal phase in `generationStore`.
 * `register()` takes a lane slot, and a job left non-terminal keeps that lane busy for
 * the rest of the session — the wedge that reads as "QUEUED forever" with nothing
 * running. Every `return` below goes through `_settleError` or `_settleCancelled`, for
 * the same reason `commandExecutor._failBail` exists.
 */

'use strict';

import { generationStore, PHASES } from './generationStore.js';
import { getModelById } from '../data/modelRegistry.js';
import { batchFieldFor, buildSizeFields } from '../data/modelConstants/deepinfraSizing.js';
import { estimateCost } from '../data/modelConstants/deepinfraPricing.js';
import { ratioSettingsFromParams } from '../utils/promptReuse.js';
import { extractAbsPath } from '../utils/mediaActions.js';
import { clientLogger } from './clientLogger.js';
import { Events } from '../events.js';

/** Provider error codes the route can return, mapped to copy a user can act on. */
const ERROR_COPY = {
    NO_KEY: 'No DeepInfra key is saved. Add one in Settings → Remote → Language Models, and cloud models will work everywhere in the app.',
    NO_PROFILE: 'The DeepInfra connection is missing its address. Re-pick DeepInfra in Settings → Remote → Language Models.',
    // HTTP 402 means an empty balance OR a hit monthly limit (MPI-869, measured) — name both.
    NO_CREDIT: 'DeepInfra rejected the charge: either your balance is empty or you have reached the monthly spending limit you set. Top up or raise the limit at deepinfra.com — nothing was generated and nothing was billed.',
    CONTENT_FILTERED: 'The model refused this prompt or image. It is the provider\'s own filter, not a fault here — try another model or reword the prompt. Refused calls are not billed.',
    PROVIDER_ERROR: 'The provider could not complete this generation. Failed calls are not billed.',
};

/** @returns {string} actionable copy for a coded provider failure. */
export function cloudErrorMessage(code, fallback) {
    return ERROR_COPY[code] || fallback || ERROR_COPY.PROVIDER_ERROR;
}

/**
 * The size, batch and reference fields this run will be DISPATCHED with.
 *
 * Exported because the prompt box's price tag (MPI-852) has to price the run that is
 * about to happen, not a second reading of the controls. Two derivations of "how big,
 * how many, with what" would drift the moment either changed, and the user would be
 * quoted one figure and billed for another.
 *
 * @param {object} model - the ModelDef, which must carry `cloud.endpointId`
 * @param {object} params - `injectionParams` from the run payload
 * @param {Array} [mediaItems] - staged media, for the reference image(s)
 * @returns {{batch:number, width:number, height:number, ratioLabel:string,
 *   qualityTier:string, duration:number, imagePaths:string[]}}
 */
export function cloudRunFields(model, params = {}, mediaItems = []) {
    // The batch control's own node title, clamped to what this endpoint accepts. A
    // batch is N images in ONE call and ONE bill, so the cost that comes back covers
    // all of them — never multiply it per card.
    //
    // The cap comes from the provider's published maximum in the price snapshot, not
    // from a number written on the ModelDef (MPI-853): of the sixteen cloud models
    // only two have a native batch at all, and they do not even call it the same
    // thing. A model with none clamps to 1 here and the route never sends a count.
    const batch = Math.max(1, Math.min(batchFieldFor(model?.cloud?.endpointId)?.max || 1,
        Number(params.Input_Batch_Size || params.Batch_Size || params.batchSize) || 1));

    // The size the user actually picked, in the three currencies the providers use
    // between them. `ratioSettingsFromParams` is the SAME recovery generationService
    // does at :495 — the quality tier injects no workflow param, so the only record
    // of it is the pixels matching a row of this model's own ratio table. Sent
    // alongside the pixels rather than instead of them, because which one the
    // provider wants is its business, resolved in deepinfraSizing.js.
    const picked = ratioSettingsFromParams(params, {}, model) || {};

    return {
        batch,
        width:  params.Width  || params.width  || 0,
        height: params.Height || params.height || 0,
        // Nano Banana takes a ratio LABEL and no pixels; the video models take a
        // resolution tier and a ratio; Veo takes no duration at all. All three are sent
        // when known and the route decides which the endpoint can actually hear.
        ratioLabel: picked.selectedRatio || params.Ratio_Label || params.ratioLabel || '',
        qualityTier: picked.qualityTier || '',
        // `Input_Duration` is the duration control's own node title, and the only key
        // anything in this app writes a duration under — PromptBoxControls.js:623 and
        // generationControls.js:484 are both it. This read was `params.Duration` until
        // MPI-852, which matches nothing: every cloud video generation was dispatched
        // with NO duration, so `buildSizeFields` omitted the field, the provider ran its
        // own default length, and the user was billed for that instead of for the clip
        // they asked for. Found by the price tag, which could not price a video at all.
        duration: Number(params.Input_Duration) || 0,
        // Every staged image, in strip order (the order IS the "Image 1 / Image 2" the
        // prompt names). The native route takes ONE image, so the route sends the first,
        // or collages up to four into one for a model declaring `referenceCollage`
        // (MPI-919). The model's own `imageField` names where it goes.
        imagePaths: _imagePaths(mediaItems),
    };
}

/**
 * What the next run on this model will cost, before it runs (MPI-852).
 *
 * Prices what `buildSizeFields` will actually SEND, not what the controls hold. The two
 * differ: a size outside a model's published bounds is fitted on the way out, and the
 * fitted size is what gets billed. Pricing the user's pick instead would quote a figure
 * for a picture they are not getting.
 *
 * Two fields the pricing formula takes are deliberately NOT sourced here:
 *   - `steps` — no cloud model's body carries one and `buildSizeFields` emits none, so
 *     every call runs the provider's own `default_iterations` and the formula's step
 *     term is exactly 1. Sourcing a number would only be a way to get it wrong.
 *   - references beyond the first — the native route sends ONE image, so a second or
 *     third staged reference changes no field in the body and cannot change the bill. A
 *     Nano Banana collage (MPI-919) is that one image too, and input bills flat per image.
 *
 * @returns {{usd:number, unit:number, batch:number, display:string, checkedOn:string}|null}
 *   null for a local model, and for any shape `estimateCost` refuses to guess at.
 */
export function estimateRunCost(model, params = {}, mediaItems = []) {
    const endpointId = model?.cloud?.endpointId;
    if (!model?.provider || !endpointId) return null;

    const want = cloudRunFields(model, params, mediaItems);
    const sent = buildSizeFields(endpointId, want);
    // Seedream's shape is one 'WIDTHxHEIGHT' string; the FLUX models send a pair; the
    // Gemini family sends neither and is priced off token counts, so 0 is correct there.
    const [sizeW, sizeH] = String(sent.size || '').split('x').map(Number);

    return estimateCost(endpointId, {
        width:  sent.width  || sizeW || 0,
        height: sent.height || sizeH || 0,
        // Only the video models carry a resolution tier. Every image ratio we ship is a
        // nominal 1 MP, which is the Gemini family's '1k' bucket.
        resolution: sent.resolution || '1k',
        // Veo publishes no duration field at all, so `sent` carries none and the pricing
        // module falls back to that model's own fixed clip length.
        duration: sent.duration || want.duration || 0,
        references: want.imagePaths.length ? 1 : 0,
        batch: want.batch,
    });
}

/**
 * Dispatch one generation to the provider behind `model.provider`.
 *
 * Mirrors `runCommand(payload)`: returns immediately with a handle, does the work in a
 * detached async body, and reports through the callbacks the caller assigns to that
 * handle right after this returns.
 *
 * @param {object} payload - the same payload shape `runCommand` takes. Reads
 *   `genId`, `modelId`, `operation`, `positive`, `seed`, `injectionParams`, `mediaItems`.
 * @returns {{promptId:null, seed:number|null, cacheHit:false, genId:string|null,
 *   jobId:string|null, onPromptAck:function|null, onComplete:function|null,
 *   onError:function|null, cancel:function}}
 */
export function runCloudCommand(payload) {
    const controller = new AbortController();

    const exec = {
        promptId:        null,
        seed:            null,
        cacheHit:        false,
        genId:           null,
        // Declared so generationService can assign them exactly as it does for a local
        // run. The ones a cloud job can never fire stay null and are never called.
        onPreview:       null,
        onPreviewReset:  null,
        onProgress:      null,
        onSamplingStart: null,
        onPromptAck:     null,
        onComplete:      null,
        onError:         null,
        jobId:           null,
        cancel() {
            // Abort the wait. There is no queue item to delete and no engine to
            // interrupt — and the provider is under no obligation to stop, so this
            // stops us listening, not necessarily them charging.
            controller.abort();
            if (exec.jobId) generationStore.cancel(exec.jobId);
        },
    };

    (async () => {
        // Yield ONCE before anything can fail. The caller assigns onComplete/onError to
        // the handle AFTER this factory returns, exactly as it does for runCommand, so a
        // failure raised synchronously here would call a callback that does not exist yet
        // and the generation would hang with no error and no card. runCommand gets this
        // for free from the engine refresh it awaits first; this head has nothing to wait
        // for, so it waits deliberately.
        await Promise.resolve();

        const jobId = crypto.randomUUID();
        generationStore.register({
            jobId,
            genId: payload.genId ?? null,
            engine: 'cloud',
            scope: payload.scope || (payload.historyMode ? 'groupHistory' : 'gallery'),
            display: payload.previewOnly === true ? { previewKind: 'preview' } : undefined,
            interruptCb: () => { try { controller.abort(); } catch (_) { /* already aborted */ } },
        });
        exec.jobId = jobId;

        const _settleError = (code, message) => {
            generationStore.settle(jobId, PHASES.ERROR, { error: code });
            // The route's own message too: the dialog shows fixed copy per code, so without
            // it here a refusal ("none arrived") and a provider fault read the same in the log.
            clientLogger.error('cloudExecutor',
                `Cloud generation failed (${payload.operation} / ${payload.modelId}): ${code}${message ? ` - ${message}` : ''}`);
            // A run refused for credit (MPI-869) is a toast, not the error dialog: nothing
            // broke and there is no log worth downloading. It has no copy in ERROR_COPY on
            // purpose — the route's message carries the cost and what is left. An agent's
            // run gets no toast at all: the agent is told, and says it in the chat.
            const userMessage = cloudErrorMessage(code, message);
            if (code === 'LOW_BALANCE' || code === 'OVER_LIMIT') {
                if (!payload.byAgent) Events.emit('ui:warning', { message: userMessage });
            } else {
                Events.emit('ui:error', { title: 'Cloud generation failed', message: userMessage });
            }
            Events.emit('tool:indeterminate', { tool: 'groupHistory', id: payload.genId ?? null, active: false });
            exec.onError?.(Object.assign(new Error(code), { code, userMessage }));
        };

        const _settleCancelled = () => {
            generationStore.advance(jobId, PHASES.CANCELLED);
            Events.emit('tool:indeterminate', { tool: 'groupHistory', id: payload.genId ?? null, active: false });
            exec.onError?.(new Error('cancelled_before_dispatch'));
        };

        const model = getModelById(payload.modelId);
        if (!model?.cloud?.endpointId) {
            _settleError('PROVIDER_ERROR', `${payload.modelId} declares no cloud endpoint.`);
            return;
        }

        const params = payload.injectionParams || {};
        // The same derivation the prompt box's price tag reads, so the run that is
        // quoted and the run that is dispatched cannot be two different runs.
        const fields = cloudRunFields(model, params, payload.mediaItems);
        const seed = Number.isFinite(params.Seed) ? params.Seed
            : (Number.isFinite(payload.seed) ? payload.seed : null);
        exec.seed = seed;

        // A Stop can land between register() and the POST; the store's own signal is
        // the record of it, exactly as the local pipeline's abort boundaries read it.
        if (generationStore.getSignal(jobId)?.aborted) { _settleCancelled(); return; }

        generationStore.advance(jobId, PHASES.SUBMITTING);
        // One blocking call: nothing to stream, so the bar pulses instead of filling.
        Events.emit('tool:indeterminate', { tool: 'groupHistory', id: payload.genId ?? null, active: true });

        let res;
        try {
            res = await fetch('/deepinfra/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify({
                    modelId: model.id,
                    operation: payload.operation,
                    prompt: payload.positive || '',
                    seed,
                    ...fields,
                    // The price tag's own figure, so the route can refuse a run the
                    // account cannot cover before it is sent (MPI-869).
                    estimateUsd: estimateRunCost(model, params, payload.mediaItems)?.usd || 0,
                }),
            });
        } catch (err) {
            if (controller.signal.aborted) { _settleCancelled(); return; }
            _settleError('PROVIDER_ERROR', err?.message);
            return;
        }

        // Accepted by our own route, which is the only "the provider took it" signal a
        // blocking call has. The clock starts here, past any connection setup.
        generationStore.advance(jobId, PHASES.ACCEPTED);
        exec.onPromptAck?.(jobId);

        let body = null;
        try { body = await res.json(); } catch (_) { /* handled as a provider error below */ }

        if (controller.signal.aborted) { _settleCancelled(); return; }
        if (!res.ok || !body?.ok) {
            _settleError(body?.error?.code || 'PROVIDER_ERROR', body?.error?.message);
            return;
        }

        // The provider picks the seed when we do not send one, and REPORTS it. Without
        // this the sidecar records -1 and Reuse Prompt can never reproduce the image —
        // which is the one thing a seed exists for. Measured on the first real generation
        // (MPI-851): cost and dimensions landed correctly, the seed came back as -1.
        if (Number.isFinite(body.seed)) exec.seed = body.seed;

        generationStore.advance(jobId, PHASES.FINALIZING);
        generationStore.settle(jobId, PHASES.DONE);
        Events.emit('tool:indeterminate', { tool: 'groupHistory', id: payload.genId ?? null, active: false });

        // `cost` is the TRUE figure the provider billed (`inference_status.cost`), not
        // the app's estimate — it rides into the sidecar so a spend readout can sum
        // what really happened rather than what was predicted. A batch is ONE bill for
        // N images and `generationService` stamps this object on every card, so each card
        // carries its share: a card's cost is its own, and summing cards gives the bill.
        const urls = body.viewUrls || [];
        exec.onComplete?.(urls, {
            cost: body.cost
                ? { ...body.cost, usd: body.cost.usd / Math.max(1, urls.length), provider: model.provider }
                : null,
        });
    })();

    return exec;
}

/** The first staged image a reference slot holds, or null. */
// A staged gallery image's `filePath` is the renderer's `/project-file?path=<encoded>` URL,
// not a disk path. The route reads files from DISK, so it must get the decoded path: sent
// raw, every cloud edit on a gallery image failed to read its reference (MPI-851 to 919).
// `url` first: a prompt-box chip carries ONLY `url` (MpiPromptBox `_tryAddMedia`), and
// reading filePath alone sent every in-app edit with no reference at all.
function _imagePaths(mediaItems) {
    return (mediaItems || [])
        .filter(m => m && (m.mediaType === 'image' || m.type === 'image'))
        .map(m => m.url || m.filePath || m.path)
        .filter(Boolean)
        .map(p => extractAbsPath(p) || p);
}
