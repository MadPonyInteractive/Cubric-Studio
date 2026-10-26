/**
 * MPI-1039 - the Multi-angle Flow's prompts, built in code, never typed by the user.
 *
 * Every fixed string below is VERBATIM from a bench cell that passed (tasks/MPI-1039/validation.md
 * rounds 23-49; research/accepted_prompts.md holds each cell's prompt as it ran); a rewording is a new
 * bench run, not an edit here. What changes from picture to picture comes in as `facts`, which the
 * Flow's describer writes from the source (flow-spec.md § The prompt recipe): who the subject is, photo
 * or drawing, the place each new view reveals, and the details worn on one side.
 *
 * A stop is 1-3 passes, each its own edit: TURN or FRONT (FLUX.3, the doll in its room as image 2), HEIGHT
 * (front high on FLUX.3; front low and every height on a turned picture on Qwen, the doll on white as
 * image 2), ZOOM (words only, a rung of the framing ladder). Never the same model twice in a row
 * (round 44: two Qwen passes = gritty HDR texture; rounds 31-32 and 41: FLUX.3 returns its own result
 * unchanged). So a turn is ONE pass from the picture as it is, whatever way it faces: front first (a front
 * pass, then the turn on FLUX.3's own front) froze or kept the input's side on the 3/4 and profile stops,
 * 4/16 against 12/16 direct; a Qwen front loses the place (rounds 57-61).
 *
 * Pure: no app imports, so the tests import it as it ships.
 */

export const FLUX3 = 'flux3-klein';
export const QWEN = 'qwen-image-2-1';

/** The turn stops, named as the shipped refs and previews are (assets/flows/multi-angle/). */
export const MULTI_ANGLE_TURNS = ['front', 'tq_fl', 'tq_fr', 'pr_l', 'pr_r', 'tq_bl', 'tq_br', 'back'];

/** The height stops: level is no pass. */
export const MULTI_ANGLE_HEIGHTS = ['level', 'lo', 'hi'];

/** The zoom ladder, closest first (rounds 43-49). */
export const MULTI_ANGLE_RUNGS = ['eye', 'face', 'hs', 'waist', 'full', 'far'];

/**
 * Zoom moves benched per view: view -> target rungs. Every turn x height cell is benched (rounds 35-40);
 * the whole ladder on the front; on a turn, head and shoulders and far (round 50), except the 3/4 back L
 * (hs lands at the waist on a drawing) and the 3/4 back R (round 49 - far unbenched in these words). The
 * eye rung only as the first pass on the untouched source (round 45: Qwen freezes on eye words, and
 * chaining buys nothing).
 */
export const BENCHED_ZOOM = {
    front: ['eye', 'face', 'hs', 'waist', 'full', 'far'],
    tq_fl: ['hs', 'far'],
    tq_fr: ['hs', 'far'],
    pr_l: ['hs', 'far'],
    pr_r: ['hs', 'far'],
    tq_bl: ['far'],
    tq_br: ['hs'],
    back: ['hs', 'far'],
};

/**
 * Zoom moves benched on a low or high view (round 51): far on every one; hs only from above on a turned
 * view (a low hs lands at the waist, the rear ones on the seat; the front high hs keeps the feet in).
 */
export const BENCHED_ZOOM_HEIGHT = {
    lo: Object.fromEntries(MULTI_ANGLE_TURNS.map(t => [t, ['far']])),
    hi: Object.fromEntries(MULTI_ANGLE_TURNS.map(t => [t, t === 'front' ? ['far'] : ['hs', 'far']])),
};

const _benched = (turn, height) => (height === 'level' ? BENCHED_ZOOM : BENCHED_ZOOM_HEIGHT[height])?.[turn] || [];

/** What the user reads for each stop: the gizmo's readouts and the card's name. */
export const MULTI_ANGLE_LABELS = {
    turn: {
        front: 'Front', tq_fl: '3/4 front left', tq_fr: '3/4 front right', pr_l: 'Profile left', pr_r: 'Profile right',
        tq_bl: '3/4 back left', tq_br: '3/4 back right', back: 'Back',
    },
    height: { level: 'Eye level', lo: 'Low, looking up', hi: 'High, looking down' },
    zoom: {
        none: 'As in your picture', eye: 'Eyes', face: 'Face', hs: 'Head and shoulders', waist: 'Waist up',
        full: 'Whole body', far: 'Far away',
    },
};

/**
 * The gizmo's three sliders, left to right. TURN is a full turn round the person with the front in
 * the middle (Fabio 2026-10-25: Cosmo turns all the way round), so the back sits at both ends.
 * ZOOM is the ladder widest first: left always zooms out, right always zooms in (Fabio 2026-10-26).
 * Step 2 sets the picture's own framing on it; the Generate slide's copy is multiAngleZoomSlider.
 */
export const MULTI_ANGLE_SLIDERS = {
    turn: ['back', 'tq_bl', 'pr_l', 'tq_fl', 'front', 'tq_fr', 'pr_r', 'tq_br', 'back'],
    height: ['lo', 'level', 'hi'],
    zoom: [...MULTI_ANGLE_RUNGS].reverse(),
};

/** The framing matched in step 2; untouched = whole body, what the untouched Cosmo shows. */
export const multiAngleMatchedZoom = z => (MULTI_ANGLE_RUNGS.includes(z) ? z : 'full');

/**
 * The Generate slide's Zoom slider: the same ladder with the matched framing as 'none' (as in your
 * picture), so every rung left of it is wider and every rung right of it closer.
 * @param {string} [matched] - the zoom matched in step 2
 * @returns {string[]}
 */
export function multiAngleZoomSlider(matched) {
    const m = multiAngleMatchedZoom(matched);
    return MULTI_ANGLE_SLIDERS.zoom.map(r => (r === m ? 'none' : r));
}

/**
 * The Cosmo preview of a turn + height, from the same Blender camera as that stop's doll ref. Far
 * away is its own wider render per height; the zoom-in rungs are CSS on this one.
 */
export function multiAnglePreview(turn, height, zoom) {
    const h = height && height !== 'level' ? `_${height}` : '';
    return `assets/flows/multi-angle/previews/${turn}${h}${zoom === 'far' ? '_far' : ''}.webp`;
}

/** The view the user matched to their picture in step 2 (Fabio 2026-10-26); untouched = front, eye level. */
const _start = from => ({ turn: from?.turn || 'front', height: from?.height || 'level' });

/** Round 70: from a low or high rear 3/4 the front 3/4 of the other side stays on the start's side (0/4). */
const _crossesFront = (from, to) => (from === 'tq_br' && to === 'tq_fl') || (from === 'tq_bl' && to === 'tq_fr');

/** Round 70: the other height from a low or high start lands, except a low from a front high (head cut 2/2). */
const _otherHeightOk = start => start.height === 'lo' || start.turn !== 'front';

