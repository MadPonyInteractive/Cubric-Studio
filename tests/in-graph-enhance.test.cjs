'use strict';

// MPI-1002 gap 2 — the in-graph enhancer obeys the Remote pick.
// Run: node --test tests/in-graph-enhance.test.cjs
//
// Four graphs (klein_t2i, klein_9b_t2i, krea2_t2i_sfw, krea2_t2i_nsfw) carry a TextGenerate
// behind an `Input_enhance_prompt` MpiIfElse. It bakes FALSE and nothing in the app sets it
// any more (MPI-677 step 1b deleted the toggle), so the ONE door is a raw `injectionParams`
// body on POST /connector/generate. `settleInGraphEnhance` (llmService) guards it, called once
// by commandExecutor.runCommand just before the engine params are built — the point the local
// engine and the Pod share. Fabio: with a non-ComfyUI enhancer picked, ComfyUI must never do
// the enhancing.
//
// Four things are pinned:
//   1. The matrix: flag spelling x pick {comfy, endpoint, ollama} x op {t2i, kleinEdit (exempt)}.
//      Exactly the calls expected — and with no TRUE flag, no call of any kind.
//   2. The real path: one /llm/enhance POST to the picked backend carrying the model's recipe.
//   3. A failed enhancer throws the typed error the executor turns into a stopped job.
//   4. Wiring and a scan: the guard is called once before `_buildParams`, never reaches the
//      ComfyUI queue, and no other file in the app assigns the flag.

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const _ls = {};
global.localStorage = {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(_ls, k) ? _ls[k] : null),
    setItem: (k, v) => { _ls[k] = String(v); },
    removeItem: (k) => { delete _ls[k]; },
};

const ROOT = path.join(__dirname, '..');
const { settleInGraphEnhance, setBackendPreference } = require('../js/services/llmService.js');
const { composeSystemPrompt } = require('../js/data/recipes/styles.js');
const { getRecipe } = require('../js/data/recipes/registry.js');

const PICKS = ['comfy', 'endpoint', 'ollama'];
const OPS = [{ op: 't2i', exempt: false }, { op: 'kleinEdit', exempt: true }];

// Every spelling that reaches the node: the canonical key, a wrongly cased one, the bare
// name `canonicalizeInjectionKeys` renames to it, the `Title.widget` form, and the string
// `comfyController` also reads as true. `on: false` cells must leave the payload alone.
const FLAGS = [
    { name: 'absent',                 inj: {},                                     on: false },
    { name: 'false',                  inj: { Input_enhance_prompt: false },        on: false },
    { name: 'string "false"',         inj: { Input_enhance_prompt: 'false' },      on: false },
    { name: 'true',                   inj: { Input_enhance_prompt: true },         on: true },
    { name: 'TRUE-cased key',         inj: { INPUT_ENHANCE_PROMPT: true },         on: true },
    { name: 'Input_Enhance_Prompt',   inj: { Input_Enhance_Prompt: true },         on: true },
    { name: 'bare enhance_prompt',    inj: { enhance_prompt: true },               on: true },
    { name: 'dotted widget key',      inj: { 'Input_enhance_prompt.boolean': true }, on: true },
    { name: 'string "true"',          inj: { Input_enhance_prompt: 'true' },       on: true },
];

function payloadFor(op, inj, extra = {}) {
    return {
        operation: op,
        modelId: 'krea2',
        positive: 'a cat on a wall',
        negative: '',
        injectionParams: { Width: 1024, Height: 768, ...inj },
        ...extra,
    };
}

/** A recorder for every seam the guard can touch, plus the global fetch. */
function harness(result = { ok: true, text: 'ENHANCED: a cat on a wall' }) {
    const h = { enhance: [], log: [], fetch: [] };
    h.deps = {
        enhance: async (args) => { h.enhance.push(args); return { backend: args.backend, ...result }; },
        log: (line) => h.log.push(line),
    };
    h.realFetch = global.fetch;
    global.fetch = (...a) => { h.fetch.push(a); return Promise.reject(new Error('the guard must not touch the network here')); };
    h.done = () => { global.fetch = h.realFetch; };
    return h;
}

const flagKeys = (inj) => Object.keys(inj).filter((k) => /^(?:input_)?enhance_prompt(?:\..+)?$/i.test(k));

