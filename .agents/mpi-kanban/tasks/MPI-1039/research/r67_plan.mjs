// MPI-1039 round 67: (A) the side-view low crops the head 4/4 (round 66) - two framing variants of the side low words;
// (B) a start that is NOT eye level (the user matches Cosmo's height to a low or high picture in step 2): back to eye
// level (new words, Qwen + the plain doll of the start view), the other height (the shipped words), and a zoom at the
// same height (the shipped zoom-on-height words, no height pass). Turn and height steps the start already has are dropped.
// stdin: {"<input>": {"text", "start", "height", "part"}}
// stdout: {"<input>": {"people", "framing", "start", "height", "<pick>": [{kind, model, ref, prompt}] | {error}}}
import { multiAnglePlan, parseMultiAngleFacts, BENCHED_ZOOM_HEIGHT, FLUX3, QWEN } from '../../../../../js/data/flowPrompts/multiAngle.js';

const FORMS = { she: ['her', 'her'], he: ['his', 'him'], they: ['their', 'them'] };
const VIEW_NAME = {
    tq_fl: 'three-quarter side', tq_fr: 'three-quarter side', pr_l: 'side profile', pr_r: 'side profile',
    tq_bl: 'rear three-quarter', tq_br: 'rear three-quarter', back: 'back',
};
const TAIL = ' Take only the viewing angle';
const _tail = prompt => prompt.slice(prompt.indexOf(TAIL));
const _head = prompt => prompt.slice(0, prompt.indexOf(TAIL));

function steps(pick, facts, drop) {
    const plan = multiAnglePlan(pick, facts);
    if (!plan.ok) return { error: plan.reason };
    const s = plan.steps.filter(x => !drop.includes(x.kind));
    s.forEach((x, i) => { if (x.kind === 'zoom') x.model = s[i - 1]?.model === FLUX3 ? QWEN : FLUX3; });
    return s;
}

/** (A) the side low words with a framing line: V1 headroom, V2 headroom + the camera a few steps back. */
function sideLow(base, facts, back) {
    const [poss, obj] = FORMS[facts.pronoun] || FORMS.they;
    const feet = facts.feet || 'feet';
    // The side low says the head stays in frame; the front low (round 68, from a high start) does not.
    const old = [`is small near the top edge with ${poss} whole head still in frame`, 'is small near the top edge']
        .find(w => base.prompt.includes(w));
    if (!old) return { error: 'low words changed' };
    const head = _head(base.prompt).replace(old, `is small near the top of the frame with a clear gap above it: ${poss} `
        + 'whole head and hair are inside the frame, below the top edge');
    const fit = ` The whole ${facts.subject || 'person'} fits in the frame from ${poss} ${feet} to the top of ${poss} head.`
        + (back ? ` The camera stands a few steps further back from ${obj} than in the first image.` : '');
    return [{ ...base, prompt: head + fit + _tail(base.prompt) }];
}

/** (B) back to eye level from a low or high start - new words; the keep tail is the shipped one. */
function toLevel(turn, from, facts, tail, model = QWEN) {
    const [poss, obj] = FORMS[facts.pronoun] || FORMS.they;
    const feet = facts.feet || 'feet';
    const view = turn === 'front' ? `keep ${obj} seen straight from the front, as in the first image`
        : `keep the same ${VIEW_NAME[turn]} view of the ${facts.subject || 'person'} as in the first image`;
    const move = from === 'lo' ? 'rises from just above the ground' : 'comes down from high above';
    const was = from === 'lo' ? 'no longer a view up into the sky' : 'no longer a view down onto the ground';
    return [{ kind: 'height', model, ref: `${model === FLUX3 ? 'room' : 'plain'}/${turn}`, prompt: 'Shift the viewpoint of the first image to '
        + `match the mannequin reference in the second image: ${view}, but the view ${move} to ${poss} eye level. The `
        + `camera now looks straight at ${obj}, level - not up and not down: ${poss} whole body from head to toe `
        + `stands upright at its natural proportions, ${poss} head near the top of the frame and ${poss} ${feet} near the `
        + `bottom, and the place behind ${obj} is seen straight on at eye level, its horizon level behind ${poss} chest, `
        + `${was}.` + tail }];
}

const ins = JSON.parse(await new Promise(r => { let s = ''; process.stdin.on('data', d => { s += d; }).on('end', () => r(s)); }));
const out = {};
for (const [name, { text, start, height, part }] of Object.entries(ins)) {
    const { facts, framing } = parseMultiAngleFacts(text);
    const o = out[name] = { people: facts.people, framing, start, height };
    if (part === 'A') {
        const base = steps({ turn: start, height: 'lo' }, facts, ['turn']);
        o.base = base;
        o.v1 = base.error ? base : sideLow(base[0], facts, false);
        o.v2 = base.error ? base : sideLow(base[0], facts, true);
        continue;
    }
    const other = height === 'lo' ? 'hi' : 'lo';
    if (part === 'C') {  // round 68: to eye level on FLUX.3 + the room doll; a low from a high start with headroom
        const ref = steps({ turn: start, height: other }, facts, ['turn']);
        o.levelF = ref.error ? ref : toLevel(start, height, facts, _tail(ref[0].prompt), FLUX3);
        if (height === 'hi') o.lo_v1 = ref.error ? ref : sideLow(ref[0], facts, false);
        continue;
    }
    o[other] = steps({ turn: start, height: other }, facts, ['turn']);
    o.level = o[other].error ? o[other] : toLevel(start, height, facts, _tail(o[other][0].prompt));
    for (const to of BENCHED_ZOOM_HEIGHT[height][start]) {
        o[to] = steps({ turn: start, height, zoom: { from: 'full', to } }, facts, ['turn', 'height']);
    }
}
process.stdout.write(JSON.stringify(out, null, 1));
