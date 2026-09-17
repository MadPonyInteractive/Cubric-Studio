'use strict';

/**
 * MPI-792 — the install screen must keep moving. `elapsedTicker` is the part of it that
 * runs without a DOM: a clock that always ticks, and hints that appear only after a
 * quiet stretch and rotate while it lasts. A `touch()` (any install event) clears them.
 */

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

let formatClock;
let startElapsedTicker;

test.before(async () => {
    const url = pathToFileURL(path.join(__dirname, '..', 'js', 'utils', 'elapsedTicker.js'));
    ({ formatClock, startElapsedTicker } = await import(url.href));
});

test('formatClock: m:ss under an hour, h:mm:ss over it, never negative', () => {
    assert.strictEqual(formatClock(0), '0:00');
    assert.strictEqual(formatClock(75_000), '1:15');
    assert.strictEqual(formatClock(59_999), '0:59');
    assert.strictEqual(formatClock(3_725_000), '1:02:05');
    assert.strictEqual(formatClock(-5), '0:00');
});

test('ticker: paints at once, every second, hints only after the quiet window, rotating', (t) => {
    t.mock.timers.enable({ apis: ['setInterval', 'Date'], now: 0 });
    const ticks = [];
    const ticker = startElapsedTicker((elapsed, hint) => ticks.push([elapsed, hint]),
        { hints: ['A', 'B'], quietAfterMs: 15_000, rotateMs: 8_000 });

    assert.deepStrictEqual(ticks.at(-1), ['0:00', null], 'first paint is immediate');

    t.mock.timers.tick(14_000);
    assert.deepStrictEqual(ticks.at(-1), ['0:14', null], 'no hint inside the quiet window');
    assert.strictEqual(ticks.length, 15, 'one paint per second');

    t.mock.timers.tick(1_000);
    assert.deepStrictEqual(ticks.at(-1), ['0:15', 'A'], 'first hint at exactly the window');

    t.mock.timers.tick(8_000);
    assert.deepStrictEqual(ticks.at(-1), ['0:23', 'B'], 'rotates after rotateMs');

    t.mock.timers.tick(8_000);
    assert.deepStrictEqual(ticks.at(-1), ['0:31', 'A'], 'wraps around');

    ticker.touch();
    t.mock.timers.tick(1_000);
    assert.deepStrictEqual(ticks.at(-1), ['0:32', null], 'activity clears the hint, the clock keeps counting');

    ticker.stop();
    const n = ticks.length;
    t.mock.timers.tick(5_000);
    assert.strictEqual(ticks.length, n, 'stop() ends the painting');
});

test('ticker: no hints configured means never a hint', (t) => {
    t.mock.timers.enable({ apis: ['setInterval', 'Date'], now: 0 });
    let last;
    const ticker = startElapsedTicker((elapsed, hint) => { last = hint; });
    t.mock.timers.tick(120_000);
    assert.strictEqual(last, null);
    ticker.stop();
});
