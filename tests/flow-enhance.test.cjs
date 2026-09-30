/**
 * flow-enhance.test.cjs — MPI-1002 steps 1 and 4.
 *
 * `js/services/flowEnhance.js` is the ONE reader of a Flow's `enhance` declaration and the ONE
 * Flow-path caller of `llmService.enhanceFlow`. `MpiBaseFlow` (a hand run) and
 * `agentDispatch.buildFlow` (an agent or routine run) both go through it, so this pins the two
 * halves that must not drift apart:
 *
 *   1. THE HAND RUN IS BYTE-IDENTICAL. The GOLDENS below were captured from the code as it stood
 *      BEFORE the helpers moved out of MpiBaseFlow's closure (its own `_enhanceSourceText`,
 *      sliced verbatim from HEAD and run over the same values), and the moved code must build
 *      the same strings. The request `runEnhanceDecl` sends is asserted end to end against a
 *      stubbed `/llm/enhance`.
 *   2. THE AGENT RUN ENHANCES, ON THE SAME PRIMITIVE. `enhanceFlowRun` runs each automatic
 *      declaration, writes only blank targets, and STOPS the run when the picked enhancer fails.
 *
 * The frame's closure cannot be imported in bare Node, so what it does with these helpers is a
 * source contract in flow-enhance-ownership.test.cjs, and the live behaviour is the desktop
 * spec tests/desktop/flow-enhance-writes-textarea.spec.js.
 */

'use strict';

// Must exist BEFORE llmService loads: `backendPreference` / the connection profile read it.
const _ls = {};
global.localStorage = {
    getItem: k => (Object.prototype.hasOwnProperty.call(_ls, k) ? _ls[k] : null),
    setItem: (k, v) => { _ls[k] = String(v); },
    removeItem: (k) => { delete _ls[k]; },
};

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const repo = p => path.join(__dirname, '..', p);
const esm = p => import('file://' + repo(p).replace(/\\/g, '/'));

// ── Goldens, captured from the ORIGINAL closure helpers (pre-refactor) ──────────────────────
const SONG_VALUES = {
    presetOneVoiceNoNotes: {
        positive: 'A soaring pop-rock anthem about leaving a small town behind.',
        Input_Style: 'Alternative pop-rock, live band instrumentation with guitars up front.',
        Input_Style_Custom: '',
        Input_Voices: [{ type: 'Female' }],
        Input_Voice_Notes: '',
    },
    duetWithNotes: {
        positive: 'A duet between a prince and a princess.',
        Input_Style: 'Contemporary pop ballad, radio-ready production.',
        Input_Style_Custom: 'ignored: hidden',
        Input_Voices: [{ type: 'Male' }, { type: 'Female' }],
        Input_Voice_Notes: 'Voice 1 sings the verse, Voice 2 the chorus.',
    },
    customStyle: {
        positive: 'Rain on the window.',
        Input_Style: '',
        Input_Style_Custom: 'late-70s Laurel Canyon, twelve-string and pedal steel',
        Input_Voices: [{ type: 'Any' }],
        Input_Voice_Notes: '',
    },
    onlyBrief: { positive: 'Just the brief.', Input_Style: '', Input_Style_Custom: '', Input_Voices: [], Input_Voice_Notes: '' },
    empty: { positive: '', Input_Style: '', Input_Style_Custom: '', Input_Voices: [], Input_Voice_Notes: '' },
};

const SONG_GOLDEN = {
    presetOneVoiceNoNotes: 'Your song: A soaring pop-rock anthem about leaving a small town behind.\nStyle: Alternative pop-rock, live band instrumentation with guitars up front.\nVoices: Voice 1 (Female)',
    duetWithNotes: 'Your song: A duet between a prince and a princess.\nStyle: Contemporary pop ballad, radio-ready production.\nVoices: Voice 1 (Male)\nVoice 2 (Female)\nVoice notes: Voice 1 sings the verse, Voice 2 the chorus.',
    customStyle: 'Your song: Rain on the window.\nYour own style: late-70s Laurel Canyon, twelve-string and pedal steel\nVoices: Voice 1',
    onlyBrief: 'Your song: Just the brief.',
    empty: '',
};

