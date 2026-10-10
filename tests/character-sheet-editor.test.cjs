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

test('the picture checks run only when they can matter, and before any other question', async () => {
    // The gate's rule on the sheet: under 16 fully dressed; 16-17 nothing nude, underwear or
    // revealing (an ordinary bikini passes). Never when the change itself dresses it.
    assert.deepStrictEqual(await asked('condition', 'muddy', 10), ['DRESSED', 'sheetAge', 'sheetClothes']);
    assert.deepStrictEqual(await asked('hair', 'a bob', 15), ['DRESSED', 'sheetAge']);
    assert.deepStrictEqual(await asked('hair', 'a bob', 16), ['NO', 'sheetAge']);
    assert.deepStrictEqual(await asked('none', '', 17), ['NO', 'sheetAge']);
    assert.deepStrictEqual(await asked('clothes', 'a navy coat', 10), ['sheetAge'], 'Clothes dresses it; its words are the caption');
    assert.deepStrictEqual(await asked('hair', 'a bob', 18), ['sheetAge']);
    assert.deepStrictEqual(await asked('clothes', 'a red jacket', 0), [], 'an ordinary change asks nothing');
    // How old the sheet LOOKS is the child-safety gate's call, never this Flow's (Fabio, 2026-10-10).
    assert.deepStrictEqual(await asked('clothes', 'a red bikini', 0), []);
});

test('describeFlowRun: an undressed sheet made a minor refuses before anything else is asked', async () => {
    const fe = await esm('js/services/flowEnhance.js');
    const flow = await editor();
    const realWarn = console.warn;
    console.warn = () => {};
    try {
        const go = async (dressed) => {
            const questions = [];
            const describe = async ({ question }) => {
                questions.push(question);
                return { ok: true, via: 'endpoint', text: /DRESSED/.test(question) ? dressed : /How old/.test(question) ? '40' : 'Wearing a coat.' };
            };
            const res = await fe.describeFlowRun(flow, { injectionParams: await values('condition', 'muddy', 10), mediaItems: [SHEET] }, null, { describe });
            return { res, questions };
        };
        const no = await go('NOT DRESSED');
        assert.strictEqual(no.res.ok, false);
        assert.strictEqual(no.res.code, CODE);
        assert.match(no.res.message, DRESS_FIRST);
        assert.strictEqual(no.questions.length, 1, 'the age and the clothes are never asked');
        assert.strictEqual((await go('I cannot tell.')).res.code, CODE, 'only the passing answer passes');
        const yes = await go('Dressed.');
        assert.deepStrictEqual(yes.res, { ok: true, injectionParams: { sheetAge: '40', sheetClothes: 'Wearing a coat.' } });
    } finally {
        console.warn = realWarn;
    }
});

test('describeFlowRun: at 16-17 an ordinary bikini passes, a revealing or bare sheet does not', async () => {
    const fe = await esm('js/services/flowEnhance.js');
    const flow = await editor();
    const run = async (answer) => fe.describeFlowRun(flow, { injectionParams: await values('hair', 'a bob', 17), mediaItems: [SHEET] }, null,
        { describe: async ({ question }) => ({ ok: true, via: 'endpoint', text: /revealing/.test(question) ? answer : '25' }) });
    assert.deepStrictEqual(await run('No.'), { ok: true, injectionParams: { sheetAge: '25' } });
    for (const answer of ['YES', 'Yes, a micro bikini.', 'Not sure.']) {
        const res = await run(answer);
        assert.deepStrictEqual([res.ok, res.code], [false, CODE], answer);
        assert.match(res.message, /^Dress the sheet first: pick Clothes.*At 16 or 17/);
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
            return { ok: true, json: async () => ({ ok: true, model: 'vl', text: /DRESSED/.test(body.question) ? 'NOT DRESSED' : '40' }) };
        }
        const job = /^\/connector\/jobs\/([^/]+)\/result$/.exec(url);
        if (job) reports.get(job[1])?.(body);
        return { ok: true, json: async () => ({ ok: true }) };
    };
    svc.setDescribeBackendPreference('endpoint');
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
    } finally {
        off();
        svc.setDescribeBackendPreference(null);
        global.fetch = realFetch;
        console.warn = realWarn;
    }
});

test('the result card is named after the card it edits and the change', async () => {
    const { characterSheetEditorCardName: name } = await builder();
    assert.strictEqual(name({ change: 'condition', words: ' beaten up. ', Input_Age: 0 }, 'John'), 'John - beaten up');
    assert.strictEqual(name({ change: 'none', words: 'ignored', Input_Age: 30 }, 'John'), 'John - age 30');
    assert.strictEqual(name({ change: 'clothes', words: 'a red coat', Input_Age: 10 }, 'John'), 'John - a red coat, age 10');
    assert.strictEqual(name({ change: 'hair', words: 'a bob', Input_Age: 0 }, null), 'Character sheet - a bob', 'a file from outside the project');

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