for (const flag of FLAGS) {
    for (const { op, exempt } of OPS) {
        for (const pick of PICKS) {
            test(`matrix: flag ${flag.name} | pick ${pick} | op ${op}`, async () => {
                setBackendPreference(pick);
                const h = harness();
                try {
                    const payload = payloadFor(op, flag.inj);
                    const before = JSON.stringify(payload);
                    const out = await settleInGraphEnhance(payload, h.deps);

                    assert.strictEqual(JSON.stringify(payload), before, 'the caller\'s payload must never be mutated');
                    assert.strictEqual(h.fetch.length, 0, 'no network call from the guard itself');
                    assert.strictEqual(h.enhance.filter((c) => c.backend === 'comfy').length, 0,
                        'enhance() must never be asked for ComfyUI from here');

                    if (!flag.on) {
                        // No TRUE flag: the same object and nothing else happened.
                        assert.strictEqual(out, payload, 'no true flag -> the very same payload');
                        assert.strictEqual(h.enhance.length, 0);
                        assert.strictEqual(h.log.length, 0);
                        return;
                    }
                    if (exempt) {
                        // An edit takes an instruction: no enhancement from anyone, flag forced off.
                        assert.strictEqual(h.enhance.length, 0, 'an exempt op enhances nothing');
                        assert.strictEqual(out.positive, payload.positive);
                        for (const k of flagKeys(payload.injectionParams)) assert.strictEqual(out.injectionParams[k], false, `${k} forced off`);
                        assert.strictEqual(out.injectionParams.Width, 1024, 'other params untouched');
                        return;
                    }
                    if (pick === 'comfy') {
                        // The graph's own enhancer is what the user picked: leave it on.
                        assert.strictEqual(out, payload, 'ComfyUI picked -> the graph\'s enhancer stays as asked');
                        assert.strictEqual(h.enhance.length, 0, 'ComfyUI picked -> no server enhance');
                        return;
                    }
                    // A server pick: ONE enhance on that backend, the model's own recipe, the flag off.
                    assert.strictEqual(h.enhance.length, 1, 'exactly one enhance call');
                    assert.strictEqual(h.enhance[0].backend, pick);
                    assert.strictEqual(h.enhance[0].prompt, 'a cat on a wall');
                    assert.strictEqual(h.enhance[0].model?.id, 'krea2', 'the enhance is shaped for the running model');
                    assert.strictEqual(out.positive, 'ENHANCED: a cat on a wall');
                    for (const k of flagKeys(payload.injectionParams)) assert.strictEqual(out.injectionParams[k], false, `${k} forced off`);
                    assert.strictEqual(out.injectionParams.Width, 1024, 'other params untouched');
                    assert.strictEqual(out.negative, '', 'a recipe with no negative leaves the negative alone');
                    assert.strictEqual(h.log.length, 1, 'one log line');
                    assert.ok(h.log[0].includes(pick), `the log names the backend: ${h.log[0]}`);
                } finally {
                    h.done();
                    delete _ls['cubric.llm.backend'];
                }
            });
        }
    }
}

test('the flag is judged by value: false, "false" and absent never reach the picker or the model registry', async () => {
    setBackendPreference('ollama');
    const h = harness();
    try {
        const odd = [
            { Input_enhance_prompt: 0 }, { Input_enhance_prompt: 'TRUE' }, { Input_enhance_prompt: 1 },
            { Input_enhance_prompt: null }, { Input_enhance_prompt: undefined }, { Enhance_Prompt_Strength: true },
        ];
        for (const inj of odd) {
            const payload = payloadFor('t2i', inj);
            // comfyController writes a boolean widget as `val === true || val === 'true'`; so does the guard.
            assert.strictEqual(await settleInGraphEnhance(payload, h.deps), payload, JSON.stringify(inj));
        }
        assert.strictEqual(h.enhance.length, 0);
        assert.strictEqual(h.fetch.length, 0);
        assert.strictEqual(await settleInGraphEnhance({ operation: 't2i' }, h.deps).then((p) => p.operation), 't2i', 'no injectionParams at all');
        assert.strictEqual(await settleInGraphEnhance(undefined, h.deps), undefined, 'no payload at all');
    } finally {
        h.done();
        delete _ls['cubric.llm.backend'];
    }
});

test('no pick at all is ComfyUI: the graph\'s enhancer stays on', async () => {
    const h = harness();
    try {
        const payload = payloadFor('t2i', { Input_enhance_prompt: true });
        assert.strictEqual(await settleInGraphEnhance(payload, h.deps), payload);
        assert.strictEqual(h.enhance.length, 0);
    } finally {
        h.done();
    }
});