const SYNTH_DECLS = [
    { id: 'positive', type: 'text', label: 'Brief' },
    { id: 'Input_Instrumental', type: 'toggle', label: 'Instrumental' },
    { id: 'Input_Structure', type: 'text', label: 'Song structure' },
    { id: 'Input_Bpm', type: 'number', label: 'Tempo', min: 0, max: 250 },
];

// [name, declaration, values, hidden ids, golden]
const SYNTH_CASES = [
    ['a lone source is sent verbatim, unlabelled', { from: 'positive' }, { positive: 'a bodybuilder' }, [], 'a bodybuilder'],
    ['a blank lone source sends nothing', { from: 'positive' }, { positive: '   ' }, [], ''],
    ['a true toggle is its label alone', { from: ['positive', 'Input_Instrumental'] }, { positive: 'x', Input_Instrumental: true }, [], 'Brief: x\nInstrumental'],
    ['a false toggle is dropped', { from: ['positive', 'Input_Instrumental'] }, { positive: 'x', Input_Instrumental: false }, [], 'Brief: x'],
    ['a hidden source is dropped, and a lone survivor is then unlabelled', { from: ['positive', 'Input_Structure'] }, { positive: 'x', Input_Structure: 'Intro: drum' }, ['Input_Structure'], 'x'],
    ['a number is clamped to its declared bounds', { from: ['positive', 'Input_Bpm'] }, { positive: 'x', Input_Bpm: 999 }, [], 'Brief: x\nTempo: 250'],
    ['an undeclared source is labelled by its id', { from: ['positive', 'ghost'] }, { positive: 'x', ghost: 'boo' }, [], 'Brief: x\nghost: boo'],
];

// ── helpers ──────────────────────────────────────────────────────────────────────────────────
async function song() {
    const reg = await esm('js/data/flowsRegistry.js');
    const flow = reg.FLOWS.find(f => f.id === 'minimax-music');
    assert.ok(flow?.enhance, 'the Song FlowDef must declare `enhance`');
    const pool = [...(flow.fields || []), ...(flow.steps || []).flatMap(s => s.fields || [])].filter(f => f?.id);
    return { flow, pool, flowModelIds: reg.flowModelIds };
}

async function songSource(values, graphValues = false) {
    const { flow, pool, flowModelIds } = await song();
    const { hiddenFieldIds } = await esm('js/utils/declaredFields.js');
    const fe = await esm('js/services/flowEnhance.js');
    const d = fe.autoEnhanceDecl(flow);
    const hidden = new Set(hiddenFieldIds(pool, values, flowModelIds(flow)));
    return fe.enhanceSourceText(d, pool, values, hidden, { graphValues });
}

const TEXT = '[MOOD] Warm, intimate. [VOCAL] Two voices in duet. [ARRANGEMENT] Piano and strings.';

/** A stub enhancer recording every call; `answer` is what it resolves. */
function stubEnhancer(answer) {
    const calls = [];
    const enhance = async (d, source, ctx) => {
        calls.push({ d, source, ctx });
        return typeof answer === 'function' ? answer(calls.length) : answer;
    };
    return { calls, deps: { enhance } };
}

// ── 1. The hand run: byte-identical source text ─────────────────────────────────────────────
test('Song builds the SAME enhancer prompt it built before the move (goldens from the original closure)', async () => {
    for (const [name, values] of Object.entries(SONG_VALUES)) {
        assert.strictEqual(await songSource(values), SONG_GOLDEN[name], `scenario "${name}" drifted`);
    }
});

test('the source-line builder keeps every rule the closure had (lone source, toggles, hidden, clamp)', async () => {
    const { enhanceSourceText } = await esm('js/services/flowEnhance.js');
    for (const [name, d, values, hidden, golden] of SYNTH_CASES) {
        assert.strictEqual(enhanceSourceText(d, SYNTH_DECLS, values, new Set(hidden)), golden, name);
    }
});

