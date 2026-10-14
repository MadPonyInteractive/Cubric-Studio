/**
 * status-bar-hold.test.cjs — MPI-1101. A multi-pass Flow run keeps the status bar between passes.
 *
 * Make seamless at 16K runs 11 windows. Each window's job settles, the store has no running
 * job, and the bar self-healed to `IDLE · Local` while the run went on: the result landing,
 * the next window being cut, the next pass waiting in the queue (~15 s a gap at 16K, seen
 * live 2026-10-13). A pass that is not the last now sends `tool:hold`; the bar sweeps under
 * the run's label until the next pass's `tool:running`, and a run that ends in between
 * (cancel, error) lets go through flowService's `releaseHoldOnEnd`.
 *
 * WHY A FAKE DOM: bare Node has no document; the fakes record the label text and the fill's
 * classes, which is all the user sees of this.
 *
 * Run: node --test tests/status-bar-hold.test.cjs
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const esm = p => import('file://' + path.join(ROOT, p).replace(/\\/g, '/'));

function el() {
    const classes = new Set();
    return {
        textContent: '', className: '', dataset: {}, style: { setProperty() {} },
        classList: { add: (...c) => c.forEach(x => classes.add(x)), remove: (...c) => c.forEach(x => classes.delete(x)), has: c => classes.has(c) },
        appendChild() {}, querySelector: () => el(), _classes: classes,
    };
}
const ELS = {};
globalThis.document = {
    getElementById: id => (ELS[id] ||= el()),
    querySelector: () => el(), addEventListener() {}, createElement: () => el(), body: { appendChild() {} },
};
globalThis.MutationObserver = class { observe() {} disconnect() {} };
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.EventSource ||= class { addEventListener() {} close() {} };

let bar;
const label = () => ELS['shell-info-job-label'].textContent;
const sweeping = () => ELS['shell-info-fill']._classes.has('shell-info__fill--indeterminate');
const T = 'groupHistory';

test.before(async () => {
    const { StatusBar } = await esm('js/shell/statusBar.js');
    const { Events } = await esm('js/events.js');
    StatusBar.init();
    StatusBar.listen();
    bar = { Events };
});

// The settle: the pass's job leaves the store, which self-heals the bar to idle.
const settle = () => bar.Events.emit('generation-store:changed', { running: [], pending: [] });
const running = (id, step) => bar.Events.emit('tool:running', { tool: T, id, type: 'flowMakeSeamless', step });

test('between two passes the bar holds on the run instead of reading IDLE', () => {
    running('gen-3', '3/11');
    assert.doesNotMatch(label(), /IDLE/);
    settle();
    assert.match(label(), /IDLE/, 'precondition: the settle self-heals an un-held bar to idle');
    bar.Events.emit('tool:hold', { tool: T, active: true, run: 'run-A', type: 'flowMakeSeamless', step: '4/11' });
    assert.doesNotMatch(label(), /IDLE/, 'held: the run is still going');
    assert.match(label(), /4\/11/, 'the hold names the pass that comes next');
    assert.ok(sweeping(), 'no real % between passes: the moving sweep, never a still bar');

    // The store stays empty while the result lands and the next window is cut.
    settle();
    assert.doesNotMatch(label(), /IDLE/, 'an empty store must not self-heal a held bar');
    // The finished pass's own terminal arrives AFTER the hold (generationService order).
    bar.Events.emit('tool:idle', { tool: T, id: 'gen-3', type: 'flowMakeSeamless' });
    bar.Events.emit('tool:cancelled', { tool: T, id: 'gen-3' });
    assert.doesNotMatch(label(), /IDLE/, 'the finished pass settling late must not end the run');

    // The next pass enters: the hold ends and the pass drives the bar as any job does.
    running('gen-4', '4/11');
    assert.doesNotMatch(label(), /IDLE/);
    settle();
    bar.Events.emit('tool:idle', { tool: T, id: 'gen-4', type: 'flowMakeSeamless' });
    assert.match(label(), /IDLE/, 'the last pass ends the bar as before');
});

test('a run that stops between passes lets go; another run cannot', () => {
    running('gen-1', '1/3');
    settle();
    bar.Events.emit('tool:hold', { tool: T, active: true, run: 'run-B', type: 'flowMakeSeamless', step: '2/3' });
    bar.Events.emit('tool:hold', { tool: T, active: false, run: 'run-OTHER' });
    assert.doesNotMatch(label(), /IDLE/, "another run's end must not release this run's hold");
    bar.Events.emit('tool:hold', { tool: T, active: false, run: 'run-B' });
    assert.match(label(), /IDLE/, 'the run ended between passes: the bar visibly leaves its running state');
    assert.ok(!sweeping(), 'idle stops the sweep');
});

test('releaseHoldOnEnd: a cancel or an error releases the run, then reaches the caller', async () => {
    const { releaseHoldOnEnd } = await esm('js/services/flowService.js');
    const seen = [];
    const off = bar.Events.on('tool:hold', e => seen.push(e));
    let cancelled = 0, failed = null;
    const err = new Error('x');
    const done = () => {};
    const cb = releaseHoldOnEnd({ onCancel: () => { cancelled++; }, onError: (e) => { failed = e; }, onComplete: done }, 'run-C');
    cb.onCancel();
    cb.onError(err);
    off();
    assert.strictEqual(cancelled, 1);
    assert.strictEqual(failed, err);
    assert.strictEqual(cb.onComplete, done, 'a completion is not an end of the hold: the next pass is');
    assert.deepStrictEqual(seen.map(e => [e.active, e.run]), [[false, 'run-C'], [false, 'run-C']]);
});

test('wiring: only a pass with a next pass holds, and only on the success path', () => {
    const flow = fs.readFileSync(path.join(ROOT, 'js/services/flowService.js'), 'utf8');
    assert.match(flow, /if \(runNextPass\) config\.flowContinues = /, 'the LAST pass must not hold: nothing would end it');
    assert.match(flow, /callbacks = releaseHoldOnEnd\(callbacks, tempId\);/, 'every leg and pass must release on cancel/error');

    const gen = fs.readFileSync(path.join(ROOT, 'js/services/generationService.js'), 'utf8');
    const hold = gen.indexOf("Events.emit('tool:hold', { tool: 'groupHistory', active: true");
    assert.ok(hold > 0, 'generationService no longer holds the bar for a continuing pass');
    // The early-return branches (mask track, text, empty output, cache hit) end the run through
    // onCancel/onText: a hold set before them would sit after the run is over.
    assert.ok(hold > gen.indexOf('exec.cacheHit === true && !config.replaceItemId'),
        'the hold must come after the branches that end the run');
    assert.ok(/flowContinues\) Events\.emit\('tool:hold', \{ tool: 'groupHistory', active: false/.test(gen),
        'a pass whose result could not save must let go of the hold');
});
