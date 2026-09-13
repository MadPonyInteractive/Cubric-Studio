'use strict';

// MPI-728 phase 3 — starting, installing and downloading into Ollama.
// Run: node --test tests/ollama-lifecycle.test.cjs
//
// What is worth pinning, and why:
//  1. **The launch ladder.** An Ollama that answers is used as-is; a stopped one is
//     launched; ENOENT is the not-installed signal. On Windows the launched thing is
//     the DESKTOP APP, detached, because `ollama serve` there is a console child that
//     would hold a terminal window open for the server's whole life.
//  2. **The model folder (Cubric Prompt MPI-17).** A bare `serve` must be handed the
//     folder the Ollama app was configured with, in the child's env only, or the
//     user's models read as gone.
//  3. **Download progress.** Ollama reports layers one at a time and a failure as an
//     `{error}` line on a 200, so a naive reader shows a bar that falls back to zero
//     and calls a failed download a success.

const test = require('node:test');
const assert = require('node:assert');
const { EventEmitter } = require('node:events');
const childProcess = require('child_process');
const fs = require('fs');

/** A spawned child that reports `err` (if any) on the next tick. */
function fakeChild(err) {
    const child = Object.assign(new EventEmitter(), { unref() {} });
    if (err) process.nextTick(() => child.emit('error', err));
    return child;
}

// The lifecycle destructures `spawn` / `execFile` at require time (the windows-hide
// scanner cannot see `childProcess.spawn(`), so the mocks must exist before it loads.
const spawnMock = test.mock.method(childProcess, 'spawn', () => fakeChild());
const execFileMock = test.mock.method(childProcess, 'execFile', () => {});
const lifecycle = require('../services/ollamaLifecycle.js');

const APP_DATA = 'C:\\Users\\someone\\AppData\\Local';

/** Pretend to be `platform` for the length of one test. */
function asPlatform(t, platform) {
    const original = Object.getOwnPropertyDescriptor(process, 'platform');
    Object.defineProperty(process, 'platform', { value: platform });
    const env = process.env.LOCALAPPDATA;
    process.env.LOCALAPPDATA = APP_DATA;
    t.after(() => {
        Object.defineProperty(process, 'platform', original);
        process.env.LOCALAPPDATA = env;
    });
}

/** Ollama's health probe answers `up[n]` on the nth call; the last value repeats. */
function stubHealth(t, ...up) {
    let i = 0;
    t.mock.method(globalThis, 'fetch', async () => {
        if (!up[Math.min(i++, up.length - 1)]) throw new Error('ECONNREFUSED');
        return { ok: true };
    });
}

const lastSpawn = () => spawnMock.mock.calls[spawnMock.mock.calls.length - 1].arguments;

test('an Ollama that already answers is used as-is and never launched', async (t) => {
    asPlatform(t, 'win32');
    stubHealth(t, true);
    const before = spawnMock.mock.callCount();
    assert.strictEqual(await lifecycle.ensureOllama(), 'running');
    assert.strictEqual(spawnMock.mock.callCount(), before);
});

test('on Windows the desktop app is launched detached, with no arguments', async (t) => {
    asPlatform(t, 'win32');
    stubHealth(t, false, true);
    t.mock.method(fs, 'existsSync', () => true);
    spawnMock.mock.mockImplementation(() => fakeChild());

    assert.strictEqual(await lifecycle.ensureOllama(), 'started');
    const [cmd, args, opts] = lastSpawn();
    assert.ok(cmd.endsWith('ollama app.exe'), cmd);
    assert.ok(cmd.startsWith(APP_DATA), cmd);
    assert.deepStrictEqual(args, []);
    assert.strictEqual(opts.detached, true);
});

test('without the app, a bare serve gets the app\'s model folder and no terminal', async (t) => {
    asPlatform(t, 'win32');
    stubHealth(t, false, true);
    t.mock.method(fs, 'existsSync', () => false);
    // Two server starts in one log: the folder was moved, and the latest must win.
    const log = 'OLLAMA_MODELS:C:\\\\Users\\\\someone\\\\.ollama\\\\models OLLAMA_NUM_PARALLEL:1\n'
        + 'OLLAMA_MODELS:H:\\\\OllamaModels OLLAMA_NUM_PARALLEL:1\n';
    t.mock.method(fs, 'openSync', () => 42);
    t.mock.method(fs, 'readSync', (_fd, buf) => buf.write(log, 0, 'utf8'));
    t.mock.method(fs, 'closeSync', () => {});
    spawnMock.mock.mockImplementation(() => fakeChild());

    assert.strictEqual(await lifecycle.ensureOllama(), 'started');
    const [cmd, args, opts] = lastSpawn();
    assert.strictEqual(cmd, 'ollama');
    assert.deepStrictEqual(args, ['serve']);
    assert.strictEqual(opts.env.OLLAMA_MODELS, 'H:\\OllamaModels');
    // Detached would give a console child a terminal window for its whole life.
    assert.strictEqual(opts.detached, false);
    assert.strictEqual(opts.windowsHide, true);
});

test('ENOENT from the launch means Ollama is not installed', async (t) => {
    asPlatform(t, 'linux');
    stubHealth(t, false);
    spawnMock.mock.mockImplementation(() => fakeChild(Object.assign(new Error('spawn ollama ENOENT'), { code: 'ENOENT' })));
    assert.strictEqual(await lifecycle.ensureOllama(), 'missing');
});

