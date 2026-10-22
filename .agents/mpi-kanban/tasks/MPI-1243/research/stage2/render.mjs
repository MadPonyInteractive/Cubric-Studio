// Render each enhanced prompt on moss-image (Turbo) in the isolated app, seed 1234.
import fs from 'node:fs';
const SP = 'C:/Users/Fabio/AppData/Local/Temp/claude/C--AI-Mpi-Cubric-Vision/1394a049-1a69-4801-af72-4444bf14162b/scratchpad/';
const folderPath = SP + 'docs/Cubric Studio/Projects/Moss Enhance Stage 2';
const tag = process.argv[2] || '';
const jobs = JSON.parse(fs.readFileSync(SP + `enhanced${tag}.json`, 'utf8'));
const ratios = ['3:4', '1:1', '1:1'];
const out = [];
for (const [i, j] of jobs.entries()) {
  const t0 = Date.now();
  const r = await (await fetch('http://127.0.0.1:49969/connector/generate', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ modelId: 'moss-image', operation: 't2i', positive: j.text, folderPath, turbo: true, seed: 1234, ratio: ratios[i], name: `enhanced${tag} ${i + 1}` }),
  })).json();
  out.push({ idea: j.idea, s: (Date.now() - t0) / 1000, ok: r.ok, path: r.path || r.result?.path, err: r.error });
  console.log(JSON.stringify(out.at(-1)), JSON.stringify(r).slice(0, 300));
}
fs.writeFileSync(SP + `renders${tag}.json`, JSON.stringify(out, null, 2));
