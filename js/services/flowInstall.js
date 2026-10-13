/**
 * flowInstall.js — the ONE way a Flow's missing weights get downloaded (MPI-1126).
 *
 * Lifted out of MpiFlowLibrary's closure because a second caller needs it: an outside agent
 * over MCP (`agent.install-flow` in js/shell/agentDispatch.js). Two copies of "what does
 * installing a Flow start" would drift the first time a Flow grows a new kind of dependency
 * (MPI-1098 was exactly that, for a plugin-only Flow).
 *
 * Every missing required MODEL drives its own dep download (the Model Library's install), plus
 * the Flow's own deps as ONE more job under `flowDepKey`. `downloadService.start()` raises the
 * licence gate itself, so a gated model asks the user in the app whoever started it.
 */
import { state } from '../state.js';
import { flowAvailability, getFlowDependencies, flowDepKey } from '../data/flowsRegistry.js';
import { getModelDependencies, getModelDepStatus } from '../data/modelRegistry.js';
import { DEPS } from '../data/modelConstants/dependencies.js';
import { sizeToGb } from '../data/modelConstants/footprint.js';
import { downloadService } from './downloadService.js';

// A queued or running job, the Model Library's `isActiveDownload` set. A finished or failed
// job can linger in `downloadJobs` and must not block a retry.
const LIVE = ['pending', 'downloading', 'paused', 'installing', 'queued'];

/** Whether a download job for this queue key is already queued or running. */
export function hasLiveJob(key) {
    return (state.downloadJobs || []).some(j => j.modelId === key && LIVE.includes(j.status));
}

/**
 * Start every missing download the Flow needs. A key already queued or downloading (from the
 * Flow Library, the Model Library or an agent) is skipped: `start()` would replace its job and
 * POST it again (MPI-1098). Resolves nothing: a refused licence and a started download look the
 * same here, on purpose (MpiFlowLibrary, MPI-743).
 * @param {Object} flow a FlowDef
 */
export function installFlow(flow) {
    const { missing, missingDeps } = flowAvailability(flow);
    for (const modelId of missing) {
        if (hasLiveJob(modelId)) continue;
        const deps = getModelDependencies(modelId);
        if (deps.length) downloadService.start(modelId, deps);
    }
    if (missingDeps.length && !hasLiveJob(flowDepKey(flow.id))) {
        const deps = getFlowDependencies(flow);
        if (deps.length) downloadService.start(flowDepKey(flow.id), deps);
    }
}

/**
 * GB still to download for the Flow: the missing models' uninstalled deps plus its own missing
 * deps, each file counted once (two models can share a text encoder). 1024-based, as dep size
 * strings are measured.
 * @param {Object} flow a FlowDef
 * @returns {number}
 */
export function flowDownloadGb(flow) {
    const { missing, missingDeps } = flowAvailability(flow);
    const files = new Set(missingDeps.map(id => DEPS[id]).filter(Boolean));
    for (const modelId of missing) {
        const status = getModelDepStatus(modelId);
        for (const dep of getModelDependencies(modelId)) {
            const s = status?.get(dep.id);
            if (s !== true && s?.installed !== true) files.add(dep);
        }
    }
    return [...files].reduce((sum, dep) => sum + (dep.size ? sizeToGb(dep.size) : 0), 0);
}
