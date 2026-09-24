'use strict';

// MPI-901 — a remote prompt that FAILS or is INTERRUPTED never settled from /history.
//
// ComfyUI writes `status: { status_str: 'error', completed: false }` to /history for
// BOTH an execution error and an interrupt. `_reconcileFromHistory` returned on
// `!status.completed` BEFORE its error branch, so that branch was unreachable: a
// failed remote gen whose terminal WS event was lost was re-polled every 5s forever
// and its store job never settled (lane busy until Stop). And `execution_interrupted`
// was handled nowhere, so a Stopped prompt's listener/resolver/poll leaked.
//
// comfyController.js does not import into bare Node (browser paths in its graph), so
// the reconcile test runs the REAL method body, lifted out of the source, against a
// stub `this`. The listener half is pinned at the source.

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const CONTROLLER = read('js/services/comfyController.js');
const EXEC = read('js/services/commandExecutor.js');

/** Body of `async _reconcileFromHistory(...) { ... }`, by brace matching. */
function reconcileBody() {
    const head = 'async _reconcileFromHistory(promptId, source = \'reconnect\') {';
    const start = CONTROLLER.indexOf(head);
    assert.ok(start > 0, '_reconcileFromHistory signature changed — update this test');
    let depth = 0;
    for (let i = start + head.length - 1; i < CONTROLLER.length; i++) {
        if (CONTROLLER[i] === '{') depth++;
        else if (CONTROLLER[i] === '}' && --depth === 0) return CONTROLLER.slice(start + head.length, i);
    }
    throw new Error('unbalanced braces');
}

const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
const reconcile = new AsyncFunction(
    'fetch', 'clientLogger', 'Events', '_collectComfyOutputUrls', 'promptId', 'source',
    reconcileBody(),
);

/** Run the real reconcile against a stub controller holding one live prompt. */
async function runReconcile(historyEntry) {
    const pid = 'p1';
    const seen = { listener: [], rejected: null, resolved: null, pollStopped: false };
    const ctx = {
        _promptListeners: new Map([[pid, (msg) => seen.listener.push(msg)]]),
        _promptResolvers: new Map([[pid, (v) => { seen.resolved = v; }]]),
        _promptRejectors: new Map([[pid, (e) => { seen.rejected = e; }]]),
        _activePromptId: pid,
        _isRunning: true,
        httpBase: () => '/proxy',
        _stopHistoryPoll: () => { seen.pollStopped = true; },
    };
    const fetch = async () => ({ ok: true, json: async () => ({ [pid]: historyEntry }) });
    const noop = { info() {}, warn() {}, error() {} };
    await reconcile.call(ctx, fetch, noop, { emit() {} }, () => {}, pid, 'poll');
    return { ctx, seen };
}

test('a FAILED remote prompt settles from /history (completed:false is not "still running")', async () => {
    const { seen } = await runReconcile({
        status: {
            status_str: 'error',
            completed: false,
            messages: [
                ['execution_start', { prompt_id: 'p1' }],
                ['execution_error', { prompt_id: 'p1', node_type: 'KSampler', exception_type: 'RuntimeError', exception_message: 'boom' }],
            ],
        },
        outputs: {},
    });
    const settled = seen.rejected
        || seen.listener.find((m) => m.type === 'execution_error');
    assert.ok(settled, 'error entry was treated as still running — the gen polls forever');
});

test('an INTERRUPTED remote prompt settles through its listener, not as a failure', async () => {
    const { seen } = await runReconcile({
        status: {
            status_str: 'error',
            completed: false,
            messages: [
                ['execution_start', { prompt_id: 'p1' }],
                ['execution_interrupted', { prompt_id: 'p1', node_id: '3' }],
            ],
        },
        outputs: {},
    });
    // A Stop is not a fault: rejecting would reach commandExecutor's generic
    // catch and open the bug-report dialog.
    assert.equal(seen.rejected, null, 'an interrupt must not reject');
    assert.ok(
        seen.listener.some((m) => m.type === 'execution_interrupted'),
        'interrupted entry was not replayed to the prompt listener',
    );
});

test('a still-running prompt (no history entry yet) is left alone', async () => {
    const { seen } = await runReconcile(undefined);
    assert.equal(seen.rejected, null);
    assert.equal(seen.resolved, null);
    assert.equal(seen.listener.length, 0);
});

test('runWorkflow treats execution_interrupted as a terminal (tears the prompt down)', () => {
    const at = CONTROLLER.indexOf('const isTerminalDone =');
    assert.ok(at > 0, 'isTerminalDone predicate moved — update this test');
    const predicate = CONTROLLER.slice(at, CONTROLLER.indexOf(';', at));
    assert.match(predicate, /execution_interrupted/);
});

test('commandExecutor finishes the generation on execution_interrupted', () => {
    // Without this the store job of an interrupt nobody Stopped here never
    // settles, and the lane stays busy.
    assert.match(
        EXEC,
        /msg\.type === 'execution_interrupted'[\s\S]{0,120}_finishGeneration\(\)/,
    );
});
