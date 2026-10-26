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
        farLow: 'with the full height of the shop fronts rising at both sides and the open sky with the power lines '
            + 'above her',
        farHigh: 'with much more of the paving around her seen from above, the kerb and the bases of the shop fronts',
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
        farLow: 'with the whole studio around her seen from below - the light stands and softboxes at both sides and '
            + 'the dark studio ceiling above her',
        farHigh: 'with much more of the bare studio floor around her seen from above, the edges of the grey backdrop '
            + 'paper and the feet of the light stands',
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
    const high = stop.match(/^zoom (.+) (lo|hi) (hs|far)$/); // round 51: the zoom pass after the turn and height
    if (high) {
        const turn = TURN[high[1]];
        return [{ turn, height: high[2], zoom: { from: 'full', to: high[3] } }, turn === 'front' ? 1 : 2];
    }
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

test('the front pass rebuilds the round 52-56 front words', async () => {
    const { multiAnglePlan } = await builder();
    const [front] = multiAnglePlan({ turn: 'front', from: { turn: 'pr_l' } }, FACTS.photo).steps;
    assert.strictEqual(front.prompt, 'Shift the viewpoint of the first image around the subject to match the mannequin '
        + 'reference in the second image: she is seen straight from the front at eye level, facing the camera: her '
        + 'whole face with both eyes, her chest and both shoulders face the view, and her feet point toward the camera. '
        + 'The place around her is seen from that angle. Take only the viewing angle from the mannequin reference. The '
        + 'subject is still the real person from the first image, with their own head and hair, hands, clothes and '
        + 'shoes; keep their identity, pose, the place, the light and the image style of the first image unchanged.');
});

test('each pick runs the proven passes on the proven models', async () => {
    const { multiAnglePlan, FLUX3, QWEN } = await builder();
    const run = (pick) => multiAnglePlan(pick, FACTS.photo).steps.map(s => `${s.kind}:${s.model}:${s.ref}`);
    const FRONT = `front:${FLUX3}:room/front`;
    assert.deepStrictEqual(run({ turn: 'front', from: { turn: 'tq_br' } }), [FRONT]);
    assert.deepStrictEqual(run({ turn: 'front' }), [], 'the start is already the front');
    assert.deepStrictEqual(run({ turn: 'front', height: 'hi' }), [`height:${FLUX3}:room/front_hi`]);
    assert.deepStrictEqual(run({ turn: 'front', height: 'lo' }), [`height:${QWEN}:plain/front_lo`]);
    assert.deepStrictEqual(run({ turn: 'pr_l' }), [`turn:${FLUX3}:room/pr_l`]);
    assert.deepStrictEqual(run({ turn: 'tq_br', height: 'hi' }),
        [`turn:${FLUX3}:room/tq_br`, `height:${QWEN}:plain/tq_br_hi`]);
    assert.deepStrictEqual(run({ turn: 'front', zoom: { from: 'full', to: 'face' } }),
        [`zoom:${FLUX3}:null`, `zoom:${QWEN}:null`]);
    assert.deepStrictEqual(run({ turn: 'front', zoom: { from: 'face', to: 'far' } }),
        [`zoom:${FLUX3}:null`, `zoom:${QWEN}:null`]);
    assert.deepStrictEqual(run({ turn: 'front', zoom: { from: 'full', to: 'full' } }), [], 'no zoom move');
    assert.deepStrictEqual(run({ turn: 'tq_br', zoom: { from: 'full', to: 'hs' } }),
        [`turn:${FLUX3}:room/tq_br`, `zoom:${QWEN}:null`]);
});

