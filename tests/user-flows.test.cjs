'use strict';

/**
 * MPI-532 — Flow packages in `<userData>/user_flows/`: scan, validate, serve, protect.
 *
 * The validator exists because the injector SILENTLY skips an Input_* title with no
 * matching node, so every rejection here is a package that would otherwise have failed as
 * a mystery. Packages are built in a temp dir from one valid base, one defect at a time.
 */

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');

const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'mpi532-'));
process.env.APP_USER_DATA = ROOT;
const FLOWS_DIR = path.join(ROOT, 'user_flows');

const uf = require('../services/userFlows');
const known = uf.loadKnown();
const { FLOWS, flowDepKey } = require('../js/data/flowsRegistry.js');
const MODEL = [...known.models][0];
// A dep NO built-in Flow requires, so only the package can be what protects it.
const DEP = [...known.deps].find(id => !FLOWS.some(f => (f.requiredDeps || []).includes(id)));

const graph = () => ({
    1: { class_type: 'MpiLoadImageFromPath', inputs: { string: '' }, _meta: { title: 'Input_Image' } },
    2: { class_type: 'MpiBox', inputs: { x: 0, y: 0, width: 8, height: 8 }, _meta: { title: 'Input_Box' } },
    3: { class_type: 'MpiBoxCrop', inputs: { image: ['1', 0], box: ['2', 0] }, _meta: { title: 'crop' } },
    4: { class_type: 'SaveImage', inputs: { images: ['3', 0], filename_prefix: 'x' }, _meta: { title: 'Output_Image' } },
});
const manifest = () => ({
    schema: uf.SCHEMA,
    id: 'test-flow',
    version: '1.0.0',
    compat: { minAppVersion: '1.0.0' },
    flow: {
        title: 'Test Flow', description: 'A package made by a test.', preview: 'preview.webp',
        requiredModels: [MODEL], requiredDeps: [DEP], mediaType: 'image', type: 'edit',
        steps: [{ fields: [{ id: 'Input_Box.x', type: 'number' }] }],
    },
    op: {
        label: 'Flow: Test', mediaType: 'image', injector: 'headSwap',
        mediaInputs: [{ key: 'image1', mediaType: 'image', title: 'Input_Image', required: true }],
    },
});

function writePackage(folder, m = manifest(), g = graph(), files = ['preview.webp'], dir = path.join(FLOWS_DIR, folder)) {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    if (m !== null) fs.writeFileSync(path.join(dir, 'flow.json'), typeof m === 'string' ? m : JSON.stringify(m));
    if (g !== null) fs.writeFileSync(path.join(dir, 'workflow.json'), JSON.stringify(g));
    for (const f of files) fs.writeFileSync(path.join(dir, f), 'x');
    return dir;
}

/** Errors for the base package with one mutation applied. */
function errorsWith(mutate, mutateGraph = () => {}) {
    const m = manifest();
    const g = graph();
    mutate(m);
    mutateGraph(g);
    return uf.validatePackage(m, g, new Set(['preview.webp']), known);
}
const hasError = (errors, fragment) =>
    assert.ok(errors.some(e => e.includes(fragment)), `expected an error containing "${fragment}", got:\n${errors.join('\n')}`);

test.after(() => fs.rmSync(ROOT, { recursive: true, force: true }));

test('a valid package passes, and the scan lists it and skips dot-folders', () => {
    assert.deepEqual(errorsWith(() => {}), []);
    writePackage('test-flow');
    fs.mkdirSync(path.join(FLOWS_DIR, '.staging', 'half'), { recursive: true });
    const scanned = uf.scanUserFlows();
    assert.deepEqual(scanned.map(p => [p.id, p.errors]), [['test-flow', []]]);
});

// The renderer puts FlowDef strings into innerHTML under nodeIntegration, so markup in a
// manifest is code execution. Any string or key, at any depth, rejects the whole package.
test('markup anywhere in the manifest rejects the package', () => {
    for (const mutate of [
        m => { m.flow.description = 'Nice <img src=x onerror=alert(1)>'; },
        m => { m.flow.title = 'Say "hi"'; },
        m => { m.flow.steps[0].fields[0].label = '`${1}`'; },
        m => { m.op.label = 'a > b'; },
        m => { m.author = '<b>me</b>'; },
        m => { m.flow.modelParams = { [MODEL]: { 'x"y': 1 } }; },
    ]) {
        const errors = errorsWith(mutate);
        assert.ok(errors.length && errors.every(e => e.includes('not allowed in a Flow')), errors.join('\n'));
    }
    assert.deepEqual(errorsWith(m => { m.flow.description = 'Fabio’s “head” & shoulders — it’s fine'; }), []);
    // Never rendered raw: placeholders (MpiInput escapes) and graph-bound values.
    assert.deepEqual(errorsWith(m => {
        m.flow.steps[0].fields[0].placeholder = 'e.g. "a red car"';
        m.flow.modelParams = { [MODEL]: { 'Input_Box.x': '<|im_start|>' } };
        m.flow.enhance = { injectionParams: { Input_System_Prompt: '<|im_start|>system "x"' } };
    }), []);
});