test('the settings row and an enhance asking at once launch Ollama once', async (t) => {
    asPlatform(t, 'linux');
    stubHealth(t, false, false, true);
    spawnMock.mock.mockImplementation(() => fakeChild());
    const before = spawnMock.mock.callCount();

    const [a, b] = await Promise.all([lifecycle.ensureOllama(), lifecycle.ensureOllama()]);
    assert.strictEqual(a, 'started');
    assert.strictEqual(b, 'started');
    assert.strictEqual(spawnMock.mock.callCount(), before + 1);
});

test('the model folder is parsed from server.log, Go-quoted backslashes and all', () => {
    assert.strictEqual(lifecycle.parseOllamaModelsDir('x OLLAMA_MODELS:H:\\\\OllamaModels y'), 'H:\\OllamaModels');
    assert.strictEqual(lifecycle.parseOllamaModelsDir('OLLAMA_HOST:127.0.0.1'), undefined);
    assert.strictEqual(lifecycle.parseOllamaModelsDir(''), undefined);
});

test('winget installs, then Ollama is started; elsewhere nothing is attempted', async (t) => {
    asPlatform(t, 'linux');
    assert.strictEqual(lifecycle.installOllama(), false);
    assert.strictEqual(execFileMock.mock.callCount(), 0);

    asPlatform(t, 'win32');
    stubHealth(t, true);
    let finish;
    execFileMock.mock.mockImplementation((_cmd, _args, _opts, cb) => { finish = cb; });
    assert.strictEqual(lifecycle.installOllama(), true);
    assert.deepStrictEqual(lifecycle.installState(), { status: 'installing' });

    const [cmd, args, opts] = execFileMock.mock.calls[0].arguments;
    assert.strictEqual(cmd, 'winget');
    assert.ok(args.includes('Ollama.Ollama'));
    assert.strictEqual(opts.windowsHide, true);

    await finish(null);
    assert.deepStrictEqual(lifecycle.installState(), { status: 'done' });
});

test('a failed winget reports failed, so the row can offer the download page', async (t) => {
    asPlatform(t, 'win32');
    execFileMock.mock.mockImplementation((_cmd, _args, _opts, cb) => cb(new Error('winget exited 1')));
    lifecycle.installOllama();
    assert.strictEqual(lifecycle.installState().status, 'failed');
});

/** A fetch reply whose body streams `chunks` (strings) the way undici does. */
function streamed(chunks) {
    const enc = new TextEncoder();
    return {
        ok: true,
        body: (async function* () { for (const c of chunks) yield enc.encode(c); })(),
    };
}

async function waitDone(name) {
    while (!lifecycle.pullState(name)?.done) await new Promise((r) => setImmediate(r));
    return lifecycle.pullState(name);
}

test('download progress sums every layer, even with lines split across chunks', async (t) => {
    const lines = [
        { status: 'pulling manifest' },
        { status: 'pulling a', digest: 'sha256:a', total: 100, completed: 40 },
        { status: 'pulling a', digest: 'sha256:a', total: 100, completed: 100 },
        { status: 'pulling b', digest: 'sha256:b', total: 10, completed: 10 },
        { status: 'success' },
    ].map((l) => JSON.stringify(l)).join('\n');
    // Cut mid-JSON, so a reader that parses each chunk as whole lines throws.
    t.mock.method(globalThis, 'fetch', async () => streamed([lines.slice(0, 57), lines.slice(57)]));

    lifecycle.startPull('test/progress:1b');
    const job = await waitDone('test/progress:1b');
    assert.strictEqual(job.error, null);
    assert.strictEqual(job.total, 110);
    assert.strictEqual(job.completed, 110);
});

test('an {error} line on a 200 is a failed download, not a success', async (t) => {
    t.mock.method(globalThis, 'fetch', async () => streamed([
        '{"status":"pulling manifest"}\n{"error":"pull model manifest: file does not exist"}\n',
    ]));
    lifecycle.startPull('test/missing:1b');
    const job = await waitDone('test/missing:1b');
    assert.match(job.error, /file does not exist/);
});

test('a stream that ends before success is a failed download', async (t) => {
    t.mock.method(globalThis, 'fetch', async () => streamed([
        '{"status":"pulling a","digest":"sha256:a","total":100,"completed":30}\n',
    ]));
    lifecycle.startPull('test/cut:1b');
    const job = await waitDone('test/cut:1b');
    assert.match(job.error, /ended before it finished/);
});

test('presence checks compare tagged names, and sizes come from the registry', async (t) => {
    const { ollamaTagged, ollamaDownloadSize } = await import('../services/llmEngines.mjs');
    assert.strictEqual(ollamaTagged('gemma4:e4b'), 'gemma4:e4b');
    assert.strictEqual(ollamaTagged('huihui_ai/dolphin3-abliterated'), 'huihui_ai/dolphin3-abliterated:latest');
    assert.strictEqual(ollamaTagged('huihui_ai/gemma-4-abliterated:12b'), 'huihui_ai/gemma-4-abliterated:12b');

    const urls = [];
    t.mock.method(globalThis, 'fetch', async (url) => {
        urls.push(url);
        return { ok: true, json: async () => ({ layers: [{ size: 9608338848 }, { size: 11355 }, { size: 42 }] }) };
    });
    assert.strictEqual(await ollamaDownloadSize('gemma4:e4b'), 9608338848 + 11355 + 42);
    await ollamaDownloadSize('huihui_ai/dolphin3-abliterated');
    assert.deepStrictEqual(urls, [
        'https://registry.ollama.ai/v2/library/gemma4/manifests/e4b',
        'https://registry.ollama.ai/v2/huihui_ai/dolphin3-abliterated/manifests/latest',
    ]);

    t.mock.method(globalThis, 'fetch', async () => ({ ok: false }));
    assert.strictEqual(await ollamaDownloadSize('gemma4:e4b'), null);
});
