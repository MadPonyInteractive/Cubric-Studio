// Live probe: FLUX.3 t2v_bbox Enhance on local Ollama, exactly the text enhance() builds.
import fs from 'node:fs';
const R = 'file:///C:/AI/Mpi/Cubric-Vision/js/';
const { getRecipe } = await import(R + 'data/recipes/registry.js');
const { composeSystemPrompt } = await import(R + 'data/recipes/styles.js');
const { layoutRows, upsamplingInput, reconcileBoxes, endsWithBoxTable } = await import(R + 'data/layoutBoxes.js');

const S = 'C:/Users/Fabio/AppData/Local/Temp/claude/C--AI-Mpi-Cubric-Vision/3becf6ce-33fa-47b5-af7c-5362e33e5076/scratchpad/';
const boxes = [
    { x: 0.04, y: 0.5, w: 0.3, h: 0.45, desc: 'red fox sitting' },
    { x: 0.55, y: 0.15, w: 0.4, h: 0.6, desc: 'blue bicycle' },
];
const idea = 'a fox <obj_1> and a bike <obj_2> in a meadow';
const rows = layoutRows(boxes);
const system = composeSystemPrompt(getRecipe('flux-3').modes.t2v_bbox);
const user = upsamplingInput(idea, rows);
const model = process.argv[2] || 'huihui_ai/gemma-4-abliterated:12b';
const res = await fetch('http://127.0.0.1:11434/api/chat', {
    method: 'POST',
    body: JSON.stringify({ model, stream: false, think: false, keep_alive: 0, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
});
const body = await res.json(); if (!body.message?.content) console.log('BODY', JSON.stringify(body).slice(0, 1500)); const raw = body.message?.content ?? '';
const out = reconcileBoxes(raw, rows);
console.log('RAW:\n' + raw + '\n\nRECONCILED:\n' + out + '\n\nendsWithBoxTable:', endsWithBoxTable(out));
fs.writeFileSync(S + 'enhanced_box_prompt.txt', out);
