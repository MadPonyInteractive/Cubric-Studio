// Fabio's edit Enhance with a box invented "the tiger described in the first image" (no tiger
// picture exists). Replays the exact edit-mode (i2i) message on the bench's Qwen3-VL 4B enhancer:
// A = today's box header (BFL t2i_bbox "LOCKED ... identity, provenance"), B = a plain layout header.
// node enhbench.mjs <outDir>
import fs from 'node:fs';
const R = 'file:///C:/AI/Mpi/Cubric-Vision/js/';
const { getRecipe, withImageLooks } = await import(R + 'data/recipes/registry.js');
const { composeSystemPrompt } = await import(R + 'data/recipes/styles.js');
const { layoutRows, upsamplingInput } = await import(R + 'data/layoutBoxes.js');
const { buildComfyInjectionParams } = await import(R + 'services/llmService.js');

const URL = 'http://127.0.0.1:8188';
const OUT = process.argv[2];
const idea = 'the <tigger> is sneaking from behind the gorilla and getting ready to attack.';
const rows = layoutRows([{ x: 0.736, y: 0.008, w: 0.264, h: 0.785, desc: 'A Bengal tiger ', name: 'tigger' }]);
// What the describer would say about edit_001 (hand-written; the app's own describer is not run here).
const caption = { text: 'A photograph of a large silverback gorilla in a dense green jungle, crouching on a rocky dirt clearing littered with grey stones and dry leaves, both arms raised with hands on its head, mouth open showing its teeth. Tall thin tree trunks and leafy undergrowth fill the background in soft daylight.' };
const plain = (prompt, r) => `ORIGINAL PROMPT:\n${prompt.trim()}\n\nLAYOUT BOXES ([y_min, x_min, y_max, x_max] on a 0-1000 canvas, (0, 0) at the top-left): `
    + `where each element the request names should be in the edited image. A desc is what the user wants there, not something in the attached images:\n${JSON.stringify(r)}`;
const where = (b) => {
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    const h = cx < 1 / 3 ? 'on the left' : cx > 2 / 3 ? 'on the right' : 'in the centre';
    const v = cy < 1 / 3 ? 'near the top' : cy > 2 / 3 ? 'near the bottom' : 'at middle height';
    return `${h} of the frame, ${v}`;
};
const BOX = { x: 0.736, y: 0.008, w: 0.264, h: 0.785 };
const regions = (prompt, r) => `${prompt.trim()}\n\nMARKED REGIONS (what the user wants in each region of the edited image; the tag in angle brackets is its name):\n`
    + r.map((row) => `<${row.id}>: ${row.desc}, ${where(BOX)}.`).join('\n');
const regionsNew = (prompt, r) => `${prompt.trim()}\n\nMARKED REGIONS (a place in the edited image and what the user wants there; the attached images do not show it):\n`
    + r.map((row) => `<${row.id}>: ${row.desc}, ${where(BOX)}.`).join('\n');
const placement = (prompt, r) => `${prompt.trim()}\n\nPLACEMENT (where each thing goes in the edited image; the attached images do not show it):\n`
    + r.map((row) => `<${row.id}>: ${row.desc}, ${where(BOX)}.`).join('\n');
const ONLY = process.argv.slice(3);
const WORDINGS = Object.fromEntries(Object.entries({ A: upsamplingInput(idea, rows), B: plain(idea, rows), C: regions(idea, rows), D: regionsNew(idea, rows), E: placement(idea, rows) }).filter(([k]) => !ONLY.length || ONLY.includes(k)));

const system = composeSystemPrompt(getRecipe('flux-3').modes.i2i);
const base = JSON.parse(fs.readFileSync('C:/AI/Mpi/Cubric-Vision/comfy_workflows/qwen3vl_4b_prompt_enhancer.json', 'utf8'));

async function run(user, seed) {
    const g = structuredClone(base);
    const byTitle = (t) => Object.values(g).find((n) => n._meta.title === t);
    const set = { ...buildComfyInjectionParams(system), Input_Positive: user, Input_Seed: seed };
    for (const [k, v] of Object.entries(set)) {
        const [title, input] = k.includes('.') ? [k.slice(0, k.lastIndexOf('.')), k.slice(k.lastIndexOf('.') + 1)] : [k, null];
        const n = byTitle(title);
        if (!n) throw new Error(`no node ${title}`);
        const key = input ?? Object.keys(n.inputs).find((i) => !Array.isArray(n.inputs[i]));
        n.inputs[key] = v;
    }
    const { prompt_id: id } = await (await fetch(URL + '/prompt', { method: 'POST', body: JSON.stringify({ prompt: g }) })).json();
    const out = Object.entries(g).find(([, n]) => n._meta.title === 'Output_prompt')[0];
    for (;;) {
        await new Promise((r) => setTimeout(r, 2000));
        const h = (await (await fetch(`${URL}/history/${id}`)).json())[id];
        if (h?.status?.completed || h?.status?.status_str === 'error') return h.outputs?.[out]?.text?.join('') ?? `ERROR ${JSON.stringify(h.status).slice(0, 300)}`;
    }
}

const lines = [];
for (const [w, user] of Object.entries(WORDINGS)) {
    for (const seed of [1, 2, 3]) {
        const text = await run(withImageLooks(user, [caption]), seed);
        lines.push(`== ${w} seed ${seed}\n${text}\n`);
        console.log(`== ${w} seed ${seed}\n${text}\n`);
    }
}
fs.appendFileSync(`${OUT}/enhbench.txt`, lines.join('\n'));
