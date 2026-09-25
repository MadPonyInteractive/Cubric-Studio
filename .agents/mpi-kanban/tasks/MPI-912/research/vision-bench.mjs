/**
 * Score DeepInfra vision models on the picture that beat the current describer.
 * Production shape, exactly: the system + user text parsed out of
 * comfy_workflows/image_descriptor.json, the same 1 MP / 16-px nearest downscale
 * (routes/llm.js), the same `image_url` data-URL content part.
 *
 * Ground truth is in the ARGV image's companion .truth.json: { must:[], mustNot:[] }
 * as case-insensitive regexes, so scoring is not my opinion of the prose.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
const sharp = createRequire('file:///C:/AI/Mpi/Cubric-Vision/package.json')('sharp');

// MPI-912: BENCH_BASE=http://localhost:11434/v1 scores local Ollama models through the
// same OpenAI shim production's describe route uses on the Ollama connection. No key.
const BASE = process.env.BENCH_BASE || 'https://api.deepinfra.com/v1/openai';
const KEY = process.env.DEEPINFRA_API_KEY;
if (!KEY && BASE.includes('deepinfra')) throw new Error('DEEPINFRA_API_KEY missing');

const MODELS = process.env.BENCH_MODELS.split(',');
const imagePath = process.argv[2];
const truth = JSON.parse(await fs.readFile(process.argv[3], 'utf8'));

// ── production's prompt, read from the shipped workflow ──────────────────────
const wf = JSON.parse(await fs.readFile('C:/AI/Mpi/Cubric-Vision/comfy_workflows/image_descriptor.json', 'utf8'));
const raw = wf['38'].inputs.value;
const system = raw.split('<|im_start|>system\n')[1].split('<|im_end|>')[0];
const userText = raw.split('<|vision_start|><|image_pad|><|vision_end|>')[1].split('<|im_end|>')[0];

// ── production's resize ─────────────────────────────────────────────────────
const MAX = 1_000_000, STEP = 16;
const { data: rawBuf, info } = await sharp(imagePath).raw().toBuffer({ resolveWithObject: true });
let pipe = sharp(rawBuf, { raw: { width: info.width, height: info.height, channels: info.channels } });
if (info.width * info.height > MAX) {
    const s = Math.sqrt(MAX / (info.width * info.height));
    pipe = pipe.resize(Math.max(STEP, Math.floor(info.width * s / STEP) * STEP),
                       Math.max(STEP, Math.floor(info.height * s / STEP) * STEP), { fit: 'fill', kernel: 'nearest' });
}
const b64 = (await pipe.jpeg({ quality: 85 }).toBuffer()).toString('base64');
console.log(`image ${path.basename(imagePath)}  ${info.width}x${info.height} -> ${(b64.length / 1366).toFixed(0)} KB jpeg\n`);

const messages = [
    { role: 'system', content: system },
    { role: 'user', content: [{ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${b64}` } }, { type: 'text', text: userText }] },
];

const hit = (text, pats) => pats.filter((p) => new RegExp(p, 'i').test(text));
const results = [];

for (const model of MODELS) {
    const t0 = Date.now();
    let text = '', usage = null, err = null;
    try {
        if (BASE.includes(':11434')) {
            // Run 2+: exactly production's describe call on the Ollama connection since the
            // path fix (native engine, think off, no temperature or token cap).
            const { chatEngineFor } = await import('file:///C:/AI/Mpi/Cubric-Vision/services/llmEngines.mjs');
            const d = await chatEngineFor('ollama', null, BASE).engine.chat({ model, messages });
            text = d.text || '';
            usage = d.usage;
        } else {
        const r = await fetch(`${BASE}/chat/completions`, {
            method: 'POST',
            headers: { ...(KEY && { Authorization: `Bearer ${KEY}` }), 'Content-Type': 'application/json' },
            body: JSON.stringify({ model, messages, max_tokens: 700, temperature: 0 }),
            signal: AbortSignal.timeout(180_000),
        });
        const j = await r.json();
        if (!r.ok || j.error) err = `${r.status} ${JSON.stringify(j.error || j).slice(0, 160)}`;
        else { text = j.choices?.[0]?.message?.content || ''; usage = j.usage; }
        }
    } catch (e) { err = `${e.name}: ${e.message}`; }

    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    if (err) { console.log(`\n### ${model}\n  FAILED ${err}`); results.push({ model, err }); continue; }

    const got = hit(text, truth.must);
    const bad = hit(text, truth.mustNot);
    const cost = usage ? (usage.prompt_tokens * (truth.priceIn?.[model] ?? 0) + usage.completion_tokens * (truth.priceOut?.[model] ?? 0)) / 1e6 * 100 : null;
    console.log(`\n### ${model}   ${secs}s  ${usage?.prompt_tokens}in/${usage?.completion_tokens}out${cost != null ? `  ${cost.toFixed(4)}c` : ''}`);
    console.log(`  MUST hit ${got.length}/${truth.must.length}  ${got.join(' | ') || '-'}`);
    console.log(`  MISSED   ${truth.must.filter((p) => !got.includes(p)).join(' | ') || 'none'}`);
    console.log(`  WRONG    ${bad.join(' | ') || 'none'}`);
    const win = truth.focus ? (text.match(new RegExp(truth.focus, 'i'))?.index ?? -1) : -1;
    if (win >= 0) console.log(`  says: ...${text.slice(Math.max(0, win - 130), win + 190).replace(/\s+/g, ' ')}...`);
    results.push({ model, secs, got: got.length, bad: bad.length, text });
}

console.log('\n\n=== TABLE (must-hits / wrong)');
for (const r of results.sort((a, b) => (b.got ?? -1) - (a.got ?? -1) || (a.bad ?? 9) - (b.bad ?? 9))) {
    console.log(r.err ? `  FAIL  ${r.model}  ${r.err.slice(0, 80)}` : `  ${r.got}/${truth.must.length} hit, ${r.bad} wrong  ${r.secs}s  ${r.model}`);
}
await fs.writeFile(process.argv[4], JSON.stringify(results, null, 1));