test('ids the app does not declare are named, model slots included', () => {
    hasError(errorsWith(m => { m.flow.requiredDeps = ['no-such-dep']; }), 'Needs dependency "no-such-dep"');
    hasError(errorsWith(m => { m.flow.requiredModels = [{ label: 'x', models: [MODEL, 'no-such-model'] }]; }), 'Needs model "no-such-model"');
    hasError(errorsWith(m => { m.flow.requiredPlugins = ['no-such-plugin']; }), 'Needs plugin "no-such-plugin"');
    hasError(errorsWith(m => { m.flow.modelParams = { 'no-such-model': {} }; }), 'Needs model "no-such-model"');
    hasError(errorsWith(m => { m.op.injector = 'nope'; }), 'op.injector "nope"');
    hasError(errorsWith(m => { m.compat.minAppVersion = '99.0.0'; }), 'Needs app version 99.0.0 or later');
});

test('an Input_* the graph does not have is caught — the silent-skip case', () => {
    hasError(errorsWith(m => { m.op.mediaInputs[0].title = 'Input_Image_2'; }), 'names "Input_Image_2"');
    hasError(errorsWith(m => { m.flow.steps[0].fields[0].id = 'Input_Box_2.x'; }), 'names "Input_Box_2"');
    hasError(errorsWith(m => { m.flow.modelParams = { [MODEL]: { 'Input_Lora.strength': 1 } }; }), 'names "Input_Lora"');
    // Title matching is case-insensitive, exactly as comfyController injects.
    assert.deepEqual(errorsWith(m => { m.op.mediaInputs[0].title = 'input_image'; }), []);
    // A key the op's injector consumes needs no node: the injector writes it.
    const consumed = m => { m.op.injector = 'ltxSigmas'; m.flow.steps[0].fields.push({ id: 'Input_Denoise' }); };
    assert.deepEqual(errorsWith(consumed), []);
    hasError(errorsWith(m => { consumed(m); m.op.injector = 'resize'; }), 'names "Input_Denoise"');
});

test('graph rules and absolute paths', () => {
    hasError(errorsWith(() => {}, g => { g[4]._meta.title = 'save'; }), 'no capture node');
    hasError(errorsWith(() => {}, g => { g[1].inputs.string = 'C:\\Users\\me\\face.png'; }), 'absolute path');
    hasError(errorsWith(() => {}, g => { g[1].inputs.string = '/home/me/face.png'; }), 'absolute path');
    hasError(errorsWith(() => {}, g => { delete g[3].inputs.box; }), '"Input_Box" never reaches a capture node');
});

test('shape: ids, keys the app owns, required fields, preview files', () => {
    hasError(errorsWith(m => { m.id = 'Head Swap'; }), '"id" must be');
    hasError(errorsWith(m => { m.flow.id = 'x'; }), 'flow.id is not a Flow field — the app sets it');
    hasError(errorsWith(m => { m.op.universal = false; }), 'op.universal is not an op field');
    hasError(errorsWith(m => { delete m.flow.title; }), 'flow.title is required');
    hasError(errorsWith(m => { m.flow.type = 'make'; }), 'flow.type must be one of');
    hasError(errorsWith(m => { m.op.filePrefix = 'user:test'; }), 'op.filePrefix must be one camelCase word');
    hasError(errorsWith(m => { m.flow.video = 'hero.mp4'; }), 'flow.video: "hero.mp4" is not in the package folder');
    hasError(errorsWith(m => { m.flow.preview = '../preview.webp'; }), 'flow.preview must name a file');
    hasError(errorsWith(m => { delete m.op; }), '"op" is missing');
});

