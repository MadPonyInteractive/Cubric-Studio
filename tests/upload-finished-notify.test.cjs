// MPI-1057 — a finished Upload models job reaches the user through notificationService.
//
// Fabio, 2026-10-10: a 10.27 GB LoRA took 37 min to upload while he watched a movie, and
// he saw no toast. downloadService emitted a 6 s in-app toast directly, so an unfocused
// window got nothing lasting. `upload:finished` now goes through the same split as a
// model download: OS notification when unfocused, in-app toast otherwise. This drives
// the REAL module (DOM stubs as in notification-stale-count.test.cjs) on the focused
// branch, the one bare Node can observe.

const assert = require('node:assert');
const test = require('node:test');

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

const SRC = require('node:url')
    .pathToFileURL(require('node:path').join(__dirname, '..', 'js') + require('node:path').sep).href;

test('upload:finished surfaces success and failure once each', async () => {
    const [notif, statusBar, events] = await Promise.all([
        import(SRC + 'shell/notificationService.js'),
        import(SRC + 'shell/statusBar.js'),
        import(SRC + 'events.js'),
    ]);
    const fired = [];
    statusBar.StatusBar.notify = (msg, variant) => fired.push([msg, variant]);
    notif.destroyNotificationService();
    notif.initNotificationService();

    events.Events.emit('upload:finished', { filename: 'big.safetensors', ok: true });
    events.Events.emit('upload:finished', { filename: 'bad.safetensors', ok: false, error: 'HTTP 524' });
    notif.destroyNotificationService();

    assert.deepStrictEqual(fired, [
        ['big.safetensors is on the Pod.', 'success'],
        ['bad.safetensors did not upload (HTTP 524). Try it again from Upload models.', 'warning'],
    ]);
});
