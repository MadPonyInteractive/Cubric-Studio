#!/usr/bin/env node
/**
 * agent-test.mjs — the in-app agent's scripted harness (MPI-774, brief § Testing).
 *
 * The REAL loop and the REAL model (the deepinfra preset's recommended agent model, key from
 * DEEPINFRA_API_KEY) against FAKE tools: no app, no GPU, no generation. The cases, the fake
 * tools and the fixtures live in services/agentBench.mjs, which the app ships for Settings'
 * "Benchmark this model" (MPI-941 Phase 12); this file is the CLI over them.
 *
 * Graded by exact assertions on the calls the MODEL made (the loop's history), never by a judge.
 * Each case runs --runs times (default 3) and passes only when every run passes: one green is a
 * luck pass. --bite runs each case once with its `flip` and expects it to FAIL, which is the proof
 * that an assertion can see the failure it names.
 *
 *   npm run agent:test                        # every case, 3 runs each
 *   npm run agent:test -- --case ask-first    # one case (repeatable)
 *   npm run agent:test -- --bite              # every flip, 1 run each, all must fail
 *   npm run agent:test -- --runs 1 --model <id>
 *   npm run agent:test -- --samples <file.md>  # the prompt-quality sample, for a human to read
 *   npm run agent:test -- --vision --model <id>  # the real-picture cases only a seeing model passes (MPI-1208)
 *   npm run agent:test -- --preset ollama --model <tag>  # a LOCAL model through the real Ollama
 *                                             # engine (MPI-912): no key, no cost; hold the GPU lease
 *
 * Cost per run is the provider's own `usage` times DeepInfra's live price for the model
 * (cached prompt tokens are priced as fresh input, so it errs high). Exit 1 on any failure.
 */
import fs from 'node:fs';
import path from 'node:path';
import { DeepInfraEngine, OllamaEngine, fetchDeepInfraPrices, recommendedModel } from '../services/llmEngines.mjs';
import { CASES, calledAll, converse, runCase } from '../services/agentBench.mjs';
import { MODELS as MODEL_DEFS } from '../js/data/modelConstants/models.js';
import { resolveRecipe } from '../js/data/recipes/registry.js';
import { DEFAULT_STYLE } from '../js/data/recipes/styles.js';
import { runChecks } from './recipe-test.mjs';

const DI_URL = 'https://api.deepinfra.com/v1/openai';

// ── Running one conversation ──────────────────────────────────────────────────

const usage = { calls: 0, prompt: 0, completion: 0 };
// The preset the loop runs on: 'deepinfra' (default) or 'ollama' (--preset, MPI-912).
// The loop picks the engine from it (`chatEngineFor`), so both engines are counted.
let PRESET = 'deepinfra';
const PROFILES = {
    deepinfra: { id: 'deepinfra', name: 'DeepInfra', baseURL: DI_URL },
    ollama: { id: 'ollama', name: 'Ollama', baseURL: 'http://localhost:11434/v1' },
};
for (const Engine of [DeepInfraEngine, OllamaEngine]) {
    const realChat = Engine.prototype.chat;
    Engine.prototype.chat = async function chat(req) {
        const r = await realChat.call(this, req);
        usage.calls += 1;
        usage.prompt += r.usage?.prompt_tokens || 0;
        usage.completion += r.usage?.completion_tokens || 0;
        return r;
    };
}


/** What `converse` needs to reach the model: the preset's endpoint and the key. */
const reach = (model, key) => ({
    loopOptions: { resolveEndpoint: async () => ({ profile: PROFILES[PRESET], key }) },
    profileId: PRESET,
    model,
});

// ── Vision cases (--vision, MPI-1208) ─────────────────────────────────────────
// Cases only a model that SEES can pass, on real pictures, so they live here and never in the
// shipped suite (a user's Settings bench has no such files, and its suiteHash must not move).
// The pictures are Fabio's live 9:16 case (project test_ce77a5fb: edit_002, edit_005, and
// i2i_002 with heavy grain laid over), kept in the gitignored media-for-testing/agent-bench/.
// The look fixture says what a describer says: both women read the same in words.

