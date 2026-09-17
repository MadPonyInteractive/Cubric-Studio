'use strict';

// MPI-677 step 1a — the enhance service.
// Run: node tests/llm-service.test.cjs
// No framework — matches the other tests/*.test.cjs in this repo.
//
// Three things are worth a test here and the rest is plumbing:
//
//  1. **The backend choice, and that it is the USER'S** (MPI-728). The model
//     card no longer reaches it at all: the `-nsfw` route fired on two of the
//     many models that are actually uncensored, and the `comfy -> ollama`
//     downgrade turned an explicit pick into a different backend silently.
//     Both are asserted gone, not left to a default — and with no pick the
//     answer is ComfyUI, because the Automatic entry went too (2026-09-12).
//  2. **The ComfyUI graph overrides.** They are string keys matched against
//     node titles at dispatch time; a typo fails nothing and changes nothing.
//  3. **The DeepInfra key never reaches the renderer.** Asserted by recording
//     the IPC channels `secretsStore.init` actually registers, not by reading
//     the source and hoping.

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Mock localStorage for tests that exercise pref functions.
const _ls = {};
global.localStorage = {
    getItem:    (k) => Object.prototype.hasOwnProperty.call(_ls, k) ? _ls[k] : null,
    setItem:    (k, v) => { _ls[k] = String(v); },
    removeItem: (k) => { delete _ls[k]; },
};

const {
    chooseBackend,
    buildComfyInjectionParams,
    resolveRecipeId,
    resolveMode,
    COMFY_ENHANCE_OVERRIDES,
    enhancerGraphDefaults,
    postProcessLikeGraph,
    unwrapChatMl,
    enhancerClipParams,
    backendPreference,
    setBackendPreference,
    describeBackendPreference,
    setDescribeBackendPreference,
    describeModelPreference,
    setDescribeModelPreference,
    buildDescribeInjectionParams,
    describeImage,
    enhance,
    enhanceFlow,
    setEnhancerModelPreference,
    setEndpointModelPreference,
    withRemoteSettingsHint,
} = require('../js/services/llmService.js');
const { Storage } = require('../js/core/storage.js');
const { FALLBACK_RECIPE_ID } = require('../js/data/recipes/registry.js');

const WORKFLOW = (file) => JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'comfy_workflows', file), 'utf8'));

const ELIGIBLE = { id: 'krea2', capabilities: { promptEnhance: true } };
const PLAIN = { id: 'chroma', capabilities: {} };

// ── Backend choice ───────────────────────────────────────────────────────────

function testComfyIsTheDefault() {
    // Fabio, 2026-09-12: no "Automatic" entry — the RunPod section has none — and
    // with no pick the answer is the engine the app already runs. It used to be
    // the cloud when a key was stored and Ollama otherwise; neither a key nor the
    // model card moves it now, and anything that is not a backend is no pick.
    assert.strictEqual(chooseBackend(), 'comfy');
    assert.strictEqual(chooseBackend({ model: ELIGIBLE }), 'comfy');
    for (const junk of [undefined, null, '', 'auto', 'automatic', 'cloud']) {
        assert.strictEqual(chooseBackend({ override: junk }), 'comfy', `"${junk}" is not a backend`);
    }
}

function testExplicitOverrideWins() {
    // MPI-737 D2: 'deepinfra' stored values migrate to 'endpoint'.
    assert.strictEqual(chooseBackend({ model: PLAIN, override: 'deepinfra' }), 'endpoint');
    assert.strictEqual(chooseBackend({ model: PLAIN, override: 'endpoint' }), 'endpoint');
    assert.strictEqual(chooseBackend({ model: PLAIN, override: 'ollama' }), 'ollama');
    assert.strictEqual(chooseBackend({ model: ELIGIBLE, override: 'comfy' }), 'comfy');
    // An override is honoured on any model, including one the user knows wants
    // shaping a hosted provider would sanitise — they asked for it in as many words.
    assert.strictEqual(chooseBackend({ model: { id: 'sdxl-nsfw' }, override: 'endpoint' }), 'endpoint');
}

