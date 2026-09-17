// MPI-800 bake: the steps of scripts/sync-raw-workflows.mjs (convert -> shipUploadSlots ->
// write -> validate -> orchestrate) on the raw files MPI-800 converted, WITHOUT its raw commit.
// raw/ was committed in ee034559; gif_cutout_birefnet (MPI-771, 1b55d284) is converted in the worktree.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const REPO = 'C:/AI/Mpi/Cubric-Vision';
process.chdir(REPO);
const COMFY_URL = process.env.COMFY_URL || 'http://127.0.0.1:48188';
const EXCLUDE = new Set(['ltx_v2v_lipdub_template.json']);   // no handler; MPI-537 keeps it raw-only
const { shipUploadSlots, outPathFor } = await import(`file:///${REPO}/scripts/sync-raw-workflows.mjs`);

const git = (...a) => execFileSync('git', a, { encoding: 'utf8' }).split('\n').filter(Boolean);
const changed = [...new Set([
    ...git('diff', '--name-only', 'ee034559^', 'ee034559', '--', 'comfy_workflows/raw'),
    ...git('diff', '--name-only', '--', 'comfy_workflows/raw'),
].map((p) => path.basename(p)))].filter((f) => !EXCLUDE.has(f)).sort();
console.log(`${changed.length} raw file(s) to bake against ${COMFY_URL}`);
if (process.argv.includes('--list')) { console.log(changed.join('\n')); process.exit(0); }

const touched = [];
let anyTemplate = false;
for (const f of changed) {
    const api = execFileSync('node', ['scripts/workflow-to-api.mjs', path.join('comfy_workflows/raw', f)],
        { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, env: { ...process.env, COMFY_URL } });
    const out = outPathFor(f);
    fs.writeFileSync(out, shipUploadSlots(api));
    touched.push(out);
    anyTemplate ||= /_template\.json$/i.test(f);
    console.log(`OK    ${f} -> ${path.relative(REPO, out)}`);
}

execFileSync('node', ['scripts/validate-injection-rules.mjs', ...touched],
    { stdio: 'inherit', env: { ...process.env, COMFY_URL } });

if (anyTemplate) {
    execFileSync('python', ['orchestrate.py'],
        { cwd: path.join(REPO, 'comfy_workflows/scripts/workflow_generation'), stdio: 'inherit' });
}
console.log('\nBaked. Nothing staged or committed.');
