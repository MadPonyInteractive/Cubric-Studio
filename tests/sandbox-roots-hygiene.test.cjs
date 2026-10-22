/**
 * A unit test may never read the developer's real model library.
 *
 * `process.env.CUBRIC_MODELS_ROOT = <temp>` LOOKS like it sandboxes a test and does
 * not: it only moves the DEFAULT root, while every on-disk answer that goes through
 * `comfy.localModelsCheck` prefers `getCustomRoot()` — the `base_path:` inside
 * <ENGINE_ROOT>/extra_model_paths.yaml, i.e. the real G:\CubricModels. The result
 * then depends on which models the developer happens to have installed:
 * tests/orphan-sweep.test.cjs was green on CI for months and went red on the dev
 * machine the day Boogu balanced was installed for real (2026-08-26).
 *
 * The cure is to pin CUBRIC_ENGINE_ROOT as well (tests/helpers/sandbox-roots.cjs).
 * This test is what stops the half-sandbox from being written again — a preload
 * wired into `npm test` was tried instead and is wrong: one shared root across
 * parallel test processes made two other files fail.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const TESTS_DIR = __dirname;

const testFiles = fs.readdirSync(TESTS_DIR).filter(f => f.endsWith('.test.cjs'));

test('a test that pins the models root must pin the engine root too', () => {
    assert.ok(testFiles.length > 20, 'test file listing looks truncated — this would prove nothing');
    const offenders = [];
    for (const file of testFiles) {
        const src = fs.readFileSync(path.join(TESTS_DIR, file), 'utf8');
        if (!/process\.env\.CUBRIC_MODELS_ROOT\s*=/.test(src)) continue;
        const pinsEngine = /process\.env\.CUBRIC_ENGINE_ROOT\s*=/.test(src)
            || /helpers\/sandbox-roots/.test(src);
        if (!pinsEngine) offenders.push(file);
    }
    assert.deepEqual(offenders, [], 'these tests read the real models library through '
        + 'getCustomRoot() — require("./helpers/sandbox-roots.cjs") before any app require');
});

// MPI-1240: a root inherited from the shell (CUBRIC_MODELS_ROOT is a user env var on the dev
// machine) is the REAL library. The helper must swap it for a temp root, never adopt and delete it.
test('the helper never adopts or deletes an inherited root outside the temp dir', () => {
    const canary = fs.mkdtempSync(path.join(path.dirname(__dirname), '.mpi1240-canary-'));
    try {
        fs.writeFileSync(path.join(canary, 'weight.safetensors'), 'real');
        const helper = path.join(__dirname, 'helpers', 'sandbox-roots.cjs');
        const out = execFileSync(process.execPath,
            ['-e', `const r = require(${JSON.stringify(helper)}); console.log(JSON.stringify(r));`],
            { env: { ...process.env, CUBRIC_MODELS_ROOT: canary, CUBRIC_ENGINE_ROOT: canary }, encoding: 'utf8' });
        const { ROOT, ENGINE } = JSON.parse(out);
        assert.ok(fs.existsSync(path.join(canary, 'weight.safetensors')), 'the helper deleted the inherited real root');
        for (const dir of [ROOT, ENGINE]) {
            assert.ok(!path.relative(os.tmpdir(), dir).startsWith('..'), `${dir} is not a temp dir`);
        }
    } finally {
        fs.rmSync(canary, { recursive: true, force: true });
    }
});