function testComfyIsOfferedOnEveryModel() {
    // MPI-728. `chooseBackend` used to answer `ollama` for an explicit `comfy`
    // pick on any model outside four — a silent downgrade to a second runtime
    // that may not even be installed. The standalone enhancer graph carries its
    // own CLIPLoader and was proven on 2026-09-12 to run with NO generation
    // model loaded at all, so the pick is honoured everywhere.
    for (const model of [PLAIN, ELIGIBLE, { id: 'wan-2-2' }, { id: 'sdxl-nsfw' }, undefined]) {
        assert.strictEqual(chooseBackend({ model, override: 'comfy' }), 'comfy');
    }
}

function testTheModelCardNoLongerSteersTheBackend() {
    // The deleted `-nsfw` rule, asserted GONE rather than absent by accident.
    // A LoRA makes any model uncensored, so an id suffix never was the fact it
    // was read as — and only two of Vision's uncensored models carry one.
    for (const id of ['sdxl-nsfw', 'krea2-nsfw', 'klein-lora-nsfw', 'chroma', 'wan-2-2']) {
        for (const override of [undefined, 'deepinfra', 'ollama']) {
            assert.strictEqual(chooseBackend({ model: { id }, override }), chooseBackend({ override }),
                `the id "${id}" changed the backend — the model card must not steer it`);
        }
    }
}

// ── The ComfyUI graph overrides ──────────────────────────────────────────────

function testInjectionParamsCarryTheOverrides() {
    const params = buildComfyInjectionParams('SYSTEM');

    // The four MPI-35 phase 2 overrides, `Replace Text.replace` among them.
    for (const key of Object.keys(COMFY_ENHANCE_OVERRIDES)) {
        assert.ok(key in params, `missing override: ${key}`);
        assert.strictEqual(params[key], COMFY_ENHANCE_OVERRIDES[key]);
    }
    assert.strictEqual(params['Replace Text.replace'], '\n',
        'node 1 strips every newline unless replace is an identity');
    assert.strictEqual(params['Input_Scrub_Negation.regex_pattern'], '(?!)');
    assert.ok(params['Input_Text_Gen.max_length'] > 512, 'the baked 512 truncates a long-budget recipe');

    // Every key must address a real node title, optionally `.widget`.
    const graph = JSON.parse(fs.readFileSync(
        path.join(__dirname, '..', 'comfy_workflows', 'qwen3vl_4b_prompt_enhancer.json'), 'utf8'));
    const titles = new Set(Object.values(graph).map((n) => (n._meta && n._meta.title || '').toLowerCase()));
    for (const key of Object.keys(params)) {
        const dot = key.indexOf('.');
        const title = (dot === -1 ? key : key.slice(0, dot)).toLowerCase();
        assert.ok(titles.has(title), `injection key "${key}" addresses no node in the enhancer graph`);
    }
}

function testSystemPromptIsChatMlWrapped() {
    const params = buildComfyInjectionParams('BE A ROBOT');
    // The graph appends `\n<|im_end|>\n<|im_start|>assistant` after the user
    // text, so this value must open the system turn and close it on `user`.
    assert.ok(params.Input_System_Prompt.startsWith('<|im_start|>system\n'));
    assert.ok(params.Input_System_Prompt.includes('BE A ROBOT'));
    assert.ok(params.Input_System_Prompt.endsWith('<|im_end|>\n<|im_start|>user'));
}

// ── A flow on a server backend carries the graph's pipeline (MPI-677, 2026-09-13) ──

function testGraphDefaultsAreReadOffTheGraph() {
    const d = enhancerGraphDefaults(WORKFLOW('qwen3vl_4b_prompt_enhancer.json'));
    assert.strictEqual(d['Replace Text.find'], '\n');
    assert.strictEqual(d['Replace Text.replace'], '');
    assert.ok(d['Input_Scrub_Negation.regex_pattern'].includes('without'), 'the baked negation scrub');
    assert.strictEqual(d['Input_Tidy.regex_pattern'], ',\\s*(?=,)|[\\s,.]+$');
    assert.strictEqual(d['Input_Text_Gen.max_length'], 512);
    // Character Sheet injects no system prompt: its recipe IS this baked value.
    assert.ok(d.Input_System_Prompt.startsWith('<|im_start|>system\nYou are a character designer'));
}