// The allowlists and the title law must describe REAL Flows, or the first MPI Flow
// republished as a package (MPI-781) is rejected by its own app. Two known exceptions:
// a `byModel` graph switch (a package carries one graph), and absolute paths baked into
// shipped graphs — harmless in the app, where the injector overwrites them, but a
// package must ship clean, so the rule stays.
test('every shipped Flow, expressed as a package, validates', () => {
    const { COMMANDS } = require('../js/data/commandRegistry.js');
    const { UNIVERSAL_WORKFLOWS } = require('../js/data/modelConstants/universal_workflows.js');
    const offenders = [];
    for (const { id, operation, workflow, ...flow } of FLOWS) {
        const uw = UNIVERSAL_WORKFLOWS[operation];
        if (uw.byModel) continue;
        const { universal, ...op } = COMMANDS[operation];
        const g = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'comfy_workflows', uw.workflow), 'utf8'));
        const m = { schema: uf.SCHEMA, id, version: '1.0.0', flow, op };
        const errors = uf.validatePackage(m, g, new Set([flow.preview, flow.video]), known)
            .filter(e => !e.includes('absolute path'));
        if (errors.length) offenders.push(`${id}: ${errors.join(' | ')}`);
    }
    assert.deepEqual(offenders, []);
});

test('loadPackage: unreadable files and a folder that is not named after the id', () => {
    const dir = writePackage('broken', '{ not json');
    assert.match(uf.loadPackage(dir).errors[0], /^flow\.json: /);
    assert.equal(uf.loadPackage(writePackage('no-graph', manifest(), null)).errors[0], 'workflow.json: missing');
    hasError(uf.loadPackage(writePackage('renamed')).errors, 'rename the folder to "test-flow"');
    for (const f of ['broken', 'no-graph', 'renamed']) fs.rmSync(path.join(FLOWS_DIR, f), { recursive: true });
});

test('packageFilePath only resolves plain files of a plain id', () => {
    assert.equal(uf.packageFilePath('test-flow', 'workflow.json'), path.join(FLOWS_DIR, 'test-flow', 'workflow.json'));
    for (const [id, file] of [['test-flow', '..'], ['test-flow', '../flow.json'], ['test-flow', 'a/b'],
        ['test-flow', 'a\\b'], ['test-flow', '.hidden'], ['..', 'flow.json'], ['Test-Flow', 'flow.json']]) {
        assert.equal(uf.packageFilePath(id, file), null, `${id}/${file} must not resolve`);
    }
});

test('routes: list, serve under the fetch paths, refuse traversal', async () => {
    const express = require('express');
    const app = express().use(require('../routes/userFlows'));
    const server = await new Promise(r => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
    const get = (p) => new Promise((resolve, reject) => {
        http.get({ host: '127.0.0.1', port: server.address().port, path: p }, (res) => {
            let body = '';
            res.on('data', c => { body += c; });
            res.on('end', () => resolve({ status: res.statusCode, body }));
        }).on('error', reject);
    });
    try {
        const list = await get('/user-flows');
        assert.equal(list.status, 200);
        assert.deepEqual(JSON.parse(list.body).flows.map(f => f.id), ['test-flow']);
        assert.equal((await get('/comfy_workflows/user-flows/test-flow/workflow.json')).status, 200);
        assert.equal((await get('/comfy_workflows/display/user-flows/test-flow/preview.webp')).status, 200);
        assert.equal((await get('/comfy_workflows/user-flows/test-flow/missing.json')).status, 404);
        assert.equal((await get('/comfy_workflows/user-flows/test-flow/..%2F..%2Fsecret.txt')).status, 404);
        assert.equal((await get('/comfy_workflows/user-flows/test-flow/..%5Cflow.json')).status, 404);
    } finally {
        server.close();
    }
});

test('an installed package keeps its deps through an unrelated uninstall', () => {
    const dm = require('../routes/downloadManager.js');
    assert.ok(dm._flowRequiredDepIds('krea2').has(DEP), 'an unrelated uninstall must keep a package dep');
    assert.ok(!dm._flowRequiredDepIds(flowDepKey('user:test-flow')).has(DEP), 'its own uninstall frees it');
});

/** A STORE-only zip — enough for extract-zip, no dependency. entries: [name, Buffer|string] */
function zipOf(entries) {
    const zlib = require('node:zlib');
    const parts = [];
    const central = [];
    let offset = 0;
    for (const [name, body] of entries) {
        const n = Buffer.from(name);
        const data = Buffer.from(body);
        const crc = zlib.crc32(data);
        const local = Buffer.alloc(30);
        local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4);
        local.writeUInt32LE(crc, 14); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22);
        local.writeUInt16LE(n.length, 26);
        const head = Buffer.alloc(46);
        head.writeUInt32LE(0x02014b50, 0); head.writeUInt16LE(20, 4); head.writeUInt16LE(20, 6);
        head.writeUInt32LE(crc, 16); head.writeUInt32LE(data.length, 20); head.writeUInt32LE(data.length, 24);
        head.writeUInt16LE(n.length, 28); head.writeUInt32LE(offset, 42);
        parts.push(local, n, data);
        central.push(head, n);
        offset += 30 + n.length + data.length;
    }
    const cd = Buffer.concat(central);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
    end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
    return Buffer.concat([...parts, cd, end]);
}

