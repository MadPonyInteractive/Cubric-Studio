/**
 * describeExecutor.js — `runCommand`'s twin for an `imageDescribe` sent to the Language Models
 * connection (`/llm/describe`) instead of the local describer (MPI-1109).
 *
 * The online describe used to be a bare fetch: 2-20 s with nothing on screen until the toast.
 * It now goes through the queue like any cloud generation, on the `cloud` lane, so it runs
 * beside a local or Pod job and shows a queue row, the status bar and Stop. Same shape as
 * `toolExecutor.js`: one blocking POST, so the bar pulses (`tool:indeterminate`); a Stop aborts
 * the POST. The caption comes back through `onComplete([], { promptText })`, the contract a
 * text op's ComfyUI run already uses, so `generationService` ends it the same way.
 *
 * Every exit path reaches a terminal store phase: a job left live keeps its lane busy.
 * A config opts in with `describeEndpoint` (llmService `describeImage({ queued: true })`).
 *
 * An online ENHANCE (`/llm/enhance`, endpoint or Ollama) runs the same way with
 * `enhanceEndpoint` (llmService `runServerBackend({ queued: true })`, MPI-1231): Storyboard's
 * Plan with Cosmo sat 71 s on DeepSeek with nothing on screen but the button's words.
 */

'use strict';

import { generationStore, PHASES } from './generationStore.js';
import { Events } from '../events.js';

/**
 * @param {object} payload - reads `genId`, `scope`, `historyMode`, `mediaItems` and
 *   `describeEndpoint` ({ profileId, modelId?, question?, crop?, onAnswer? }). `onAnswer`
 *   gets the route's whole answer (`model`, `costUsd`), which the text callback cannot carry.
 */
export function runDescribeCommand(payload) {
    const controller = new AbortController();

    const exec = {
        promptId:        null,
        seed:            null,
        cacheHit:        false,
        genId:           null,
        onPreview:       null,
        onPreviewReset:  null,
        onProgress:      null,
        onSamplingStart: null,
        onPromptAck:     null,
        onComplete:      null,
        onError:         null,
        jobId:           null,
        cancel() {
            controller.abort();
            if (exec.jobId) generationStore.cancel(exec.jobId);
        },
    };

    (async () => {
        // Yield before anything can fail: the caller assigns the callbacks AFTER this returns.
        await Promise.resolve();

        const jobId = crypto.randomUUID();
        generationStore.register({
            jobId,
            genId: payload.genId ?? null,
            engine: 'cloud',
            scope: payload.scope || (payload.historyMode ? 'groupHistory' : 'gallery'),
            interruptCb: () => controller.abort(),
        });
        exec.jobId = jobId;

        const pulse = (active) => Events.emit('tool:indeterminate', { tool: 'groupHistory', id: payload.genId ?? null, active });
        const stopped = () => controller.signal.aborted || generationStore.getSignal(jobId)?.aborted === true;
        const settleCancelled = () => {
            generationStore.advance(jobId, PHASES.CANCELLED);
            pulse(false);
            exec.onError?.(new Error('cancelled_before_dispatch'));
        };
        if (stopped()) { settleCancelled(); return; }

        const enhance = payload.enhanceEndpoint;
        const { profileId, modelId, question, crop, greedy } = payload.describeEndpoint || {};
        const onAnswer = (enhance || payload.describeEndpoint || {}).onAnswer;
        const item = (payload.mediaItems || [])[0];

        generationStore.advance(jobId, PHASES.SUBMITTING);
        exec.onPromptAck?.(jobId);
        pulse(true);

        let body;
        try {
            const res = await fetch(enhance ? '/llm/enhance' : '/llm/describe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify(enhance ? enhance.body : {
                    profileId,
                    ...(modelId ? { modelId } : {}),
                    imagePath: item?.url,
                    ...(question ? { question } : {}),
                    ...(crop ? { crop } : {}),
                    ...(greedy ? { greedy } : {}),
                }),
            });
            body = await res.json();
        } catch (err) {
            body = { ok: false, error: (err && err.message) || 'The app server did not answer.' };
        }
        if (stopped()) { settleCancelled(); return; }

        if (!body?.ok) {
            const message = (typeof body?.error === 'object' ? body.error?.message : body?.error)
                || (enhance ? 'Enhance failed.' : 'The description failed.');
            const code = typeof body?.error === 'object' ? body.error?.code : undefined;
            // An enhance caller reads the route's own envelope (`withRemoteSettingsHint`), as the bare fetch did.
            if (enhance) onAnswer?.(body);
            generationStore.settle(jobId, PHASES.ERROR, { error: code || (enhance ? 'ENHANCE_FAILED' : 'DESCRIBE_FAILED') });
            pulse(false);
            exec.onError?.(Object.assign(new Error(message), code ? { code } : {}));
            return;
        }

        onAnswer?.(body);
        generationStore.advance(jobId, PHASES.ACCEPTED);
        generationStore.advance(jobId, PHASES.FINALIZING);
        generationStore.settle(jobId, PHASES.DONE);
        pulse(false);
        exec.onComplete?.([], { promptText: String(body.text || '').trim() });
    })();

    return exec;
}
