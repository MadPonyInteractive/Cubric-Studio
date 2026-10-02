'use strict';

/**
 * flow-cloud-edit.test.cjs — MPI-918, a cloud model in a Flow's edit slot.
 *
 * Three promises, each one a way to spend the user's money wrongly or to run a wrong graph:
 *   1. a cloud candidate runs ONLY when picked (never what an install happens to resolve to),
 *      is offered only with a key, and fills no LoRA rack;
 *   2. every Flow's `cloudEdit` ids still name the edit stage of its graph (input -> VAEEncode,
 *      prompt -> CLIPTextEncode, output = VAEDecode), so a graph edit cannot silently move it;
 *   3. the orchestration sends pass 1's exact picture and prompt through the cloud route, and
 *      pass 2 carries the result and the billed cost; a refusal reaches the caller with its code.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const url = (rel) => 'file://' + path.join(ROOT, rel).replace(/\\/g, '/');
const load = async () => ({
    state: (await import(url('js/state.js'))).state,
    registry: await import(url('js/data/flowsRegistry.js')),
});

const CLOUD = 'klein-9b-cloud';

test('a local candidate always wins, a cloud one runs only with nothing local, a key, and no rack', async () => {
    const { state, registry } = await load();
    const scribble = registry.getFlowById('scribble');
    const { cloudEditQuote } = await import(url('js/services/flowService.js'));
    assert.ok(registry.isCloudCandidate(CLOUD));
    assert.ok(!registry.isCloudCandidate('klein-9b'));

    // Key saved AND a local Klein: local runs, and the run is free.
    state.s_installedModelIds = ['klein-4b', CLOUD, 'nano-banana-2-lite-cloud'];
    assert.equal(registry.flowModelIds(scribble)[0], 'klein-4b');
    assert.equal(cloudEditQuote(scribble), null);

    // Key saved, nothing local (Fabio, 2026-10-01): the first cloud candidate runs, and it is
    // priced, which is what raises the agent's spend card.
    state.s_installedModelIds = [CLOUD, 'nano-banana-2-lite-cloud'];
    assert.equal(registry.flowModelIds(scribble)[0], CLOUD);
    assert.equal(registry.flowAvailability(scribble).available, true);
    const quote = cloudEditQuote(scribble);
    assert.equal(quote.model.id, CLOUD);
    assert.equal(quote.display, 'about $0.02');

    // Picked: it runs over an installed local one, and the rack is gone.
    state.s_installedModelIds = ['klein-9b', CLOUD];
    registry.setFlowModel('scribble', CLOUD);
    assert.equal(registry.flowModelIds(scribble)[0], CLOUD);
    assert.deepEqual(registry.flowLoraPhases(scribble), []);
    assert.ok(registry.flowModelChoices(scribble)[0].models.includes(CLOUD));

    // No key: not offered at all (its install is the key, which the Library cannot fetch).
    state.s_installedModelIds = ['klein-9b'];
    assert.ok(!registry.flowModelChoices(scribble)[0].models.includes(CLOUD));
    registry.setFlowModel('scribble', 'klein-9b');
    assert.deepEqual(registry.flowLoraPhases(scribble), [{ phase: 1, modelId: 'klein-9b' }]);
});

test('every cloudEdit spec still names its graph\'s edit stage', async () => {
    const { registry } = await load();
    const flows = registry.FLOWS.filter(f => f.cloudEdit);
    assert.ok(flows.length >= 1);
    for (const flow of flows) {
        const g = require(path.join(ROOT, 'comfy_workflows', flow.workflow));
        const { input, input2, prompt, output } = flow.cloudEdit;
        const feeds = (id, cls) => Object.values(g).some(n => n.class_type === cls
            && Object.values(n.inputs || {}).some(v => Array.isArray(v) && String(v[0]) === id));
        assert.ok(feeds(input, 'VAEEncode'), `${flow.id}: ${input} feeds no VAEEncode`);
        assert.ok(feeds(prompt, 'CLIPTextEncode'), `${flow.id}: ${prompt} feeds no CLIPTextEncode`);
        assert.equal(g[output]?.class_type, 'VAEDecode', `${flow.id}: ${output} is not the decode`);
        // Image two is a second reference, so every node it can name is encoded too, and a
        // mode-keyed one reads an MpiInt the run injects.
        if (input2 && typeof input2 === 'object') {
            assert.equal(g[input2.mode]?.class_type, 'MpiInt', `${flow.id}: input2.mode ${input2.mode} is not an MpiInt`);
            for (const [k, id] of Object.entries(input2)) {
                if (k !== 'mode') assert.ok(feeds(String(id), 'VAEEncode'), `${flow.id}: input2[${k}] ${id} feeds no VAEEncode`);
            }
        } else if (input2) {
            assert.ok(feeds(String(input2), 'VAEEncode'), `${flow.id}: input2 ${input2} feeds no VAEEncode`);
        }
        // A cloud candidate only ever sits in a Flow that can swap its edit stage.
        for (const f of registry.FLOWS.filter(x => !x.cloudEdit)) {
            for (const slot of registry.flowModelSlots(f)) {
                assert.ok(!slot.models.some(registry.isCloudCandidate), `${f.id} lists a cloud model with no cloudEdit`);
            }
        }
    }
});

test('no cloud Flow\'s two passes reach a local model, in any mode it has', async () => {
    const { registry } = await load();
    const { cloudEditPass1, cloudEditPass2 } = await import(url('js/utils/cloudEditGraph.js'));
    const LOCAL = ['UNETLoader', 'CLIPLoader', 'VAELoader', 'MpiLoraModel', 'SamplerCustomAdvanced', 'VAEDecode'];
    const flows = registry.FLOWS.filter(f => f.cloudEdit);
    assert.deepEqual(flows.map(f => f.id).sort(), ['scribble', 'scribble-object']);
    for (const flow of flows) {
        const g = require(path.join(ROOT, 'comfy_workflows', flow.workflow));
        const { input2 } = flow.cloudEdit;
        const modes = input2 && typeof input2 === 'object' ? Object.keys(input2).filter(k => k !== 'mode') : [null];
        for (const mode of modes) {
            const run = mode === null ? g : { ...g, [input2.mode]: { ...g[input2.mode], inputs: { ...g[input2.mode].inputs, int: Number(mode) } } };
            for (const [pass, graph] of [[1, cloudEditPass1(run, flow.cloudEdit)], [2, cloudEditPass2(run, flow.cloudEdit, { width: 1024, height: 1024 })]]) {
                const local = Object.values(graph).map(n => n.class_type).filter(c => LOCAL.includes(c));
                assert.deepEqual(local, [], `${flow.id} mode ${mode} pass ${pass} keeps ${local}`);
            }
        }
    }
});

test('Object Stamp offers no cloud model: a cloud edit skips the clean-up its local edit does', async () => {
    // Fabio, 2026-10-01: the cloud result kept a seam and shifted the crop's colour.
    const { registry } = await load();
    const flow = registry.getFlowById('object-stamp');
    const models = registry.flowModelSlots(flow).flatMap(s => s.models);
    assert.deepEqual(models.filter(id => registry.isCloudCandidate(id)), []);
    assert.equal(flow.cloudEdit, undefined);
});

test('Outpaint offers no cloud model (Fabio, 2026-10-02)', async () => {
    // After the MPI-1011 seam work: "remove cloud models from Outpaint".
    const { registry } = await load();
    const flow = registry.getFlowById('outpaint');
    const models = registry.flowModelSlots(flow).flatMap(s => s.models);
    assert.deepEqual(models.filter(id => registry.isCloudCandidate(id)), []);
    assert.equal(flow.cloudEdit, undefined);
});

test('Nano Banana stays on Scribble only: it failed on Draw It In and Outpaint on Fabio\'s look', async () => {
    const { registry } = await load();
    const cloudIds = (id) => registry.flowModelSlots(registry.getFlowById(id)).flatMap(s => s.models)
        .filter(m => registry.isCloudCandidate(m));
    assert.deepEqual(cloudIds('scribble'), [CLOUD, 'nano-banana-2-lite-cloud']);
    assert.deepEqual(cloudIds('scribble-object'), [CLOUD]);
});

test('pass 1\'s pictures are read by tap id, so image two reporting first cannot swap them', async () => {
    const { pass1Shown } = await import(url('js/services/flowService.js'));
    const { CLOUD_TAPS } = await import(url('js/utils/cloudEditGraph.js'));
    const stamp = { input: '211', input2: { mode: '220', 1: '106', 2: '201' } };
    // Image two's tap executed first, so it is first in execution order.
    const info = { displayUrlsByNode: { [CLOUD_TAPS.input2]: ['/view?obj'], [CLOUD_TAPS.input]: ['/view?scene'] }, promptText: 'p' };
    assert.deepEqual(pass1Shown(stamp, info), { url: '/view?scene', url2: '/view?obj', prompt: 'p' });
    // A two-reference edit missing image two sends nothing rather than a one-image edit.
    assert.equal(pass1Shown(stamp, { displayUrlsByNode: { [CLOUD_TAPS.input]: ['/view?scene'] }, promptText: 'p' }), null);
    assert.deepEqual(pass1Shown({ input: '106' }, { displayUrlsByNode: { [CLOUD_TAPS.input]: ['/view?a'] }, promptText: 'p' }),
        { url: '/view?a', url2: null, prompt: 'p' });
});

// Bare-Node stand-ins for the three browser APIs the orchestration touches.
function stubBrowser(routes) {
    const sent = [];
    global.fetch = async (u, opts = {}) => {
        const body = opts.body ? JSON.parse(opts.body) : null;
        sent.push({ url: String(u), body });
        const raw = routes[String(u)];
        const answer = typeof raw === 'function' ? raw(body) : raw;
        if (!answer) throw new Error(`unexpected fetch ${u}`);
        return answer instanceof Blob ? new Response(answer) : new Response(JSON.stringify(answer), { status: answer.ok === false ? 402 : 200 });
    };
    global.FileReader = class {
        readAsDataURL(blob) {
            blob.arrayBuffer().then((buf) => {
                this.result = `data:${blob.type || 'image/png'};base64,${Buffer.from(buf).toString('base64')}`;
                this.onload();
            });
        }
    };
    global.createImageBitmap = async () => ({ width: 896, height: 1152, close() {} });
    return sent;
}

const PIXEL = new Blob([Buffer.from('fakepng')], { type: 'image/png' });

test('the cloud edit sends pass 1\'s picture and prompt, and pass 2 carries the result and the bill', async () => {
    const { registry } = await load();
    const flow = registry.getFlowById('scribble');
    const { MODELS } = await import(url('js/data/modelConstants/models.js'));
    const { runCloudEdit } = await import(url('js/services/flowService.js'));
    const sent = stubBrowser({
        '/view?pass1': PIXEL,
        '/comfy/stage-media-data-url': { success: true, path: 'C:\\engine\\input\\mpi_staged\\a.png' },
        '/deepinfra/generate': { ok: true, viewUrls: ['http://127.0.0.1:3000/deepinfra/output/b.jpg'], cost: { usd: 0.015 } },
        'http://127.0.0.1:3000/deepinfra/output/b.jpg': PIXEL,
    });
    let pass2 = null;
    const errors = [];
    await runCloudEdit(flow, MODELS.find(m => m.id === CLOUD), { operation: 'flowScribble', positive: 'a fox' },
        { onError: (e) => errors.push(e) },
        { enqueue: (cfg) => { pass2 = cfg; return { queueJobId: 'q' }; }, pass1: async () => ({ url: '/view?pass1', prompt: 'Replace this sketch: a fox' }) });

    assert.deepEqual(errors, []);
    const gen = sent.find(s => s.url === '/deepinfra/generate').body;
    assert.equal(gen.modelId, CLOUD);
    assert.equal(gen.operation, 'edit');
    assert.equal(gen.prompt, 'Replace this sketch: a fox', 'the prompt the graph built, not the box');
    assert.deepEqual(gen.imagePaths, ['C:\\engine\\input\\mpi_staged\\a.png']);
    assert.equal(gen.width, 896);
    assert.equal(gen.height, 1152);
    assert.ok(gen.estimateUsd > 0, 'the credit gate gets a figure');
    assert.equal(pass2.operation, 'flowScribble');
    assert.equal(pass2.cloudEdit.pass, 2);
    assert.deepEqual(pass2.cloudEdit.spec, flow.cloudEdit);
    assert.match(pass2.cloudEdit.image, /^data:image\//);
    assert.equal(pass2.cloudEdit.width, 896);
    assert.deepEqual(pass2.cloudEdit.cost, { usd: 0.015 });
});

test('a two-reference edit sends image one then image two, and fits to image one', async () => {
    const { registry } = await load();
    // No shipped Flow takes two references since Object Stamp left the cloud; the support
    // stays for a split graph, so it is pinned here with the spec Object Stamp had.
    const flow = { ...registry.getFlowById('object-stamp'),
        cloudEdit: { input: '211', input2: { mode: '220', 1: '106', 2: '201' }, prompt: '185', output: '168' } };
    const { MODELS } = await import(url('js/data/modelConstants/models.js'));
    const { runCloudEdit } = await import(url('js/services/flowService.js'));
    const SCENE = new Blob([Buffer.from('scene')], { type: 'image/png' });
    const OBJECT = new Blob([Buffer.from('object')], { type: 'image/png' });
    const sent = stubBrowser({
        '/view?scene': SCENE,
        '/view?object': OBJECT,
        // The staged path names which picture it was handed.
        '/comfy/stage-media-data-url': ({ dataUrl }) => ({ success: true,
            path: Buffer.from(dataUrl.split(',')[1], 'base64').toString() === 'scene' ? 'C:\\s\\scene.png' : 'C:\\s\\object.png' }),
        '/deepinfra/generate': { ok: true, viewUrls: ['http://127.0.0.1:3000/deepinfra/output/b.jpg'], cost: { usd: 0.015 } },
        'http://127.0.0.1:3000/deepinfra/output/b.jpg': PIXEL,
    });
    // Manual's object keeps its own aspect; only the scene crop is the decode's size.
    global.createImageBitmap = async (b) => ({ ...((await b.text()) === 'scene' ? { width: 1024, height: 1024 } : { width: 768, height: 1152 }), close() {} });
    let pass2 = null;
    const errors = [];
    await runCloudEdit(flow, MODELS.find(m => m.id === CLOUD), { operation: 'flowObjectStamp' },
        { onError: (e) => errors.push(e) },
        { enqueue: (cfg) => { pass2 = cfg; return { queueJobId: 'q' }; },
            pass1: async () => ({ url: '/view?scene', url2: '/view?object', prompt: 'Place the object from image two' }) });

    assert.deepEqual(errors, []);
    const gen = sent.find(s => s.url === '/deepinfra/generate').body;
    assert.deepEqual(gen.imagePaths, ['C:\\s\\scene.png', 'C:\\s\\object.png'], 'reference order is image one, image two');
    assert.equal(gen.width, 1024);
    assert.equal(gen.height, 1024);
    assert.equal(pass2.cloudEdit.width, 1024, 'pass 2 fits to image one, the decode\'s size');
    assert.equal(pass2.cloudEdit.height, 1024);
});

test('the agent\'s catalogue keeps a Flow\'s cloud line, so Cosmo knows the run bills', async () => {
    const { compactCatalogue } = await import(url('services/agentLoop.mjs'));
    const out = compactCatalogue({ ok: true, models: [], tools: [], flows: [
        { id: 'scribble', title: 'Scribble', installed: true, cloud: 'its edit runs on X at DeepInfra' },
        { id: 'outpaint', title: 'Outpaint', installed: true },
    ] });
    assert.equal(out.flows[0].cloud, 'its edit runs on X at DeepInfra');
    assert.equal('cloud' in out.flows[1], false);
});

test('a refused cloud call reaches the caller with its code and queues nothing', async () => {
    const { registry } = await load();
    const flow = registry.getFlowById('scribble');
    const { MODELS } = await import(url('js/data/modelConstants/models.js'));
    const { runCloudEdit } = await import(url('js/services/flowService.js'));
    stubBrowser({
        '/view?pass1': PIXEL,
        '/comfy/stage-media-data-url': { success: true, path: 'C:\\a.png' },
        '/deepinfra/generate': { ok: false, error: { code: 'LOW_BALANCE', message: 'Your DeepInfra balance is too low.' } },
    });
    let queued = false;
    const errors = [];
    await runCloudEdit(flow, MODELS.find(m => m.id === CLOUD), { operation: 'flowScribble' },
        { onError: (e) => errors.push(e) },
        { enqueue: () => { queued = true; }, pass1: async () => ({ url: '/view?pass1', prompt: 'p' }) });
    assert.equal(queued, false);
    assert.equal(errors.length, 1);
    assert.equal(errors[0].code, 'LOW_BALANCE');
});

test('an edit stage the engine refused reaches the caller as the engine said it, and blames no provider', async () => {
    const { registry } = await load();
    const flow = registry.getFlowById('scribble-object');
    const { MODELS } = await import(url('js/data/modelConstants/models.js'));
    const { runCloudEdit } = await import(url('js/services/flowService.js'));
    const { Events } = await import(url('js/events.js'));
    const sent = stubBrowser({});
    const warnings = [];
    const off = Events.on('ui:warning', ({ message }) => warnings.push(message));
    // Pass 1 runs on the user's engine; a Pod still connecting refuses it (comfyController),
    // and commandExecutor has already told the user why.
    const refusal = Object.assign(new Error('Connecting to the remote engine — wait until it is ready before generating.'),
        { code: 'remote_transition' });
    const errors = [];
    await runCloudEdit(flow, MODELS.find(m => m.id === CLOUD), { operation: 'flowScribObj' },
        { onError: (e) => errors.push(e) },
        { enqueue: () => assert.fail('nothing may queue'), pass1: async () => { throw refusal; } });
    off();
    assert.ok(!sent.some(s => s.url.includes('deepinfra')), 'nothing went to the provider');
    assert.equal(errors.length, 1);
    assert.equal(errors[0].code, 'remote_transition');
    assert.deepEqual(warnings, [], 'no second toast, and never "the provider could not complete"');
});

test('an edit stage that hands back no picture says so, not that the provider failed', async () => {
    const { registry } = await load();
    const flow = registry.getFlowById('scribble');
    const { MODELS } = await import(url('js/data/modelConstants/models.js'));
    const { runCloudEdit } = await import(url('js/services/flowService.js'));
    const sent = stubBrowser({});
    const errors = [];
    await runCloudEdit(flow, MODELS.find(m => m.id === CLOUD), { operation: 'flowScribble' },
        { onError: (e) => errors.push(e) },
        { enqueue: () => assert.fail('nothing may queue'), pass1: async () => null });
    assert.ok(!sent.some(s => s.url.includes('deepinfra')));
    assert.equal(errors.length, 1);
    assert.doesNotMatch(errors[0].userMessage, /provider/);
});