/**
 * The turns, heights and zooms a pick can take from the matched start: only what the bench proved
 * (flow-spec.md § DECISION), and without Qwen-Image 2.1 only what FLUX.3 runs alone. Only a moved slider
 * runs a pass (Fabio 2026-10-26), so the start decides what is left:
 * - an eye-level start: any turn (one direct pass from any view, rounds 52-56); on the start's own turn its
 *   heights with no turn pass (round 66, 46/46). Front from a turned start is the front pass alone.
 * - a low or high start (round 70): any turn at the start's height, except a rear start crossing to the front
 *   3/4 of the other side (0/4); on the start's own turn back to eye level, low -> high, high -> low on a
 *   side or back view (front high -> low cuts the head), or a zoom at its height (rounds 67-68: 16/16).
 * A low, and a height on a turned view, are Qwen edits; a zoom pass follows the other model each time, so
 * without Qwen only a one-pass zoom with no pass before it runs (the face and far rungs can take two passes).
 * @param {string} turn
 * @param {string} height
 * @param {{ qwen?: boolean, from?: { turn: string, height: string } }} [opts] - whether Qwen-Image 2.1 is
 *   installed; the matched start
 * @returns {{ turns: string[], heights: string[], zooms: string[] }} - `zooms` always holds 'none'
 */
export function multiAngleChoices(turn, height, { qwen = true, from } = {}) {
    const start = _start(from);
    if (start.height !== 'level') {
        const turns = MULTI_ANGLE_TURNS.filter(t => !_crossesFront(start.turn, t));
        if (turn !== start.turn) return { turns, heights: [start.height], zooms: ['none'] };
        const heights = MULTI_ANGLE_HEIGHTS.filter(h => h === start.height || h === 'level'
            || (_otherHeightOk(start) && (qwen || (start.turn === 'front' && h === 'hi'))));
        return { turns, heights,
            zooms: ['none', ...(qwen && height === start.height ? _benched(start.turn, start.height) : [])] };
    }
    const turns = MULTI_ANGLE_TURNS;
    if (turn === 'front' && start.turn !== 'front') return { turns, heights: ['level'], zooms: ['none'] };
    const heights = MULTI_ANGLE_HEIGHTS.filter(h => h === 'level' || qwen || (turn === 'front' && h === 'hi'));
    let rungs = _benched(turn, height);
    // Without Qwen: a one-pass zoom with no pass before it (after a FLUX.3 turn or front high, the zoom is Qwen).
    if (!qwen) rungs = turn === start.turn && height === 'level' ? rungs.filter(r => !['face', 'far'].includes(r)) : [];
    return { turns, heights, zooms: ['none', ...rungs] };
}

const SIDE = { tq_fl: 'left', tq_fr: 'right', pr_l: 'left', pr_r: 'right', tq_bl: 'left', tq_br: 'right' };
const OTHER = { left: 'right', right: 'left' };

/** How a Qwen height step names the turned view it keeps (rounds 30-35). */
const VIEW_NAME = {
    tq_fl: 'three-quarter side', tq_fr: 'three-quarter side', pr_l: 'side profile', pr_r: 'side profile',
    tq_bl: 'rear three-quarter', tq_br: 'rear three-quarter', back: 'back',
};

/** What a low on a turned view names as small near the top edge (rounds 31, 35). */
const HEAD_LOW = {
    tq_fl: p => `${p.poss} head, seen from below at the side,`, tq_fr: p => `${p.poss} head, seen from below at the side,`,
    pr_l: p => `${p.poss} head, seen from below in profile,`, pr_r: p => `${p.poss} head, seen from below in profile,`,
    tq_bl: p => `the back of ${p.poss} head`, tq_br: p => `the back of ${p.poss} head`, back: p => `the back of ${p.poss} head`,
};

/** The view a zoom pass keeps, said as it ran (MQ41_VIEWS, MQ50_KEPT). */
const ZOOM_KEPT = {
    front: p => `the view still looks at ${p.obj} straight from the front at eye level, as in the first image`,
    tq_fl: p => `the view still looks at ${p.obj} from ${p.poss} left side at eye level, almost side-on, the same view `
        + 'as in the first image',
    tq_fr: p => `the view still looks at ${p.obj} from ${p.poss} right side at eye level, almost side-on, the same view `
        + 'as in the first image',
    pr_l: p => `the view still looks at ${p.obj} exactly side-on from ${p.poss} left at eye level, in full profile, the `
        + 'same view as in the first image',
    pr_r: p => `the view still looks at ${p.obj} exactly side-on from ${p.poss} right at eye level, in full profile, the `
        + 'same view as in the first image',
    tq_bl: p => `the view still looks at ${p.obj} from behind ${p.poss} left shoulder at eye level, the same rear `
        + 'three-quarter view as in the first image',
    tq_br: p => `the view still looks at ${p.obj} from behind ${p.poss} right shoulder at eye level, the same rear `
        + 'three-quarter view as in the first image',
    back: p => `the view still looks at ${p.obj} from directly behind at eye level, the same back view as in the first `
        + 'image',
};

/** Where the camera is and the view's name, for a zoom pass on a low or high view (MQ51_SIDE). */
const ZOOM_SIDE = {
    front: p => [`in front of ${p.obj}`, 'front'],
    tq_fl: p => [`at ${p.poss} left side`, 'three-quarter side'],
    tq_fr: p => [`at ${p.poss} right side`, 'three-quarter side'],
    pr_l: p => [`exactly side-on from ${p.poss} left`, 'side profile'],
    pr_r: p => [`exactly side-on from ${p.poss} right`, 'side profile'],
    tq_bl: p => [`behind ${p.poss} left shoulder`, 'rear three-quarter'],
    tq_br: p => [`behind ${p.poss} right shoulder`, 'rear three-quarter'],
    back: p => [`directly behind ${p.obj}`, 'back'],
};

/** The view a zoom pass keeps on a low or high view, said as it ran (round 51). */
function _zoomKeptHeight(view, height, p) {
    const [where, name] = ZOOM_SIDE[view](p);
    const look = height === 'lo' ? `steeply up at ${p.obj} from just above the ground`
        : `steeply down at ${p.obj} from high above`;
    return `the view still looks ${look}, ${where}, the same ${height === 'lo' ? 'low' : 'high'} ${name} view as in `
        + 'the first image';
}

/** The views a head-and-shoulders zoom sees from behind (rounds 49-50). */
const REAR = ['tq_bl', 'tq_br', 'back'];

const KEEP_REF = ' Take only the viewing angle from the mannequin reference.';

/** Round 34: without it Qwen pulls the camera back on a high. */
const FRAME_HIGH = p => ` The camera stays as close to ${p.obj} as in the first image: ${p.subj} still ${p.verb('fills')} `
    + 'most of the frame height.';

/** Round 46: a zoom-out from a close-up with no outfit input continues what shows. */
const OUTFIT_REST = p => ` What the first image does not show of ${p.poss} outfit continues it plainly, in the same `
    + 'colours and style.';

/** Round 47: the optional second image carries the outfit only (a character sheet leaks nothing, round 48). */
const OUTFIT_REF = p => ` The second image shows the same ${p.subject} in ${p.poss} whole outfit: everything `
    + `${p.subj} ${p.verb('wears')} that the first image does not show comes from the second image. The second image is `
    + `only for ${p.poss} clothes - the view, framing, pose and place come from the first image and these words.`;

