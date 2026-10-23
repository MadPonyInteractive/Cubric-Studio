// MPI-1253: does the picture pick each answer's box order (fitAnalysis)? Every saved answer
// is snapped in both readings; prints the fit of each and the reading chosen.
// Truth: Gemma writes y-first (yx), Qwen x-first (xy), whatever the key.
// usage: node orderbench.mjs
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const sharp = require('C:/AI/Mpi/Cubric-Vision/node_modules/sharp');
const { boxesFromAnalysis, snapBoxes, fitAnalysis } = await import('file:///C:/AI/Mpi/Cubric-Vision/js/data/layoutBoxes.js');

const MEDIA = 'C:/Users/Fabio/Documents/Cubric Studio/Projects/FLUX3 Flow Bench/Media/';
const QB = 'C:/AI/Mpi/Cubric-Vision/.agents/mpi-kanban/tasks/MPI-1253/research/qwen-bench/';
const HERE = new URL('.', import.meta.url);
const pixels = async (file) => {
    const src = sharp(file.includes(':') ? file : MEDIA + file);
    const { width, height } = await src.metadata();
    const s = Math.min(1, 1024 / Math.max(width, height));
    const { data, info } = await src.resize(Math.round(width * s), Math.round(height * s)).raw().toBuffer({ resolveWithObject: true });
    return { data, width: info.width, height: info.height, channels: info.channels };
};
const iou = (a, b) => {
    const i = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
    return i ? i / (a.w * a.h + b.w * b.h - i) : 0;
};
const fit = (text, order, img) => {
    const found = boxesFromAnalysis(text, order);
    const snapped = snapBoxes(found.boxes, img);
    return snapped.reduce((s, b, i) => s + (b === found.boxes[i] ? 0 : iou(b, found.boxes[i])), 0).toFixed(2);
};
const cases = [
    ['bazaar gemma (box)', 'imported_005.jpg', fs.readFileSync(new URL('bazaar_gemma.txt', HERE), 'utf8'), 'yx'],
    ['vogue gemma 1 (box_2d)', 'imported_002.jpg', fs.readFileSync(QB + 'gemma_1.txt', 'utf8'), 'yx'],
    ['vogue gemma 2 (box_2d)', 'imported_002.jpg', fs.readFileSync(QB + 'gemma_2.txt', 'utf8'), 'yx'],
    ['vogue qwen 4B (bbox_2d)', 'imported_002.jpg', fs.readFileSync(QB + 'D_named_injected.txt', 'utf8'), 'xy'],
    ['vogue qwen 30B (bbox_2d)', 'imported_002.jpg', fs.readFileSync(QB + 'q30_1.txt', 'utf8'), 'xy'],
    ['vogue qwen 235B (bbox_2d)', 'imported_002.jpg', fs.readFileSync(QB + 'q235_1.txt', 'utf8'), 'xy'],
    // 2026-10-23: a photo collage, nothing snaps the right way; rebuilt from the boxes Fabio's
    // app saved (read xy, so written back as the numbers Gemma sent).
    ['tokyo gemma (box_2d)', 'C:/Users/Fabio/AppData/Local/Temp/claude/C--AI-Mpi-Cubric-Vision/d97e027a-503d-4722-be51-dca53a2c0014/scratchpad/BoxesTest3/Media/imported_23c5448e.jpg',
        fs.readFileSync(new URL('tokyo_gemma.txt', HERE), 'utf8'), 'yx'],
];
let right = 0;
for (const [label, file, text, truth] of cases) {
    const img = await pixels(file);
    const best = fitAnalysis(text, img);
    const pick = best.order === 'key' ? (/"box_2d"/.test(text) ? 'yx' : 'xy') : best.order;
    if (pick === truth) right++;
    console.log(`${label}: fit yx ${fit(text, 'yx', img)} / xy ${fit(text, 'xy', img)} -> ${pick} (${best.snapped} snapped) ${pick === truth ? 'RIGHT' : 'WRONG'}`);
}
console.log(`${right}/${cases.length} right`);
