'use strict';
// MPI-791 — engine-asset upscalers invisible in the Upscale dropdown.
//
// A user picked their own models folder at first engine install. The install fired the
// universal-workflow deps before it wrote that folder down, so the upscalers (and SAM3,
// BiRefNet, RIFE...) landed in the DEFAULT root. ComfyUI still loads them — the YAML always
// keeps the default root as a second block — but `/comfy/list-files` walked only the
// active root, so the dropdown showed "None" alone. On a Pod the same weights are baked
// into the image, which the wrapper's volume-only presence check cannot see.
//
// Pinned here: every reader walks every root ComfyUI searches, a fresh install resolves
// against the root the user picked, and Pod-baked weights are listed and never uploaded.
const assert = require('node:assert/strict');
const test = require('node:test');
const express = require('express');
const fs = require('fs-extra');
const os = require('node:os');
const path = require('node:path');

// Throwaway roots, set BEFORE requiring the routes (docs/testing-harnesses.md § 2).
const SCRATCH = fs.mkdtempSync(path.join(os.tmpdir(), 'mpi791-'));
const DEFAULT_ROOT = path.join(SCRATCH, 'default_models');
const CUSTOM_ROOT = path.join(SCRATCH, 'custom_models');
const PICKED_ROOT = path.join(SCRATCH, 'picked_models');
process.env.CUBRIC_ENGINE_ROOT = path.join(SCRATCH, 'engine');
process.env.CUBRIC_MODELS_ROOT = DEFAULT_ROOT;

const shared = require('../routes/shared');
const remoteModels = require('../routes/remoteModels');
const comfyRouter = require('../routes/comfy');
const { _resolveLocalModelPath } = require('../routes/remotePodState');
const { startUniversalWorkflowInstall } = require('../routes/downloadManager');

const NMKD = '4x_NMKD-Siax_200k.pth';
const ANIME = '4x-AnimeSharp.pth';

function place(root, rel) {
    const p = path.join(root, rel);
    fs.ensureDirSync(path.dirname(p));
    fs.writeFileSync(p, 'weight');
    return p;
}

// The user's disk: engine assets in the default root, their own upscaler in the custom one.
place(DEFAULT_ROOT, `upscale_models/${NMKD}`);
place(CUSTOM_ROOT, 'upscale_models/mine.pth');
place(DEFAULT_ROOT, 'upscale_models/both.pth'); // same name in both roots: listed once
place(CUSTOM_ROOT, 'upscale_models/both.pth');

test.before(async () => {
    await shared.writeExtraModelPathsYaml(CUSTOM_ROOT);
    // Read back from the YAML the root comes forward-slashed, so compare resolved paths.
    assert.equal(path.resolve(await shared.getCustomRoot()), CUSTOM_ROOT);
});
test.after(() => fs.remove(SCRATCH));

async function listFiles(subDir) {
    const app = express();
    app.use(comfyRouter);
    const server = await new Promise((resolve) => {
        const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    try {
        const res = await fetch(`http://127.0.0.1:${server.address().port}/comfy/list-files?subDir=${subDir}`);
        const data = await res.json();
        assert.equal(data.success, true);
        return data.files;
    } finally {
        await new Promise((resolve) => server.close(resolve));
    }
}

test('the searched roots are the active root, then the default root', async () => {
    const roots = (await shared.getSearchedModelsRoots()).map((p) => path.resolve(p));
    assert.deepEqual(roots, [CUSTOM_ROOT, DEFAULT_ROOT]);
});

test('list-files shows a default-root upscaler after a custom root is picked', async () => {
    assert.deepEqual(await listFiles('upscale_models'), [NMKD, 'both.pth', 'mine.pth'].sort());
});

test('on a Pod, list-files adds the image-baked upscalers with the Pod separator', async (t) => {
    t.mock.method(remoteModels, 'isRemoteActive', () => true);
    const files = await listFiles('upscale_models');
    assert.deepEqual(files, [ANIME, NMKD, 'both.pth', 'mine.pth'].sort());
    // Nothing baked is a LoRA, so the LoRA list gains nothing.
    assert.deepEqual(await listFiles('loras'), []);
});

test('the remote upload finds a local copy that lives in the default root', async () => {
    assert.equal(await _resolveLocalModelPath('upscale_models', 'only-default.pth'), null);
    const onlyDefault = place(DEFAULT_ROOT, 'upscale_models/only-default.pth');
    assert.equal(await _resolveLocalModelPath('upscale_models', 'only-default.pth'), onlyDefault);
});

test('a Pod-baked upscaler counts as present without asking the wrapper', async () => {
    // No Pod is connected, so any answer that came from the wrapper would be false.
    assert.deepEqual(remoteModels.podBakedModelNames('upscale_models').sort(), [ANIME, NMKD].sort());
    assert.equal(await remoteModels.remoteModelPresent('upscale_models', ANIME), true);
    assert.equal(await remoteModels.remoteModelPresent('upscale_models', `sub/${NMKD}`), true);
    assert.equal(await remoteModels.remoteModelPresent('upscale_models', 'mine.pth'), false);
});

test('a fresh install checks the deps against the root the user picked', async () => {
    place(PICKED_ROOT, `upscale_models/${ANIME}`);
    const persisted = await shared.checkUniversalWorkflowDepsStatus();
    assert.ok(persisted.missingDeps.includes('4x-AnimeSharp'), 'not in the persisted roots');
    const picked = await shared.checkUniversalWorkflowDepsStatus(PICKED_ROOT);
    assert.ok(!picked.missingDeps.includes('4x-AnimeSharp'), 'present in the picked root');
});

test('a fresh install downloads into the root the user picked', async () => {
    // NMKD sits in the picked AND the default root, so the job finds it complete either
    // way and fetches nothing — a regression reads the default-root path instead of
    // reaching the network.
    place(PICKED_ROOT, `upscale_models/${NMKD}`);
    const job = await startUniversalWorkflowInstall(['4x-NMKD-Siax'], false, true, PICKED_ROOT);
    const dep = job.deps.find((d) => d.id === '4x-NMKD-Siax');
    assert.equal(dep.status, 'complete');
    assert.equal(dep.localPath, path.join(PICKED_ROOT, 'upscale_models', NMKD));
});

test('the engine install hands the picked root to every UW-dep lookup', () => {
    // Wiring, checked on the real source like tests/uw-partial-install.test.cjs.
    const src = fs.readFileSync(path.join(__dirname, '..', 'routes', 'engine.js'), 'utf8');
    const calls = src.match(/startUniversalWorkflowInstall\(missingDepIds[^)]*\)/g) || [];
    assert.equal(calls.length, 2, 'one call per provisioning path');
    for (const c of calls) assert.match(c, /installRoot\)$/);
    assert.match(src, /checkUniversalWorkflowDepsStatus\(installRoot\)/);
    assert.match(src, /_provisionUvEngine\(targetDir, missingDepIds, downloadConfig, installRoot\)/);
    assert.match(src, /_provisionWindowsEngine\(targetDir, engineInfo, missingDepIds, installRoot\)/);
});
