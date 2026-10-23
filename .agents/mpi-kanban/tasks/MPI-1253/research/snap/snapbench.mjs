// MPI-1253 snap pass bench: saved describer answers, before vs after `snapBoxes`.
// Vogue: mean best-IoU against Fabio's 9 hand boxes. Every picture: an overlay PNG
// (red = describer, green = snapped) in the scratchpad given as argv[2].
// usage: node snapbench.mjs <outDir>
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const sharp = require('C:/AI/Mpi/Cubric-Vision/node_modules/sharp');
const { boxesFromAnalysis, snapBoxes } = await import('file:///C:/AI/Mpi/Cubric-Vision/js/data/layoutBoxes.js');

const OUT = process.argv[2];
const MEDIA = 'C:/Users/Fabio/Documents/Cubric Studio/Projects/FLUX3 Flow Bench/Media/';
const QB = 'C:/AI/Mpi/Cubric-Vision/.agents/mpi-kanban/tasks/MPI-1253/research/qwen-bench/';
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
const mean = (boxes) => Object.values(TRUTH).reduce((s, t) => s + Math.max(0, ...boxes.map((b) => iou(t, [b.x, b.y, b.w, b.h]))), 0) / 9;

async function run(label, file, answer, family, truth) {
    const src = sharp(MEDIA + file);
    const { width: W0, height: H0 } = await src.metadata();
    const s = Math.min(1, 1024 / Math.max(W0, H0)); // the app's working size (_analyseBoxes)
    const { data, info } = await src.clone().resize(Math.round(W0 * s), Math.round(H0 * s)).raw().toBuffer({ resolveWithObject: true });
    const before = boxesFromAnalysis(answer, family).boxes;
    const t = performance.now();
    const after = snapBoxes(before, { data, width: info.width, height: info.height, channels: info.channels });
    const ms = (performance.now() - t).toFixed(0);
    const moved = after.filter((b, i) => b !== before[i]).length;
    console.log(`${label}: ${before.length} boxes, ${moved} snapped, ${ms} ms` + (truth ? `, mean best-IoU ${mean(before).toFixed(2)} -> ${mean(after).toFixed(2)}` : ''));
    const rect = (b, c) => `<rect x="${b.x * W0}" y="${b.y * H0}" width="${b.w * W0}" height="${b.h * H0}" fill="none" stroke="${c}" stroke-width="3"/>`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W0}" height="${H0}">${before.map((b) => rect(b, '#ff2020')).join('')}${after.map((b) => rect(b, '#00c040')).join('')}</svg>`;
    await src.clone().composite([{ input: Buffer.from(svg) }]).png().toFile(`${OUT}/${label}.png`);
}

// bazaar_gemma.txt: Gemma 4's 08:22 Bazaar answer, from Fabio's app.log (logged on its 0-box read).
const HERE = new URL('.', import.meta.url);
await run('bazaar_gemma', 'imported_005.jpg', fs.readFileSync(new URL('bazaar_gemma.txt', HERE), 'utf8'), 'gemma', false);
await run('vogue_gemma1', 'imported_002.jpg', fs.readFileSync(QB + 'gemma_1.txt', 'utf8'), 'gemma', true);
await run('vogue_gemma2', 'imported_002.jpg', fs.readFileSync(QB + 'gemma_2.txt', 'utf8'), 'gemma', true);
await run('vogue_qwen4b', 'imported_002.jpg', fs.readFileSync(QB + 'D_named_injected.txt', 'utf8'), 'qwen', true);
await run('vogue_qwen30b', 'imported_002.jpg', fs.readFileSync(QB + 'q30_1.txt', 'utf8'), 'qwen', true);