test('install: a dropped folder or zip lands whole, or not at all', async () => {
    const SRC = path.join(ROOT, 'downloads');
    fs.rmSync(path.join(FLOWS_DIR, '.staging', 'half'), { recursive: true, force: true });  // the first test's
    const drop = () => ({ ...manifest(), id: 'drop-flow' });
    const dest = path.join(FLOWS_DIR, 'drop-flow');
    const staged = () => fs.readdirSync(path.join(FLOWS_DIR, '.staging'));
    const pkgFiles = (m = drop()) => [
        ['flow.json', JSON.stringify(m)], ['workflow.json', JSON.stringify(graph())], ['preview.webp', 'x'],
    ];

    // A folder named anything installs under its manifest id.
    const folder = writePackage(null, drop(), graph(), ['preview.webp'], path.join(SRC, 'Drop Flow v1'));
    let r = await uf.installPackage(folder);
    assert.equal(r.status, 'installed');
    assert.deepEqual(r.entry.errors, []);
    assert.ok(fs.existsSync(path.join(dest, 'flow.json')));
    assert.ok(fs.existsSync(path.join(folder, 'flow.json')), 'the source is copied, never moved');

    // Again: exists, untouched — then replaced on overwrite.
    fs.writeFileSync(path.join(dest, 'marker.txt'), 'old');
    r = await uf.installPackage(folder);
    assert.deepEqual([r.status, r.id, r.title], ['exists', 'drop-flow', 'Test Flow']);
    assert.ok(fs.existsSync(path.join(dest, 'marker.txt')));
    r = await uf.installPackage(folder, { overwrite: true });
    assert.equal(r.status, 'installed');
    assert.ok(!fs.existsSync(path.join(dest, 'marker.txt')), 'overwrite replaces the whole folder');

    // A zip of a folder (the Gumroad shape), with macOS noise beside it.
    fs.rmSync(dest, { recursive: true });
    const zipped = path.join(SRC, 'drop-flow.zip');
    fs.writeFileSync(zipped, zipOf([
        ...pkgFiles().map(([n, b]) => [`drop-flow/${n}`, b]),
        ['__MACOSX/drop-flow/._flow.json', 'x'],
    ]));
    r = await uf.installPackage(zipped);
    assert.equal(r.status, 'installed');
    assert.ok(fs.existsSync(path.join(dest, 'workflow.json')));

    // Invalid: reported, nothing written.
    fs.rmSync(dest, { recursive: true });
    const bad = drop();
    bad.flow.requiredDeps = ['no-such-dep'];
    fs.writeFileSync(zipped, zipOf(pkgFiles(bad)));
    r = await uf.installPackage(zipped);
    assert.equal(r.status, 'invalid');
    assert.match(r.errors[0], /Needs dependency "no-such-dep"/);
    assert.ok(!fs.existsSync(dest));
    r = await uf.installPackage(path.join(SRC, 'Drop Flow v1', 'preview.webp'));
    assert.deepEqual(r, { status: 'invalid', errors: ['Drop a Flow folder or its .zip.'] });
    fs.writeFileSync(zipped, zipOf([['readme.txt', 'hi'], ['a/x.txt', '1'], ['b/y.txt', '2']]));
    assert.match((await uf.installPackage(zipped)).errors[0], /No flow\.json found/);

    // Zip-slip: refused by extract-zip, nothing escapes staging.
    fs.writeFileSync(zipped, zipOf([...pkgFiles(), ['../../escaped.txt', 'x']]));
    await assert.rejects(uf.installPackage(zipped));
    assert.ok(!fs.existsSync(path.join(FLOWS_DIR, 'escaped.txt')) && !fs.existsSync(path.join(ROOT, 'escaped.txt')));
    assert.ok(!fs.existsSync(dest));
    assert.deepEqual(staged(), [], 'staging is always cleaned');
});