test('graph values are read as they are: no second pass through mapDeclaredValue', async () => {
    // The agent path hands over `resolveFlowFieldValues` output, which is ALREADY mapped. A
    // serialised roster must not be re-serialised to '' and a `mapTo` range must not map twice.
    const values = { ...SONG_VALUES.duetWithNotes, Input_Voices: 'Voice 1 (Male)\nVoice 2 (Female)' };
    assert.strictEqual(await songSource(values, true), SONG_GOLDEN.duetWithNotes);
    const { enhanceSourceText } = await esm('js/services/flowEnhance.js');
    const decls = [{ id: 'positive', label: 'Brief' }, { id: 'Input_Denoise', type: 'slider', label: 'Denoise', min: 0, max: 1, mapTo: [0.5, 0.85] }];
    assert.strictEqual(enhanceSourceText({ from: ['positive', 'Input_Denoise'] }, decls, { positive: 'x', Input_Denoise: 0.7 }, new Set(), { graphValues: true }), 'Brief: x\nDenoise: 0.7');
});

test('the targets and sources are the declaration\'s own, as before', async () => {
    const fe = await esm('js/services/flowEnhance.js');
    const { flow } = await song();
    const d = fe.autoEnhanceDecl(flow);
    assert.deepStrictEqual(fe.enhanceTargets(d), ['Input_Mood', 'Input_Vocal', 'Input_Arrangement']);
    assert.deepStrictEqual(fe.enhanceSources(d), ['positive', 'Input_Style', 'Input_Style_Custom', 'Input_Voices', 'Input_Voice_Notes']);
    assert.deepStrictEqual(fe.enhanceTargets({ to: 'Input_Positive' }), ['Input_Positive']);
    assert.deepStrictEqual(fe.enhanceSources({ from: 'positive' }), ['positive']);
    assert.strictEqual(d.id, 'enhance:auto');
    assert.strictEqual(d.auto, true);
    assert.strictEqual(d.action, 'enhance');
});

test('flowEnhanceDecls finds the flow-level declaration and the button ones, and nothing else', async () => {
    const fe = await esm('js/services/flowEnhance.js');
    const reg = await esm('js/data/flowsRegistry.js');
    const { flow } = await song();
    assert.deepStrictEqual(fe.flowEnhanceDecls(flow).map(d => d.id), ['enhance:auto']);
    const sheet = reg.FLOWS.find(f => f.id === 'character-sheet');
    const decls = fe.flowEnhanceDecls(sheet);
    assert.ok(decls.length >= 1 && decls.every(d => d.action === 'enhance' && !d.auto),
        'Character Sheet\'s Enhance is a button, never automatic');
    assert.deepStrictEqual(fe.flowEnhanceDecls({ id: 'plain', fields: [{ id: 'positive' }] }), []);
    assert.deepStrictEqual(fe.flowEnhanceDecls(null), []);
});

test('splitEnhanced and enhancedWrites: marked blocks, unmarked fallback, the user\'s own boxes', async () => {
    const fe = await esm('js/services/flowEnhance.js');
    const { flow } = await song();
    const d = fe.autoEnhanceDecl(flow);

    const split = fe.splitEnhanced(d, TEXT);
    assert.strictEqual(split.unmarked, false);
    assert.deepStrictEqual(split.blocks, [
        ['Input_Mood', 'Warm, intimate.'],
        ['Input_Vocal', 'Two voices in duet.'],
        ['Input_Arrangement', 'Piano and strings.'],
    ]);

    const unmarked = fe.splitEnhanced(d, 'Just prose, no markers.');
    assert.strictEqual(unmarked.unmarked, true);
    assert.ok(unmarked.blocks.every(([, v]) => v === ''));
    assert.strictEqual(fe.splitEnhanced({ to: 'Input_Positive' }, 'a phrase').unmarked, false);

    const all = () => true;
    assert.deepStrictEqual(fe.enhancedWrites(d, TEXT, all).map(([id]) => id), ['Input_Mood', 'Input_Vocal', 'Input_Arrangement']);
    assert.deepStrictEqual(fe.enhancedWrites(d, 'Just prose, no markers.', all), [['Input_Mood', 'Just prose, no markers.']],
        'an unmarked answer lands in the first box');
    assert.deepStrictEqual(fe.enhancedWrites(d, TEXT, id => id !== 'Input_Vocal').map(([id]) => id), ['Input_Mood', 'Input_Arrangement'],
        'a box that may not be written is skipped, the rest still land');
    assert.deepStrictEqual(fe.enhancedWrites(d, 'Just prose, no markers.', id => id === 'Input_Arrangement'),
        [['Input_Arrangement', 'Just prose, no markers.']],
        'the unmarked fallback goes to the first WRITABLE box, never onto the user\'s');
    assert.deepStrictEqual(fe.enhancedWrites(d, TEXT, () => false), []);
    assert.deepStrictEqual(fe.enhancedWrites({ to: 'Input_Positive' }, 'a phrase', all), [['Input_Positive', 'a phrase']]);
    assert.deepStrictEqual(fe.enhancedWrites({ to: 'Input_Positive' }, 'a phrase', () => false), []);
});

