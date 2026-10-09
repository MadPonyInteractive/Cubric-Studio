#!/usr/bin/env node
// Seconds per image for a RunPod GPU, measured the way RunPod measured the GPU picker's
// Gen speed table (GPU_GEN_SECS): FLUX.2 Klein 9B bf16, the official 4-step graph,
// 1024x1024, ComfyUI, single user, median of repeat runs timed ON the Pod from ComfyUI's
// history (no network time), a new prompt every image. Procedure, costs and traps:
// docs/playbooks/gpu-benchmark/README.md (MPI-1054, MPI-1055).
//
//   node scripts/bench-gpu-klein.mjs --plan "NVIDIA L40,NVIDIA A100 80GB PCIe"   # price + stock, spends nothing
//   node scripts/bench-gpu-klein.mjs --cap 1 --calib "NVIDIA A40" "NVIDIA L40"   # A40 checks the setup, then the rest in parallel
//
// Keys: RUNPOD_API_KEY (or RUNPOD_ENV_FILE, a file holding a RUNPOD_API_KEY= line) and
// HF_TOKEN (or HF_TOKEN_FILE) for a Hugging Face account that accepted the gated
// black-forest-labs/FLUX.2-klein-9B licence. Neither is printed, and the HF token never
// leaves this machine: the Pod gets a 60-min signed download link instead.
// Pods are named cubric-gpu-bench (the app's orphan sweep reaps only 'cubric-vision'),
// deleted in `finally`, and remove themselves after HARD_MIN if this process dies.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GPU_GEN_SECS } from '../js/data/runpodGpuSpecs.js';

const API = 'https://api.runpod.io/v2';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';
const IMAGE = 'runpod/pytorch:1.0.2-cu1281-torch280-ubuntu2204';   // torch 2.8 / CUDA 12.8: Ampere..Blackwell
// That torch refused a host whose driver reports CUDA 12.8 ("driver too old", 2026-10-09).
const CUDA_FLOOR = '12.9';
const COMFY_TAG = 'v0.39.0';
const NAME = 'cubric-gpu-bench';
const HARD_MIN = 40;          // per-Pod ceiling, enforced here AND on the Pod
const READY_MIN = 25;         // create -> ComfyUI up measured 2.6-5.4 min
const STOCK_WAIT_MIN = 45;    // keep retrying a sold-out card this long (nothing bills while waiting)
const RUNS = 10;              // new prompt each image: what RunPod's numbers include, so it ships
const CACHED_RUNS = 5;        // same prompt, text encoder cached: diagnostic only, 20-30% faster
const CALIB_TOLERANCE = 0.10;
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'logs', 'gpu-bench.jsonl');

const args = process.argv.slice(2);
const PLAN = args.includes('--plan');
const CAP = Number(args[args.indexOf('--cap') + 1]) || 3;
const CALIB = args.includes('--calib') ? args[args.indexOf('--calib') + 1] : null;
const CARDS = (args.filter((a, i) => !a.startsWith('--') && !/^\d+(\.\d+)?$/.test(a) && args[i - 1] !== '--calib')[0] || '')
    .split(',').map((s) => s.trim()).filter(Boolean);
if (!CARDS.length) { console.error('usage: bench-gpu-klein.mjs [--plan] [--cap USD] [--calib "<RunPod-measured id>"] "GPU id,GPU id"'); process.exit(2); }

function secret(envVar, fileVar, re) {
    if (process.env[envVar]) return process.env[envVar].trim();
    if (!process.env[fileVar]) { console.error(`set ${envVar} or ${fileVar}`); process.exit(2); }
    const m = re.exec(fs.readFileSync(process.env[fileVar], 'utf8'));
    if (!m) { console.error(`${fileVar}: no key found`); process.exit(2); }
    return m[1].trim();
}
const KEY = secret('RUNPOD_API_KEY', 'RUNPOD_ENV_FILE', /^RUNPOD_API_KEY=(.+)$/m);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

async function rp(method, p, body) {
    const res = await fetch(API + p, {
        method,
        headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', 'User-Agent': UA },
        body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json; try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text.slice(0, 500) }; }
    return { ok: res.ok, status: res.status, json };
}

