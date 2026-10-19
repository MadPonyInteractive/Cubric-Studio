// MPI-1203 - a download-mode (CPU) Pod wedged the Cue, and nothing said so.
//
// Fabio, 2026-10-19: History-workspace upscales sat as one RUNNING row with every later job
// pending behind it, the status bar IDLE and nothing in app.log. A CPU Pod was connected. The
// executor runs such a Pod's gens on LOCAL (MPI-539), but the Cue's `_laneOf` still read
// `isRemote()` and parked the job's intent on REMOTE. The finished job drained the local store
// lane, the remote intent never cleared, and nothing behind it could start.
//
// Measured on the real module: `fetch` answers the remote mirror's three reads (a connected CPU
// Pod) and captures `/log`; every other request hangs, so a dispatched job parks in its lane
// with its store job registered and no request reaches a running app.

'use strict';

const test = require('node:test');
const { mock } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const mod = (...p) => pathToFileURL(path.join(__dirname, '..', ...p)).href;
const json = (body) => Promise.resolve({ ok: true, json: async () => body });

const logLines = [];
let modeHangs = false;
globalThis.fetch = (url, init) => {
    if (url === '/log') {
        logLines.push(JSON.parse(init.body).message);
        return Promise.resolve({});
    }
    if (url === '/remote/mode') return modeHangs ? new Promise(() => {}) : json({ active: true, noGpu: true, gpuTypeId: null });
    if (url === '/remote/ws-token') return json({ wsBase: null, token: null });
    if (url === '/system/gpu-info') return json({ gpu: { arch: 'modern' } });
    return new Promise(() => {});
};
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };

let enqueueGeneration, peekCueQueue, generationStore, remoteEngineClient;
// Every dispatch arms a 30 s stall timer; real ones would hold the run open that long.
test.before(async () => {
    mock.timers.enable({ apis: ['setTimeout'] });
    ({ enqueueGeneration, peekCueQueue } = await import(mod('js', 'services', 'generationService.js')));
    ({ generationStore } = await import(mod('js', 'services', 'generationStore.js')));
    ({ remoteEngineClient } = await import(mod('js', 'services', 'remoteEngineClient.js')));
    await remoteEngineClient.refresh();
});

const config = (positive) => ({ operation: 't2i', model: { id: 'krea2', mediaType: 'image' }, positive, negative: '', injectionParams: {} });
const running = () => generationStore.getSnapshot().running;
const pending = (id) => peekCueQueue().some((j) => j.queueJobId === id);
// setTimeout is mocked, so wait on setImmediate and run the lane's 0 ms promotion by hand.
const until = async (cond) => { for (let i = 0; i < 200 && !cond(); i++) { mock.timers.tick(0); await new Promise((r) => setImmediate(r)); } };
test.after(() => mock.timers.reset());

test('with a CPU Pod connected, a finished job frees its lane and the next one starts', async () => {
    assert.strictEqual(remoteEngineClient.isDownloadOnly(), true, 'the stub reads as a connected CPU Pod');

    const a = enqueueGeneration(config('a red apple on a table'), {});
    const b = enqueueGeneration(config('a green pear on a table'), {});
    await until(() => running().length === 1);
    const [jobA] = running();
    assert.strictEqual(jobA.lane, 'local', 'the executor runs a CPU Pod gen on the local engine');
    assert.ok(pending(b.queueJobId), 'the second job waits behind the first');

    generationStore.cancel(jobA.jobId); // A reaches a terminal: its lane drains
    await until(() => !pending(b.queueJobId));
    assert.ok(!pending(b.queueJobId), 'the second job left the queue: the first one\'s lane was freed');
    await until(() => running().some((j) => j.jobId !== jobA.jobId));
    assert.ok(running().some((j) => j.jobId !== jobA.jobId), 'and it is running');
    assert.ok(a.queueJobId);

    for (const j of running()) generationStore.cancel(j.jobId);
});

test('a job holding its lane with no store job writes a warning to app.log', async () => {
    await until(() => running().length === 0);
    modeHangs = true; // the executor's head now never reaches registration
    const c = enqueueGeneration(config('a yellow lemon on a table'), {});
    assert.ok(c?.queueJobId);
    assert.ok(!pending(c.queueJobId), 'dispatched at once: the lane was idle');
    mock.timers.tick(29_000);
    assert.ok(!logLines.some((l) => /holds the local lane/.test(l)), 'quiet inside the window');
    mock.timers.tick(1_000);
    const lines = logLines.filter((l) => /holds the local lane/.test(l));
    assert.strictEqual(lines.length, 1, 'warned once, for this job only: the earlier jobs had store jobs');
    assert.match(lines[0], new RegExp(`Cue job ${c.queueJobId} \\(t2i\\)`));
});
