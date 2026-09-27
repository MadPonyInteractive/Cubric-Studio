'use strict';

// MPI-516 — a prompt that disappears mid-flight (engine restart, queue wipe, Pod OOM-kill
// of the worker) must be detected and rejected, not polled forever.
//
// When a prompt is absent from /history, _reconcileFromHistory returns early ("not in history
// yet → still running"). That is correct for a RUNNING gen, but wrong for a GONE one.
// ComfyUI holds every accepted prompt in EITHER the queue (running/pending) OR /history
// (completed). A prompt absent from BOTH, while the engine is answering, is gone.
//
// The detector is _checkVanishedPrompt, called from _startHistoryPoll on every tick after
// the _ORPHAN_GRACE_MS window. It reads the queue first, then re-reads /history (the MPI-450
// guard: a prompt that completes between the two reads is absent from BOTH for that instant;
// a failed re-read collapses "could not read" into "absent" — both would be wrong verdicts).
//
// The same poll now runs on LOCAL engines too (MPI-516 removes the remote-only guard from
// _startHistoryPoll), so the detection applies to both engines.
//
// comfyController.js does not import into bare Node (browser-absolute paths in its graph),
// so the method body is lifted from the source and compiled as an AsyncFunction against a
// stub `this`, the same pattern remote-history-settle.test.cjs uses.

const assert = require('node:assert/strict');
const test   = require('node:test');
const fs     = require('node:fs');
const path   = require('node:path');

const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const CONTROLLER = read('js/services/comfyController.js');

// ---------------------------------------------------------------------------
// Extract _checkVanishedPrompt body by brace-matching
// ---------------------------------------------------------------------------
function vanishedBody() {
    const head = 'async _checkVanishedPrompt(promptId) {';
    const start = CONTROLLER.indexOf(head);
    assert.ok(start > 0, '_checkVanishedPrompt not found — did the method name or signature change?');
    let depth = 0;
    for (let i = start + head.length - 1; i < CONTROLLER.length; i++) {
        if (CONTROLLER[i] === '{') depth++;
        else if (CONTROLLER[i] === '}' && --depth === 0) {
            return CONTROLLER.slice(start + head.length, i);
        }
    }
    throw new Error('unbalanced braces in _checkVanishedPrompt');
}

const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
const checkVanished = new AsyncFunction('fetch', 'clientLogger', 'promptId', vanishedBody());

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------
const PROMPT = 'test-prompt-abc';
const PAST_GRACE = 60_000; // ms elapsed — well past the 30s grace period

/** Build a stub `this` (ctx) representing an engine with one live in-flight prompt. */
function makeCtx(elapsedMs = PAST_GRACE) {
    const seen = { rejected: null, pollStopped: false, deletedFromStartTimes: false };
    const ctx = {
        _promptListeners:    new Map([[PROMPT, () => {}]]),
        _promptResolvers:    new Map([[PROMPT, () => {}]]),
        _promptRejectors:    new Map([[PROMPT, (e) => { seen.rejected = e; }]]),
        _promptStartTimes:   new Map([[PROMPT, Date.now() - elapsedMs]]),
        _promptListenersDel: [],
        _activePromptId:     PROMPT,
        _isRunning:          true,
        _ORPHAN_GRACE_MS:    30_000,
        httpBase:            () => '/proxy',
        _stopHistoryPoll(id) { seen.pollStopped = true; ctx._promptListeners.delete(id); },
    };
    // Track _promptStartTimes.delete so we can assert cleanup
    const origDelete = ctx._promptStartTimes.delete.bind(ctx._promptStartTimes);
    ctx._promptStartTimes.delete = (id) => {
        seen.deletedFromStartTimes = true;
        return origDelete(id);
    };
    return { ctx, seen };
}

/** Stub globalThis.fetch for a set of URL-fragment → response mappings. */
function stubFetch(routes) {
    return async (url) => {
        const hit = Object.entries(routes).find(([frag]) => String(url).includes(frag));
        const spec = hit ? hit[1] : null;
        if (!spec) return { ok: false, status: 404, json: async () => ({}) };
        if (typeof spec === 'object' && 'status' in spec && typeof spec.status === 'number' && !spec.json) {
            return { ok: false, status: spec.status };
        }
        return { ok: true, status: 200, json: async () => spec };
    };
}

