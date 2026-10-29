// MPI-1326 - Restart engine with a CPU (download-only) Pod connected.
//
// Fabio, 2026-10-29: generations were running locally with a CPU Pod connected; a model
// install finished on the Pod and he pressed Restart. The restart picked the Pod because a
// Pod was connected (isRemote), the Pod has no ComfyUI, its wrapper answered 409, and the
// user got a "Restart failed: restart-comfy 409" dialog. getEngine already says a
// download-only Pod is never the engine, so the restart follows the same rule.
//
// navigation.js pulls in the whole shell, so `_restartsPod` is lifted out of the source and
// run against the real remoteEngineClient; the wiring is pinned by source.

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const repo = path.join(__dirname, '..');
const mod = (...p) => pathToFileURL(path.join(repo, ...p)).href;
const json = (body) => Promise.resolve({ ok: true, json: async () => body });

let mode = { active: false, noGpu: false, gpuTypeId: null };
globalThis.fetch = (url) => {
    if (url === '/log') return Promise.resolve({});
    if (url === '/remote/mode') return json(mode);
    if (url === '/remote/ws-token') return json({ wsBase: null, token: null });
    if (url === '/system/gpu-info') return json({ gpu: { arch: 'modern' } });
    return new Promise(() => {});
};
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };

const nav = fs.readFileSync(path.join(repo, 'js', 'shell', 'navigation.js'), 'utf8');
const src = nav.slice(nav.indexOf('function _restartsPod()'));
const restartsPodSrc = src.slice(0, src.indexOf('\n}\n') + 2);

let remoteEngineClient, restartsPod;
test.before(async () => {
    ({ remoteEngineClient } = await import(mod('js', 'services', 'remoteEngineClient.js')));
    restartsPod = new Function('remoteEngineClient', `${restartsPodSrc}; return _restartsPod;`)(remoteEngineClient);
});

const restartTargetWith = async (m) => { mode = m; await remoteEngineClient.refresh(); return restartsPod() ? 'pod' : 'local'; };

test('a CPU Pod is never the engine a restart targets', async () => {
    assert.strictEqual(await restartTargetWith({ active: true, noGpu: true, gpuTypeId: null }), 'local');
});

test('a GPU Pod is restarted on the Pod; no Pod restarts the local engine', async () => {
    assert.strictEqual(await restartTargetWith({ active: true, noGpu: false, gpuTypeId: 'RTX 4090' }), 'pod');
    assert.strictEqual(await restartTargetWith({ active: false, noGpu: false, gpuTypeId: null }), 'local');
});

test('both restart paths pick the engine through _restartsPod, and the toast says why', () => {
    for (const fn of ['async function _restartEngine()', 'async function _restartEngineNow()']) {
        const body = nav.slice(nav.indexOf(fn), nav.indexOf('\n}\n', nav.indexOf(fn)));
        assert.match(body, /const remote = _restartsPod\(\);/, `${fn} must not use isRemote() alone`);
    }
    const perf = nav.slice(nav.indexOf('async function _performRestart'));
    assert.match(perf.slice(0, 600), /isDownloadOnly\(\)[\s\S]*CPU Pod/, 'the start toast names the CPU Pod');
});
