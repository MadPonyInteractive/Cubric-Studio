// MPI-1231 Phase 0 bench, on the G: bench (:8188), never the app engine.
//   node bench.mjs plan [id]   -> the DRAFT planner (STORYBOARD_PLAN_ENHANCE_PARAMS, read from
//                                 flowsRegistry.js) on the default enhancer graph; out/<id>/plan.json
//   node bench.mjs draw <id>   -> every parsed panel as a FLUX.3 Klein job (edit with the refs,
//                                 t2i without), turbo, 1K, the board's shape; out/<id>/panel_N.png
// Mirrors the app: the enhancer's source text is the Flow's labelled lines ("Your idea: ...",
// "Panels: 6", "Video shape: 16:9") and its baked Replace Text flattens the answer to one line.
import fs from 'node:fs';
import path from 'node:path';
import { parseStoryboardPlan } from 'file:///C:/AI/Mpi/Cubric-Vision/js/services/storyboardRunner.js';

const ROOT = 'C:/AI/Mpi/Cubric-Vision/';
const HERE = path.dirname(new URL(import.meta.url).pathname).replace(/^\/(\w:)/, '$1');
const URL_ = 'http://127.0.0.1:8188';
const V2 = process.env.PLAN === 'v2';
const OUT = V2 ? 'out_v2' : 'out_final'; // out/ = v1, the old DRAFT; out_final/ = the shipped prompt
const TIKORI = 'C:/Users/Fabio/Documents/Cubric Studio/Projects/Tikori Characters/Media/';

const BOARDS = {
  tikori: {
    idea: 'Picture 1 is Bix, a grumpy hairless cat. Picture 2 is Lilo, a purple fox. Picture 3 is Snow, a white tiger. Bix and Lilo sneak through the forest to steal the golden apple Snow is sleeping beside. Snow wakes up and chases them, they trip into a stream, and in the end the three of them share the apple on a log.',
    refs: [TIKORI + 't2i_d919b5be.png', TIKORI + 'edit_d84a4325.jpg', TIKORI + 't2i_8ef43aa4.png'],
    ratio: '16:9', size: [1344, 768], panels: 6, seed: 1231001,
  },
  diner: {
    idea: 'A waitress in a late-night diner meets a stranger who knows her name.',
    refs: [], ratio: '16:9', size: [1344, 768], panels: 6, seed: 1231002,
  },
  kite: {
    idea: 'A boy flies a red kite on a windy cliff above the sea. The string snaps and the kite drifts away over the water. His grandfather finds it caught on the rocks of the beach below and brings it back to him.',
    refs: [], ratio: '9:16', size: [768, 1344], panels: 6, seed: 1231003,
  },
};

const src = fs.readFileSync(ROOT + 'js/data/flowsRegistry.js', 'utf8');
const block = src.slice(src.indexOf('const STORYBOARD_PLAN_ENHANCE_PARAMS = {'));
const PLAN_PARAMS = Function(`${block.slice(0, block.indexOf('\n};') + 3)}; return STORYBOARD_PLAN_ENHANCE_PARAMS;`)();

// v2: the cast is written ONCE in a [CAST] block and the code, not the 4B, repeats it: v1 wrote
// "the same waitress" from panel 2 on, and invented the looks of the pictured characters.
const V2_SYSTEM = [
  '<|im_start|>system',
  'You are a storyboard artist planning the still panels of a short video. The user message gives the idea, how many panels to write and the shape of the video. Write the cast once, then exactly that many panels, in story order.',
  '',
  'First write [CAST] and one line per character or recurring place, in this form: Name: description. Give each a short name (use the user\'s names). When the user says a picture shows it ("Picture 1 is Bix, a cat"), the description is only "the cat from image 1", using the ordinal of that picture and what the user said it is, nothing more: you cannot see the picture. Otherwise describe it fully: species or ethnicity, gender, age range, skin or fur, hair, and clothes with their colours.',
  '',
  'Then write every panel in this form: [PANEL n] Picture: the picture prompt. Intent: one sentence.',
  '',
  'The Picture is one frozen instant, as a camera sees it, in 50 to 100 words of prose:',
  '- Open on the medium and style. When the user names none, open on "Full-color cinematic film still, ".',
  '- Then the shot size and angle (wide establishing shot, medium shot, close-up, over-the-shoulder shot), the place, the light and the time of day.',
  '- Name each cast member in the shot by their cast name, and say where they are in the frame (frame-left, frame-right, foreground, background) and what they are doing at that instant.',
  '- Only what can be seen in a single still picture: camera moves, cuts, sounds, speech and feelings go in the Intent.',
  '',
  'The Intent is one sentence for the person who will animate the panel: what happens in this shot and why it matters, with the camera move when there is one.',
  '',
  'Vary the shots so the panels read as an edited sequence: open wide on the place, move closer for action and feeling, and close on a shot that ends the moment. Keep every name, place, object and word the user gave. Write in English. Start with [CAST] and stop after the last panel.',
  '<|im_end|>',
  '<|im_start|>user',
].join('\n');

