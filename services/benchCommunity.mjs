/**
 * services/benchCommunity.mjs - the community agent benchmark, app side (MPI-965).
 *
 * A user's "Benchmark this model" run can be shared anonymously, and the app reads back what
 * everyone's runs came to. The service is a Cloudflare Worker (mpi-ci/cubric-bench); this file and
 * that one build against ONE contract, v1, so a field here is a field there.
 *
 *   POST {base}/v1/runs    { v: 1, preset, model, suite, results: [{ id, pass }], perChat, app,
 *                            secPerCase, gpu?: { name, vramGb } }  ->  201 | 400 | 429 | 413
 *   GET  {base}/v1/scores?suite=<hash>  ->  { suite, models: [{ preset, model, runs, passed, cases, perChat }] }
 *
 * WHAT LEAVES THE MACHINE is exactly that record. Never a prompt, a reply, a key, a path or a case's
 * `failures` text (the model chooses that text: it can carry a path or an id). `preset` is one of four
 * ids (SHARE_PRESETS): profile ids beyond the five presets exist (a custom endpoint is any name the
 * user typed, and may be a URL), so the list ALLOWS four, it never denies "custom".
 *
 * Called from the SERVER only (agentSessions uploads, routes/llm.js reads): the run outlives the
 * Settings panel, and the renderer would need CORS. `CUBRIC_BENCH_URL` overrides the base (the test
 * seam, like CUBRIC_OPENAI_BASE_URL); `off` disables both calls, with no network at all.
 */

import { createRequire } from 'node:module';
import { APP_VERSION } from '../js/core/appVersion.js';

const BENCH_URL = 'https://bench.cubric.studio';
const BENCH_URL_ENV = 'CUBRIC_BENCH_URL';

/** The provider presets whose runs are shared and shown. Their scores read against each other; a custom endpoint's do not. */
export const SHARE_PRESETS = Object.freeze(['deepinfra', 'openrouter', 'openai', 'ollama']);

/** A score is shown only from this many runs (the service enforces it; the app re-checks what it is told). */
const MIN_RUNS = 3;
const SCORES_TTL_MS = 24 * 3600_000;
const FAILURE_TTL_MS = 10 * 60_000;
const SCORES_TIMEOUT_MS = 3000;
const SHARE_TIMEOUT_MS = 8000;

/** The service's base URL with no trailing slash, or null when `CUBRIC_BENCH_URL=off`. */
export function benchBase() {
    const base = process.env[BENCH_URL_ENV] || BENCH_URL;
    return base === 'off' ? null : base.replace(/\/+$/, '');
}

/**
 * Did the CONNECTION fail during this run, rather than the model? `runCase` turns a crash or an endpoint
 * error (a 402, a rate limit, a host that went away) into a failure line, so a dead connection reads as a
 * whole run of fails. Such a run is neither shared nor kept. STEP_LIMIT is the exception: it is the model
 * looping until the loop's cap stopped it, which is a weak model's real score.
 * @param {Array<{failures: string[]}>} results  `runSuite`'s per-case results
 */
export function runErrored(results) {
    return results.some((r) => r.failures.some((f) => /^(?:agent:error (?!STEP_LIMIT:)|crashed:)/.test(f)));
}

/** The median of a list of seconds (a local model's first case carries its load time, so not the mean), 0 for none. */
export function medianSeconds(list) {
    if (!list.length) return 0;
    const sorted = [...list].sort((a, b) => a - b);
    const mid = sorted.length >> 1;
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * The record of contract v1, and nothing else. `results` is `runSuite`'s per-case results: only each
 * case's id and pass/fail go in. `gpu` rides along for Ollama only (the local model's own card).
 */
export function buildRecord({ preset, model, suite, results, perChat, secPerCase, gpu = null }) {
    const record = {
        v: 1,
        preset,
        model,
        suite,
        results: results.map((r) => ({ id: r.id, pass: !!r.passed })),
        perChat,
        app: APP_VERSION,
        secPerCase: Number.isFinite(secPerCase) ? Math.min(3600, Math.max(0, Math.round(secPerCase * 10) / 10)) : 0,
    };
    if (preset === 'ollama' && gpu) record.gpu = { name: String(gpu.name).slice(0, 80), vramGb: gpu.vramGb };
    return record;
}

/**
 * This PC's card as `{ name, vramGb }`, or null when it cannot be read (the record then has no gpu, which
 * the service accepts). The detection and the nvidia-smi read are the ones /system/stats already makes,
 * both CJS route modules, so they load the way agentBench.mjs loads its own.
 */
