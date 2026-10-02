/**
 * audio-models.test.cjs — MPI-1012.
 *
 * Sound & Music (Stable Audio 3) and Text to Speech (Chatterbox) left the Flow Library and
 * became prompt-box MODELS. Every way that move goes wrong is silent:
 *   - a dep id that differs from the Flow's re-downloads what users already have, or
 *     leaves the Stable Audio weights with no owner for the orphan sweep to take;
 *   - the licence key not following the id installs 11.81GB of licensed weights with no
 *     dialog (the old sweep only checked `flow:` keys);
 *   - a control key that matches no graph title is skipped by the injector;
 *   - an old card, routine or agent call naming the Flow fails UNKNOWN_FLOW, or runs on
 *     the graph's baked values (Chatterbox's bake is the multilingual arm reading English);
 *   - an audio control writing the IMAGE models' shared bucket.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const store = new Map();
globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
};

const repo = (p) => path.join(__dirname, '..', p);
const esm = (p) => import('file:///' + repo(p).replace(/\\/g, '/'));
const graph = (file) => JSON.parse(fs.readFileSync(repo(`comfy_workflows/${file}`), 'utf8'));
const titles = (g) => new Set(Object.values(g).map(n => n._meta?.title).filter(Boolean));

// The Flows' own dep lists at the move (flowsRegistry.js before MPI-1012), byte for byte.
const FLOW_DEPS = {
    'stable-audio-3': ['stable-audio-3-medium', 'stable-audio-3-small-sfx', 't5gemma-b-b-ul2'],
    chatterbox: ['chatterbox-ve', 'chatterbox-t3', 'chatterbox-s3gen', 'chatterbox-tokenizer',
        'chatterbox-conds', 'chatterbox-mtl-t3', 'chatterbox-mtl-s3gen', 'chatterbox-mtl-ve',
        'chatterbox-mtl-grapheme', 'chatterbox-mtl-cangjie', 'chatterbox-mtl-conds', 'ComfyUI_Fill-ChatterBox'],
};

test('both audio models exist, list in the audio section, and own the Flows\' exact deps', async () => {
    const { MODELS } = await esm('js/data/modelConstants/models.js');
    const { DEPS } = await esm('js/data/modelConstants/dependencies.js');
    for (const [id, op, file] of [['stable-audio-3', 't2a', 'stable_audio_3.json'], ['chatterbox', 'tts', 'chatterbox_tts.json']]) {
        const m = MODELS.find(x => x.id === id);
        assert.ok(m, `${id} missing`);
        assert.strictEqual(m.mediaType, 'audio');
        assert.deepStrictEqual(m.supportedOps, [op]);
        assert.strictEqual(m.workflows[op], file);
        assert.ok(fs.existsSync(repo(`comfy_workflows/${file}`)) && fs.existsSync(repo(`comfy_workflows/raw/${file}`)), `${file} runtime + raw`);
        assert.ok(fs.existsSync(repo(`comfy_workflows/display/${m.image}`)), `${m.image} still`);
        for (const dep of FLOW_DEPS[id]) assert.ok(m.dependencies.includes(dep), `${id} must keep the Flow's dep ${dep}`);
        for (const dep of m.dependencies) assert.ok(DEPS[dep], `${id}: unknown dep ${dep}`);
        assert.strictEqual(m.showSettings, false, 'no LoRA/upscale gear on an audio model');
        assert.strictEqual(m.capabilities?.negativePrompt, false, 'neither graph has a negative node');
    }
    // filterMediaInputsForModel drops an audio slot unless the model says audio:true.
    assert.strictEqual(MODELS.find(x => x.id === 'chatterbox').capabilities.audio, true);
});

test('the Flows are gone and their ops are tombstones in BOTH registries', async () => {
    const { FLOWS } = await esm('js/data/flowsRegistry.js');
    const { commands, getCommandMediaInputs } = await esm('js/data/commandRegistry.js');
    const { OPERATION_REGISTRY } = await esm('js/core/operationRegistry.js');
    const { UNIVERSAL_WORKFLOWS } = await esm('js/data/modelConstants/universal_workflows.js');
    const json = JSON.parse(fs.readFileSync(repo('operation_registry.json'), 'utf8'));
    for (const id of ['chatter-box', 'sound-and-music']) assert.ok(!FLOWS.some(f => f.id === id), `${id} still a Flow`);
    for (const op of ['flowChatterBox', 'flowSoundAndMusic']) {
        assert.ok(!commands[op] && !UNIVERSAL_WORKFLOWS[op], `${op} must leave commandRegistry and universal workflows`);
        assert.strictEqual(OPERATION_REGISTRY[op]?.deprecated, true);
        assert.strictEqual(json[op]?.deprecated, true);
    }
    for (const op of ['t2a', 'tts']) {
        assert.strictEqual(commands[op].mediaType, 'audio');
        assert.ok(!commands[op].universal, 'a universal op never reaches the prompt box');
        assert.strictEqual(json[op]?.appVersionIntroduced, OPERATION_REGISTRY[op].appVersionIntroduced);
    }
    assert.deepStrictEqual(getCommandMediaInputs('tts').map(s => [s.key, s.required]), [['audio1', true]]);
});

test('Stable Audio 3 is gated by the SAME descriptor, so nobody is asked again', async () => {
    const { getModelLicence, MODEL_LICENCES } = await esm('js/data/modelConstants/licences.js');
    const lic = getModelLicence('stable-audio-3');
    assert.ok(lic, 'stable-audio-3 must be gated');
    assert.strictEqual(lic.id, 'stable-audio-3-stability-gemma-2026-09-05');
    assert.strictEqual(lic.version, 1, 'a version bump re-prompts every Flow-era acceptor');
    assert.ok(!MODEL_LICENCES['flow:sound-and-music'], 'a dead flow key gates nothing');
});

test('every key the audio controls inject is a node title in its graph', async () => {
    const { ttsLanguageParams } = await esm('js/data/commandRegistry.js');
    const sa = titles(graph('stable_audio_3.json'));
    for (const t of ['Input_Positive', 'Input_Category', 'Input_Duration', 'Input_Seed']) assert.ok(sa.has(t), `stable_audio_3.json lacks ${t}`);
    const cb = graph('chatterbox_tts.json');
    const cbt = titles(cb);
    for (const key of Object.keys(ttsLanguageParams('French'))) {
        const [title, widget] = key.split('.');
        assert.ok(cbt.has(title), `chatterbox_tts.json lacks ${title}`);
        if (widget) assert.ok(Object.values(cb).some(n => n._meta?.title === title && widget in n.inputs), `${key}: no such widget`);
    }
});

test('the language picks the arm: English the English-only one, anything else the multilingual', async () => {
    const { ttsLanguageParams, ttsLanguageValue, TTS_LANGUAGES } = await esm('js/data/commandRegistry.js');
    assert.strictEqual(TTS_LANGUAGES.length, 23);
    assert.deepStrictEqual(ttsLanguageParams('English'), { 'Input_Language.language': 'English (en)', Input_Is_Multilingual: false });
    assert.deepStrictEqual(ttsLanguageParams('french'), { 'Input_Language.language': 'French (fr)', Input_Is_Multilingual: true });
    assert.strictEqual(ttsLanguageValue('Japanese (ja)'), 'Japanese (ja)');
    assert.strictEqual(ttsLanguageValue('Klingon'), null);
});

test('an agent run without params gets the defaults injected, never the graph\'s bake', async () => {
    const { resolveNamedParams } = await esm('js/data/generationControls.js');
    const { MODELS } = await esm('js/data/modelConstants/models.js');
    const sa = MODELS.find(m => m.id === 'stable-audio-3');
    const cb = MODELS.find(m => m.id === 'chatterbox');

    const tts = resolveNamedParams(null, cb, 'tts', {});
    assert.ok(tts.ok);
    assert.strictEqual(tts.injectionParams.Input_Is_Multilingual, false, 'the bake is TRUE: English must run the English arm');
    assert.strictEqual(resolveNamedParams(null, cb, 'tts', { language: 'German' }).injectionParams['Input_Language.language'], 'German (de)');
    assert.strictEqual(resolveNamedParams(null, cb, 'tts', { language: 'Klingon' }).code, 'INVALID_LANGUAGE');

    const t2a = resolveNamedParams(null, sa, 't2a', { category: 'sound effect', duration: 120 });
    assert.ok(t2a.ok, t2a.message);
    assert.strictEqual(t2a.injectionParams.Input_Category, 'SFX');
    assert.strictEqual(t2a.injectionParams.Input_Duration, 120, 'audio runs past the video slider\'s 30 s');
    assert.strictEqual(resolveNamedParams(null, sa, 't2a', {}).injectionParams.Input_Duration, 10);
    assert.strictEqual(resolveNamedParams(null, sa, 't2a', { duration: 300 }).code, 'INVALID_DURATION');
    assert.strictEqual(resolveNamedParams(null, sa, 't2a', { category: 'Opera' }).code, 'INVALID_CATEGORY');
    // And nowhere else: an image op has neither picker.
    const krea = MODELS.find(m => m.id === 'krea2');
    assert.strictEqual(resolveNamedParams(null, krea, 't2i', { language: 'French' }).code, 'INVALID_LANGUAGE');
});

test('describe_model lists what the agent may send, so it never guesses a string', async () => {
    const { namedParamsFor } = await esm('js/data/generationControls.js');
    const { MODELS } = await esm('js/data/modelConstants/models.js');
    const tts = namedParamsFor(MODELS.find(m => m.id === 'chatterbox'), 'tts');
    assert.strictEqual(tts.languages.length, 23);
    assert.strictEqual(tts.duration, null);
    const t2a = namedParamsFor(MODELS.find(m => m.id === 'stable-audio-3'), 't2a');
    assert.deepStrictEqual(t2a.categories, ['Music', 'Instrument', 'SFX', 'One-shot']);
    assert.deepStrictEqual(t2a.duration, { min: 1, max: 190 });
    const t2i = namedParamsFor(MODELS.find(m => m.id === 'krea2'), 't2i');
    assert.ok(!('languages' in t2i) && !('categories' in t2i), 'every other op keeps its old shape');
});

test('audio has no shared bucket, so an audio control can never write the image models\' one', async () => {
    const { getSharedSettings, setSharedSettings } = await esm('js/data/projectModel.js');
    const project = { shared: { image: { batch: 3 }, video: {} } };
    assert.strictEqual(setSharedSettings(project, 'audio', { batch: 1 }), project);
    assert.deepStrictEqual(getSharedSettings(project, 'audio'), {});
});

test('an old Flow submit or routine step runs as the model it became', async () => {
    const { retiredFlowAsModel, retiredFlowMessage } = await esm('js/data/retiredFlows.js');
    const media = [{ role: 'audio1', url: '/project-file?path=voice.wav' }];
    assert.deepStrictEqual(
        retiredFlowAsModel({ flowId: 'chatter-box', fields: { positive: 'Bonjour', 'Input_Language.language': 'French (fr)' }, media, folderPath: 'X' }),
        { media, folderPath: 'X', modelId: 'chatterbox', operation: 'tts', positive: 'Bonjour', language: 'French (fr)' });
    assert.deepStrictEqual(
        retiredFlowAsModel({ flowId: 'sound-and-music', fields: { positive: 'rain', Input_Category: 'SFX', Input_Duration: 25 } }),
        { modelId: 'stable-audio-3', operation: 't2a', positive: 'rain', category: 'SFX', duration: 25 });
    assert.strictEqual(retiredFlowAsModel({ flowId: 'voice-changer' }), null, 'a live Flow is untouched');
    assert.match(retiredFlowMessage('chatter-box'), /modelId "chatterbox"/);

    const { validateRoutine, normalizeRoutine } = await esm('js/data/routineModel.js');
    const { MODELS } = await esm('js/data/modelConstants/models.js');
    const { FLOWS } = await esm('js/data/flowsRegistry.js');
    const v = validateRoutine(normalizeRoutine({
        name: 'Speak it', summary: 'Reads a line in the voice on the card',
        steps: [{ flowId: 'chatter-box', fields: { positive: 'Hello', 'Input_Language.language': 'Italian (it)' } }],
    }), { models: MODELS, flows: FLOWS });
    assert.ok(v.ok, v.message);
    assert.deepStrictEqual(v.routine.steps, [{ modelId: 'chatterbox', operation: 'tts', positive: 'Hello', language: 'Italian (it)' }]);
    assert.strictEqual(v.inputKind, 'audio');
});

test('Text to Speech dims until a voice is staged, and no other op ever waits on audio', async () => {
    const { MODELS } = await esm('js/data/modelConstants/models.js');
    const { getAvailableCommands } = await esm('js/data/commandRegistry.js');
    const chatterbox = MODELS.find(m => m.id === 'chatterbox');
    const tts = (ctx) => getAvailableCommands('audio', chatterbox, ctx).find(c => c.key === 'tts');
    assert.strictEqual(tts({}).available, false, 'no voice staged: the op must dim, not wait for the Cue toast');
    assert.strictEqual(tts({}).requiresAudio, 1);
    assert.strictEqual(tts({ audioCount: 1 }).available, true);
    // LTX and H3 declare OPTIONAL audio slots; an empty box must never dim them.
    for (const m of MODELS) {
        for (const c of getAvailableCommands(m.mediaType, m, {})) {
            if (c.requiresAudio) assert.strictEqual(c.key, 'tts', `${m.id}/${c.key} would dim with no audio staged`);
        }
    }
});

test('Reuse on an old Flow card opens the model, keeps the voice and restores the settings', async () => {
    const { buildPromptReusePayload, buildPromptReuseSettings, isFlowCardItem } = await esm('js/utils/promptReuse.js');
    const card = {
        flowId: 'chatter-box', operation: 'flowChatterBox', modelId: null, prompt: 'Ciao',
        flowInputs: { positive: 'Ciao', 'Input_Language.language': 'Italian (it)' },
        generationSettings: {
            operation: 'flowChatterBox',
            injectionParams: { 'Input_Language.language': 'Italian (it)', Input_Is_Multilingual: true },
            mediaItems: [{ url: '/project-file?path=voice.wav', mediaType: 'audio', role: 'audio1' }],
        },
    };
    const p = buildPromptReusePayload(card);
    assert.strictEqual(p.modelId, 'chatterbox');
    assert.strictEqual(p.operation, 'tts');
    assert.deepStrictEqual(p.mediaItems.map(m => m.role), ['audio1'], 'the voice must survive the op change');
    assert.deepStrictEqual(buildPromptReuseSettings(p, {}).modelUpdates, { ttsLanguage: 'Italian (it)' });
    assert.strictEqual(isFlowCardItem(card), false, 'no "Apply to App" for a Flow that is gone');
    assert.strictEqual(isFlowCardItem({ flowId: 'voice-changer' }), true);
});
