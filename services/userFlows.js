'use strict';

/**
 * services/userFlows.js — Flow packages in `<userData>/user_flows/` (MPI-532).
 *
 * A package is DATA, never code: one folder holding `flow.json` (the manifest),
 * `workflow.json` (a ComfyUI API graph) and the preview files the manifest names. This
 * module scans and validates; routes/userFlows.js serves the files; the renderer builds the
 * FlowDef + op from the manifest (js/services/userFlowService.js). Format and every rule:
 * docs/flow-packages.md.
 *
 * userData, not the app folder: a portable update replaces the app and PRESERVES
 * `user-data/` (scripts/build-portable.mjs), so an installed package survives updates.
 *
 * The validator is developer experience, not security (MPI-560 phase 6): the injector
 * SILENTLY skips an Input_* title with no matching node, so without it a broken package
 * fails as a mystery. Every error names the fix.
 */

const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');
const { checkWorkflow, titleOf } = require('./injectionRules');

const _require = createRequire(__filename);

const SCHEMA = 'cubric/flow-package/v1';
const MANIFEST = 'flow.json';
const GRAPH = 'workflow.json';
const ID_RE = /^[a-z0-9][a-z0-9-]{1,40}$/;
// ponytail: flat names only — no subfolders, no leading dot, so no traversal to reason about.
const FILE_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const VERSION_RE = /^\d+\.\d+\.\d+$/;
const ABS_PATH_RE = /^(?:[A-Za-z]:[\\/]|\\\\|\/(?:home|Users|mnt|root|workspace|opt)\/)/;

// The keys built-in Flows use. The app sets `id`, `operation` and `workflow` itself.
const FLOW_KEYS = new Set(['title', 'preview', 'video', 'description', 'requiredModels',
    'requiredDeps', 'requiredPlugins', 'modelParams', 'mediaType', 'type', 'inputSchema',
    'result', 'steps', 'fields', 'derived', 'enhance', 'chain']);
const OP_KEYS = new Set(['label', 'progressLabel', 'mediaType', 'requiresImages',
    'requiresVideo', 'mediaInputs', 'promptRequired', 'injector', 'filePrefix']);
const MEDIA_TYPES = ['image', 'video', 'audio'];
const FLOW_TYPES = ['create', 'edit', 'enhance'];

/** Where packages live, or null when the server runs without a userData dir. */
function userFlowsDir() {
    const root = process.env.APP_USER_DATA;
    return root ? path.join(root, 'user_flows') : null;
}

/**
 * The ids and names a manifest may reference — whatever this app version declares.
 * A package carries ONE graph: the `byModel` graph switch built-in ops have is not offered.
 */
function loadKnown() {
    const { MODELS } = _require('../js/data/modelConstants/models.js');
    const { DEPS } = _require('../js/data/modelConstants/dependencies.js');
    const { PLUGINS } = _require('../js/data/pluginsRegistry.js');
    const { INJECTORS } = _require('../js/services/workflowInjectors/index.js');
    const { APP_VERSION } = _require('../js/core/appVersion.js');
    return {
        models: new Set(MODELS.map(m => m.id)),
        deps: new Set(Object.keys(DEPS)),
        plugins: new Set(PLUGINS.map(p => p.id)),
        // name -> the param keys it consumes (those never need a node title of their own)
        injectors: new Map(Object.entries(INJECTORS).map(([k, v]) => [k, new Set(v.consumes)])),
        appVersion: APP_VERSION,
    };
}

const _isObj = v => v && typeof v === 'object' && !Array.isArray(v);
const _missing = (kind, id) =>
    `Needs ${kind} "${id}", which this version of the app does not have.`;

function _versionBelow(a, b) {
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] < pb[i];
    return false;
}

