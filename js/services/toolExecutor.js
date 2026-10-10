/**
 * toolExecutor.js — `runCommand`'s third twin, for an op whose pixels the app's own server
 * makes with sharp / ffmpeg (MPI-1069). Today: Resize (`resize`, `resizeVideo`).
 *
 * Resize was a ComfyUI graph. Its video graph decoded a whole clip as float32 before
 * resizing one frame (~82 GB for a 14 s 4K phone clip), and as an engine job it waited
 * behind every generation, so the rail locked it. Both came from running a pixel op on the
 * engine. It now runs in `routes/toolResize.js`, and this head feeds the SAME pipeline
 * `cloudExecutor.js` does: the same `exec` handle and four callbacks, so the save, the
 * sidecar, the history entry, stacks, the agent and Reuse are untouched.
 *
 * WHAT IS DIFFERENT, and why:
 *   - **It never touches ComfyUI**, so no engine refusal (`ensureServerRunning`) and no Pod.
 *   - **It takes the `tool` lane**: a Resize never queues behind a generation, and never
 *     holds the local engine's or the Pod's only slot.
 *   - **No progress to stream**: one blocking POST, so the bar pulses (`tool:indeterminate`).
 *   - **A Stop aborts the POST**, and the route kills its ffmpeg when the request drops.
 *
 * Every exit path reaches a terminal store phase: a job left live keeps its lane busy.
 * An op opts in with `executor: 'tool'` on its `commandRegistry` entry.
 */

'use strict';

import { generationStore, PHASES } from './generationStore.js';
import { commands } from '../data/commandRegistry.js';
import { extractAbsPath } from '../utils/mediaActions.js';
import { clientLogger } from './clientLogger.js';
import { Events } from '../events.js';

/** True when `operation` runs on this head instead of the engine. */
export function isToolOp(operation) {
    return commands[operation]?.executor === 'tool';
}

/**
 * Mirrors `runCommand(payload)`: returns a handle at once, works in a detached body and
 * reports through the callbacks the caller assigns right after.
 * @param {object} payload - reads `genId`, `operation`, `injectionParams`, `mediaItems`,
 *   `scope`, `historyMode`.
 */
export function runToolCommand(payload) {
    const controller = new AbortController();

    const exec = {
        promptId:        null,
        seed:            null,
        cacheHit:        false,
        genId:           null,
        // Declared so generationService can assign them as it does for a local run.
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
            engine: 'tool',
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

        // A staged card's `filePath` is the renderer's `/project-file?path=` URL; the route
        // reads DISK paths (the cloud head's lesson, MPI-851 to 919).
        const item = (payload.mediaItems || [])[0];
        const raw = item?.url || item?.filePath || item?.path || '';
        const sourcePath = extractAbsPath(raw) || raw;
        const trim = item?.trim;

        generationStore.advance(jobId, PHASES.SUBMITTING);
        exec.onPromptAck?.(jobId);
        pulse(true);

        let body;
        try {
            const res = await fetch('/tool/resize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify({
                    operation: payload.operation,
                    sourcePath,
                    params: payload.injectionParams || {},
                    trimIn: trim?.in,
                    trimOut: trim?.out,
                }),
            });
            body = await res.json().catch(() => null);
        } catch (err) {
            body = { ok: false, error: { code: 'RESIZE_FAILED', message: err.message } };
        }
        if (stopped()) { settleCancelled(); return; }

        if (!body?.ok) {
            const message = body?.error?.message || 'No answer from the app server.';
            generationStore.settle(jobId, PHASES.ERROR, { error: body?.error?.code || 'RESIZE_FAILED' });
            clientLogger.error('toolExecutor', `${payload.operation} failed: ${message}`);
            pulse(false);
            exec.onError?.(Object.assign(new Error(message), { code: body?.error?.code || 'RESIZE_FAILED', userMessage: message }));
            return;
        }

        generationStore.advance(jobId, PHASES.ACCEPTED);
        generationStore.advance(jobId, PHASES.FINALIZING);
        generationStore.settle(jobId, PHASES.DONE);
        pulse(false);
        exec.onComplete?.(body.viewUrls, {});
    })();

    return exec;
}