test('an empty prompt has nothing to enhance: flag off, no enhancer call', async () => {
    setBackendPreference('endpoint');
    const h = harness();
    try {
        const out = await settleInGraphEnhance(payloadFor('t2i', { Input_enhance_prompt: true }, { positive: '   ' }), h.deps);
        assert.strictEqual(out.injectionParams.Input_enhance_prompt, false);
        assert.strictEqual(h.enhance.length, 0);
    } finally {
        h.done();
        delete _ls['cubric.llm.backend'];
    }
});

test('an exact Input_Positive / Input_Negative override is the prompt the graph gets, so it is the one enhanced', async () => {
    setBackendPreference('endpoint');
    const h = harness({ ok: true, text: 'ENHANCED: from the override', negativeText: 'blurry' });
    try {
        const payload = payloadFor('t2i',
            { Input_enhance_prompt: true, Input_Positive: 'from the override', Input_Negative: '' },
            { positive: 'the payload prompt' });
        const out = await settleInGraphEnhance(payload, h.deps);
        assert.strictEqual(h.enhance[0].prompt, 'from the override');
        // `Object.assign(params, injectionParams)` lets this key beat payload.positive, so it must carry the result.
        assert.strictEqual(out.injectionParams.Input_Positive, 'ENHANCED: from the override');
        assert.strictEqual(out.positive, 'ENHANCED: from the override');
        assert.strictEqual(out.injectionParams.Input_Negative, 'blurry', 'an empty overriding negative takes the recipe\'s');
    } finally {
        h.done();
        delete _ls['cubric.llm.backend'];
    }
});

test('a separate-field recipe fills an EMPTY negative and never replaces one the caller wrote', async () => {
    setBackendPreference('ollama');
    const h = harness({ ok: true, text: 'ENHANCED', negativeText: 'extra fingers' });
    try {
        const filled = await settleInGraphEnhance(payloadFor('t2i', { Input_enhance_prompt: true }), h.deps);
        assert.strictEqual(filled.negative, 'extra fingers');
        const kept = await settleInGraphEnhance(payloadFor('t2i', { Input_enhance_prompt: true }, { negative: 'my own' }), h.deps);
        assert.strictEqual(kept.negative, 'my own');
        assert.strictEqual(kept.positive, 'ENHANCED');
    } finally {
        h.done();
        delete _ls['cubric.llm.backend'];
    }
});

// ── the real path: enhance() itself, stubbed only at the network ──────────────

for (const [modelId, recipeId] of [['krea2', 'krea-2'], ['krea2-nsfw', 'krea-2'], ['klein-4b', 'flux-2'], ['klein-9b', 'flux-2']]) {
    for (const pick of ['endpoint', 'ollama']) {
        test(`real path: ${modelId} on ${pick} posts ONE /llm/enhance with the ${recipeId} recipe and never queues a job`, async () => {
            setBackendPreference(pick);
            const realFetch = global.fetch;
            const calls = [];
            global.fetch = (url, init) => {
                calls.push({ url, body: init?.body ? JSON.parse(init.body) : null });
                return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true, text: 'a richly lit cat', backend: pick, model: 'm' }) });
            };
            try {
                const payload = payloadFor('t2i', { Input_enhance_prompt: true }, { modelId });
                const out = await settleInGraphEnhance(payload, { log: () => {} });
                assert.strictEqual(calls.length, 1, `exactly one request, got ${calls.map((c) => c.url)}`);
                assert.strictEqual(calls[0].url, '/llm/enhance', 'no /comfy, no promptEnhance job');
                assert.strictEqual(calls[0].body.backend, pick);
                assert.strictEqual(calls[0].body.prompt, 'a cat on a wall');
                const recipe = getRecipe(recipeId);
                assert.strictEqual(calls[0].body.system, composeSystemPrompt(recipe.modes.t2v), 'the model\'s existing recipe');
                assert.strictEqual(out.positive, 'a richly lit cat');
                assert.strictEqual(out.injectionParams.Input_enhance_prompt, false);
            } finally {
                global.fetch = realFetch;
                delete _ls['cubric.llm.backend'];
            }
        });
    }
}

// ── failure: stop the job, say why, generate nothing ──────────────────────────

