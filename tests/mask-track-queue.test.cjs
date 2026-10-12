'use strict';

/**
 * MPI-1106 — the GIF cut-out / Video Mask track is a generation-queue job.
 *
 * It ran beside the queue (`runGifCutoutTrack` straight onto the engine): no queue row, no
 * Stop in the queue panel, and a BiRefNet / SAM3 pass over every frame competing with
 * whatever generation was running. Now every caller goes through `enqueueMaskTrack`, and
 * the runner registers a store job on the engine's lane. These tests drive the real
 * generationService + commandExecutor with only the engine's `runWorkflow` stubbed.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const root = path.join(__dirname, '..');
const mod = (...p) => pathToFileURL(path.join(root, ...p)).href;

const SAM3 = JSON.parse(fs.readFileSync(path.join(root, 'comfy_workflows', 'gif_cutout_sam3.json'), 'utf8'));
const nodeTitled = (title) => Object.keys(SAM3).find(id => SAM3[id]._meta?.title === title);

// Stub fetch BEFORE any import: a workflow file answers from disk, anything else hangs quietly.
globalThis.fetch = async (url) => {
    const m = /^\/comfy_workflows\/(.+\.json)$/.exec(String(url));
    if (m) return { ok: true, json: async () => JSON.parse(fs.readFileSync(path.join(root, 'comfy_workflows', m[1]), 'utf8')) };
    return new Promise(() => {});
};

let enqueueMaskTrack, getGenerationQueueSnapshot, engine;

test.before(async () => {
    ({ enqueueMaskTrack, getGenerationQueueSnapshot } = await import(mod('js', 'services', 'generationService.js')));
    const { getEngine } = await import(mod('js', 'services', 'comfyController.js'));
    engine = getEngine(true);
});

/** A run the test finishes by hand: `release()` sends the masks, `fail(err)` ends it. */
function stubRun() {
    const run = { params: null, interrupted: null };
    engine.interrupt = (id) => { run.interrupted = id; run.fail(Object.assign(new Error('interrupted'), { code: 'INTERRUPTED' })); };
    engine.deleteQueueItem = () => {};
    engine.runWorkflow = (workflow, params, onMessage) => new Promise((resolve, reject) => {
        run.params = params;
        onMessage({ type: 'prompt_ack', prompt_id: 'p-1' });
        run.release = (n = 3) => {
            onMessage({ type: 'executed', data: { node: nodeTitled('Output_Preview'), output: { images: [{ filename: 'preview.mp4', type: 'temp' }] } } });
            const images = Array.from({ length: n }, (_, i) => ({ filename: `m_${i}.png`, type: 'temp' }));
            onMessage({ type: 'executed', data: { node: nodeTitled('Output_Mask'), output: { images } } });
            resolve();
        };
        run.fail = reject;
    });
    return run;
}

const tick = () => new Promise(r => setTimeout(r, 0));
const until = async (fn) => { for (let i = 0; i < 200 && !fn(); i++) await tick(); assert.ok(fn(), 'timed out waiting'); };

test('a mask track is a queue row, and hands back its masks and the SAM3 preview', async () => {
    const run = stubRun();
    const got = {};
    const handle = enqueueMaskTrack(
        { operation: 'gifCutoutSam3', videoPath: 'C:/p/Media/.tmp/track.mp4', textPrompt: 'cat:4', objectIndices: '', label: 'cat' },
        {
            onMasks: (urls) => { got.masks = urls; },
            onMaskPreview: (url) => { got.preview = url; },
            onCancel: () => { got.cancelled = true; },
            onError: (err) => { got.error = err; },
        },
    );
    assert.ok(handle?.queueJobId, 'queued');
    await until(() => run.params);

    const row = getGenerationQueueSnapshot().items.find(j => j.queueJobId === handle.queueJobId);
    assert.ok(row, 'the run shows in the queue while it runs');
    assert.equal(row.status, 'running');
    assert.equal(row.operation, 'gifCutoutSam3');

    assert.equal(run.params.Input_Video, 'C:/p/Media/.tmp/track.mp4');
    assert.equal(run.params['Input_Text_Prompt.text'], 'cat:4');
    assert.equal(run.params['Input_Object_Indices.object_indices'], '');

    run.release(3);
    await until(() => got.masks);
    assert.equal(got.masks.length, 3, 'one mask per frame');
    assert.match(got.masks[0], /m_0\.png/);
    assert.match(got.preview, /preview\.mp4/);
    assert.ok(!got.cancelled && !got.error);
    await until(() => !getGenerationQueueSnapshot().items.some(j => j.queueJobId === handle.queueJobId));
});

test('Stop interrupts our prompt and ends as a cancel, not a result', async () => {
    const run = stubRun();
    const got = {};
    const handle = enqueueMaskTrack(
        { operation: 'gifCutoutBirefnet', videoPath: 'C:/p/Media/.tmp/track2.mp4', label: '' },
        {
            onMasks: (urls) => { got.masks = urls; },
            onCancel: () => { got.cancelled = true; },
            onError: (err) => { got.error = err; },
        },
    );
    await until(() => run.params);
    assert.equal(run.params['Input_Text_Prompt.text'], undefined, 'BiRefNet takes the video only');

    handle.cancel();
    await until(() => got.cancelled);
    assert.equal(run.interrupted, 'p-1', 'the interrupt names OUR prompt');
    assert.equal(got.masks, undefined);
    assert.equal(got.error, undefined);
    await until(() => !getGenerationQueueSnapshot().items.some(j => j.queueJobId === handle.queueJobId));
});
