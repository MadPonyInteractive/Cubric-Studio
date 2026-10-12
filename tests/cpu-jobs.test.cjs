// MPI-1104 — runCpuJob puts a row in state.cpuJobs (the queue panel's Transfers list),
// patches its progress, and takes it out on every end, success or failure.

const assert = require('node:assert');
const test = require('node:test');
const path = require('node:path');

globalThis.window = { addEventListener() {}, removeEventListener() {} };
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };

const SRC = require('node:url').pathToFileURL(path.join(__dirname, '..', 'js') + path.sep).href;

test('a CPU job shows a row with no % until progress is set, and leaves on every end', async () => {
    const [{ runCpuJob }, { state }] = await Promise.all([
        import(SRC + 'services/cpuJobs.js'),
        import(SRC + 'state.js'),
    ]);

    const result = await runCpuJob('Copying files', async (setProgress) => {
        assert.deepStrictEqual(state.cpuJobs.map(j => [j.label, j.progress]), [['Copying files', null]]);
        setProgress(0.25);
        assert.strictEqual(state.cpuJobs[0].progress, 0.25);
        setProgress(7);
        assert.strictEqual(state.cpuJobs[0].progress, 1);
        return 'ok';
    });
    assert.strictEqual(result, 'ok');
    assert.deepStrictEqual(state.cpuJobs, []);

    await assert.rejects(runCpuJob('Cleanup', async () => { throw new Error('boom'); }), /boom/);
    assert.deepStrictEqual(state.cpuJobs, []);
});
