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
 * it does (MPI-798). Without it the class check still runs, and still cannot tell you
 * whether a clean result is worth anything.
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
    if (!off.length) {
        console.log(`Engine matches ${pins.source} — a clean result below holds for that release.`);
        return;
    }
    console.log(`! ${off.length} of ${Object.keys(pins.lock.nodes).length} node packs do not match ${pins.source}:`);
    for (const line of off) console.log(`    • ${line}`);
    console.log('  A clean result below does NOT prove this Flow runs for users.');
    console.log('  Fix: node scripts/install-flow-devkit.mjs "<comfyui-folder>"');
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
