/**
 * tests/driver-floor.test.cjs — MPI-902.
 *
 * The Windows engine ships a cu130 torch. On a driver whose CUDA is 12.x it dies at
 * startup with access violation 3221225477 and nothing names the driver. /comfy/start
 * now refuses with the fix; these pin the three pieces that decision rests on.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');

const MODULE = path.join(__dirname, '..', 'routes', 'platformEngine.js');
const { driverTooOldReason, readEngineTorchCuda } = require(MODULE);

test('a driver on an older CUDA major is refused, with the fix', () => {
    const reason = driverTooOldReason('12.6', '13.0');
    assert.match(reason, /CUDA 12\.6/);
    assert.match(reason, /580 or newer/);
});

test('same or newer major passes; unknowns never block', () => {
    assert.strictEqual(driverTooOldReason('13.4', '13.0'), null);
    assert.strictEqual(driverTooOldReason('13.0', '13.1'), null); // minor-version compat
    assert.strictEqual(driverTooOldReason('12.6', '12.6'), null);
    assert.strictEqual(driverTooOldReason(null, '13.0'), null);
    assert.strictEqual(driverTooOldReason('12.6', null), null);
});

test('torch CUDA is read off the dist-info folder, Windows and venv layouts', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mpi902-'));
    try {
        const win = path.join(root, 'win', 'python_embeded');
        fs.mkdirSync(path.join(win, 'Lib', 'site-packages', 'torch-2.13.0+cu130.dist-info'), { recursive: true });
        assert.strictEqual(await readEngineTorchCuda(path.join(win, 'python.exe')), '13.0');

        const venv = path.join(root, 'venv');
        fs.mkdirSync(path.join(venv, 'bin'), { recursive: true });
        fs.mkdirSync(path.join(venv, 'lib', 'python3.12', 'site-packages', 'torch-2.7.1+cu126.dist-info'), { recursive: true });
        assert.strictEqual(await readEngineTorchCuda(path.join(venv, 'bin', 'python3')), '12.6');

        const cpu = path.join(root, 'cpu');
        fs.mkdirSync(path.join(cpu, 'Lib', 'site-packages', 'torch-2.13.0.dist-info'), { recursive: true });
        assert.strictEqual(await readEngineTorchCuda(path.join(cpu, 'python.exe')), null);
        assert.strictEqual(await readEngineTorchCuda(path.join(root, 'missing', 'python.exe')), null);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test('nvidia-smi header parses in both the old and the r6xx format', async () => {
    for (const [header, want] of [['| NVIDIA-SMI 560.94   Driver Version: 560.94   CUDA Version: 12.6 |', '12.6'],
        ['| NVIDIA-SMI 617.14   KMD Version: 617.14   CUDA UMD Version: 13.4 |', '13.4']]) {
        const real = cp.execFile;
        cp.execFile = (cmd, args, opts, cb) => {
            const done = typeof opts === 'function' ? opts : cb;
            const stdout = (args || []).includes('--query-gpu=name') ? 'NVIDIA GeForce RTX 3060\n' : header;
            setImmediate(() => done(null, stdout, ''));
            return { on() {}, kill() {} };
        };
        delete require.cache[require.resolve(MODULE)];
        try {
            const { resolveDownloadConfig } = require(MODULE);
            const { gpu } = await resolveDownloadConfig();
            assert.strictEqual(gpu.cudaVersion, want);
        } finally {
            cp.execFile = real;
            delete require.cache[require.resolve(MODULE)];
        }
    }
});
