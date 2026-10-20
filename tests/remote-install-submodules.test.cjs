'use strict';
// MPI-1214 — a Pod node install carries the node's pinned git submodules.
//
// The wrapper volume-installs a node from its GitHub archive, which leaves every submodule
// folder EMPTY; comfyui_ultimatesdupscale then fetches Coyote-A's unpinned master with
// Python urllib at import. The app sends node_lock's pin so the wrapper fills it instead.
const assert = require('assert');

const stub = (id, exports) => {
    const resolved = require.resolve(id);
    require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports };
};
stub('../routes/remoteProxy', { getRemoteMode: () => ({ podId: 'testpod' }), isRemoteActive: () => true });
const realEngine = require('../routes/remoteEngine');
require.cache[require.resolve('../routes/remoteEngine')].exports = {
    ...realEngine,
    getWrapperToken: async () => 'test-token',
    buildAuthHeaders: () => ({ Authorization: 'Bearer test-token' }),
    proxyUrl: () => 'http://127.0.0.1:1/',
};

const { remoteInstallDep } = require('../routes/remoteModels');
const nodeLock = require('../dev_configs/node_lock.json');

let sent;
globalThis.fetch = async (_url, opts) => {
    sent = JSON.parse(opts.body);
    return { status: 202, ok: true, json: async () => ({ status: 'started' }) };
};

(async () => {
    await remoteInstallDep({ id: 'ComfyUI-UltimateSDUpscale', type: 'custom_nodes', filename: 'comfyui_ultimatesdupscale', url: 'https://x' });
    const pin = nodeLock.nodes['ComfyUI-UltimateSDUpscale'].submodules['repositories/ultimate_sd_upscale'];
    assert.deepStrictEqual(sent.submodules, [{
        relPath: 'repositories/ultimate_sd_upscale',
        url: `https://github.com/${pin.repo}/archive/${pin.commit}.zip`,
        commit: pin.commit,
        sha256: pin.sha256,
    }], 'the USDU install must carry its pinned, hashed submodule');

    // A node with no submodules sends no field at all (an older wrapper sees the old body).
    await remoteInstallDep({ id: 'ComfyUI-Frame-Interpolation', type: 'custom_nodes', filename: 'comfyui-frame-interpolation', url: 'https://x' });
    assert.ok(!('submodules' in sent), 'no submodules = no field');
    console.log('remote-install-submodules: ok');
})().catch((e) => { console.error(e); process.exit(1); });
