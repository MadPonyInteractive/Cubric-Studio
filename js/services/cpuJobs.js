/**
 * services/cpuJobs.js — MPI-1104: a non-GPU job (ffmpeg, sharp, a file copy, a cleanup)
 * shows as a row in the queue panel's Transfers list, beside downloads and uploads.
 * GPU work never comes here: it goes through enqueueGeneration (queue + status bar).
 *
 *   const result = await runCpuJob('Copying 12 files', async (setProgress) => {
 *       ...; setProgress(0.5);   // 0..1; never called = the moving sweep
 *   }, { mediaType: 'video' });
 *
 * Each start emits `queue:added` (MPI-1105): the right-edge flash, in the job's subject colour.
 *
 * The row leaves on every end (done, failed); the caller still shows the result or
 * the error, as for any other action.
 */

import { state } from '../state.js';
import { Events } from '../events.js';

let _seq = 0;

const _replace = (id, patch) => {
    state.cpuJobs = state.cpuJobs.map(j => (j.id === id ? { ...j, ...patch } : j));
};

export async function runCpuJob(label, fn, { mediaType } = {}) {
    const id = `cpu-${++_seq}`;
    state.cpuJobs = [...state.cpuJobs, { id, label, progress: null }];
    Events.emit('queue:added', { mediaType });
    try {
        return await fn((ratio) => _replace(id, { progress: Math.max(0, Math.min(1, Number(ratio) || 0)) }));
    } finally {
        state.cpuJobs = state.cpuJobs.filter(j => j.id !== id);
    }
}
