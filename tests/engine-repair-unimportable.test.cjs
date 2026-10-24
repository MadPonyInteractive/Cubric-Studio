'use strict';

/**
 * MPI-1274 — Repair engine re-fetches a node pack that fails to import on its own files.
 *
 * A tester's PC crashed while RES4LYF rewrote `res4lyf.config.json` (it does on every engine
 * start). The file was left empty, every later start failed `JSONDecodeError`, and the engine
 * blocked every generation. Repair engine only re-ran pip, which never touches a pack's files.
 * Now the repair wipes each pack the engine named as failed and re-fetches it at its pinned
 * commit, after the killed engine has exited (Windows holds its files until then).
 */

const assert = require('node:assert/strict');
const test = require('node:test');
const { EventEmitter } = require('node:events');
const express = require('express');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'mpi1274-'));
process.env.APP_USER_DATA = TMP;
process.env.CUBRIC_ENGINE_ROOT = TMP;

// The download itself is stubbed: engine.js takes the function off this object at load.
const downloads = require('../routes/downloadManager');
const installs = [];
let packGoneAtInstall = null;
let failNext = null;
downloads.startUniversalWorkflowInstall = async (ids, broadcast) => {
    if (failNext) throw failNext;
    packGoneAtInstall = !fs.existsSync(path.join(PACK, 'res4lyf.config.json'));
    installs.push({ ids, broadcast });
    fs.mkdirSync(PACK, { recursive: true });
    fs.writeFileSync(path.join(PACK, 'res4lyf.config.json'), '{}');
};

const engineRouter = require('../routes/engine');
const { processState } = require('../routes/shared');

const PACK = path.join(TMP, 'ComfyUI_windows_portable', 'ComfyUI', 'custom_nodes', 'RES4LYF');

/** A running engine that exits a moment after the kill, as a real SIGKILL does. */
function fakeEngine(order) {
    const child = new EventEmitter();
    child.exitCode = null;
    child.signalCode = null;
    child.kill = () => setTimeout(() => { child.signalCode = 'SIGKILL'; order.push('exited'); child.emit('exit', null, 'SIGKILL'); }, 30);
    return child;
}

async function repair() {
    const app = express();
    app.use(engineRouter);
    const server = app.listen(0);
    try {
        const res = await fetch(`http://127.0.0.1:${server.address().port}/engine/repair-python-deps`, { method: 'POST' });
        return { status: res.status, body: await res.json() };
    } finally {
        server.close();
    }
}

test('a pack that failed to import is wiped once the engine has exited, then re-fetched', async () => {
    fs.mkdirSync(PACK, { recursive: true });
    fs.writeFileSync(path.join(PACK, 'res4lyf.config.json'), ''); // what the crash left
    const order = [];
    processState.activeComfyProcess = fakeEngine(order);
    // A hand-installed pack has no pinned copy: it is left alone.
    processState.comfyImportFailures = ['RES4LYF', 'someones-own-pack'];
    installs.length = 0;
    try {
        const { status, body } = await repair();
        assert.equal(status, 200);
        assert.deepEqual(body, { success: true, reinstalled: ['RES4LYF'] });
        assert.deepEqual(installs, [{ ids: ['RES4LYF'], broadcast: false }]);
        assert.equal(packGoneAtInstall, true, 'the broken folder is gone before the re-fetch, or the install skips it as present');
        assert.deepEqual(order, ['exited'], 'the wipe waited for the engine to let go of its files');
        assert.equal(fs.readFileSync(path.join(PACK, 'res4lyf.config.json'), 'utf8'), '{}');
    } finally {
        processState.activeComfyProcess = null;
        processState.comfyImportFailures = [];
    }
});

test('an engine whose packs all imported reinstalls nothing', async () => {
    processState.activeComfyProcess = null;
    processState.comfyImportFailures = [];
    installs.length = 0;
    const { body } = await repair();
    assert.deepEqual(body, { success: true, reinstalled: [] });
    assert.equal(installs.length, 0);
});

test('a failed re-fetch answers with its own reason', async () => {
    processState.comfyImportFailures = ['RES4LYF'];
    failNext = new Error('UW deps install failed: RES4LYF — github.com could not be reached');
    try {
        const { status, body } = await repair();
        assert.equal(status, 500);
        assert.match(body.error, /github\.com could not be reached/);
    } finally {
        failNext = null;
        processState.comfyImportFailures = [];
    }
});
