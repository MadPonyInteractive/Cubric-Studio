// MPI-1253 bench: one describer call on a picture, boxes drawn as asked (x1,y1,x2,y2) and transposed.
// usage: node boxbench.mjs <picture> <label> [question-file]
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const sharp = require('C:/AI/Mpi/Cubric-Vision/node_modules/sharp');
const { ANALYSE_QUESTION } = await import('file:///C:/AI/Mpi/Cubric-Vision/js/data/layoutBoxes.js');

const [pic, label, qFile] = process.argv.slice(2);
const question = qFile ? fs.readFileSync(qFile, 'utf8') : ANALYSE_QUESTION;
const MODEL = process.env.MODEL || 'google/gemma-4-26B-A4B-it';
const img = await sharp(pic, { limitInputPixels: false }).resize(1024, 1024, { fit: 'inside' }).jpeg({ quality: 85 }).toBuffer();
const { width: W, height: H } = await sharp(img).metadata();

const t0 = Date.now();
const res = process.env.REDRAW ? null : await fetch('https://api.deepinfra.com/v1/openai/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.DEEPINFRA_API_KEY}` },
    body: JSON.stringify({ model: MODEL, messages: [{ role: 'user', content: [
        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${img.toString('base64')}` } },
        { type: 'text', text: question }] }] }),
});
const body = res ? await res.json() : { choices: [{ message: { content: fs.readFileSync(`${label}.txt`, "utf8") } }] };
const secs = ((Date.now() - t0) / 1000).toFixed(1);
const text = body.choices?.[0]?.message?.content || JSON.stringify(body).slice(0, 400);
fs.writeFileSync(`${label}.txt`, text);
console.log(`${label}: ${secs}s, usage ${JSON.stringify(body.usage)}`);

const s = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
let items = [];
try { items = JSON.parse(s).items || []; } catch { console.log('no JSON'); }
const colours = ['#3cf', '#fd3', '#6d6', '#f93', '#f6a', '#f55', '#a8f', '#fff', '#0ff', '#f0f'];
const svg = (swap) => `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${items.map((it, i) => {
    const o = it.box; const bb = (o && typeof o === 'object' && !Array.isArray(o) ? [o.left, o.top, o.right, o.bottom] : (it.bbox_2d || it.box_2d || it.bbox || [])).map(Number);
    if (bb.length !== 4) return '';
    const [a, b, c, d] = swap ? [bb[1], bb[0], bb[3], bb[2]] : bb;
    const x = a / 1000 * W, y = b / 1000 * H, w = (c - a) / 1000 * W, h = (d - b) / 1000 * H;
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="${colours[i % 10]}" stroke-width="4"/>`
        + `<text x="${x + 6}" y="${y + 26}" font-size="24" font-family="Arial" fill="${colours[i % 10]}" stroke="#000" stroke-width="1">${it.name}</text>`;
}).join('')}</svg>`;
const asAsked = await sharp(img).composite([{ input: Buffer.from(svg(false)) }]).png().toBuffer();
const swapped = await sharp(img).composite([{ input: Buffer.from(svg(true)) }]).png().toBuffer();
const pair = await sharp({ create: { width: W * 2 + 20, height: H, channels: 3, background: '#000' } })
    .composite([{ input: asAsked, left: 0, top: 0 }, { input: swapped, left: W + 20, top: 0 }]).png().toBuffer();
await sharp(pair).resize(1200).png().toFile(`${label}.png`);
console.log(items.map((it) => `${it.name} ${JSON.stringify(it.box || it.bbox_2d || it.box_2d)}`).join('\n'));