// ── 1b. runEnhanceDecl: the request, end to end, and the ONE log line ─────────────────────────
test('runEnhanceDecl sends the golden prompt and the recipe, and logs ONE line naming the backend', async () => {
    const fe = await esm('js/services/flowEnhance.js');
    const svc = await esm('js/services/llmService.js');
    const { flow } = await song();
    const d = fe.autoEnhanceDecl(flow);

    const realFetch = global.fetch;
    const realWarn = console.warn;
    console.warn = () => {};
    const bodies = [];
    const logs = [];
    global.fetch = (url, init) => {
        if (String(url).startsWith('/comfy_workflows/')) {
            const graph = JSON.parse(fs.readFileSync(repo(`comfy_workflows/${String(url).slice('/comfy_workflows/'.length)}`), 'utf8'));
            return Promise.resolve({ ok: true, json: () => Promise.resolve(graph) });
        }
        if (url === '/log') { logs.push(JSON.parse(init.body)); return Promise.resolve({ ok: true, json: () => Promise.resolve({}) }); }
        if (url === '/llm/enhance') bodies.push(JSON.parse(init.body));
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true, text: TEXT, backend: 'endpoint', model: 'x/y', models: [] }) });
    };
    svc.setBackendPreference('endpoint');
    try {
        const source = await songSource(SONG_VALUES.duetWithNotes);
        const result = await fe.runEnhanceDecl(d, source, { flowId: flow.id });

        assert.strictEqual(result.ok, true, JSON.stringify(result));
        assert.strictEqual(bodies.length, 1, 'exactly one /llm/enhance call, and no ComfyUI job');
        assert.strictEqual(bodies[0].prompt, SONG_GOLDEN.duetWithNotes, 'the prompt must be the golden, byte for byte');
        assert.strictEqual(bodies[0].backend, 'endpoint');
        assert.strictEqual(bodies[0].system, svc.unwrapChatMl(d.injectionParams.Input_System_Prompt),
            'the declaration\'s own recipe, unwrapped from ChatML, as a hand run sends it');
        assert.strictEqual(bodies[0].maxTokens, d.injectionParams['Input_Text_Gen.max_length']);

        assert.strictEqual(logs.length, 1, 'ONE log line per enhance');
        assert.strictEqual(logs[0].level, 'info');
        assert.strictEqual(logs[0].category, 'flow-enhance');
        assert.match(logs[0].message, /^Song enhanced on endpoint \(x\/y\), \d+ ms$/);
    } finally {
        delete _ls['cubric.llm.backend'];
        global.fetch = realFetch;
        console.warn = realWarn;
    }
});

