/**
 * models-check-pending.test.cjs — MPI-1057.
 *
 * While a Pod's wrapper boots, /comfy/models/check answers `{ results: {}, pending: true }`
 * (MPI-211): the server knows nothing yet. The sync read that empty set as "nothing
 * installed" and published it, so the home strip read 0 / 24 for a whole connect
 * (live 2026-10-10, a stalled PRO 6000 connect on a disk full of weights).
 *
 * The contract: a pending answer changes nothing — no `models:checked`, and the last real
 * installed set stands until the Pod can answer.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert');

const ipcRenderer = { async invoke() { return { has: false }; } };
globalThis.window = { require: (m) => (m === 'electron' ? { ipcRenderer } : undefined) };

let pending = false;
globalThis.fetch = async (_path, opts) => {
    if (pending) return { ok: true, json: async () => ({ success: true, results: {}, pending: true }) };
    const { models } = JSON.parse(opts.body);
    const results = {};
    for (const m of models) results[m.id] = { installed: true, deps: (m.deps || []).map(d => ({ id: d.id, installed: true })) };
    return { ok: true, json: async () => ({ results, bakedDrift: [] }) };
};

test('a pending models check publishes nothing and keeps the last real answer', async () => {
    const { syncModelInstalled } = await import('../js/data/modelRegistry.js');
    const { MODELS } = await import('../js/data/modelConstants/models.js');
    const { Events } = await import('../js/events.js');

    let emitted = [];
    Events.on('models:checked', ({ installedModelIds }) => emitted.push(installedModelIds));

    assert.strictEqual(await syncModelInstalled(), true);
    assert.strictEqual(emitted.length, 1);
    const before = emitted[0].length;
    assert.ok(before > 0, 'the real answer should report installed models');
    const installedBefore = MODELS.filter(m => m.installed).length;

    emitted = [];
    pending = true;
    assert.strictEqual(await syncModelInstalled(), false, 'a pending answer is not a successful sync');
    assert.deepStrictEqual(emitted, [], 'REGRESSION: a pending check published an installed set (the 0 / 24 strip)');
    assert.strictEqual(MODELS.filter(m => m.installed).length, installedBefore, 'a pending check changed MODELS[].installed');
});
