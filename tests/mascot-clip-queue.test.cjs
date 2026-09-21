'use strict';

/**
 * mascotClipQueue — one mascot slot's clip queue (MPI-777 Phase 2).
 *
 * The queue exists so five landing characters, the agent ledge and every spot in
 * `docs/mascot-placement.md` share ONE set of swap rules instead of re-deriving them.
 * These tests pin the four rules the plan names, because each one is silent when it
 * breaks: a random pool that repeats back to back reads as a stuck mascot, a
 * play-once clip that never hands back reads as a frozen one, a request that takes
 * effect mid-clip JUMPS (every clip opens and closes on the same rest frame, so only
 * the end is jump-free), and an interrupt that waits defeats its own reason to exist.
 *
 * Timers are mocked: the whole module is about WHEN it swaps. It is driven by a
 * DURATION CLOCK and never by a media `ended` event — a GIF in an `<img>` cannot
 * report that it ended, so these tests advance time rather than firing events.
 */

const assert = require('node:assert/strict');
const test = require('node:test');

const IDLE = [{ id: 'idle-a', ms: 5000 }, { id: 'idle-b', ms: 5000 }, { id: 'idle-c', ms: 5000 }];
const GREET = [{ id: 'greet-1', ms: 3000 }];
const TRANSITIONS = [{ id: 'puff-1', ms: 1000, swapAtMs: 400 }];

/** Build a queue with recording hooks. Overrides merge over a sane default slot. */
async function makeQueue(opts = {}) {
    const { createMascotClipQueue } = await import('../js/utils/mascotClipQueue.js');
    const painted = [];
    const overlay = [];
    const preloaded = [];
    const queue = createMascotClipQueue({
        states: {
            idle: { clips: IDLE, pick: 'random', loop: true },
            greet: { clips: GREET, loop: false },
        },
        transitions: TRANSITIONS,
        paint: (id) => painted.push(id),
        paintTransition: (id) => overlay.push(id),
        preload: (id) => preloaded.push(id),
        ...opts,
    });
    return { queue, painted, overlay, preloaded };
}

test('a random pool never repeats back to back', async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const { painted } = await makeQueue();
    // 300 clip-ends through a 3-clip looping pool. The rule is an invariant, so a
    // real Math.random is the honest driver here: if it can repeat, this finds it.
    for (let i = 0; i < 300; i++) t.mock.timers.tick(5000);
    assert.ok(painted.length > 300, `expected a clip per tick, got ${painted.length}`);
    const repeat = painted.findIndex((id, i) => i > 0 && id === painted[i - 1]);
    assert.equal(repeat, -1,
        `clip ${painted[repeat]} repeated back to back at index ${repeat}`);
    assert.ok(new Set(painted).size === 3, 'all three idle clips should get used');
});

test('a play-once clip hands back to the rest pool; a looping one draws again', async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const { queue, painted } = await makeQueue();
    assert.match(queue.current().clip, /^idle-/, 'a slot rests as soon as it is built');

    queue.request('greet');
    t.mock.timers.tick(5000);                     // the idle ends, greet takes effect
    assert.equal(queue.current().state, 'greet');
    assert.equal(painted.at(-1), 'greet-1');

    t.mock.timers.tick(3000);                     // greet is loop:false -> back to rest
    assert.equal(queue.current().state, 'idle');
    assert.match(painted.at(-1), /^idle-/);

    t.mock.timers.tick(5000);                     // idle loops on itself, does not fall through
    assert.equal(queue.current().state, 'idle');
});

test('a waiting request starts only at the end of the current clip', async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const { queue, painted } = await makeQueue();
    const first = queue.current().clip;

    queue.request('greet');
    // Mid-clip is exactly where a swap would JUMP, so nothing may move yet.
    t.mock.timers.tick(4999);
    assert.equal(queue.current().clip, first, 'swapped mid-clip -- that is the jump');
    assert.equal(queue.current().pending, 'greet');
    assert.equal(painted.length, 1);

    t.mock.timers.tick(1);
    assert.equal(painted.at(-1), 'greet-1', 'the swap belongs on the clip boundary');
    assert.equal(queue.current().pending, null);
});