test('runEnhanceDecl warns on a failure, stays quiet on a cancel, and never rejects', async () => {
    const fe = await esm('js/services/flowEnhance.js');
    const svc = await esm('js/services/llmService.js');
    const { flow } = await song();
    const d = fe.autoEnhanceDecl(flow);

    const realFetch = global.fetch;
    const realWarn = console.warn;
    console.warn = () => {};
    const logs = [];
    let reply = { ok: false, error: 'No API key saved for this connection.' };
    global.fetch = (url, init) => {
        if (String(url).startsWith('/comfy_workflows/')) {
            const graph = JSON.parse(fs.readFileSync(repo(`comfy_workflows/${String(url).slice('/comfy_workflows/'.length)}`), 'utf8'));
            return Promise.resolve({ ok: true, json: () => Promise.resolve(graph) });
        }
        if (url === '/log') { logs.push(JSON.parse(init.body)); return Promise.resolve({ ok: true, json: () => Promise.resolve({}) }); }
        return Promise.resolve({ ok: true, json: () => Promise.resolve(reply) });
    };
    svc.setBackendPreference('ollama');
    try {
        const result = await fe.runEnhanceDecl(d, 'Your song: x', { flowId: flow.id });
        assert.strictEqual(result.ok, false);
        assert.strictEqual(result.error, 'No API key saved for this connection.');
        assert.strictEqual(logs.length, 1);
        assert.strictEqual(logs[0].level, 'warn');
        assert.strictEqual(logs[0].category, 'flow-enhance');
        assert.match(logs[0].message, /^Song enhance failed on ollama: No API key saved/);
    } finally {
        delete _ls['cubric.llm.backend'];
        global.fetch = realFetch;
        console.warn = realWarn;
    }
});

// ── 2. The agent run: enhanceFlowRun ─────────────────────────────────────────────────────────
test('enhanceFlowRun: Song is enhanced ONCE, on the hand run\'s own prompt, and the patch carries the blocks', async () => {
    const fe = await esm('js/services/flowEnhance.js');
    const { resolveFlowFieldValues } = await esm('js/utils/declaredFields.js');
    const { flow } = await song();

    // The real agent path: `resolveFlowFieldValues` over what Cosmo sends (no caption blocks).
    const v = SONG_VALUES.duetWithNotes;
    const resolved = resolveFlowFieldValues(flow, {
        positive: v.positive, Input_Style: v.Input_Style, Input_Style_Custom: v.Input_Style_Custom,
        Input_Voices: v.Input_Voices, Input_Voice_Notes: v.Input_Voice_Notes,
    });
    assert.deepStrictEqual(resolved.unknown, []);

    const { calls, deps } = stubEnhancer({ ok: true, text: TEXT, backend: 'endpoint', model: 'x/y' });
    const patch = await fe.enhanceFlowRun(flow, resolved, deps);

    assert.strictEqual(calls.length, 1, 'exactly one enhancer pass');
    assert.strictEqual(calls[0].source, SONG_GOLDEN.duetWithNotes, 'the agent builds the SAME prompt a hand run builds');
    assert.strictEqual(calls[0].d.id, 'enhance:auto');
    assert.strictEqual(calls[0].ctx.flowId, 'minimax-music');

    assert.strictEqual(patch.ok, true);
    assert.deepStrictEqual(patch.injectionParams, {
        Input_Mood: 'Warm, intimate.',
        Input_Vocal: 'Two voices in duet.',
        Input_Arrangement: 'Piano and strings.',
    });
    assert.deepStrictEqual(patch.inputs, { enhanceWrote: ['Input_Mood', 'Input_Vocal', 'Input_Arrangement'] });
    assert.ok(!('positive' in patch.inputs), 'the patch holds what the enhancer wrote and nothing else');
});

test('enhanceFlowRun: a Flow with no `enhance` returns an empty patch at once and calls nothing', async () => {
    const fe = await esm('js/services/flowEnhance.js');
    const { calls, deps } = stubEnhancer({ ok: true, text: 'never' });
    const plain = { id: 'plain', title: 'Plain', fields: [{ id: 'positive', type: 'text' }] };
    assert.deepStrictEqual(await fe.enhanceFlowRun(plain, { inputs: { positive: 'x' }, injectionParams: {} }, deps),
        { ok: true, injectionParams: {}, inputs: {} });
    // Character Sheet: its Enhance is a BUTTON, so an agent run (like a hand Generate) runs none.
    const reg = await esm('js/data/flowsRegistry.js');
    const sheet = reg.FLOWS.find(f => f.id === 'character-sheet');
    assert.deepStrictEqual(await fe.enhanceFlowRun(sheet, { inputs: { positive: 'a tall woman' }, injectionParams: {} }, deps),
        { ok: true, injectionParams: {}, inputs: {} });
    assert.strictEqual(calls.length, 0);
});

