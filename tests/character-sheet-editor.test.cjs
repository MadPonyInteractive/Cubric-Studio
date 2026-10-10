/**
 * character-sheet-editor.test.cjs — MPI-1041 Phase B. The Character Sheet Editor Flow:
 *
 *   1. every change builds the template that passed on the bench, word for word
 *      (tasks/MPI-1041/validation.md, research/templates.md) - a rewording is a new bench run;
 *   2. the age is written as WORDS, and a child / teen / adult run of every leg clears the
 *      child-safety gate on both models, while a child age with unclothed or swimwear words is
 *      refused - on LEG 1 already, through `runPrompt` (the gate checks one job at a time);
 *   3. the FlowDef routes each change to its editor, runs the right legs, resolves each leg's
 *      model for its op, and asks for Qwen-Image 2.1 only when the run needs it.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const esm = p => import('file://' + path.join(ROOT, p).replace(/\\/g, '/'));
const builder = () => esm('js/data/flowPrompts/characterSheetEditor.js');
const gate = () => esm('js/data/childSafety.js');

const L1 = ' Make the same change in the close-up portrait on the right. Keep everything else exactly as it is.';

// ── 1. The bench templates ───────────────────────────────────────────────────

test('every change builds its bench template verbatim', async () => {
    const { buildChangePrompt } = await builder();
    assert.strictEqual(buildChangePrompt('clothes', 'a red leather jacket, black jeans and boots'),
        'Dress the character in a red leather jacket, black jeans and boots. Dress the character the same way in the '
        + 'close-up portrait on the right. Keep everything else exactly as it is.');
    assert.strictEqual(buildChangePrompt('accessories', 'a red scarf and round glasses'),
        'Give the character a red scarf and round glasses.' + L1);
    assert.strictEqual(buildChangePrompt('hair', 'a short blonde bob haircut'), 'Give the character a short blonde bob haircut.' + L1);
    assert.strictEqual(buildChangePrompt('condition', 'beaten up after a fight: a bruised, cut face and torn, dirty clothes'),
        'Make the character look beaten up after a fight: a bruised, cut face and torn, dirty clothes.' + L1);
    assert.strictEqual(buildChangePrompt('body', 'heavyset and overweight'), "Make the character's body heavyset and overweight." + L1);
    // The user's own full stop is not doubled; no words, no prompt.
    assert.strictEqual(buildChangePrompt('hair', '  a buzz cut. '), 'Give the character a buzz cut.' + L1);
    assert.strictEqual(buildChangePrompt('clothes', '   '), null);
    assert.strictEqual(buildChangePrompt('none', 'anything'), null);
});

test('the age template: child, teen, younger and older adult, by the describer\'s read', async () => {
    const { buildAgePrompt, parseApparentAge } = await builder();
    const C = 'Change the character in this character sheet to be a younger version of themselves as a ';
    assert.strictEqual(buildAgePrompt(10, 42),
        C + "10-year-old child, with a child's smooth face, no beard and no wrinkles, wearing the same clothes." + L1);
    assert.strictEqual(buildAgePrompt(15, 42),
        C + "15-year-old, with a teenager's smooth face, no beard and no wrinkles, the same hairstyle and hair color, "
        + 'wearing the same clothes.' + L1);
    assert.strictEqual(buildAgePrompt(30, 68), C + '30-year-old, with a younger face, smooth skin and no grey hair.' + L1);
    assert.strictEqual(buildAgePrompt(70, 42),
        'Change the character in this character sheet to be an older version of themselves as a 70-year-old.' + L1);
    // No read: a typical adult (35), so 60 is older and 25 younger.
    assert.match(buildAgePrompt(60, NaN), /an older version of themselves as a 60-year-old\./);
    assert.match(buildAgePrompt(25, NaN), /a younger version of themselves as a 25-year-old,/);
    assert.strictEqual(parseApparentAge('About 40.'), 40);
    assert.ok(Number.isNaN(parseApparentAge('')));
});

test('a child\'s bodies are rebuilt with batch 17\'s words and the sheet\'s clothes', async () => {
    const { buildRebuildPrompt, characterSheetEditor } = await builder();
    const caption = 'Wearing an olive green utility-style jacket over a mustard yellow ribbed sweater, paired with matching olive green trousers and brown leather shoes.';
    assert.strictEqual(buildRebuildPrompt(10, caption),
        "A 10-year-old child with a child's height and body proportions: a short, small body with shorter arms and legs, "
        + 'a shorter torso and a larger head for the body. ' + caption);
    // A Clothes change replaces the described clothes with the user's words.
    const built = characterSheetEditor('rebuild', { change: 'clothes', words: 'a navy wool coat', Input_Age: 8, sheetClothes: caption });
    assert.match(built.positive, /^A 8-year-old child .* Wearing a navy wool coat\.$/);
});

test('a run with no words for its change, or nothing to change, is refused', async () => {
    const { characterSheetEditorRefusal: refuse } = await builder();
    assert.ok(refuse({ change: 'clothes', words: '' }));
    assert.ok(refuse({ change: 'none', Input_Age: 0 }));
    assert.strictEqual(refuse({ change: 'none', Input_Age: 30 }), null);
    assert.strictEqual(refuse({ change: 'hair', words: 'a bob', Input_Age: 0 }), null);
});

test('each leg carries its lock and the whole run in runPrompt', async () => {
    const { characterSheetEditor } = await builder();
    const values = { change: 'clothes', words: 'a tweed suit', Input_Age: 10, sheetAge: '40', sheetClothes: 'Wearing a coat.' };
    const change = characterSheetEditor('change', values);
    assert.strictEqual(change.injectionParams.Input_Lock, 1);
    assert.strictEqual(characterSheetEditor('change', { ...values, change: 'hair' }).injectionParams.Input_Lock, 2);
    assert.strictEqual(characterSheetEditor('change', { ...values, change: 'accessories' }).injectionParams.Input_Lock, 0);
    assert.strictEqual(characterSheetEditor('age', values).injectionParams.Input_Lock, 0);
    assert.ok(!('Input_Lock' in characterSheetEditor('rebuild', values).injectionParams));
    const lines = change.injectionParams.runPrompt.split('\n');
    assert.deepStrictEqual(lines.map(l => l.slice(0, 12)), ['Dress the ch', 'Change the c', 'A 10-year-ol']);
    assert.strictEqual(characterSheetEditor('change', { ...values, Input_Age: 30 }).injectionParams.runPrompt.split('\n').length, 2);
});

// ── 2. The child-safety gate ─────────────────────────────────────────────────

/** The configs a whole run would queue: one per leg, as flowService builds them. */
async function runConfigs(values) {
    const { characterSheetEditor } = await builder();
    const age = values.Input_Age || 0;
    const parts = [values.change !== 'none' && 'change', age > 0 && 'age', age > 0 && age <= 12 && 'rebuild'].filter(Boolean);
    return parts.map((part) => {
        const built = characterSheetEditor(part, values);
        return { positive: built.positive, injectionParams: { ...values, ...built.injectionParams } };
    });
}