const PRONOUNS = {
    she: { subj: 'she', obj: 'her', poss: 'her' },
    he: { subj: 'he', obj: 'him', poss: 'his' },
    they: { subj: 'they', obj: 'them', poss: 'their' },
};

const _cap = s => s.charAt(0).toUpperCase() + s.slice(1);

/** "a, b and c". */
const _list = items => {
    const xs = items.filter(Boolean);
    return xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;
};

/** A place slot is one sentence for every view, or a map turn -> sentence. */
const _pick = (slot, turn) => (slot && typeof slot === 'object' ? slot[turn] : slot) || '';

/** The facts with their defaults, and the pronoun forms. */
function _subject(facts = {}) {
    const forms = PRONOUNS[facts.pronoun] || PRONOUNS.they;
    const plural = forms.subj === 'they';
    return {
        ...forms,
        Subj: _cap(forms.subj),
        Poss: _cap(forms.poss),
        subject: facts.subject || 'person',
        verb: v => (plural ? { is: 'are', fills: 'fill', stands: 'stand', wears: 'wear' }[v] : v),
        drawing: facts.drawing || null,
        feet: facts.feet || 'feet',
        wears: facts.wears || '',
    };
}

/** The keep clause of a full-figure step (turn or height; rounds 23-40). */
function _keep(p) {
    if (!p.drawing) {
        return ' The subject is still the real person from the first image, with their own head and hair, hands, '
            + 'clothes and shoes; keep their identity, pose, the place, the light and the image style of the first '
            + 'image unchanged.';
    }
    const d = p.drawing;
    return ` The subject is still the same drawn ${d.noun} ${p.subject} from the first image, with ${p.poss} own head and `
        + `hair, hands, clothes and shoes; keep ${p.poss} identity, pose, the place and the ${d.style} of the first image `
        + `- ${d.marks} - unchanged. It stays a drawing, not a photo.`;
}

/** The keep clause of a zoom-in rung: a close-up crops the hands and shoes out (round 43). */
function _keepClose(p) {
    if (!p.drawing) {
        return ' The subject is still the real person from the first image, with their own face, hair and clothes; '
            + 'keep their identity, the place, the light and the image style of the first image unchanged.';
    }
    const d = p.drawing;
    return ` The subject is still the same drawn ${d.noun} ${p.subject} from the first image, with ${p.poss} own face, hair `
        + `and clothes; keep ${p.poss} identity, the place, the light and the ${d.style} of the first image - ${d.marks} `
        + '- unchanged. It stays a drawing, not a photo.';
}

/** The face rung's keep (round 44) and the zoom-out rungs' keep (round 46): "It is still ..." */
function _keepIt(p, things, where) {
    const who = p.drawing ? `same drawn ${p.drawing.noun} ${p.subject}` : 'same real person';
    const style = p.drawing ? `the same ${p.drawing.style} - ${p.drawing.marks}. It stays a drawing, not a photo.`
        : 'the same photographic style.';
    return ` It is still the ${who} from the first image, with ${p.poss} own ${_list(things)}, in ${where} and ${style}`;
}

/**
 * A turn for two or more people (rounds 60-64): one-person words drop a person (3/6) or turn them to face
 * each other; naming the group keeps everyone (28/28). Right and rear stops land; on a photo the left
 * stops still do not (0/4).
 */
function _groupTurnWords(turn, p, n) {
    const all = n === 2 ? 'both' : 'all';
    const side = SIDE[turn];
    const neither = n === 2 ? 'Neither turns toward the other' : 'No one turns toward another';
    const head = `Shift the viewpoint of the first image around the ${n === 2 ? 'two' : n} people to match the mannequin `
        + 'reference in the second image: ';
    let words;
    if (turn === 'tq_fl' || turn === 'tq_fr') {
        words = `the camera has moved a long way round to their ${side}, so ${all} people are now seen from their ${side} `
            + `side, each body turned well away from the view, almost side-on, ${all} facing frame-${side}: each one's `
            + `${side} shoulder, ${side} arm and ${side} leg are nearest the view, each ${OTHER[side]} shoulder is hidden `
            + `behind the chest, their feet point toward frame-${side}, and each face is seen in three-quarter profile `
            + `with the far eye barely showing. ${neither}; ${all} look the same way.`;
    } else if (turn === 'pr_l' || turn === 'pr_r') {
        words = `the camera has moved a quarter of the way round to their ${side}, so ${all} people are now seen exactly `
            + `side-on from their ${side}, each in full profile facing frame-${side}: each face is a clean profile, one `
            + `eye, the nose and the lips seen in outline. ${neither}; ${all} look the same way, toward `
            + `frame-${side}.`;
    } else if (turn === 'tq_bl' || turn === 'tq_br') {
        words = `a three-quarter rear view from behind ${all} people and 45 degrees to their ${side}. ${_cap(all)} face `
            + `away at an angle toward frame-${side}, their backs and ${side} shoulders nearer the view, the backs of their `
            + `heads and only the edge of each cheek showing. ${_cap(all)} people stay in the picture.`;
    } else {
        words = `a view from directly behind ${all} people at the same height and distance. ${_cap(all)} now face away; `
            + 'the backs of their heads, their backs and the backs of their legs are in the frame, side by side, and the '
            + `place around them is seen from the opposite side. ${_cap(all)} people stay in the picture.`;
    }
    const d = p.drawing;
    const who = d ? `the same ${n === 2 ? 'two' : n} drawn ${d.noun} characters` : `the same ${n === 2 ? 'two' : n} real people`;
    const keep = d ? `the place and the ${d.style} of the first image - ${d.marks} - unchanged. It stays a drawing, not a `
        + 'photo.' : 'the place, the light and the image style of the first image unchanged.';
    return head + words + (turn === 'back' ? '' : ' The place around them is seen from that angle.')
        + ` Take only the viewing angle from the mannequin reference; it shows one figure, the picture keeps ${all.toUpperCase()} `
        + `people. They are still ${who} from the first image, each with their own head and hair, hands, clothes and `
        + `shoes; keep ${all === 'both' ? 'both' : 'all their'} identities, their poses, ${keep}`;
}

