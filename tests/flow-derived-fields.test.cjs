/**
 * flow-derived-fields.test.cjs — MPI-607, rebuilt on a fixture in MPI-1012.
 *
 * A FlowDef's `derived[]` computes a graph input the user never sees. Text to Speech's
 * `Input_Is_Multilingual` is the case it was built for: it used to be an "Other
 * languages" toggle sitting beside the language select, and the pair had exactly one
 * state a user could get wrong — toggle OFF with a non-English language picked, which
 * silently produced English. Deriving the boolean makes that state unreachable.
 *
 * MPI-1012 made Text to Speech the Chatterbox MODEL, and its derivation moved with it into
 * one control (`ttsLanguage` -> `ttsLanguageParams`, the `ratio` W+H pattern). No shipped
 * Flow declares `derived[]` today, but the mechanism stays a Flow capability, so its guard
 * survives on a fixture shaped exactly like the Flow it was built for — the guard must
 * outlive its exemplar. The arm itself is pinned below on the model path.
 *
 * Nothing in the UI can show a derivation is wrong: a mis-derived boolean simply routes the
 * run down the other arm and returns audio, in the wrong language, with no error.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const repo = p => path.join(__dirname, '..', p);
const esm = p => import('file://' + repo(p).replace(/\\/g, '/'));

/** The Text to Speech FlowDef's own shape at MPI-1012, reduced to what `derived` reads. */
const FIXTURE = {
    id: 'derived-fixture',
    fields: [
        { id: 'positive', type: 'text' },
        { id: 'Input_Language.language', type: 'select', default: 'English (en)',
          options: [{ v: 'English (en)' }, { v: 'French (fr)' }, { v: 'Japanese (ja)' }] },
    ],
    derived: [
        { id: 'Input_Is_Multilingual', from: 'Input_Language.language',
          equals: 'English (en)', then: false, else: true },
    ],
};

test('derived[] is computed AFTER the caller\'s value, from the value the caller picked', async () => {
    const { resolveFlowFieldValues } = await esm('js/utils/declaredFields.js');

    const english = resolveFlowFieldValues(FIXTURE, { positive: 'hi' });
    assert.strictEqual(english.injectionParams.Input_Is_Multilingual, false,
        'the default must derive from the default');

    // Computed before the override, this comes back false and a Japanese request runs the
    // English arm — ok:true and nothing to explain it.
    const japanese = resolveFlowFieldValues(FIXTURE, { positive: 'hi', 'Input_Language.language': 'Japanese (ja)' });
    assert.strictEqual(japanese.injectionParams['Input_Language.language'], 'Japanese (ja)');
    assert.strictEqual(japanese.injectionParams.Input_Is_Multilingual, true);
    assert.deepStrictEqual(japanese.unknown, [], 'a derived id is never the caller\'s unknown field');
});

test('Chatterbox: every language but English takes the multilingual arm, and none is a control', async () => {
    const { TTS_LANGUAGES, TTS_ENGLISH, ttsLanguageParams, commands } = await esm('js/data/commandRegistry.js');
    for (const { v } of TTS_LANGUAGES) {
        assert.strictEqual(ttsLanguageParams(v).Input_Is_Multilingual, v !== TTS_ENGLISH, `${v} on the wrong arm`);
    }
    // The toggle is GONE on purpose: with it, a non-English language could run on the
    // English arm. If someone re-adds a control for the boolean, that state comes back.
    assert.ok(!commands.tts.components.includes('ttsMultilingual') && commands.tts.components.length === 1,
        'tts exposes the language and nothing else');
});

test('Text to Speech is TTS only — no second audio role reaches the graph', async () => {
    // `Input_Audio_2` used to switch the graph onto FL_ChatterboxVC. That arm was killed on
    // measurement (VC takes timbre from its target, so the output was the reference clip's
    // speaker, not the chosen voice) and its nodes are gone; an `audio2` mapping would write
    // to a title that no longer exists, or put the arm back if it ever returns.
    const { commands } = await esm('js/data/commandRegistry.js');
    assert.deepStrictEqual(commands.tts.mediaInputs.map(m => m.key), ['audio1'],
        'tts must map only audio1 — an audio2 mapping re-enables the VC arm');
});
