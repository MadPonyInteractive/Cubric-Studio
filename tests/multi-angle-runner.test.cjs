/**
 * multi-angle-runner.test.cjs — MPI-1039 Flow build phase 3. The Multi-angle Flow's describer and chain:
 *
 *   1. a describer answer for each bench source becomes facts that rebuild the bench prompts word for
 *      word (fixtures/multi-angle-bench-prompts.json), so the describer only has to SEE the picture;
 *   2. the chain runs one pass after another on one card: pass 1 a new card, later passes in its
 *      history, each pass's image 1 = the previous result, its doll ref padded to that result;
 *   3. a failed or stopped pass ends the chain and keeps what landed; unbenched picks never start.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const esm = p => import('file://' + path.join(ROOT, p).replace(/\\/g, '/'));
const builder = () => esm('js/data/flowPrompts/multiAngle.js');
const runner = () => esm('js/services/multiAngleRunner.js');
const BENCH = require('./fixtures/multi-angle-bench-prompts.json');

const ANSWER = {
    anime: `SUBJECT: woman
PRONOUN: she
FRAMING: full
STYLE: anime
DRAWING_STYLE: flat 2D anime drawing style
DRAWING_MARKS: clean outlines, flat colours
FEET: sneakers
LEGS: white sneakers and jeans
WEARS: earrings
PLACE: scene
PLACE_NAME: the street
GROUND: the street surface
ABOVE: the open blue sky with the power lines and the shop signs
FROM_ABOVE: the paving with its painted lines, the kerb, and the bases of the shop fronts
SIDES: the shop fronts
LEFT: the red vending machine and the blue awning
RIGHT: the pink awning and the yellow sign board
FAR: with the full height of the shop fronts and their signs at both sides, much more of the street in front of her and the street running on behind her
FAR_LOW: with the full height of the shop fronts rising at both sides and the open sky with the power lines above her
FAR_HIGH: with much more of the paving around her seen from above, the kerb and the bases of the shop fronts
ONE_SIDED: brown bag | right | hip; wristwatch | left | wrist`,
    photo: `SUBJECT: woman
PRONOUN: she
FRAMING: full
STYLE: photo
DRAWING_STYLE: none
DRAWING_MARKS: none
FEET: sneakers
LEGS: white sneakers and jeans
WEARS: earrings
PLACE: plain
PLACE_NAME: the grey backdrop
GROUND: the grey studio floor
ABOVE: the dark studio ceiling with a softbox light
FROM_ABOVE: none
SIDES: none
LEFT: none
RIGHT: none
FAR: and the whole studio now shows around her - the edges of the grey backdrop paper, light stands and softboxes at both sides, and the bare studio floor in front of her
FAR_LOW: with the whole studio around her seen from below - the light stands and softboxes at both sides and the dark studio ceiling above her
FAR_HIGH: with much more of the bare studio floor around her seen from above, the edges of the grey backdrop paper and the feet of the light stands
ONE_SIDED: brown bag | right | hip; wristwatch | left | wrist`,
};

const TURN = { 'tq fl': 'tq_fl', 'tq fr': 'tq_fr', 'pr l': 'pr_l', 'pr r': 'pr_r', 'tqb l': 'tq_bl', 'tqb r': 'tq_br',
    back: 'back', front: 'front' };
const ZOOM = {
    'zoom hs': [{ zoom: { from: 'full', to: 'hs' } }, 0], 'zoom face': [{ zoom: { from: 'full', to: 'face' } }, 1],
    'zoom eye': [{ zoom: { from: 'full', to: 'eye' } }, 0], 'zoom waist': [{ zoom: { from: 'hs', to: 'waist' } }, 0],
    'zoom full': [{ zoom: { from: 'hs', to: 'full' } }, 0], 'zoom far': [{ zoom: { from: 'full', to: 'far' } }, 0],
    'zoom rear hs': [{ turn: 'tq_br', zoom: { from: 'full', to: 'hs' } }, 1],
};
const _cell = (stop) => {
    if (ZOOM[stop]) return ZOOM[stop];
    const high = stop.match(/^zoom (.+) (lo|hi) (hs|far)$/); // round 51: the zoom pass after the turn and height
    if (high) {
        const turn = TURN[high[1]];
        return [{ turn, height: high[2], zoom: { from: 'full', to: high[3] } }, turn === 'front' ? 1 : 2];
    }
    const turned = stop.match(/^zoom (.+) (hs|far)$/); // round 50: the zoom pass after the turn
    if (turned) return [{ turn: TURN[turned[1]], zoom: { from: 'full', to: turned[2] } }, 1];
    const height = (stop.match(/ (lo|hi)$/) || [])[1] || 'level';
    const turn = stop.replace(/ (lo|hi)$/, '');
    return [{ turn: TURN[turn], height }, turn === 'front' || height === 'level' ? 0 : 1];
};

// The cells a describer's answer does not rebuild as they ran, and why.
const NOT_REBUILT = {
    'tq fl lo': 'round 30 ran before round 31 added "with her whole head still in frame" to every turned low',
    'zoom rear waist': 'not benched: the rear waist rung still cuts the head off on a photo (round 49)',
    'tqb r': 'round 39 hand-wrote this stop: one landmark leaves the view, and the bag strap is named',
};

test('a describer answer for each bench source rebuilds the bench prompts', async () => {
    const { multiAnglePlan, parseMultiAngleFacts } = await builder();
    const read = { anime: parseMultiAngleFacts(ANSWER.anime), photo: parseMultiAngleFacts(ANSWER.photo) };
    assert.strictEqual(read.anime.framing, 'full');
    let checked = 0;
    for (const [key, prompt] of Object.entries(BENCH)) {
        const [stop, style] = key.split(' | ');
        if (NOT_REBUILT[stop]) continue;
        const [pick, i] = _cell(stop);
        const plan = multiAnglePlan(pick, read[style].facts);
        assert.ok(plan.ok, `${key}: ${plan.reason}`);
        assert.strictEqual(plan.steps[i].prompt, prompt, key);
        checked++;
    }
    assert.ok(checked >= 53, `only ${checked} cells checked`);
});

test('the 3/4 back R names each one-sided thing and where it lands; no other stop does', async () => {
    const { multiAnglePlan, parseMultiAngleFacts } = await builder();
    const { facts } = parseMultiAngleFacts(ANSWER.photo);
    const turnOf = t => multiAnglePlan({ turn: t }, facts).steps.find(s => s.kind === 'turn').prompt;
    const back = turnOf('tq_br');
    assert.ok(back.includes('Her right side is the one nearest the view: the brown bag at her right hip shows at '
        + 'frame-right beside her near right arm. The wristwatch stays on her LEFT wrist, on the far side, hidden '
        + 'behind her body.'), back);
    assert.ok(!turnOf('tq_bl').includes('wristwatch'));});

test('the same thing at both edges reads as no edge things: no turn shows and hides it', async () => {
    const { multiAnglePlan, parseMultiAngleFacts } = await builder();
    const { facts } = parseMultiAngleFacts(ANSWER.anime.replace(/^LEFT: .*$/m, 'LEFT: the wooden fence')
        .replace(/^RIGHT: .*$/m, 'RIGHT: The wooden fence'));
    assert.strictEqual(facts.turnReveal, undefined);
    const turn = multiAnglePlan({ turn: 'tq_fl' }, facts).steps.find(s => s.kind === 'turn').prompt;
    assert.ok(!turn.includes('wooden fence'), turn);
});

test('a sloppy answer still reads: bullets, quotes, a trailing stop, odd case, missing lines', async () => {
    const { parseMultiAngleFacts } = await builder();
    const { facts, framing } = parseMultiAngleFacts('- SUBJECT: "Man".\n* PRONOUN: He\nFRAMING: HS\nSTYLE: Photo');
    assert.strictEqual(facts.subject, 'man');
    assert.strictEqual(facts.pronoun, 'he');
    assert.strictEqual(framing, 'hs');
    assert.strictEqual(facts.drawing, undefined);
    assert.strictEqual(parseMultiAngleFacts('').framing, 'full');
    assert.strictEqual(parseMultiAngleFacts('').facts.pronoun, 'they');
});

test('an answer with lower-case keys reads the same as upper case (round 66)', async () => {
    const { parseMultiAngleFacts } = await builder();
    assert.deepStrictEqual(parseMultiAngleFacts(ANSWER.anime.replace(/^[A-Z_]+:/gm, k => k.toLowerCase())),
        parseMultiAngleFacts(ANSWER.anime));
});

test('the people count reads off the PEOPLE line; unreadable is one', async () => {
    const { parseMultiAngleFacts } = await builder();
    const people = t => parseMultiAngleFacts(t).facts.people;
    assert.strictEqual(people(ANSWER.photo), 1);
    assert.strictEqual(people(`PEOPLE: 2\n${ANSWER.photo}`), 2);
    assert.strictEqual(people('PEOPLE: 3 people'), 3);
    assert.strictEqual(people('PEOPLE: two'), 1);
    assert.strictEqual(people('PEOPLE: 0'), 1);
    // Two people answer the one-person lines for both (round 60): the first word, never its comma.
    assert.strictEqual(parseMultiAngleFacts('PEOPLE: 2\nSUBJECT: girl, boy\nPRONOUN: she, he').facts.subject, 'girl');
});

test('Try to Match reads the view as the view read scored it (round 3 rules)', async () => {
    const { parseMultiAngleView, MULTI_ANGLE_VIEW_ASK, MULTI_ANGLE_DESCRIBE_ASK } = await builder();
    assert.ok(MULTI_ANGLE_VIEW_ASK.startsWith(MULTI_ANGLE_DESCRIBE_ASK) && MULTI_ANGLE_VIEW_ASK.includes('\nFLOOR_BEHIND:'));
    const view = t => parseMultiAngleView(t);
    assert.deepStrictEqual(view('FACING: front\nCAMERA: level\nFRAMING: hs'), { turn: 'front', height: 'level', zoom: 'hs' });
    // A side view: the side from the nose in image terms, a 3/4 only with the far cheek showing.
    assert.strictEqual(view('FACING: left\nNOSE: image-right\nFAR_CHEEK: no').turn, 'pr_r');
    assert.strictEqual(view('FACING: front-left\nNOSE: image-left\nFAR_CHEEK: yes').turn, 'tq_fl');
    // A rear view: a cheek edge or one ear = a rear 3/4, its side from the cheek edge; nothing = the back.
    assert.strictEqual(view('FACING: back\nCHEEK_EDGE: image-right\nEARS: none').turn, 'tq_br');
    assert.strictEqual(view('FACING: back-left\nCHEEK_EDGE: none\nEARS: none').turn, 'tq_bl');
    assert.strictEqual(view('FACING: back\nCHEEK_EDGE: none\nEARS: none').turn, 'back');
    // Low from the camera line; high from it or a floor filling the background.
    assert.strictEqual(view('FACING: front\nCAMERA: low').height, 'lo');
    assert.strictEqual(view('FACING: front\nCAMERA: level\nFLOOR_BEHIND: yes').height, 'hi');
    // Lower-case keys, quotes, a trailing stop; and nothing read = the gizmo's own start.
    assert.deepStrictEqual(view('facing: "right".\nnose: image-right\nframing: far'), { turn: 'pr_r', height: 'level', zoom: 'far' });
    assert.deepStrictEqual(view(''), { turn: 'front', height: 'level', zoom: 'none' });
});

/** A fake app: records every call; `fail` = { at: pass index, code } ends that pass. */
function _deps({ answer = ANSWER.photo, fail = null, loop = false } = {}) {
    const calls = [];
    let n = 0;
    return {
        calls,
        isLoopArmed: () => loop,
        describe: async (url) => { calls.push(['describe', url]); return { ok: true, text: answer }; },
        ref: async (ref, url) => { calls.push(['ref', ref, url]); return { ok: true, url: `padded:${ref}:${url}` }; },
        submit: async (step, media, landing) => {
            const i = n++;
            calls.push(['submit', step.kind, step.model, media.map(m => `${m.role}=${m.url}`), landing.existingGroup?.id || 'new']);
            if (fail?.at === i && fail.queued === false) return { ok: false, code: fail.code, message: 'refused' };
            const done = fail?.at === i ? { ok: false, code: fail.code, message: 'failed' }
                : { ok: true, item: { filePath: `out${i}.png` }, group: { id: 'card1' } };
            return { ok: true, done: Promise.resolve(done) };
        },
    };
}