const PICS = path.resolve('media-for-testing/agent-bench');
// Camera-roll names on purpose: the name must not answer the question.
const pic = (id, file, name) => ({ id, name, filePath: path.join(PICS, file) });
const WOMAN_A = pic('att_woman_a', 'woman-a.png', 'IMG_2201.PNG');
const WOMAN_B = pic('att_woman_b', 'woman-b.png', 'IMG_2214.PNG');
const GRAIN = pic('att_grain', 'grainy.jpg', 'IMG_2230.JPG');
const said = (text) => ({ ok: true, output: { text } });
const looks = (...calls) => calls.filter((c) => c.tool === 'look');
const allCalls = (run) => run.turns.flatMap((t) => t.calls);

const VISION_CASES = [
    {
        id: 'see-identity-drift',
        title: 'asked whether an edit kept the person, it sees both pictures and finds the face changed',
        setup: {
            attachments: [WOMAN_A, WOMAN_B],
            look: {
                [WOMAN_A.filePath]: said('A young woman with long straight purple hair and blunt bangs, in a white sleeveless top with black and teal trim, in a bright futuristic white corridor with ceiling light panels, one hand reaching toward the camera.'),
                [WOMAN_B.filePath]: said('A young woman with long straight purple hair and blunt bangs, smiling, hands on hips, in a white and grey sleeveless top, a black pencil skirt and fishnet tights, in a bright white corridor with ceiling light panels.'),
            },
            turns: ['Picture 2 is an edit of picture 1. Is it still the same woman?'],
        },
        check(run) {
            const f = [];
            if (!looks(...allCalls(run)).some((c) => c.args?.see)) f.push('never asked to see a picture: judged identity from descriptions');
            // "Yes, same woman ... rather than a different person" must not pass on its last words.
            if (/^\W*yes\b/i.test(run.lastReply) || !/not (quite |exactly )?the same|isn.?t (quite )?the same|different (person|woman|face)|face (has )?changed|doesn.?t (look|match)|drift|no longer/i.test(run.lastReply)) f.push(`did not say the face changed: ${run.lastReply.slice(0, 200)}`);
            return f;
        },
    },
    {
        id: 'see-grain-only',
        title: 'a picture given for its grain puts the grain in the prompt and nothing else from it (MPI-1164)',
        setup: {
            attachments: [GRAIN],
            look: said('A smiling young woman with long purple hair and bangs in a white sleeveless top with grey trim, reaching toward the camera in a bright white futuristic corridor with ceiling light panels and blue light strips. Heavy colour film grain over the whole image.'),
            turns: ['Make a picture of a lighthouse at dusk with the same grain as this photo.'],
        },
        check(run) {
            const g = calledAll(run, 'generate').find((c) => c.result?.ok)?.args;
            if (!g) return ['no generate went through'];
            const p = g.prompt || '';
            const f = [];
            if (!/grain/i.test(p)) f.push(`the grain is not in the prompt: ${p.slice(0, 160)}`);
            if (/purple|corridor|hallway|woman|girl|bangs|light strip/i.test(p)) f.push(`the photo's content leaked into the prompt: ${p.slice(0, 200)}`);
            if (!/lighthouse/i.test(p)) f.push('the lighthouse is missing');
            return f;
        },
    },
    {
        id: 'see-not-for-a-plain-description',
        title: 'asked what a picture shows, it reads the description and does not spend a picture',
        setup: {
            attachments: [WOMAN_A],
            look: said('A young woman with long straight purple hair and blunt bangs, in a white sleeveless top with black and teal trim, in a bright futuristic white corridor with ceiling light panels.'),
            turns: ['What is in this picture?'],
        },
        check(run) {
            const l = looks(...allCalls(run));
            if (!l.length) return ['never looked'];
            return l.some((c) => c.args?.see) ? ['spent a picture on a plain description'] : [];
        },
    },
];

// ── Prompt-quality sample (--samples <file>) ──────────────────────────────────
// The prompts the agent writes, for Fabio to read, each put through the enhancer
// recipe's own mechanical checks (word budget, placeholders, preambles, bans) for the
// model it picked. The checks gate nothing here: the file is the deliverable.

