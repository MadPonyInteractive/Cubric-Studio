'use strict';

// MPI-623. Two registry entries on one key used to share ONE verdict: if any entry passed
// its gate, every handler on the key fired, so an entry's `when` reading false did not stop
// its own handler. Scene's fly A then also toggled Agent mode. Each entry gates its own
// handlers now; bind order and the one-call-per-function rule are kept.

const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

// Browser globals the manager, the registry and state.js reach for at load or in a `when`.
globalThis.window = globalThis.window || { addEventListener() {}, removeEventListener() {} };
globalThis.document = globalThis.document || { querySelector: () => null, querySelectorAll: () => [] };
globalThis.HTMLTextAreaElement = globalThis.HTMLTextAreaElement || class HTMLTextAreaElement {};
globalThis.HTMLInputElement = globalThis.HTMLInputElement || class HTMLInputElement {};

const esm = (p) => import(pathToFileURL(path.join(__dirname, '..', p)).href);

const key = (k, extra = {}) => ({
    key: k, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false,
    preventDefault() { this.prevented = true; }, stopPropagation() {}, ...extra,
});

async function load() {
    const { Hotkeys } = await esm('js/managers/hotkeyManager.js');
    const { state } = await esm('js/state.js');
    return { Hotkeys, state };
}

test('a handler fires only when ITS entry passes, not when a sibling on the key does', async () => {
    const { Hotkeys } = await load();
    const calls = [];
    // Escape: overlay.close has no `when`; promptBox.blur wants a prompt-box textarea focused.
    const offA = Hotkeys.bind('overlay.close', () => calls.push('overlay'));
    const offB = Hotkeys.bind('promptBox.blur', () => calls.push('blur'));
    try {
        const e = key('Escape');
        Hotkeys._handle(e, 'down');
        assert.deepEqual(calls, ['overlay'], 'promptBox.blur\'s gate is false with nothing focused');
        assert.equal(e.prevented, true);
    } finally { offA(); offB(); }
});

test('same-gate entries keep bind order and call a shared function once', async () => {
    const { Hotkeys } = await load();
    const calls = [];
    const shared = () => calls.push('shared');
    const offs = [
        Hotkeys.bind('mask.brush.canvas', () => calls.push('canvas')),
        Hotkeys.bind('mask.brush.toolbar', () => calls.push('toolbar')),
        Hotkeys.bind('mask.brush.canvas', shared),
        Hotkeys.bind('mask.brush.toolbar', shared),
    ];
    try {
        Hotkeys._handle(key('b'), 'down');
        assert.deepEqual(calls, ['canvas', 'toolbar', 'shared']);
    } finally { offs.forEach(off => off()); }
});

test('on the Scene page A flies left and does not toggle Agent mode; elsewhere the reverse', async () => {
    const { Hotkeys, state } = await load();
    const calls = [];
    const offs = [
        Hotkeys.bind('agentMode.toggle', () => calls.push('agent')),
        Hotkeys.bind('scene.fly.left', () => calls.push('fly')),
        Hotkeys.bind('scene.fly.left.release', () => calls.push('stop')),
    ];
    const was = state.currentPage;
    try {
        state.currentPage = 'scene';
        Hotkeys._handle(key('a'), 'down');
        Hotkeys._handle(key('a'), 'up');
        assert.deepEqual(calls, ['fly', 'stop']);
        calls.length = 0;
        state.currentPage = 'gallery';
        Hotkeys._handle(key('a'), 'down');
        Hotkeys._handle(key('a'), 'up');
        assert.deepEqual(calls, ['agent']);
    } finally {
        state.currentPage = was;
        offs.forEach(off => off());
    }
});

test('every fly key has a down and an up entry gated to the Scene page', async () => {
    const { HOTKEY_REGISTRY } = await esm('js/managers/hotkeyRegistry.js');
    for (const dir of ['forward', 'back', 'left', 'right', 'down', 'up']) {
        const down = HOTKEY_REGISTRY.find(e => e.id === `scene.fly.${dir}`);
        const up = HOTKEY_REGISTRY.find(e => e.id === `scene.fly.${dir}.release`);
        assert.ok(down && up, dir);
        assert.equal(down.key, up.key);
        assert.deepEqual([down.type, up.type], ['down', 'up']);
        assert.equal(down.when({ state: { currentPage: 'scene' } }), true);
        assert.equal(up.when({ state: { currentPage: 'gallery' } }), false);
    }
});
