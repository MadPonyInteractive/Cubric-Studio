/**
 * selectGpu — the card the smoke runner asks RunPod for (MPI-450, 2026-08-10).
 *
 * The run this covers died AFTER its ~300 GB fill leg and after the CPU Pod was already
 * deleted: RunPod refused the L4 create with HTTP 502 ("no longer any instances
 * available"), `app()` throws on any non-2xx, and the refusal therefore flew past the
 * retry loop that exists to absorb it. The other half of the fix is here — a card that has
 * refused a create must drop out of the running even though the availability payload still
 * advertises it, because availability is a snapshot and a create is the real answer.
 *
 * pickGpu --wait (MPI-595 B1, 2026-09-28): stock in EU-RO-1 turned over faster than a run
 * could reach its GPU step, so the runner now waits for stock instead of dying.
 */
const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

// A fake app answering /runpod/gpu-availability. `stockFor(call)` decides each answer.
let selectGpu, pickGpu, server, calls = 0, stockFor = () => [];
test.before(async () => {
    server = http.createServer((req, res) => {
        calls++;
        const ids = stockFor(calls);
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
            gpuTypes: [
                { id: 'NVIDIA GeForce RTX 5090', displayName: 'RTX 5090' },
                { id: 'NVIDIA GeForce RTX 4090', displayName: 'RTX 4090' },
                { id: 'NVIDIA A100 80GB PCIe', displayName: 'A100 PCIe' },
            ],
            dataCenters: [{ id: 'EU-RO-1', gpuAvailability: ids.map(gpuTypeId => ({ gpuTypeId, available: true })) }],
        }));
    });
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    // Read at import: the runner's APP url and its transcript path. The transcript must NOT
    // be dev_configs/smoke-run.txt, which the first log() of a process truncates.
    process.env.CUBRIC_PORT = String(server.address().port);
    process.env.CUBRIC_SMOKE_RUN_LOG = path.join(os.tmpdir(), `smoke-gpu-fallback-${process.pid}.txt`);
    ({ selectGpu, pickGpu } = await import('../scripts/smoke-workflows.mjs'));
});
test.after(() => server.close());

// pickGpu stamps `inStock` from the run's data center (MPI-894); selectGpu reads only that.
const stocked = (id, displayName) => ({ id, displayName, inStock: true });
const dry = (id, displayName) => ({ id, displayName, inStock: false });
const R4090 = stocked('NVIDIA GeForce RTX 4090', 'RTX 4090');
const A100 = stocked('NVIDIA A100 80GB PCIe', 'A100 PCIe');

test('picks the top preferred card when everything is in stock', () => {
    const { hit, rank } = selectGpu([
        R4090,
        stocked('NVIDIA L4', 'L4'),
        stocked('NVIDIA GeForce RTX 5090', 'RTX 5090'),
        A100,
    ]);
    assert.equal(hit.displayName, 'RTX 5090', 'preference #1 regardless of array order');
    assert.equal(rank, 1);
});

test('falls to the next preference when the top card is not offered at all', () => {
    const { hit, rank } = selectGpu([A100, R4090]);
    assert.equal(hit.displayName, 'RTX 4090');
    assert.equal(rank, 2, 'rank reports the real position, not 1');
});

// L4 (54 GB hosts) and RTX 3090 (30 GB) left GPU_ORDER on 2026-09-28: neither can meet the
// 60 or 80 GB floor, so under --wait each would be a refused create on every poll.
test('L4 and RTX 3090 are never picked, even when they are all that is in stock', () => {
    const { hit } = selectGpu([stocked('NVIDIA L4', 'L4'), stocked('NVIDIA GeForce RTX 3090', 'RTX 3090')]);
    assert.equal(hit, null);
});

test('a card that already refused a create is skipped for the next preference', () => {
    const { hit, notes } = selectGpu([R4090, A100], ['NVIDIA GeForce RTX 4090']);
    assert.equal(hit.displayName, 'A100 PCIe', 'must advance past the refused card, not re-offer it');
    assert.ok(notes.some(n => /refused a create already/.test(n)), 'says WHY it moved on');
});

test('exclusion does not depend on the payload dropping the card', () => {
    // The real failure: RunPod kept advertising L4 as available in the very same payload
    // that had just refused to create one. Stock is not the signal here — the refusal is.
    const { hit } = selectGpu([R4090], ['NVIDIA GeForce RTX 4090']);
    assert.equal(hit, null, 'nothing left to try once the only card has refused');
});

test('out-of-stock cards are passed over', () => {
    const { hit, notes } = selectGpu([dry('NVIDIA GeForce RTX 4090', 'RTX 4090'), A100]);
    assert.equal(hit.displayName, 'A100 PCIe');
    assert.ok(notes.some(n => /no availability/.test(n)));
});

test('name matching is exact — L40/L40S, 3090 Ti and A100 SXM are different, pricier cards', () => {
    const { hit } = selectGpu([
        stocked('NVIDIA L40S', 'L40S'),
        stocked('NVIDIA L40', 'L40'),
        stocked('NVIDIA GeForce RTX 3090 Ti', 'RTX 3090 Ti'),
        stocked('NVIDIA A100-SXM4-80GB', 'A100 SXM'),
        R4090,
    ]);
    assert.equal(hit.displayName, 'RTX 4090', 'a substring match would have rented an L40S here');
});

// Negative control: without the exclusion the same input keeps handing back the sold-out
// card, which is precisely the loop the fix removes. If this ever fails, the exclusion has
// stopped being load-bearing and the tests above prove nothing.
test('control — with no exclusion the refused card is offered again', () => {
    const { hit } = selectGpu([R4090, A100], []);
    assert.equal(hit.displayName, 'RTX 4090');
});

test('--wait: polls until a listed card comes into stock, renting nothing meanwhile', async () => {
    calls = 0;
    stockFor = (n) => (n < 3 ? [] : ['NVIDIA GeForce RTX 4090']);
    const hit = await pickGpu(null, [], 0.01);
    assert.equal(hit.id, 'NVIDIA GeForce RTX 4090');
    assert.equal(calls, 3, 'two empty polls, then the card');
});

test('--wait: a refusal is forgotten on the next poll, so the same card is tried again', async () => {
    calls = 0;
    stockFor = () => ['NVIDIA GeForce RTX 4090'];
    const exclude = ['NVIDIA GeForce RTX 4090'];
    const hit = await pickGpu(null, exclude, 0.01);
    assert.equal(hit.id, 'NVIDIA GeForce RTX 4090');
    assert.equal(calls, 2, 'poll 1 honours the refusal, poll 2 forgets it');
    assert.equal(exclude.length, 0, 'the caller\'s refused list is cleared, not copied');
});