// ---- the workflow: Comfy's official Klein 9B t2i graph, core nodes only ----
const PROMPT = 'A red fox sitting on a mossy rock in a misty pine forest at dawn, soft golden light, photorealistic';
function workflow(seed, text) {
    return {
        1: { class_type: 'UNETLoader', inputs: { unet_name: 'flux-2-klein-9b.safetensors', weight_dtype: 'default' } },
        2: { class_type: 'CLIPLoader', inputs: { clip_name: 'qwen_3_8b_fp8mixed.safetensors', type: 'flux2', device: 'default' } },
        3: { class_type: 'VAELoader', inputs: { vae_name: 'flux2-vae.safetensors' } },
        4: { class_type: 'CLIPTextEncode', inputs: { clip: ['2', 0], text } },
        5: { class_type: 'ConditioningZeroOut', inputs: { conditioning: ['4', 0] } },
        6: { class_type: 'CFGGuider', inputs: { model: ['1', 0], positive: ['4', 0], negative: ['5', 0], cfg: 1 } },
        7: { class_type: 'RandomNoise', inputs: { noise_seed: seed } },
        8: { class_type: 'KSamplerSelect', inputs: { sampler_name: 'euler' } },
        9: { class_type: 'Flux2Scheduler', inputs: { steps: 4, width: 1024, height: 1024 } },
        10: { class_type: 'EmptyFlux2LatentImage', inputs: { width: 1024, height: 1024, batch_size: 1 } },
        11: { class_type: 'SamplerCustomAdvanced', inputs: { noise: ['7', 0], guider: ['6', 0], sampler: ['8', 0], sigmas: ['9', 0], latent_image: ['10', 0] } },
        12: { class_type: 'VAEDecode', inputs: { samples: ['11', 0], vae: ['3', 0] } },
        13: { class_type: 'SaveImage', inputs: { images: ['12', 0], filename_prefix: 'bench' } },
    };
}

// ---- on-Pod start script ----
const HF = 'https://huggingface.co';
// No `set -x`: it would echo the signed weight link into the Pod log. Every `wait` names
// its PIDs: a bare `wait` also waits on the 40-min self-remove sleep, which hung the first
// A40 attempt for 25 billed minutes (2026-10-09). aria2c (16 ranged connections a file)
// pulled the 27 GB in 32 s. A container that dies restarts on the same disk and loops while
// billing (a 6000 Ada on a 12.8 driver did), so a second boot removes the Pod instead.
const POD_SCRIPT = `set -u
SELF_RM='runpodctl remove pod "$RUNPOD_POD_ID" || curl -s -X DELETE -H "Authorization: Bearer $RUNPOD_API_KEY" ${API}/pods/$RUNPOD_POD_ID'
if [ -f /root/.bench_booted ]; then echo "BENCH restarted - removing pod"; eval "$SELF_RM"; sleep 600; exit 1; fi
touch /root/.bench_booted
(sleep ${HARD_MIN * 60}; eval "$SELF_RM") &
echo "BENCH apt"; (apt-get update -qq && apt-get install -y -qq aria2) > /tmp/apt.log 2>&1 & APT=$!
echo "BENCH clone"; cd /root && git clone -q --depth 1 --branch ${COMFY_TAG} https://github.com/comfyanonymous/ComfyUI && cd ComfyUI
echo "BENCH pip"; grep -vE '^(torch|torchvision|torchaudio)$' requirements.txt > /tmp/req.txt && python3 -m pip install -q -r /tmp/req.txt
wait $APT; command -v aria2c || { echo "BENCH aria2 install failed"; tail -5 /tmp/apt.log; }
echo "BENCH download"
(while sleep 30; do echo "BENCH progress $(du -sm models | cut -f1) MB"; done) & PROG=$!
A="aria2c -q -x16 -s16 -k8M --file-allocation=none --max-tries=5 --retry-wait=3"
$A -d models/diffusion_models -o flux-2-klein-9b.safetensors "$KLEIN_URL" & P1=$!
$A -d models/text_encoders -o qwen_3_8b_fp8mixed.safetensors ${HF}/Comfy-Org/flux2-klein-9B/resolve/main/split_files/text_encoders/qwen_3_8b_fp8mixed.safetensors & P2=$!
$A -d models/vae -o flux2-vae.safetensors ${HF}/Comfy-Org/flux2-klein-9B/resolve/main/split_files/vae/flux2-vae.safetensors & P3=$!
wait $P1 $P2 $P3; kill $PROG
echo "BENCH files"; ls -la models/diffusion_models models/text_encoders models/vae
echo "BENCH comfy"; exec python3 main.py --listen 0.0.0.0 --port 8188`;

// ---- spend ledger: every live Pod's rate x elapsed; the cap kills everything ----
const live = new Map();   // podId -> { rate, t0, card }
let spentClosed = 0;
const spentNow = () => spentClosed + [...live.values()].reduce((s, p) => s + p.rate * (Date.now() - p.t0) / 3.6e6, 0);
let capHit = false;

