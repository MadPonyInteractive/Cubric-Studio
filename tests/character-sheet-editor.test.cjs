/**
 * character-sheet-editor.test.cjs — MPI-1041 Phase B. The Character Sheet Editor Flow:
 *
 *   1. every change builds the template that passed on the bench, word for word
 *      (tasks/MPI-1041/validation.md, research/templates.md) - a rewording is a new bench run;
 *   2. the age is written as WORDS, and a child / teen / adult run of every leg clears the
 *      child-safety gate on both models, while a child age with unclothed or swimwear words is
 *      refused - on LEG 1 already, through `runPrompt` (the gate checks one job at a time);
 *   3. the FlowDef routes each change to its editor, runs the right legs, resolves each leg's
 *      model for its op, and asks for Qwen-Image 2.1 only when the run needs it;
 *   4. (Phase C) the picture check the gate cannot make - an undressed sheet made a minor -
 *      refuses with ONE code and message on the hand, agent and routine paths; the result card
 *      is named after the input.
 */

'use strict';

// Must exist BEFORE llmService loads (section 4 reaches the describer): its preferences read it.
const _ls = {};
global.localStorage = {
    getItem: k => (Object.prototype.hasOwnProperty.call(_ls, k) ? _ls[k] : null),
    setItem: (k, v) => { _ls[k] = String(v); },
    removeItem: (k) => { delete _ls[k]; },
};

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
        'Dress the character in a red leather jacket, black jeans and boots. The front view, the back view and the '
        + 'close-up portrait on the right all show the same outfit, with the same neckline, sleeves and straps. '
        + 'Keep everything else exactly as it is.');
    assert.strictEqual(buildChangePrompt('accessories', 'a red scarf and round glasses'),
        'Give the character a red scarf and round glasses. Make the same change on the character seen from behind and in '
        + 'the close-up portrait on the right. Keep everything else exactly as it is.');
    const HAT = ', with the head uncovered and no hat, so the new hair shows.';
    assert.strictEqual(buildChangePrompt('hair', 'a short blonde bob haircut'), 'Give the character a short blonde bob haircut' + HAT + L1);
    assert.strictEqual(buildChangePrompt('condition', 'beaten up after a fight: a bruised, cut face and torn, dirty clothes'),
        'Make the character look beaten up after a fight: a bruised, cut face and torn, dirty clothes.' + L1);
    assert.strictEqual(buildChangePrompt('body', 'heavyset and overweight'), "Make the character's body heavyset and overweight." + L1);
    // The user's own full stop is not doubled; no words, no prompt.
    assert.strictEqual(buildChangePrompt('hair', '  a buzz cut. '), 'Give the character a buzz cut' + HAT + L1);
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
    // Phase E: an old sheet read older than an old target keeps its grey hair and beard; F1: near the read
    // (within 15) no direction word, or the beard goes. Further off, the younger wording stays.
    assert.strictEqual(buildAgePrompt(70, 82), 'Change the character in this character sheet to be a 70-year-old.' + L1);
    assert.strictEqual(buildAgePrompt(45, 82), C + '45-year-old, with a younger face.' + L1);
    assert.strictEqual(buildAgePrompt(35, 45), C + '35-year-old, with a younger face, smooth skin and no grey hair.' + L1);
    assert.strictEqual(buildAgePrompt(70, 42),
        'Change the character in this character sheet to be an older version of themselves as a 70-year-old.' + L1);
    // No read: a typical adult (35), so 60 is older and 25 younger.
    assert.match(buildAgePrompt(60, NaN), /an older version of themselves as a 60-year-old\./);
    assert.match(buildAgePrompt(25, NaN), /a younger version of themselves as a 25-year-old,/);
    // Batch 21: a newborn is swaddled; a 1-year-old keeps the hair.
    assert.strictEqual(buildAgePrompt(0, 40), C.slice(0, -2) + "a newborn baby a few weeks old, with a baby's round face, "
        + 'smooth skin and very little hair, swaddled in a soft cream knit blanket so only the face shows.' + L1);
    assert.strictEqual(buildAgePrompt(1, 40), C + "1-year-old child, with a child's smooth face, no beard and no wrinkles, "
        + 'the same hairstyle and hair color, wearing the same clothes.' + L1);
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
    // A newborn is swaddled: no caption, or the bodies come back dressed (batch 21).
    assert.strictEqual(buildRebuildPrompt(0, caption), 'A newborn baby a few weeks old, swaddled snugly in a soft cream '
        + 'knit blanket so only its face shows, lying on its back. It is too small to stand.');
    assert.strictEqual(buildRebuildPrompt(1, caption), "A 1-year-old toddler taking its first steps, with a toddler's body "
        + 'proportions: a short, chubby body with short chubby arms and legs and a large head for the body. ' + caption);
});

