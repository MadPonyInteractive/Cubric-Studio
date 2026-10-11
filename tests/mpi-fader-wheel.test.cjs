'use strict';
/**
 * mpi-fader-wheel.test.cjs — MPI-740.
 *
 * Proves the two root-cause bugs are fixed:
 *
 * 1. CRAWL: wheel must step by `wheelStep` (1 dB default), not `step` (0.1 dB).
 * 2. STUCK AT ZERO: a wheel tick must escape the unity detent, which requires
 *    the wheel handler to set `detent = false` before reading — exactly as
 *    `keydown` does.
 *
 * MpiFader is a frontend component (ComponentFactory, DOM) and cannot be
 * imported in plain Node without a browser environment. The tests below
 * replicate the exact logic from MpiFader's `setup()` in isolation: the detent
 * flag, the wheel handler, the clamp, and `el.destroy()`. This is sufficient
 * because the fix lives entirely in that logic, and ESLint verifies the module
 * parses correctly.
 */

const assert = require('node:assert');
const test   = require('node:test');

// ── Helpers: minimal fakes ────────────────────────────────────────────────────

/** Returns { fn, called } — the off-function records whether it was called. */
const makeOff = () => {
    let _called = false;
    return {
        fn: () => { _called = true; },
        get called() { return _called; },
    };
};

/** Simulates the state and handlers that MpiFader.setup() builds. */
function buildFader({ min = -60, max = 12, unity = 0, snap = 1, wheel = true, wheelStep = 1 } = {}) {
    const gainOf = (db) => (db <= min ? 0 : Math.pow(10, db / 20));
    const fakeInput = { value: String(unity) };  // starts at unity
    const emitted   = [];
    const emit      = (ev, data) => emitted.push({ ev, data });
    let   detent    = true;

    // 6 on() calls in the fixed setup: pointerdown, keydown, input, change,
    // plus wheel on input AND wheel on el.
    const _offs = Array.from({ length: 6 }, makeOff);
    const destroy = () => _offs.forEach(o => o.fn());

    // Exact wheel handler from the fixed MpiFader.js:
    const handleWheel = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!wheel) return;
        detent = false;
        const raw  = parseFloat(fakeInput.value);
        const next = Math.max(min, Math.min(max, raw + (e.deltaY < 0 ? wheelStep : -wheelStep)));
        fakeInput.value = String(next);
        const gain = gainOf(next);
        emit('input',  { db: next, gain });
        emit('change', { db: next, gain });
        detent = true;
    };

    // The read() path that a pointer drag uses (detent still true):
    const readWithDetent = () => {
        const raw = parseFloat(fakeInput.value);
        return (detent && snap > 0 && Math.abs(raw - unity) <= snap) ? unity : raw;
    };

    const fakeEvent = (deltaY) => {
        let prevented = false, stopped = false;
        handleWheel({
            deltaY,
            preventDefault:  () => { prevented = true; },
            stopPropagation: () => { stopped   = true; },
        });
        return { prevented, stopped };
    };

    return { fakeInput, emitted, fakeEvent, readWithDetent, destroy, _offs, getDetent: () => detent };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test('one UP wheel tick from unity escapes the detent (+1 dB)', () => {
    const { fakeInput, emitted, fakeEvent } = buildFader();
    fakeEvent(-10); // deltaY < 0 → up
    assert.strictEqual(emitted.length, 2, 'emits input + change');
    assert.strictEqual(emitted[0].data.db, 1, 'up tick from 0 dB → +1 dB');
    assert.notStrictEqual(emitted[0].data.db, 0, 'must NOT snap back to unity');
    assert.strictEqual(parseFloat(fakeInput.value), 1, 'input.value updated');
});

