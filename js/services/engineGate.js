/**
 * engineGate.js — "is there anything to generate WITH?" (MPI-390)
 *
 * The RunPod escape hatch on the install modal makes "no local engine at all" a
 * reachable state for the first time. With no Pod connected, dispatch falls back
 * to local (`forceLocal ? 'local' : isRemote() ? 'remote' : 'local'`), so every
 * graph op dies on the engine guard in routes/comfy.js with "Provision engine
 * first" — the opposite of the advice a deliberate skipper needs.
 *
 * MPI-856: that user is the one paid cloud models are for, so projects OPEN
 * with no engine and the refusal moved to the one place every engine action
 * funnels through: `ComfyUIController.ensureServerRunning`, which throws
 * `NO_ENGINE_CODE` after the warning. That keeps MPI-390's point — one guard,
 * not one per tool, so a tool added later cannot forget it. The doors that stay
 * gated are the ones whose whole purpose is the engine: the Flow Library (every
 * Flow is a ComfyUI graph) and a local model install.
 *
 * The ladder is cheapest-first so the common path does no I/O at all.
 */

import { state } from '../state.js';
import { Events } from '../events.js';
import { remoteEngineClient } from './remoteEngineClient.js';
import { clientLogger } from './clientLogger.js';

const NO_ENGINE_MESSAGE =
    'This needs the ComfyUI engine, which is not installed. Cloud models still work. '
    + 'To use it, connect a Pod in Settings → RunPod, or turn off '
    + '"Skip the local engine install" there to install ComfyUI locally.';

/** `err.code` of the refusal `ensureServerRunning` throws; callers settle quietly on it. */
export const NO_ENGINE_CODE = 'no_engine';

/**
 * True when there is no engine available to dispatch to.
 *
 * 1. `skipLocalEngine` off → the boot gate guaranteed a local engine. Allow.
 * 2. Pod connected         → everything routes remote. Allow.
 * 3. A local engine exists anyway — the user toggled the skip ON while already
 *    having one installed. The skip means "don't install", not "don't use". Allow.
 * 4. Otherwise             → no engine.
 *
 * Fails OPEN (returns false) when the version check errors: blocking a user
 * because a health check hiccuped is worse than letting them meet the engine
 * error they would have met anyway.
 *
 * @returns {Promise<boolean>}
 */
export async function hasNoEngine() {
    if (!(state.runpodConfig || {}).skipLocalEngine) return false;

    try {
        await remoteEngineClient.refresh();
    } catch (_) { /* refresh failed — fall through; isRemote() uses last state */ }
    if (remoteEngineClient.isRemote()) return false;

    try {
        const res = await fetch('/engine/version-check');
        const data = await res.json();
        return data.needsInstall === true;
    } catch (err) {
        clientLogger.warn('engineGate', 'version-check failed — allowing through', err);
        return false;
    }
}

/**
 * `hasNoEngine()` plus the user-facing warning. Call sites read as a guard:
 * `if (await blockedByNoEngine()) return;`
 *
 * @returns {Promise<boolean>} true when the caller should abort.
 */
export async function blockedByNoEngine() {
    if (!(await hasNoEngine())) return false;
    Events.emit('ui:warning', { message: NO_ENGINE_MESSAGE });
    return true;
}
