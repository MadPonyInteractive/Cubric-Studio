'use strict';

// MPI-805: pressing Restart engine while a generation runs SCHEDULES the restart and says
// so immediately, instead of sitting silent for thirty seconds and then refusing.
//
// The bug Fabio hit live (2026-09-18): `waitForIdleQueue` polls until its `timeoutMs`
// elapses before it can answer "still busy", and both human-facing callers passed 30000.
// So the button did nothing visible for half a minute, he pressed it again, and two
// refusal toasts arrived together.
//
// `waitForIdleQueue` is exercised for real here — it is a plain method on a shared object
// and the only thing it touches is `fetch` — because the single-probe behaviour of
// `timeoutMs: 0` is the load-bearing part and a source regex would not notice it
// regressing. The two call sites are pinned by source, in the style of
// engine-restart-delegation.test.cjs: they live in renderer modules that pull in the whole
// shell, and what matters about them is which arguments they pass.

const assert = require('assert');
const test = require('node:test');
const fs = require('fs');
const path = require('path');

const repo = path.join(__dirname, '..');
const navSrc = fs.readFileSync(path.join(repo, 'js', 'shell', 'navigation.js'), 'utf8');
const comfySrc = fs.readFileSync(path.join(repo, 'js', 'services', 'comfyController.js'), 'utf8');

/** The real `waitForIdleQueue`, lifted out of the module so it can run under node. */
function loadWaitForIdleQueue() {
    const start = comfySrc.indexOf('async waitForIdleQueue(');
    assert.ok(start > 0, 'waitForIdleQueue must still exist on comfyController');
    // Balance braces from the method body's opening brace to its close.
    const open = comfySrc.indexOf('{', comfySrc.indexOf(')', start));
    let depth = 0, end = open;
    for (; end < comfySrc.length; end++) {
        if (comfySrc[end] === '{') depth++;
        else if (comfySrc[end] === '}' && --depth === 0) break;
    }
    const body = comfySrc.slice(open + 1, end);
    const make = new Function('fetch', 'clientLogger',
        `return async function waitForIdleQueue({ timeoutMs = 300000, unreachableMeansIdle = false } = {}) {
             const this_ = { httpBase: () => 'http://engine' };
             return (async function () { ${body} }).call(this_);
         }`);
    return make;
}

const busy = { queue_running: [{ id: 1 }], queue_pending: [] };
const idle = { queue_running: [], queue_pending: [] };

function fetchReturning(...responses) {
    const calls = [];
    const fn = async (url) => {
        calls.push(url);
        const body = responses[Math.min(calls.length - 1, responses.length - 1)];
        if (body === null) throw new Error('unreachable');
        return { ok: true, json: async () => body };
    };
    fn.calls = calls;
    return fn;
}

test('timeoutMs: 0 answers after ONE probe and does not sleep', async () => {
    const fetchStub = fetchReturning(busy);
    const waitForIdleQueue = loadWaitForIdleQueue()(fetchStub, { warn() {} });

    const t0 = Date.now();
    const safe = await waitForIdleQueue({ timeoutMs: 0, unreachableMeansIdle: true });
    const elapsed = Date.now() - t0;

    assert.strictEqual(safe, false, 'a running queue is not safe to restart');
    assert.strictEqual(fetchStub.calls.length, 1, 'exactly one /queue read');
    assert.ok(elapsed < 1000,
        `must answer immediately, took ${elapsed}ms — this is the 30s dead button MPI-805 fixed`);
});

test('an idle queue is still safe to restart on the same single probe', async () => {
    const fetchStub = fetchReturning(idle);
    const waitForIdleQueue = loadWaitForIdleQueue()(fetchStub, { warn() {} });
    assert.strictEqual(await waitForIdleQueue({ timeoutMs: 0 }), true);
    assert.strictEqual(fetchStub.calls.length, 1);
});

test('a queue that drains later still reports safe, so an armed restart fires', async () => {
    // The armed wait passes Infinity; two busy reads then an idle one must resolve true
    // rather than run forever or give up.
    const fetchStub = fetchReturning(busy, busy, idle);
    const waitForIdleQueue = loadWaitForIdleQueue()(fetchStub, { warn() {} });
    assert.strictEqual(await waitForIdleQueue({ timeoutMs: Infinity, unreachableMeansIdle: true }), true);
    assert.strictEqual(fetchStub.calls.length, 3);
});

test('the restart button probes instantly and schedules instead of refusing', () => {
    const fn = navSrc.slice(navSrc.indexOf('async function _restartEngine'));
    const body = fn.slice(0, fn.indexOf('async function _performRestart'));

    assert.ok(!/timeoutMs:\s*30000/.test(body),
        'the 30s wait is the bug: the button must not sit silent before it speaks');
    assert.match(body, /waitForIdleQueue\(\{\s*timeoutMs:\s*0\s*,/,
        'the first probe must be the single-probe form');
    assert.match(body, /Restart scheduled for when your generations finish or are cancelled\./,
        'a busy queue schedules the restart and says so');
    assert.match(body, /timeoutMs:\s*Infinity/,
        'the armed wait must have no deadline, or the scheduled restart is dropped silently');
});

test('pressing Restart twice does not arm two waiters', () => {
    const fn = navSrc.slice(navSrc.indexOf('async function _restartEngine'));
    const body = fn.slice(0, fn.indexOf('async function _performRestart'));

    // Fabio pressed twice because nothing appeared to happen. The second press must
    // re-toast (the button still has to feel alive) but must not queue a second restart.
    const toastAt = body.indexOf('Restart scheduled for when');
    const guardAt = body.indexOf('if (alreadyArmed) return;');
    assert.ok(guardAt > toastAt,
        'the re-entry guard must come AFTER the toast, so a second press still says something');
    assert.match(body, /const alreadyArmed = _restartPending;/);
    assert.match(navSrc, /let _restartPending\s*=\s*false;/,
        'the armed flag must be module state, not per-call');
});

test('the deps repair also answers instantly, and still refuses rather than scheduling', () => {
    const fn = comfySrc.slice(comfySrc.indexOf('async repairPythonDeps('));
    const body = fn.slice(0, fn.indexOf('ensureServerRunning'));

    assert.ok(!/timeoutMs:\s*30000/.test(body),
        'the same 30s silence was here too — one primitive, both call sites');
    assert.match(body, /waitForIdleQueue\(\{\s*timeoutMs:\s*0\s*,/);
    assert.match(body, /Repair cancelled — a generation is still running/,
        'a deps repair wants a human present, so it refuses rather than scheduling');
});