function _turnWords(turn, p, facts) {
    if (facts.people > 1) return _groupTurnWords(turn, p, facts.people);
    const head = 'Shift the viewpoint of the first image around the subject to match the mannequin reference in the '
        + 'second image: ';
    const side = SIDE[turn];
    const reveal = _pick(facts.turnReveal, turn);
    let words;
    if (turn === 'tq_fl' || turn === 'tq_fr') {
        words = `${head}the camera has moved a long way round to ${p.poss} ${side}, so ${p.subj} ${p.verb('is')} now seen `
            + `from ${p.poss} ${side} side. ${p.Poss} whole body is turned well away from the view, almost side-on, facing `
            + `frame-${side}: ${p.poss} ${side} shoulder, ${side} arm, ${side} hip and ${side} leg are nearest the view, `
            + `${p.poss} ${OTHER[side]} shoulder is hidden behind ${p.poss} chest, ${p.poss} feet point toward frame-${side}, `
            + `and ${p.poss} face is seen in three-quarter profile with the far eye barely showing.`
            + (reveal ? ` ${reveal}` : ` The place around ${p.obj} is seen from that angle.`);
    } else if (turn === 'pr_l' || turn === 'pr_r') {
        words = `${head}the camera has moved a quarter of the way round to ${p.poss} ${side}, so ${p.subj} `
            + `${p.verb('is')} now seen exactly side-on from ${p.poss} ${side}, in full profile facing frame-${side}. `
            + `${p.Poss} ${side} shoulder, ${side} arm, ${side} hip and ${side} leg are nearest the view, ${p.poss} `
            + `${OTHER[side]} side is hidden behind ${p.poss} body, ${p.poss} feet point toward frame-${side}, and `
            + `${p.poss} face is a clean profile: one eye, the nose and the lips seen in outline.`
            + (reveal ? ` ${reveal}` : ` The place around ${p.obj} is seen from that angle.`);
    } else if (turn === 'tq_bl' || turn === 'tq_br') {
        words = `${head}a three-quarter rear view from behind them and 45 degrees to their ${side}. They face away at an `
            + `angle toward frame-${side}, their back and ${side} shoulder nearer the view, the back of their head and `
            + 'only the edge of their cheek showing'
            + (reveal ? `. ${reveal}` : '; the place around them is seen from that angle.');
    } else {
        words = `${head}a view from directly behind them at the same height and distance. They now face away; the back `
            + 'of their head, their back and the backs of their legs are in the middle of the frame, and the place '
            + 'around them is seen from the opposite side.';
    }
    const details = _pick(facts.details, turn);
    return words + (details ? ` ${details}` : '') + KEEP_REF + _keep(p);
}

/** The front pass: the end view only, from whatever view the picture is (rounds 52-56, "B"; 5/5 front). */
function _frontWords(p) {
    return 'Shift the viewpoint of the first image around the subject to match the mannequin reference in the second '
        + `image: ${p.subj} ${p.verb('is')} seen straight from the front at eye level, facing the camera: ${p.poss} whole `
        + `face with both eyes, ${p.poss} chest and both shoulders face the view, and ${p.poss} feet point toward the `
        + `camera. The place around ${p.obj} is seen from that angle.` + KEEP_REF + _keep(p);
}

/** Round 70: a turn from a low or high start keeps the start's height. */
const STAY = {
    lo: p => ` The camera stays as low as in the first image, just above the ground, looking steeply up at ${p.obj}: `
        + `${p.poss} ${p.feet} and legs are large at the bottom of the frame, ${p.poss} body rises and narrows toward `
        + `the top and ${p.poss} whole head is small near the top of the frame, still inside it.`,
    hi: p => ` The camera stays as high as in the first image, looking steeply down at ${p.obj}: the top of ${p.poss} `
        + `head and ${p.poss} shoulders are large near the top of the frame, ${p.poss} body narrows downward, `
        + `${p.poss} ${p.feet} are small near the bottom edge and the ground fills the background.`,
};

/**
 * Round 70: the user's other picture (the Whole Outfit slot) as image 3, after the doll. Without it a turn
 * from a low start makes up clothes the picture never shows (2/2); with it back to eye level from a TURNED
 * start copies that picture's own view (6/6), so the eye-level pass takes it only from a front start.
 */
const THIRD = {
    view: p => ` The third image shows the same ${p.subject} from another view: use it only for who ${p.subj} `
        + `${p.verb('is')} - ${p.poss} face, hair, body and clothes; the view, pose and place come from the first `
        + 'image, the viewpoint from the mannequin reference.',
    level: p => ` The third image shows the same ${p.subject} at eye level: use it for ${p.poss} face, hair, body and `
        + 'clothes and for how the place looks at eye level; the viewpoint comes from the mannequin reference and '
        + 'these words.',
};

/** Words put in before the keep tail (KEEP_REF onward). */
const _beforeKeep = (prompt, words) => {
    const at = prompt.indexOf(KEEP_REF);
    return prompt.slice(0, at) + words + prompt.slice(at);
};

/** Back to eye level from a low or high start (rounds 67-68 words, FLUX.3 + the room doll; round 70). */
function _levelWords(start, p) {
    const view = start.turn === 'front' ? `keep ${p.obj} seen straight from the front, as in the first image`
        : `keep the same ${VIEW_NAME[start.turn]} view of the ${p.subject} as in the first image`;
    const move = start.height === 'lo' ? 'rises from just above the ground' : 'comes down from high above';
    const was = start.height === 'lo' ? 'no longer a view up into the sky' : 'no longer a view down onto the ground';
    return 'Shift the viewpoint of the first image to match the mannequin reference in the second image: '
        + `${view}, but the view ${move} to ${p.poss} eye level. The camera now looks straight at ${p.obj}, level - not `
        + `up and not down: ${p.poss} whole body from head to toe stands upright at its natural proportions, ${p.poss} `
        + `head near the top of the frame and ${p.poss} ${p.feet} near the bottom, and the place behind ${p.obj} is seen `
        + `straight on at eye level, its horizon level behind ${p.poss} chest, ${was}.` + KEEP_REF + _keep(p);
}

/**
 * A pick from a low or high start that moves the turn or the height (round 70, one person): a turn at the
 * start's height, or on the start's own turn back to eye level or the other height. One pass, never with a zoom.
 */
function _fromHeightPlan(turn, height, start, pick, p, facts, zoomMoved) {
    const no = reason => ({ ok: false, reason });
    const where = start.height === 'lo' ? 'low' : 'high';
    if (facts.people > 1) return no(`From a ${where} view only one person is benched.`);
    if (zoomMoved) return no(`From a ${where} view the zoom runs alone.`);
    const picture = !!pick.outfit?.ref;
    if (turn !== start.turn) {
        if (height !== start.height) return no(`From a ${where} view a turn keeps that height.`);
        if (_crossesFront(start.turn, turn)) return no(`Turning to ${turn} from a ${where} ${start.turn} is not benched.`);
        const words = turn === 'front' ? _frontWords(p).replace(' at eye level', '') : _turnWords(turn, p, facts);
        return { ok: true, steps: [{ kind: turn === 'front' ? 'front' : 'turn', model: FLUX3,
            ref: turn === 'front' && start.height === 'hi' ? 'room/front_hi' : `plain/${turn}_${start.height}`,
            outfitRef: picture, prompt: _beforeKeep(words, STAY[start.height](p) + (picture ? THIRD.view(p) : '')) }] };
    }
    if (height === 'level') {
        const third = picture && start.turn === 'front';
        const words = _levelWords(start, p);
        return { ok: true, steps: [{ kind: 'height', model: FLUX3, ref: `room/${start.turn}`, outfitRef: third,
            prompt: third ? _beforeKeep(words, THIRD.level(p)) : words }] };
    }
    if (!_otherHeightOk(start)) return no('A low from a high front view is not benched.');
    const model = turn === 'front' && height === 'hi' ? FLUX3 : QWEN;
    const words = _heightWords(turn, height, p, facts);
    return { ok: true, steps: [{ kind: 'height', model, ref: `${model === FLUX3 ? 'room' : 'plain'}/${turn}_${height}`,
        outfitRef: picture, prompt: picture ? _beforeKeep(words, THIRD.view(p)) : words }] };
}