function testServerTextGetsTheGraphPipeline() {
    const d = enhancerGraphDefaults(WORKFLOW('qwen3vl_4b_prompt_enhancer.json'));
    // Newline out, a CAPITALISED negation clause out (RegexReplace is case-insensitive
    // by default), the doubled comma it leaves collapsed, the closing full stop eaten.
    assert.strictEqual(
        postProcessLikeGraph('a tall man,\nwearing a coat, NO scars on the face, grey hair.', d),
        'a tall man,wearing a coat, grey hair');
    // Music Maker's overrides disable the scrub and narrow the tidy, so an arrangement's
    // "no drums" and a closing full stop survive. The newline strip still runs: Music
    // Maker never overrides it, and its blocks are delimited by markers.
    const music = { ...d, 'Input_Scrub_Negation.regex_pattern': '(?!)', 'Input_Tidy.regex_pattern': '\\s+$' };
    assert.strictEqual(
        postProcessLikeGraph('[MOOD] calm, no drums until the verse.\n[VOCAL] soft. ', music),
        '[MOOD] calm, no drums until the verse.[VOCAL] soft.');
}

function testChatMlUnwrapsToTheBareRecipe() {
    const bare = unwrapChatMl(enhancerGraphDefaults(WORKFLOW('qwen3vl_4b_prompt_enhancer.json')).Input_System_Prompt);
    assert.ok(bare.startsWith('You are a character designer'));
    assert.ok(bare.endsWith('no markdown.'), bare.slice(-40));
    assert.ok(!bare.includes('<|im_'), 'a ChatML marker would reach a chat API');
    // Music Maker's shape: the markers on lines of their own.
    assert.strictEqual(unwrapChatMl('<|im_start|>system\nBE A PRODUCER\n<|im_end|>\n<|im_start|>user'), 'BE A PRODUCER');
}

function testTheEnhancerBorrowsKleinsEncoder() {
    // Fabio, 2026-09-13: on ComfyUI a Klein enhance runs on Klein's own Qwen3, the weight
    // the generation is about to load, instead of loading a second encoder.
    assert.deepStrictEqual(enhancerClipParams(WORKFLOW('klein_9b_t2i.json')),
        { 'Load CLIP.clip_name': 'qwen_3_8b_int8_convrot.safetensors', 'Load CLIP.type': 'flux2' });
    assert.deepStrictEqual(enhancerClipParams(WORKFLOW('klein_t2i.json')),
        { 'Load CLIP.clip_name': 'qwen_3_4b.safetensors', 'Load CLIP.type': 'flux2' });
    // Krea2 already shares the graph's own file, so borrowing it changes nothing.
    assert.strictEqual(enhancerClipParams(WORKFLOW('krea2_t2i_sfw.json'))['Load CLIP.clip_name'],
        'qwen3vl_4b_abliterated_fp8_scaled.safetensors');
    // An encoder TextGenerate raises on is never borrowed, nor a loader the graph cannot take.
    assert.deepStrictEqual(enhancerClipParams(WORKFLOW('wan22_i2v.json')), {}, 'umT5 must never write a prompt');
    assert.deepStrictEqual(enhancerClipParams(WORKFLOW('ltx_i2v_t2v.json')), {}, 'a DualCLIPLoader is not borrowable');

    // Both keys must address a real node AND widget: the injector skips a miss silently.
    const loader = Object.values(WORKFLOW('qwen3vl_4b_prompt_enhancer.json'))
        .find((n) => n._meta && n._meta.title === 'Load CLIP');
    assert.ok(loader && 'clip_name' in loader.inputs && 'type' in loader.inputs, 'enhancer graph lost its Load CLIP');
}

function testEnginesForwardTheTokenCap() {
    // `complete()` used to drop everything but `{ model, system }`, so a flow's cap read
    // as one and was none. `chat()` builds its body before its first await, so a stubbed
    // fetch sees it synchronously.
    const { OllamaEngine, DeepInfraEngine } = require('../services/llmEngines.mjs');
    const bodies = [];
    const realFetch = global.fetch;
    global.fetch = (_url, init) => {
        bodies.push(JSON.parse(init.body));
        return new Promise(() => {});
    };
    try {
        new DeepInfraEngine('key', 'http://stub').complete('p', { model: 'm', system: 's', maxTokens: 77 });
        new OllamaEngine('http://stub').complete('p', { model: 'm', system: 's', maxTokens: 77 });
        new DeepInfraEngine('key', 'http://stub').complete('p', { model: 'm' });
    } finally {
        global.fetch = realFetch;
    }
    assert.strictEqual(bodies[0].max_tokens, 77);
    assert.strictEqual(bodies[1].options.num_predict, 77);
    assert.ok(!('max_tokens' in bodies[2]), 'no cap asked, no cap sent');
}