// The cast lines of everyone a panel names, appended to its prompt.
// The 4B invents the looks of a pictured character whatever it is told, so the user's own
// "Picture N is NAME, a WHAT" sentence replaces that cast line: "the WHAT from image N".
function withCast(text, panels, idea = '') {
  const m = String(text).match(/\[\s*CAST\s*\]([\s\S]*?)(?=\[\s*PANEL)/i);
  if (!m) return panels;
  const cast = [...m[1].matchAll(/([A-Z][\w' -]{0,30}?)\s*:\s*([^:]*?)(?=\s+[A-Z][\w' -]{0,30}?\s*:|$)/g)]
    .map(([, name, desc]) => ({ name: name.trim(), desc: desc.trim().replace(/[.;,]+$/, '') }));
  const ord = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'];
  for (const [, n, name, what] of String(idea).matchAll(/picture\s+(\d+)\s+is\s+([^,.]+?)(?:,\s*(?:an?\s+)?([^.]+))?\./gi)) {
    const desc = `the ${(what || name).trim()} from the ${ord[n - 1]} image`;
    const c = cast.find(x => x.name.toLowerCase() === name.trim().toLowerCase());
    if (c) c.desc = desc; else cast.push({ name: name.trim(), desc });
  }
  return panels.map(p => {
    const named = cast.filter(c => new RegExp(`\\b${c.name}\\b`, 'i').test(p.prompt));
    return named.length ? { ...p, prompt: `${p.prompt} ${named.map(c => `${c.name} is ${c.desc}.`).join(' ')}` } : p;
  });
}

const byTitle = (g, t) => Object.values(g).find(n => n._meta?.title === t);
const setParam = (g, key, value) => {
  const [title, field] = key.includes('.') ? [key.slice(0, key.indexOf('.')), key.slice(key.indexOf('.') + 1)] : [key, null];
  const n = byTitle(g, title);
  if (!n) throw new Error(`no node ${title}`);
  const f = field || ['value', 'string', 'int', 'float', 'boolean'].find(k => k in n.inputs);
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

async function plan(id) {
  const b = BOARDS[id];
  const g = JSON.parse(fs.readFileSync(ROOT + 'comfy_workflows/qwen3vl_4b_prompt_enhancer.json', 'utf8'));
  for (const [k, v] of Object.entries(PLAN_PARAMS)) setParam(g, k, v);
  if (V2) setParam(g, 'Input_System_Prompt', V2_SYSTEM);
  setParam(g, 'Input_Positive', `Your idea: ${b.idea}\nPanels: ${b.panels}\nVideo shape: ${b.ratio}`);
  setParam(g, 'Input_Seed', b.seed);
  const t0 = Date.now();
  const h = await run(g);
  const out = h.outputs?.[Object.keys(g).find(k => g[k]._meta?.title === 'Output_prompt')];
  const text = [].concat(out?.text ?? out?.string ?? '').join('').trim();
  const panels = V2 ? withCast(text, parseStoryboardPlan(text), b.idea) : parseStoryboardPlan(text, b.idea);
  fs.mkdirSync(`${HERE}/${OUT}/${id}`, { recursive: true });
  fs.writeFileSync(`${HERE}/${OUT}/${id}/plan.json`, JSON.stringify({ id, ...b, ms: Date.now() - t0, text, panels }, null, 2));
  console.log(`${id}: ${panels.length} panels in ${((Date.now() - t0) / 1000).toFixed(0)} s; words per picture: ${panels.map(p => p.prompt.split(/\s+/).length).join(', ')}`);
}

async function draw(id, only) {
  const p = JSON.parse(fs.readFileSync(`${HERE}/${OUT}/${id}/plan.json`, 'utf8'));
  const refs = [];
  for (const f of p.refs) refs.push(await upload(f));
  const base = JSON.parse(fs.readFileSync(ROOT + 'comfy_workflows/flux3_t2i.json', 'utf8'));
  for (let i = 0; i < p.panels.length; i++) {
    if (only && !only.includes(i + 1)) continue;
    const g = structuredClone(base);
    setParam(g, 'Input_wf_type', refs.length ? 4 : 1);
    setParam(g, 'Input_Positive', p.panels[i].prompt);
    setParam(g, 'Input_Seed', p.seed + i);
    setParam(g, 'Input_Width', p.size[0]);
    setParam(g, 'Input_Height', p.size[1]);
    setParam(g, 'Input_custom_size', refs.length > 0);
    setParam(g, 'Input_is_Turbo', true);
    refs.forEach((name, r) => { byTitle(g, r ? `Input_Image_${r + 1}` : 'Input_Image').inputs.image = name; });
    const t0 = Date.now();
    const h = await run(g);
    const img = h.outputs?.[Object.keys(g).find(k => g[k]._meta?.title === 'Output_Image')]?.images?.[0];
    const buf = Buffer.from(await (await fetch(`${URL_}/view?filename=${encodeURIComponent(img.filename)}&subfolder=${encodeURIComponent(img.subfolder)}&type=${img.type}`)).arrayBuffer());
    fs.writeFileSync(`${HERE}/${OUT}/${id}/panel_${i + 1}.png`, buf);
    console.log(`${id} panel ${i + 1}: ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  }
}

const [mode, id, ...rest] = process.argv.slice(2);
if (mode === 'plan') for (const k of id ? [id] : Object.keys(BOARDS)) await plan(k);
else if (mode === 'draw') await draw(id, rest.length ? rest.map(Number) : null);
else if (mode === 'dry') console.log(Object.keys(PLAN_PARAMS), parseStoryboardPlan('[PANEL 1] Picture: a. Intent: b. [PANEL 2] Picture: c Intent: d'));
else if (mode === 'recast') { // re-derive v2 panels from a saved plan's text, no GPU
  const f = `${HERE}/${OUT}/${id}/plan.json`; const p = JSON.parse(fs.readFileSync(f, 'utf8'));
  p.panels = withCast(p.text, parseStoryboardPlan(p.text), p.idea); fs.writeFileSync(f, JSON.stringify(p, null, 2));
  console.log(p.panels[0].prompt);
}
