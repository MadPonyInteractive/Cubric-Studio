// MPI-1253: the shipped Gemma question (box_2d), temperature 0 as the app sends it, on the
// Vogue cover, scored by best IoU against Fabio's 9 boxes. usage: node gemma.mjs <label>
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const sharp = require('C:/AI/Mpi/Cubric-Vision/node_modules/sharp');
const { analyseQuestion, boxesFromAnalysis } = await import('file:///C:/AI/Mpi/Cubric-Vision/js/data/layoutBoxes.js');

const DIR = 'C:/Users/Fabio/AppData/Local/Temp/claude/C--AI-Mpi-Cubric-Vision/d97e027a-503d-4722-be51-dca53a2c0014/scratchpad/qbench/';
const label = process.argv[2];
const TRUTH = {
    central_subject: [0.276, 0.177, 0.562, 0.726], main_title: [0.045, 0.041, 0.910, 0.146],
    fashion_headline: [0.048, 0.210, 0.264, 0.189], beauty_headline: [0.039, 0.472, 0.231, 0.278],
    lifestyle_headline: [0.743, 0.674, 0.239, 0.296], self_love_script: [0.351, 0.724, 0.177, 0.133],
    travel_box: [0.823, 0.380, 0.136, 0.247], beauty_portrait: [0.160, 0.629, 0.162, 0.235],
    footer_info: [0.045, 0.904, 0.910, 0.061],
};
// as routes/llm.js sends it: <= 1 MP, JPEG 85 (the cover is 0.81 MP, kept)
const img = await sharp(DIR + 'in/cover.jpg').jpeg({ quality: 85 }).toBuffer();
const t0 = Date.now();
const res = await fetch('https://api.deepinfra.com/v1/openai/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.DEEPINFRA_API_KEY}` },
    body: JSON.stringify({ model: 'google/gemma-4-26B-A4B-it', temperature: 0, messages: [{ role: 'user', content: [
        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${img.toString('base64')}` } },
        { type: 'text', text: analyseQuestion('gemma') }] }] }),
});
const body = await res.json();
const text = body.choices?.[0]?.message?.content || JSON.stringify(body).slice(0, 400);
fs.writeFileSync(DIR + label + '.txt', text);
const iou = ([ax, ay, aw, ah], [bx, by, bw, bh]) => {
    const i = Math.max(0, Math.min(ax + aw, bx + bw) - Math.max(ax, bx)) * Math.max(0, Math.min(ay + ah, by + bh) - Math.max(ay, by));
    return i ? i / (aw * ah + bw * bh - i) : 0;
};
const boxes = boxesFromAnalysis(text)?.boxes || [];
const best = Object.entries(TRUTH).map(([k, t]) => [k, Math.max(0, ...boxes.map((b) => iou(t, [b.x, b.y, b.w, b.h])))]);
const mean = best.reduce((s, [, v]) => s + v, 0) / best.length;
console.log(`${label}: ${((Date.now() - t0) / 1000).toFixed(1)}s, cost $${body.usage?.estimated_cost}, ${boxes.length} boxes, `
    + `${boxes.filter((b) => b.kind === 'text').length} text, mean best-IoU ${mean.toFixed(2)}, hits ${best.filter(([, v]) => v >= 0.5).length}/9`);
for (const [k, v] of best) console.log(`   ${k.padEnd(20)} ${v.toFixed(2)}`);
for (const b of boxes) console.log(`   got ${b.name} [${[b.x, b.y, b.w, b.h].map((v) => v.toFixed(3))}] ${b.desc.slice(0, 60)}`);