// ── Recipe resolution (the same contract the broker responder had) ───────────

function testRecipeResolutionAndFallback() {
    assert.deepStrictEqual(resolveRecipeId('krea-2'), { recipeId: 'krea-2', fellBack: false });
    assert.deepStrictEqual(resolveRecipeId('h3'), { recipeId: 'minimax-h3', fellBack: false },
        'the alias map must still reach MiniMax-H3 — it fell to the chroma IMAGE recipe for a week');
    const miss = resolveRecipeId('no-such-model');
    assert.strictEqual(miss.recipeId, FALLBACK_RECIPE_ID);
    assert.strictEqual(miss.fellBack, true, 'a miss must be reported, not absorbed');
}

function testModeResolution() {
    assert.strictEqual(resolveMode('krea-2'), 't2v');
    assert.strictEqual(resolveMode('krea-2', 'r2v'), 't2v', 'an unsupported mode falls back, never returns undefined');
    assert.strictEqual(resolveMode('minimax-h3', 'r2v'), 'r2v');
}

// ── The DeepInfra key never reaches the renderer ─────────────────────────────

function testSecretsStoreDeepInfraSlot() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cubric-secrets-'));
    const prevUserData = process.env.APP_USER_DATA;
    process.env.APP_USER_DATA = dir;
    try {
        // Fresh module state per run, and no safeStorage — the derived-key AES-GCM
        // fallback is the branch a headless test machine takes anyway.
        delete require.cache[require.resolve('../main/secretsStore.js')];
        const store = require('../main/secretsStore.js');

        const channels = [];
        store.init({ app: null, safeStorage: null, ipcMain: { handle: (c) => channels.push(c) }, logger: null });

        // THE INVARIANT: the renderer reaches this slot only as the `deepinfra`
        // connection's key (set / presence / clear), and no channel reads a key back.
        assert.ok(channels.includes('secrets:set-endpoint-key'));
        assert.ok(channels.includes('secrets:has-endpoint-key'));
        assert.ok(channels.includes('secrets:clear-endpoint-key'));
        assert.deepStrictEqual(channels.filter((c) => /deepinfra/i.test(c)), [], 'MPI-737 retired the DeepInfra-only channels');
        const leaky = channels.filter((c) => /key/i.test(c) && /get/i.test(c));
        assert.deepStrictEqual(leaky, [], `renderer-readable key channel registered: ${leaky.join(', ')}`);

        assert.strictEqual(store.hasDeepInfraKey(), false);
        assert.deepStrictEqual(store.setDeepInfraKey(''), { ok: false, reason: 'empty' });

        assert.strictEqual(store.setDeepInfraKey('di-secret-123').ok, true);
        assert.strictEqual(store.hasDeepInfraKey(), true);
        assert.strictEqual(store.getDeepInfraKey(), 'di-secret-123');

        // Its own slot, never the RunPod one: setting one must not answer for the other.
        assert.strictEqual(store.hasApiKey(), false, 'the DeepInfra key must not satisfy hasApiKey()');
        store.setApiKey('runpod-secret-456');
        assert.strictEqual(store.getDeepInfraKey(), 'di-secret-123', 'the RunPod key overwrote the DeepInfra slot');

        // Never plaintext on disk, whichever encryption branch ran.
        const onDisk = fs.readFileSync(path.join(dir, 'runpod-secrets.json'), 'utf8');
        assert.ok(!onDisk.includes('di-secret-123'), 'the key is on disk in plaintext');

        store.clearDeepInfraKey();
        assert.strictEqual(store.hasDeepInfraKey(), false);
        assert.strictEqual(store.hasApiKey(), true, 'clearing DeepInfra must not clear RunPod');
    } finally {
        if (prevUserData === undefined) delete process.env.APP_USER_DATA;
        else process.env.APP_USER_DATA = prevUserData;
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

function testForkBridgeAnswersDeepInfraRequests() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cubric-secrets-'));
    const prevUserData = process.env.APP_USER_DATA;
    process.env.APP_USER_DATA = dir;
    try {
        delete require.cache[require.resolve('../main/secretsStore.js')];
        const store = require('../main/secretsStore.js');
        store.init({ app: null, safeStorage: null, ipcMain: null, logger: null });
        store.setDeepInfraKey('bridge-key-789');

        let handler = null;
        const sent = [];
        store.registerForkBridge({ on: (_e, fn) => { handler = fn; }, send: (m) => sent.push(m) });
        assert.ok(handler, 'registerForkBridge did not subscribe');

        // The server reads the slot as the `deepinfra` connection's key; the old
        // DeepInfra-only requests are gone and get no answer.
        handler({ type: 'secrets:get-deepinfra-key-request', id: 'a' });
        handler({ type: 'secrets:get-endpoint-profile-request', id: 'b', profileId: 'deepinfra' });

        assert.strictEqual(sent.length, 1, `retired request answered: ${JSON.stringify(sent)}`);
        assert.strictEqual(sent[0].id, 'b');
        assert.strictEqual(sent[0].key, 'bridge-key-789');
    } finally {
        if (prevUserData === undefined) delete process.env.APP_USER_DATA;
        else process.env.APP_USER_DATA = prevUserData;
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

// ── DeepInfra prices (MPI-728) ───────────────────────────────────────────────

function testModelNamesSayWhichSizeRuns() {
    // One registry entry is TWO models — Gemma 4 E4B on Ollama, the 26B MoE on DeepInfra —
    // and a picker reading "Gemma 4 (Default)" on both hid that (Fabio, 2026-09-14).
    const { getModel, modelName } = require('../services/llmEngines.mjs');
    const gemma = getModel('gemma-4-e4b');
    assert.match(modelName(gemma, 'ollama'), /E4B/);
    assert.match(gemma.ollamaName, /e4b/i, 'the Ollama label must name the tag that runs');
    assert.match(modelName(gemma, 'deepinfra'), /26B/);
    assert.match(gemma.deepInfraId, /26B/, 'the DeepInfra label must name the model that runs');
    // An entry that is one model everywhere keeps its one name.
    assert.strictEqual(modelName(getModel('gemma-3-12b'), 'deepinfra'), 'Gemma 3 12B');
}

function testDeepInfraPricesParse() {
    // The `GET /v1/openai/models` shape as returned on 2026-09-12, trimmed. An
    // entry without numeric token prices is left out rather than priced at zero.
    const { parseDeepInfraPrices } = require('../services/llmEngines.mjs');
    const prices = parseDeepInfraPrices({ data: [
        { id: 'google/gemma-4-26B-A4B-it', metadata: { pricing: { input_tokens: 0.07, output_tokens: 0.33999999999999997 } } },
        { id: 'priced-per-character', metadata: { pricing: { per_character: 0.00001 } } },
        { id: 'no-metadata' },
    ] });
    assert.deepStrictEqual(prices, { 'google/gemma-4-26B-A4B-it': { in: 0.07, out: 0.33999999999999997 } });
    assert.deepStrictEqual(parseDeepInfraPrices(null), {});
}

// ── MPI-737: backend migration, describe prefs, describeImage branches ────────

function testChooseBackendAcceptsEndpoint() {
    // D2 (MPI-737): 'endpoint' is the code value for the Remote backend.
    assert.strictEqual(chooseBackend({ override: 'endpoint' }), 'endpoint');
    // 'deepinfra' stored values map to 'endpoint' in chooseBackend.
    assert.strictEqual(chooseBackend({ override: 'deepinfra' }), 'endpoint');
    // Other backends unaffected.
    assert.strictEqual(chooseBackend({ override: 'comfy' }), 'comfy');
    assert.strictEqual(chooseBackend({ override: 'ollama' }), 'ollama');
    assert.strictEqual(chooseBackend(), 'comfy', 'default still comfy');
}

function testBackendPreferenceMigratesDeepInfra() {
    // D2 migration: a stored 'deepinfra' value is transparently mapped to
    // 'endpoint' and the migrated value is persisted so Phase 3 settings read it.
    delete _ls['cubric.llm.backend'];
    setBackendPreference('deepinfra');
    assert.strictEqual(_ls['cubric.llm.backend'], 'deepinfra', 'confirm storage before migration');
    const result = backendPreference();
    assert.strictEqual(result, 'endpoint', 'stored deepinfra migrates to endpoint on read');
    assert.strictEqual(_ls['cubric.llm.backend'], 'endpoint', 'migrated value is persisted');
    // Clean up.
    delete _ls['cubric.llm.backend'];
}

function testBackendPreferenceReturnsEndpointDirectly() {
    delete _ls['cubric.llm.backend'];
    setBackendPreference('endpoint');
    assert.strictEqual(backendPreference(), 'endpoint');
    delete _ls['cubric.llm.backend'];
}

function testDescribeBackendPreference() {
    delete _ls['cubric.llm.describeBackend'];
    // Default is comfy.
    assert.strictEqual(describeBackendPreference(), 'comfy', 'default describe backend');
    setDescribeBackendPreference('endpoint');
    assert.strictEqual(describeBackendPreference(), 'endpoint');
    setDescribeBackendPreference(null);
    assert.strictEqual(describeBackendPreference(), 'comfy', 'falsy clears to default');
    delete _ls['cubric.llm.describeBackend'];
}

function testDescribeModelPreference() {
    delete _ls['cubric.llm.describeModel'];
    assert.strictEqual(describeModelPreference(), undefined, 'default is undefined');
    setDescribeModelPreference('some-model-id');
    assert.strictEqual(describeModelPreference(), 'some-model-id');
    setDescribeModelPreference('');
    assert.strictEqual(describeModelPreference(), undefined, 'empty string → undefined');
    delete _ls['cubric.llm.describeModel'];
}

function testBuildDescribeInjectionParamsChatMlWrapping() {
    // Verify the ChatML wrapping for the comfy-path question injection.
    const params = buildDescribeInjectionParams('What color is the hat?');
    assert.ok('Input_Describe_Prompt' in params, 'must set Input_Describe_Prompt');
    assert.ok(params.Input_Describe_Prompt.startsWith('<|im_start|>system\n'));
    assert.ok(params.Input_Describe_Prompt.includes('What color is the hat?'));
    assert.ok(params.Input_Describe_Prompt.endsWith('<|im_end|>\n<|im_start|>user'));
    // No question → empty params (graph uses its own baked caption instruction).
    assert.deepStrictEqual(buildDescribeInjectionParams(), {});
    assert.deepStrictEqual(buildDescribeInjectionParams(''), {});
}

function testEnhancerModelMigrationViaModelsEndpoint() {
    // A stored MODEL_REGISTRY id reaches the endpoint as its raw deepInfraId,
    // mapped through GET /llm/models.
    const realFetch = global.fetch;
    const enhanceBodies = [];
    global.fetch = (url, init) => {
        if (url === '/llm/models') {
            return Promise.resolve({ ok: true, json: () => Promise.resolve({
                models: [{ id: 'gemma-4-e4b', deepInfraId: 'google/gemma-4-26B-A4B-it' }],
            }) });
        }
        if (url === '/llm/enhance') enhanceBodies.push(JSON.parse(init.body));
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true, text: 'a cat', backend: 'deepinfra', model: 'm' }) });
    };
    setEnhancerModelPreference('gemma-4-e4b');
    return enhance({ prompt: 'a cat', model: PLAIN, backend: 'endpoint' }).then((res) => {
        assert.strictEqual(res.ok, true, JSON.stringify(res));
        assert.strictEqual(enhanceBodies.length, 1, 'exactly one /llm/enhance call');
        assert.strictEqual(enhanceBodies[0].backend, 'endpoint');
        assert.strictEqual(enhanceBodies[0].modelId, 'google/gemma-4-26B-A4B-it', 'registry id was not mapped');
        assert.ok(enhanceBodies[0].profileId, 'profileId must be sent on the endpoint branch');
    }).then(() => {
        // A Remote pick has its own key and wins; the Ollama pick is not sent to Remote,
        // and the Remote pick is not sent to Ollama.
        setEndpointModelPreference('meta-llama/Some-Model');
        return enhance({ prompt: 'a cat', model: PLAIN, backend: 'endpoint' });
    }).then(() => {
        assert.strictEqual(enhanceBodies[1].modelId, 'meta-llama/Some-Model');
        return enhance({ prompt: 'a cat', model: PLAIN, backend: 'ollama' });
    }).then(() => {
        assert.strictEqual(enhanceBodies[2].modelId, 'gemma-4-e4b', 'Ollama keeps its registry pick');
    }).then(() => {
        // Off DeepInfra, a legacy registry pick means nothing: send no model.
        setEndpointModelPreference(undefined);
        Storage.setLlmConnection({ profileId: 'openrouter' });
        return enhance({ prompt: 'a cat', model: PLAIN, backend: 'endpoint' });
    }).then(() => {
        assert.strictEqual(enhanceBodies[3].modelId, undefined, 'a deepInfraId must not reach another provider');
    }).finally(() => {
        setEnhancerModelPreference(undefined);
        setEndpointModelPreference(undefined);
        Storage.setLlmConnection({ profileId: 'deepinfra' });
        global.fetch = realFetch;
    });
}