function _heightWords(turn, height, p, facts) {
    const ground = facts.ground || 'the ground';
    if (turn === 'front' && height === 'hi') {
        return 'Shift the viewpoint of the first image up to match the mannequin reference in the second image: a high '
            + 'view from above and in front of the subject, looking steeply down at them. The top of their head and '
            + 'their shoulders are now large near the top of the frame, their body narrows downward, their feet are '
            + 'small on the ground near the bottom edge, and the ground fills the background behind them.'
            + KEEP_REF + _keep(p);
    }
    if (turn === 'front') {
        const reveal = facts.frontLowReveal || _pick(facts.lowReveal, turn);
        return 'Shift the viewpoint of the first image down to match the mannequin reference in the second image: a '
            + `worm's-eye view from just above ${ground} in front of the ${p.subject}, looking steeply up at ${p.obj}. `
            + `${p.Poss} ${facts.frontLowLegs || `${p.feet} and legs`} are now large at the bottom of the frame, `
            + `${p.poss} body rises and narrows toward the top, the underside of ${p.poss} chin shows, ${p.poss} head is `
            + `small near the top edge${reveal ? `, and ${reveal}` : ''}.` + KEEP_REF + _keep(p);
    }
    const kept = `keep the same ${VIEW_NAME[turn]} view of the ${p.subject} as in the first image`;
    if (height === 'lo') {
        const reveal = _pick(facts.lowReveal, turn);
        // Round 67: on a profile the old words cut the head off the top 5/8; the headroom words keep it 8/8.
        const profile = turn === 'pr_l' || turn === 'pr_r';
        const head = profile ? `is small near the top of the frame with a clear gap above it: ${p.poss} whole head and `
            + 'hair are inside the frame, below the top edge' : `is small near the top edge with ${p.poss} whole head still in frame`;
        return 'Shift the viewpoint of the first image down to match the mannequin reference in the second image: '
            + `${kept}, but the view drops to just above ${ground}, looking steeply up at ${p.obj}. ${p.Poss} ${p.feet} `
            + `and legs are now large at the bottom of the frame, ${p.poss} body rises and narrows toward the top, `
            + `${HEAD_LOW[turn](p)} ${head}${reveal ? `, and ${reveal}` : ''}.`
            + (profile ? ` The whole ${p.subject} fits in the frame from ${p.poss} ${p.feet} to the top of ${p.poss} head.` : '')
            + KEEP_REF + _keep(p);
    }
    const reveal = _pick(facts.highReveal, turn);
    return 'Shift the viewpoint of the first image up to match the mannequin reference in the second image: '
        + `${kept}, but the view rises high above ${p.obj}, looking steeply down at ${p.obj}. The top of ${p.poss} head `
        + `and ${p.poss} shoulders are now large near the top of the frame, ${p.poss} body narrows downward, ${p.poss} `
        + `${p.feet} are small on the ground near the bottom edge${reveal ? `, and ${reveal}` : ''}.`
        + FRAME_HIGH(p) + KEEP_REF + _keep(p);
}

/**
 * One zoom pass to `rung`. `fromClose`: the input shows less of the body than a whole figure, so a
 * whole-body or far rung must make up the unseen outfit - from the user's words, their second picture,
 * or plainly (rounds 46-48).
 */
function _zoomWords(view, rung, p, facts, { fromClose = false, outfit = {}, height = 'level' } = {}) {
    if (height !== 'level') return _zoomWordsHeight(view, height, rung, p, facts);
    const kept = ZOOM_KEPT[view](p);
    const near = facts.near || 'the place';
    if (rung === 'eye') {
        return `Zoom in on the first image, keeping exactly the same viewing angle and perspective: ${kept}. The view `
            + `is now an extreme close-up of ${p.poss} right eye, the one on frame-left: the eye, its lashes and eyebrow `
            + 'fill the frame, with a little of the skin and hair around it. The eye keeps its own colour and shape '
            + 'from the first image.' + _keepClose(p);
    }
    if (rung === 'face') {
        return `Frame ${p.poss} face: ${p.poss} face fills the whole frame, seen straight from the front. The top of `
            + `${p.poss} head and ${p.poss} chin are cut by the frame edges, ${p.poss} cheeks and hair touch the sides; no `
            + 'neck, shoulders or clothes show.'
            + _keepIt(p, ['face', 'eyes', !p.drawing && 'skin', 'hair', p.wears], 'the same light');
    }
    if (rung === 'hs') {
        const rear = REAR.includes(view);
        return `Zoom in on the first image, keeping exactly the same viewing angle and perspective: ${kept}. The view `
            + `is now a head-and-shoulders close-up${rear ? ' from behind' : ''}: ${rear ? 'the back of ' : ''}${p.poss} `
            + `head, ${rear ? `${p.poss} ` : ''}neck and the top of ${p.poss} shoulders fill the frame, cropped just below `
            + `the shoulders, with ${p.poss} whole head in frame; only a little of ${near} shows `
            + `${rear ? 'around' : 'behind'} ${p.obj}.` + _keepClose(p);
    }
    const open = 'Zoom out from the first image, keeping exactly the same viewing angle, height and perspective: '
        + `${kept}. `;
    const keep = _keepIt(p, ['face', 'hair', p.wears, 'clothes'], 'the same place and light');
    if (rung === 'waist') {
        return `${open}Frame ${p.obj} from the waist up: ${p.poss} head, arms and upper body fill the frame, cropped at `
            + `the waist, with more of ${near} around ${p.obj}.` + keep;
    }
    const words = String(outfit.words || '').trim();
    const rest = !fromClose ? '' : (words ? ` ${words}` : '') + (outfit.ref ? OUTFIT_REF(p) : '')
        || OUTFIT_REST(p);
    if (rung === 'full') {
        return `${open}Frame ${p.poss} whole body: ${p.subj} ${p.verb('stands')} seen from head to shoes, ${p.poss} whole `
            + `figure filling the height of the frame, with ${near} around ${p.obj}.` + rest + keep;
    }
    return `${open}Frame the whole place: the camera is pulled far back, much further than in the first image. `
        + `${p.Subj} ${p.verb('is')} now a small figure in the middle of the frame, about a quarter of the frame's height, `
        + `seen from head to shoes${facts.far ? `, ${facts.far}` : ''}. Most of the frame is the place around ${p.obj}, `
        + `not ${p.obj}.` + rest + keep;
}

