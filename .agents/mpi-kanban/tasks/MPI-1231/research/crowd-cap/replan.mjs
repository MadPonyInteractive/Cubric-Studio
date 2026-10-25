// MPI-1231 fixes 3+4 re-plan (2026-10-25, Fabio's yes: ONE DeepInfra planner call, ~$0.0005).
// Fabio's bat-cave board (no pictures, "anime style", 6 panels, 16:9), idea copied from his panel
// sidecar's flowInputs, re-planned with the CURRENT planner prompt from js/data/flowsRegistry.js on
// Cosmo's model (DeepSeek V4 Flash 0731, effort low). Checks: no crowd in [CAST], objects in
// [OBJECTS], and which pictures recurringActors would draw first (cap MAX_DRAWN_FIRST).
//   node replan.mjs  ->  out.json + the plan, the drawn-first list and the panel prompts on stdout
import fs from 'node:fs';
import path from 'node:path';
import { parseStoryboardPlan, recurringActors, panelStyle, MAX_DRAWN_FIRST } from 'file:///C:/AI/Mpi/Cubric-Vision/js/services/storyboardRunner.js';

const HERE = path.dirname(new URL(import.meta.url).pathname).replace(/^\/(\w:)/, '$1');
const API = 'https://api.deepinfra.com/v1/openai/chat/completions';
const KEY = process.env.DEEPINFRA_API_KEY;
if (!KEY) throw new Error('no DEEPINFRA_API_KEY');
const META = 'C:/Users/Fabio/Documents/Cubric Studio/Projects/Tikori Characters/Media/.meta/0fa8f162-8124-4754-a539-e24651bea462.json';
const IDEA = JSON.parse(fs.readFileSync(META, 'utf8')).flowInputs.positive.trim();

const reg = fs.readFileSync('C:/AI/Mpi/Cubric-Vision/js/data/flowsRegistry.js', 'utf8');
const chatMl = Function(`return ${reg.match(/STORYBOARD_PLAN_ENHANCE_PARAMS = \{\s*Input_System_Prompt: (\[[\s\S]*?\])\.join\('\\n'\)/)[1]}`)().join('\n');
const SYSTEM = chatMl.match(/<\|im_start\|>system\n([\s\S]*?)<\|im_end\|>/)[1].trim();

const source = `Your idea: ${IDEA}\nPanels: 6\nVideo shape: 16:9`;
const r = await fetch(API, { method: 'POST', headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'deepseek-ai/DeepSeek-V4-Flash-0731', max_tokens: 8000, reasoning_effort: 'low',
        messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: source }] }) });
const j = await r.json();
if (!r.ok) throw new Error(JSON.stringify(j).slice(0, 500));
const text = j.choices[0].message.content.trim();
const spent = j.usage?.estimated_cost || 0;
// The app flattens the answer to one line (the graph's Replace Text): newlines go without a space.
const flat = text.replace(/\r?\n/g, '');
const wanted = recurringActors(flat, IDEA);
const drawn = wanted.slice(0, MAX_DRAWN_FIRST);
const panels = parseStoryboardPlan(flat, IDEA, Object.fromEntries(drawn.map((a, i) => [a.name.toLowerCase(), i + 1])));
fs.writeFileSync(`${HERE}/out.json`, JSON.stringify({ source, plan: text, usage: j.usage, spent, wanted, drawn, style: panelStyle(panels), panels }, null, 2));
console.log('PLAN (raw):\n' + text + '\n');
console.log('recurring:', wanted.map(a => `${a.name} (${a.kind})`).join(', '));
console.log('drawn first:', drawn.map(a => a.name).join(', '), '| style:', panelStyle(panels), '\n');
panels.forEach((p, i) => console.log(`[${i + 1}] ${p.prompt}\n    Intent: ${p.intent}\n`));
console.log(`spent: $${spent.toFixed(6)}`);