function testEnhanceEndpointErrorIsText() {
    // The endpoint branch answers { code, message }; every enhance caller shows `error` as text.
    const realFetch = global.fetch;
    global.fetch = (url) => Promise.resolve({ ok: true, json: () => Promise.resolve(url === '/llm/models'
        ? { models: [] }
        : { ok: false, error: { code: 'NO_KEY', message: 'No API key saved for this connection.' } }) });
    return enhance({ prompt: 'a cat', model: PLAIN, backend: 'endpoint' }).then((res) => {
        assert.strictEqual(res.ok, false);
        assert.strictEqual(typeof res.error, 'string', `error must be text, got ${JSON.stringify(res.error)}`);
        assert.strictEqual(res.errorCode, 'NO_KEY');
        // D1: a settings problem says where to fix it (the Enhance dialog shows this text as-is).
        assert.strictEqual(res.error, 'No API key saved for this connection. Check Settings > Remote > Language Models.');
        assert.strictEqual(withRemoteSettingsHint('BAD_REQUEST', 'profileId is required.'), 'profileId is required.');
    }).finally(() => {
        global.fetch = realFetch;
    });
}

function testFlowEnhanceSendsTheRemotePick() {
    // A Flow's Enhance used to send the OLLAMA pick (mapped through deepInfraId) to
    // Remote, whatever the Remote dropdown said: the bug enhance() had already fixed.
    const realFetch = global.fetch;
    const bodies = [];
    global.fetch = (url, init) => {
        if (String(url).startsWith('/comfy_workflows/')) {
            const graph = WORKFLOW(String(url).slice('/comfy_workflows/'.length));
            return Promise.resolve({ ok: true, json: () => Promise.resolve(graph) });
        }
        if (url === '/llm/enhance') bodies.push(JSON.parse(init.body));
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true, text: 'a cat', backend: 'b', model: 'm', models: [] }) });
    };
    setBackendPreference('endpoint');
    setEnhancerModelPreference('gemma-4-e4b');
    setEndpointModelPreference('meta-llama/Some-Model');
    return enhanceFlow({ prompt: 'a cat' }).then((res) => {
        assert.strictEqual(res.ok, true, JSON.stringify(res));
        assert.strictEqual(bodies[0].modelId, 'meta-llama/Some-Model', 'a Flow must send the Remote pick');
        assert.strictEqual(bodies[0].profileId, 'deepinfra');
        setEndpointModelPreference(undefined);
        Storage.setLlmConnection({ profileId: 'openrouter' });
        return enhanceFlow({ prompt: 'a cat' });
    }).then(() => {
        assert.strictEqual(bodies[1].modelId, undefined, 'the Ollama pick must not reach another provider');
        setBackendPreference('ollama');
        return enhanceFlow({ prompt: 'a cat' });
    }).then(() => {
        assert.strictEqual(bodies[2].modelId, 'gemma-4-e4b', 'Ollama keeps its registry pick');
    }).finally(() => {
        delete _ls['cubric.llm.backend'];
        setEnhancerModelPreference(undefined);
        setEndpointModelPreference(undefined);
        Storage.setLlmConnection({ profileId: 'deepinfra' });
        global.fetch = realFetch;
    });
}

