'use strict';

/**
 * MPI-949 — batch/grouped queue entry contract.
 *
 * Tests two layers:
 *   1. Pure collapse logic (`collapseQueueBatches` from generationBatch.js) —
 *      no service state, no side effects, fully deterministic.
 *   2. Integration: `cancelBatch` exercises the live service module, verifying
 *      that pending jobs are removed and the running slot is cleared.
 *
 * `fetch` is stubbed to a never-resolving promise BEFORE any import so
 * dispatched jobs hang in the commandExecutor async IIFE without completing,
 * which keeps _lanes[lane].active set and _cueQueue intact long enough for
 * the synchronous assertions to run. No network call reaches the running app.
 */

const test  = require('node:test');
const assert = require('node:assert');
const path  = require('node:path');
const { pathToFileURL } = require('node:url');

const mod = (...p) => pathToFileURL(path.join(__dirname, '..', ...p)).href;

// Stub fetch BEFORE any import — a hanging promise keeps dispatched jobs'
// async IIFE suspended without rejecting, so there are no unhandled rejections.
globalThis.fetch = () => new Promise(() => {});

let collapseQueueBatches;
let enqueueGeneration, cancelBatch, peekCueQueue, getGenerationQueueSnapshot;

test.before(async () => {
    ({ collapseQueueBatches } = await import(mod('js', 'services', 'generationBatch.js')));
    ({
        enqueueGeneration,
        cancelBatch,
        peekCueQueue,
        getGenerationQueueSnapshot,
    } = await import(mod('js', 'services', 'generationService.js')));
});

// ── Pure collapse: snapshot items with batchId ────────────────────────────

test('collapseQueueBatches: 3 jobs sharing a batchId collapse to ONE row', () => {
    const mkItem = (jobId, status) => ({
        batchId: 'b1', batchLabel: 'Upscale', batchTotal: 3,
        status, queueJobId: jobId, modelName: 'Klein', operation: 'upscale',
        engine: 'local', source: 'manual', isLoop: false, scope: 'gallery',
        previewUrl: null, activeGenerationId: null, previewKind: '',
        mediaItems: [], width: 0, height: 0,
    });
    const items = [
        mkItem('j1', 'running'),
        mkItem('j2', 'pending'),
        mkItem('j3', 'pending'),
    ];
    const result = collapseQueueBatches(items);
    assert.strictEqual(result.length, 1, 'three batched jobs → one row');
    assert.ok(result[0].isBatch, 'row is flagged isBatch');
    assert.strictEqual(result[0].batchId, 'b1');
    assert.strictEqual(result[0].batchTotal, 3);
    assert.strictEqual(result[0].batchDone, 0, 'no jobs finished yet → done 0');
    assert.strictEqual(result[0].status, 'running', 'running job present → status running');
    assert.ok(result[0].canStop, 'canStop because a running job exists');
    assert.ok(result[0].canCancel, 'canCancel because pending jobs exist');
});

test('collapseQueueBatches: after one job finishes batchDone is 1/3', () => {
    // Only 2 remain in the snapshot; batchTotal carried on each item is 3.
    const mkItem = (jobId) => ({
        batchId: 'b1', batchLabel: 'Upscale', batchTotal: 3,
        status: 'pending', queueJobId: jobId, modelName: 'Klein', operation: 'upscale',
        engine: 'local', source: 'manual', isLoop: false, scope: 'gallery',
        previewUrl: null, activeGenerationId: null, previewKind: '',
        mediaItems: [], width: 0, height: 0,
    });
    const result = collapseQueueBatches([mkItem('j2'), mkItem('j3')]);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].batchDone, 1, 'one job finished → done 1');
    assert.strictEqual(result[0].batchTotal, 3);
    assert.strictEqual(result[0].status, 'pending');
    assert.ok(!result[0].canStop, 'no running job → canStop false');
    assert.ok(result[0].canCancel);
});

test('collapseQueueBatches: unbatched jobs pass through unchanged', () => {
    const items = [
        { status: 'running', queueJobId: 'x1', modelName: 'M', operation: 'gen' },
        { status: 'pending', queueJobId: 'x2', modelName: 'M', operation: 'gen' },
    ];
    const result = collapseQueueBatches(items);
    assert.strictEqual(result.length, 2);
    assert.ok(!result[0].isBatch, 'unbatched item not flagged isBatch');
    assert.ok(!result[1].isBatch);
    assert.strictEqual(result[0], items[0], 'same object reference');
    assert.strictEqual(result[1], items[1]);
});

test('collapseQueueBatches: two batches stay separate', () => {
    const mkA = (id, status) => ({
        batchId: 'bA', batchTotal: 2, status, queueJobId: id,
    });
    const mkB = (id) => ({
        batchId: 'bB', batchTotal: 3, status: 'pending', queueJobId: id,
    });
    const items = [mkA('a1', 'running'), mkA('a2', 'pending'), mkB('b1'), mkB('b2'), mkB('b3')];
    const result = collapseQueueBatches(items);
    assert.strictEqual(result.length, 2, 'two batches → two rows');
    assert.strictEqual(result[0].batchId, 'bA');
    assert.strictEqual(result[0].batchTotal, 2);
    assert.strictEqual(result[1].batchId, 'bB');
    assert.strictEqual(result[1].batchTotal, 3);
    assert.strictEqual(result[1].batchDone, 0);
});