export async function localGpu() {
    try {
        const require = createRequire(import.meta.url);
        const { resolveDownloadConfig } = require('../routes/platformEngine');
        const { getVramStats } = require('../routes/system');
        const [cfg, vram] = await Promise.all([resolveDownloadConfig(), getVramStats()]);
        const name = cfg?.gpu?.name;
        if (typeof name !== 'string' || !name) return null;
        // nvidia-smi reports MiB; 0 = no NVIDIA card to read it from.
        return { name: name.slice(0, 80), vramGb: Math.min(512, Math.round((vram?.total || 0) / 1024)) };
    } catch {
        return null;
    }
}

/**
 * Send one run. Never throws: `{ ok: true }` or `{ ok: false, error }`, where `error` reads as the end of
 * "not shared: ...". No retry queue: a run that did not go is simply not shared.
 */
export async function shareRun(record) {
    const base = benchBase();
    if (!base) return { ok: false, error: 'sharing is switched off' };
    try {
        const res = await fetch(`${base}/v1/runs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(record),
            signal: AbortSignal.timeout(SHARE_TIMEOUT_MS),
        });
        if (res.ok) return { ok: true };
        if (res.status === 429) return { ok: false, error: 'the daily limit was reached, try again tomorrow' };
        const detail = await res.json().then((b) => (typeof b?.error === 'string' ? `: ${b.error.slice(0, 120)}` : ''), () => '');
        return { ok: false, error: `the service turned it down (${res.status}${detail})` };
    } catch {
        return { ok: false, error: `could not reach ${new URL(base).host}` };
    }
}

/** Only rows this app can show: a known preset, a model id, >= 3 runs, a score inside its cases, a cost or null. */
function cleanScores(body, suite) {
    if (body?.suite !== suite || !Array.isArray(body.models)) return null;
    const models = [];
    for (const m of body.models) {
        if (!m || !SHARE_PRESETS.includes(m.preset) || typeof m.model !== 'string' || !m.model) continue;
        const { runs, passed, cases } = m;
        const perChat = m.perChat ?? null;
        if (!Number.isInteger(runs) || runs < MIN_RUNS) continue;
        if (!Number.isInteger(cases) || cases < 1 || !Number.isInteger(passed) || passed < 0 || passed > cases) continue;
        if (perChat !== null && !(typeof perChat === 'number' && Number.isFinite(perChat) && perChat >= 0)) continue;
        models.push({ preset: m.preset, model: m.model, runs, passed, cases, perChat });
    }
    return { suite, models };
}

/** `${base}|${suite}` -> { until, value }: an answer for a day, a failure for ten minutes. */
const _scores = new Map();

/** Test seam: forget every remembered answer. */
export function resetCommunityCache() {
    _scores.clear();
}

/**
 * What everyone's runs came to on this suite, or null on ANY failure (off, offline, a slow host past 3 s,
 * a bad answer). The Remote panel waits on this through the models route, so a failure is remembered
 * for ten minutes and never retried on every panel open. Public data: no key, no user id is sent.
 * @param {string} suite  the 12-hex suite hash
 */
export async function communityScores(suite) {
    const base = benchBase();
    if (!base || typeof suite !== 'string' || !/^[0-9a-f]{12}$/.test(suite)) return null;
    const key = `${base}|${suite}`;
    const hit = _scores.get(key);
    if (hit && hit.until > Date.now()) return hit.value;
    let value = null;
    try {
        const res = await fetch(`${base}/v1/scores?suite=${suite}`, { signal: AbortSignal.timeout(SCORES_TIMEOUT_MS) });
        value = res.ok ? cleanScores(await res.json(), suite) : null;
    } catch {
        value = null;
    }
    _scores.set(key, { until: Date.now() + (value ? SCORES_TTL_MS : FAILURE_TTL_MS), value });
    return value;
}

/**
 * The connection's model rows, each with a `communityTest` ({ passed, cases, runs, perChat, suiteHash })
 * where the community has a score for THAT preset and THAT exact model id on the tests this app ships.
 * The rows exactly as they were when there is nothing to add: offline, off, or a connection that is not
 * one of the four presets never even asks.
 */
export async function withCommunity(profileId, models) {
    if (!benchBase() || !SHARE_PRESETS.includes(profileId)) return models;
    const { suiteHash } = await import('./agentBench.mjs');
    const suite = suiteHash();
    const scores = await communityScores(suite);
    if (!scores?.models.length) return models;
    const mine = new Map(scores.models.filter((m) => m.preset === profileId).map((m) => [m.model, m]));
    return models.map((m) => {
        const c = mine.get(m.id);
        return c ? { ...m, communityTest: { passed: c.passed, cases: c.cases, runs: c.runs, perChat: c.perChat, suiteHash: suite } } : m;
    });
}
