// MPI-1231 style/setting-leak re-bench (2026-10-25, Fabio's yes: up to $0.002 of DeepInfra).
// Fabio's volcano board, re-planned with the CURRENT picture ask + planner prompt from
// js/data/flowsRegistry.js, on the models his press used: describe google/gemma-4-26B-A4B-it,
// plan deepseek-ai/DeepSeek-V4-Flash-0731 (effort low). Key from DEEPINFRA_API_KEY only.
//   node rebench.mjs   ->  out.json + the parsed panel prompts on stdout
import fs from 'node:fs';
import path from 'node:path';
import { parseStoryboardPlan } from 'file:///C:/AI/Mpi/Cubric-Vision/js/services/storyboardRunner.js';

const HERE = path.dirname(new URL(import.meta.url).pathname).replace(/^\/(\w:)/, '$1');
const API = 'https://api.deepinfra.com/v1/openai/chat/completions';
const KEY = process.env.DEEPINFRA_API_KEY;
if (!KEY) throw new Error('no DEEPINFRA_API_KEY');
const TIKORI = 'C:/Users/Fabio/Documents/Cubric Studio/Projects/Tikori Characters/Media/';
const PICTURES = [TIKORI + 't2i_d919b5be.png', TIKORI + 't2i_8ef43aa4.png']; // 1 the cat, 2 the white tiger
const IDEA = "Create a story with the cat and the tiger. They are enemies. The tiger is good, the cat is bad. Make them fight next to a volcano at night. Intense fight, it's raining, and the tiger wins. Do a nice introduction for one and the other as they arrive at the meeting place by the volcano.";

const reg = fs.readFileSync('C:/AI/Mpi/Cubric-Vision/js/data/flowsRegistry.js', 'utf8');
const ASK = Function(`return ${reg.match(/const STORYBOARD_PICTURE_ASK = ('.*?');\n/s)[1]}`)();
const chatMl = Function(`return ${reg.match(/STORYBOARD_PLAN_ENHANCE_PARAMS = \{\s*Input_System_Prompt: (\[[\s\S]*?\])\.join\('\\n'\)/)[1]}`)().join('\n');
const SYSTEM = chatMl.match(/<\|im_start\|>system\n([\s\S]*?)<\|im_end\|>/)[1].trim();

async function call(body) {
    const r = await fetch(API, { method: 'POST', headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json();
    if (!r.ok) throw new Error(JSON.stringify(j).slice(0, 500));
    return { text: j.choices[0].message.content.trim(), cost: j.usage?.estimated_cost || 0, usage: j.usage };
}

const looks = [];
let spent = 0;
for (const file of PICTURES) {
    const b64 = fs.readFileSync(file).toString('base64');
    const res = await call({
        model: 'google/gemma-4-26B-A4B-it', max_tokens: 120,
        messages: [{ role: 'user', content: [
            { type: 'image_url', image_url: { url: `data:image/png;base64,${b64}` } },
            { type: 'text', text: ASK },
        ] }],
    });
    looks.push(res.text.replace(/[.\s]+$/, ''));
    spent += res.cost;
    console.log(`describe ${path.basename(file)}: ${res.text}  ($${res.cost})`);
}

const source = `Your idea: ${IDEA}\nYour pictures: ${looks.map((l, i) => `Picture ${i + 1} shows ${l}.`).join(' ')}\nPanels: 6\nVideo shape: 16:9`;
const plan = await call({
    model: 'deepseek-ai/DeepSeek-V4-Flash-0731', max_tokens: 8000, reasoning_effort: 'low',
    messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: source }],
});
spent += plan.cost;
// The app flattens the answer to one line (the graph's Replace Text): newlines go without a space.
const flat = plan.text.replace(/\r?\n/g, '');
const panels = parseStoryboardPlan(flat, IDEA);
fs.writeFileSync(`${HERE}/out.json`, JSON.stringify({ ask: ASK, looks, source, plan: plan.text, usage: plan.usage, spent, panels }, null, 2));
console.log('\nPLAN (raw):\n' + plan.text + '\n');
panels.forEach((p, i) => console.log(`[${i + 1}] ${p.prompt}\n    Intent: ${p.intent}\n`));
console.log(`spent: $${spent.toFixed(6)}`);
