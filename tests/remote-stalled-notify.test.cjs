// MPI-1057 — the 8-min stall cap reaches an unfocused window as an OS notification.
//
// Fabio, 2026-10-11: the "Pod never started" dialog only shows in-app, so a user who
// looked away kept waiting on a Pod the backend had already deleted. `remote:stalled`
// now sends `notify-connection-complete` when the window is unfocused. This drives the
// REAL module with a fake electron (the unfocused branch); focused, it stays silent
// (the dialog covers it).

const assert = require('node:assert');
const test = require('node:test');

const sent = [];
let focused = false;
globalThis.window = {
    require: (m) => (m === 'electron' ? { ipcRenderer: { send: (ch, p) => sent.push([ch, p]), on() {} } } : undefined),
    addEventListener() {}, removeEventListener() {},
    setTimeout: (...a) => setTimeout(...a),
    matchMedia: () => ({ matches: false, addEventListener() {} }),
};
globalThis.document = {
    hasFocus: () => focused,
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

test('remote:stalled sends an OS notification only when unfocused', async () => {
    const [notif, events] = await Promise.all([
        import(SRC + 'shell/notificationService.js'),
        import(SRC + 'events.js'),
    ]);
    notif.destroyNotificationService();
    notif.initNotificationService();

    focused = true;
    events.Events.emit('remote:stalled');
    focused = false;
    events.Events.emit('remote:stalled');
    notif.destroyNotificationService();

    const stalled = sent.filter(([ch, p]) => ch === 'notify-connection-complete' && p.title === 'Pod never started');
    assert.strictEqual(stalled.length, 1);
});
