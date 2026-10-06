'use strict';

/**
 * MPI-1024 — after a comfy-aimdo allocation fault, the engine restarts with dynamic VRAM
 * off for the rest of the session. The fault lines below are verbatim from the first
 * public 2.0 report (RTX 3060 12 GB, ComfyUI 0.34.0, comfy-aimdo 0.4.15), colour escapes
 * included, because that is what arrives on the pipe.
 */

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Keep the logger and engine root off the developer's real app data (as the other
// engine-output tests do).
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'mpi1024-'));
process.env.APP_USER_DATA = TMP;
process.env.CUBRIC_ENGINE_ROOT = TMP;

const comfyRouter = require('../routes/comfy');
const { processState } = require('../routes/shared');
const { noteDynamicVramFault, cudaModeArgs } = comfyRouter;

const ALLOC_FAILED = '\x1b[1m\x1b[31m[ERROR]\x1b[0m aimdo: src/model-vbar.c:403:ERROR:VRAM Allocation failed';
const FAULT_FAILED = 'RuntimeError: Fault failed: 2';
const HEALTHY = '\x1b[32m[INFO]\x1b[0m Model Flux2 prepared for dynamic VRAM loading. 3885MB Staged. 0 patches attached.';

function reset() {
    processState.dynamicVramOff = false;
    processState.comfyNeedsRestart = false;
    processState.comfyRestartReason = null;
}

test('a healthy dynamic VRAM line changes nothing; the engine keeps the shipped flags', () => {
    reset();
    noteDynamicVramFault(HEALTHY);
    assert.equal(processState.dynamicVramOff, false);
    assert.equal(processState.comfyNeedsRestart, false);
    assert.deepEqual(cudaModeArgs(), ['--lowvram']);
});

for (const [name, line] of [['the aimdo allocation line', ALLOC_FAILED], ['the vbar fault exception', FAULT_FAILED]]) {
    test(`${name} turns dynamic VRAM off, asks for a restart, and drops --lowvram`, () => {
        reset();
        noteDynamicVramFault(line);
        assert.equal(processState.dynamicVramOff, true);
        assert.equal(processState.comfyNeedsRestart, true);
        assert.match(processState.comfyRestartReason, /safer GPU memory mode/);
        assert.deepEqual(cudaModeArgs(), ['--disable-dynamic-vram']);
    });
}

test('the mode is sticky for the session: a restart clearing the flag does not bring aimdo back', () => {
    reset();
    noteDynamicVramFault(ALLOC_FAILED);
    processState.comfyNeedsRestart = false;   // what a spawn in /comfy/start does
    processState.comfyRestartReason = null;
    noteDynamicVramFault(FAULT_FAILED);       // the same fault's traceback, seconds later
    assert.equal(processState.comfyNeedsRestart, false, 'one fault, one restart');
    assert.deepEqual(cudaModeArgs(), ['--disable-dynamic-vram']);
});
