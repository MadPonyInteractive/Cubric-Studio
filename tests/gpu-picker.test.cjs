'use strict';
// MPI-894 1c: which tiles the GPU overlay shows, and in what order.
const test = require('node:test');
const assert = require('node:assert/strict');

const CARDS = [
    { id: 'big-out', vramGb: 80, price: 1.99, inStock: false },
    { id: 'mid-high', vramGb: 32, price: 0.89, inStock: true, stock: 'High' },
    { id: 'small-low', vramGb: 24, price: 0.34, inStock: true, stock: 'Low' },
    { id: 'small-cheap', vramGb: 24, price: 0.2, inStock: true, stock: 'Medium' },
    { id: '__cpu__', cpu: true, inStock: true },
];

test('in-stock only by default; CPU first, then VRAM, then price', async () => {
    const { visibleGpuCards } = await import('../js/data/runpodGpuSpecs.js');
    const ids = visibleGpuCards(CARDS).map(c => c.id);
    assert.deepEqual(ids, ['__cpu__', 'small-cheap', 'small-low', 'mid-high']);
});

test('fastest first by measured Gen speed; unbenchmarked cards after, CPU still leads', async () => {
    const { visibleGpuCards } = await import('../js/data/runpodGpuSpecs.js');
    const cards = [
        { id: 'NVIDIA H200', vramGb: 141, price: 3.59, inStock: true },
        { id: 'NVIDIA GeForce RTX 4090', vramGb: 24, price: 0.74, inStock: true },
        { id: 'NVIDIA RTX PRO 6000 Blackwell Server Edition', vramGb: 96, price: 2.09, inStock: true },
        { id: '__cpu__', cpu: true, inStock: true },
        { id: 'NVIDIA GeForce RTX 5090', vramGb: 32, price: 0.99, inStock: true },
    ];
    assert.deepEqual(visibleGpuCards(cards).map(c => c.id), [
        '__cpu__',
        'NVIDIA RTX PRO 6000 Blackwell Server Edition',
        'NVIDIA GeForce RTX 5090',
        'NVIDIA GeForce RTX 4090',
        'NVIDIA H200',
    ]);
});

test('auto-retry adds the out-of-stock cards (Connect waits for them)', async () => {
    const { visibleGpuCards } = await import('../js/data/runpodGpuSpecs.js');
    assert.ok(visibleGpuCards(CARDS, { autoRetry: true }).some(c => c.id === 'big-out'));
});

test('video keeps MORE than 24 GB only; the CPU card and the selected card survive', async () => {
    const { visibleGpuCards } = await import('../js/data/runpodGpuSpecs.js');
    const ids = visibleGpuCards(CARDS, { video: true, selectedId: 'small-low' }).map(c => c.id);
    assert.deepEqual(ids, ['__cpu__', 'small-low', 'mid-high'], '24 GB is image, not video');
});

test('the selected card shows even out of stock (MPI-180)', async () => {
    const { visibleGpuCards } = await import('../js/data/runpodGpuSpecs.js');
    assert.ok(visibleGpuCards(CARDS, { selectedId: 'big-out' }).some(c => c.id === 'big-out'));
});

test('catalogueCards: EVERY Secure Cloud card, not just the ones the DC lists right now', async () => {
    const { catalogueCards, visibleGpuCards } = await import('../js/data/runpodGpuSpecs.js');
    const availability = {
        gpuTypes: [
            { id: 'rtx5090', displayName: 'RTX 5090', memoryInGb: 32, securePrice: 0.89, secureCloud: true, maxCount: 8 },
            { id: 'pro4500', displayName: 'RTX PRO 4500', memoryInGb: 32, securePrice: 0.72, secureCloud: true },
            { id: 'community-only', displayName: 'X', memoryInGb: 8, secureCloud: false },
        ],
        // EU-RO-1 lists only the PRO 4500 while the 5090 is sold out there (Fabio's screenshot).
        dataCenters: [
            { id: 'EU-RO-1', gpuAvailability: [{ gpuTypeId: 'pro4500', available: true, stockStatus: 'Low' }] },
            { id: 'US-TX-3', gpuAvailability: [{ gpuTypeId: 'rtx5090', available: true, stockStatus: 'High' }] },
        ],
    };
    const eu = catalogueCards(availability, 'EU-RO-1');
    assert.deepEqual(eu.map(c => [c.id, c.inStock, c.stock]), [['rtx5090', false, null], ['pro4500', true, 'Low']]);
    assert.equal(visibleGpuCards(eu, { autoRetry: true }).length, 2, 'auto-retry on = every card');
    assert.equal(visibleGpuCards(eu, { autoRetry: false }).length, 1, 'auto-retry off = in stock only');
    const any = catalogueCards(availability, null);
    assert.equal(any.find(c => c.id === 'rtx5090').stock, 'High', 'Any region takes the best stock in any DC');
    assert.deepEqual(catalogueCards(availability, 'NOPE'), [], 'an unknown DC lists nothing');
});

test('stock meter: out of stock is 0 bars whatever the level says', async () => {
    const { stockBars } = await import('../js/data/runpodGpuSpecs.js');
    assert.equal(stockBars({ inStock: true, stock: 'High' }), 3);
    assert.equal(stockBars({ inStock: true, stock: 'Low' }), 1);
    assert.equal(stockBars({ inStock: false, stock: 'High' }), 0);
});

test('gen speed table: finite seconds only, and a card nobody benchmarked has none', async () => {
    const { GPU_GEN_SECS, gpuGenSecs } = await import('../js/data/runpodGpuSpecs.js');
    for (const [id, v] of Object.entries(GPU_GEN_SECS)) {
        assert.ok(Number.isFinite(v) && v > 0, `${id}: ${v}`);
    }
    assert.equal(gpuGenSecs('NVIDIA H200'), null);
    // Measured order, not spec-sheet order: a PRO 6000 (500 TFLOPS) beats a B300 (2250).
    assert.ok(gpuGenSecs('NVIDIA RTX PRO 6000 Blackwell Server Edition') < gpuGenSecs('NVIDIA B300 SXM6 AC'));
});
