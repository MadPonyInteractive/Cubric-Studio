/**
 * Quit cleanup of the SHARED engine input/output (MPI-778).
 *
 * Every instance on a checkout shares one engine, so only the instance that spawned it
 * may empty these folders. A non-owner (E2E, app:isolated, a lock-quit second launch)
 * used to delete a live instance's staged inputs and uncollected outputs.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { getComfyPath } = require('../routes/platformEngine');
const { cleanEngineScratch } = require('../routes/engineScratch');

const quiet = { info() {} };

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

test('an instance that does not own the engine leaves input/output alone', () => {
    const { root, files } = seedEngine();
    assert.strictEqual(cleanEngineScratch(root, false, quiet), false);
    for (const f of files) assert.ok(fs.existsSync(f), `${f} was deleted`);
});

test('the owner empties input/output and keeps the folders', () => {
    const { root } = seedEngine();
    assert.strictEqual(cleanEngineScratch(root, true, quiet), true);
    for (const dir of ['input', 'output']) {
        assert.deepStrictEqual(fs.readdirSync(getComfyPath(root, dir)), []);
    }
});
