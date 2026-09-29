/**
 * cloud-key-refresh.test.cjs — MPI-595 B3.
 *
 * A cloud model is "installed" when a DeepInfra key is saved, and the renderer
 * mirrors that answer (modelRegistry.js `refreshCloudKey`). Saving the key in
 * Remote -> Language Models never re-read the mirror: only the model disk-check
 * edge did, and a machine with no engine and no Pod never reaches it. Found on
 * the Linux box 2026-09-29 — key saved, every cloud model still `installed:false`
 * until a restart.
 *
 * The contract: any successful key change through secretsClient (the only
 * renderer door to the secrets:* channels) re-reads the mirror, and a failed
 * one does not.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert');

let stored = false;
let failNext = false;
const ipcRenderer = {
    async invoke(channel) {
        if (channel === 'secrets:has-endpoint-key') return { has: stored };
        if (failNext) { failNext = false; return { ok: false }; }
        if (channel === 'secrets:set-endpoint-key') stored = true;
        if (channel === 'secrets:clear-endpoint-key') stored = false;
        return { ok: true };
    },
};
globalThis.window = { require: (m) => (m === 'electron' ? { ipcRenderer } : undefined) };

function nextModelsChecked(Events, ms = 2000) {
    return new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('models:checked never fired')), ms);
        Events.once('models:checked', (p) => { clearTimeout(t); resolve(p); });
    });
}

test('saving and clearing the DeepInfra key flips the cloud models without a restart', async () => {
    const { refreshCloudKey, hasCloudKey, getModelById } = await import('../js/data/modelRegistry.js');
    const { secretsClient } = await import('../js/core/secretsClient.js');
    const { Events } = await import('../js/events.js');

    await refreshCloudKey();
    assert.strictEqual(hasCloudKey(), false);

    let checked = nextModelsChecked(Events);
    await secretsClient.setEndpointKey('deepinfra', 'test-key');
    const payload = await checked;
    assert.strictEqual(hasCloudKey(), true);
    assert.strictEqual(getModelById('flux2-dev-cloud').installed, true);
    assert.ok(payload.installedModelIds.includes('flux2-dev-cloud'));

    checked = nextModelsChecked(Events);
    await secretsClient.clearEndpointKey('deepinfra');
    await checked;
    assert.strictEqual(hasCloudKey(), false);
    assert.strictEqual(getModelById('flux2-dev-cloud').installed, false);
});

test('a failed save announces nothing', async () => {
    const { Events } = await import('../js/events.js');
    const { secretsClient } = await import('../js/core/secretsClient.js');
    let fired = false;
    const off = Events.on('secrets:endpoint-changed', () => { fired = true; });
    failNext = true;
    const res = await secretsClient.setEndpointKey('deepinfra', 'test-key');
    off();
    assert.strictEqual(res.ok, false);
    assert.strictEqual(fired, false);
});
