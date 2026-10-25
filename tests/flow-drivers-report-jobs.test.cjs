/**
 * flow-drivers-report-jobs.test.cjs — every driver Flow tells the Flow frame about each job it queues.
 *
 * A FlowDef with `driver` skips `submitFlowGeneration`, which is where the frame normally learns the
 * run's tempId. A driver that never calls `frame.onJob(tempId, done)` leaves the frame blind to its
 * jobs: no live latents, no sweep, Stop greyed out, and the result never lands in the pane. It
 * shipped twice that way (Storyboard, then Multi-angle, 2026-10-25), so the contract is pinned here
 * (docs/playbooks/add-flow/README.md § Driver Flows).
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const SHELL = path.join(__dirname, '..', 'js', 'shell');
const TABLE = fs.readFileSync(path.join(SHELL, 'storyboardDispatch.js'), 'utf8');

/** Driver id -> the function FLOW_DRIVERS names for it. */
function _drivers() {
    const body = TABLE.match(/export const FLOW_DRIVERS = \{([\s\S]*?)\};/);
    assert.ok(body, 'FLOW_DRIVERS table not found in storyboardDispatch.js');
    return [...body[1].matchAll(/(\w+):\s*(\w+)/g)].map(m => ({ id: m[1], fn: m[2] }));
}

/** The source file that defines `fn`: this one, or the one it is imported from. */
function _source(fn) {
    const imported = TABLE.match(new RegExp(`import \\{[^}]*\\b${fn}\\b[^}]*\\} from '\\./([\\w.]+)'`));
    return fs.readFileSync(path.join(SHELL, imported ? imported[1] : 'storyboardDispatch.js'), 'utf8');
}

test('every driver Flow takes the frame and reports each job it queues', () => {
    const drivers = _drivers();
    assert.ok(drivers.length >= 2, 'expected the storyboard and multiAngle drivers');
    for (const { id, fn } of drivers) {
        const src = _source(fn);
        const sig = src.match(new RegExp(`(?:export )?async function ${fn}\\(([^)]*)\\)`));
        assert.ok(sig, `${id}: ${fn} not found`);
        assert.strictEqual(sig[1].split(',').length, 3, `${id}: ${fn} must take (flow, inputs, frame)`);
        const queues = (src.match(/enqueueGeneration\(/g) || []).length;
        const reports = (src.match(/\.onJob\?\.\(/g) || []).length;
        assert.ok(queues > 0 && reports >= queues, `${id}: ${queues} enqueueGeneration call(s), ${reports} frame.onJob report(s)`);
    }
});

// One Stop press stops the whole run (MPI-1293). The frame matches a job by its queue id: a job
// landing in a card's history has no tempId (Multi-angle's pass 2 showed no latents and Stop missed
// it). Between two jobs nothing is queued, so the driver must ask `frame.stopped()` before each
// enqueue, and hand back its `finished` so the frame stays busy (and Stop live) until the last job.
test('every driver Flow reports queue ids, honours Stop before each enqueue, and returns its end', () => {
    for (const { id, fn } of _drivers()) {
        const src = _source(fn);
        assert.ok(!/\.onJob\?\.\(opts\.tempId/.test(src), `${id}: report the job's queueJobId, not its tempId`);
        const queues = (src.match(/enqueueGeneration\(/g) || []).length;
        const checks = (src.match(/frame\?\.stopped\?\.\(\)\) return \{ ok: false, code: 'CANCELLED'/g) || []).length;
        assert.ok(checks >= queues, `${id}: ${queues} enqueueGeneration call(s), ${checks} frame.stopped() check(s)`);
        assert.ok(/return \{ finished:/.test(src), `${id}: ${fn} never returns { finished }`);
    }
});

// Without `flowId` on the job, the card's sidecar says "an edit" and Reuse opens the bare model
// instead of the Flow (Multi-angle, 2026-10-25).
test('every driver Flow stamps its jobs with flowId + flowInputs, so Reuse reopens the Flow', () => {
    for (const { id, fn } of _drivers()) {
        const src = _source(fn);
        assert.match(src, /flowId: flow\.id, flowInputs: inputs/, `${id}: the job config never carries flowId + flowInputs`);
    }
});