test('enhanceFlowRun: prefilled targets are the caller\'s own text, so nothing runs', async () => {
    const fe = await esm('js/services/flowEnhance.js');
    const { flow } = await song();
    const { calls, deps } = stubEnhancer({ ok: true, text: TEXT });
    const resolved = {
        inputs: { positive: 'A duet.' },
        injectionParams: { Input_Mood: 'mine', Input_Vocal: 'mine too', Input_Arrangement: 'and mine' },
    };
    assert.deepStrictEqual(await fe.enhanceFlowRun(flow, resolved, deps), { ok: true, injectionParams: {}, inputs: {} });
    assert.strictEqual(calls.length, 0, 'spends nothing when every target already has text');
});

test('enhanceFlowRun: a half-filled set runs once and writes ONLY the blank targets', async () => {
    const fe = await esm('js/services/flowEnhance.js');
    const { flow } = await song();
    const { calls, deps } = stubEnhancer({ ok: true, text: TEXT });
    const resolved = {
        inputs: { positive: 'A duet.' },
        injectionParams: { Input_Mood: 'mine', Input_Vocal: '', Input_Arrangement: '   ' },
    };
    const patch = await fe.enhanceFlowRun(flow, resolved, deps);
    assert.strictEqual(calls.length, 1);
    assert.deepStrictEqual(patch.injectionParams, { Input_Vocal: 'Two voices in duet.', Input_Arrangement: 'Piano and strings.' });
    assert.deepStrictEqual(patch.inputs, { enhanceWrote: ['Input_Vocal', 'Input_Arrangement'] });
});

test('enhanceFlowRun: no source text, no call', async () => {
    const fe = await esm('js/services/flowEnhance.js');
    const { flow } = await song();
    const { calls, deps } = stubEnhancer({ ok: true, text: TEXT });
    // Every source blank (Custom style hidden behind a preset it is not in; no brief, no cast).
    const resolved = { inputs: { positive: '' }, injectionParams: { Input_Style: '', Input_Style_Custom: '', Input_Voices: '', Input_Voice_Notes: '' } };
    assert.deepStrictEqual(await fe.enhanceFlowRun(flow, resolved, deps), { ok: true, injectionParams: {}, inputs: {} });
    assert.strictEqual(calls.length, 0);
});

test('enhanceFlowRun: a failed enhancer STOPS the run with its own message and a Remote > Language Models hint', async () => {
    const fe = await esm('js/services/flowEnhance.js');
    const { flow } = await song();
    const resolved = { inputs: { positive: 'A duet.' }, injectionParams: {} };

    const failed = stubEnhancer({ ok: false, error: 'Ollama is not running.' });
    const refusal = await fe.enhanceFlowRun(flow, resolved, failed.deps);
    assert.strictEqual(refusal.ok, false);
    assert.strictEqual(refusal.code, 'ENHANCE_FAILED');
    assert.match(refusal.message, /Nothing was generated/);
    assert.match(refusal.message, /Ollama is not running\./, 'carries the enhancer\'s own error');
    assert.match(refusal.message, /Remote > Language Models/, 'and says where to fix it');
    assert.strictEqual(failed.calls.length, 1);

    // The endpoint branch already appends the hint: it must not be said twice.
    const hinted = await fe.enhanceFlowRun(flow, resolved,
        stubEnhancer({ ok: false, error: 'No API key saved for this connection. Check Remote > Language Models.' }).deps);
    assert.strictEqual(hinted.message.match(/Remote > Language Models/g).length, 1);

    const empty = await fe.enhanceFlowRun(flow, resolved, stubEnhancer({ ok: true, text: '   ' }).deps);
    assert.strictEqual(empty.ok, false, 'an enhancer that answers nothing is a failure, not a green light');
    assert.strictEqual(empty.code, 'ENHANCE_FAILED');

    const noError = await fe.enhanceFlowRun(flow, resolved, stubEnhancer({ ok: false }).deps);
    assert.strictEqual(noError.code, 'ENHANCE_FAILED');
    assert.match(noError.message, /Remote > Language Models/);
});

