#!/usr/bin/env node
/**
 * convert_and_bake.mjs - manual sync (no git commit) for MPI-1232 Phase 1.
 * Runs workflow-to-api.mjs for each changed raw file, resets upload pickers,
 * validates injection rules, and runs orchestrate.py.
 * Does NOT commit anything - Close-out owns commits.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO = 'C:/AI/Mpi/Cubric-Vision';
const RAW = path.join(REPO, 'comfy_workflows', 'raw');
const GEN = path.join(REPO, 'comfy_workflows', 'scripts', 'workflow_generation');
const WF  = path.join(REPO, 'comfy_workflows');
const CONVERTER = path.join(REPO, 'scripts', 'workflow-to-api.mjs');
const VALIDATOR  = path.join(REPO, 'scripts', 'validate-injection-rules.mjs');

// Raw files we changed, and their output destinations
const FILES = [
  { raw: 'krea2_t2i_template.json',  out: path.join(GEN, 'krea2_t2i_template.json'),  template: true },
  { raw: 'flux3_t2i_template.json',  out: path.join(GEN, 'flux3_t2i_template.json'),  template: true },
  { raw: 'moss_t2i_template.json',   out: path.join(GEN, 'moss_t2i_template.json'),   template: true },
  { raw: 'klein_t2i_template.json',  out: path.join(GEN, 'klein_t2i_template.json'),  template: true },
  { raw: 'chroma_t2i_template.json', out: path.join(GEN, 'chroma_t2i_template.json'), template: true },
  { raw: 'sdxl_t2i_template.json',   out: path.join(GEN, 'sdxl_t2i_template.json'),   template: true },
  { raw: 'qwen_image_2_1.json',      out: path.join(WF,  'qwen_image_2_1.json'),       template: false },
];

const UPLOAD_PICKERS = { MpiLoadImage: 'image', MpiLoadVideoUpload: 'video', MpiLoadAudioUpload: 'audio' };
function shipUploadSlots(apiText) {
  const api = JSON.parse(apiText);
  for (const node of Object.values(api)) {
    const key = UPLOAD_PICKERS[node?.class_type];
    if (!key) continue;
    if (typeof node.inputs[key] === 'string') node.inputs[key] = 'None';
    if (typeof node.inputs.string === 'string') node.inputs.string = '';
  }
  return JSON.stringify(api, null, 2) + '\n';
}

const touched = [];

for (const { raw, out, template } of FILES) {
  const src = path.join(RAW, raw);
  console.log(`Converting ${raw}...`);
  let api;
  try {
    api = execFileSync('node', [CONVERTER, src], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      env: { ...process.env, COMFY_URL: 'http://127.0.0.1:8188' },
    });
  } catch (e) {
    console.error(`FAIL ${raw}: ${(e.stderr || e.message).toString().trim()}`);
    process.exit(1);
  }
  const cleaned = shipUploadSlots(api);
  await fs.mkdir(path.dirname(out), { recursive: true });
  await fs.writeFile(out, cleaned);
  touched.push(out);
  console.log(`  -> ${path.relative(REPO, out)}`);
}

// Validate injection rules on all outputs
console.log('\nValidating injection rules...');
execFileSync('node', [VALIDATOR, ...touched], { cwd: REPO, stdio: 'inherit' });
console.log('Validation passed.');

// Run orchestrate.py (templates only)
console.log('\nRunning orchestrate.py...');
execFileSync('python', ['orchestrate.py'], { cwd: GEN, stdio: 'inherit' });
console.log('orchestrate.py done.');

console.log("done, nothing staged");
