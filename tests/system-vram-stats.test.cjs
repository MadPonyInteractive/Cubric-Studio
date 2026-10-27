'use strict';

/**
 * AUDIT P13 — /system/stats polls getVramStats every 2 s. A machine the GPU detection found
 * no NVIDIA card in spawns no nvidia-smi, and one spawn answers every call inside the TTL.
 */

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'p13-vram-'));
process.env.APP_USER_DATA = TMP;
process.env.CUBRIC_ENGINE_ROOT = TMP;

const childProcess = require('node:child_process');
const platformEngine = require('../routes/platformEngine');

/** A fresh routes/system.js whose execFile and GPU detection are the given stubs. */
function loadSystem({ vendor, detectFails = false }) {
    const spawns = [];
    childProcess.execFile = (cmd, args, opts, cb) => {
        spawns.push({ cmd, opts });
        setImmediate(() => cb(null, '12288, 4096\n'));
    };
    platformEngine.resolveDownloadConfig = () => (detectFails
        ? Promise.reject(new Error('no detection'))
        : Promise.resolve({ gpu: { vendor } }));
    delete require.cache[require.resolve('../routes/system')];
    return { system: require('../routes/system'), spawns };
}

test('a non-NVIDIA machine gets zero VRAM without spawning nvidia-smi', async () => {
    for (const vendor of ['amd', 'intel', 'apple', null]) {
        const { system, spawns } = loadSystem({ vendor });
        assert.deepEqual(await system.getVramStats(), { total: 0, used: 0 });
        assert.equal(spawns.length, 0, `vendor ${vendor} spawned`);
    }
});

test('an NVIDIA machine spawns once per TTL, hidden, and parses the answer', async () => {
    const { system, spawns } = loadSystem({ vendor: 'nvidia' });
    const [a, b] = await Promise.all([system.getVramStats(), system.getVramStats()]);
    assert.deepEqual(a, { total: 12288, used: 4096 });
    assert.deepEqual(b, a);
    assert.deepEqual(await system.getVramStats(), a);
    assert.equal(spawns.length, 1);
    assert.equal(spawns[0].cmd, 'nvidia-smi');
    assert.equal(spawns[0].opts.windowsHide, true);
});

test('a failed GPU detection still asks nvidia-smi', async () => {
    const { system, spawns } = loadSystem({ vendor: 'nvidia', detectFails: true });
    assert.deepEqual(await system.getVramStats(), { total: 12288, used: 4096 });
    assert.equal(spawns.length, 1);
});
