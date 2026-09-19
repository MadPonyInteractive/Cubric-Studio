/**
 * flow-cue-stacks.test.cjs — MPI-822.
 *
 * The Flow frame's Generate became a Cue: a press queues a run and the frame stays
 * live, so several runs of the same flow stack in the queue that always accepted
 * them. Nothing here is a behaviour test — the wiring lives inside
 * `MpiBaseFlow.setup`'s closure, which bare Node cannot mount (no DOM, and
 * `/js/utils/icons.js` is an absolute browser path). These are source contracts,
 * the same shape flow-frame.test.cjs and flow-step-param-binding.test.cjs use.
 *
 * NOT TESTABLE HERE, stated rather than skipped in silence: that three presses
 * actually produce three cards, that Stop ends only the running one, and that the
 * queue slide-over opens over the flow overlay. Those need a real engine and
 * Fabio's eyes (MPI-822 plan.md § Verification).
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const repo = p => path.join(__dirname, '..', p);
const read = p => fs.readFileSync(repo(p), 'utf8');

const frame = () => read('js/components/Blocks/MpiBaseFlow/MpiBaseFlow.js');
const promptBox = () => read('js/components/Organisms/MpiPromptBox/MpiPromptBox.js');

test('a second press is not swallowed, and the button no longer morphs', () => {
    const src = frame();

    // THE bug. `if (_running) return` at the top of _run is what made the frame
    // single-slot while the queue underneath took stacked flow jobs quite happily.
    assert.ok(!/const _run = async \(\) => \{\s*\n\s*if \(_running\) return;/.test(src),
        '_run must not early-return on _running — that is the single-slot guard itself');

    // A click that branches on _running is the same bug wearing the button: the
    // second press cancelled the first run instead of queueing behind it.
    assert.ok(!/_runBtn\.on\('click', \(\) => \{ if \(_running\) _cancel\(\); else _run\(\); \}\);/.test(src),
        'the Generate<->Cancel morph must be gone — Cue always queues');
    assert.match(src, /_runBtn\.on\('click', \(\) => _run\(\)\);/);
});

test('the frame holds N runs, matched by token identity not by one id', () => {
    const src = frame();

    assert.match(src, /const _runs = new Set\(\);/);
    assert.ok(!/let _myTempId = null;/.test(src),
        'the single _myTempId slot is what could only describe one run');

    // The token is added BEFORE the auto-enhancer, which can hold a 4B for tens of
    // seconds — the frame has to read busy for all of it, and it has no tempId yet.
    // That is why membership is by object identity and `tempId` is stamped after.
    assert.match(src, /const run = \{ tempId: null \};\s*\n\s*_runs\.add\(run\);/);
    assert.match(src, /run\.tempId = res\.tempId \|\| null;/);

    // Every surface that used to compare against the one id now asks the set.
    assert.match(src, /const _myTempIds = \(\) => \[\.\.\._runs\]\.map\(r => r\.tempId\)\.filter\(Boolean\);/);
    for (const site of [
        /Events\.on\('preview:frame'[\s\S]{0,320}?_myTempIds\(\)\.includes\(entry\.tempId\)/,
        /Events\.on\('generation:preview-reset'[\s\S]{0,320}?_myTempIds\(\)\.includes\(tempId\)/,
    ]) assert.match(src, site);

    // `_running` survives as a DERIVED read, so the scanline / dock / result-replay
    // sites that key on it did not have to move.
    assert.match(src, /_running = _runs\.size > 0;/);
});

test('the result pane is latest-wins — a dispatch no longer wipes it', () => {
    const src = frame();

    // Fabio, 2026-09-19: "yeah, latest wins". _run used to null both slots and
    // persist the null, so the pane emptied the instant Generate was pressed.
    // With runs stacked that would blank a result while N others are still going.
    const runBody = src.slice(src.indexOf('const _run = async () =>'),
        src.indexOf('function _settle('));
    assert.ok(!/_lastResults = null;/.test(runBody),
        '_run must not drop the previous result at dispatch');
    assert.ok(!/_hasPending = false;/.test(runBody),
        'the "Saved to your gallery" note describes the result on screen, which now stays');

    // A LATER run's failure must not destroy a kept result either: the clear
    // repaints what the frame still holds rather than blanking the pane.
    assert.match(src, /function _dropLatentPreview\(\) \{\s*\n\s*if \(_runs\.size\) return;\s*\n\s*_showResults\(_lastResults, \{ remember: false \}\);/);
    assert.ok(!/_showResults\(\[\]\);/.test(src),
        'the old unconditional clear would wipe a sibling run\'s kept result');
});

test('a failure claims the status line; done and cancelled defer while runs remain', () => {
    const src = frame();

    // The one thing that must not be hidden behind a cheerful "Generating…".
    assert.match(src, /_setStatus\(failed \|\| !_runs\.size \? message : 'Generating…'\);/);
    assert.match(src, /_settle\(run, 'Generation failed\.', \{ failed: true \}\);/);
    assert.match(src, /_settle\(run, 'Done — saved to your gallery\.'\);/);
    assert.match(src, /_settle\(run, 'Cancelled\.'\);/);
});

test('the label is the PromptBox copy, and carries no Loop branch', () => {
    const src = frame();

    // Fabio, 2026-09-19: "Cue xN, keep it consistent". Same two strings the
    // PromptBox renders, so the two surfaces cannot drift apart in copy.
    assert.match(src, /return n > 0 \? `Cue x\$\{n\}` : 'Cue';/);
    assert.match(promptBox(), /return n > 0 \? `Cue x\$\{n\}` : 'Cue';/,
        'the flow frame mirrors the PromptBox label — if that copy moves, move both');

    // A flow does not loop, so an armed loop in the gallery must never relabel
    // this button.
    assert.ok(!/loopArmed/.test(src),
        'the flow frame has no Loop state to show');

    // Written from store truth on every queue transition, so the count follows a
    // job settling or being stopped from anywhere — not just from this frame.
    assert.match(src, /Events\.onState\('generationQueueCount', \(\) => _syncRunUi\(\)\)/);
});

test('Stop is its own control, and an open flow owns BOTH generation keys', () => {
    const src = frame();

    assert.match(src, /_stopBtn = MpiButton\.mount\(stopHost, \{[\s\S]{0,200}?icon: 'stop'/);
    assert.match(src, /_stopBtn\?\.el\?\.setDisabled\?\.\(!_running\);/,
        'Stop carries the running state now that Cue never morphs');
    // Dies with the slide it was mounted into, like every other run-slide child.
    assert.match(src, /_runBtn = null; _stopBtn = null;/);
    assert.match(src, /_runBtn\?\.el\?\.destroy\?\.\(\); _stopBtn\?\.el\?\.destroy\?\.\(\);/);

    // Per-SHOW, like the run hotkey beside it: a flow parked by the Tab ring keeps
    // every listener, so an instance-lifetime bind would stop jobs from the gallery.
    assert.match(src, /Hotkeys\.bind\('generation\.stop', _cancel\),/);

    // Hotkeys.bind fires EVERY handler for a key (hotkeyManager.js). _triggerRun
    // already bailed on an open flow; without the same bail on _triggerStop,
    // Ctrl+Alt+Enter inside a flow stops the flow's job AND the PromptBox's.
    assert.match(promptBox(),
        /const _triggerStop = \(\) => \{[\s\S]{0,400}?if \(qs\('\.mpi-base-flow'\)\) return;/,
        'the PromptBox must yield Ctrl+Alt+Enter to an open flow, as it does Ctrl+Enter');
});