const verdicts = async (values, modelId) => {
    const { checkChildSafety, configTexts } = await gate();
    return (await runConfigs(values)).map(c => checkChildSafety(configTexts(c), { modelId }));
};

const CAPTION = 'Wearing a mustard-yellow double-breasted suit with matching trousers, brown leather shoes, and a red ribbed knit beanie.';

test('child, teen and adult runs of every change clear the gate on both models', async () => {
    for (const modelId of ['klein-9b', 'qwen-image-2-1']) {
        for (const age of [1, 2, 5, 10, 12, 13, 15, 17, 18, 30, 60, 90]) {
            for (const [change, words] of [['clothes', 'a navy wool coat, jeans and boots'], ['accessories', 'round glasses'],
                ['hair', 'a short bob'], ['condition', 'muddy and soaked'], ['body', 'heavyset'], ['none', '']]) {
                const v = await verdicts({ change, words, Input_Age: age, sheetAge: '40', sheetClothes: CAPTION }, modelId);
                for (const r of v) assert.strictEqual(r.verdict, 'ok', `${modelId} ${change} age ${age}: ${r.reason}`);
            }
        }
    }
});

test('a child age with unclothed or swimwear words is refused on the FIRST leg', async () => {
    for (const modelId of ['klein-9b', 'qwen-image-2-1']) {
        for (const words of ['a red swimsuit', 'a bikini', 'a sports bra and shorts', 'no clothing', 'underwear']) {
            const [first] = await verdicts({ change: 'clothes', words, Input_Age: 10, sheetAge: '40', sheetClothes: CAPTION }, modelId);
            assert.strictEqual(first.verdict, 'refuse', `${modelId} "${words}" at 10`);
        }
        // It is runPrompt that refuses leg 1: its own words name no age.
        const { checkChildSafety, configTexts } = await gate();
        const [leg1] = await runConfigs({ change: 'clothes', words: 'a bikini', Input_Age: 10, sheetAge: '40' });
        delete leg1.injectionParams.runPrompt;
        assert.strictEqual(checkChildSafety(configTexts(leg1), { modelId }).verdict, 'ok');
        // The describer's caption of the sheet counts too: a child rebuilt from a sheet in swimwear.
        const v = await verdicts({ change: 'none', Input_Age: 8, sheetAge: '30', sheetClothes: 'Wearing a red swimsuit.' }, modelId);
        assert.ok(v.every(r => r.verdict === 'refuse'), `${modelId}: swimwear caption at 8`);
    }
});