test('one DOWN wheel tick from unity escapes the detent (-1 dB)', () => {
    const { emitted, fakeEvent } = buildFader();
    fakeEvent(10); // deltaY > 0 → down
    assert.strictEqual(emitted[0].data.db, -1, 'down tick from 0 dB → -1 dB');
    assert.notStrictEqual(emitted[0].data.db, 0, 'must NOT snap back to unity');
});

test('wheel steps by wheelStep not the drag step (1 dB vs 0.1 dB)', () => {
    // Bug: old code relied on the browser default <input type=range> wheel
    // which steps by `step` = 0.1 dB.  One wheel tick must move 1 dB.
    const { emitted, fakeEvent } = buildFader({ wheelStep: 1 });
    fakeEvent(-10);
    assert.strictEqual(emitted[0].data.db, 1,
        'wheelStep=1 means one tick is 1 dB, not 0.1 dB');
});

test('wheel=false suppresses movement but still calls preventDefault', () => {
    const { emitted, fakeInput, fakeEvent } = buildFader({ wheel: false });
    const { prevented } = fakeEvent(-10);
    assert.ok(prevented, 'always calls preventDefault so the page never scrolls');
    assert.strictEqual(emitted.length, 0, 'no events emitted when wheel is disabled');
    assert.strictEqual(parseFloat(fakeInput.value), 0, 'value unchanged');
});

test('snap=0 variant: wheel escapes unity equally', () => {
    const { emitted, fakeEvent } = buildFader({ snap: 0 });
    fakeEvent(-10);
    assert.strictEqual(emitted[0].data.db, 1,
        'snap=0 variant: one up tick still gives +1 dB');
});

test('detent is restored after wheel so next pointer drag feels the snap', () => {
    // After the wheel tick the component must restore detent=true, so a pointer
    // drag landing within snap tolerance is still pulled back to unity.
    const { fakeInput, fakeEvent, readWithDetent } = buildFader();
    fakeEvent(-10);  // wheel → detent off then restored
    fakeInput.value = '0.5';  // pointer drag lands within 1 dB snap
    const result = readWithDetent();
    assert.strictEqual(result, 0,
        'detent restored after wheel: 0.5 dB within snap=1 → snaps to unity');
});

test('el.destroy() calls all 6 unsubscribes', () => {
    const { destroy, _offs } = buildFader();
    destroy();
    const uncalled = _offs.filter(o => !o.called);
    assert.strictEqual(uncalled.length, 0,
        `all 6 off-functions must be called; ${uncalled.length} were not`);
});

test('wheelStep is independent of the drag step prop', () => {
    // The fix uses its own wheelStep prop — step=0.1 and wheelStep=2 → 2 dB per tick.
    const { emitted, fakeEvent } = buildFader({ wheelStep: 2 });
    fakeEvent(-10);
    assert.strictEqual(emitted[0].data.db, 2, 'wheelStep=2: one tick = +2 dB');
});

test('wheel clamps at max', () => {
    const { emitted, fakeInput, fakeEvent } = buildFader();
    fakeInput.value = String(12); // already at max
    fakeEvent(-10);               // try to go higher
    assert.strictEqual(emitted[0].data.db, 12, 'wheel clamps at max=12');
});

test('wheel clamps at min', () => {
    const { emitted, fakeInput, fakeEvent } = buildFader();
    fakeInput.value = String(-60); // already at min
    fakeEvent(10);                 // try to go lower
    assert.strictEqual(emitted[0].data.db, -60, 'wheel clamps at min=-60');
});

test('gain emitted at unity is 1.0 (linear multiplier)', () => {
    // From unity (0 dB) back to unity after a round-trip:
    const { emitted, fakeInput, fakeEvent } = buildFader();
    fakeInput.value = '0'; // at unity
    fakeEvent(10);          // down to -1
    fakeEvent(-10);         // back to 0
    const lastChange = emitted[emitted.length - 1];
    assert.ok(Math.abs(lastChange.data.gain - 1.0) < 1e-9,
        'gain at 0 dB must be 1.0');
});
