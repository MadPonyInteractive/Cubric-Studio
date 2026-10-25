/**
 * MPI-1039 - the Multi-angle Flow's prompts, built in code, never typed by the user.
 *
 * Every fixed string below is VERBATIM from a bench cell that passed (tasks/MPI-1039/validation.md
 * rounds 23-49; research/accepted_prompts.md holds each cell's prompt as it ran); a rewording is a new
 * bench run, not an edit here. What changes from picture to picture comes in as `facts`, which the
 * Flow's describer writes from the source (flow-spec.md § The prompt recipe): who the subject is, photo
 * or drawing, the place each new view reveals, and the details worn on one side.
 *
 * A stop is 1-3 passes, each its own edit: TURN (FLUX.3, the doll in its room as image 2), HEIGHT
 * (front high on FLUX.3; front low and every height on a turned picture on Qwen, the doll on white as
 * image 2), ZOOM (words only, a rung of the framing ladder). Never the same model twice in a row
 * (round 44: two Qwen passes = gritty HDR texture; rounds 31-32 and 41: FLUX.3 returns its own result
 * unchanged).
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
 * ZOOM starts in the middle on the picture as it is: zoom out to the left, zoom in to the right
 * (Fabio 2026-10-25).
 */
export const MULTI_ANGLE_SLIDERS = {
    turn: ['back', 'tq_bl', 'pr_l', 'tq_fl', 'front', 'tq_fr', 'pr_r', 'tq_br', 'back'],
    height: ['lo', 'level', 'hi'],
    zoom: ['far', 'full', 'waist', 'none', 'hs', 'face', 'eye'],
};

/**
 * The Cosmo preview of a turn + height, from the same Blender camera as that stop's doll ref. Far
 * away is its own wider render per height; the zoom-in rungs are CSS on this one.
 */
export function multiAnglePreview(turn, height, zoom) {
    const h = height && height !== 'level' ? `_${height}` : '';
    return `assets/flows/multi-angle/previews/${turn}${h}${zoom === 'far' ? '_far' : ''}.webp`;
}

/**
 * The heights and zooms a turn can take: only what the bench proved (flow-spec.md § DECISION), and
 * without Qwen-Image 2.1 only what FLUX.3 runs alone. A low, and a height on a turned view, are Qwen
 * edits; a zoom pass follows the other model each time, so without Qwen only a one-pass zoom on the
 * untouched front runs (the face and far rungs can take two passes).
 * @param {string} turn
 * @param {string} height
 * @param {{ qwen?: boolean }} [opts] - whether Qwen-Image 2.1 is installed
 * @returns {{ heights: string[], zooms: string[] }} - `zooms` always holds 'none'
 */
export function multiAngleChoices(turn, height, { qwen = true } = {}) {
    const heights = MULTI_ANGLE_HEIGHTS.filter(h => h === 'level' || qwen || (turn === 'front' && h === 'hi'));
    let rungs = _benched(turn, height);
    // Without Qwen: a one-pass zoom on the eye-level front only (a front high's zoom pass is Qwen).
    if (!qwen) rungs = turn === 'front' && height === 'level' ? rungs.filter(r => !['face', 'far'].includes(r)) : [];
    return { heights, zooms: ['none', ...rungs] };
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

function _turnWords(turn, p, facts) {
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
        return 'Shift the viewpoint of the first image down to match the mannequin reference in the second image: '
            + `${kept}, but the view drops to just above ${ground}, looking steeply up at ${p.obj}. ${p.Poss} ${p.feet} `
            + `and legs are now large at the bottom of the frame, ${p.poss} body rises and narrows toward the top, `
            + `${HEAD_LOW[turn](p)} is small near the top edge with ${p.poss} whole head still in frame`
            + `${reveal ? `, and ${reveal}` : ''}.` + KEEP_REF + _keep(p);
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
export const MULTI_ANGLE_DESCRIBE_ASK = 'Look at this picture of one person. Answer in exactly these lines, each '
    + '"KEY: value", and nothing else. Plain English, lower case, no full stop at the end. The examples only show '
    + 'the form of an answer: name what is in THIS picture.\n'
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

const _none = v => (!v || /^(none|n\/a|-|no)$/i.test(v) ? '' : v);
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
        const m = line.match(/^\s*[-*]?\s*([A-Z_]+)\s*:\s*(.*?)\s*\.?\s*$/);
        if (m) a[m[1]] = m[2].replace(/^"(.*)"$/, '$1').trim();
    }
    const pronoun = PRONOUNS[String(a.PRONOUN).toLowerCase()] ? String(a.PRONOUN).toLowerCase() : 'they';
    const style = String(a.STYLE || 'photo').toLowerCase();
    const facts = {
        subject: (_none(a.SUBJECT) || 'person').toLowerCase().split(/\s+/)[0],
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
 * @param {Object} pick - { turn, height, zoom?: { from, to }, outfit?: { words, ref } }; `zoom.from` is the
 *   input's framing (a rung), read from the source.
 * @param {Object} facts - from the source: { subject, pronoun, drawing?: { noun, style, marks }, feet,
 *   frontLowLegs, ground, lowReveal, frontLowReveal, highReveal, turnReveal, details, near, far, farLow, farHigh,
 *   wears };
 *   a place slot is a sentence, or a map turn -> sentence.
 * @returns {{ ok: true, steps: Array<{ kind, model, ref, outfitRef?, prompt }> } | { ok: false, reason: string }}
 *   `ref` = the doll render under assets/flows/multi-angle/refs/ (image 2), null for a zoom pass;
 *   `outfitRef` = the user's outfit picture goes as image 2 of that zoom pass.
 */
export function multiAnglePlan(pick = {}, facts = {}) {
    const turn = pick.turn || 'front';
    const height = pick.height || 'level';
    if (!MULTI_ANGLE_TURNS.includes(turn) || !MULTI_ANGLE_HEIGHTS.includes(height)) {
        return { ok: false, reason: `Unknown stop ${turn} / ${height}.` };
    }
    const p = _subject(facts);
    const steps = [];
    const last = () => steps[steps.length - 1]?.model;
    if (turn !== 'front') {
        steps.push({ kind: 'turn', model: FLUX3, ref: `room/${turn}`, prompt: _turnWords(turn, p, facts) });
    }
    if (height !== 'level') {
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