test('a turn + height pick chains two passes on one card', async () => {
    const { runMultiAngle } = await runner();
    const deps = _deps();
    const run = await runMultiAngle({ source: 'src.png', pick: { turn: 'tq_br', height: 'hi' } }, deps);
    assert.ok(run.ok, run.message);
    const out = await run.finished;
    assert.deepStrictEqual(out, { ok: true, cancelled: false, done: 2, total: 2, group: { id: 'card1' }, error: undefined });
    assert.deepStrictEqual(deps.calls, [
        ['describe', 'src.png'],
        ['ref', 'room/tq_br', 'src.png'],
        ['submit', 'turn', 'flux3-klein', ['inputImage=src.png', 'inputImage2=padded:room/tq_br:src.png'], 'new'],
        ['ref', 'plain/tq_br_hi', 'out0.png'],
        ['submit', 'height', 'qwen-image-2-1', ['inputImage=out0.png', 'inputImage2=padded:plain/tq_br_hi:out0.png'], 'card1'],
    ]);
});

test('Turn = Front from a turned start turns one person to the front; two people are refused', async () => {
    const { runMultiAngle } = await runner();
    const deps = _deps();
    const pick = { turn: 'front', from: { turn: 'pr_l' } };
    const out = await (await runMultiAngle({ source: 'src.png', pick }, deps)).finished;
    assert.strictEqual(out.total, 1);
    assert.deepStrictEqual(deps.calls[2],
        ['submit', 'front', 'flux3-klein', ['inputImage=src.png', 'inputImage2=padded:room/front:src.png'], 'new']);
    const two = await runMultiAngle({ source: 'src.png', pick }, _deps({ answer: `PEOPLE: 2\n${ANSWER.photo}` }));
    assert.strictEqual(two.code, 'NOT_BENCHED');
    const same = await runMultiAngle({ source: 'src.png', pick: { turn: 'front' } }, _deps());
    assert.strictEqual(same.code, 'NOTHING_TO_DO');
});

