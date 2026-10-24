// Convert named raws exactly as sync-raw-workflows does (outPathFor + shipUploadSlots), no commit.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const repo = process.cwd();
const { shipUploadSlots, outPathFor } = await import(pathToFileURL(path.join(repo, 'scripts/sync-raw-workflows.mjs')).href);
for (const name of process.argv.slice(2)) {
    const api = shipUploadSlots(execFileSync('node', [path.join(repo, 'scripts/workflow-to-api.mjs'), `comfy_workflows/raw/${name}`],
        { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));
    const out = outPathFor(name);
    fs.writeFileSync(out, api);
    console.log(path.relative(repo, out));
}