test('16-17: the gate rule in force - ordinary swimwear passes, revealing swimwear does not', async () => {
    // docs/child-safety.md (Fabio 2026-10-10): 16 or 17, ordinary swimwear anywhere, a sheet included.
    const ok = await verdicts({ change: 'clothes', words: 'a blue one-piece swimsuit', Input_Age: 17, sheetAge: '25' }, 'klein-9b');
    assert.ok(ok.every(r => r.verdict === 'ok'), JSON.stringify(ok));
    const no = await verdicts({ change: 'clothes', words: 'a micro bikini', Input_Age: 17, sheetAge: '25' }, 'klein-9b');
    assert.strictEqual(no[0].verdict, 'refuse');
});

test('runPrompt reaches the gate: configTexts does not skip it', async () => {
    const { configTexts } = await gate();
    const [config] = await runConfigs({ change: 'hair', words: 'a bob', Input_Age: 30, sheetAge: '40' });
    assert.ok(configTexts(config).includes(config.injectionParams.runPrompt));
});

// ── 3. The FlowDef ───────────────────────────────────────────────────────────

const registry = () => esm('js/data/flowsRegistry.js');
const stage = async (installed) => {
    const { state } = await esm('js/state.js');
    state.s_installedModelIds = installed;
};
const run = (change, age, headless = true) => ({ change, words: 'x', injectionParams: { Input_Age: age, Input_Remove_Head: headless } });

test('each change routes to its editor and the age picks the legs', async () => {
    const { getFlowById, flowOperation, flowRunLegs } = await registry();
    const flow = getFlowById('character-sheet-editor');
    assert.ok(flow, 'the Flow is registered');
    for (const c of ['clothes', 'accessories', 'hair', 'condition']) assert.strictEqual(flowOperation(flow, run(c, 0)), 'flowCharacterSheetEdit');
    assert.strictEqual(flowOperation(flow, run('body', 0)), 'flowCharacterSheetEditQwen');
    assert.strictEqual(flowOperation(flow, run('none', 30)), null);
    const ops = r => flowRunLegs(flow, r).map(l => l.operation);
    assert.deepStrictEqual(ops(run('clothes', 0)), ['flowCharacterSheetEdit', 'flowCharacterSheetHeadless']);
    assert.deepStrictEqual(ops(run('clothes', 0, false)), ['flowCharacterSheetEdit']);
    assert.deepStrictEqual(ops(run('body', 30)), ['flowCharacterSheetEditQwen', 'flowCharacterSheetEdit', 'flowCharacterSheetHeadless']);
    assert.deepStrictEqual(ops(run('none', 10)), ['flowCharacterSheetEdit', 'flowCharacterSheetImages', 'flowCharacterSheetHeadless']);
    assert.deepStrictEqual(ops(run('none', 13)), ['flowCharacterSheetEdit', 'flowCharacterSheetHeadless']);
    // Leg 1 (the change) defaults to Clothes when the run names none.
    assert.strictEqual(flowOperation(flow, { injectionParams: {} }), 'flowCharacterSheetEdit');
});

test('each leg runs its own model, and Qwen-Image 2.1 is asked for only when the run needs it', async () => {
    const { getFlowById, flowModelIds, flowRunAvailability, flowAvailability } = await registry();
    const flow = getFlowById('character-sheet-editor');
    await stage(['klein-9b']);
    assert.deepStrictEqual(flowModelIds(flow, { op: 'flowCharacterSheetEdit' }), ['klein-9b', null]);
    assert.deepStrictEqual(flowModelIds(flow, { op: 'flowCharacterSheetImages' }), [null, 'qwen-image-2-1']);
    assert.deepStrictEqual(flowModelIds(flow, { op: 'flowCharacterSheetEditQwen' }), [null, 'qwen-image-2-1']);
    assert.strictEqual(flowAvailability(flow).available, true, 'Klein alone makes the Flow available');
    assert.strictEqual(flowRunAvailability(flow, run('clothes', 30)).available, true);
    assert.deepStrictEqual(flowRunAvailability(flow, run('body', 0)).missing, ['qwen-image-2-1']);
    assert.deepStrictEqual(flowRunAvailability(flow, run('none', 10)).missing, ['qwen-image-2-1']);
    await stage(['klein-9b', 'qwen-image-2-1']);
    assert.strictEqual(flowRunAvailability(flow, run('body', 10)).available, true);
    await stage([]);
    assert.strictEqual(flowAvailability(flow).available, false);
});

test('every op the Flow dispatches takes the sheet on image1', async () => {
    const { getFlowById, flowOperations } = await registry();
    const { getCommand } = await esm('js/data/commandRegistry.js');
    const flow = getFlowById('character-sheet-editor');
    for (const op of flowOperations(flow)) {
        const keys = (getCommand(op)?.mediaInputs || []).map(m => m.key);
        assert.ok(keys.includes('image1'), `${op} takes image1`);
    }
});