function testDescribeImageEndpointBranch() {
    // Endpoint: POST body carries profileId + imagePath; no enqueueGeneration call.
    const realFetch = global.fetch;
    const bodies = [];
    global.fetch = (url, init) => {
        if (url === '/llm/describe') bodies.push(JSON.parse(init.body));
        return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ ok: true, text: 'a red hat', backend: 'deepinfra', model: 'm' }),
        });
    };
    setDescribeBackendPreference('endpoint');
    setDescribeModelPreference('some-vision-model');
    return describeImage({ imagePath: '/projects/p1/image.jpg', question: 'What is in the image?' }).then((res) => {
        assert.strictEqual(res.ok, true);
        assert.strictEqual(res.text, 'a red hat');
        assert.strictEqual(res.via, 'endpoint');
        assert.strictEqual(bodies.length, 1, 'exactly one /llm/describe call');
        const body = bodies[0];
        assert.ok('profileId' in body, 'profileId required for endpoint');
        assert.strictEqual(body.imagePath, '/projects/p1/image.jpg');
        assert.strictEqual(body.question, 'What is in the image?');
        assert.strictEqual(body.modelId, 'some-vision-model');
        delete _ls['cubric.llm.describeBackend'];
        delete _ls['cubric.llm.describeModel'];
    }).finally(() => {
        global.fetch = realFetch;
    });
}

