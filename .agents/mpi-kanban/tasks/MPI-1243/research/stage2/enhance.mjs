// Rebuild the app's captured ComfyUI enhance job (llmService.enhance -> runComfyEnhance),
// prove it byte-equal by canonical sha256, then run it on the shared engine and print the text.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { getRecipe } from 'file:///C:/AI/Mpi/Cubric-Vision/js/data/recipes/registry.js';
import { composeSystemPrompt } from 'file:///C:/AI/Mpi/Cubric-Vision/js/data/recipes/styles.js';

const SP = 'C:/Users/Fabio/AppData/Local/Temp/claude/C--AI-Mpi-Cubric-Vision/1394a049-1a69-4801-af72-4444bf14162b/scratchpad/';
const JOBS = [
  ["a vintage travel poster for Lisbon that says 'VISIT LISBOA'", 7675465, '4b6e73dae2e463e284ddeda421a3bf1dfabf6cf44138aa3c2523266ac7fdd2c6'],
  ['a fox reading a book under a tree at dusk', 2106698226, '1e947c31a5773cc468c863a486105e44ba69d1482ba10ab5f5442be50882829a'],
  ['an old fisherman mending nets on a pier at sunrise', 1044014536, '3c74e3048dd086fb7bb8c7ad50d4bc789c8ee11b995d14e90904caefc5b21962'],
];
const canon = (v) => Array.isArray(v) ? '[' + v.map(canon).join(',') + ']'
  : (v && typeof v === 'object') ? '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}'
  : JSON.stringify(v);
const system = composeSystemPrompt(getRecipe('moss-image').modes.t2v);
const base = JSON.parse(fs.readFileSync('C:/AI/Mpi/Cubric-Vision/comfy_workflows/qwen3vl_4b_prompt_enhancer.json', 'utf8'));
const byTitle = (g, t) => Object.values(g).find((n) => n._meta?.title === t);

const results = [];
for (const [idea, seed, want] of JOBS) {
  const g = structuredClone(base);
  byTitle(g, 'Input_System_Prompt').inputs.value = `<|im_start|>system\n${system}<|im_end|>\n<|im_start|>user`;
  byTitle(g, 'Replace Text').inputs.replace = '\n';
  byTitle(g, 'Input_Scrub_Negation').inputs.regex_pattern = '(?!)';
  byTitle(g, 'Input_Tidy').inputs.regex_pattern = '\\s+$';
  byTitle(g, 'Input_Text_Gen').inputs.max_length = 2048;
  byTitle(g, 'Input_Positive').inputs.string = idea;
  byTitle(g, 'Input_Seed').inputs.int = seed;
  const sha = crypto.createHash('sha256').update(canon(g)).digest('hex');
  if (sha !== want) { console.log('MISMATCH', idea, sha); process.exit(1); }
  if (process.argv[2] !== 'run') { console.log('match', idea); continue; }
  const t0 = Date.now();
  const r = await (await fetch('http://127.0.0.1:48188/prompt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: g }) })).json();
  if (!r.prompt_id) { console.log('SUBMIT FAILED', JSON.stringify(r)); process.exit(1); }
  let h;
  for (;;) {
    await new Promise((s) => setTimeout(s, 1000));
    h = (await (await fetch(`http://127.0.0.1:48188/history/${r.prompt_id}`)).json())[r.prompt_id];
    if (h?.status?.completed || h?.status?.status_str === 'error') break;
  }
  const out = h.outputs?.[Object.keys(g).find((k) => g[k]._meta?.title === 'Output_prompt')];
  const text = [].concat(out?.text ?? out?.string ?? '').join('').trim();
  results.push({ idea, seed, ms: Date.now() - t0, words: text.split(/\s+/).length, text, status: h.status?.status_str });
  console.log(JSON.stringify(results.at(-1)));
}
if (results.length) fs.writeFileSync(SP + 'enhanced.json', JSON.stringify(results, null, 2));
