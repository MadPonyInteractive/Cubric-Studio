// Control-map age bench on the standalone ComfyUI :8188 (never the app's engine): make the four
// maps the control op feeds the model (same AIO_Preprocessor settings as qwen_image_2_1.json),
// then ask the describer exactly as describeImage's ComfyUI branch asks.
import { pathToFileURL } from 'node:url';
import fs from 'node:fs';

const repo = 'C:/AI/Mpi/Cubric-Vision';
const IN = 'G:/ComfyUi/ComfyUI/input/mpi_ctl/';
const OUT = 'D:/WORK/Images/Outputs/';
const COMFY = 'http://127.0.0.1:8188';
const REPEATS = Number(process.env.REPEATS || 3);
const TYPES = { pose: 'OpenposePreprocessor', depth: 'DepthAnythingV2Preprocessor', scribble: 'ScribblePreprocessor', canny: 'CannyEdgePreprocessor' };
globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
const cs = await import(pathToFileURL(`${repo}/js/data/childSafety.js`).href);
const { buildDescribeInjectionParams } = await import(pathToFileURL(`${repo}/js/services/llmService.js`).href);
const QUESTIONS = JSON.parse(fs.readFileSync(new URL(`./${process.env.Q || 'questions.json'}`, import.meta.url), 'utf8'));
if (!process.env.NOAGE) QUESTIONS.AGE ??= cs.AGE_QUESTION;
const no = (a) => cs.parseAgeAnswer(a);

async function run(graph, outNode) {
    const { prompt_id, error, node_errors } = await fetch(`${COMFY}/prompt`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: graph }),
    }).then((r) => r.json());
    if (!prompt_id) throw new Error(JSON.stringify({ error, node_errors }));
    for (let i = 0; i < 1200; i++) {
        const h = (await fetch(`${COMFY}/history/${prompt_id}`).then((r) => r.json()))[prompt_id];
        if (h?.status?.completed || h?.status?.status_str === 'error') return h.outputs?.[outNode];
        await new Promise((r) => setTimeout(r, 300));
    }
    throw new Error('ComfyUI did not finish in 6 min');
}

async function makeMap(file, type) {
    // SAVED=1: ask the maps an earlier run saved, never re-make them.
    // PHOTO=1: ask the source photo itself (the picture check, not a map).
    if (process.env.PHOTO) return `${IN}${file}`;
    if (process.env.SAVED) return `${OUT}mpi_ctl_maps/${file.replace(/\.png$/, '')}_${type}_00001_.png`;
    const name = `mpi_ctl_maps/${file.replace(/\.png$/, '')}_${type}`;
    const out = await run({
        1: { class_type: 'LoadImage', inputs: { image: `mpi_ctl/${file}` } },
        2: { class_type: 'ImageScaleToTotalPixels', inputs: { upscale_method: 'lanczos', megapixels: 1, resolution_steps: 32, image: ['1', 0] } },
        3: { class_type: 'AIO_Preprocessor', inputs: { preprocessor: TYPES[type], resolution: 1024, image: ['2', 0] } },
        4: { class_type: 'SaveImage', inputs: { filename_prefix: name, images: ['3', 0] } },
    }, '4');
    const img = out?.images?.[0];
    if (!img) throw new Error(`no map for ${file} ${type}`);
    return `${OUT}${img.subfolder}/${img.filename}`;
}

async function ask(path, question) {
    const g = JSON.parse(fs.readFileSync(`${repo}/comfy_workflows/image_descriptor.json`, 'utf8'));
    const byTitle = (t) => Object.values(g).find((n) => n._meta?.title === t);
    byTitle('Input_Describe_Prompt').inputs.value = buildDescribeInjectionParams(question).Input_Describe_Prompt;
    byTitle('Input_Image').inputs.string = path;
    const out = await run(g, '37');
    if (!Array.isArray(out?.text)) throw new Error('no answer: the picture did not load');
    return out.text.join('');
}

const only = process.env.TYPES ? process.env.TYPES.split(',') : Object.keys(TYPES);
const rows = [];
for (const f of fs.readdirSync(IN).filter((n) => n.endsWith('.png') && n.startsWith(process.env.ONLY || '')).sort()) {
    for (const type of only) {
        const map = await makeMap(f, type);
        const cells = [];
        for (const [qk, q] of Object.entries(QUESTIONS)) {
            const a = [];
            for (let i = 0; i < REPEATS; i++) { const t = await ask(map, q); a.push(qk.startsWith('YEARS') ? t.trim().slice(0, 12) : no(t) ? 'NO' : 'YES'); }
            cells.push(`${qk} ${a.join('/')}`);
        }
        const line = `${f.padEnd(36)} ${type.padEnd(9)} ${cells.join('  ')}`;
        rows.push(line);
        console.log(line);
    }
}
fs.appendFileSync(new URL('./results.txt', import.meta.url), rows.join('\n') + '\n');
