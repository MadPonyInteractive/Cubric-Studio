/**
 * cloud-installed-survives-sync.test.cjs — MPI-918.
 *
 * Two code paths write the installed-model list (`models:checked` -> s_installedModelIds):
 * the disk sync and the cloud-key check. The sync never sends a cloud model to the disk
 * check (zero files are always "present"), so it rebuilt the list WITHOUT the cloud ids,
 * and a Flow's model slot, which offers installed candidates only, never offered
 * Klein 9B (Cloud) with a key saved (Fabio, 2026-10-01). The key check built the list
 * from a second formula of its own; one helper builds both now.
 *
 * The contract: the list is always the sync's local answer plus the cloud models when a key
 * is saved, whichever of the two wrote it last.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert');

let keySaved = true;
const ipcRenderer = { async invoke(channel) { return channel === 'secrets:has-endpoint-key' ? { has: keySaved } : { ok: true }; } };
globalThis.window = { require: (m) => (m === 'electron' ? { ipcRenderer } : undefined) };

// Every local file on disk.
globalThis.fetch = async (_path, opts) => {
    const { models } = JSON.parse(opts.body);
    const results = {};
    for (const m of models) {
        const deps = (m.deps || []).map(d => ({ id: d.id, installed: true }));
        results[m.id] = { installed: true, deps };
    }
    return { ok: true, json: async () => ({ results, bakedDrift: [] }) };
};

function nextModelsChecked(Events, ms = 2000) {
    return new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('models:checked never fired')), ms);
        Events.once('models:checked', (p) => { clearTimeout(t); resolve(p); });
    });
}

test('the installed list keeps the cloud models through a disk sync, and the local ones through a key change', async () => {
    const { syncModelInstalled, refreshCloudKey } = await import('../js/data/modelRegistry.js');
    const { MODELS } = await import('../js/data/modelConstants/models.js');
    const { Events } = await import('../js/events.js');
    const cloudIds = MODELS.filter(m => m.provider).map(m => m.id);

    await refreshCloudKey();
    let checked = nextModelsChecked(Events);
    assert.strictEqual(await syncModelInstalled(), true);
    const synced = (await checked).installedModelIds;
    for (const id of cloudIds) assert.ok(synced.includes(id), `disk sync dropped ${id}`);
    assert.ok(synced.includes('klein-9b'), 'the local candidate is in the list too');
    const local = synced.filter(id => !cloudIds.includes(id)).sort();

    keySaved = false;
    checked = nextModelsChecked(Events);
    await refreshCloudKey();
    assert.deepStrictEqual((await checked).installedModelIds.slice().sort(), local, 'a key change keeps the sync\'s local list');

    keySaved = true;
    checked = nextModelsChecked(Events);
    await refreshCloudKey();
    assert.deepStrictEqual((await checked).installedModelIds.slice().sort(), [...local, ...cloudIds].sort());
});
