/**
 * flow-output-display.test.cjs — MPI-747.
 *
 * A Flow graph may carry ONE node titled `Output_Display`: a view assembled inside the
 * graph (Head Swap: both inputs beside the result) that the Flow shows on its final
 * stage INSTEAD of the output. The gallery card stays the output; the display is never
 * saved. Generic — image or video, any Flow.
 *
 * Every failure here is silent. Sweep the title into the card set and each run lands a
 * second, junk gallery card; drop it anywhere between the executor and the pane and the
 * Flow just shows the bare output. The surfaces are DOM-only, so like
 * flow-result-compare.test.cjs these pin WIRING; the live proof is the card's validation.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const repo = p => path.join(__dirname, '..', p);
const read = p => fs.readFileSync(repo(p), 'utf8');

test('Output_Display is captured into its own set, never the card set', () => {
    const src = read('js/services/commandExecutor.js');
    const cardSets = src.split('const outputNodeIds = new Set(').slice(1).map(s => s.split(/\n\s*const /)[0]);
    assert.ok(cardSets.length, 'outputNodeIds must still be built from a title filter');
    for (const body of cardSets) {
        assert.ok(!/output_display/.test(body), 'Output_Display must never make a gallery card');
    }
    assert.match(src, /toLowerCase\(\) === 'output_display'/, 'the display set matches the title EXACTLY');
    assert.match(src, /outputDisplayNodeIds\.has\(nodeId\)\) \{\s*_collectComfyOutputUrls\(nodeOutput, displayOutputUrls/,
        'the display node\'s executed output must be collected');
    assert.match(src, /displayUrls: displayOutputUrls \}\)/, 'onComplete must hand the display on');
});

test('the gallery completion hands displayUrls to the Flow', () => {
    const src = read('js/services/generationService.js');
    assert.match(src, /callbacks\.onComplete\?\.\(\{ item: firstItem, [^)]*displayUrls: outputInfo\.displayUrls/);
});

test('MpiBaseFlow paints the display first, persists it, and drops it without the result', () => {
    const src = read('js/components/Organisms/MpiBaseFlow/MpiBaseFlow.js');
    assert.match(src, /_showResults\(items \|\| item, \{ display: _displayItems\(displayUrls\) \}\)/);

    const modes = src.match(/function _resultModes\(it\) \{([\s\S]*?)\n        \}/);
    assert.ok(modes, '_resultModes must exist — the toggle cycles through it');
    const at = ['display', 'compare', 'player'].map(m => modes[1].indexOf(`modes.push('${m}')`));
    assert.ok(at.every(i => i >= 0) && at[0] < at[1] && at[1] < at[2],
        'first paint order is display, then compare, then player');

    assert.match(src, /pending: _hasPending, display: _lastDisplay \}/, 'a reopen must bring the display back');

    // An engine restart wipes ComfyUI temp: fall back to the RESULT, never to an empty pane.
    const drop = src.match(/function _dropDisplay\(url\) \{([\s\S]*?)\n        \}/);
    assert.ok(drop, '_dropDisplay must exist');
    assert.ok(!/_lastResults = null/.test(drop[1]), 'a dead display must not take the saved result with it');
    assert.match(drop[1], /_showResults\(_lastResults, \{ remember: false \}\)/);

    // `\r?\n`: CI checks the tree out CRLF, and a bare `\n` after `;` matches nothing there.
    assert.match(src, /_lastResults = null;\r?\n\s*_lastDisplay = null;/, 'Generate and a vanished result both clear it');
    assert.match(src, /const it = list\.length \? \(_lastDisplay\?\.\[0\] \|\| list\[0\]\) : null;/,
        'the floating window shows the display too');
});

test('every Flow graph carries at most ONE Output_Display', () => {
    const dir = repo('comfy_workflows');
    for (const f of fs.readdirSync(dir).filter(n => /^flow_.*\.json$/.test(n))) {
        const wf = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
        const n = Object.values(wf).filter(v => v?._meta?.title?.toLowerCase() === 'output_display').length;
        assert.ok(n <= 1, `${f}: ${n} Output_Display nodes — a Flow shows ONE view`);
    }
});

test('Head Swap ships a display, and its baked prompt is not titled Input_Positive', () => {
    const titles = Object.values(JSON.parse(read('comfy_workflows/flow_head_swap.json'))).map(v => v?._meta?.title);
    assert.ok(titles.includes('Output_Display'), 'Head Swap is the first Output_Display consumer (MPI-744)');
    // A Flow with no prompt field still sends `Input_Positive: ''` on every run, which
    // would wipe the baked head_swap instruction — the outpaint trap.
    assert.ok(!titles.includes('Input_Positive'), 'the baked prompt node must not be titled Input_Positive');
});
