// MPI-1171 sketch-question bench on the standalone ComfyUI :8188 (never the app's engine), the
// app's describer graph asked exactly as describeImage's ComfyUI branch asks. Run under the lease:
//   python <mpi-lib>/scripts/gpu_lease.py run --timeout 3600 --poll 2 -- node bench.mjs [question.txt]
import { pathToFileURL } from 'node:url';
import fs from 'node:fs';

const repo = 'C:/AI/Mpi/Cubric-Vision';
const DIR = 'G:/ComfyUi/ComfyUI/input/mpi1171/';
const COMFY = 'http://127.0.0.1:8188';
const REPEATS = 3;
globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
const cs = await import(pathToFileURL(`${repo}/js/data/childSafety.js`).href);
const { buildDescribeInjectionParams } = await import(pathToFileURL(`${repo}/js/services/llmService.js`).href);
const SKETCH = fs.readFileSync(process.argv[2] || new URL('./question.txt', import.meta.url), 'utf8').trim();
const yes = (a) => String(a || '').replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/[^A-Za-z]+/g, ' ').trim().toUpperCase() === 'YES';

async function ask(path, question) {
    const g = JSON.parse(fs.readFileSync(`${repo}/comfy_workflows/image_descriptor.json`, 'utf8'));
    const byTitle = (t) => Object.values(g).find((n) => n._meta?.title === t);
    byTitle('Input_Describe_Prompt').inputs.value = buildDescribeInjectionParams(question).Input_Describe_Prompt;
    byTitle('Input_Image').inputs.string = path;
    const { prompt_id, error } = await fetch(`${COMFY}/prompt`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: g }),
    }).then((r) => r.json());
    if (!prompt_id) throw new Error(JSON.stringify(error));
    for (let i = 0; i < 600; i++) {
        const h = (await fetch(`${COMFY}/history/${prompt_id}`).then((r) => r.json()))[prompt_id];
        if (h?.status?.completed || h?.status?.status_str === 'error') {
            const out = h.outputs?.['37'];
            if (!Array.isArray(out?.text)) throw new Error('no answer: the picture did not load');
            return out.text.join('');
        }
        await new Promise((r) => setTimeout(r, 500));
    }
    throw new Error('ComfyUI did not finish in 5 min');
}

console.log(`Q: ${SKETCH}\n`);
let bad = 0;
for (const f of fs.readdirSync(DIR).filter((n) => n.endsWith('.png') && n > (process.env.AFTER || '')).sort()) {
    const want = f.startsWith('doodle_');
    const ages = [], sketches = [];
    for (let i = 0; i < REPEATS; i++) {
        ages.push(cs.parseAgeAnswer(await ask(DIR + f, cs.AGE_QUESTION)) ? 'NO' : 'YES');
        sketches.push(await ask(DIR + f, SKETCH));
    }
    const got = sketches.map(yes);
    // A doodle must be a sketch every time; anything else must never be one.
    const ok = want ? got.every(Boolean) : !got.some(Boolean);
    if (!ok) bad += 1;
    console.log(`${ok ? 'ok  ' : 'MISS'} ${f.padEnd(44)} age ${ages.join('/')}  sketch ${sketches.map((s) => JSON.stringify(s.slice(0, 12))).join('/')}`);
}
console.log(`\n${bad} miss(es)`);
