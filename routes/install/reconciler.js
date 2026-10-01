'use strict';

/**
 * routes/install/reconciler.js — disk/volume-truth reconciler (MPI-276, G11).
 *
 * One pass, BOTH engines. Generalises the old remote-only recovery (the 90s
 * stall watchdog + `_reconcileOutstandingRemoteDeps` + MPI-255 lost-completion
 * backstop) into a single store-driven loop that also covers the local engine,
 * which previously had NO reconciliation at all.
 *
 * Each pass (`reconcileOnce`):
 *   1. Ask injected truth (`checkInstalled`) which deps are actually on disk /
 *      on the volume for every non-terminal job. Truth is the ONLY thing that
 *      settles a job — a download is never force-completed on a guess.
 *   2. SETTLE wedged deps: a dep no transport holds whose bytes are all in (missed
 *      terminal SSE, MPI-254/255) or that truth reports installed → drive to
 *      `complete` via a LEGAL store transition. Terminals are never touched
 *      (invariant #3: heal, never resurrect).
 *   3. FAIL orphans: a job active with no truth-installed deps, nothing on disk,
 *      no dep the transport still holds (`isTransportLive` — a dep queued behind the
 *      concurrency cap is waiting, not orphaned), and no adapter activity for
 *      > ORPHAN_MS → its live deps `failed` WITH a reason. Grace window protects
 *      fresh jobs.
 *   4. Hand over to `onSettled` — the host's ONE model-level rollup
 *      (`_checkModelJobsComplete`) — whenever the pass settled or failed a dep.
 *      The reconciler never transitions a MODEL (MPI-513 D4): a second model-level
 *      writer moved an `installing` job to done mid-extract with no
 *      download:complete (MPI-317 F4) and failed orphans with no download:failed.
 *   5. Prune terminal jobs via `store.pruneTerminal(confirmedInstalled)` and
 *      broadcast the snapshot (G9). Runs after the rollup, so a model it settled
 *      this pass prunes in the same pass.
 *
 * Pure-ish: state machine + policy only. ALL I/O injected — no express, no fs,
 * no NDH, no timers of its own beyond the poll `setInterval` (host-provided via
 * `setIntervalFn`/`clearIntervalFn` so it is testable).
 */

const POLL_MS = 15_000;      // poll cadence while any job is held (was _REMOTE_STALL_POLL_MS)
const ORPHAN_MS = 60_000;    // active job with no activity/disk this long → failed

/**
 * @param {object} deps
 * @param {object}   deps.store          - createInstallStore() instance.
 * @param {function} deps.checkInstalled - async (jobs[]) => Map<depId, boolean>.
 *        jobs are the store's non-terminal model jobs; the impl queries local
 *        disk (localModelsCheck / isCompleteOnDisk) and/or the wrapper volume
 *        (remoteModelsCheck), engine-routed by job.engine. Truthy = on disk.
 * @param {function} [deps.onSettled]     - ({ settled, failed }) => void|Promise. The
 *        host's model-level rollup; called once after a pass that moved a dep.
 * @param {function} [deps.isTransportLive] - (depId) => boolean. True while the
 *        transport still holds the dep (queued for a slot, or downloading).
 * @param {function} [deps.now]           - () => epoch ms. Default Date.now.
 * @param {object}   [deps.logger]        - { info, warn, error }.
 * @param {function} [deps.setIntervalFn] - default global setInterval (testable).
 * @param {function} [deps.clearIntervalFn]
 */
