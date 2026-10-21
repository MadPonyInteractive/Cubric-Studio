// MPI-1222 - the dev radial's Restart engine restarts NOW, even mid-generation.
//
// Fabio, 2026-10-21: a second ComfyUI on the same GPU starved his engine, a generation hung,
// and the dev radial's Restart did nothing: MPI-805 scheduled it for when the queue drained,
// which the hung generation never let happen. The radial now stops the running job through
// the queue's own Stop (so its row ends cancelled) and restarts at once; Settings keeps the
// wait.
//
// `cancelRunningOnLane` runs on the real module, stubbed as in cue-dispatch-stall.test.cjs
// (a connected CPU Pod puts gens on the local lane; every engine request hangs, so a
// dispatched job parks in its lane). The navigation wiring is pinned by source: that module
// pulls in the whole shell.

'use strict';

const test = require('node:test');
const { mock } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const repo = path.join(__dirname, '..');
const mod = (...p) => pathToFileURL(path.join(repo, ...p)).href;
const json = (body) => Promise.resolve({ ok: true, json: async () => body });

globalThis.fetch = (url) => {
    if (url === '/log') return Promise.resolve({});
    if (url === '/remote/mode') return json({ active: true, noGpu: true, gpuTypeId: null });
    if (url === '/remote/ws-token') return json({ wsBase: null, token: null });
    if (url === '/system/gpu-info') return json({ gpu: { arch: 'modern' } });
    return new Promise(() => {});
};
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };

let enqueueGeneration, peekCueQueue, cancelRunningOnLane, generationStore, remoteEngineClient, Events;
test.before(async () => {
    mock.timers.enable({ apis: ['setTimeout'] });
    ({ enqueueGeneration, peekCueQueue, cancelRunningOnLane } = await import(mod('js', 'services', 'generationService.js')));
    ({ generationStore } = await import(mod('js', 'services', 'generationStore.js')));
    ({ remoteEngineClient } = await import(mod('js', 'services', 'remoteEngineClient.js')));
    ({ Events } = await import(mod('js', 'events.js')));
    await remoteEngineClient.refresh();
});
test.after(() => mock.timers.reset());

const config = (positive) => ({ operation: 't2i', model: { id: 'krea2', mediaType: 'image' }, positive, negative: '', injectionParams: {} });
const running = () => generationStore.getSnapshot().running;
const pending = (id) => peekCueQueue().some((j) => j.queueJobId === id);
const until = async (cond) => { for (let i = 0; i < 200 && !cond(); i++) { mock.timers.tick(0); await new Promise((r) => setImmediate(r)); } };

test('the running job on the restarted lane is stopped as cancelled; other lanes are left alone', async () => {
    const cancelled = [];
    const off = Events.on('generation:cancelled', (e) => cancelled.push(e));

    const a = enqueueGeneration(config('a red apple on a table'), {});
    const b = enqueueGeneration(config('a green pear on a table'), {});
    await until(() => running().length === 1);
    const [jobA] = running();
    assert.strictEqual(jobA.lane, 'local');

    cancelRunningOnLane('remote');
    assert.ok(running().some((j) => j.jobId === jobA.jobId), 'a restart of the OTHER engine must not touch this job');
    assert.strictEqual(cancelled.length, 0);

    cancelRunningOnLane('local');
    assert.ok(!running().some((j) => j.jobId === jobA.jobId), 'the hung job is stopped');
    assert.strictEqual(cancelled.length, 1, 'its row ends as cancelled, visibly');
    assert.strictEqual(cancelled[0].byUser, true);
    await until(() => !pending(b.queueJobId));
    assert.ok(!pending(b.queueJobId), 'the queued job behind it is kept and promoted, not dropped');
    assert.ok(a.queueJobId);

    cancelRunningOnLane('local');
    off();
});

test('an idle lane is a no-op', () => {
    assert.doesNotThrow(() => cancelRunningOnLane('remote'));
});

test('the radial restarts now; Settings keeps MPI-805\'s wait', () => {
    const nav = fs.readFileSync(path.join(repo, 'js', 'shell', 'navigation.js'), 'utf8');
    assert.match(nav, /action === 'restart-engine'\) \{\s*_restartEngineNow\(\);/, 'the radial takes the restart-now path');
    assert.match(nav, /Events\.on\('engine:restart', \(\) => _restartEngine\(\)\);/, 'Settings still schedules on a busy queue');

    const now = nav.slice(nav.indexOf('async function _restartEngineNow'));
    const nowBody = now.slice(0, now.indexOf('async function _performRestart'));
    assert.ok(nowBody.length > 0 && nowBody.length < 1500, 'restart-now still sits just above _performRestart');
    assert.ok(!/waitForIdleQueue/.test(nowBody), 'restart-now must not wait on the queue');
    assert.match(nowBody, /cancelRunningOnLane\(remote \? 'remote' : 'local'\)/);

    // Local: the cancel runs AFTER /comfy/stop and the exit wait, so a pending job the cancel
    // promotes meets a stopped engine (which the generation gate starts), not the dying one.
    const perf = nav.slice(nav.indexOf('async function _performRestart'));
    const stopAt = perf.indexOf("fetch('/comfy/stop'");
    const hookAt = perf.indexOf('onStopped?.()', stopAt);
    const startAt = perf.indexOf("fetch('/comfy/start'");
    assert.ok(stopAt > 0 && hookAt > stopAt && hookAt < startAt, 'local cancel sits between stop and start');
});
