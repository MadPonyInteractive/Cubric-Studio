'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

/**
 * MPI-736 — the status bar wears the accent of the task AHEAD.
 *
 * The card predicted this would need the EMITTERS changed, because `tool:running` was
 * believed to carry no media type. It already carries `type` (the op key), and the bar
 * already looks that same key up for its label, so the whole change is a lookup. These
 * tests pin the two things that would silently undo it: the event still carrying `type`,
 * and every op resolving to an accent `01_base.css` actually declares.
 */

const REPO = path.join(__dirname, '..');
const statusBar = fs.readFileSync(path.join(REPO, 'js/shell/statusBar.js'), 'utf8');

test('every op resolves to a [data-accent] value that 01_base.css declares', async () => {
    const { commands, getCommandAccent } = await import('../js/data/commandRegistry.js');
    const css = fs.readFileSync(path.join(REPO, 'styles/01_base.css'), 'utf8');
    const declared = new Set([...css.matchAll(/\[data-accent="([a-z]+)"\]/g)].map(m => m[1]));

    for (const key of Object.keys(commands)) {
        assert.ok(declared.has(getCommandAccent(key)),
            `${key}: "${getCommandAccent(key)}" has no [data-accent] rule`);
    }
});

test('a Flow op carries its own media type — flows are ordinary rows, not a special case', async () => {
    const { commands, getCommandAccent } = await import('../js/data/commandRegistry.js');

    const flows = Object.keys(commands).filter(k => k.startsWith('flow'));
    assert.ok(flows.length > 0, 'expected flow* ops in the registry');
    for (const key of flows) {
        assert.notStrictEqual(getCommandAccent(key), 'studio',
            `${key} fell back to cream — a Flow op lost its mediaType`);
    }
});

test('an unknown or missing op key falls back to cream rather than throwing', async () => {
    const { getCommandAccent } = await import('../js/data/commandRegistry.js');

    assert.strictEqual(getCommandAccent('no-such-op'), 'studio');
    assert.strictEqual(getCommandAccent(undefined), 'studio');
});

// The emitter half. `tool:running` is the ONLY place the bar learns what is coming, so if
// someone drops `type` from that payload the bar goes quietly cream and no test would
// otherwise notice — the colour is not asserted anywhere a unit test can reach.
test('tool:running still carries the op key the bar reads', () => {
    const gen = fs.readFileSync(path.join(REPO, 'js/services/generationService.js'), 'utf8');
    assert.match(gen, /Events\.emit\('tool:running',\s*\{[^}]*type:\s*operation/,
        "generationService must keep emitting tool:running with `type` — the status bar's accent reads it");
});

test('the status bar sets the accent on the fill, and clears it at idle', () => {
    assert.match(statusBar, /_fill\.dataset\.accent = getCommandAccent\(type\)/,
        'the fill is the only element drawing --accent-heat, so it is the one that declares');
    assert.match(statusBar, /delete _fill\.dataset\.accent/,
        'idle is about no media type — a finished job must not leave its colour behind');
});