test('collapseQueueBatches: mixed batched and unbatched preserves order', () => {
    const items = [
        { queueJobId: 'u1', status: 'running' },
        { batchId: 'b1', batchTotal: 2, status: 'pending', queueJobId: 'b1a' },
        { batchId: 'b1', batchTotal: 2, status: 'pending', queueJobId: 'b1b' },
        { queueJobId: 'u2', status: 'pending' },
    ];
    const result = collapseQueueBatches(items);
    // Expect: [unbatched u1, batch b1 (collapsed), unbatched u2]
    assert.strictEqual(result.length, 3);
    assert.strictEqual(result[0].queueJobId, 'u1');
    assert.ok(result[1].isBatch);
    assert.strictEqual(result[2].queueJobId, 'u2');
});

// ── Integration: cancelBatch via generationService ────────────────────────

// Use text-to-image (no required media slot, no requiresMask) so enqueueGeneration
// passes all pre-dispatch guards and actually queues the jobs.
const _cfg = () => ({
    model: { id: 'test-model', mediaType: 'image' },
    operation: 'text-to-image',
    positive: 'test prompt',
    mediaItems: [],
});

test('cancelBatch: removes all pending for the batch and clears the running slot', () => {
    const bOpts = { batchId: 'cancel-test-batch', batchLabel: 'Upscale', batchTotal: 3 };
    enqueueGeneration(_cfg(), {}, { ...bOpts });
    enqueueGeneration(_cfg(), {}, { ...bOpts });
    enqueueGeneration(_cfg(), {}, { ...bOpts });

    // First job was dispatched immediately (no lane was busy); 2 stay pending.
    const pendingBefore = peekCueQueue().filter(j => j.opts?.batchId === 'cancel-test-batch');
    assert.strictEqual(pendingBefore.length, 2, '2 jobs pending after enqueue');

    cancelBatch('cancel-test-batch');

    // All pending removed.
    const pendingAfter = peekCueQueue().filter(j => j.opts?.batchId === 'cancel-test-batch');
    assert.strictEqual(pendingAfter.length, 0, 'no pending jobs remain after cancelBatch');

    // Snapshot reflects no items for this batch.
    const snap = getGenerationQueueSnapshot();
    const batchRow = snap.items.find(i => i.batchId === 'cancel-test-batch');
    assert.ok(!batchRow, 'batch row absent from snapshot after cancelBatch');
});

test('cancelBatch: unbatched jobs in the queue are untouched', () => {
    const bOpts = { batchId: 'selective-batch', batchTotal: 2 };
    // Enqueue 2 batched jobs and 1 unbatched job.
    // The first enqueue dispatches job-1 to the active slot; job-2 (batched) and
    // job-3 (unbatched) both stay pending.
    enqueueGeneration(_cfg(), {}, { ...bOpts });
    enqueueGeneration(_cfg(), {}, { ...bOpts });
    enqueueGeneration(_cfg(), {}); // no batchId

    // Verify queue depth before cancel.
    const pendingBefore = peekCueQueue();
    assert.ok(pendingBefore.length >= 2, 'at least 2 pending before cancelBatch');

    cancelBatch('selective-batch');

    // The unbatched job must still be pending.
    const remainingPending = peekCueQueue();
    assert.ok(
        remainingPending.some(j => !j.opts?.batchId),
        'unbatched job still pending after cancelBatch',
    );
    // No batched jobs left.
    assert.ok(
        !remainingPending.some(j => j.opts?.batchId === 'selective-batch'),
        'batched jobs fully removed',
    );
});

test('cancelBatch: snapshot getGenerationQueueSnapshot uses collapseQueueBatches', () => {
    // This is a structural check: verify that the snapshot items are the
    // collapsed form, not the raw list. We can confirm by checking that three
    // freshly-enqueued jobs with the same batchId produce exactly ONE item.
    const bOpts = { batchId: 'snapshot-check-batch', batchTotal: 3 };
    enqueueGeneration(_cfg(), {}, { ...bOpts });
    enqueueGeneration(_cfg(), {}, { ...bOpts });
    enqueueGeneration(_cfg(), {}, { ...bOpts });

    const snap = getGenerationQueueSnapshot();
    const batchItems = snap.items.filter(i => i.batchId === 'snapshot-check-batch');
    assert.strictEqual(batchItems.length, 1, 'three batched jobs → one collapsed row in snapshot');
    assert.ok(batchItems[0].isBatch);
    assert.strictEqual(batchItems[0].batchTotal, 3);

    // Cleanup so subsequent tests see a clean slate.
    cancelBatch('snapshot-check-batch');
});