test('a run with no words for its change, or nothing to change, is refused', async () => {
    const { characterSheetEditorRefusal: refuse } = await builder();
    assert.ok(refuse({ change: 'clothes', words: '' }));
    assert.ok(refuse({ change: 'none', Input_Age: -1 }));
    assert.ok(refuse({ change: 'none' }), 'no age at all is keep, never a newborn');
    assert.ok(refuse({ change: 'none', Input_Age: null }));
    assert.strictEqual(refuse({ change: 'none', Input_Age: 0 }), null, '0 is a newborn: a change');
    assert.strictEqual(refuse({ change: 'none', Input_Age: 30 }), null);
    assert.strictEqual(refuse({ change: 'hair', words: 'a bob', Input_Age: -1 }), null);
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

test('F2: an optional Reference picture replaces or joins the words, Clothes only, on the change leg only', async () => {
    const { characterSheetEditor, characterSheetEditorRefusal: refuse, characterSheetEditorCardName: name, buildChangePrompt } = await builder();
    const REF = { role: 'image2', mediaType: 'image', url: '/project-file?path=C%3A%2Fp%2FMedia%2Fdress.png' };
    const run = (change, words, age = -1) => ({ change, words, Input_Age: age, mediaItems: [{ role: 'image1', url: 'x' }, REF] });
    // The F2 bench strings (validation.md): round 1's shape, only the close-up named - naming the back view
    // with a reference drew the reference person as an extra figure (round 2). The old clothes are taken off
    // in words (rounds 4-7: a bikini kept the jeans); "everything else" only with no words, since with words
    // it stripped what they left out (a jacket + scarf cut the trousers to shorts).
    const TAIL = ' Dress the character the same way in the close-up portrait on the right, with the same neckline and '
        + 'straps. Keep everything else exactly as it is.';
    assert.strictEqual(buildChangePrompt('clothes', '', true), 'Dress the character in only the outfit from the reference '
        + 'picture. Take off everything else the character wears now, trousers, skirt and top included.' + TAIL);
    assert.strictEqual(buildChangePrompt('clothes', 'the green jacket.', true),
        'Dress the character in the outfit from the reference picture: the green jacket, replacing all of the clothes '
        + 'the character wears now, top and bottom.' + TAIL);
    assert.doesNotMatch(buildChangePrompt('clothes', 'the green jacket', true), /everything else the character/);
    assert.doesNotMatch(buildChangePrompt('clothes', '', true), /back view|behind/);
    // Accessories and Hairstyle ignore the picture: from one, a hat or a hairstyle reached every panel 1 time in 8.
    assert.strictEqual(buildChangePrompt('accessories', '', true), null);
    assert.strictEqual(buildChangePrompt('accessories', 'a red scarf', true), buildChangePrompt('accessories', 'a red scarf'));
    assert.strictEqual(buildChangePrompt('hair', '', true), null);
    assert.strictEqual(buildChangePrompt('condition', '', true), null, 'Condition never takes a reference');
    // Wanted only by the change leg of a change that takes one: an age leg that starts the run is handed it too.
    assert.strictEqual(characterSheetEditor('change', run('clothes', '')).injectionParams.Input_Reference, true);
    assert.strictEqual(characterSheetEditor('change', run('condition', 'muddy')).injectionParams.Input_Reference, false);
    assert.strictEqual(characterSheetEditor('change', run('hair', 'a bob')).injectionParams.Input_Reference, false);
    assert.strictEqual(characterSheetEditor('age', run('none', '', 60)).injectionParams.Input_Reference, false);
    assert.strictEqual(characterSheetEditor('change', { change: 'clothes', words: 'a suit' }).injectionParams.Input_Reference, false);
    // Words OR a reference; never a reference under 18 (the gate reads words only).
    assert.strictEqual(refuse(run('clothes', '')), null);
    assert.strictEqual(refuse({ change: 'clothes', words: '' }), 'Say what to change, or add a Reference picture.');
    assert.strictEqual(refuse({ change: 'condition', words: '', mediaItems: [REF] }), 'Say what to change first.');
    assert.strictEqual(refuse({ change: 'hair', words: '', mediaItems: [REF] }), 'Say what to change first.');
    assert.match(refuse(run('clothes', '', 10)), /cannot be used with an age under 18/);
    assert.match(refuse(run('clothes', 'a suit', 17)), /under 18/);
    assert.strictEqual(refuse(run('hair', 'a bob', 17)), null, 'Hairstyle ignores the reference, so it is not refused for it');
    assert.strictEqual(refuse(run('clothes', '', 18)), null);
    assert.strictEqual(refuse(run('condition', 'muddy', 10)), null, 'a change that ignores the reference is not refused for it');
    assert.strictEqual(name(run('clothes', ''), 'Ava'), 'Ava - outfit from a reference');
    assert.strictEqual(name(run('hair', 'a pixie cut', 30), 'Ava'), 'Ava - a pixie cut, age 30');
});

// ── 2. The child-safety gate ─────────────────────────────────────────────────

/** The configs a whole run would queue: one per leg, as flowService builds them. */
async function runConfigs(values) {
    const { characterSheetEditor } = await builder();
    const age = values.Input_Age ?? -1;
    const parts = [values.change !== 'none' && 'change', age >= 0 && 'age', age >= 0 && age <= 12 && 'rebuild'].filter(Boolean);
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
        for (const age of [0, 1, 2, 5, 10, 12, 13, 15, 17, 18, 30, 60, 90]) {
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
    const { getFlowById, flowOperation, flowRunLegs, flowToggleLeg } = await registry();
    const flow = getFlowById('character-sheet-editor');
    assert.ok(flow, 'the Flow is registered');
    for (const c of ['clothes', 'accessories', 'hair', 'condition']) assert.strictEqual(flowOperation(flow, run(c, -1)), 'flowCharacterSheetEdit');
    assert.strictEqual(flowOperation(flow, run('body', -1)), 'flowCharacterSheetEditQwen');
    assert.strictEqual(flowOperation(flow, run('none', 30)), null);
    const ops = r => flowRunLegs(flow, r).map(l => l.operation);
    assert.deepStrictEqual(ops(run('clothes', -1)), ['flowCharacterSheetEdit', 'flowCharacterSheetHeadless']);
    assert.deepStrictEqual(ops(run('clothes', -1, false)), ['flowCharacterSheetEdit']);
    assert.deepStrictEqual(ops(run('body', 30)), ['flowCharacterSheetEditQwen', 'flowCharacterSheetEdit', 'flowCharacterSheetHeadless']);
    assert.deepStrictEqual(ops(run('none', 10)), ['flowCharacterSheetEdit', 'flowCharacterSheetImages', 'flowCharacterSheetHeadless']);
    assert.deepStrictEqual(ops(run('none', 1)), ['flowCharacterSheetEdit', 'flowCharacterSheetImages', 'flowCharacterSheetHeadless']);
    // A newborn is swaddled and lying down: its head stays, whatever the toggle says.
    assert.deepStrictEqual(ops(run('none', 0)), ['flowCharacterSheetEdit', 'flowCharacterSheetImages']);
    assert.strictEqual(flowToggleLeg(flow), 2, 'the head leg keeps its result-pane toggle');
    assert.deepStrictEqual(ops(run('clothes', undefined)), ['flowCharacterSheetEdit', 'flowCharacterSheetHeadless'], 'no age = keep');
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
    assert.deepStrictEqual(flowRunAvailability(flow, run('body', -1)).missing, ['qwen-image-2-1']);
    assert.deepStrictEqual(flowRunAvailability(flow, run('none', 10)).missing, ['qwen-image-2-1']);
    await stage(['klein-9b', 'qwen-image-2-1']);
    assert.strictEqual(flowRunAvailability(flow, run('body', 10)).available, true);
    await stage([]);
    assert.strictEqual(flowAvailability(flow).available, false);
});

test('each leg takes the rack of the model it runs, into nodes its graph carries', async () => {
    const { getFlowById, flowModelIds, flowLoraPhases } = await registry();
    const flow = getFlowById('character-sheet-editor');
    await stage(['klein-9b', 'qwen-image-2-1']);
    // flowService's filter: only the phases whose slot THIS op runs.
    const phasesFor = op => flowLoraPhases(flow).filter(({ phase }) => flowModelIds(flow, { op })[phase - 1]);
    const titles = file => JSON.stringify(require(path.join(ROOT, 'comfy_workflows', file)));
    assert.deepStrictEqual(phasesFor('flowCharacterSheetEdit'), [{ phase: 1, modelId: 'klein-9b' }]);
    assert.deepStrictEqual(phasesFor('flowCharacterSheetEditQwen'), [{ phase: 2, modelId: 'qwen-image-2-1' }]);
    assert.match(titles('flow_character_sheet_edit.json'), /Input_Lora_Phase1_6/);
    assert.match(titles('flow_character_sheet_edit_qwen.json'), /Input_Lora_Phase2_6/);
    // The rebuild leg's graph is titled phase 1 for its own Flow: no Klein rack can land in it.
    assert.deepStrictEqual(phasesFor('flowCharacterSheetImages'), [{ phase: 2, modelId: 'qwen-image-2-1' }]);
    assert.doesNotMatch(titles('flow_character_sheet_from_images.json'), /Input_Lora_Phase2_/);
    await stage([]);
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

// ── 4. The picture checks and the card name (Phase C) ──────────────────────────

const SHEET = { role: 'image1', mediaType: 'image', url: '/project-file?path=C%3A%2Fp%2FMedia%2Fsheet.png' };
const editor = async () => (await registry()).getFlowById('character-sheet-editor');
const values = async (change, words, age) => (await registry()).flowRunValues(await editor(),
    { change, words, injectionParams: { Input_Age: age } });
/** What a run asks, in order: a check by its passing answer, a target by its id. */
const asked = async (change, words, age) => (await esm('js/services/flowEnhance.js'))
    .describeAsks(await editor(), await values(change, words, age), [SHEET]).map(d => d.to || d.refuseUnless);
const CODE = 'CHILD_SAFETY';
const DRESS_FIRST = /^Dress the sheet first: pick Clothes/;

const C4 = ['CLOTHES', 'CLOTHES', 'CLOTHES', 'CLOTHES'];

test('the picture checks run only when they can matter, and before any other question', async () => {
    // Under 18 the sheet must show ordinary clothes; never when the change itself dresses it.
    assert.deepStrictEqual(await asked('condition', 'muddy', 10), [...C4, 'sheetAge', 'sheetClothes']);
    assert.deepStrictEqual(await asked('none', '', 0), [...C4, 'sheetAge'], 'a newborn is a child age; swaddled, it needs no caption');
    assert.deepStrictEqual(await asked('hair', 'a bob', 15), [...C4, 'sheetAge']);
    assert.deepStrictEqual(await asked('hair', 'a bob', 16), [...C4, 'sheetAge']);
    assert.deepStrictEqual(await asked('none', '', 17), [...C4, 'sheetAge']);
    assert.deepStrictEqual(await asked('clothes', 'a navy coat', 10), ['sheetAge'], 'Clothes dresses it; its words are the caption');
    assert.deepStrictEqual(await asked('hair', 'a bob', 18), ['sheetAge']);
    assert.deepStrictEqual(await asked('clothes', 'a red jacket', -1), [], 'an ordinary change asks nothing');
    // How old the sheet LOOKS is the child-safety gate's call, never this Flow's (Fabio, 2026-10-10).
    assert.deepStrictEqual(await asked('clothes', 'a red bikini', -1), []);
});

test('the checks ask the upper and lower body of the front and the back view, never the whole sheet', async () => {
    // Asked of the whole sheet, the default describer cleared a bikini, lingerie and a nude sheet
    // (Phase E round 1); per view and per half it read 9 of 10 test sheets (round 3).
    const checks = (await editor()).describe.filter(d => !d.to);
    assert.deepStrictEqual(checks.map(d => [d.region.x, d.region.width, /upper/.test(d.ask) ? 'upper' : 'lower']), [
        [0, 0.25, 'upper'], [0.25, 0.25, 'upper'], [0, 0.25, 'lower'], [0.25, 0.25, 'lower'],
    ]);
    for (const d of checks) assert.ok(d.region.y === 0 && d.region.height === 1 && d.code === CODE && d.refuseUnless === 'CLOTHES');
});

test('describeFlowRun: any view or half not in ordinary clothes refuses before anything else is asked', async () => {
    const fe = await esm('js/services/flowEnhance.js');
    const flow = await editor();
    const realWarn = console.warn;
    console.warn = () => {};
    try {
        // `bad` = the one check (by index) that sees something other than clothes, answering `answer`.
        const go = async (age, bad, answer) => {
            const asked = [];
            const boxCrop = async (url, box) => `${url}#${box.x}`;
            const describe = async ({ question, imagePath }) => {
                const i = asked.length;
                asked.push([imagePath, question]);
                if (/What covers/.test(question)) return { ok: true, via: 'endpoint', text: i === bad ? answer : 'CLOTHES' };
                return { ok: true, via: 'endpoint', text: /How old/.test(question) ? '40' : 'Wearing a coat.' };
            };
            const res = await fe.describeFlowRun(flow, { injectionParams: await values('condition', 'muddy', age), mediaItems: [SHEET] },
                { folderPath: 'C:/p' }, { describe, boxCrop });
            return { res, asked };
        };
        for (const [age, bad, answer] of [[10, 0, 'SWIMWEAR'], [10, 3, 'UNDERWEAR'], [12, 1, 'NOTHING'], [17, 2, 'SWIMWEAR'],
            [16, 3, 'I cannot tell.'], [15, 0, 'Clothes and a bikini']]) {
            const { res, asked } = await go(age, bad, answer);
            assert.deepStrictEqual([res.ok, res.code], [false, CODE], `${age} ${bad} ${answer}`);
            assert.match(res.message, DRESS_FIRST);
            assert.strictEqual(asked.length, bad + 1, 'nothing else is asked once a check refuses');
        }
        const ok = await go(10, -1, '');
        assert.deepStrictEqual(ok.res, { ok: true, injectionParams: { sheetAge: '40', sheetClothes: 'Wearing a coat.' } });
        // Each check reads its own view, a crop of the sheet, never the sheet itself.
        assert.deepStrictEqual(ok.asked.slice(0, 4).map(([path]) => path.split('#')[1]), ['0', '0.25', '0', '0.25']);
        assert.ok(ok.asked.slice(4).every(([path]) => path === SHEET.url), 'the age and the caption read the whole sheet');
    } finally {
        console.warn = realWarn;
    }
});

test('the hand, agent and routine runs refuse with the same code and message', async () => {
    const flow = await editor();
    const { state } = await esm('js/state.js');
    const { Events } = await esm('js/events.js');
    const svc = await esm('js/services/llmService.js');
    const { submitFlowGeneration } = await esm('js/services/flowService.js');
    const project = { id: 'p1', name: 'P', folderPath: 'C:/p', itemGroups: [] };
    state.s_installedModelIds = ['klein-9b', 'qwen-image-2-1'];
    state.currentProject = project;

    const realFetch = global.fetch;
    const realWarn = console.warn;
    const reports = new Map();
    global.fetch = async (url, init) => {
        const body = init?.body ? JSON.parse(init.body) : {};
        if (url === '/llm/describe') {
            return { ok: true, json: async () => ({ ok: true, model: 'vl', text: /What covers/.test(body.question) ? 'UNDERWEAR' : '40' }) };
        }
        if (/place-preview-asset/.test(url)) return { ok: true, json: async () => ({ success: true, filePath: 'C:/p/view.png' }) };
        const job = /^\/connector\/jobs\/([^/]+)\/result$/.exec(url);
        if (job) reports.get(job[1])?.(body);
        return { ok: true, json: async () => ({ ok: true }) };
    };
    svc.setDescribeBackendPreference('endpoint');
    // The checks crop each view in the renderer (flowEnhance stageBoxCrop): a picture and a canvas.
    global.Image = class { set src(_) { this.naturalWidth = 1792; this.naturalHeight = 1120; setTimeout(() => this.onload()); } };
    const drawn = [];
    global.document = { addEventListener() {}, removeEventListener() {},
        createElement: () => ({ getContext: () => ({ drawImage: (img, ...box) => drawn.push(box.slice(0, 4)) }), toDataURL: () => 'data:image/png;base64,AA' }) };
    console.warn = () => {};
    const warnings = [];
    const off = Events.on('ui:warning', ({ message }) => warnings.push(message));
    try {
        // Hand: the Flow pane submits the run itself.
        const hand = await new Promise((resolve) => {
            submitFlowGeneration(flow, {
                change: 'condition', words: 'muddy', mediaItems: [SHEET],
                injectionParams: { Input_Age: 10, Input_Remove_Head: true },
            }, { onError: err => resolve({ code: err.code, message: err.userMessage }), onComplete: () => resolve('ran') });
        });
        assert.strictEqual(hand.code, CODE);
        assert.match(hand.message, DRESS_FIRST);
        assert.deepStrictEqual(warnings, [hand.message], 'the hand run is told on a toast');
        assert.deepStrictEqual(drawn[0], [0, 0, 448, 1120], 'the first check reads the front view, a quarter of the sheet');

        // Routine: a Flow step on a card.
        const { routineDeps } = await esm('js/shell/routineDispatch.js');
        const step = { flowId: flow.id, fields: { change: 'condition', words: 'muddy', Input_Age: 10 } };
        const queued = await routineDeps.submit(step, { url: SHEET.url }, {}, project);
        assert.strictEqual(queued.ok, true, queued.message);
        const routine = await queued.done;
        assert.deepStrictEqual({ code: routine.code, message: routine.message }, hand);

        // Agent: a generation.submit job off the connector stream.
        let stream = null;
        global.EventSource = class { constructor() { stream = this; } addEventListener(t, fn) { this[t] = fn; } };
        global.document = global.document || { addEventListener() {}, removeEventListener() {} };
        global.window = global.window || { addEventListener() {}, removeEventListener() {} };
        const { initAgentDispatch } = await esm('js/shell/agentDispatch.js');
        initAgentDispatch();
        const agent = await new Promise((resolve) => {
            reports.set('j1', resolve);
            stream.job({ data: JSON.stringify({ jobId: 'j1', capability: 'generation.submit',
                input: { flowId: flow.id, fields: step.fields, media: [{ role: 'image1', url: SHEET.url }] } }) });
        });
        assert.strictEqual(agent.ok, false);
        assert.deepStrictEqual(agent.error, hand);

        // The agent's own refusal sees its Reference picture (it was asked without the media once).
        const ref = await new Promise((resolve) => {
            reports.set('j2', resolve);
            stream.job({ data: JSON.stringify({ jobId: 'j2', capability: 'generation.submit',
                input: { flowId: flow.id, fields: { change: 'clothes', words: '', Input_Age: 10 },
                    media: [{ role: 'image1', url: SHEET.url }, { role: 'image2', url: SHEET.url.replace('sheet', 'dress') }] } }) });
        });
        assert.strictEqual(ref.ok, false);
        assert.match(ref.error.message, /A Reference picture cannot be used with an age under 18/);
    } finally {
        off();
        svc.setDescribeBackendPreference(null);
        global.fetch = realFetch;
        console.warn = realWarn;
    }
});

test('the result card is named after the card it edits and the change', async () => {
    const { characterSheetEditorCardName: name } = await builder();
    assert.strictEqual(name({ change: 'condition', words: ' beaten up. ', Input_Age: -1 }, 'John'), 'John - beaten up');
    assert.strictEqual(name({ change: 'none', words: 'ignored', Input_Age: 30 }, 'John'), 'John - age 30');
    assert.strictEqual(name({ change: 'clothes', words: 'a red coat', Input_Age: 10 }, 'John'), 'John - a red coat, age 10');
    assert.strictEqual(name({ change: 'none', Input_Age: 0 }, 'John'), 'John - newborn');
    assert.strictEqual(name({ change: 'none', Input_Age: 1 }, 'John'), 'John - age 1');
    assert.strictEqual(name({ change: 'hair', words: 'a bob', Input_Age: -1 }, null), 'Character sheet - a bob', 'a file from outside the project');

    const { sourceCardName } = await esm('js/services/flowService.js');
    const project = { itemGroups: [
        { name: 'i2i_004', customName: null, history: [{ filePath: 'C:\\p\\Media\\other.png' }] },
        { name: 'flow_002', customName: 'John', history: [{ filePath: 'C:\\p\\Media\\old.png' }, { filePath: 'C:\\p\\Media\\sheet.png' }] },
    ] };
    assert.strictEqual(sourceCardName(SHEET, project), 'John', 'any version of the card, by its file');
    assert.strictEqual(sourceCardName({ url: 'C:/p/Media/other.png' }, project), 'i2i_004', 'no custom name: the derived one');
    assert.strictEqual(sourceCardName({ url: 'D:/elsewhere/x.png' }, project), null);
    assert.strictEqual(sourceCardName({ url: 'D:/elsewhere/x.png', name: 'Picked' }, project), 'Picked');

    // Wired through: the first leg's queue opts carry it, and the gallery card takes it as its customName.
    const fs = require('node:fs');
    const flowSrc = fs.readFileSync(path.join(ROOT, 'js/services/flowService.js'), 'utf8');
    assert.match(flowSrc, /if \(builder\?\.cardName && !later\) \{\s*opts\.cardName = builder\.cardName\(/);
    const genSrc = fs.readFileSync(path.join(ROOT, 'js/services/generationService.js'), 'utf8');
    assert.match(genSrc, /\.\.\.\(opts\.cardName \? \{ customName: opts\.cardName \} : \{\}\)/);
});