// The ONE security rule here. The renderer interpolates FlowDef strings (title,
// description, field labels…) into innerHTML and double-quoted attributes, and the window
// runs with nodeIntegration — so markup in a manifest is code execution, not a typo. With
// none of these characters a string can open no tag and leave no attribute. Keys count too.
const MARKUP_RE = /[<>"`]/;
// Values that never reach the DOM, so they may hold anything: the graph-bound params (an
// enhance system prompt legitimately carries `<|im_start|>`) and `placeholder`, whose only
// sink is MpiInput, which escapes it. Keys inside them are still checked.
const GRAPH_BOUND_KEYS = new Set(['injectionParams', 'modelParams']);

/** JSON paths of every manifest key or string value that could carry markup. */
function _markupPaths(value, at = 'flow.json', exempt = false) {
    if (typeof value === 'string') return !exempt && MARKUP_RE.test(value) ? [at] : [];
    if (!value || typeof value !== 'object') return [];
    return Object.entries(value).flatMap(([k, v]) => [
        // Never echo the key: errors are shown in the Library.
        ...(MARKUP_RE.test(k) ? [`a key in ${at}`] : []),
        ..._markupPaths(v, Array.isArray(value) ? `${at}[${k}]` : `${at}.${k}`,
            exempt || GRAPH_BOUND_KEYS.has(k) || k === 'placeholder'),
    ]);
}

/** Every string widget value in the graph, for the absolute-path check. */
function* _graphStrings(graph) {
    for (const [id, node] of Object.entries(graph)) {
        for (const [key, v] of Object.entries(node?.inputs || {})) {
            if (typeof v === 'string') yield { id, key, v };
        }
    }
}

/**
 * Validate one package. Pure: no filesystem access.
 * @param {object} manifest - parsed flow.json
 * @param {object} graph - parsed workflow.json
 * @param {Set<string>} files - filenames present in the package folder
 * @param {object} [known] - loadKnown() output
 * @returns {string[]} errors, most actionable first; [] = valid
 */
function validatePackage(manifest, graph, files, known = loadKnown()) {
    if (!_isObj(manifest)) return [`${MANIFEST} is not a JSON object.`];
    const markup = _markupPaths(manifest);
    if (markup.length) {
        // Nothing else is checked: a package that fails this is never registered.
        return markup.map(p => `${p} contains < > " or \` — not allowed in a Flow (use “curly quotes”).`);
    }
    const errors = [];
    if (manifest.schema !== SCHEMA) errors.push(`${MANIFEST}: "schema" must be "${SCHEMA}".`);
    if (!ID_RE.test(manifest.id || '')) {
        errors.push(`${MANIFEST}: "id" must be 2-41 lowercase letters, digits or dashes (got "${manifest.id}").`);
    }
    if (!VERSION_RE.test(manifest.version || '')) errors.push(`${MANIFEST}: "version" must look like 1.0.0.`);

    const min = manifest.compat?.minAppVersion;
    if (min !== undefined) {
        if (!VERSION_RE.test(min)) errors.push(`${MANIFEST}: "compat.minAppVersion" must look like 2.0.0.`);
        else if (_versionBelow(known.appVersion, min)) {
            errors.push(`Needs app version ${min} or later (this is ${known.appVersion}).`);
        }
    }

    const flow = manifest.flow;
    const op = manifest.op;
    if (!_isObj(flow)) errors.push(`${MANIFEST}: "flow" is missing.`);
    if (!_isObj(op)) errors.push(`${MANIFEST}: "op" is missing.`);
    if (!_isObj(flow) || !_isObj(op)) return errors;

    // Referenced ids first: "needs X" is the error a user can act on.
    for (const slot of Array.isArray(flow.requiredModels) ? flow.requiredModels : []) {
        const ids = typeof slot === 'string' ? [slot] : (slot?.models || []);
        for (const id of ids) if (!known.models.has(id)) errors.push(_missing('model', id));
    }
    for (const id of Object.keys(flow.modelParams || {})) {
        if (!known.models.has(id)) errors.push(_missing('model', id));
    }
    for (const id of flow.requiredDeps || []) if (!known.deps.has(id)) errors.push(_missing('dependency', id));
    for (const id of flow.requiredPlugins || []) if (!known.plugins.has(id)) errors.push(_missing('plugin', id));
    if (op.injector !== undefined && !known.injectors.has(op.injector)) {
        errors.push(`op.injector "${op.injector}" is not one this app has (${[...known.injectors].join(', ')}).`);
    }

    // Shape.
    for (const k of Object.keys(flow)) {
        if (!FLOW_KEYS.has(k)) errors.push(`flow.${k} is not a Flow field${['id', 'operation', 'workflow'].includes(k) ? ' — the app sets it' : ''}.`);
    }
    for (const k of Object.keys(op)) if (!OP_KEYS.has(k)) errors.push(`op.${k} is not an op field.`);
    for (const k of ['title', 'description']) {
        if (typeof flow[k] !== 'string' || !flow[k].trim()) errors.push(`flow.${k} is required.`);
    }
    if (!Array.isArray(flow.requiredModels)) errors.push('flow.requiredModels must be a list (it may be empty).');
    if (!MEDIA_TYPES.includes(flow.mediaType)) errors.push(`flow.mediaType must be one of ${MEDIA_TYPES.join(', ')}.`);
    if (!FLOW_TYPES.includes(flow.type)) errors.push(`flow.type must be one of ${FLOW_TYPES.join(', ')}.`);
    if (typeof op.label !== 'string' || !op.label.trim()) errors.push('op.label is required.');
    if (!MEDIA_TYPES.includes(op.mediaType)) errors.push(`op.mediaType must be one of ${MEDIA_TYPES.join(', ')}.`);
    if (op.mediaInputs !== undefined && !Array.isArray(op.mediaInputs)) errors.push('op.mediaInputs must be a list.');
    if (op.filePrefix !== undefined && !/^[a-z][a-zA-Z0-9]{0,23}$/.test(op.filePrefix)) {
        errors.push('op.filePrefix must be one camelCase word of up to 24 characters, e.g. flowHeadSwap.');
    }
    for (const k of ['preview', 'video']) {
        if (flow[k] === undefined && k === 'video') continue;
        if (!FILE_RE.test(flow[k] || '')) errors.push(`flow.${k} must name a file in the package folder.`);
        else if (!files.has(flow[k])) errors.push(`flow.${k}: "${flow[k]}" is not in the package folder.`);
    }

    // Graph.
    if (!_isObj(graph)) return [...errors, `${GRAPH} is not a JSON object.`];
    errors.push(...checkWorkflow(graph).map(v => `${GRAPH}: ${v}`));
    const titles = new Set(Object.values(graph).map(n => titleOf(n).toLowerCase()).filter(Boolean));
    // A key the op's injector consumes is written by that injector, not by title
    // (commandExecutor deletes both the bare key and its Input_ alias).
    const consumed = known.injectors.get(op.injector) || new Set();
    const needTitle = (title, where) => {
        const node = String(title).split('.')[0];
        if (consumed.has(node) || consumed.has(node.replace(/^Input_/i, ''))) return;
        if (!titles.has(node.toLowerCase())) {
            errors.push(`${where} names "${node}", but no node in ${GRAPH} has that title — the value would be silently dropped.`);
        }
    };
    for (const slot of Array.isArray(op.mediaInputs) ? op.mediaInputs : []) {
        if (!_isObj(slot) || typeof slot.key !== 'string' || !MEDIA_TYPES.includes(slot.mediaType) || !/^Input_/i.test(slot.title || '')) {
            errors.push('op.mediaInputs entries need { key, mediaType, title: "Input_…" }.');
            continue;
        }
        needTitle(slot.title, `op.mediaInputs "${slot.key}"`);
    }
    const fields = [...(flow.fields || []), ...(flow.steps || []).flatMap(s => s?.fields || [])];
    for (const f of fields) if (/^Input_/i.test(f?.id || '')) needTitle(f.id, `field "${f.id}"`);
    for (const params of Object.values(flow.modelParams || {})) {
        for (const key of Object.keys(params || {})) if (/^Input_/i.test(key)) needTitle(key, `modelParams "${key}"`);
    }
    for (const { id, key, v } of _graphStrings(graph)) {
        if (ABS_PATH_RE.test(v)) errors.push(`${GRAPH}: node ${id} "${key}" holds an absolute path (${v}) — it will not exist on a buyer's machine.`);
    }
    return errors;
}

/** Read and validate one package folder. Never throws. */
function loadPackage(dir) {
    const folder = path.basename(dir);
    const readJson = (name) => JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
    let manifest = null;
    let graph = null;
    try { manifest = readJson(MANIFEST); } catch (e) {
        return { id: folder, manifest: null, errors: [`${MANIFEST}: ${e.code === 'ENOENT' ? 'missing' : e.message}`] };
    }
    try { graph = readJson(GRAPH); } catch (e) {
        return { id: folder, manifest, errors: [`${GRAPH}: ${e.code === 'ENOENT' ? 'missing' : e.message}`] };
    }
    const errors = validatePackage(manifest, graph, new Set(fs.readdirSync(dir)));
    // The folder name IS the id, so a URL maps to a folder with no index to keep.
    if (manifest.id !== folder) {
        errors.push(`The folder is named "${folder}" but the Flow's id is "${manifest.id}" — rename the folder to "${manifest.id}".`);
    }
    return { id: folder, manifest, errors };
}

/** Every package folder, valid or not. Creates `user_flows/` so users can find it. */
function scanUserFlows(root = userFlowsDir()) {
    if (!root) return [];
    fs.mkdirSync(root, { recursive: true });
    // A folder name is shown when its package is broken, so one carrying markup is not
    // listed at all (Windows cannot even create one; elsewhere it is deliberate).
    return fs.readdirSync(root, { withFileTypes: true })
        .filter(d => d.isDirectory() && !d.name.startsWith('.') && !MARKUP_RE.test(d.name))
        .map(d => loadPackage(path.join(root, d.name)));
}

/**
 * Install a package from a dropped folder or `.zip` (MPI-532 phase 3).
 *
 * Everything lands in `user_flows/.staging/` first — a dot-folder the scan skips — and
 * only a validated package is RENAMED into place, so a failed install never leaves half a
 * package behind. The manifest may sit at the root or inside one subfolder, which is how a
 * zipped folder (a Gumroad download) arrives. The destination is named after the manifest
 * id, whatever the source folder was called.
 *
 * @param {string} src - absolute path to a package folder or a .zip
 * @param {{overwrite?: boolean, root?: string}} [opts]
 * @returns {Promise<{status: 'installed'|'exists'|'invalid', id?: string, title?: string,
 *   errors?: string[], entry?: object}>}
 */
async function installPackage(src, { overwrite = false, root = userFlowsDir() } = {}) {
    if (!root) throw new Error('No user data folder to install into.');
    const staging = path.join(root, '.staging', `${Date.now()}-${process.pid}`);
    const raw = path.join(staging, 'raw');
    try {
        const stat = await fs.promises.stat(src);
        if (stat.isDirectory()) {
            await fs.promises.cp(src, raw, { recursive: true });
        } else if (/\.zip$/i.test(src)) {
            await _require('extract-zip')(src, { dir: raw });
        } else {
            return { status: 'invalid', errors: ['Drop a Flow folder or its .zip.'] };
        }

        let pkgDir = raw;
        if (!fs.existsSync(path.join(raw, MANIFEST))) {
            const dirs = fs.readdirSync(raw, { withFileTypes: true })
                .filter(d => d.isDirectory() && !d.name.startsWith('.') && d.name !== '__MACOSX');
            if (dirs.length !== 1) return { status: 'invalid', errors: [`No ${MANIFEST} found — this is not a Flow package.`] };
            pkgDir = path.join(raw, dirs[0].name);
        }
        let manifest;
        let graph;
        try {
            manifest = JSON.parse(await fs.promises.readFile(path.join(pkgDir, MANIFEST), 'utf8'));
            graph = JSON.parse(await fs.promises.readFile(path.join(pkgDir, GRAPH), 'utf8'));
        } catch (e) {
            return { status: 'invalid', errors: [e.code === 'ENOENT' ? `${path.basename(e.path)} is missing.` : `A package file is not valid JSON.`] };
        }
        const errors = validatePackage(manifest, graph, new Set(fs.readdirSync(pkgDir)));
        if (errors.length) return { status: 'invalid', errors };

        const dest = path.join(root, manifest.id);
        const found = { id: manifest.id, title: manifest.flow.title };
        const previous = path.join(staging, 'previous');
        if (fs.existsSync(dest)) {
            if (!overwrite) return { status: 'exists', ...found };
            await fs.promises.rename(dest, previous);
        }
        try {
            await fs.promises.rename(pkgDir, dest);
        } catch (err) {
            // Put the installed package back before `finally` deletes staging.
            if (fs.existsSync(previous)) await fs.promises.rename(previous, dest);
            throw err;
        }
        return { status: 'installed', ...found, entry: loadPackage(dest) };
    } finally {
        await fs.promises.rm(staging, { recursive: true, force: true });
    }
}

/** Absolute path of a package file, or null when the name is not a plain package file. */
function packageFilePath(id, file, root = userFlowsDir()) {
    if (!root || !ID_RE.test(id) || !FILE_RE.test(file)) return null;
    return path.join(root, id, file);
}

module.exports = { SCHEMA, userFlowsDir, loadKnown, validatePackage, loadPackage, scanUserFlows, installPackage, packageFilePath };