const noop = { info() {}, warn() {}, error() {} };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('vanished prompt is rejected when absent from history AND queue, engine answering', async () => {
    const { ctx, seen } = makeCtx();
    const fetch = stubFetch({
        '/queue':         { queue_running: [], queue_pending: [] },
        '/history/':      {},  // engine answered — prompt not there
    });
    await checkVanished.call(ctx, fetch, noop, PROMPT);
    assert.ok(seen.rejected instanceof Error,
        'a vanished prompt must be rejected');
    assert.match(seen.rejected.message, /disappeared/,
        'error message must describe the loss');
    assert.equal(seen.rejected.code, 'prompt_vanished',
        'error must carry the prompt_vanished code so commandExecutor can surface it appropriately');
    assert.ok(seen.pollStopped, 'poll must be stopped on vanish detection');
    assert.ok(seen.deletedFromStartTimes, '_promptStartTimes must be cleaned up');
});

// MPI-450 guard: a prompt that completes between the queue read and the history re-read
// is transiently absent from BOTH. Without the re-read guard, that would be declared
// "vanished" — a false positive that would fail a passing generation.
test('finished-between-reads is NOT declared vanished (MPI-450 false-positive guard)', async () => {
    const { ctx, seen } = makeCtx();
    const fetch = stubFetch({
        '/queue':    { queue_running: [], queue_pending: [] },    // absent from queue
        '/history/': { [PROMPT]: { status: { completed: true, status_str: 'success' }, outputs: {} } }, // appeared in history on re-read
    });
    await checkVanished.call(ctx, fetch, noop, PROMPT);
    assert.equal(seen.rejected, null,
        'a prompt that appears in history on re-read must NOT be declared vanished — the false-positive guard failed');
});

test('engine not answering (queue read fails) → no verdict, keeps waiting', async () => {
    const { ctx, seen } = makeCtx();
    const fetch = stubFetch({
        '/queue': { status: 502 },   // relay error
    });
    await checkVanished.call(ctx, fetch, noop, PROMPT);
    assert.equal(seen.rejected, null,
        'a failed queue read is not evidence the prompt left — must not reject');
});

test('engine not answering (history re-read fails) → no verdict, keeps waiting', async () => {
    const { ctx, seen } = makeCtx();
    const fetch = stubFetch({
        '/queue':    { queue_running: [], queue_pending: [] },
        '/history/': { status: 502 },   // relay error on re-read
    });
    await checkVanished.call(ctx, fetch, noop, PROMPT);
    assert.equal(seen.rejected, null,
        'a failed history re-read is "unknown", not "absent" — must not reject (MPI-450)');
});

test('prompt still in queue → keeps waiting (not a vanished prompt)', async () => {
    const { ctx, seen } = makeCtx();
    const fetch = stubFetch({
        '/queue': { queue_running: [[0, PROMPT]], queue_pending: [] },
    });
    await checkVanished.call(ctx, fetch, noop, PROMPT);
    assert.equal(seen.rejected, null,
        'a prompt in the queue is still running — must not be declared vanished');
});

test('prompt still pending in queue → keeps waiting', async () => {
    const { ctx, seen } = makeCtx();
    const fetch = stubFetch({
        '/queue': { queue_running: [], queue_pending: [[1, PROMPT]] },
    });
    await checkVanished.call(ctx, fetch, noop, PROMPT);
    assert.equal(seen.rejected, null, 'pending prompt must not be declared vanished');
});

test('within the grace window → no verdict whatever the reads say', async () => {
    // elapsedMs = 5_000 < _ORPHAN_GRACE_MS = 30_000
    const { ctx, seen } = makeCtx(5_000);
    const fetch = stubFetch({
        '/queue':    { queue_running: [], queue_pending: [] },
        '/history/': {},
    });
    await checkVanished.call(ctx, fetch, noop, PROMPT);
    assert.equal(seen.rejected, null,
        'the submit→queue propagation window must be respected — no verdict yet');
});

