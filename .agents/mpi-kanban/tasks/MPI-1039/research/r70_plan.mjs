// MPI-1039 round 70: from a LOW or HIGH start (Fabio 2026-10-26: zoom-only makes the flow useless) - a TURN that
// stays at the start's height (the shipped turn / front words + a stay-at-this-height line, doll at the target turn
// and the start height), the OTHER height (the shipped height words), and back to EYE LEVEL (round 67's toLevel words
// on FLUX.3 + the room doll, round 68's levelF). Each cell with and without the user's eye-level picture as image 3.
// stdin: {"<input>": {"text", "start", "height", "turns": [..]}}
// stdout: {"<input>": {"start", "height", "<cell>": {kind, model, ref, prompt, prompt3} | {error}}}
import { multiAnglePlan, parseMultiAngleFacts, FLUX3 } from '../../../../../js/data/flowPrompts/multiAngle.js';

const FORMS = { she: ['she', 'her', 'her', 'is'], he: ['he', 'his', 'him', 'is'], they: ['they', 'their', 'them', 'are'] };
const VIEW_NAME = {
    front: 'front', tq_fl: 'three-quarter side', tq_fr: 'three-quarter side', pr_l: 'side profile',
    pr_r: 'side profile', tq_bl: 'rear three-quarter', tq_br: 'rear three-quarter', back: 'back',
};
const TAIL = ' Take only the viewing angle';
const _tail = prompt => prompt.slice(prompt.indexOf(TAIL));
const _head = prompt => prompt.slice(0, prompt.indexOf(TAIL));

function stay(height, f, feet) {
    const [, poss, obj] = f;
    return height === 'lo'
        ? ` The camera stays as low as in the first image, just above the ground, looking steeply up at ${obj}: ${poss} `
          + `${feet} and legs are large at the bottom of the frame, ${poss} body rises and narrows toward the top and `
          + `${poss} whole head is small near the top of the frame, still inside it.`
        : ` The camera stays as high as in the first image, looking steeply down at ${obj}: the top of ${poss} head and `
          + `${poss} shoulders are large near the top of the frame, ${poss} body narrows downward, ${poss} ${feet} are `
          + 'small near the bottom edge and the ground fills the background.';
}

/** Image 3 = the user's eye-level picture of the same person (the Whole Outfit slot). */
function third(cell, f, subject) {
    const [subj, poss] = f;
    const what = `${poss} face, hair, body and clothes`;
    return cell === 'level'
        ? ` The third image shows the same ${subject} at eye level: use it for ${what} and for how the place looks at `
          + 'eye level; the viewpoint comes from the mannequin reference and these words.'
        : ` The third image shows the same ${subject} from another view: use it only for who ${subj} ${f[3]} - ${what}; `
          + 'the view, pose and place come from the first image, the viewpoint from the mannequin reference.';
}

function toLevel(turn, from, f, feet, subject, tail) {
    const [, poss, obj] = f;
    const view = turn === 'front' ? `keep ${obj} seen straight from the front, as in the first image`
        : `keep the same ${VIEW_NAME[turn]} view of the ${subject} as in the first image`;
    const move = from === 'lo' ? 'rises from just above the ground' : 'comes down from high above';
    const was = from === 'lo' ? 'no longer a view up into the sky' : 'no longer a view down onto the ground';
    return 'Shift the viewpoint of the first image to match the mannequin reference in the second image: '
        + `${view}, but the view ${move} to ${poss} eye level. The camera now looks straight at ${obj}, level - not up and `
        + `not down: ${poss} whole body from head to toe stands upright at its natural proportions, ${poss} head near the `
        + `top of the frame and ${poss} ${feet} near the bottom, and the place behind ${obj} is seen straight on at eye `
        + `level, its horizon level behind ${poss} chest, ${was}.` + tail;
}

const withThird = (step, cell, f, subject) => ({ ...step, prompt3: _head(step.prompt) + third(cell, f, subject)
    + _tail(step.prompt) });

const ins = JSON.parse(await new Promise(r => { let s = ''; process.stdin.on('data', d => { s += d; }).on('end', () => r(s)); }));
const out = {};
for (const [name, { text, start, height, turns }] of Object.entries(ins)) {
    const { facts } = parseMultiAngleFacts(text);
    const f = FORMS[facts.pronoun] || FORMS.they;
    const feet = facts.feet || 'feet';
    const subject = facts.subject || 'person';
    const o = out[name] = { start, height };
    const level = { turn: start, height: 'level' };
    for (const to of turns) {
        const plan = multiAnglePlan({ turn: to, height: 'level', from: level }, facts);
        if (!plan.ok) { o[to] = { error: plan.reason }; continue; }
        const s = plan.steps[0];
        const ref = to === 'front' && height === 'hi' ? 'room/front_hi' : `plain/${to}_${height}`;
        const prompt = _head(s.prompt).replace(' at eye level', '') + stay(height, f, feet) + _tail(s.prompt);
        o[to] = withThird({ kind: s.kind, model: FLUX3, ref, prompt }, to, f, subject);
    }
    const other = height === 'lo' ? 'hi' : 'lo';
    const h = multiAnglePlan({ turn: start, height: other, from: level }, facts);
    o.other = h.ok ? withThird(h.steps[0], 'other', f, subject) : { error: h.reason };
    o.level = h.ok ? withThird({ kind: 'height', model: FLUX3, ref: `room/${start}`,
        prompt: toLevel(start, height, f, feet, subject, _tail(h.steps[0].prompt)) }, 'level', f, subject) : { error: h.reason };
}
process.stdout.write(JSON.stringify(out, null, 1));