test('the matched start zoom replaces the read framing; "as is" keeps the read one', async () => {
    const { runMultiAngle } = await runner();
    const read = await runMultiAngle({ source: 's', pick: { zoom: 'far', from: { zoom: 'none' } } }, _deps());
    assert.strictEqual(read.steps.length, 1, 'full (read) -> far is one pass');
    const matched = await runMultiAngle({ source: 's', pick: { zoom: 'far', from: { zoom: 'hs' } } }, _deps());
    assert.strictEqual(matched.steps.length, 2, 'hs (matched) -> far goes through the whole body');
});

test('a zoom-out from the read framing sends the outfit picture as image 2 of the first pass only', async () => {
    const { runMultiAngle } = await runner();
    const deps = _deps({ answer: ANSWER.photo.replace('FRAMING: full', 'FRAMING: hs') });
    const run = await runMultiAngle({ source: 'src.png', pick: { zoom: 'far' }, outfit: { url: 'sheet.png' } }, deps);
    await run.finished;
    assert.deepStrictEqual(deps.calls.filter(c => c[0] === 'submit').map(c => c[3]),
        [['inputImage=src.png', 'inputImage2=sheet.png'], ['inputImage=out0.png']]);
    assert.ok(run.steps[0].prompt.includes('The second image shows the same woman in her whole outfit'));
});

