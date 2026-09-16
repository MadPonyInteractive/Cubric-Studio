'use strict';
/**
 * agent-service-bus.test.cjs — MPI-774
 *
 * Proves that the shared SSE singleton in agentService.js re-emits each SSE
 * event on the app Events bus EXACTLY ONCE, even when two MpiAgentChat
 * instances have subscribed (preventing double-emit from two EventSources).
 *
 * Run: node --test tests/agent-service-bus.test.cjs
 */

const test    = require('node:test');
const assert  = require('node:assert/strict');
const path    = require('node:path');

// ── Stub browser globals before any ESM import ────────────────────────────────

// Track SSE listeners added by agentService
const _sseHandlers = {};

globalThis.window = {
    EventSource: class FakeEventSource {
        constructor() {}
        addEventListener(name, fn) {
            _sseHandlers[name] = _sseHandlers[name] || [];
            _sseHandlers[name].push(fn);
        }
        close() {}
    },
    fetch: async () => ({ ok: true, json: async () => ({}) }),
};

// Minimal localStorage stub for Storage.getAgentPrefs / getLlmConnection
globalThis.localStorage = {
    _store: {},
    getItem(k)    { return this._store[k] ?? null; },
    setItem(k, v) { this._store[k] = v; },
    removeItem(k) { delete this._store[k]; },
};

/** Fire a fake SSE event by name with a data payload. */
function fireSse(name, data) {
    const handlers = _sseHandlers[name] || [];
    handlers.forEach(fn => fn({ data: JSON.stringify(data) }));
}

const repoRoot = path.join(__dirname, '..');
const esm = (p) => import('file://' + path.join(repoRoot, p).replace(/\\/g, '/'));

// ── Tests ─────────────────────────────────────────────────────────────────────

test('one SSE event → Events bus receives it exactly once per emit', async () => {
    const [{ Events }, { agentInitStream }] = await Promise.all([
        esm('js/events.js'),
        esm('js/services/agentService.js'),
    ]);

    agentInitStream(); // arms the singleton EventSource

    // Two separate subscribers — simulating two mounted MpiAgentChat instances.
    const received = [];
    const unsub1 = Events.on('agent:working', (d) => received.push({ sub: 1, d }));
    const unsub2 = Events.on('agent:working', (d) => received.push({ sub: 2, d }));

    fireSse('agent:working', { turnId: 't1', working: true });

    // Both subscribers notified — but Events.emit was called only once.
    assert.strictEqual(received.length, 2, 'both subscribers receive the event');
    assert.strictEqual(received[0].sub, 1);
    assert.strictEqual(received[1].sub, 2);
    assert.strictEqual(received[0].d.working, true);
    assert.strictEqual(received[1].d.working, true);

    // Verify it is the SAME payload (not two separate emits with different data).
    assert.deepStrictEqual(received[0].d, received[1].d, 'same data object for both subscribers');

    unsub1();
    unsub2();
});

test('agentInitStream is idempotent — second call does not double-emit', async () => {
    const [{ Events }, { agentInitStream }] = await Promise.all([
        esm('js/events.js'),
        esm('js/services/agentService.js'),
    ]);

    agentInitStream(); // first call — already armed by previous test but safe
    agentInitStream(); // second call — must be a no-op

    const received = [];
    const unsub = Events.on('agent:message', (d) => received.push(d));

    fireSse('agent:message', { turnId: 't2', id: 'm1', text: 'hello' });

    // If the singleton double-registered, we'd get 2+ entries.
    assert.strictEqual(received.length, 1, 'idempotent — event received exactly once');

    unsub();
});
