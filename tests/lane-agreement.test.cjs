'use strict';
// MPI-213 guard: generationService._laneOf and commandExecutor's engine→lane
// resolution MUST agree, or a job's INTENT lane and its STORE lane diverge and a
// completed gen strands as a phantom "1 RUNNING". These are the two rules as
// literals; the test asserts they map every (forceLocal, isRemote) case to the
// SAME lane. If someone edits one rule and not the other, this fails.
const assert = require('assert');

// generationService._laneOf (the intent lane)
function laneOf(forceLocal, isRemote, isCloud = false) {
    if (isCloud) return 'cloud';
    if (forceLocal === true) return 'local';
    return isRemote ? 'remote' : 'local';
}

// The executor's engine resolution → generationStore lane. MPI-851 added a third
// engine: cloudExecutor registers engine 'cloud', and the store's _laneOf maps it to
// its own lane. commandExecutor still resolves only local/remote.
function storeLane(forceLocal, isRemote, isCloud = false) {
    const engine = isCloud ? 'cloud' : (forceLocal === true ? 'local' : (isRemote ? 'remote' : 'local'));
    if (engine === 'cloud') return 'cloud';
    return engine === 'local' ? 'local' : 'remote';
}

for (const isCloud of [true, false]) {
    for (const forceLocal of [true, false]) {
        for (const isRemote of [true, false]) {
            assert.strictEqual(
                laneOf(forceLocal, isRemote, isCloud),
                storeLane(forceLocal, isRemote, isCloud),
                `lane mismatch at forceLocal=${forceLocal} isRemote=${isRemote} isCloud=${isCloud}`
            );
        }
    }
}

// MPI-851: a cloud model wins over BOTH engine flags. `remote` means the user's Pod in
// this app, so a cloud job landing there holds the Pod's single slot and badges itself
// as something the Pod is doing; and Run-locally cannot apply to a model with no local
// copy — routed 'local' it dies in `_findModelNotLocal` looking for absent weights.
assert.strictEqual(laneOf(true, false, true), 'cloud', 'Run-locally must not pull a cloud job local');
assert.strictEqual(laneOf(false, true, true), 'cloud', 'a connected Pod must not adopt a cloud job');
assert.strictEqual(storeLane(true, true, true), 'cloud', 'the store agrees on both flags');

// The regression case that MPI-213 fixed: no-Pod local gen must be 'local' on BOTH.
assert.strictEqual(laneOf(false, false), 'local', 'no-Pod intent lane must be local');
assert.strictEqual(storeLane(false, false), 'local', 'no-Pod store lane must be local');

console.log('lane-agreement: all (isCloud × forceLocal × isRemote) cases agree ✓');
