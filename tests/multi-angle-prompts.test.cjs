/**
 * multi-angle-prompts.test.cjs — MPI-1039 Flow build phase 2. The Multi-angle Flow's prompt builder:
 *
 *   1. fed the bench woman's facts, every accepted cell rebuilds its bench prompt word for word
 *      (fixtures/multi-angle-bench-prompts.json = the cards' sidecars, written by
 *      tasks/MPI-1039/research/accepted_prompts.py) - a rewording is a new bench run;
 *   2. each pick runs the passes the bench proved, on the right model, never one model twice in a row;
 *   3. unbenched zooms are refused, and a "they" subject reads as plain English.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const builder = () => import('file://' + path.join(ROOT, 'js/data/flowPrompts/multiAngle.js').replace(/\\/g, '/'));
const BENCH = require('./fixtures/multi-angle-bench-prompts.json');

const VM = 'the red vending machine and the blue awning';
const PA = 'the pink awning and the yellow sign board';
const _slant = (side, shops, marks, run, gone) => `The street is now seen at a slant from her ${side} side: behind her `
    + `the shop fronts on her ${shops}, with ${marks}, fill the background seen at an angle, the street ${run}; ${gone} `
    + `${gone.includes(' and ') ? 'are' : 'is'} no longer in view.`;
const _across = (shops, marks, gone) => 'The street now runs across the frame from side to side: behind her the shop '
    + `fronts on her ${shops}, with ${marks}, fill the background seen straight on; ${gone} are no longer in view.`;
const _above = marks => 'around her the street fills the background seen from above: the paving with its painted '
    + `lines, the kerb, and the bases of the shop fronts with ${marks} seen from above at the edge of the frame`;
const DETAILS = {
    tq_br: 'Her right side is the one nearest the view: the brown bag that hangs at her right hip shows at frame-right '
        + 'beside her near right arm, its strap running across her back from her left shoulder. Her near right wrist is '
        + 'bare: the wristwatch stays on her LEFT wrist, on the far arm, hidden behind her body.',
};

/** The bench sources, said as the describer would. */
const FACTS = {
    anime: {
        subject: 'woman', pronoun: 'she', feet: 'sneakers', frontLowLegs: 'white sneakers and jeans', wears: 'earrings',
        drawing: { noun: 'anime', style: 'flat 2D anime drawing style', marks: 'clean outlines, flat colours' },
        ground: 'the street surface', near: 'the street',
        frontLowReveal: 'above her the open blue sky with the power lines and the shop signs now fills the background, '
            + 'the shop fronts leaning inward at both sides',
        lowReveal: 'above her the open blue sky with the power lines and the shop signs now fills the background',
        highReveal: { tq_fl: _above(VM), pr_l: _above(VM), tq_bl: _above(VM), tq_fr: _above(PA), pr_r: _above(PA),
            tq_br: _above(PA), back: _above(`${VM} on one side and ${PA} on the other`) },
        turnReveal: {
            tq_fl: _slant('left', 'right', VM, 'running away toward frame-right', PA),
            tq_fr: _slant('right', 'left', PA, 'running away toward frame-left', VM),
            tq_bl: _slant('left', 'right', VM, 'running on toward frame-left', PA),
            tq_br: _slant('right', 'left', PA, 'running on toward frame-right', 'the red vending machine'),
            pr_l: _across('right', VM, PA),
            pr_r: _across('left', PA, VM),
        },
        details: DETAILS,
        far: 'with the full height of the shop fronts and their signs at both sides, much more of the street in front '
            + 'of her and the street running on behind her',
    },
    photo: {
        subject: 'woman', pronoun: 'she', feet: 'sneakers', frontLowLegs: 'white sneakers and jeans', wears: 'earrings',
        ground: 'the grey studio floor', near: 'the grey backdrop',
        frontLowReveal: 'above her head the dark studio ceiling with a softbox light now shows instead of the grey '
            + 'backdrop',
        lowReveal: 'above her the dark studio ceiling with a softbox light, instead of the grey backdrop, now fills the '
            + 'background',
        highReveal: 'the grey studio floor fills the background behind her',
        details: DETAILS,
        far: 'and the whole studio now shows around her - the edges of the grey backdrop paper, light stands and '
            + 'softboxes at both sides, and the bare studio floor in front of her',
    },
};

const TURN = { 'tq fl': 'tq_fl', 'tq fr': 'tq_fr', 'pr l': 'pr_l', 'pr r': 'pr_r', 'tqb l': 'tq_bl', 'tqb r': 'tq_br',
    back: 'back', front: 'front' };
/** Bench cell -> (pick, which step's prompt). */
function _cell(stop) {
    const zoom = {
        'zoom hs': [{ zoom: { from: 'full', to: 'hs' } }, 0], 'zoom face': [{ zoom: { from: 'full', to: 'face' } }, 1],
        'zoom eye': [{ zoom: { from: 'full', to: 'eye' } }, 0], 'zoom waist': [{ zoom: { from: 'hs', to: 'waist' } }, 0],
        'zoom full': [{ zoom: { from: 'hs', to: 'full' } }, 0], 'zoom far': [{ zoom: { from: 'full', to: 'far' } }, 0],
        'zoom rear hs': [{ turn: 'tq_br', zoom: { from: 'full', to: 'hs' } }, 1],
    }[stop];
    if (zoom) return zoom;
    const turned = stop.match(/^zoom (.+) (hs|far)$/); // round 50: the zoom pass after the turn
    if (turned) return [{ turn: TURN[turned[1]], zoom: { from: 'full', to: turned[2] } }, 1];
    const [turn, height] = [stop.replace(/ (lo|hi)$/, ''), (stop.match(/ (lo|hi)$/) || [])[1] || 'level'];
    return [{ turn: TURN[turn], height }, turn === 'front' || height === 'level' ? 0 : 1];
}