const SAMPLE_REQUESTS = [
    'Make an image of an old fisherman mending a net on a foggy pier.',
    'Make an anime-style image of a girl on a rooftop at night, city lights behind her.',
    'Make a product shot of a glass perfume bottle on wet black stone.',
    'Make a 5 second video of a hummingbird hovering at a red flower.',
    'Make a 5 second video of a street market in the rain at dusk.',
];

async function writeSamples(file, { model, key }) {
    const out = [
        '# Agent prompt samples (MPI-774)',
        '',
        `Written by \`npm run agent:test -- --samples\` on ${new Date().toISOString().slice(0, 10)} with ${model}, Auto mode, the fixture model list.`,
        'Each prompt is the one the agent sent to `generate`, checked against the enhancer recipe of the model it picked (`scripts/recipe-test.mjs` `runChecks`).',
        '',
    ];
    for (const request of SAMPLE_REQUESTS) {
        const run = await converse({ turns: [request] }, reach(model, key));
        const g = calledAll(run, 'generate').find((c) => c.result?.ok)?.args;
        out.push(`## ${request}`, '');
        if (!g) {
            out.push(`No generate went through. Reply: ${run.lastReply.replace(/\s+/g, ' ')}`, '');
            continue;
        }
        const def = MODEL_DEFS.find((d) => d.id === g.modelId);
        const recipe = resolveRecipe(def?.enhanceRecipe ?? def?.type);
        const mode = /i2v/.test(g.operation) ? 'i2v' : /ref2v/.test(g.operation) ? 'r2v' : 't2v';
        const recipeMode = recipe?.modes?.[mode];
        const settings = ['ratio', 'qualityTier', 'turbo', 'styleSelect'].filter((k) => g[k] !== undefined).map((k) => `${k} ${JSON.stringify(g[k])}`);
        out.push(`**${g.modelId} / ${g.operation}**${settings.length ? ` · ${settings.join(' · ')}` : ''} · recipe \`${recipe?.modelId ?? 'none'}\` (${mode})`, '');
        out.push('```text', g.prompt || '(no prompt)', '```', '');
        if (g.negative) out.push('Negative:', '', '```text', g.negative, '```', '');
        if (!recipeMode) {
            out.push(`No \`${mode}\` mode on that recipe, so no checks.`, '');
            continue;
        }
        const checks = runChecks('agent', request, g.prompt || '', recipeMode, DEFAULT_STYLE, false);
        const failed = checks.filter((c) => !c.ok);
        out.push(`Checks: **${checks.length - failed.length}/${checks.length} pass**`, '');
        for (const c of checks) out.push(`- ${c.ok ? 'pass' : '**FAIL**'} ${c.name}: ${c.detail}`);
        out.push('');
    }
    fs.writeFileSync(file, out.join('\n'));
    console.log(`samples written to ${file}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
    const o = { runs: 3, cases: [], bite: false, model: '', verbose: false, samples: '', preset: 'deepinfra' };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--runs') o.runs = Number(argv[++i]);
        else if (a === '--case') o.cases.push(argv[++i]);
        else if (a === '--model') o.model = argv[++i];
        else if (a === '--bite') o.bite = true;
        else if (a === '--verbose') o.verbose = true;
        else if (a === '--samples') o.samples = argv[++i];
        else if (a === '--preset') o.preset = argv[++i];
        else if (a === '--vision') o.vision = true;
        else throw new Error(`Unknown argument: ${a}`);
    }
    return o;
}

async function main() {
    const opts = parseArgs(process.argv.slice(2));
    if (!PROFILES[opts.preset]) throw new Error(`Unknown --preset ${opts.preset}: ${Object.keys(PROFILES).join(' | ')}`);
    PRESET = opts.preset;
    const local = PRESET === 'ollama';
    const key = local ? null : process.env.DEEPINFRA_API_KEY;
    if (!key && !local) {
        console.error('DEEPINFRA_API_KEY is not set: this harness talks to the real model.');
        process.exit(2);
    }
    const model = opts.model || recommendedModel(PRESET, 'agent');
    if (!model) {
        console.error(`No recommended agent model on ${PRESET}: pass --model <id>.`);
        process.exit(2);
    }
    const price = local ? null : (await fetchDeepInfraPrices())?.[model] || null;
    if (opts.samples) {
        await writeSamples(path.resolve(opts.samples), { model, key });
        const cost = price ? (usage.prompt * price.in + usage.completion * price.out) / 1e6 : 0;
        console.log(`cost: $${cost.toFixed(4)} for ${SAMPLE_REQUESTS.length} conversations`);
        return;
    }
    const pool = [...CASES, ...VISION_CASES];
    const cases = opts.cases.length ? pool.filter((c) => opts.cases.includes(c.id)) : opts.vision ? VISION_CASES : CASES;
    if (!cases.length) throw new Error(`No case matches ${opts.cases.join(', ')}. Cases: ${pool.map((c) => c.id).join(', ')}`);
    const missing = cases.some((c) => VISION_CASES.includes(c)) ? [WOMAN_A, WOMAN_B, GRAIN].filter((a) => !fs.existsSync(a.filePath)) : [];
    if (missing.length) throw new Error(`The vision cases need their pictures (gitignored): ${missing.map((a) => a.filePath).join(', ')}`);
    const runs = opts.bite ? 1 : opts.runs;

    console.log(`agent-test: ${model} · ${cases.length} case(s) × ${runs} ${opts.bite ? '(BITE: every run must FAIL)' : ''}`);
    console.log(price ? `price: $${price.in}/M in, $${price.out}/M out` : 'price: unknown (cost not computed)');

    const summary = [];
    let totalCost = 0;
    let totalBilled = 0; // DeepInfra's own estimated_cost: cache-aware, so the real bill
    let totalSeen = 0;
    for (const c of cases) {
        let good = 0;
        for (let r = 1; r <= runs; r++) {
            const before = { ...usage };
            const started = Date.now();
            const { run, failures } = await runCase(c, reach(model, key), { bite: opts.bite });
            const u = { calls: usage.calls - before.calls, prompt: usage.prompt - before.prompt, completion: usage.completion - before.completion };
            const cost = price ? (u.prompt * price.in + u.completion * price.out) / 1e6 : 0;
            totalCost += cost;
            totalBilled += run?.costUsd || 0;
            // MPI-1208: pictures the model asked to see itself (a vision model's look with see: true).
            const seen = (run?.turns || []).flatMap((t) => t.calls).filter((x) => x.tool === 'look' && x.args?.see && /picture follows/.test(x.result?.output?.text || '')).length;
            totalSeen += seen;
            const passed = failures.length === 0;
            const ok = opts.bite ? !passed : passed;
            if (ok) good++;
            const verdict = opts.bite ? (passed ? 'DID NOT BITE' : 'bites') : (passed ? 'pass' : 'FAIL');
            console.log(`  ${c.id} #${r}: ${verdict} · ${u.calls} calls · ${seen ? `${seen} seen · ` : ''}${u.prompt} in / ${u.completion} out · $${cost.toFixed(5)} · ${((Date.now() - started) / 1000).toFixed(1)}s`);
            for (const f of failures) console.log(`      - ${f}`);
            if (run && (opts.verbose || !ok)) {
                for (const [i, t] of run.turns.entries()) {
                    console.log(`      turn ${i} calls: ${t.calls.map((x) => `${x.tool}(${JSON.stringify(x.args)})`).join(' ') || 'none'}`);
                    console.log(`      turn ${i} reply: ${t.reply.replace(/\s+/g, ' ').slice(0, 400)}`);
                }
            }
        }
        summary.push({ id: c.id, title: c.title, good, runs });
    }

    console.log('\nsummary');
    for (const s of summary) console.log(`  ${s.good === s.runs ? 'OK  ' : 'FAIL'} ${s.id} ${s.good}/${s.runs} — ${s.title}`);
    const conversations = summary.reduce((n, s) => n + s.runs, 0);
    console.log(`cost: $${totalCost.toFixed(4)} for ${conversations} conversations ($${(totalCost / conversations).toFixed(5)} each, cached priced as fresh) · billed $${totalBilled.toFixed(4)} · ${totalSeen} picture(s) seen`);
    process.exit(summary.every((s) => s.good === s.runs) ? 0 : 1);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
