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
import { clientLogger } from './clientLogger.js';
import { Events } from '../events.js';

/** Provider error codes the route can return, mapped to copy a user can act on. */
const ERROR_COPY = {
    NO_KEY: 'No DeepInfra key is saved. Add one in Settings → Remote → Language Models, and cloud models will work everywhere in the app.',
    NO_PROFILE: 'The DeepInfra connection is missing its address. Re-pick DeepInfra in Settings → Remote → Language Models.',
    NO_CREDIT: 'DeepInfra rejected the charge. Top up your balance at deepinfra.com and try again — nothing was generated and nothing was billed.',
    CONTENT_FILTERED: 'The model refused this prompt or image. It is the provider\'s own filter, not a fault here — try another model or reword the prompt. Refused calls are not billed.',
    PROVIDER_ERROR: 'The provider could not complete this generation. Failed calls are not billed.',
};

/** @returns {string} actionable copy for a coded provider failure. */
export function cloudErrorMessage(code, fallback) {
    return ERROR_COPY[code] || fallback || ERROR_COPY.PROVIDER_ERROR;
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
            clientLogger.error('cloudExecutor',
                `Cloud generation failed (${payload.operation} / ${payload.modelId}): ${code}`);
            Events.emit('ui:error', { title: 'Cloud generation failed', message: cloudErrorMessage(code, message) });
            Events.emit('tool:indeterminate', { tool: 'groupHistory', id: payload.genId ?? null, active: false });
            exec.onError?.(new Error(code));
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
        // The batch control's own node title, clamped to what this endpoint accepts. A
        // batch is N images in ONE call and ONE bill, so the cost that comes back covers
        // all of them — never multiply it per card.
        const batch = Math.max(1, Math.min(model.cloud.maxBatch || 1,
            Number(params.Input_Batch_Size || params.Batch_Size || params.batchSize) || 1));
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
                    batch,
                    width:  params.Width  || params.width  || 0,
                    height: params.Height || params.height || 0,
                    // The native route takes ONE image; an edit op sends the first
                    // staged asset and the model's own `imageField` names where.
                    imagePath: _firstImagePath(payload.mediaItems),
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
        // what really happened rather than what was predicted.
        exec.onComplete?.(body.viewUrls || [], {
            cost: body.cost ? { ...body.cost, provider: model.provider } : null,
        });
    })();

    return exec;
}

/** The first staged image a reference slot holds, or null. */
function _firstImagePath(mediaItems) {
    const item = (mediaItems || []).find(m => m && (m.mediaType === 'image' || m.type === 'image'));
    return item?.filePath || item?.path || null;
}
