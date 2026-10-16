/**
 * services/concatProgress.js — bridge the server's concat channel (concat:* on the
 * shared /events/stream, MPI-1142) onto StatusBar.progress.* and the Events bus.
 *
 * Server emits three event types, all carrying `jobId`:
 *   - `concat:progress` { jobId, ratio }
 *   - `concat:done`     { jobId, item, group?, method }
 *   - `concat:error`    { jobId, error }
 *
 * Callers can either:
 *   1. listen for `concat:done` / `concat:error` on Events bus directly, or
 *   2. await `runConcatJob(jobId, label, { onItem })` — a promise wrapper
 *      that handles start/update/complete/cancel calls on StatusBar.progress
 *      and resolves with the result item.
 *
 * The SSE channel is single-stream: only one source is opened for the whole
 * app session. Multiple in-flight jobs are de-multiplexed by jobId.
 */

import { Events } from '../events.js';
import { StatusBar } from '../shell/statusBar.js';
import { onStream } from './eventStream.js';

let _armed = false;

// MPI-1142: the concat channel rides the app's one shared stream (services/eventStream.js).
function _ensureStream() {
    if (_armed) return;
    _armed = true;
    for (const name of ['concat:progress', 'concat:done', 'concat:error']) {
        onStream(name, e => {
            try {
                Events.emit(name, JSON.parse(e.data));
            } catch (_) { /* malformed payload */ }
        });
    }
}

/**
 * Wrap a concat HTTP POST in a StatusBar-driven promise.
 *
 * @param {object} opts
 * @param {string} opts.jobId   - matches server SSE jobId
 * @param {string} opts.label   - StatusBar label (e.g. "Combining 3 videos")
 * @param {boolean} [opts.silentComplete] - when true, the concat does NOT touch
 *   StatusBar.progress at all (no start/update/complete/cancel). Use when the
 *   concat is an internal sub-step of a larger op (e.g. Extend) so it neither
 *   double-toasts nor resets the parent op's elapsed timer. Only the SSE promise
 *   is tracked; the parent op shows its own single completion toast.
 * @returns {Promise<{ item, group?, method }>}
 *   Resolves on `concat:done`, rejects on `concat:error`.
 */
export function trackConcatJob({ jobId, label, silentComplete = false }) {
    _ensureStream();
    // silentComplete: the concat is an internal sub-step of a larger op (e.g.
    // Extend = i2v gen + concat). It MUST NOT drive the shared StatusBar progress
    // — calling progress.start() here would reset _activeStartedAt/_elapsedSec and
    // the parent op's completion toast would then report ~0s (the concat's tiny
    // duration) instead of the real generation time. So track only the SSE promise.
    if (!silentComplete) StatusBar.progress.start(label);
    return new Promise((resolve, reject) => {
        const offProgress = Events.on('concat:progress', payload => {
            if (payload?.jobId !== jobId) return;
            if (!silentComplete && Number.isFinite(payload.ratio)) StatusBar.progress.update(payload.ratio);
        });
        const cleanup = () => {
            offProgress?.();
            offDone?.();
            offError?.();
        };
        const offDone = Events.on('concat:done', payload => {
            if (payload?.jobId !== jobId) return;
            cleanup();
            if (!silentComplete) StatusBar.progress.complete('Concat finished');
            resolve(payload);
        });
        const offError = Events.on('concat:error', payload => {
            if (payload?.jobId !== jobId) return;
            cleanup();
            if (!silentComplete) StatusBar.progress.cancel();
            reject(new Error(payload.error || 'concat failed'));
        });
    });
}

// Open the stream eagerly on import so events aren't missed by late
// listeners that attach after a job has already started.
_ensureStream();
