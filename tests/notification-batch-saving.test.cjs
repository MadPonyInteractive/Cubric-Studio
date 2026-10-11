// MPI-1076 — a queue of two said "Generation finished." twice (Fabio, 2026-10-11).
//
// The coalescer took `generationQueueCount` reaching 0 as "the batch is done". It is not:
// the store releases the LAST item's lane when ComfyUI returns, and generationService then
// spends however long the project save takes before it emits that item's
// `generation:complete`. A save over the 150 ms flush defer let item 1's count flush on
// its own, and item 2's completion then flushed a second toast. A batch is done when the
// count is 0 AND no run is still registered in activeGenerations (end() is called after
// the save, right before the emit).
//
// Drives the REAL module, same DOM stubs as notification-stale-count.test.cjs.

const assert = require('node:assert');
const test = require('node:test');
const path = require('node:path');

globalThis.window = {
    require: undefined,
    addEventListener() {}, removeEventListener() {},
    setTimeout: (...a) => setTimeout(...a),
    matchMedia: () => ({ matches: false, addEventListener() {} }),
};
globalThis.document = {
    hasFocus: () => true,
    addEventListener() {}, removeEventListener() {},
    querySelector: () => null, querySelectorAll: () => [], getElementById: () => null,
    createElement: () => ({
        style: {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
        appendChild() {}, setAttribute() {}, addEventListener() {},
    }),
    body: { appendChild() {} },
    documentElement: { style: { setProperty() {} } },
};
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.fetch = async () => ({ ok: true, json: async () => ({}) });

const SRC = require('node:url').pathToFileURL(path.join(__dirname, '..', 'js') + path.sep).href;
const settle = () => new Promise(r => setTimeout(r, 250)); // past the 150ms flush defer

async function harness() {
    const [notif, statusBar, events, stateMod, ag] = await Promise.all([
        import(SRC + 'shell/notificationService.js'),
        import(SRC + 'shell/statusBar.js'),
        import(SRC + 'events.js'),
        import(SRC + 'state.js'),
        import(SRC + 'services/activeGenerations.js'),
    ]);
    const fired = [];
    statusBar.StatusBar.notify = (msg) => fired.push(msg);
    notif.destroyNotificationService();
    notif.initNotificationService();
    return { fired, notif, Events: events.Events, state: stateMod.state, ag: ag.activeGenerations };
}

test('a queue of two whose last item is still saving says one thing, once', async () => {
    const { fired, notif, Events, state, ag } = await harness();
    const a = ag.start({ scope: 'gallery', operation: 't2i' }).id;
    const b = ag.start({ scope: 'gallery', operation: 't2i' }).id;
    state.generationQueueCount = 2;

    // Item 1 saves and completes; item 2 is running.
    ag.end(a);
    Events.emit('generation:complete', { cancelled: false, item: { operation: 't2i' } });
    state.generationQueueCount = 1;
    await settle();

    // Item 2's lane releases (count 0) but its save is still in flight, past the defer.
    state.generationQueueCount = 0;
    await settle();
    assert.deepStrictEqual(fired, [], 'flushed while the last item was still saving');

    ag.end(b);
    Events.emit('generation:complete', { cancelled: false, item: { operation: 't2i' } });
    await settle();
    assert.deepStrictEqual(fired, ['2 generations finished.']);
    notif.destroyNotificationService();
});

test('a batch whose last item fails still reports the ones that finished', async () => {
    // generation:error is the drain edge then: nothing else re-arms the flush.
    const { fired, notif, Events, state, ag } = await harness();
    const a = ag.start({ scope: 'gallery', operation: 't2i' }).id;
    const b = ag.start({ scope: 'gallery', operation: 't2i' }).id;
    state.generationQueueCount = 2;
    ag.end(a);
    Events.emit('generation:complete', { cancelled: false, item: { operation: 't2i' } });
    state.generationQueueCount = 0;
    await settle();
    ag.end(b);
    Events.emit('generation:error', { id: b });
    await settle();
    assert.deepStrictEqual(fired, ['Generation finished.']);
    notif.destroyNotificationService();
});
