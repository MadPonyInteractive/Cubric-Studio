'use strict';

// MPI-1001 — a remote generation refused with "Still connecting to the remote engine" on every
// try while the Pod was healthy (2026-09-30: ComfyUI restarted on the Pod after a model
// install, and every run after failed until the app restarted). ensureWsConnected waited on a
// socket that could never turn ready: an OPEN socket whose ready flag was dropped (its onopen
// has fired, so nothing raises it again) or a handshake stuck in CONNECTING. It must replace
// both, and connect() must not reuse an OPEN socket that is not ready.
//
// comfyController.js does not import into bare Node, so the methods are lifted from the source
// and run against a stub `this`, the pattern comfy-vanished-prompt.test.cjs uses.

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const CONTROLLER = fs.readFileSync(path.join(__dirname, '..', 'js', 'services', 'comfyController.js'), 'utf8');

function body(head) {
    const start = CONTROLLER.indexOf(head);
    assert.ok(start > 0, `${head} not found`);
    let depth = 0;
    for (let i = start + head.length - 1; i < CONTROLLER.length; i++) {
        if (CONTROLLER[i] === '{') depth++;
        else if (CONTROLLER[i] === '}' && --depth === 0) return CONTROLLER.slice(start + head.length, i);
    }
    throw new Error(`unbalanced braces in ${head}`);
}

const WS = { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 };
const HANDSHAKE_MS = Number(/const WS_HANDSHAKE_MS = (\d+);/.exec(CONTROLLER)[1]);
const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
const ensureWsConnected = new AsyncFunction('WebSocket', 'clientLogger', 'remoteEngineClient', 'WS_HANDSHAKE_MS', 'opts',
    `const { timeoutMs = 20000, retryMs = 1500 } = opts || {};${body('async ensureWsConnected({ timeoutMs = 20000, retryMs = 1500 } = {}) {')}`);
const dropWs = new Function(body('_dropWs() {'));

/** A socket that opens `openAfterMs` after it is made, or never (null). */
function fakeSocket(ctx, openAfterMs) {
    const ws = { readyState: WS.CONNECTING, closed: false, close() { this.closed = true; this.readyState = WS.CLOSED; } };
    if (openAfterMs != null) {
        setTimeout(() => {
            if (ws.closed) return;
            ws.readyState = WS.OPEN;
            if (ctx._ws === ws) ctx._wsReady = true;   // onopen
        }, openAfterMs);
    }
    return ws;
}

/** A stub engine; its connect() keeps the real reuse rule and opens a fresh socket in 50 ms. */
function engine(ws, { ready = false, openedAgoMs = 0 } = {}) {
    const logs = [];
    const ctx = {
        _ws: ws, _wsReady: ready, _wsOpenedAt: Date.now() - openedAgoMs, _engine: 'remote', _alwaysLocal: true,
        clientId: 'c', made: 0,
        isWsReady() { return this._wsReady === true && !!this._ws && this._ws.readyState === WS.OPEN; },
        _dropWs() { return dropWs.call(this); },
        connect() {
            const live = this._ws && ((this._ws.readyState === WS.OPEN && this._wsReady) || this._ws.readyState === WS.CONNECTING);
            if (live) return;
            if (this._ws) this._ws.close();
            this._wsReady = false;
            this.made++;
            this._ws = fakeSocket(this, 50);
            this._wsOpenedAt = Date.now();
        },
    };
    const run = (timeoutMs = 3000) => ensureWsConnected.call(ctx, WS, { warn: (_c, m) => logs.push(m) },
        { wsUrl: () => 'wss://pod/ws?token=secret' }, HANDSHAKE_MS, { timeoutMs, retryMs: 100 });
    return { ctx, logs, run };
}

test('an OPEN socket whose ready flag was dropped (Pod ComfyUI restart) is replaced', async () => {
    const stale = { readyState: WS.OPEN, closed: false, close() { this.closed = true; this.readyState = WS.CLOSED; } };
    const { ctx, logs, run } = engine(stale, { ready: false });
    assert.equal(await run(), true);
    assert.ok(stale.closed, 'the stale socket is closed');
    assert.equal(ctx.made, 1);
    assert.match(logs.join('\n'), /open but never ready/);
});

test('a handshake stuck past the limit is dropped and replaced', async () => {
    const { ctx, logs, run } = engine(null, {});
    ctx._ws = fakeSocket(ctx, null);              // never opens
    ctx._wsOpenedAt = Date.now() - HANDSHAKE_MS - 1000;
    const stuck = ctx._ws;
    assert.equal(await run(), true);
    assert.ok(stuck.closed);
    assert.match(logs.join('\n'), /handshake stuck/);
});

test('a healthy handshake is waited on, not replaced', async () => {
    const { ctx, logs, run } = engine(null, {});
    ctx._ws = fakeSocket(ctx, 300);
    assert.equal(await run(), true);
    assert.equal(ctx.made, 0);
    assert.deepEqual(logs, []);
});

test('a timeout logs the socket state and never the token', async () => {
    const { ctx, logs, run } = engine(null, {});
    ctx.connect = () => {};                        // nothing ever opens
    ctx._ws = fakeSocket(ctx, null);
    assert.equal(await run(400), false);
    const line = logs.at(-1);
    assert.match(line, /not ready after 400 ms: readyState 0, ready flag false, bound to remote, remote channel known/);
    assert.doesNotMatch(logs.join('\n'), /secret/);
});

test('connect() reuses an OPEN socket only while it is ready', () => {
    const reuse = /if \(this\._ws\s*&& this\._engine === _intendedEngine\s*&& \(\(this\._ws\.readyState === WebSocket\.OPEN && this\._wsReady\) \|\| this\._ws\.readyState === WebSocket\.CONNECTING\)\)/;
    assert.match(CONTROLLER, reuse);
});
