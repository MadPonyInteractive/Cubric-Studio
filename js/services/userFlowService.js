/**
 * js/services/userFlowService.js — Flow packages from `<userData>/user_flows/` (MPI-532).
 *
 * The server scans and validates (services/userFlows.js, GET /user-flows). This file builds
 * each package into the SAME registries a built-in Flow lives in — `FLOWS`, `COMMANDS`,
 * `UNIVERSAL_WORKFLOWS` — so every consumer (the Library, the frame, dispatch, the
 * connector) handles a package Flow with no branch of its own. No registry FILE is edited.
 *
 * Keys are namespaced `user:<id>` against collision with built-in ids. Graph and preview
 * paths are `user-flows/<id>/…`, which routes/userFlows.js answers under the
 * `/comfy_workflows/` and `comfy_workflows/display/` prefixes every fetch site already uses.
 *
 * An invalid package is still listed, disabled, carrying `disabledReason` (its first
 * validation error): silence reads as a broken app. Format: docs/flow-packages.md.
 */

import { FLOWS } from '../data/flowsRegistry.js';
import { COMMANDS } from '../data/commandRegistry.js';
import { UNIVERSAL_WORKFLOWS } from '../data/modelConstants/universal_workflows.js';
import { clientLogger } from './clientLogger.js';

export const USER_FLOW_PREFIX = 'user:';

const MEDIA_TYPES = ['image', 'video', 'audio'];
const FILE_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const MARKUP_RE = /[<>"`]/;

/** `Head Swap` → `flowHeadSwap`: the saved-file prefix, never the `user:` key. */
function _filePrefix(title) {
    const words = String(title).match(/[A-Za-z0-9]+/g) || ['Package'];
    return `flow${words.map(w => w[0].toUpperCase() + w.slice(1)).join('')}`.slice(0, 24);
}

/**
 * Register (or re-register) one package from its /user-flows entry.
 * @param {{id: string, manifest: object|null, errors: string[]}} entry
 * @returns {object} the FlowDef now in FLOWS
 */
export function registerUserFlow({ id, manifest, errors }) {
    const key = `${USER_FLOW_PREFIX}${id}`;
    const base = `user-flows/${id}/`;
    const flow = manifest?.flow || {};
    let def;
    if (errors.length) {
        // Only what is safe to show: a broken manifest may carry markup the server
        // refused, so anything that fails these checks falls back to the folder name.
        const safe = v => typeof v === 'string' && v.trim() && !MARKUP_RE.test(v);
        def = {
            id: key,
            title: safe(flow.title) ? flow.title : id,
            description: safe(flow.description) ? flow.description : '',
            preview: FILE_RE.test(flow.preview || '') ? base + flow.preview : undefined,
            requiredModels: [],
            mediaType: MEDIA_TYPES.includes(flow.mediaType) ? flow.mediaType : undefined,
            type: flow.type,
            operation: key,
            workflow: '',
            disabledReason: errors[0],
        };
        // A reinstall can turn a valid package invalid: nothing may still dispatch it.
        delete COMMANDS[key];
        delete UNIVERSAL_WORKFLOWS[key];
    } else {
        def = {
            ...flow,
            id: key,
            operation: key,
            workflow: `${base}workflow.json`,
            preview: base + flow.preview,
            ...(flow.video ? { video: base + flow.video } : {}),
        };
        COMMANDS[key] = {
            requiresImages: 0,
            ...manifest.op,
            universal: true,
            filePrefix: manifest.op.filePrefix || _filePrefix(flow.title),
        };
        UNIVERSAL_WORKFLOWS[key] = { workflow: def.workflow };
    }
    const at = FLOWS.findIndex(f => f.id === key);
    if (at === -1) FLOWS.push(def); else FLOWS[at] = def;
    return def;
}

/** Remove a package Flow from every registry `registerUserFlow` wrote. */
export function unregisterUserFlow(key) {
    const at = FLOWS.findIndex(f => f.id === key);
    if (at !== -1) FLOWS.splice(at, 1);
    delete COMMANDS[key];
    delete UNIVERSAL_WORKFLOWS[key];
}

/**
 * Load every installed package, and drop any registered one whose folder is gone (the
 * Flow Library's Refresh). Never rejects — a failed scan leaves every registry untouched,
 * and boot awaits this before the first model/dep sync.
 */
export async function loadUserFlows() {
    try {
        const res = await fetch('/user-flows');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const { flows = [] } = await res.json();
        const onDisk = new Set(flows.map(f => `${USER_FLOW_PREFIX}${f.id}`));
        FLOWS.filter(f => f.id.startsWith(USER_FLOW_PREFIX) && !onDisk.has(f.id))
            .forEach(f => unregisterUserFlow(f.id));
        flows.forEach(registerUserFlow);
        const broken = flows.filter(f => f.errors.length);
        clientLogger.info('userFlows', `registered ${flows.length - broken.length} package Flow(s), ${broken.length} disabled`);
    } catch (err) {
        clientLogger.error('userFlows', `could not load Flow packages: ${err.message}`);
    }
}
