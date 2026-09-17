#!/usr/bin/env node
/**
 * validate-injection-rules.mjs — gate a converted API workflow against Cubric's
 * ComfyUI injection rules (.claude/rules/comfy_injection.md) BEFORE it is baked
 * into runtime files. API format has no UI cruft, so the checkable contract is
 * exactly the node titles + inputs + graph shape.
 *
 * Usage:
 *   node scripts/validate-injection-rules.mjs <api.json> [<api.json> ...]
 *
 * Exit 0 = all clean. Exit 1 = at least one violation (printed per file, per node).
 * On any violation the caller (sync-raw-workflows.mjs) STOPS before orchestrate.
 *
 * The checks themselves live in services/injectionRules.js (MPI-532), because the
 * Flow-package validator runs them inside the shipped app, where `scripts/` is not
 * packaged. See that file for the list.
 *
 * NOTE (MPI-300): the old "deprecated bare-title" check is GONE. The injection
 * contract is now purely prefix-based — the app injects ONLY Input_* nodes and reads
 * ONLY Output_* nodes (author convention: prefix + colour those nodes yellow). Any
 * un-prefixed node is by definition workflow-internal, so its title is the author's
 * to choose freely (descriptive debug names like "steps" / "denoise" are welcome).
 * The bare-vocabulary blocklist existed only to migrate pre-prefix legacy workflows,
 * a migration now complete, and had become a false-positive on internal debug titles.
 *
 * Requires a running ComfyUI (/object_info) for the node-class check — same
 * engine the converter used. COMFY_URL overrides http://127.0.0.1:8188.
 */

import fs from 'node:fs/promises';
import process from 'node:process';
import http from 'node:http';
import injectionRules from '../services/injectionRules.js';

const { checkWorkflow, titleOf } = injectionRules;
const COMFY = process.env.COMFY_URL || 'http://127.0.0.1:8188';

// MPI-800 — an MpiNodes Upload loader in a SHIPPED graph is an app media slot: titled
// Input_* (so the app injects the file into its `string`) and with its picker on "None"
// (the node falls back to the picker when `string` is empty, so a bench pick would load
// for users). Kept here, not in services/injectionRules.js: that module also judges
// user Flow packages, which this shipping rule does not cover.
const UPLOAD_PICKERS = { MpiLoadImage: 'image', MpiLoadVideoUpload: 'video', MpiLoadAudioUpload: 'audio' };
function checkUploadSlots(wf) {
  const out = [];
  for (const [id, node] of Object.entries(wf)) {
    const key = UPLOAD_PICKERS[node?.class_type];
    if (!key) continue;
    const title = titleOf(node);
    if (!/^input_/i.test(title)) {
      out.push(`#${id} ${node.class_type} "${title}" is not titled Input_* — the app cannot inject it, so it loads whatever its picker holds. Title it Input_<slot> in the graph.`);
    }
    if (node.inputs?.[key] !== 'None') {
      out.push(`#${id} ${node.class_type} "${title}" ships with ${key} = ${JSON.stringify(node.inputs?.[key])} — shipped graphs keep the picker on "None" (sync-raw-workflows.mjs sets it).`);
    }
    if (typeof node.inputs?.string === 'string' && node.inputs.string !== '') {
      out.push(`#${id} ${node.class_type} "${title}" ships with string = ${JSON.stringify(node.inputs.string)} — the app injects it; a shipped graph keeps it empty (sync-raw-workflows.mjs clears it).`);
    }
  }
  return out;
}

function fetchObjectInfo() {
  return new Promise((resolve, reject) => {
    http.get(`${COMFY}/object_info`, { headers: { connection: 'close' } }, (res) => {
      if (res.statusCode !== 200) { reject(new Error(`/object_info returned ${res.statusCode}`)); res.resume(); return; }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c) => (body += c));
      res.on('end', () => { try { resolve(JSON.parse(body)); } catch (e) { reject(e); } });
    }).on('error', (e) => reject(new Error(`Cannot reach ComfyUI at ${COMFY} (${e.message}). Start the engine first.`)));
  });
}

async function main() {
  const files = process.argv.slice(2);
  if (!files.length) {
    console.error('Usage: node scripts/validate-injection-rules.mjs <api.json> [...]');
    process.exit(2);
  }
  const objectInfo = await fetchObjectInfo();

  let bad = 0;
  for (const f of files) {
    let wf;
    try { wf = JSON.parse(await fs.readFile(f, 'utf8')); }
    catch (e) { console.error(`✗ ${f}: cannot read/parse (${e.message})`); bad++; continue; }
    const violations = [...checkWorkflow(wf, objectInfo), ...checkUploadSlots(wf)];
    if (violations.length) {
      bad++;
      console.error(`✗ ${f} — ${violations.length} injection-rule violation(s):`);
      for (const v of violations) console.error(`    • ${v}`);
    } else {
      console.log(`✓ ${f}`);
    }
  }
  if (bad) {
    console.error(`\n${bad} file(s) violate the injection rules. Fix in the raw graph and re-convert — a converted API file is build output, so patching it here is reverted by the next convert.`);
    process.exit(1);
  }
  console.log(`\nAll ${files.length} file(s) conform to the injection rules.`);
}

main().catch((e) => { console.error(e.message || e); process.exit(2); });
