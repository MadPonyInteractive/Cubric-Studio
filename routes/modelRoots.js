'use strict';

/**
 * routes/modelRoots.js — Single source of truth for the managed model roots list.
 *
 * Phase 1: exactly ONE root (the current custom root, or the default when none is
 * set). Behaviour is identical to today — this module replaces the scattered
 * regex / path checks with one file that can be tested with a fake root list and
 * no filesystem.
 *
 * Phase 3 (future): allow N peer roots.  The exports below are already shaped for
 * N roots; callers need only pass more entries in `roots`.
 *
 * INVARIANT — both-or-neither:
 *   `ownerRoot` and `findExisting` MUST iterate the same ordered root list.
 *   That shared iteration is the implementation of the rule "a root answers BOTH
 *   evidence and deletion, or NEITHER". It is not enforced by convention; it is
 *   enforced by both functions living here and sharing the same list.
 *
 * TESTABILITY:
 *   Every async export accepts an optional `{ roots }` (and `{ pathExists }` /
 *   `{ getFreeBytes }`) injection so tests can drive all five functions with a
 *   fake root list and no real filesystem and no app.
 */

const fs   = require('fs-extra');
const path = require('path');
const { getComfyPath, getEngineRoot } = require('./platformEngine');

const ENGINE_ROOT = getEngineRoot();

/**
 * Absolute path to model_roots.json, stored alongside extra_model_folders.json
 * and extra_model_paths.yaml in the ComfyUI directory.
 * @returns {string}
 */
function getModelRootsPath() {
    return getComfyPath(ENGINE_ROOT, 'model_roots.json');
}

/**
 * Returns the ordered list of managed model roots (main first).
 * Reads from model_roots.json.  Returns [] if the file does not exist or is
 * unreadable — callers fall back to getDefaultModelsRoot() as needed.
 *
 * For tests pass `{ _roots: [...] }` to inject a fake root list directly,
 * bypassing all filesystem I/O.
 *
 * @param {{ _roots?: string[]|null }} [opts]
 * @returns {Promise<string[]>}
 */
async function getRoots({ _roots = null } = {}) {
    if (_roots !== null) return _roots;
    const configPath = getModelRootsPath();
    if (!(await fs.pathExists(configPath))) return [];
    try {
        const raw = await fs.readJson(configPath);
        return Array.isArray(raw.roots)
            ? raw.roots.filter((r) => typeof r === 'string' && r.trim())
            : [];
    } catch {
        return [];
    }
}

/**
 * Persists the roots list to model_roots.json.
 * Callers (e.g. writeExtraModelPathsYaml, getCustomRoot migration) use this to
 * keep the JSON in sync whenever the active root changes.
 * @param {string[]} roots
 */
async function setRoots(roots) {
    const configPath = getModelRootsPath();
    await fs.ensureDir(path.dirname(configPath));
    await fs.writeJson(
        configPath,
        { roots: Array.isArray(roots) ? roots : [] },
        { spaces: 2 },
    );
}

/**
 * Returns the first absolute path where `relPath` exists under any managed root.
 * Returns null if not found in any root.
 *
 * **Invariant:** every path this function returns is a path that `ownerRoot`
 * claims (given the same `roots` list).  Both functions iterate `rootList` in the
 * same order — that is the mechanical guarantee of the both-or-neither property.
 *
 * @param {string} relPath
 *   Relative path within a root, e.g. "checkpoints/model.safetensors".
 * @param {{ roots?: string[]|null, pathExists?: Function|null }} [opts]
 *   `roots`     — inject a fake root list (tests, no filesystem required).
 *   `pathExists(absPath) → Promise<boolean>` — inject a fake existence check.
 * @returns {Promise<string|null>}
 */
async function findExisting(relPath, { roots = null, pathExists = null } = {}) {
    const rootList = roots !== null ? roots : await getRoots();
    const existsFn = pathExists !== null ? pathExists : (p) => fs.pathExists(p);
    for (const root of rootList) {
        const abs = path.join(root, relPath);
        if (await existsFn(abs)) return abs;
    }
    return null;
}

/**
 * Returns ALL absolute paths where `relPath` exists across every managed root.
 * Empty array when not found anywhere.
 *
 * Phase 3: used by uninstall to delete every copy from every root.
 *
 * @param {string} relPath
 * @param {{ roots?: string[]|null, pathExists?: Function|null }} [opts]
 * @returns {Promise<string[]>}
 */
async function findAllCopies(relPath, { roots = null, pathExists = null } = {}) {
    const rootList = roots !== null ? roots : await getRoots();
    const existsFn = pathExists !== null ? pathExists : (p) => fs.pathExists(p);
    const result = [];
    for (const root of rootList) {
        const abs = path.join(root, relPath);
        if (await existsFn(abs)) result.push(abs);
    }
    return result;
}

/**
 * Returns the first managed root that has at least `bytes` free space.
 * Checks roots in order (main first) — intentional: keeps fast/primary drives
 * full before spilling to secondary, rather than the most-free heuristic that
 * would scatter models across all drives simultaneously.
 *
 * Returns null when no root has enough space; the caller raises the disk-full gate.
 *
 * @param {string} _relPath  Reserved for per-bucket write policies (Phase 3).
 * @param {number} bytes
 * @param {{ roots?: string[]|null, getFreeBytes?: Function|null }} [opts]
 *   `getFreeBytes(rootDir) → Promise<number>` — inject for tests (no disk I/O).
 * @returns {Promise<string|null>}
 */
async function pickWriteRoot(_relPath, bytes, { roots = null, getFreeBytes = null } = {}) {
    const rootList = roots !== null ? roots : await getRoots();
    const getAvailable = getFreeBytes !== null
        ? getFreeBytes
        : async (dir) => {
            try {
                const { statfs } = require('node:fs/promises');
                const s = await statfs(dir);
                return s.bfree * s.bsize;
            } catch {
                // statfs not available (Node < 19) or dir does not exist — do not block.
                return Infinity;
            }
        };
    for (const root of rootList) {
        const available = await getAvailable(root);
        if (available >= (bytes || 0)) return root;
    }
    return null;
}

/**
 * Returns the managed root that owns `absPath`, i.e. the root whose path is a
 * directory-prefix of `absPath`.  Returns null when `absPath` is outside every
 * managed root.
 *
 * **Invariant:** if `findExisting(rel, { roots })` returned a path P, then
 * `ownerRoot(P, { roots })` returns a non-null root.  Conversely, if
 * `ownerRoot(P, { roots })` returns null, `findExisting` never returned P for
 * those roots.  Both functions iterate the same list — the invariant holds by
 * construction, not convention.
 *
 * @param {string} absPath
 * @param {{ roots?: string[]|null }} [opts]
 * @returns {Promise<string|null>}
 */
async function ownerRoot(absPath, { roots = null } = {}) {
    const rootList = roots !== null ? roots : await getRoots();
    // Normalise to forward slashes for a consistent prefix check on Windows.
    const normalizedAbs = absPath.replace(/\\/g, '/');
    for (const root of rootList) {
        const nr = root.replace(/\\/g, '/').replace(/\/$/, '');
        if (normalizedAbs === nr || normalizedAbs.startsWith(nr + '/')) return root;
    }
    return null;
}

module.exports = {
    getModelRootsPath,
    getRoots,
    setRoots,
    findExisting,
    findAllCopies,
    pickWriteRoot,
    ownerRoot,
};
