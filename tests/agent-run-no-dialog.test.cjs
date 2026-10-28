'use strict';

/**
 * agent-run-no-dialog.test.cjs — MPI-1286.
 *
 * A failed generation the agent ran opens no "Generation failed" dialog. The agent is told the
 * error, may resend once (services/agentLoop.mjs REPEATED_FAILURE) and says it in the chat; a
 * blocking dialog over an attempt Cosmo was already retrying read as a crash (Fabio,
 * 2026-10-28). A person's run still gets the dialog. The queue row ends failed either way.
 */

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const { runCloudCommand, sendWindow } = require('../js/services/cloudExecutor.js');
const { generationStore, PHASES } = require('../js/services/generationStore.js');
const { Events } = require('../js/events.js');

sendWindow.ms = 0;

test('a cloud failure opens the dialog for a person and nothing for an agent', async () => {
    const realFetch = global.fetch;
    global.fetch = async () => ({ ok: true, status: 200, json: async () => ({ ok: false, error: { code: 'NO_KEY' } }) });
    try {
        for (const byAgent of [false, true]) {
            const seen = [];
            const offs = ['ui:warning', 'ui:error'].map(ev => Events.on(ev, (p) => seen.push(ev)));
            try {
                const exec = runCloudCommand({ genId: 'gen-1', modelId: 'flux-schnell-cloud', operation: 't2i', positive: 'a cube', byAgent });
                const err = await new Promise((resolve) => { exec.onError = resolve; exec.onComplete = () => resolve(null); });
                assert.equal(err?.code, 'NO_KEY');
                assert.equal(generationStore.byId(exec.jobId).phase, PHASES.ERROR);
                assert.deepEqual(seen, byAgent ? [] : ['ui:error']);
            } finally {
                offs.forEach(off => off());
            }
        }
    } finally {
        global.fetch = realFetch;
    }
});

// runCommand needs a live engine to reach its catches, so these two read the source, the way
// stop-after-engine-fault.test.cjs holds the same catches.
const SRC = fs.readFileSync(path.join(__dirname, '../js/services/commandExecutor.js'), 'utf8');

/** The few lines before the `ui:error` that follows `anchor`. */
function guardBefore(anchor) {
    const at = SRC.indexOf(anchor);
    assert.ok(at > 0, `anchor not found: ${anchor}`);
    const e = SRC.indexOf("Events.emit('ui:error', { title, message })", at);
    assert.ok(e > at, `no generic ui:error after: ${anchor}`);
    return SRC.slice(Math.max(at, e - 200), e);
}

test("runCommand's engine-failure dialog is skipped for an agent's run", () => {
    assert.match(guardBefore("`Workflow failed: ${workingPayload.operation}"), /if \(!payload\.byAgent\)/);
});

test("runCommand's pre-dispatch bail dialog is skipped for an agent's run", () => {
    assert.match(guardBefore('Generation bailed before dispatch'), /if \(!reported && !payload\.byAgent\)/);
});