function createReconciler({ store, checkInstalled, onSettled, isTransportLive, now, logger, setIntervalFn, clearIntervalFn } = {}) {
    if (!store) throw new Error('reconciler: store is required');
    if (typeof checkInstalled !== 'function') throw new Error('reconciler: checkInstalled fn is required');
    const _onSettled = onSettled ?? (() => {});
    const _isTransportLive = isTransportLive ?? (() => false);
    const _now = now ?? Date.now;
    const _logger = logger ?? { info() {}, warn() {}, error() {} };
    const _setInterval = setIntervalFn ?? setInterval;
    const _clearInterval = clearIntervalFn ?? clearInterval;

    let _timer = null;
    let _running = false; // re-entrancy guard — passes never overlap

    const isNodeDep = (d) => d.type === 'custom_nodes';
    const allBytesIn = (d) => d.totalBytes > 0 && (d.downloadedBytes || 0) >= d.totalBytes;

    /**
     * Run exactly one reconcile pass across every non-terminal job. Idempotent.
     * @returns {Promise<{settled:string[], failed:string[], pruned:string[]}>}
     */
    async function reconcileOnce() {
        const active = store.allModelJobs().filter(j => !store.MODEL_TERMINAL.has(j.status));
        const startVersion = store.version();
        if (active.length === 0) {
            // Nothing live, but terminals may still be prunable (belt TTLs).
            const pruned = store.pruneTerminal(new Set());
            if (store.version() !== startVersion) store.broadcastSnapshot();
            return { settled: [], failed: [], pruned };
        }

        let installedMap;
        try {
            installedMap = await checkInstalled(active);
        } catch (err) {
            _logger.warn('reconciler', `checkInstalled failed, skipping pass: ${err.message}`);
            return { settled: [], failed: [], pruned: [] };
        }
        const isInstalled = (depId) => installedMap && installedMap.get(depId) === true;

        const settled = [];
        const failed = [];
        const t = _now();

        for (const job of active) {
            // (2) SETTLE wedged deps against truth or all-bytes-in. A dep the transport
            // still holds settles through the transport: a local file is byte-complete
            // while its sha256 is still being checked, and settling it here would
            // announce an install whose verify has not passed.
            for (const d of job.deps) {
                if (store.DEP_TERMINAL.has(d.status)) continue;
                if (_isTransportLive(d.id)) continue;
                if (isInstalled(d.id) || (!isNodeDep(d) && allBytesIn(d))) {
                    if (store.transitionDep(d.id, store.DEP_STATES.COMPLETE, 'reconcile: truth/bytes')) {
                        d.downloadedBytes = d.totalBytes || d.downloadedBytes;
                        settled.push(d.id);
                    }
                }
            }

            // (3) FAIL orphans: nothing installed, nothing landing, nothing the
            // transport still holds, past the grace window. terminalAt is null for
            // active jobs, so age is measured from the last dep activity we can see;
            // the host stamps job.lastTickAt on every progress event. Absent a stamp,
            // fall back to registration. Only the DEPS fail here — the rollup turns
            // that into the model's failure and its download:failed.
            const liveDeps = job.deps.filter(d => !store.DEP_TERMINAL.has(d.status));
            if (liveDeps.length === 0) continue;
            const anyProgress = job.deps.some(d => (d.downloadedBytes || 0) > 0 || isInstalled(d.id));
            const held = liveDeps.some(d => _isTransportLive(d.id));
            const lastAt = job.lastTickAt || job.registeredAt || 0;
            const stale = lastAt > 0 && (t - lastAt) >= ORPHAN_MS;
            if (!anyProgress && !held && stale) {
                const secs = Math.round((t - lastAt) / 1000);
                for (const d of liveDeps) {
                    if (store.transitionDep(d.id, store.DEP_STATES.FAILED, 'reconcile: orphan (no activity/disk)')) {
                        d.error = `Download never started: nothing arrived in ${secs}s and no download is running for it. Try installing again.`;
                    }
                }
                _logger.warn('reconciler', `failed orphan job ${job.modelId} — no activity or disk truth for ${secs}s`);
                failed.push(job.modelId);
            }
        }

        // (4) The ONE model-level writer settles models from the deps just moved.
        if (settled.length || failed.length) await _onSettled({ settled, failed });

        // (5) Prune terminal jobs. A model settled to done this pass whose deps
        // are all installed-on-disk is confirmed → prune immediately (no wait for
        // the 120s belt), preserving the MPI-241 no-flash contract because the FE
        // resync fires from the same truth.
        const confirmedInstalled = new Set();
        for (const job of store.allModelJobs()) {
            if (job.status !== store.MODEL_STATES.DONE) continue;
            const nonNode = job.deps.filter(d => !isNodeDep(d));
            if (nonNode.length > 0 && nonNode.every(d => isInstalled(d.id))) confirmedInstalled.add(job.modelId);
        }
        const pruned = store.pruneTerminal(confirmedInstalled);

        if (store.version() !== startVersion) store.broadcastSnapshot();
        return { settled, failed, pruned };
    }

    /** Start the 15s poll. Self-idles: each tick runs a pass only while the store
     *  holds a job. A TERMINAL job counts — idling on "nothing active" left every
     *  finished job unpruned (the TTL belts live in the idle pass), so a `done` job
     *  outlived its install and painted a 100% bar on a model the active engine does
     *  not have (MPI-497). The idle pass is I/O-free. */
    function start() {
        if (_timer) return;
        _timer = _setInterval(() => {
            if (_running) return;
            if (store.allModelJobs().length === 0) return;
            _running = true;
            Promise.resolve()
                .then(reconcileOnce)
                .catch(err => _logger.error('reconciler', `pass crashed: ${err.message}`))
                .finally(() => { _running = false; });
        }, POLL_MS);
        if (_timer && typeof _timer.unref === 'function') _timer.unref();
    }

    function stop() {
        if (_timer) { _clearInterval(_timer); _timer = null; }
    }

    return { reconcileOnce, start, stop, POLL_MS, ORPHAN_MS };
}

module.exports = { createReconciler, POLL_MS, ORPHAN_MS };
