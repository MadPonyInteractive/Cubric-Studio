'use strict';

/**
 * MPI-1318 — an engine installed for the wrong graphics card is replaced with the right one.
 *
 * Before MPI-1304 every AMD / Intel Arc machine on current Windows 11 was handed the NVIDIA
 * engine (the `wmic` probe was gone). Fixing detection alone left those engines in place and
 * then launched their CUDA torch in GPU mode on a card it cannot drive. The installed torch
 * build is now compared with the detected card: a mismatch makes /engine/version-check ask
 * for the upgrade, and the upgrade takes the full reinstall, which downloads the right build.
 */

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'mpi1318-'));
fs.mkdirSync(path.join(TMP, 'logs'));
process.env.APP_USER_DATA = TMP;
process.env.CUBRIC_ENGINE_ROOT = TMP;

const PLATFORM = path.join(__dirname, '..', 'routes', 'platformEngine.js');
const ENGINE = path.join(__dirname, '..', 'routes', 'engine.js');
const { readEngineTorchVendor, readEngineTorchCuda, wrongEngineBuildReason, getPythonBin, COMFY_VERSION } = require(PLATFORM);

test.after(() => fs.rmSync(TMP, { recursive: true, force: true }));

/** A fake engine whose torch is `torch-<ver>+<tag>`; returns its python path. */
function fakeTorch(root, distInfo) {
    const python = getPythonBin(root);
    const site = process.platform === 'win32'
        ? path.join(path.dirname(python), 'Lib', 'site-packages')
        : path.join(path.dirname(python), '..', 'lib', 'python3.12', 'site-packages');
    fs.mkdirSync(path.join(site, distInfo), { recursive: true });
    fs.writeFileSync(python, '');
    return python;
}

test('the installed torch build names its card vendor', async () => {
    for (const [distInfo, vendor] of [
        ['torch-2.13.0+cu130.dist-info', 'nvidia'],
        ['torch-2.7.1+cu126.dist-info', 'nvidia'],
        ['torch-2.9.0+rocm7.1.0.dist-info', 'amd'],
        ['torch-2.10.0a0+rocmsdk20251116.dist-info', 'amd'],
        ['torch-2.8.0+xpu.dist-info', 'intel'],
        ['torch-2.13.0+cpu.dist-info', null],
        ['torch-2.13.0.dist-info', null],
    ]) {
        const root = fs.mkdtempSync(path.join(TMP, 'v-'));
        assert.equal(await readEngineTorchVendor(fakeTorch(root, distInfo)), vendor, distInfo);
    }
    assert.equal(await readEngineTorchVendor(path.join(TMP, 'missing', 'python.exe')), null);
});

test('the CUDA reader still reads only a CUDA build', async () => {
    const cu = fakeTorch(fs.mkdtempSync(path.join(TMP, 'c-')), 'torch-2.13.0+cu130.dist-info');
    assert.equal(await readEngineTorchCuda(cu), '13.0');
    const rocm = fakeTorch(fs.mkdtempSync(path.join(TMP, 'c-')), 'torch-2.9.0+rocm7.1.0.dist-info');
    assert.equal(await readEngineTorchCuda(rocm), null);
});

test('a build for another vendor is a reinstall reason; unknowns never are', () => {
    assert.match(wrongEngineBuildReason('amd', 'nvidia'), /built for NVIDIA cards .* an AMD card/);
    assert.match(wrongEngineBuildReason('intel', 'nvidia'), /an Intel Arc card/);
    assert.match(wrongEngineBuildReason('nvidia', 'amd'), /built for AMD cards/);
    assert.equal(wrongEngineBuildReason('amd', 'amd'), null);
    assert.equal(wrongEngineBuildReason('nvidia', 'nvidia'), null);
    // No card detected: the NVIDIA build is the deliberate CPU fallback (MPI-387 F2).
    assert.equal(wrongEngineBuildReason(null, 'nvidia'), null);
    assert.equal(wrongEngineBuildReason('apple', null), null);
    assert.equal(wrongEngineBuildReason('amd', null), null);
});

/** Load engine.js on a machine whose only card is an AMD one. */
function loadEngineOnAmdMachine() {
    const real = cp.execFile;
    cp.execFile = (cmd, args, opts, cb) => {
        const done = typeof opts === 'function' ? opts : cb;
        const error = cmd === 'nvidia-smi' ? Object.assign(new Error('ENOENT'), { code: 'ENOENT' }) : null;
        setImmediate(() => done(error, error ? '' : 'AMD Radeon RX 6800\r\n', ''));
        return { on() {}, kill() {} };
    };
    delete require.cache[require.resolve(PLATFORM)];
    delete require.cache[require.resolve(ENGINE)];
    try {
        return require(ENGINE);
    } finally {
        cp.execFile = real;
    }
}

async function versionCheck(router) {
    const layer = router.stack.find((l) => l.route && l.route.path === '/engine/version-check');
    const res = { body: null, status() { return this; }, json(b) { this.body = b; } };
    await layer.route.stack[0].handle({}, res);
    return res.body;
}

test('an AMD machine with a current NVIDIA engine is told to upgrade', { skip: process.platform !== 'win32' && 'AMD is detected through WMI on Windows only' }, async () => {
    fs.writeFileSync(path.join(TMP, '.mpi_engine_version'), COMFY_VERSION);
    const python = fakeTorch(TMP, 'torch-2.13.0+cu130.dist-info');
    const router = loadEngineOnAmdMachine();

    assert.deepEqual(await versionCheck(router),
        { installed: COMFY_VERSION, required: COMFY_VERSION, needsInstall: false, needsUpgrade: true });

    // The right build in place: nothing to do.
    const site = path.join(path.dirname(python), 'Lib', 'site-packages');
    fs.renameSync(path.join(site, 'torch-2.13.0+cu130.dist-info'), path.join(site, 'torch-2.9.0+rocm7.1.0.dist-info'));
    assert.equal((await versionCheck(router)).needsUpgrade, false);
});

test('the upgrade takes the full reinstall for a wrong build', () => {
    // The in-place path only moves ComfyUI and pip lines; it can never swap the torch build.
    const src = fs.readFileSync(ENGINE, 'utf8');
    const body = src.slice(src.indexOf('async function _fullReinstallReason()'), src.indexOf('async function _installedWrongBuildReason()'));
    assert.match(body, /return _installedWrongBuildReason\(\);/);
});