/** One zoom pass on a low or high view, from its whole figure (round 51: hs and far). */
function _zoomWordsHeight(view, height, rung, p, facts) {
    const kept = _zoomKeptHeight(view, height, p);
    if (rung === 'hs') { // benched from above only
        const rear = REAR.includes(view);
        return 'Zoom in on the first image, keeping exactly the same viewing angle, height and perspective: '
            + `${kept}. The view is now a head-and-shoulders close-up seen from above`
            + `${rear ? ' and from behind' : ''}: ${rear ? `the back of ${p.poss} head, ${p.poss} neck` : `${p.poss} head, neck`}`
            + ` and the top of ${p.poss} shoulders fill the frame, cropped just below the shoulders, with ${p.poss} whole `
            + `head in frame; only a little of ${facts.ground} shows around ${p.obj}.` + _keepClose(p);
    }
    const far = height === 'lo' ? facts.farLow : facts.farHigh;
    return 'Zoom out from the first image, keeping exactly the same viewing angle, height and perspective: '
        + `${kept}. Frame the whole place: the camera is pulled far back, much further than in the first image. `
        + `${p.Subj} ${p.verb('is')} now a small figure in the middle of the frame, about a quarter of the frame's height, `
        + `seen from head to shoes${far ? `, ${far}` : ''}. Most of the frame is the place around ${p.obj}, not ${p.obj}.`
        + _keepIt(p, ['face', 'hair', p.wears, 'clothes'], 'the same place and light');
}

/**
 * The describer's question: one `KEY: value` line per fact, read off the source before any pass. The
 * examples are the bench sources' own words, so a scene answers in the shape the bench proved.
 */
export const MULTI_ANGLE_DESCRIBE_ASK = 'Look at this picture of a person. Answer in exactly these lines, each '
    + '"KEY: value", and nothing else. Plain English, lower case, no full stop at the end. The examples only show '
    + 'the form of an answer: name what is in THIS picture.\n'
    + 'PEOPLE: how many people the picture shows, as a number, like 1 or 2\n'
    + 'SUBJECT: one word for the person: woman, man, girl, boy or person\n'
    + 'PRONOUN: she, he or they\n'
    + 'FRAMING: how much of the person shows: eye (one eye fills the picture), face, hs (head and shoulders), '
    + 'waist (from the waist up), full (head to feet), far (small in a big place)\n'
    + 'STYLE: photo, or the kind of drawing in one word: anime, cartoon, comic, watercolour, painting, render\n'
    + 'DRAWING_STYLE: a drawing\'s style in a few words, like "flat 2D anime drawing style"; a photo: none\n'
    + 'DRAWING_MARKS: how a drawing is drawn, like "clean outlines, flat colours"; a photo: none\n'
    + 'FEET: what is on their feet, plural, like sneakers, boots, sandals; bare feet or not shown: feet\n'
    + 'LEGS: what is on their feet and legs, like "white sneakers and jeans"; not shown: feet and legs\n'
    + 'WEARS: jewellery on their face or ears, like earrings; none: none\n'
    + 'PLACE: plain (a studio backdrop or a plain wall) or scene (a real place)\n'
    + 'PLACE_NAME: the place, starting with "the", like "the street" or "the grey backdrop"\n'
    + 'GROUND: what they stand on, starting with "the", like "the street surface" or "the grey studio floor"\n'
    + 'ABOVE: what a camera on the ground looking up past them would see above them, starting with "the", like '
    + '"the open blue sky with the power lines and the shop signs" or "the dark studio ceiling with a softbox light"\n'
    + 'FROM_ABOVE: for a scene, always answer: its ground and the bottoms of things as a camera high above would '
    + 'see them, like "the paving with its painted lines, the kerb, and the bases of the shop fronts"; only a plain '
    + 'backdrop: none\n'
    + 'SIDES: what lines both sides of a scene, like "the shop fronts"; plain: none\n'
    + 'LEFT: one or two single objects at the left edge of the picture, like "the red vending machine and the blue '
    + 'awning" - never the SIDES again; plain, or the same thing at both edges: none\n'
    + 'RIGHT: one or two single objects at the right edge of the picture, the same way, never the same as LEFT; '
    + 'plain, or the same thing at both edges: none\n'
    + 'FAR: the rest of the place that newly shows around them when the camera moves far back, starting with '
    + '"with", like "with the full height of the shop fronts and their signs at both sides and much more of the '
    + 'street in front of her" for a street, or "with the whole studio around her - the edges of the backdrop, '
    + 'light stands at both sides, and the bare floor in front of her" for a studio\n'
    + 'FAR_LOW: the same, for a camera far back and low on the ground looking up, starting with "with", like "with '
    + 'the full height of the shop fronts rising at both sides and the open sky with the power lines above her" or '
    + '"with the whole studio around her seen from below - the light stands and softboxes at both sides and the dark '
    + 'studio ceiling above her"\n'
    + 'FAR_HIGH: the same, for a camera far back and high above looking down, starting with "with", like "with much '
    + 'more of the paving around her seen from above, the kerb and the bases of the shop fronts" or "with much more '
    + 'of the bare studio floor around her seen from above, the edges of the grey backdrop paper and the feet of the '
    + 'light stands"\n'
    + 'ONE_SIDED: things worn on only one side of the body, as "thing | left or right (their own side) | where", '
    + 'separated by ";", like "brown bag | right | hip; wristwatch | left | wrist"; none: none';

/**
 * Try to Match (step 2): the describe ask plus the view-read lines, VERBATIM as the view read ran them
 * (validation.md "VIEW READ", rounds 1 + 3, gemma-4 on 115 pictures of known view): front / turned / rear
 * 114/115, the side 74/75, rear 3/4 vs back 37/42, height 90/115. It cannot tell a 3/4 front from a
 * profile (it reads a profile) or always see a high camera, so it is a guess the user corrects.
 */
export const MULTI_ANGLE_VIEW_ASK = MULTI_ANGLE_DESCRIBE_ASK
    + '\nFACING: which way the person faces in the picture, said in picture directions (frame-left = the left '
    + 'edge of the picture as you look at it): front (facing the camera), front-left (turned partly toward '
    + 'frame-left, most of the face still showing), left (exactly side-on, facing frame-left, a clean profile), '
    + 'back-left (turned away, facing partly toward frame-left, mostly the back of the head showing), back '
    + '(the back turned to the camera), front-right, right, back-right (the same, toward frame-right)\n'
    + 'CAMERA: where the camera is: level (at their eye level), low (near the ground looking up at them), high '
    + '(above them looking down)'
    + '\nNOSE: which side of the IMAGE the tip of the person\'s nose points toward, as you look at the image: camera '
    + '(straight at you), image-left, image-right, hidden (the face is turned away)\n'
    + 'FAR_CHEEK: beyond the nose, can you see the cheek on the FAR side of the face (the side turned away from the '
    + 'camera): yes (some far cheek shows past the nose), no (the nose is the edge of the face), hidden (face turned away)\n'
    + 'NOSE_OUTLINE: is the tip of the nose drawn against the background, sticking out past the edge of the face: yes or no\n'
    + 'MOUTH_CORNERS: how many corners of the mouth you can see: two, one, none\n'
    + 'EARS: how many of the person\'s ears you can see: two, one, none (covered by hair counts as seen if you can tell '
    + 'where it is)\n'
    + 'CHEEK_EDGE: if the back of the head faces the camera, does an edge of a cheek, eyelashes or the tip of the nose '
    + 'show past the outline of the head, and on which side of the IMAGE: none, image-left, image-right; '
    + 'face-visible if the face itself shows\n'
    + 'FLOOR_BEHIND: does the floor or ground fill the background behind the person, seen from above (no horizon, '
    + 'no sky or ceiling behind their head): yes or no\n'
    + 'HEAD_BIG: does the camera look down on them so their head and shoulders look large and their body shrinks '
    + 'toward their feet: yes or no';

