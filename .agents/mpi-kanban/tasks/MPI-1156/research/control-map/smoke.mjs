// Runs comfy_workflows/control_map_describe.json as the app injects it, on the standalone :8188.
import { pathToFileURL } from 'node:url';
import fs from 'node:fs';
const repo = 'C:/AI/Mpi/Cubric-Vision';
globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
const cs = await import(pathToFileURL(`${repo}/js/data/childSafety.js`).href);
const { buildDescribeInjectionParams } = await import(pathToFileURL(`${repo}/js/services/llmService.js`).href);
const COMFY = 'http://127.0.0.1:8188';
async function ask(path, net) {
    const g = JSON.parse(fs.readFileSync(`${repo}/comfy_workflows/control_map_describe.json`, 'utf8'));
    const byTitle = (t) => Object.values(g).find((n) => n._meta?.title === t);
    byTitle('Input_Describe_Prompt').inputs.value = buildDescribeInjectionParams(cs.AGE_QUESTION).Input_Describe_Prompt;
    byTitle('Input_Image').inputs.string = path;
    byTitle('Input_Control_Net').inputs.int = net;
    const { prompt_id, error, node_errors } = await fetch(`${COMFY}/prompt`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: g }) }).then((r) => r.json());
    if (!prompt_id) throw new Error(JSON.stringify({ error, node_errors }));
    for (let i = 0; i < 1200; i++) {
        const h = (await fetch(`${COMFY}/history/${prompt_id}`).then((r) => r.json()))[prompt_id];
        if (h?.status?.completed || h?.status?.status_str === 'error') return h.outputs?.['37']?.text?.join('') ?? JSON.stringify(h.status);
        await new Promise((r) => setTimeout(r, 300));
    }
}
for (const f of ['adult_boogu25.png', 'child_klein_age10_photo.png']) {
    for (const net of [2, 3, 4]) {
        const t0 = Date.now();
        const a = await ask(`G:/ComfyUi/ComfyUI/input/mpi_ctl/${f}`, net);
        console.log(f, net, JSON.stringify(a), `${((Date.now() - t0) / 1000).toFixed(1)}s`);
    }
}
