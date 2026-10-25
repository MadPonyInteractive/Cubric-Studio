// MPI-1231 panel-model bench: FLUX.3 Klein vs Qwen-Image 2.1, the same plan, refs, seeds and size,
// on the G: bench (:8188), never the app engine. Run under the GPU lease:
//   python gpu_lease.py run --poll 2 -- node bench.mjs <plan.json> [flux3|qwen21 ...]
// plan.json = { text } from a Plan with Cosmo answer; panels are parsed here with the app's parser.
// Out: out/<model>/panel_N.png. Mirrors storyboardDispatch: edit (wf 4) with the refs, custom size
// on, the user's notes as the idea the cast lines read; FLUX.3 with Turbo, as the Flow sends it.
import fs from 'node:fs';
import path from 'node:path';
import { parseStoryboardPlan } from 'file:///C:/AI/Mpi/Cubric-Vision/js/services/storyboardRunner.js';

const ROOT = 'C:/AI/Mpi/Cubric-Vision/';
const HERE = path.dirname(new URL(import.meta.url).pathname).replace(/^\/(\w:)/, '$1');
const URL_ = 'http://127.0.0.1:8188';
const TIKORI = 'C:/Users/Fabio/Documents/Cubric Studio/Projects/Tikori Characters/Media/';
// Fabio's board 2026-10-25: 1 the Sphinx (hairless cat), 2 Jubie (white tiger), 3 the fox and the lion.
const REFS = [TIKORI + 't2i_d919b5be.png', TIKORI + 't2i_8ef43aa4.png', TIKORI + 't2i_566d9ebe.jpg'];
const IDEA = 'A story where the fox and the lion are going on an adventure and then the Sphinx tries to stop them at the entrance of the forest, asking for a toll. Then Jubie, the protector, scares the Sphinx away and becomes friends with the fox and the lion. '
  + 'Picture 1 is The Sphinx, the bad guy. Picture 2 is Jubie, the protector warrior. Picture 3 is The Fox and the Lion.';
const SIZE = [1344, 768];
const SEED = 1231100;
const MODELS = {
  flux3: { graph: 'flux3_t2i.json', extra: { Input_is_Turbo: true } },
  qwen21: { graph: 'qwen_image_2_1.json', extra: {} },
};

const byTitle = (g, t) => Object.values(g).find(n => n._meta?.title === t);
const setParam = (g, title, value) => {
  const n = byTitle(g, title);
  if (!n) throw new Error(`no node ${title}`);
  const f = ['value', 'string', 'int', 'float', 'boolean'].find(k => k in n.inputs);
  n.inputs[f] = value;
};
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function run(g) {
  const r = await (await fetch(`${URL_}/prompt`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: g }) })).json();
  if (!r.prompt_id) throw new Error('SUBMIT FAILED ' + JSON.stringify(r).slice(0, 800));
  for (;;) {
    await sleep(1000);
    const h = (await (await fetch(`${URL_}/history/${r.prompt_id}`)).json())[r.prompt_id];
    if (h?.status?.status_str === 'error') throw new Error('RUN FAILED ' + JSON.stringify(h.status.messages).slice(0, 1500));
    if (h?.status?.completed) return h;
  }
}

async function upload(file) {
  const fd = new FormData();
  fd.append('image', new Blob([fs.readFileSync(file)]), 'mpi1231_' + path.basename(file));
  fd.append('overwrite', 'true');
  return (await (await fetch(`${URL_}/upload/image`, { method: 'POST', body: fd })).json()).name;
}

const [planFile, ...which] = process.argv.slice(2);
const panels = parseStoryboardPlan(JSON.parse(fs.readFileSync(planFile, 'utf8')).plan, IDEA);
fs.mkdirSync(`${HERE}/out`, { recursive: true });
fs.writeFileSync(`${HERE}/out/panels.json`, JSON.stringify(panels, null, 2));
const refs = [];
for (const f of REFS) refs.push(await upload(f));

for (const m of which.length ? which : Object.keys(MODELS)) {
  const base = JSON.parse(fs.readFileSync(ROOT + 'comfy_workflows/' + MODELS[m].graph, 'utf8'));
  fs.mkdirSync(`${HERE}/out/${m}`, { recursive: true });
  for (let i = 0; i < panels.length; i++) {
    const g = structuredClone(base);
    setParam(g, 'Input_wf_type', 4);
    setParam(g, 'Input_Positive', panels[i].prompt);
    setParam(g, 'Input_Seed', SEED + i);
    setParam(g, 'Input_Width', SIZE[0]);
    setParam(g, 'Input_Height', SIZE[1]);
    setParam(g, 'Input_custom_size', true);
    for (const [k, v] of Object.entries(MODELS[m].extra)) setParam(g, k, v);
    refs.forEach((name, r) => { byTitle(g, r ? `Input_Image_${r + 1}` : 'Input_Image').inputs.image = name; });
    const t0 = Date.now();
    const h = await run(g);
    const img = h.outputs?.[Object.keys(g).find(k => g[k]._meta?.title === 'Output_Image')]?.images?.[0];
    const buf = Buffer.from(await (await fetch(`${URL_}/view?filename=${encodeURIComponent(img.filename)}&subfolder=${encodeURIComponent(img.subfolder)}&type=${img.type}`)).arrayBuffer());
    fs.writeFileSync(`${HERE}/out/${m}/panel_${i + 1}.png`, buf);
    console.log(`${m} panel ${i + 1}: ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  }
}