// The cells the builder does not rebuild as they ran, and why.
const NOT_REBUILT = {
    'tq fl lo': 'round 30 ran before round 31 added "with her whole head still in frame" to every turned low',
    'zoom rear waist': 'not benched: the rear waist rung still cuts the head off on a photo (round 49)',
};

test('every accepted bench cell rebuilds its prompt word for word', async () => {
    const { multiAnglePlan } = await builder();
    let checked = 0;
    for (const [key, prompt] of Object.entries(BENCH)) {
        const [stop, style] = key.split(' | ');
        if (NOT_REBUILT[stop]) continue;
        const [pick, i] = _cell(stop);
        const plan = multiAnglePlan(pick, FACTS[style]);
        assert.ok(plan.ok, `${key}: ${plan.reason}`);
        assert.strictEqual(plan.steps[i].prompt, prompt, key);
        checked++;
    }
    assert.ok(checked >= 55, `only ${checked} cells checked`);
});

test('each pick runs the proven passes on the proven models', async () => {
    const { multiAnglePlan, FLUX3, QWEN } = await builder();
    const run = (pick) => multiAnglePlan(pick, FACTS.photo).steps.map(s => `${s.kind}:${s.model}:${s.ref}`);
    assert.deepStrictEqual(run({ turn: 'front' }), []);
    assert.deepStrictEqual(run({ turn: 'front', height: 'hi' }), [`height:${FLUX3}:room/front_hi`]);
    assert.deepStrictEqual(run({ turn: 'front', height: 'lo' }), [`height:${QWEN}:plain/front_lo`]);
    assert.deepStrictEqual(run({ turn: 'pr_l' }), [`turn:${FLUX3}:room/pr_l`]);
    assert.deepStrictEqual(run({ turn: 'tq_br', height: 'hi' }),
        [`turn:${FLUX3}:room/tq_br`, `height:${QWEN}:plain/tq_br_hi`]);
    assert.deepStrictEqual(run({ turn: 'front', zoom: { from: 'full', to: 'face' } }),
        [`zoom:${FLUX3}:null`, `zoom:${QWEN}:null`]);
    assert.deepStrictEqual(run({ turn: 'front', zoom: { from: 'face', to: 'far' } }),
        [`zoom:${FLUX3}:null`, `zoom:${QWEN}:null`]);
    assert.deepStrictEqual(run({ turn: 'tq_br', zoom: { from: 'full', to: 'hs' } }),
        [`turn:${FLUX3}:room/tq_br`, `zoom:${QWEN}:null`]);
});

test('a zoom-out from a close-up makes up the outfit from the user\'s words or second picture', async () => {
    const { multiAnglePlan } = await builder();
    const words = 'Below her turtleneck she wears dark blue straight jeans and white sneakers.';
    const plan = (outfit, from = 'hs') => multiAnglePlan({ zoom: { from, to: 'far' }, outfit }, FACTS.photo).steps;
    const [full, far] = plan({ words, ref: true });
    assert.ok(full.prompt.includes(` ${words} The second image shows the same woman in her whole outfit`));
    assert.ok(!full.prompt.includes('continues it plainly'));
    assert.ok(!far.prompt.includes(words) && !far.prompt.includes('continues it plainly'), 'the far pass sees the outfit');
    assert.deepStrictEqual([full.outfitRef, far.outfitRef], [true, false]);
    assert.ok(plan({})[0].prompt.includes('continues it plainly, in the same colours and style.'));
    assert.ok(!plan({}, 'full')[0].prompt.includes('continues it plainly'), 'a whole-body input shows the outfit');
});

test('unbenched zooms are refused', async () => {
    const { multiAnglePlan } = await builder();
    for (const pick of [
        { turn: 'tq_bl', zoom: { from: 'full', to: 'hs' } },
        { turn: 'tq_br', zoom: { from: 'full', to: 'waist' } },
        { turn: 'pr_l', zoom: { from: 'full', to: 'face' } },
        { turn: 'front', height: 'hi', zoom: { from: 'full', to: 'hs' } },
        { turn: 'tq_br', zoom: { from: 'full', to: 'eye' } },
        { turn: 'sideways' },
    ]) {
        assert.strictEqual(multiAnglePlan(pick, FACTS.photo).ok, false, JSON.stringify(pick));
    }
});

test('a "they" subject and empty facts read as plain English', async () => {
    const { multiAnglePlan, MULTI_ANGLE_TURNS } = await builder();
    for (const turn of MULTI_ANGLE_TURNS) {
        for (const height of ['level', 'lo', 'hi']) {
            for (const step of multiAnglePlan({ turn, height }, { pronoun: 'they' }).steps) {
                assert.doesNotMatch(step.prompt, /\b(she|her|he|his|him|they is|they fills)\b|undefined|  |\.\./, step.prompt);
            }
        }
    }
    const far = multiAnglePlan({ zoom: { from: 'hs', to: 'far' } }, { pronoun: 'they' }).steps[1].prompt;
    assert.ok(far.includes('They are now a small figure'), far);
});
