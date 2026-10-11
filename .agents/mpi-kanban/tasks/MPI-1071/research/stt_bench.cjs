'use strict';
/**
 * MPI-1071 bench: every clip through every Remote transcribe model, side by side.
 *
 *   DEEPINFRA_API_KEY=... node stt_bench.cjs <out-dir> <clip> [<clip> ...]
 *
 * Each clip is re-encoded to WebM/Opus first, because that is what dictation sends (the
 * recorder's own format), then run through the app's real `_transcribe` (routes/deepinfra.js),
 * so the bench exercises the shipped request, not a copy of it. Writes results.json + results.md.
 * Cost: billed per audio second per model; the run prints the estimate before it calls anything.
 */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const repo = path.resolve(__dirname, '../../../../..');
const { _transcribe, STT_MODELS } = require(path.join(repo, 'routes/deepinfra.js'));
const USD_PER_MIN = { turbo: 0.0002, large: 0.00045, qwen: 0.00045, voxtral: 0.003 };
// STT_ONLY=voxtral,qwen limits the models; STT_FORMAT=wav sends 16 kHz mono WAV instead of WebM/Opus.
const MODELS = (process.env.STT_ONLY || Object.keys(STT_MODELS).join(",")).split(",");
const WAV = process.env.STT_FORMAT === "wav";

const [outDir, ...clips] = process.argv.slice(2);
const key = process.env.DEEPINFRA_API_KEY;
if (!outDir || !clips.length || !key) {
    console.error('usage: DEEPINFRA_API_KEY=... node stt_bench.cjs <out-dir> <clip>...');
    process.exit(2);
}
fs.mkdirSync(outDir, { recursive: true });

const seconds = (f) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString());
const durs = clips.map(seconds);
const est = durs.reduce((s, d) => s + MODELS.reduce((a, k) => a + USD_PER_MIN[k] * Math.ceil(d) / 60, 0), 0);
console.log(`${clips.length} clips, ${durs.reduce((a, b) => a + b, 0).toFixed(0)} s of audio, ${MODELS.length} models: ~$${est.toFixed(4)}`);

(async () => {
    const rows = [];
    for (const [i, clip] of clips.entries()) {
        const enc = path.join(outDir, `clip${i + 1}.${WAV ? 'wav' : 'webm'}`);
        execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', clip, '-vn', '-ac', '1',
            ...(WAV ? ['-ar', '16000', '-c:a', 'pcm_s16le'] : ['-c:a', 'libopus', '-b:a', '32k']), enc]);
        const audio = fs.readFileSync(enc);
        const row = { clip: path.basename(clip), seconds: durs[i], out: {} };
        for (const k of MODELS) {
            const t0 = Date.now();
            const r = await _transcribe(key, audio, WAV ? 'audio/wav' : 'audio/webm', false, k);
            row.out[k] = { text: r.text ?? null, error: r.code ? `${r.code}: ${r.message}` : null, ms: Date.now() - t0 };
            console.log(`clip ${i + 1} ${k}: ${r.text ? `${r.text.length} chars` : row.out[k].error} (${row.out[k].ms} ms)`);
        }
        rows.push(row);
    }
    fs.writeFileSync(path.join(outDir, 'results.json'), JSON.stringify(rows, null, 2));
    const md = rows.map((r, i) => [`## Clip ${i + 1} - ${r.clip} (${r.seconds.toFixed(1)} s)`, '',
        ...Object.entries(r.out).map(([k, o]) => `**${k}** (${o.ms} ms): ${o.text ?? `_${o.error}_`}`), ''].join('\n\n')).join('\n');
    fs.writeFileSync(path.join(outDir, 'results.md'), `# MPI-1071 speech-to-text bench\n\n${md}`);
    console.log(`wrote ${path.join(outDir, 'results.md')}`);
})();