test('enhanceFlowRun: a cancelled enhance is CANCELLED, not a failure', async () => {
    const fe = await esm('js/services/flowEnhance.js');
    const { flow } = await song();
    const { deps } = stubEnhancer({ ok: false, cancelled: true, error: 'Enhance cancelled.' });
    const out = await fe.enhanceFlowRun(flow, { inputs: { positive: 'A duet.' }, injectionParams: {} }, deps);
    assert.strictEqual(out.ok, false);
    assert.strictEqual(out.code, 'CANCELLED');
    assert.match(out.message, /Nothing was generated/);
});

test('enhanceFlowRun: a second declaration reads what the first wrote, as on a hand run', async () => {
    const fe = await esm('js/services/flowEnhance.js');
    const flow = {
        id: 'two-pass', title: 'Two pass',
        fields: [
            { id: 'positive', type: 'text', label: 'Brief' },
            // `First` is VISIBLE: a hidden field is never an enhance source (what the user
            // cannot see is not what they are asking for), so a chain has to read a shown one.
            { id: 'Input_First', type: 'text', label: 'First', default: '' },
            { id: 'Input_Second', type: 'text', label: 'Second', default: '', hidden: true },
        ],
        steps: [],
    };
    // Two flow-level declarations can only come from fields, so declare them as auto fields.
    flow.fields.push(
        { id: 'e1', action: 'enhance', auto: true, from: 'positive', to: 'Input_First' },
        { id: 'e2', action: 'enhance', auto: true, from: 'Input_First', to: 'Input_Second' },
    );
    const { calls, deps } = stubEnhancer(n => ({ ok: true, text: `pass ${n}` }));
    const patch = await fe.enhanceFlowRun(flow, { inputs: { positive: 'a brief' }, injectionParams: {} }, deps);
    // One source each, so a lone source is sent verbatim (no label): the second reads the first's text.
    assert.deepStrictEqual(calls.map(c => c.source), ['a brief', 'pass 1']);
    assert.deepStrictEqual(patch.injectionParams, { Input_First: 'pass 1', Input_Second: 'pass 2' });
    assert.deepStrictEqual(patch.inputs, { enhanceWrote: ['Input_First', 'Input_Second'] });
});

test('enhanceFlowRun: a target that is not an Input_ param lands in `inputs`, beside enhanceWrote', async () => {
    const fe = await esm('js/services/flowEnhance.js');
    const flow = {
        id: 'plain-target', title: 'Plain target',
        fields: [{ id: 'positive', type: 'text' }, { id: 'phrase', type: 'text', default: '' },
            { id: 'go', action: 'enhance', auto: true, from: 'positive', to: 'phrase' }],
    };
    const { deps } = stubEnhancer({ ok: true, text: 'a phrase' });
    assert.deepStrictEqual(await fe.enhanceFlowRun(flow, { inputs: { positive: 'x' }, injectionParams: {} }, deps),
        { ok: true, injectionParams: {}, inputs: { phrase: 'a phrase', enhanceWrote: ['phrase'] } });
});