test('a failed enhancer throws ENHANCE_FAILED with its own message and the Remote > Language Models hint', async () => {
    setBackendPreference('ollama');
    const h = harness({ ok: false, error: 'Ollama is not running.' });
    try {
        await assert.rejects(
            () => settleInGraphEnhance(payloadFor('t2i', { Input_enhance_prompt: true }), h.deps),
            (err) => {
                assert.strictEqual(err.code, 'ENHANCE_FAILED');
                assert.strictEqual(err.userMessage, err.message);
                assert.ok(err.message.includes('Ollama is not running.'), err.message);
                assert.ok(err.message.includes('Remote > Language Models'), err.message);
                assert.ok(/Nothing was generated/.test(err.message), err.message);
                return true;
            });
        assert.strictEqual(h.log.length, 0, 'a failure logs no success line');
    } finally {
        h.done();
        delete _ls['cubric.llm.backend'];
    }
});

test('the hint is said once when the endpoint\'s own message already carries it', async () => {
    setBackendPreference('endpoint');
    const h = harness({ ok: false, error: 'No API key saved. Check Remote > Language Models.' });
    try {
        await assert.rejects(
            () => settleInGraphEnhance(payloadFor('t2i', { Input_enhance_prompt: true }), h.deps),
            (err) => {
                assert.strictEqual(err.message.split('Language Models').length - 1, 1, err.message);
                assert.ok(err.message.includes('Remote endpoint'), err.message);
                return true;
            });
    } finally {
        h.done();
        delete _ls['cubric.llm.backend'];
    }
});

test('an enhancer that answers with no text is a failure, never a silent un-enhanced run', async () => {
    setBackendPreference('endpoint');
    const h = harness({ ok: true, text: '   ' });
    try {
        await assert.rejects(() => settleInGraphEnhance(payloadFor('t2i', { Input_enhance_prompt: true }), h.deps),
            (err) => err.code === 'ENHANCE_FAILED' && /returned no text/.test(err.message));
    } finally {
        h.done();
        delete _ls['cubric.llm.backend'];
    }
});

test('a failure through the real enhance() (server answers ok:false) stops with the server\'s words', async () => {
    setBackendPreference('endpoint');
    const realFetch = global.fetch;
    global.fetch = (url) => Promise.resolve({
        ok: true,
        json: () => Promise.resolve(url === '/llm/enhance'
            ? { ok: false, error: { code: 'NO_KEY', message: 'No API key saved.' } }
            : {}),
    });
    try {
        await assert.rejects(() => settleInGraphEnhance(payloadFor('t2i', { Input_enhance_prompt: true }), { log: () => {} }),
            (err) => err.code === 'ENHANCE_FAILED' && err.message.includes('No API key saved.') && err.message.includes('Remote > Language Models'));
    } finally {
        global.fetch = realFetch;
        delete _ls['cubric.llm.backend'];
    }
});

// ── wiring and scan ───────────────────────────────────────────────────────────

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/** Code only: block comments gone, line comments gone (a `//` inside a string keeps its colon before it). */
function stripComments(src) {
    return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
}

function walk(dir, out = []) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        if (ent.name === 'node_modules' || ent.name.startsWith('.')) continue;
        const full = path.join(dir, ent.name);
        if (ent.isDirectory()) walk(full, out);
        else if (/\.(?:js|mjs)$/.test(ent.name)) out.push(full);
    }
    return out;
}

