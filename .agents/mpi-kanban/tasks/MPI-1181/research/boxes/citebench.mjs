// Fabio's edit Enhance (edit_017/018): the enhanced text drops `<tigger>`, so the box table row is
// cited by nothing and the tiger lands off-box. The i2i system prompt forbids angle-bracket tokens.
// E = shipped (editPlacementInput as-is); F = E + a system exception: keep each placement tag.
// Runs on Fabio's own enhancer, DeepInfra google/gemma-3-12b-it, with edit_001's kept `look`.
// DEEPINFRA_API_KEY in env. node citebench.mjs <outDir>
import fs from 'node:fs';
const R = 'file:///C:/AI/Mpi/Cubric-Vision/js/';
const { getRecipe, withImageLooks } = await import(R + 'data/recipes/registry.js');
const { composeSystemPrompt } = await import(R + 'data/recipes/styles.js');
const { editPlacementInput } = await import(R + 'data/layoutBoxes.js');

const OUT = process.argv[2];
const META = 'C:/Users/Fabio/Documents/Cubric Studio/Projects/Flux 3 tests/Media/.meta/b388be01-ca6f-4a20-bbc3-9b147da28bad.json';
const look = JSON.parse(fs.readFileSync(META, 'utf8')).look.text;
const idea = 'the <tigger> is sneaking from behind the gorilla and getting ready to attack The gorilla.';
const boxes = [{ x: 0.7364, y: 0.0082, w: 0.2636, h: 0.7850, desc: 'A Bengal tiger ', name: 'tigger' }];
const user = withImageLooks(editPlacementInput(idea, boxes), [{ tag: 'Image 1', text: look }]);
const base = composeSystemPrompt(getRecipe('flux-3').modes.i2i);
const EXCEPTION = 'Exception for PLACEMENT tags: when the request lists PLACEMENT lines, write each of their tags (for example <tigger>) exactly once, right after the first mention of that thing, so the editing model can place it. No other tags, no coordinates.';
const SYSTEMS = { E: base, F: `${base}\n\n${EXCEPTION}` };

async function run(system) {
    const r = await fetch('https://api.deepinfra.com/v1/openai/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.DEEPINFRA_API_KEY}` },
        body: JSON.stringify({ model: 'google/gemma-3-12b-it', messages: [{ role: 'system', content: system }, { role: 'user', content: user }], max_tokens: 400 }),
    });
    const j = await r.json();
    return { text: j.choices?.[0]?.message?.content ?? JSON.stringify(j).slice(0, 300), cost: j.usage?.estimated_cost };
}

const lines = [`USER MESSAGE:\n${user}\n`];
let spent = 0;
for (const [k, system] of Object.entries(SYSTEMS)) {
    for (let i = 1; i <= 3; i++) {
        const { text, cost } = await run(system);
        spent += cost || 0;
        lines.push(`== ${k} run ${i} cited=${text.includes('<tigger>')}\n${text}\n`);
    }
}
lines.push(`spent ~$${spent.toFixed(5)}`);
fs.writeFileSync(`${OUT}/citebench.txt`, lines.join('\n'));
console.log(lines.join('\n'));
