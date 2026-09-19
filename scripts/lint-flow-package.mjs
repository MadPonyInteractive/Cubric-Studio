#!/usr/bin/env node
/**
 * lint-flow-package.mjs — check a Flow package folder before you ship it (MPI-532).
 *
 * Usage:
 *   node scripts/lint-flow-package.mjs <package-folder> [<package-folder> ...]
 *
 * Runs the validator the app itself runs on `user_flows/` (services/userFlows.js), so a
 * package that passes here loads there — for THIS checkout's app version, models, deps
 * and injectors. Then, when a ComfyUI answers at COMFY_URL (default http://127.0.0.1:8188),
 * it also checks every node class exists there, which the app cannot (no engine need be
 * up when it loads).
 *
 * That class check only means something against a ComfyUI whose node packs match the
 * shipped engine — so set COMFY_PATH to that ComfyUI's folder and the linter says whether
 * it does (MPI-798): both the pinned packs that are missing or drifted, and the EXTRA
 * packs installed beyond the pins, whose classes exist on no user's machine. Without it
 * the class check still runs, and still cannot tell you whether a clean result is worth
 * anything.
 *
 * Exit 0 = clean, 1 = problems found, 2 = usage. Format and rules: docs/flow-packages.md.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import userFlows from '../services/userFlows.js';
import injectionRules from '../services/injectionRules.js';
import { inspectPack, resolveComfyRoot, loadPins } from './install-flow-devkit.mjs';

const COMFY = process.env.COMFY_URL || 'http://127.0.0.1:8188';
const COMFY_PATH = process.env.COMFY_PATH || '';

async function fetchObjectInfo() {
    try {
        const res = await fetch(`${COMFY}/object_info`, { signal: AbortSignal.timeout(5000) });
        return res.ok ? await res.json() : null;
    } catch {
        return null;
    }
}

const dirs = process.argv.slice(2);
if (!dirs.length) {
    console.error('Usage: node scripts/lint-flow-package.mjs <package-folder> [...]');
    process.exit(2);
}

/**
 * Packs installed BEYOND the pins are the blind spot the comparison above cannot see: it
 * iterates the lock, so a folder the lock never names is never looked at. A graph built
 * on a class from one of those passes both checks here and fails for every user. Warn,
 * never fail — an extra pack is legitimate right up until a graph uses one.
 *
 * `.disabled` is how ComfyUI-Manager parks a pack: it loads nothing, contributes no
 * classes, and is not an extra. `__pycache__` is not a pack either. The lock's
 * `filename` is compared case-insensitively because Windows is, and the MPI bench really
 * does carry `comfyui-krea2-controlnet` against the lock's `ComfyUI-Krea2-ControlNet`.
 */
function findExtraPacks(customNodes, lockNodes) {
    const pinned = new Set(Object.values(lockNodes).map(n => n.filename.toLowerCase()));
    return fs.readdirSync(customNodes, { withFileTypes: true })
        .filter(d => d.isDirectory() || d.isSymbolicLink())
        .map(d => d.name)
        .filter(name => !name.startsWith('.')
            && name !== '__pycache__'
            && !name.endsWith('.disabled')
            && !pinned.has(name.toLowerCase()))
        .sort();
}

/**
 * A clean node-class check is only meaningful when the ComfyUI behind it carries the
 * packs the app ships. Report that plainly instead of leaving the developer to assume it
 * — but never fail on it: authoring deliberately against a newer pack is legitimate.
 */
async function reportEngineMatch() {
    if (!COMFY_PATH) {
        console.log('Engine match NOT checked — set COMFY_PATH to the ComfyUI folder behind COMFY_URL.');
        return;
    }
    const comfyRoot = resolveComfyRoot(COMFY_PATH);
    if (!comfyRoot) {
        console.log(`! COMFY_PATH "${COMFY_PATH}" has no custom_nodes folder — engine match NOT checked.`);
        return;
    }
    let pins;
    try {
        pins = await loadPins(null);
    } catch (err) {
        console.log(`! could not read the pins (${err.message}) — engine match NOT checked.`);
        return;
    }
    const customNodes = path.join(comfyRoot, 'custom_nodes');
    const off = [];
    for (const [, entry] of Object.entries(pins.lock.nodes)) {
        const { state } = await inspectPack(customNodes, entry);
        if (state !== 'ok') off.push(`${entry.filename} (${state})`);
    }
    const extra = findExtraPacks(customNodes, pins.lock.nodes);
    if (!off.length) {
        console.log(`Engine matches ${pins.source} — a clean result below holds for that release.`);
    } else {
        console.log(`! ${off.length} of ${Object.keys(pins.lock.nodes).length} node packs do not match ${pins.source}:`);
        for (const line of off) console.log(`    • ${line}`);
        console.log('  A clean result below does NOT prove this Flow runs for users.');
        console.log('  Fix: node scripts/install-flow-devkit.mjs "<comfyui-folder>"');
    }
    if (!extra.length) return;
    console.log(`! ${extra.length} node pack(s) installed that ${pins.source} does not ship:`);
    for (const name of extra) console.log(`    • ${name}`);
    console.log('  Keeping them is fine — but a class from one of these passes every check');
    console.log("  below and exists on NO user's machine.");
}

const objectInfo = await fetchObjectInfo();
console.log(objectInfo
    ? `Node classes checked against ${COMFY}.`
    : `No ComfyUI at ${COMFY} — node classes NOT checked (set COMFY_URL to check them).`);
await reportEngineMatch();

let bad = 0;
for (const dir of dirs) {
    const { manifest, errors } = userFlows.loadPackage(path.resolve(dir));
    if (objectInfo) {
        try {
            const graph = JSON.parse(fs.readFileSync(path.join(dir, 'workflow.json'), 'utf8'));
            // loadPackage already ran the engine-free checks; keep only what the engine adds.
            const base = new Set(injectionRules.checkWorkflow(graph));
            errors.push(...injectionRules.checkWorkflow(graph, objectInfo)
                .filter(v => !base.has(v)).map(v => `workflow.json: ${v}`));
        } catch { /* unreadable graph: loadPackage already said so */ }
    }
    if (errors.length) {
        bad++;
        console.error(`\n✗ ${dir} — ${errors.length} problem(s):`);
        for (const e of errors) console.error(`    • ${e}`);
    } else {
        console.log(`\n✓ ${dir} — ${manifest.flow.title} ${manifest.version} (installs as user:${manifest.id})`);
    }
}
process.exit(bad ? 1 : 0);
