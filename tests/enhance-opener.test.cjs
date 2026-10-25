/**
 * enhance-opener.test.cjs — MPI-1231.
 *
 * DeepInfra reads a gemma-3-12b reply that STARTS with `[` as a tool call and hands back empty
 * content, the tokens still billed (measured 2026-10-25: "[HELLO] world" -> "", "HELLO world" ->
 * itself; the Storyboard planner's "[CAST]..." -> "", "Storyboard plan: [CAST]..." -> the plan).
 * So no Flow enhancer may tell the model to open on its first marker, and the opening words
 * must fall away where the answer is read.
 */

'use strict';

// Must exist BEFORE llmService loads (flowEnhance imports it).
const _ls = {};
global.localStorage = {
    getItem: k => (Object.prototype.hasOwnProperty.call(_ls, k) ? _ls[k] : null),
    setItem: (k, v) => { _ls[k] = String(v); },
    removeItem: (k) => { delete _ls[k]; },
};

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const esm = p => import('file:///' + path.join(__dirname, '..', p).replace(/\\/g, '/'));

const enhanceDecls = flow => [
    ...(flow.enhance ? [flow.enhance] : []),
    ...[...(flow.fields || []), ...(flow.steps || []).flatMap(s => s.fields || [])].filter(f => f.action === 'enhance'),
];

test('every Flow enhancer that answers in [MARKER] blocks opens on words, not on a [', async () => {
    const { FLOWS } = await esm('js/data/flowsRegistry.js');
    const marked = FLOWS.flatMap(f => enhanceDecls(f).map(d => [f.id, d.injectionParams?.Input_System_Prompt || '']))
        .filter(([, s]) => /\[[A-Z_]+\]/.test(s));
    assert.ok(marked.some(([id]) => id === 'minimax-music'), 'Music Maker is found');
    for (const [id, system] of marked) {
        assert.match(system, /Start with the words "[^"[]+:"/, `${id} names its opening words`);
        assert.doesNotMatch(system, /Start with \[/, `${id} does not open on a marker`);
    }
});

test('the opening words fall away: Music Maker blocks and Storyboard panels', async () => {
    const { splitEnhanced } = await esm('js/services/flowEnhance.js');
    const music = splitEnhanced({ to: { MOOD: 'm', VOCAL: 'v', ARRANGEMENT: 'a' } },
        'Music plan: [MOOD] warm tape [VOCAL] a low alto [ARRANGEMENT] piano and brushes');
    assert.deepStrictEqual(music, { blocks: [['m', 'warm tape'], ['v', 'a low alto'], ['a', 'piano and brushes']], unmarked: false });

    const { parseStoryboardPlan } = await esm('js/services/storyboardRunner.js');
    const panels = parseStoryboardPlan('Storyboard plan: [CAST] Lena: a young waitress in a red apron. '
        + '[PANEL 1] Picture: Wide shot of the diner, Lena at the counter. Intent: She waits.');
    assert.strictEqual(panels.length, 1);
    assert.strictEqual(panels[0].prompt, 'Wide shot of the diner, Lena at the counter. Lena is a young waitress in a red apron.');
    assert.strictEqual(panels[0].intent, 'She waits.');
});