async function del(podId) {
    for (let i = 0; i < 5; i++) {
        const r = await rp('DELETE', `/pods/${podId}`);
        if (r.ok || r.status === 404) break;
        await sleep(3000);
    }
    const p = live.get(podId);
    if (p) { spentClosed += p.rate * (Date.now() - p.t0) / 3.6e6; live.delete(podId); }
}
async function killAll(why) { log('KILL ALL:', why); await Promise.all([...live.keys()].map(del)); }
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, async () => { await killAll(sig); process.exit(130); });
for (const ev of ['uncaughtException', 'unhandledRejection']) process.on(ev, async (e) => { console.error(ev, e); await killAll(ev); process.exit(1); });

async function catalog() {
    const r = await rp('GET', `/catalog/gpus?include=AVAILABILITY&product=POD&cloud=SECURE&minCudaVersion=${CUDA_FLOOR}`);
    if (!r.ok) throw new Error(`catalog http ${r.status} ${JSON.stringify(r.json).slice(0, 200)}`);
    return r.json.gpus || [];
}

// The gated BFL weight: sign the download HERE and hand the Pod only the CDN link (60-min
// CloudFront policy, time-bound only), so the HF token never leaves this machine.
async function signedKleinUrl(hfToken) {
    const r = await fetch(`${HF}/black-forest-labs/FLUX.2-klein-9B/resolve/main/flux-2-klein-9b.safetensors`,
        { method: 'HEAD', redirect: 'manual', headers: { Authorization: `Bearer ${hfToken}` } });
    const loc = r.headers.get('location');
    if (!loc) throw new Error(`HF sign http ${r.status} (403 = this account has not accepted the licence, or a fine-grained token without gated-repo read)`);
    return loc;
}

async function createWhenStocked(card, hfToken) {
    const until = Date.now() + STOCK_WAIT_MIN * 60e3;
    let n = 0;
    while (Date.now() < until && !capHit) {
        const r = await rp('POST', '/pods', {
            name: NAME, cloud: 'SECURE', image: IMAGE, disk: 60, ports: ['8188/http'],
            entrypoint: ['bash', '-c', POD_SCRIPT],
            env: { KLEIN_URL: await signedKleinUrl(hfToken) },
            gpu: { id: card, count: 1, minCudaVersion: CUDA_FLOOR },
        });
        if (r.ok && r.json.id) return r.json;
        if (n++ % 5 === 0) log(card, `create refused (http ${r.status}): ${JSON.stringify(r.json).slice(0, 160)} - waiting for stock`);
        await sleep(60e3);
    }
    return null;
}

async function comfy(podId, p, body) {
    const res = await fetch(`https://${podId}-8188.proxy.runpod.net${p}`, {
        method: body ? 'POST' : 'GET',
        headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(30e3),
    });
    if (!res.ok) throw new Error(`comfy ${p} http ${res.status}`);
    return res.json();
}

async function runOne(podId, seed, text) {
    const { prompt_id } = await comfy(podId, '/prompt', { prompt: workflow(seed, text) });
    const t0 = Date.now();
    for (;;) {
        await sleep(500);
        let h; try { h = await comfy(podId, `/history/${prompt_id}`); } catch { continue; }
        const e = h[prompt_id];
        if (!e || !e.status || !e.status.completed && e.status.status_str !== 'error') {
            if (Date.now() - t0 > 600e3) throw new Error('run timed out');
            continue;
        }
        if (e.status.status_str === 'error') throw new Error('run error: ' + JSON.stringify(e.status.messages).slice(0, 600));
        const ts = Object.fromEntries(e.status.messages.map(([k, v]) => [k, v.timestamp]));
        return (ts.execution_success - ts.execution_start) / 1000;
    }
}
const median = (a) => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