const _IMAGE_SIDE = { 'image-left': 'l', 'image-right': 'r' };
const _FACING_SIDE = { 'front-left': 'l', left: 'l', 'back-left': 'l', 'front-right': 'r', right: 'r', 'back-right': 'r' };

/**
 * The view an answer to MULTI_ANGLE_VIEW_ASK shows, by the rules round 3 was rescored with (validation.md
 * "VIEW READ"): the FACING group; a side view's side from the nose; a rear 3/4 = a far cheek, one ear, a cheek
 * edge or FACING back-left/right, its side from the cheek edge, else FACING; low from CAMERA; high = CAMERA high
 * or the floor filling the background.
 * @param {string} text
 * @returns {{ turn: string, height: string, zoom: string }} - `zoom` = the read framing, or 'none'
 */
export function parseMultiAngleView(text) {
    const a = {};
    for (const line of String(text || '').split(/\r?\n/)) {
        const m = line.match(/^\s*[-*]?\s*([A-Za-z_]+)\s*:\s*(.*?)\s*$/);
        if (m) a[m[1].toUpperCase()] = m[2].replace(/^["']|["'.]+$/g, '').trim().toLowerCase();
    }
    const v = k => a[k] || '';
    const facing = v('FACING');
    let turn = 'front';
    if (facing.startsWith('back')) {
        const lr = _IMAGE_SIDE[v('CHEEK_EDGE')] || _FACING_SIDE[facing];
        const threeQ = v('FAR_CHEEK').startsWith('yes') || v('EARS') === 'one' || !!_IMAGE_SIDE[v('CHEEK_EDGE')] || !!lr;
        turn = threeQ && lr ? `tq_b${lr}` : 'back';
    } else if (facing && facing !== 'front') {
        const lr = _IMAGE_SIDE[v('NOSE')] || _FACING_SIDE[facing] || 'l';
        turn = v('FAR_CHEEK').startsWith('yes') ? `tq_f${lr}` : `pr_${lr}`;
    }
    const cam = v('CAMERA');
    const high = cam === 'high' || v('FLOOR_BEHIND').startsWith('yes');
    const framing = v('FRAMING');
    return {
        turn,
        height: cam === 'low' ? 'lo' : high ? 'hi' : 'level',
        zoom: MULTI_ANGLE_RUNGS.includes(framing) ? framing : 'none',
    };
}

const _none =v => (!v || /^(none|n\/a|-|no)$/i.test(v) ? '' : v);
const _are = list => (/ and |, /.test(list) ? 'are' : 'is');

/** The rear 3/4 one-sided details (round 38-39's shape): which side is near, where each thing lands. */
function _oneSided(items, near, p) {
    const far = OTHER[near];
    const close = items.filter(i => i.side === near);
    const away = items.filter(i => i.side === far);
    const words = [];
    if (close.length) {
        words.push(`${p.Poss} ${near} side is the one nearest the view: ${_list(close.map(i => `the ${i.thing} at `
            + `${p.poss} ${near} ${i.where} shows at frame-${near} beside ${p.poss} near ${near} arm`))}.`);
    }
    for (const i of away) {
        words.push(`The ${i.thing} stays on ${p.poss} ${far.toUpperCase()} ${i.where}, on the far side, hidden behind `
            + `${p.poss} body.`);
    }
    return words.join(' ');
}

/**
 * The describer's answer as the builder's `facts`, and the source's framing (a rung).
 * @param {string} text - the answer to MULTI_ANGLE_DESCRIBE_ASK
 * @returns {{ facts: Object, framing: string }}
 */
export function parseMultiAngleFacts(text) {
    const a = {};
    for (const line of String(text || '').split(/\r?\n/)) {
        // Keys in any case: gemma-4 sometimes answers the whole list in lower case (round 66).
        const m = line.match(/^\s*[-*]?\s*([A-Za-z_]+)\s*:\s*(.*?)\s*\.?\s*$/);
        if (m) a[m[1].toUpperCase()] = m[2].replace(/^"(.*)"$/, '$1').trim();
    }
    const pronoun = PRONOUNS[String(a.PRONOUN).toLowerCase()] ? String(a.PRONOUN).toLowerCase() : 'they';
    const style = String(a.STYLE || 'photo').toLowerCase();
    // Unreadable = one: one person is what the bench proved, and only two or more skip the front pass.
    const people = parseInt(a.PEOPLE, 10);
    const facts = {
        people: people > 1 ? people : 1,
        subject: (_none(a.SUBJECT) || 'person').toLowerCase().split(/[\s,;/]+/)[0],
        pronoun,
        feet: _none(a.FEET) || 'feet',
        frontLowLegs: _none(a.LEGS) || undefined,
        wears: _none(a.WEARS),
        ground: _none(a.GROUND) || 'the ground',
        near: _none(a.PLACE_NAME) || 'the place',
        far: _none(a.FAR),
        farLow: _none(a.FAR_LOW),
        farHigh: _none(a.FAR_HIGH),
    };
    if (style !== 'photo') {
        facts.drawing = { noun: style, style: _none(a.DRAWING_STYLE) || `${style} drawing style`,
            marks: _none(a.DRAWING_MARKS) || 'its own lines and colours' };
    }
    const p = _subject(facts);
    const place = facts.near;
    const above = _none(a.ABOVE);
    // The ask says the same thing at both edges is 'none'; gemma-4 answers it twice anyway (a fence both sides),
    // and the turn words would then show and hide the same thing.
    const same = _none(a.LEFT).toLowerCase() === _none(a.RIGHT).toLowerCase();
    const left = same ? '' : _none(a.LEFT);
    const right = same ? '' : _none(a.RIGHT);
    const sides = _none(a.SIDES);
    const scene = /^scene/i.test(a.PLACE || '') && left && right && sides;
    if (scene) {
        const slant = (side, marks, gone, run) => `${_cap(place)} is now seen at a slant from ${p.poss} ${side} side: `
            + `behind ${p.obj} ${sides} on ${p.poss} ${OTHER[side]}, with ${marks}, fill the background seen at an angle, `
            + `${place} ${run}; ${gone} ${_are(gone)} no longer in view.`;
        const across = (side, marks, gone) => `${_cap(place)} now runs across the frame from side to side: behind `
            + `${p.obj} ${sides} on ${p.poss} ${OTHER[side]}, with ${marks}, fill the background seen straight on; `
            + `${gone} ${_are(gone)} no longer in view.`;
        // The source faces the camera: her right is frame-left, so a camera moved to her left sees the LEFT things.
        facts.turnReveal = {
            tq_fl: slant('left', left, right, 'running away toward frame-right'),
            tq_fr: slant('right', right, left, 'running away toward frame-left'),
            tq_bl: slant('left', left, right, 'running on toward frame-left'),
            tq_br: slant('right', right, left, 'running on toward frame-right'),
            pr_l: across('left', left, right),
            pr_r: across('right', right, left),
        };
        const fromAbove = _none(a.FROM_ABOVE) || facts.ground;
        const high = marks => `around ${p.obj} ${place} fills the background seen from above: ${fromAbove} with `
            + `${marks} seen from above at the edge of the frame`;
        facts.highReveal = { tq_fl: high(left), pr_l: high(left), tq_bl: high(left), tq_fr: high(right),
            pr_r: high(right), tq_br: high(right), back: high(`${left} on one side and ${right} on the other`) };
        if (above) {
            facts.lowReveal = `above ${p.obj} ${above} now fills the background`;
            facts.frontLowReveal = `${facts.lowReveal}, ${sides} leaning inward at both sides`;
        }
    } else {
        facts.highReveal = `${facts.ground} fills the background behind ${p.obj}`;
        if (above) {
            facts.lowReveal = `above ${p.obj} ${above}, instead of ${place}, now fills the background`;
            facts.frontLowReveal = `above ${p.poss} head ${above} now shows instead of ${place}`;
        }
    }
    const items = _none(a.ONE_SIDED).split(';').map((s) => {
        const [thing, side, where] = s.split('|').map(x => x.trim().toLowerCase());
        return thing && OTHER[side] && where ? { thing, side, where } : null;
    }).filter(Boolean);
    // Only the 3/4 back R needs it: the mirror audit found every other stop right (rounds 38-39).
    if (items.length) facts.details = { tq_br: _oneSided(items, 'right', p) };
    const framing = MULTI_ANGLE_RUNGS.includes(String(a.FRAMING).toLowerCase()) ? String(a.FRAMING).toLowerCase()
        : 'full';
    return { facts, framing };
}

/**
 * The zoom passes from the input's framing to the target rung: one pass, except the face (head and
 * shoulders first, round 44) and far from closer than a whole body (the whole body first - round 49:
 * small 6/6 and the outfit kept, where one pass drifts).
 */
export function zoomRungs(from, to) {
    const a = MULTI_ANGLE_RUNGS.indexOf(from);
    const b = MULTI_ANGLE_RUNGS.indexOf(to);
    if (a < 0 || b < 0 || a === b) return [];
    if (to === 'face' && a > MULTI_ANGLE_RUNGS.indexOf('hs')) return ['hs', 'face'];
    if (to === 'far' && a < MULTI_ANGLE_RUNGS.indexOf('full')) return ['full', 'far'];
    return [to];
}

/**
 * The passes one pick runs, each with its model, its image 2 and its prompt.
 * @param {Object} pick - { turn, height, from?: { turn, height }, zoom?: { from, to }, outfit?: { words, ref } };
 *   `from` = the view the user matched to the picture in step 2 (untouched = front, eye level); `zoom.from` is
 *   the input's framing (a rung), matched in step 2 or read from the source.
 * Only what moved from the start runs a pass (Fabio 2026-10-26): a turn pass when the turn moved, a height
 * pass when the height moved (round 66: none on an unturned view keeps it 46/46), a zoom pass when the zoom
 * moved. Turning a turned picture to the Front is the front pass for one person, alone (front from any view
 * 13/13, rounds 54, 57, 59); two or more people do not get it, as a front pass turns everyone to the camera.
 * A low or high start: one pass - a turn at its height, back to eye level, the other height, or a zoom
 * (rounds 67-70, `_fromHeightPlan`).
 * @param {Object} facts - from the source: { people, subject, pronoun, drawing?: { noun, style, marks }, feet,
 *   frontLowLegs, ground, lowReveal, frontLowReveal, highReveal, turnReveal, details, near, far, farLow, farHigh,
 *   wears };
 *   a place slot is a sentence, or a map turn -> sentence.
 * @returns {{ ok: true, steps: Array<{ kind, model, ref, outfitRef?, prompt }> } | { ok: false, reason: string }}
 *   `ref` = the doll render under assets/flows/multi-angle/refs/ (image 2), null for a zoom pass;
 *   `outfitRef` = the user's outfit picture goes in after the doll: image 3 of a pass with a `ref` (round 70),
 *   image 2 of a zoom pass.
 */
export function multiAnglePlan(pick = {}, facts = {}) {
    const turn = pick.turn || 'front';
    const height = pick.height || 'level';
    if (!MULTI_ANGLE_TURNS.includes(turn) || !MULTI_ANGLE_HEIGHTS.includes(height)) {
        return { ok: false, reason: `Unknown stop ${turn} / ${height}.` };
    }
    const start = _start(pick.from);
    if (!MULTI_ANGLE_TURNS.includes(start.turn) || !MULTI_ANGLE_HEIGHTS.includes(start.height)) {
        return { ok: false, reason: `Unknown start ${start.turn} / ${start.height}.` };
    }
    const p = _subject(facts);
    const steps = [];
    const last = () => steps[steps.length - 1]?.model;
    const zoomMoved = !!(pick.zoom?.to && pick.zoom.to !== pick.zoom.from);
    if (start.height !== 'level' && (turn !== start.turn || height !== start.height)) {
        return _fromHeightPlan(turn, height, start, pick, p, facts, zoomMoved);
    }
    if (turn !== start.turn && turn === 'front') {
        if (facts.people > 1) return { ok: false, reason: 'Turning two or more people to the front is not benched.' };
        if (height !== 'level' || zoomMoved) return { ok: false, reason: 'The front pass from a turned view runs alone.' };
        steps.push({ kind: 'front', model: FLUX3, ref: 'room/front', prompt: _frontWords(p) });
    } else if (turn !== start.turn) {
        steps.push({ kind: 'turn', model: FLUX3, ref: `room/${turn}`, prompt: _turnWords(turn, p, facts) });
    }
    if (height !== start.height) {
        const stop = `${turn}_${height}`;
        const model = turn === 'front' && height === 'hi' ? FLUX3 : QWEN;
        steps.push({ kind: 'height', model, ref: `${model === FLUX3 ? 'room' : 'plain'}/${stop}`,
            prompt: _heightWords(turn, height, p, facts) });
    }
    const zoom = pick.zoom;
    if (zoom?.to && zoom.to !== zoom.from) {
        if (!_benched(turn, height).includes(zoom.to) || (zoom.to === 'eye' && steps.length)
            || (height !== 'level' && zoom.from !== 'full')) {
            return { ok: false, reason: `Zoom to ${zoom.to} is not benched on ${turn} / ${height}.` };
        }
        const rungs = zoomRungs(zoom.from, zoom.to);
        if (!rungs.length) return { ok: false, reason: `Unknown zoom ${zoom.from} -> ${zoom.to}.` };
        const fromClose = MULTI_ANGLE_RUNGS.indexOf(zoom.from) < MULTI_ANGLE_RUNGS.indexOf('full');
        rungs.forEach((rung, i) => {
            const madeUp = fromClose && i === 0 && (rung === 'full' || rung === 'far');
            steps.push({ kind: 'zoom', model: last() === FLUX3 ? QWEN : FLUX3, ref: null,
                outfitRef: madeUp && !!pick.outfit?.ref,
                prompt: _zoomWords(turn, rung, p, facts, { fromClose: madeUp, outfit: pick.outfit, height }) });
        });
    }
    return { ok: true, steps };
}
