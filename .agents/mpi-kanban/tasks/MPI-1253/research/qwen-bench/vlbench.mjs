// MPI-1253 describer bench on Fabio's Vogue cover: the app's question for the model's family,
// temperature 0, scored by best IoU against Fabio's 9 hand boxes.
// usage: node vlbench.mjs <model> <label>   |   node vlbench.mjs --score <answer.txt>...
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const sharp = require('C:/AI/Mpi/Cubric-Vision/node_modules/sharp');
const { analyseQuestion, boxesFromAnalysis } = await import('file:///C:/AI/Mpi/Cubric-Vision/js/data/layoutBoxes.js');

const OUT = 'C:/Users/Fabio/AppData/Local/Temp/claude/C--AI-Mpi-Cubric-Vision/7093be63-2f1f-46b5-918a-5435bfab78a8/scratchpad/';
const TRUTH = {
    central_subject: [0.276, 0.177, 0.562, 0.726], main_title: [0.045, 0.041, 0.910, 0.146],
    fashion_headline: [0.048, 0.210, 0.264, 0.189], beauty_headline: [0.039, 0.472, 0.231, 0.278],
    lifestyle_headline: [0.743, 0.674, 0.239, 0.296], self_love_script: [0.351, 0.724, 0.177, 0.133],
    travel_box: [0.823, 0.380, 0.136, 0.247], beauty_portrait: [0.160, 0.629, 0.162, 0.235],
    footer_info: [0.045, 0.904, 0.910, 0.061],
};
const iou = ([ax, ay, aw, ah], [bx, by, bw, bh]) => {
    const i = Math.max(0, Math.min(ax + aw, bx + bw) - Math.max(ax, bx)) * Math.max(0, Math.min(ay + ah, by + bh) - Math.max(ay, by));
    return i ? i / (aw * ah + bw * bh - i) : 0;
};
const score = (label, text, extra = '') => {
    const boxes = boxesFromAnalysis(text)?.boxes || [];
    const best = Object.entries(TRUTH).map(([k, t]) => [k, Math.max(0, ...boxes.map((b) => iou(t, [b.x, b.y, b.w, b.h])))]);
    const mean = best.reduce((s, [, v]) => s + v, 0) / best.length;
    console.log(`${label}: ${extra}${boxes.length} boxes, mean best-IoU ${mean.toFixed(2)}, hits>=0.5 ${best.filter(([, v]) => v >= 0.5).length}/9  `
        + best.map(([k, v]) => `${k.split('_')[0]} ${v.toFixed(2)}`).join(', '));
};

if (process.argv[2] === '--score') {
    for (const f of process.argv.slice(3)) score(f.split(/[\\/]/).pop(), fs.readFileSync(f, 'utf8'));
} else {
    const [model, label] = process.argv.slice(2);
    const family = /qwen/i.test(model) ? 'qwen' : /gemma/i.test(model) ? 'gemma' : 'named';
    const key = fs.readFileSync('C:/Users/Fabio/.secrets/di.txt', 'utf8').trim();
    const img = await sharp('C:/Users/Fabio/Documents/Cubric Studio/Projects/FLUX3 Flow Bench/Media/imported_002.jpg').jpeg({ quality: 85 }).toBuffer();
    const t0 = Date.now();
    const res = await fetch('https://api.deepinfra.com/v1/openai/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model, temperature: 0, messages: [{ role: 'user', content: [
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${img.toString('base64')}` } },
            { type: 'text', text: analyseQuestion(family) }] }] }),
    });
    const body = await res.json();
    const text = body.choices?.[0]?.message?.content || JSON.stringify(body).slice(0, 600);
    fs.writeFileSync(OUT + label + '.txt', text);
    score(label, text, `${((Date.now() - t0) / 1000).toFixed(1)} s, $${Number(body.usage?.estimated_cost || 0).toFixed(5)}, ${body.usage?.completion_tokens} tok, `);
}