test('already settled by a live event between the awaits → no double-reject', async () => {
    const { ctx, seen } = makeCtx();
    // After queue read but before history re-read, a live terminal settles the promise.
    // Simulate this by clearing the resolver map inside the queue fetch call.
    let queueCallCount = 0;
    const fetch = async (url) => {
        if (String(url).includes('/queue')) {
            queueCallCount++;
            // Simulate live terminal settling the prompt while we awaited queue
            ctx._promptResolvers.clear();
            ctx._promptRejectors.clear();
            return { ok: true, json: async () => ({ queue_running: [], queue_pending: [] }) };
        }
        return { ok: true, json: async () => ({}) };
    };
    await checkVanished.call(ctx, fetch, noop, PROMPT);
    assert.equal(seen.rejected, null,
        'must not reject a prompt that was already settled by a live terminal event');
});

// ---------------------------------------------------------------------------
// Source-level structural assertions
// ---------------------------------------------------------------------------

test('_startHistoryPoll no longer has the remote-only guard', () => {
    const pollBody = (() => {
        const head = '_startHistoryPoll(promptId) {';
        const start = CONTROLLER.indexOf(head);
        assert.ok(start > 0, '_startHistoryPoll not found');
        let depth = 0;
        for (let i = start + head.length - 1; i < CONTROLLER.length; i++) {
            if (CONTROLLER[i] === '{') depth++;
            else if (CONTROLLER[i] === '}' && --depth === 0) return CONTROLLER.slice(start + head.length, i);
        }
        throw new Error('unbalanced braces');
    })();
    assert.ok(
        !pollBody.includes('_alwaysLocal || !remoteEngineClient.isRemote()'),
        '_startHistoryPoll still has the remote-only guard — vanished-prompt detection would not run on local',
    );
});

test('_startHistoryPoll calls _checkVanishedPrompt on each tick', () => {
    assert.ok(
        CONTROLLER.includes('_checkVanishedPrompt(promptId)'),
        '_checkVanishedPrompt call not found in controller — vanished detection is not wired to the poll',
    );
});

test('_promptStartTimes is declared on the engine object', () => {
    assert.ok(
        CONTROLLER.includes('_promptStartTimes: new Map()'),
        '_promptStartTimes map missing — vanished-prompt grace period cannot be tracked',
    );
});

test('_promptStartTimes is cleared in _onWsDropped', () => {
    const dropBody = (() => {
        const head = '_onWsDropped() {';
        const start = CONTROLLER.indexOf(head);
        assert.ok(start > 0, '_onWsDropped not found');
        let depth = 0;
        for (let i = start + head.length - 1; i < CONTROLLER.length; i++) {
            if (CONTROLLER[i] === '{') depth++;
            else if (CONTROLLER[i] === '}' && --depth === 0) return CONTROLLER.slice(start + head.length, i);
        }
        throw new Error('unbalanced braces');
    })();
    assert.ok(
        dropBody.includes('_promptStartTimes.clear()'),
        '_promptStartTimes not cleared in _onWsDropped — start times leak on WS drop',
    );
});

test('commandExecutor turns prompt_vanished into a warning toast, not the bug-report dialog', () => {
    const EXEC = read('js/services/commandExecutor.js');
    const branch = EXEC.indexOf("err?.code === 'prompt_vanished'");
    // The catch block's generic fallback, anchored on its own log line (ui:error is emitted elsewhere too).
    const generic = EXEC.indexOf("clientLogger.error('comfy', `Workflow failed: ");
    // Guard the -1 first: a missing branch would otherwise pass the ordering check.
    assert.ok(branch > 0, 'prompt_vanished is unhandled - it falls through to the bug-report dialog');
    assert.ok(generic > 0, 'generic Workflow failed fallback not found - update this test');
    assert.ok(branch < generic, 'prompt_vanished must be classified before the generic ui:error');
    assert.match(EXEC.slice(branch, branch + 400), /ui:warning/);
});
