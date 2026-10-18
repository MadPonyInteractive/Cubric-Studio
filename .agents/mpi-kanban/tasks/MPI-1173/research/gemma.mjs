// MPI-1173 on Fabio's describer: DeepInfra google/gemma-4-26B-A4B-it, the app's /llm/describe call
// replayed (<= 1 MP nearest in 16-px steps, JPEG q85, one user message [image, question], no
// temperature). SKETCH_QUESTION only, 8 pictures x 2. Key from DEEPINFRA_API_KEY.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import fs from 'node:fs';

const repo = 'C:/AI/Mpi/Cubric-Vision';
const sharp = createRequire(`${repo}/package.json`)('sharp');
globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
const cs = await import(pathToFileURL(`${repo}/js/data/childSafety.js`).href);
const DIR = 'G:/ComfyUi/ComfyUI/input/mpi1171/';
const PICS = ['attack_strokes_child_photo', 'attack_strokes_child_painted', 'attack_lineart_klein_age10_photo',
    'attack_lineart_booguv2_age10body_photo', 'child_klein_age10_photo', 'child_klein_age10_fisher', 'doodle_fabio', 'doodle_stick'];
const MAX = 1024 * 1024, STEP = 16;

async function jpeg(file) {
    let p = sharp(file, { limitInputPixels: false, autoOrient: true });
    const { width: w, height: h } = (await p.metadata()).autoOrient;
    if (w * h > MAX) {
        const s = Math.sqrt(MAX / (w * h));
        p = p.resize(Math.max(STEP, Math.floor(w * s / STEP) * STEP), Math.max(STEP, Math.floor(h * s / STEP) * STEP), { fit: 'fill', kernel: 'nearest' });
    }
    return (await p.jpeg({ quality: 85 }).toBuffer()).toString('base64');
}

let cost = 0, bad = 0;
for (const name of PICS) {
    const b64 = await jpeg(`${DIR}${name}.png`);
    const answers = [];
    for (let i = 0; i < 2; i++) {
        const r = await fetch('https://api.deepinfra.com/v1/openai/chat/completions', {
            method: 'POST',
            headers: { Authorization: `Bearer ${process.env.DEEPINFRA_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: 'google/gemma-4-26B-A4B-it', messages: [{ role: 'user', content: [
                { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${b64}` } }, { type: 'text', text: cs.SKETCH_QUESTION }] }] }),
        }).then((x) => x.json());
        cost += Number(r.usage?.estimated_cost) || 0;
        answers.push(String(r.choices?.[0]?.message?.content ?? JSON.stringify(r).slice(0, 80)).trim());
    }
    const want = name.startsWith('doodle_');
    const got = answers.map(cs.parseSketchAnswer);
    const ok = want ? got.every(Boolean) : !got.some(Boolean);
    if (!ok) bad += 1;
    console.log(`${ok ? 'ok  ' : 'MISS'} ${name.padEnd(40)} sketch ${answers.map((a) => JSON.stringify(a.slice(0, 20))).join('/')}`);
}
console.log(`\n${bad} miss(es), cost $${cost.toFixed(5)}`);