async function bench(card, hfToken) {
    let pod;
    try { pod = await createWhenStocked(card, hfToken); } catch (e) { return { card, error: `create: ${e.message || e}` }; }
    if (!pod) return { card, error: capHit ? 'cap hit' : `no stock in ${STOCK_WAIT_MIN} min` };
    const rate = pod.cost || 1;   // v2 Pod.cost = USD/hr; 1 is a pessimistic stand-in for the cap
    live.set(pod.id, { rate, t0: Date.now(), card });
    log(card, `pod ${pod.id} created, $${rate}/hr, dc ${pod.dataCenterId || '?'}`);
    try {
        let stats = null;
        while (!stats) {
            if (capHit) throw new Error('cap hit');
            if (Date.now() - live.get(pod.id).t0 > READY_MIN * 60e3) throw new Error(`ComfyUI not up after ${READY_MIN} min`);
            try { stats = await comfy(pod.id, '/system_stats'); } catch { await sleep(15e3); }
        }
        const readyMin = (Date.now() - live.get(pod.id).t0) / 60e3;
        log(card, `ComfyUI up after ${readyMin.toFixed(1)} min: ${stats.devices?.[0]?.name}`);
        const warm = await runOne(pod.id, 0, PROMPT);
        log(card, `warm-up ${warm.toFixed(2)} s (model load)`);
        const runs = [];
        for (let i = 1; i <= RUNS; i++) runs.push(await runOne(pod.id, i, `${PROMPT}, variation ${i}`));
        const cached = [];
        for (let i = 1; i <= CACHED_RUNS; i++) cached.push(await runOne(pod.id, 100 + i, PROMPT));
        const out = {
            card, podId: pod.id, rate, readyMin: +readyMin.toFixed(1), warm: +warm.toFixed(2),
            secs: +median(runs).toFixed(2), runs: runs.map((x) => +x.toFixed(2)),
            secsCachedPrompt: +median(cached).toFixed(2), runsCachedPrompt: cached.map((x) => +x.toFixed(2)),
            device: stats.devices?.[0]?.name, vramGb: +((stats.devices?.[0]?.vram_total || 0) / 2 ** 30).toFixed(1),
            ramGb: +((stats.system?.ram_total || 0) / 2 ** 30).toFixed(1), torch: stats.system?.pytorch_version,
            comfy: stats.system?.comfyui_version, at: new Date().toISOString(),
        };
        log(card, `RESULT ${out.secs} s/img (new prompt each, ships), ${out.secsCachedPrompt} cached prompt`);
        return out;
    } catch (e) {
        // /logs is an SSE stream that never ends: keep what arrives in 8 s.
        let tail = '';
        try {
            const res = await fetch(`${API}/pods/${pod.id}/logs?tail=80`, { headers: { Authorization: `Bearer ${KEY}`, 'User-Agent': UA }, signal: AbortSignal.timeout(8e3) });
            const reader = res.body.getReader();
            for (;;) { const { done, value } = await reader.read(); if (done) break; tail += Buffer.from(value).toString(); }
        } catch (_) { /* the 8 s abort ends the read; `tail` keeps what arrived */ }
        return { card, podId: pod.id, error: String(e.message || e), logTail: tail.slice(-4000) };
    } finally {
        await del(pod.id);
        log(card, `pod deleted; spend so far ~$${spentNow().toFixed(3)}`);
    }
}

// ---- main ----
const gpus = await catalog();
for (const c of CALIB ? [CALIB, ...CARDS] : CARDS) {
    const g = gpus.find((x) => x.id === c);
    const stock = g ? [...new Set((g.dataCenters || []).map((d) => d.availability))].join('/') : 'NOT IN CATALOGUE';
    log(`${c.padEnd(44)} $${g?.price?.secure ?? '?'}/hr  ${g?.memory ?? '?'} GB  stock: ${stock}  dcs: ${(g?.dataCenters || []).filter((d) => d.availability && d.availability !== 'NONE').map((d) => d.id).join(',')}`);
}
if (CALIB && !Number.isFinite(GPU_GEN_SECS[CALIB])) { console.error(`--calib ${CALIB}: not in GPU_GEN_SECS, nothing to check against`); process.exit(2); }
// --plan ends by falling off the module, not process.exit: exiting while fetch sockets close
// trips a libuv "Assertion failed: UV_HANDLE_CLOSING" on Windows.
if (!PLAN) await run();

async function run() {
    const HF_TOKEN = secret('HF_TOKEN', 'HF_TOKEN_FILE', /(hf_[A-Za-z0-9]+)/);
    await signedKleinUrl(HF_TOKEN);   // fail before renting anything
    const capWatch = setInterval(() => { if (spentNow() > CAP && !capHit) { capHit = true; killAll(`spend $${spentNow().toFixed(2)} > cap $${CAP}`); } }, 10e3);

    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    const results = [];
    const record = (r) => { results.push(r); fs.appendFileSync(OUT, JSON.stringify(r) + '\n'); };
    let go = true;
    if (CALIB) {
        const c = await bench(CALIB, HF_TOKEN);
        record(c);
        const want = GPU_GEN_SECS[CALIB];
        go = !c.error && Math.abs(c.secs - want) / want <= CALIB_TOLERANCE;
        log(`calibration ${CALIB}: ${c.error || `${c.secs} s vs table ${want} s`} -> ${go ? 'PASS' : 'FAIL, not running the rest'}`);
    }
    if (go) for (const r of await Promise.all(CARDS.map((c) => bench(c, HF_TOKEN)))) record(r);
    clearInterval(capWatch);
    log(`DONE. spend ~$${spentNow().toFixed(3)} (rate x wall time, Pods only). Results appended to ${OUT}`);
    for (const r of results) log(r.card.padEnd(44), r.error ? `ERROR ${r.error}` : `${r.secs} s/img  (cached prompt ${r.secsCachedPrompt})`);
}