function testDescribeImageEndpointErrorNoFallback() {
    // D1: an endpoint error surfaces cleanly and does NOT fall back to ComfyUI.
    // Verified by: ok:false result has error text, and imagePath goes to /llm/describe,
    // not to any ComfyUI queue call (no enqueueGeneration invoked).
    const realFetch = global.fetch;
    global.fetch = (_url) => Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ ok: false, error: { code: 'NO_KEY', message: 'No API key saved.' } }),
    });
    setDescribeBackendPreference('endpoint');
    return describeImage({ imagePath: '/img.jpg' }).then((res) => {
        assert.strictEqual(res.ok, false, 'must return failure');
        assert.strictEqual(res.errorCode, 'NO_KEY');
        assert.strictEqual(res.via, 'endpoint', 'the caller points at Remote settings only for an endpoint failure');
        assert.ok(res.error.includes('No API key'), `error message: ${res.error}`);
        delete _ls['cubric.llm.describeBackend'];
    }).finally(() => {
        global.fetch = realFetch;
    });
}

function testDescribeImageComfyPluginMissing() {
    // comfy: if the Image Describer plugin is not installed, return DESCRIBER_MISSING.
    // This does not call enqueueGeneration.
    delete _ls['cubric.llm.describeBackend'];
    // describeBackendPreference() returns 'comfy' by default.
    // pluginAvailability in Node.js returns { installed: false } (state is empty).
    return describeImage({ imagePath: '/img.jpg' }).then((res) => {
        assert.strictEqual(res.ok, false);
        assert.strictEqual(res.errorCode, 'DESCRIBER_MISSING');
        assert.strictEqual(res.via, 'comfy');
        assert.ok(res.error.includes('not installed'), `error: ${res.error}`);
    });
}