test('an interrupt starts the transition at once and swaps at its swap time', async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const { queue, painted, overlay } = await makeQueue();
    const first = queue.current().clip;

    queue.request('greet', { interrupt: true });
    assert.deepEqual(overlay, ['puff-1'], 'the overlay plays immediately, not on the boundary');
    assert.equal(queue.current().clip, first, 'the mascot has not swapped yet -- the puff covers it');

    t.mock.timers.tick(399);
    assert.equal(queue.current().clip, first);
    t.mock.timers.tick(1);                        // swapAtMs: the densest moment
    assert.equal(painted.at(-1), 'greet-1');
    assert.equal(overlay.at(-1), 'puff-1', 'the overlay is still up while the swap happens under it');

    t.mock.timers.tick(600);                      // the transition's own end
    assert.equal(overlay.at(-1), null, 'the overlay clears onto a clip already playing');

    // The interrupted idle's end timer must be DEAD, or it fires later and yanks the
    // mascot back mid-greet.
    t.mock.timers.tick(5000);
    assert.equal(queue.current().state, 'idle', 'greet is play-once, so it rests after 3s');
    assert.equal(painted.filter(id => id === 'greet-1').length, 1, 'greet played once, not twice');
});

test('reduced motion shows a still and schedules nothing', async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const { queue, painted, overlay } = await makeQueue({ reducedMotion: true });
    assert.equal(painted.length, 1, 'one frame, painted at construction');

    queue.request('greet', { interrupt: true });
    assert.equal(painted.at(-1), 'greet-1', 'the state still changes -- it just does not animate');
    assert.deepEqual(overlay, [], 'no transition overlay under reduced motion');

    t.mock.timers.tick(60_000);
    assert.equal(painted.length, 2, 'nothing is on a clock');
});

test('every clip and transition is preloaded, so the first swap is never blank', async () => {
    // No mocked timers here, so this slot arms a REAL one. A live slot re-arms itself
    // for ever, which holds the event loop open and hangs the whole run rather than
    // failing it — the same reason every owning component must call destroy().
    const { queue, preloaded } = await makeQueue();
    try {
        assert.deepEqual(preloaded.sort(),
            ['greet-1', 'idle-a', 'idle-b', 'idle-c', 'puff-1'].sort());
    } finally {
        queue.destroy();
    }
});

/**
 * Counts what the module arms and clears. NOT `mock.timers`: the queue also refuses to
 * act once destroyed, so a "nothing painted afterwards" assertion passes even when
 * destroy clears nothing — and an uncleared chain re-arms itself for ever and holds
 * the event loop open. That is a hang, not a failure, so it has to be caught here.
 */
function countTimers() {
    const armed = new Set();
    const cleared = new Set();
    const realSet = globalThis.setTimeout;
    const realClear = globalThis.clearTimeout;
    let next = 1;
    globalThis.setTimeout = () => { const id = next++; armed.add(id); return id; };
    globalThis.clearTimeout = (id) => { cleared.add(id); };
    return {
        armed, cleared,
        outstanding: () => [...armed].filter(id => !cleared.has(id)),
        restore: () => { globalThis.setTimeout = realSet; globalThis.clearTimeout = realClear; },
    };
}

test('destroy clears every timer it armed, including those inside a transition', async () => {
    const timers = countTimers();
    try {
        const { queue } = await makeQueue();
        queue.request('greet', { interrupt: true });   // arms the swap AND the overlay clear
        assert.ok(timers.armed.size >= 3,
            `expected a clip timer plus the transition pair, armed ${timers.armed.size}`);
        assert.ok(timers.outstanding().length > 0, 'nothing was live to begin with');

        queue.destroy();
        assert.deepEqual(timers.outstanding(), [],
            'a destroyed slot left a timer armed -- it re-arms for ever and hangs the process');
    } finally {
        timers.restore();
    }
});

test('a destroyed slot ignores further requests', async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const { queue, painted } = await makeQueue();
    queue.destroy();
    const before = painted.length;
    queue.request('greet');
    t.mock.timers.tick(60_000);
    assert.equal(painted.length, before, 'a destroyed slot still painted');
});
