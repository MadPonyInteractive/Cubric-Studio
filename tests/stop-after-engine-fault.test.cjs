/**
 * tests/stop-after-engine-fault.test.cjs — MPI-1192
 *
 * A Stop is a cancel, never a "Generation failed" dialog. On ComfyUI 0.41.0 an interrupt
 * mid-KSampler can fault the GPU (Comfy-Org/ComfyUI#17115), so the engine answers the Stop
 * with `execution_error` (torch.AcceleratorError) instead of `execution_interrupted`, and
 * runWorkflow REJECTS. runGifCutoutTrack's catch already checked for the Stop first;
 * runCommand's and runAutoMask's did not, so the user's own Stop opened the bug dialog.
 *
 * Pinned on the source (the house shape for commandExecutor, see lane-settle-on-bail): every
 * runWorkflow catch must test for the Stop BEFORE its first ui:error, so a fourth twin
 * cannot reopen it.
 */
const assert = require('node:assert');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'services', 'commandExecutor.js'), 'utf8');

/** The text of each runWorkflow call's catch, from `catch (err) {` to its first ui:error. */
function catchesBeforeFirstError() {
    const out = [];
    let at = 0;
    while ((at = src.indexOf('.runWorkflow(', at)) !== -1) {
        const c = src.indexOf('} catch (err) {', at);
        const e = src.indexOf("Events.emit('ui:error'", c);
        assert.ok(c > at && e > c, `runWorkflow at offset ${at} has no catch with a ui:error after it`);
        out.push({ line: src.slice(0, at).split('\n').length, body: src.slice(c, e) });
        at = c;
    }
    return out;
}

test('there are three runWorkflow catches (runAutoMask, runGifCutoutTrack, runCommand)', () => {
    assert.strictEqual(catchesBeforeFirstError().length, 3);
});

test('every runWorkflow catch treats a Stop as a cancel before it can show an error', () => {
    for (const { line, body } of catchesBeforeFirstError()) {
        assert.match(
            body,
            /getSignal\(jobId\)\?\.aborted|stopped\(\)|_cancelled/,
            `the runWorkflow catch at line ${line} reaches ui:error without checking for the user's Stop`,
        );
    }
});

test("runCommand's Stop exit ends the job through _abortedBail, the cancel path the callers read", () => {
    const { body } = catchesBeforeFirstError().at(-1);
    assert.match(body, /if \(generationStore\.getSignal\(jobId\)\?\.aborted\) \{[\s\S]*?await _abortedBail\(\);\s*return;/);
});