// A portable update replaces the app and keeps `user-data/`; packages must live under it.
test('installed packages survive an app update', () => {
    const read = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8');
    assert.equal(uf.userFlowsDir(), path.join(ROOT, 'user_flows'), 'packages live under APP_USER_DATA');
    const main = read('main.js');
    assert.match(main, /path\.join\(resolveMainPortableRoot\(\), 'user-data'\)/, 'a portable build keeps userData in <root>/user-data');
    assert.match(main, /APP_USER_DATA: userDataPath/, 'the server fork is handed that userData');
    const preserve = read('scripts', 'build-portable.mjs').match(/const PRESERVE = \[([\s\S]*?)\];/);
    assert.ok(preserve, 'build-portable.mjs still declares PRESERVE');
    assert.match(preserve[1], /'user-data\/'/, 'the update preserve list keeps user-data/');
});

// LAST: it mutates the shared FLOWS/COMMANDS module instances.
test('renderer: a package registers into the registries a built-in Flow uses', async () => {
    const esm = p => import('file://' + path.join(__dirname, '..', p).replace(/\\/g, '/'));
    const { registerUserFlow, loadUserFlows } = await esm('js/services/userFlowService.js');
    const reg = await esm('js/data/flowsRegistry.js');
    const { getCommand, getFilePrefix, getCommandMediaInputs } = await esm('js/data/commandRegistry.js');
    const { getUniversalWorkflow } = await esm('js/data/modelRegistry.js');
    const before = reg.FLOWS.length;
    const broken = { id: 'broken', manifest: { flow: { title: '<b>x</b>', preview: '../x' } }, errors: ['Needs model "nope", which this version of the app does not have.'] };
    const realFetch = global.fetch;
    global.fetch = async (url) => ({
        ok: true,
        json: async () => (url === '/user-flows' ? { flows: [{ id: 'test-flow', manifest: manifest(), errors: [] }, broken] } : {}),
    });
    try { await loadUserFlows(); } finally { global.fetch = realFetch; }

    const flow = reg.getFlowById('user:test-flow');
    assert.equal(flow.operation, 'user:test-flow');
    assert.equal(flow.preview, 'user-flows/test-flow/preview.webp');
    assert.equal(getUniversalWorkflow('user:test-flow'), 'user-flows/test-flow/workflow.json');
    assert.equal(getCommand('user:test-flow').injector, 'headSwap');
    assert.equal(getCommand('user:test-flow').universal, true);
    // Never the key: a colon is not a legal Windows filename character.
    assert.equal(getFilePrefix('user:test-flow'), 'flowTestFlow');
    assert.deepEqual(getCommandMediaInputs('user:test-flow').map(s => s.title), ['Input_Image']);
    assert.equal(reg.flowAvailability(flow).reason, undefined);

    const off = reg.getFlowById('user:broken');
    assert.equal(off.title, 'broken', 'a title carrying markup falls back to the folder name');
    assert.equal(off.preview, undefined);
    assert.equal(reg.flowAvailability(off).available, false);
    assert.match(reg.flowAvailability(off).reason, /^Needs model "nope"/);
    assert.equal(getCommand('user:broken'), null);

    registerUserFlow({ id: 'test-flow', manifest: manifest(), errors: [] });
    assert.equal(reg.FLOWS.length, before + 2, 're-registering replaces, never duplicates');
    registerUserFlow({ id: 'test-flow', manifest: manifest(), errors: ['broken now'] });
    assert.equal(getCommand('user:test-flow'), null, 'a reinstall that breaks it removes the op');
    assert.equal(reg.flowAvailability('user:test-flow').reason, 'broken now');

    // Refresh: a package whose folder is gone leaves every registry; a failed scan prunes nothing.
    const { UNIVERSAL_WORKFLOWS } = await esm('js/data/modelConstants/universal_workflows.js');
    registerUserFlow({ id: 'test-flow', manifest: manifest(), errors: [] });
    const scan = async (res) => {
        global.fetch = async () => res;
        try { await loadUserFlows(); } finally { global.fetch = realFetch; }
    };
    await scan({ ok: false, status: 500 });
    assert.ok(reg.getFlowById('user:test-flow') && getCommand('user:test-flow'), 'a failed scan keeps what is registered');
    await scan({ ok: true, json: async () => ({ flows: [broken] }) });
    assert.equal(reg.getFlowById('user:test-flow'), null);
    assert.equal(getCommand('user:test-flow'), null);
    assert.ok(!('user:test-flow' in UNIVERSAL_WORKFLOWS));
    assert.ok(reg.getFlowById('user:broken'), 'a package still on disk stays');
    assert.equal(reg.FLOWS.length, before + 1);
    assert.ok(reg.FLOWS.slice(0, before).every(f => !f.id.startsWith('user:')), 'built-in Flows untouched');
});
