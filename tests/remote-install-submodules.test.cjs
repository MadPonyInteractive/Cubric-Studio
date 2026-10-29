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
// MPI-1343 dropped the pack, so no locked node has a submodule today: put USDU's last pin back
// into the cached lock the route reads, so the field stays covered for the next one.
nodeLock.nodes['ComfyUI-UltimateSDUpscale'] ??= {
    source: 'git-commit', repo: 'ssitu/ComfyUI_UltimateSDUpscale',
    commit: 'bebd5696fddd61cb0d08949a222c508898ab5577', filename: 'comfyui_ultimatesdupscale',
    installRequirements: false,
    submodules: {
        'repositories/ultimate_sd_upscale': {
            repo: 'Coyote-A/ultimate-upscale-for-automatic1111',
            commit: '2322caa480535b1011a1f9c18126d85ea444f146',
            sha256: '0797d41bad17b4bd9c41fae0ff4ea110cc364c1d2a06e13b27ca78fd0d4c57d7',
        },
    },
};

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
