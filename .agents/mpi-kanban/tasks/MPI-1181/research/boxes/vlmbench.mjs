// BFL's external-VLM i2i_bbox prompt on a model that SEES the picture (Fabio's edit_024 scene:
// tiger edit_007 + mouse / Velociraptor / lady boxes). Output = BFL's training format: one
// instruction paragraph citing every <id>, then the element table with from/src_bbox/tgt_bbox.
// The user's boxes go in as target rows (new content); the user's tgt_bbox is re-imposed after.
// DEEPINFRA_API_KEY in env. node vlmbench.mjs <outDir> <jpegPath>
import fs from 'node:fs';
const OUT = process.argv[2];
const img = fs.readFileSync(process.argv[3]).toString('base64');
const system = JSON.parse(fs.readFileSync(new URL('../bfl_pup_prompts_external_vlm.json', import.meta.url), 'utf8')).i2i_bbox;
const idea = 'The tiger in the image is approaching the <mouse> And behind the tiger there is a <Velociraptor> Getting ready to attack the tiger. the <lady> Is On her knees with her hands on her head And wearing only bikini bottoms with her breasts exposed';
const boxes = [
    { x: 0.3258, y: 0.6362, w: 0.1579, h: 0.2391, desc: 'A mouse eating a nut', name: 'mouse' },
    { x: 0, y: 0.0033, w: 0.2005, h: 0.5797, desc: 'The head and paws of a Velociraptor coming from off-frame', name: 'Velociraptor' },
    { x: 0.6353, y: 0, w: 0.2415, h: 0.7415, desc: 'Topless lady scared', name: 'lady' },
];
const g = (v) => Math.round(Math.max(0, Math.min(1, v)) * 1000);
const locked = boxes.map((b) => ({ id: b.name, from: 'target', src_bbox: null, tgt_bbox: [g(b.y), g(b.x), g(b.y + b.h), g(b.x + b.w)], desc: b.desc }));
const user = `ORIGINAL PROMPT:\n${idea}\n\nLOCKED BOUNDING-BOX ANNOTATIONS ([y_min, x_min, y_max, x_max] on a 0-1000 canvas, with (0, 0) at `
    + 'the top-left). This is an authoritative JSON list of dictionaries; preserve every supplied identity, '
    + `provenance value, null, and coordinate exactly:\n${JSON.stringify(locked)}`;

async function run(model) {
    const r = await fetch('https://api.deepinfra.com/v1/openai/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.DEEPINFRA_API_KEY}` },
        body: JSON.stringify({
            model, max_tokens: 1500,
            messages: [{ role: 'system', content: system }, { role: 'user', content: [
                { type: 'text', text: user },
                { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${img}` } },
            ] }],
        }),
    });
    const j = await r.json();
    return { text: j.choices?.[0]?.message?.content ?? JSON.stringify(j).slice(0, 400), cost: j.usage?.estimated_cost ?? 0 };
}

const results = [];
let spent = 0;
for (const model of ['google/gemma-3-12b-it', 'google/gemma-4-26B-A4B-it']) {
    for (let i = 1; i <= 3; i++) {
        const { text, cost } = await run(model);
        spent += cost;
        results.push({ model, run: i, text, cited: locked.map((l) => text.includes(`<${l.id}>`)) });
    }
}
fs.writeFileSync(`${OUT}/vlmbench.json`, JSON.stringify({ user, results, spent }, null, 2));
for (const r of results) console.log(`== ${r.model} ${r.run} cited=${r.cited}\n${r.text}\n`);
console.log(`spent ~$${spent.toFixed(5)}`);