test('wiring: runCommand calls the guard exactly once, before _buildParams, and stops the job on its failure', () => {
    const src = read('js/services/commandExecutor.js');
    const calls = [...src.matchAll(/settleInGraphEnhance\(/g)];
    assert.strictEqual(calls.length, 1, 'one call site, for the local engine and the Pod alike');
    const at = src.indexOf('await settleInGraphEnhance(workingPayload)');
    const build = src.indexOf('const params = _buildParams(workingPayload);');
    assert.ok(at > 0 && build > at, 'the guard settles the payload BEFORE the engine params are built from it');
    assert.ok(src.indexOf('export function runCommand') < at, 'inside runCommand');
    // _buildParams is reached only from here, so nothing builds engine params around the guard.
    assert.strictEqual([...src.matchAll(/_buildParams\(/g)].length, 2, 'the definition and the one call');
    const after = src.slice(at, build);
    assert.ok(/ENHANCE_FAILED/.test(after) && /_failBail\(err, \{ reported \}\)/.test(after), 'a failed enhancer goes through _failBail');
    assert.ok(/_abortedBail\(tempTrimInputPaths\)/.test(after), 'a Stop that lands during the enhance is honoured');
    // The single runWorkflow for a model op is reached with the params built above, local or Pod.
    assert.ok(src.indexOf('runWorkflow(workflow, params, onMessage, {') > build);
});

test('the guard never reaches the ComfyUI queue', () => {
    const src = stripComments(read('js/services/llmService.js'));
    const start = src.indexOf('export async function settleInGraphEnhance');
    const end = src.indexOf('export function buildDescribeInjectionParams');
    assert.ok(start > 0 && end > start, 'located the guard');
    const body = src.slice(start, end);
    for (const banned of ['runComfyEnhance', 'enqueueGeneration', 'enhanceFlow', 'generationService']) {
        assert.ok(!body.includes(banned), `settleInGraphEnhance must not touch ${banned} (it would queue behind its own job and deadlock)`);
    }
    assert.ok(/enhance\)\(\{ prompt, model, backend \}\)/.test(body), 'the pick is passed explicitly so enhance() cannot resolve to ComfyUI');
});

test('scan: nothing in the app assigns the in-graph enhancer flag except the guard', () => {
    // The literal occurrences of the name in CODE (comments stripped) are the whole attack
    // surface for "something sets it": a key in an object, an assignment, a computed write.
    // The guard's own regex and the executor's READ of it are the two that may exist.
    const offenders = [];
    const seen = {};
    for (const dir of ['js', 'routes', 'services']) {
        const base = path.join(ROOT, dir);
        if (!fs.existsSync(base)) continue;
        for (const file of walk(base)) {
            const code = stripComments(fs.readFileSync(file, 'utf8'));
            const hits = [...code.matchAll(/.{0,40}enhance_prompt.{0,40}/gi)].map((m) => m[0].trim());
            if (!hits.length) continue;
            const rel = path.relative(ROOT, file).replace(/\\/g, '/');
            seen[rel] = hits;
            if (rel !== 'js/services/llmService.js' && rel !== 'js/services/commandExecutor.js') offenders.push(`${rel}: ${hits.join(' | ')}`);
        }
    }
    assert.deepStrictEqual(offenders, [], `a file other than the guard names the flag in code:\n${offenders.join('\n')}`);
    // llmService: only the guard's key pattern. commandExecutor: only the READ (progress bars).
    assert.strictEqual(seen['js/services/llmService.js'].length, 1, JSON.stringify(seen['js/services/llmService.js']));
    assert.ok(/IN_GRAPH_ENHANCE_KEY\s*=\s*\/\^/.test(seen['js/services/llmService.js'][0]), seen['js/services/llmService.js'][0]);
    assert.strictEqual(seen['js/services/commandExecutor.js'].length, 1, JSON.stringify(seen['js/services/commandExecutor.js']));
    assert.ok(/_paramIsTrue\(params, 'Input_Enhance_Prompt'\)/.test(seen['js/services/commandExecutor.js'][0]), seen['js/services/commandExecutor.js'][0]);
});

test('scan self-check: the scanner would catch an assignment', () => {
    for (const bad of [
        "params.Input_enhance_prompt = true;",
        "const p = { Input_Enhance_Prompt: true };",
        "injectionParams['input_enhance_prompt'] = true;",
    ]) {
        assert.ok(/enhance_prompt/i.test(stripComments(bad)), bad);
    }
    assert.ok(!/enhance_prompt/i.test(stripComments("// Input_enhance_prompt = true\n/* enhance_prompt */")), 'comments are not code');
});

test('the four graphs that carry the enhancer still bake it false (the baked value IS the value when nothing sets it)', () => {
    for (const file of ['klein_t2i', 'klein_9b_t2i', 'krea2_t2i_sfw', 'krea2_t2i_nsfw']) {
        const graph = JSON.parse(read(`comfy_workflows/${file}.json`));
        const nodes = Object.values(graph).filter((n) => /^input_enhance_prompt$/i.test(n?._meta?.title || ''));
        assert.strictEqual(nodes.length, 1, `${file}: one Input_enhance_prompt node`);
        assert.strictEqual(nodes[0].class_type, 'MpiIfElse');
        assert.strictEqual(nodes[0].inputs.boolean, false);
    }
    // And no OTHER shipped graph has a node the guard's key could flip.
    const others = fs.readdirSync(path.join(ROOT, 'comfy_workflows')).filter((f) => f.endsWith('.json')
        && !['klein_t2i.json', 'klein_9b_t2i.json', 'krea2_t2i_sfw.json', 'krea2_t2i_nsfw.json'].includes(f));
    const carrying = others.filter((f) => /"title":\s*"(?:Input_)?enhance_prompt(?:[."])/i.test(read(`comfy_workflows/${f}`)));
    assert.deepStrictEqual(carrying, [], `an unguarded graph carries an enhance_prompt node: ${carrying}`);
});
