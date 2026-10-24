'use strict';

// MPI-1272 — a model install that adds custom nodes must not restart the engine under
// every later generation. Fabio, 2026-10-24: ten models queued to download while
// generating on another one meant a ComfyUI restart each time one finished. The engine
// now restarts only for a run whose graph uses a node class the running ComfyUI has not
// registered.
//
// comfyController.js does not import into bare Node, so the two gate methods are lifted
// out of the REAL source and run against a stubbed /object_info; the wiring around them
// is pinned by source, and the server flag by a real /comfy/status.

const assert = require('node:assert/strict');
const test = require('node:test');
const express = require('express');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'mpi1272-'));
process.env.APP_USER_DATA = TMP;
process.env.CUBRIC_ENGINE_ROOT = TMP;

const comfyRouter = require('../routes/comfy');
const { processState } = require('../routes/shared');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const SRC = read('js/services/comfyController.js');

/** The real `_readyOrRestartForNodes` + `_unloadedNodeClasses`, bound to a fake engine. */
function gate({ loaded, probeFails = false }) {
    const start = SRC.indexOf('    async _readyOrRestartForNodes(');
    const end = SRC.indexOf('    /**', SRC.indexOf('    async _unloadedNodeClasses('));
    assert.ok(start > 0 && end > start, 'the gate methods moved — repoint this test');
    const probed = [];
    const fetch = async (url) => {
        probed.push(url);
        if (probeFails) throw new Error('ECONNREFUSED');
        const cls = decodeURIComponent(url.split('/object_info/')[1]);
        return { ok: true, json: async () => (loaded.includes(cls) ? { [cls]: {} } : {}) };
    };
    const clientLogger = { info() {} };
    const methods = new Function('fetch', 'clientLogger', `return {\n${SRC.slice(start, end)}\n};`)(fetch, clientLogger);
    const restarts = [];
    const lifecycle = [];
    const engine = {
        ...methods,
        httpBase: () => 'http://127.0.0.1:48188',
        _emitLifecycle: (name) => lifecycle.push(name),
        _restartLocalEngine: async (message) => { restarts.push(message); return { ready: true, remoteComfyRestarted: false }; },
    };
    return { engine, restarts, lifecycle, probed };
}

const WAN_I2V = {
    1: { class_type: 'KSampler' },
    2: { class_type: 'PainterI2VAdvanced' },
    3: { class_type: 'KSampler' },
};

test('nodes pending, but this run uses only loaded nodes: no restart', async () => {
    const { engine, restarts, lifecycle, probed } = gate({ loaded: ['KSampler', 'PainterI2VAdvanced'] });
    const r = await engine._readyOrRestartForNodes(true, WAN_I2V);
    assert.deepEqual(r, { ready: true, remoteComfyRestarted: false });
    assert.equal(restarts.length, 0);
    assert.deepEqual(lifecycle, ['comfy:ready'], 'a skipped restart still announces ready (loadAssets hangs off it)');
    assert.equal(probed.length, 2, 'each class is probed once, not once per node');
});

test('nodes pending and this run needs one the engine has not loaded: restart', async () => {
    const { engine, restarts } = gate({ loaded: ['KSampler'] });
    await engine._readyOrRestartForNodes(true, WAN_I2V);
    assert.equal(restarts.length, 1);
});

test('a failed probe counts as missing — a doubt costs a restart, never a broken run', async () => {
    const { engine, restarts } = gate({ loaded: [], probeFails: true });
    await engine._readyOrRestartForNodes(true, WAN_I2V);
    assert.equal(restarts.length, 1);
});

test('nothing pending, or no graph to check: no probe, no restart', async () => {
    for (const [pending, wf] of [[false, WAN_I2V], [true, null]]) {
        const { engine, restarts, probed } = gate({ loaded: [] });
        await engine._readyOrRestartForNodes(pending, wf);
        assert.equal(restarts.length, 0);
        assert.equal(probed.length, 0);
    }
});

test('the gate is wired: graph loaded before it, both ready paths check, other causes stay unconditional', () => {
    const run = SRC.slice(SRC.indexOf('    async runWorkflow('));
    assert.ok(run.indexOf("fetch(`/comfy_workflows/${file}`)") < run.indexOf('this.ensureServerRunning({ ...opts, workflow })'),
        'runWorkflow must load the graph BEFORE the engine gate reads it');

    const ensure = SRC.slice(SRC.indexOf('    async ensureServerRunning('), SRC.indexOf('    _noteDepsWarning(status) {'));
    assert.match(ensure, /if \(needsRestart && status\.running\) \{[\s\S]*?return await this\._restartLocalEngine\(/,
        'comfyNeedsRestart (settings path change, VRAM fault) still restarts whatever runs');
    assert.equal((ensure.match(/_readyOrRestartForNodes\(/g) || []).length, 2,
        'the already-ready path AND the boot poll must both apply the node check');
    assert.match(SRC, /return await localEngine\.ensureServerRunning\(\{ background, workflow \}\)/,
        'the remote engine falling back to local must hand the graph on');
});

test('a local node install sets comfyNodesPending, and every fresh start clears it', () => {
    const dm = read('routes/downloadManager.js');
    assert.match(dm, /if \(!remoteModels\.isRemoteActive\(\)\) \{\s*processState\.comfyNodesPending = true;/);
    const comfy = read('routes/comfy.js');
    assert.equal((comfy.match(/processState\.comfyNodesPending = false;/g) || []).length, 2,
        'both the user-restart and the spawn branch of /comfy/start clear it');
    assert.match(read('js/services/downloadService.js'), /else state\.comfyNodesPending = true;/);
});

test('/comfy/status carries nodesPending', async () => {
    const app = express();
    app.use(express.json());
    app.use(comfyRouter);
    const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
    try {
        const get = () => fetch(`http://127.0.0.1:${server.address().port}/comfy/status`).then(r => r.json());
        processState.comfyNodesPending = false;
        assert.equal((await get()).nodesPending, false);
        processState.comfyNodesPending = true;
        const s = await get();
        assert.equal(s.nodesPending, true);
        assert.equal(s.needsRestart, false, 'a node install must not raise the restart-every-run flag');
    } finally {
        processState.comfyNodesPending = false;
        await new Promise((resolve) => server.close(resolve));
    }
});

test.after(() => fs.rmSync(TMP, { recursive: true, force: true }));