// ── Runner ───────────────────────────────────────────────────────────────────

const tests = [
    testComfyIsTheDefault,
    testExplicitOverrideWins,
    testComfyIsOfferedOnEveryModel,
    testTheModelCardNoLongerSteersTheBackend,
    testInjectionParamsCarryTheOverrides,
    testSystemPromptIsChatMlWrapped,
    testGraphDefaultsAreReadOffTheGraph,
    testServerTextGetsTheGraphPipeline,
    testChatMlUnwrapsToTheBareRecipe,
    testTheEnhancerBorrowsKleinsEncoder,
    testEnginesForwardTheTokenCap,
    testRecipeResolutionAndFallback,
    testModeResolution,
    testSecretsStoreDeepInfraSlot,
    testForkBridgeAnswersDeepInfraRequests,
    testModelNamesSayWhichSizeRuns,
    testDeepInfraPricesParse,
    // MPI-737 additions
    testChooseBackendAcceptsEndpoint,
    testBackendPreferenceMigratesDeepInfra,
    testBackendPreferenceReturnsEndpointDirectly,
    testDescribeBackendPreference,
    testDescribeModelPreference,
    testBuildDescribeInjectionParamsChatMlWrapping,
    testEnhancerModelMigrationViaModelsEndpoint,
    testEnhanceEndpointErrorIsText,
    testFlowEnhanceSendsTheRemotePick,
    testDescribeImageEndpointBranch,
    testDescribeImageEndpointErrorNoFallback,
    testDescribeImageComfyPluginMissing,
];

let failed = 0;

// Run each test, handling both sync and async (Promise-returning) functions.
async function runAll() {
    for (const t of tests) {
        try {
            await t();
            console.log(`  ok  ${t.name}`);
        } catch (err) {
            failed++;
            console.error(`  FAIL ${t.name}\n    ${err.message}`);
        }
    }
    console.log(failed
        ? `\n${failed} of ${tests.length} llm service tests FAILED.`
        : `\nAll ${tests.length} llm service tests passed.`);
    if (failed) process.exitCode = 1;
}

runAll();