test('from a low start the outfit picture goes in as image 3 after the doll (round 70)', async () => {
    const { runMultiAngle } = await runner();
    const deps = _deps();
    const from = { turn: 'tq_br', height: 'lo' };
    const run = await runMultiAngle({ source: 'src.png', pick: { turn: 'front', height: 'lo', from },
        outfit: { url: 'eye.png' } }, deps);
    await run.finished;
    assert.deepStrictEqual(deps.calls.find(c => c[0] === 'submit')[3],
        ['inputImage=src.png', 'inputImage2=padded:plain/front_lo:src.png', 'inputImage3=eye.png']);
    assert.ok(run.steps[0].prompt.includes('The third image shows the same woman from another view'));
    // Back to eye level from a TURNED start leaves it out: it copies the picture's own view (6/6).
    const level = await runMultiAngle({ source: 'src.png', pick: { turn: 'tq_br', height: 'level', from },
        outfit: { url: 'eye.png' } }, _deps());
    assert.strictEqual(level.steps[0].outfitRef, false);
});

test('a pass that fails or is stopped ends the chain and keeps what landed', async () => {
    const { runMultiAngle } = await runner();
    const failed = await (await runMultiAngle({ source: 's', pick: { turn: 'back', height: 'lo' } },
        _deps({ fail: { at: 1, code: 'RUNTIME_ERROR' } }))).finished;
    assert.deepStrictEqual([failed.ok, failed.done, failed.total, failed.error.code], [true, 1, 2, 'RUNTIME_ERROR']);
    const stopped = await (await runMultiAngle({ source: 's', pick: { turn: 'back' } },
        _deps({ fail: { at: 0, code: 'CANCELLED' } }))).finished;
    assert.deepStrictEqual([stopped.ok, stopped.cancelled, stopped.done], [false, true, 0]);
    const refused = await (await runMultiAngle({ source: 's', pick: { turn: 'back' } },
        _deps({ fail: { at: 0, code: 'CHILD_SAFETY', queued: false } }))).finished;
    assert.deepStrictEqual([refused.ok, refused.error.code], [false, 'CHILD_SAFETY']);
});

test('nothing starts for Loop, no picture, an unbenched pick or no move', async () => {
    const { runMultiAngle } = await runner();
    const code = async (run, deps = _deps()) => (await runMultiAngle(run, deps)).code;
    assert.strictEqual(await code({ source: 's', pick: { turn: 'back' } }, _deps({ loop: true })), 'LOOP_ARMED');
    assert.strictEqual(await code({ pick: { turn: 'back' } }), 'NO_SOURCE');
    assert.strictEqual(await code({ source: 's', pick: { turn: 'tq_bl', zoom: 'hs' } }), 'NOT_BENCHED');
    assert.strictEqual(await code({ source: 's', pick: { turn: 'front' } },
        _deps({ answer: `PEOPLE: 2\n${ANSWER.photo}` })), 'NOTHING_TO_DO');
    const deps = _deps();
    deps.describe = async () => ({ ok: false, message: 'no describer set up' });
    assert.strictEqual(await code({ source: 's', pick: { turn: 'back' } }, deps), 'DESCRIBE_FAILED');
});
