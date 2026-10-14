/**
 * Engine input/output scratch (MPI-778, MPI-1144).
 *
 * Every instance on a checkout shares one engine, so these folders are emptied at ONE
 * moment: when this server is about to spawn the engine. Never on quit: the engine was
 * still alive then and, on Windows, a file it held open threw EPERM out of before-quit,
 * showing "Cubric Studio failed to start" on every such quit.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { getComfyPath } = require('../routes/platformEngine');
const { cleanEngineScratch } = require('../routes/engineScratch');

const quiet = { info() {}, warn() {} };
const REPO = path.join(__dirname, '..');

function seedEngine() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-scratch-'));
    const files = ['input', 'output'].map((dir) => {
        const file = path.join(getComfyPath(root, dir), 'sub', 'staged.png');
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, 'x');
        return file;
    });
    return { root, files };
}

test('input/output are emptied and the folders kept', () => {
    const { root } = seedEngine();
    assert.strictEqual(cleanEngineScratch(root, quiet), 0);
    for (const dir of ['input', 'output']) {
        assert.deepStrictEqual(fs.readdirSync(getComfyPath(root, dir)), []);
    }
});

test('an entry that cannot be deleted is left with a warning, the rest still goes', () => {
    const { root } = seedEngine();
    const locked = getComfyPath(root, 'input');
    fs.writeFileSync(path.join(getComfyPath(root, 'output'), 'other.png'), 'x');
    const warnings = [];
    const realRm = fs.rmSync;
    // Windows refuses to delete a file another process holds open; Node cannot open one
    // that way, so the refusal is simulated.
    fs.rmSync = (p, opts) => {
        if (p.startsWith(locked)) throw Object.assign(new Error('EPERM, Permission denied'), { code: 'EPERM' });
        return realRm(p, opts);
    };
    try {
        assert.strictEqual(cleanEngineScratch(root, { info() {}, warn: (_c, m) => warnings.push(m) }), 1);
    } finally {
        fs.rmSync = realRm;
    }
    assert.deepStrictEqual(fs.readdirSync(getComfyPath(root, 'output')), []);
    assert.deepStrictEqual(fs.readdirSync(locked), ['sub']);
    assert.match(warnings[0], /EPERM.*next engine start/);
});

test('nothing empties the scratch on quit, and the engine start does', () => {
    const main = fs.readFileSync(path.join(REPO, 'main.js'), 'utf8');
    const shared = fs.readFileSync(path.join(REPO, 'routes', 'shared.js'), 'utf8');
    const comfy = fs.readFileSync(path.join(REPO, 'routes', 'comfy.js'), 'utf8');
    assert.doesNotMatch(main, /cleanEngineScratch\(/);
    assert.doesNotMatch(shared, /cleanEngineScratch\(/);
    const start = comfy.indexOf('cleanEngineScratch(ENGINE_ROOT, logger)');
    const spawnAt = comfy.indexOf('processState.activeComfyProcess = spawn(');
    assert.ok(start > 0 && start < spawnAt, 'the clean runs right before the engine is spawned');
});