test('only what moved from the matched start runs a pass (step 2, rounds 66-68)', async () => {
    const { multiAnglePlan, FLUX3, QWEN } = await builder();
    const plan = pick => multiAnglePlan(pick, FACTS.photo);
    const run = pick => plan(pick).steps.map(s => `${s.kind}:${s.model}:${s.ref}`);
    // An unturned side view: the height pass alone on its own words and doll (round 66, 46/46).
    assert.deepStrictEqual(run({ turn: 'pr_r', height: 'lo', from: { turn: 'pr_r' } }), [`height:${QWEN}:plain/pr_r_lo`]);
    assert.deepStrictEqual(run({ turn: 'back', from: { turn: 'back' }, zoom: { from: 'full', to: 'far' } }),
        [`zoom:${FLUX3}:null`], 'a zoom with no pass before it is FLUX.3');
    assert.deepStrictEqual(run({ turn: 'tq_fl', from: { turn: 'pr_r' } }), [`turn:${FLUX3}:room/tq_fl`]);
    assert.deepStrictEqual(run({ turn: 'pr_r', from: { turn: 'pr_r' } }), []);
    // A high start takes the zoom at its own height, no height pass (round 67, 16/16)...
    assert.deepStrictEqual(run({ turn: 'pr_r', height: 'hi', from: { turn: 'pr_r', height: 'hi' },
        zoom: { from: 'full', to: 'hs' } }), [`zoom:${FLUX3}:null`]);
    // Round 70: a turn at the start's height, back to eye level, or the other height - one pass each.
    const hi = { turn: 'front', height: 'hi' };
    assert.deepStrictEqual(run({ turn: 'pr_r', height: 'hi', from: hi }), [`turn:${FLUX3}:plain/pr_r_hi`]);
    assert.deepStrictEqual(run({ turn: 'front', height: 'hi', from: { turn: 'pr_r', height: 'hi' } }),
        [`front:${FLUX3}:room/front_hi`]);
    assert.deepStrictEqual(run({ turn: 'front', height: 'level', from: hi }), [`height:${FLUX3}:room/front`]);
    assert.deepStrictEqual(run({ turn: 'front', height: 'hi', from: { turn: 'front', height: 'lo' } }),
        [`height:${FLUX3}:room/front_hi`]);
    assert.deepStrictEqual(run({ turn: 'back', height: 'lo', from: { turn: 'back', height: 'hi' } }),
        [`height:${QWEN}:plain/back_lo`]);
    const turned = plan({ turn: 'front', height: 'lo', from: { turn: 'tq_br', height: 'lo' } }).steps[0].prompt;
    assert.ok(turned.includes('The camera stays as low as in the first image') && !turned.includes('at eye level'));
    // ...not: a front high -> low (head cut), a rear start crossing to the other front 3/4, a turn that also
    // changes the height, a turn with a zoom, two people.
    for (const pick of [{ turn: 'front', height: 'lo' }, { turn: 'pr_r' }, { turn: 'pr_r', height: 'hi',
        zoom: { from: 'full', to: 'far' } }]) {
        assert.strictEqual(plan({ ...pick, from: hi }).ok, false, JSON.stringify(pick));
    }
    assert.strictEqual(plan({ turn: 'tq_fl', height: 'lo', from: { turn: 'tq_br', height: 'lo' } }).ok, false);
    assert.strictEqual(multiAnglePlan({ turn: 'pr_r', height: 'hi', from: hi }, { ...FACTS.photo, people: 2 }).ok, false);
    // The front pass from a turned start runs alone.
    assert.strictEqual(plan({ turn: 'front', height: 'lo', from: { turn: 'pr_l' } }).ok, false);
    assert.strictEqual(plan({ turn: 'front', from: { turn: 'pr_l' }, zoom: { from: 'full', to: 'hs' } }).ok, false);
});

test('a profile low keeps the head with the round 67 headroom words; other lows keep theirs', async () => {
    const { multiAnglePlan } = await builder();
    const low = turn => multiAnglePlan({ turn, height: 'lo', from: { turn } }, FACTS.photo).steps[0].prompt;
    for (const t of ['pr_l', 'pr_r']) {
        assert.ok(low(t).includes('with a clear gap above it: her whole head and hair are inside the frame, below the top '
            + 'edge') && low(t).includes('The whole woman fits in the frame from her sneakers to the top of her head.'), t);
    }
    for (const t of ['tq_fl', 'tq_br', 'back']) assert.ok(low(t).includes('with her whole head still in frame'), t);
});

test('two or more people get no front pass; turns are one pass as for one person', async () => {
    const { multiAnglePlan, FLUX3, QWEN } = await builder();
    const run = (pick) => multiAnglePlan(pick, { ...FACTS.photo, people: 2 }).steps.map(s => `${s.kind}:${s.model}:${s.ref}`);
    assert.deepStrictEqual(run({ turn: 'front' }), []);
    assert.strictEqual(multiAnglePlan({ turn: 'front', from: { turn: 'pr_l' } }, { ...FACTS.photo, people: 2 }).ok, false);
    assert.deepStrictEqual(run({ turn: 'pr_l' }), [`turn:${FLUX3}:room/pr_l`]);
    assert.deepStrictEqual(run({ turn: 'tq_br', height: 'hi' }),
        [`turn:${FLUX3}:room/tq_br`, `height:${QWEN}:plain/tq_br_hi`]);
    assert.strictEqual(multiAnglePlan({ turn: 'pr_l' }, { ...FACTS.photo, people: 3 }).steps.length, 1);
});

test('a turn of two people names both and keeps both, as round 64 ran', async () => {
    const { multiAnglePlan, MULTI_ANGLE_TURNS } = await builder();
    const turn = (t, facts) => multiAnglePlan({ turn: t }, facts).steps[0].prompt;
    assert.strictEqual(turn('tq_br', { ...FACTS.photo, people: 2 }), 'Shift the viewpoint of the first image around the '
        + 'two people to match the mannequin reference in the second image: a three-quarter rear view from behind both '
        + 'people and 45 degrees to their right. Both face away at an angle toward frame-right, their backs and right '
        + 'shoulders nearer the view, the backs of their heads and only the edge of each cheek showing. Both people stay '
        + 'in the picture. The place around them is seen from that angle. Take only the viewing angle from the mannequin '
        + 'reference; it shows one figure, the picture keeps BOTH people. They are still the same two real people from '
        + 'the first image, each with their own head and hair, hands, clothes and shoes; keep both identities, their '
        + 'poses, the place, the light and the image style of the first image unchanged.');
    for (const t of MULTI_ANGLE_TURNS.filter(x => x !== 'front')) {
        const anime = turn(t, { ...FACTS.anime, people: 2 });
        assert.ok(anime.includes('the same two drawn anime characters') && !/\b(she|her|subject)\b/.test(anime), anime);
        assert.ok(!anime.includes('vending machine'), 'no one-person reveal or detail');
        const three = turn(t, { ...FACTS.photo, people: 3 });
        assert.ok(three.includes('the 3 people') && three.includes('ALL people') && !/\bboth\b/i.test(three), three);
    }
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
