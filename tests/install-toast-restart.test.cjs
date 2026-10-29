// MPI-1247 — the "installed" toast offers Restart engine when the install needs one.
//
// Fabio, 2026-10-22: a model install that adds custom nodes flags the engine for a
// restart, and the next generation then waits for it (on a Pod, plus the fast-disk
// staging). The toast now carries a Restart engine button whenever the active engine's
// restart flag is set. Drives the REAL notificationService with StatusBar.notify
// captured; the two wiring halves it depends on are pinned by source.

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

globalThis.window = {
    addEventListener() {}, removeEventListener() {},
    setTimeout: (...a) => setTimeout(...a),
    matchMedia: () => ({ matches: false, addEventListener() {} }),
};
globalThis.document = {
    hasFocus: () => true,
    addEventListener() {}, removeEventListener() {},
    querySelector: () => null, querySelectorAll: () => [], getElementById: () => null,
    createElement: () => ({
        style: {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
        appendChild() {}, setAttribute() {}, addEventListener() {},
    }),
    body: { appendChild() {} },
    documentElement: { style: { setProperty() {} } },
};
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.fetch = async () => ({ ok: true, json: async () => ({}) });

const repo = path.join(__dirname, '..');
const SRC = require('node:url').pathToFileURL(path.join(repo, 'js') + path.sep).href;

test('installed toast carries Restart engine only while a restart is pending', async () => {
    const [notif, { Events }, { state }, { StatusBar }] = await Promise.all([
        import(SRC + 'shell/notificationService.js'),
        import(SRC + 'events.js'),
        import(SRC + 'state.js'),
        import(SRC + 'shell/statusBar.js'),
    ]);
    const toasts = [];
    StatusBar.notify = (message, variant, duration, opts) => toasts.push({ message, opts });
    let restarts = 0;
    const off = Events.on('engine:restart', () => restarts++);
    notif.destroyNotificationService();
    notif.initNotificationService();

    // MPI-1272: a local node install sets comfyNodesPending, not comfyNeedsRestart.
    state.comfyNodesPending = false;
    Events.emit('download:complete', { modelId: 'some-model', engine: 'local' });
    state.comfyNodesPending = true;
    Events.emit('download:complete', { modelId: 'some-model', engine: 'local' });
    notif.destroyNotificationService();
    state.comfyNodesPending = false;

    assert.strictEqual(toasts.length, 2);
    assert.strictEqual(toasts[0].opts, undefined);
    assert.strictEqual(toasts[1].opts.action.text, 'Restart engine');
    assert.match(toasts[1].message, /restarts the first time you use it/,
        'a local install no longer restarts before the NEXT generation, only before one that needs it');
    toasts[1].opts.action.onClick();
    off();
    assert.strictEqual(restarts, 1);
});

// MPI-1328 — Fabio, 2026-10-29: a model installed through a CPU (download-only) Pod offered
// Restart engine, and the Pod has no engine. The toast now follows the job's engine.
test('a Pod install offers Restart on a GPU Pod, and only says "installed" on a CPU Pod', async () => {
    const [notif, { Events }, { state }, { StatusBar }, { remoteEngineClient }] = await Promise.all([
        import(SRC + 'shell/notificationService.js'),
        import(SRC + 'events.js'),
        import(SRC + 'state.js'),
        import(SRC + 'shell/statusBar.js'),
        import(SRC + 'services/remoteEngineClient.js'),
    ]);
    const toasts = [];
    StatusBar.notify = (message, variant, duration, opts) => toasts.push({ message, opts });
    const podWith = async (noGpu) => {
        globalThis.fetch = async (url) => ({ ok: true, json: async () => (url === '/remote/mode' ? { active: true, noGpu } : {}) });
        await remoteEngineClient.refresh();
    };
    notif.destroyNotificationService();
    notif.initNotificationService();
    state.remoteComfyNeedsRestart = true;

    await podWith(true);
    Events.emit('download:complete', { modelId: 'some-model', engine: 'remote' });
    await podWith(false);
    Events.emit('download:complete', { modelId: 'some-model', engine: 'remote' });

    // A LOCAL install with a CPU Pod connected still offers the local restart.
    await podWith(true);
    state.comfyNodesPending = true;
    Events.emit('download:complete', { modelId: 'some-model', engine: 'local' });

    notif.destroyNotificationService();
    state.remoteComfyNeedsRestart = false;
    state.comfyNodesPending = false;
    globalThis.fetch = async () => ({ ok: true, json: async () => ({}) });

    assert.strictEqual(toasts.length, 3);
    assert.strictEqual(toasts[0].opts, undefined, 'CPU Pod: no Restart button');
    assert.match(toasts[0].message, /installed\.$/);
    assert.strictEqual(toasts[1].opts.action.text, 'Restart engine', 'GPU Pod keeps the offer');
    assert.strictEqual(toasts[2].opts.action.text, 'Restart engine', 'a local install keeps the offer');
});

test('the model-level complete carries the job\'s engine', () => {
    const src = fs.readFileSync(path.join(repo, 'routes', 'downloadManager.js'), 'utf8');
    assert.match(src, /const data = \{ modelId: modelJob\.modelId, engine: modelJob\.engine \};/);
});

test('local install sends the restart flag BEFORE the model-level complete', () => {
    const src = fs.readFileSync(path.join(repo, 'routes', 'downloadManager.js'), 'utf8');
    const flag = src.indexOf("_broadcast('comfy:needs-restart', { modelId: modelJob.modelId });");
    const done = src.indexOf('_broadcastModelComplete(modelJob);', src.indexOf("'local done'"));
    assert.ok(flag > 0 && done > flag);
});

test('a completed restart clears the pending flag, so the next generation does not restart again', () => {
    const src = fs.readFileSync(path.join(repo, 'js', 'shell', 'navigation.js'), 'utf8');
    const start = src.indexOf('async function _performRestart');
    const body = src.slice(start, src.indexOf('} catch (err) {', start));
    assert.match(body, /state\.remoteComfyNeedsRestart = false/);
    assert.match(body, /state\.comfyNeedsRestart = false/);
    assert.match(body, /state\.comfyNodesPending = false/);
});