// ── 4. adoptHiddenTargets: an agent-opened Song ──────────────────────────────────────────────
test('adoptHiddenTargets: hidden caption blocks holding text are the enhancer\'s, so a new brief re-enhances them', async () => {
    const { adoptHiddenTargets, flowEnhanceDecls } = await esm('js/services/flowEnhance.js');
    const { flow, pool } = await song();
    const decls = flowEnhanceDecls(flow);

    // Review lyrics then Cue: Cosmo wrote all three (older agent, or the spec not yet fixed).
    const filled = { Input_Mood: 'm', Input_Vocal: 'v', Input_Arrangement: 'a' };
    assert.deepStrictEqual(adoptHiddenTargets(decls, pool, filled, new Set()), ['Input_Mood', 'Input_Vocal', 'Input_Arrangement']);

    // Fabio's run: Mood + Arrangement written, Vocal empty. The two are adopted, the blank is not.
    assert.deepStrictEqual(adoptHiddenTargets(decls, pool, { Input_Mood: 'm', Input_Vocal: '', Input_Arrangement: 'a' }, new Set()),
        ['Input_Mood', 'Input_Arrangement']);

    // Nothing written yet (the normal open): nothing to adopt, the Cue pass runs once and fills all.
    assert.deepStrictEqual(adoptHiddenTargets(decls, pool, { Input_Mood: '', Input_Vocal: '  ' }, new Set()), []);
    assert.deepStrictEqual(adoptHiddenTargets(decls, pool, {}, new Set()), []);

    // Already marked (a Reuse with `enhanceWrote`): not returned again.
    assert.deepStrictEqual(adoptHiddenTargets(decls, pool, filled, new Set(['Input_Mood'])), ['Input_Vocal', 'Input_Arrangement']);
    assert.deepStrictEqual(adoptHiddenTargets(decls, pool, filled, new Set(Object.keys(filled))), []);
});

test('adoptHiddenTargets: only `hidden: true` boxes, and only when EVERY target of the declaration is one', async () => {
    const { adoptHiddenTargets } = await esm('js/services/flowEnhance.js');
    const all = [
        { id: 'positive' },
        { id: 'Input_A', hidden: true }, { id: 'Input_B', hidden: true },
        { id: 'Input_Seen' },
        { id: 'Input_WhenHidden', hiddenWhen: { field: 'positive', is: 'x' } },
    ];
    const values = { Input_A: 'a', Input_B: 'b', Input_Seen: 's', Input_WhenHidden: 'w' };

    // One visible target among hidden ones: that box can be typed in, so ownership is unknowable.
    assert.deepStrictEqual(adoptHiddenTargets([{ from: 'positive', to: { A: 'Input_A', S: 'Input_Seen' } }], all, values), []);
    // `hiddenWhen` hides a box only SOMETIMES, and the user may have typed in it while visible.
    assert.deepStrictEqual(adoptHiddenTargets([{ from: 'positive', to: 'Input_WhenHidden' }], all, values), []);
    // A single hidden string target, and a declared-nowhere target.
    assert.deepStrictEqual(adoptHiddenTargets([{ from: 'positive', to: 'Input_A' }], all, values), ['Input_A']);
    assert.deepStrictEqual(adoptHiddenTargets([{ from: 'positive', to: 'Input_Ghost' }], all, { Input_Ghost: 'g' }), []);
    // Two declarations naming the same hidden box adopt it once.
    assert.deepStrictEqual(adoptHiddenTargets([{ from: 'positive', to: 'Input_A' }, { from: 'Input_B', to: { X: 'Input_A' } }], all, values), ['Input_A']);
    assert.deepStrictEqual(adoptHiddenTargets([], all, values), []);
    assert.deepStrictEqual(adoptHiddenTargets(undefined, undefined, undefined), []);
});

// ── the wiring that the closure cannot be imported to prove ─────────────────────────────────
test('flowEnhance.js is the ONLY Flow-path caller of enhanceFlow', () => {
    const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e =>
        (e.isDirectory() ? walk(path.join(dir, e.name)) : (e.name.endsWith('.js') ? [path.join(dir, e.name)] : [])));
    const callers = walk(repo('js')).filter((file) => {
        if (file.endsWith(`${path.sep}llmService.js`)) return false;
        return fs.readFileSync(file, 'utf8').split('\n')
            .some(line => /\benhanceFlow\(/.test(line) && !/^\s*(\*|\/\/)/.test(line));
    }).map(f => path.relative(repo(''), f).replace(/\\/g, '/'));
    assert.deepStrictEqual(callers, ['js/services/flowEnhance.js'],
        'a second Flow-path call to enhanceFlow is a second place the Remote pick can be forgotten');
});
