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
        const { input, prompt, output } = flow.cloudEdit;
        const feeds = (id, cls) => Object.values(g).some(n => n.class_type === cls
            && Object.values(n.inputs || {}).some(v => Array.isArray(v) && String(v[0]) === id));
        assert.ok(feeds(input, 'VAEEncode'), `${flow.id}: ${input} feeds no VAEEncode`);
        assert.ok(feeds(prompt, 'CLIPTextEncode'), `${flow.id}: ${prompt} feeds no CLIPTextEncode`);
        assert.equal(g[output]?.class_type, 'VAEDecode', `${flow.id}: ${output} is not the decode`);
        // A cloud candidate only ever sits in a Flow that can swap its edit stage.
        for (const f of registry.FLOWS.filter(x => !x.cloudEdit)) {
            for (const slot of registry.flowModelSlots(f)) {
                assert.ok(!slot.models.some(registry.isCloudCandidate), `${f.id} lists a cloud model with no cloudEdit`);
            }
        }
    }
});

// Bare-Node stand-ins for the three browser APIs the orchestration touches.
function stubBrowser(routes) {
    const sent = [];
    global.fetch = async (u, opts = {}) => {
        sent.push({ url: String(u), body: opts.body ? JSON.parse(opts.body) : null });
        const answer = routes[String(u)];
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
