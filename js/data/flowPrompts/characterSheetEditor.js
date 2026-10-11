/**
 * MPI-1041 - the Character Sheet Editor's prompts, built in code, never typed by the user.
 *
 * Every string below is VERBATIM from a bench run that passed (tasks/MPI-1041/validation.md
 * batches 3-17, research/templates.md); a rewording is a new bench run, not an edit here.
 * The user's own words fill one slot. The age reaches the prompt as WORDS: the child-safety
 * gate reads strings only (docs/child-safety.md), so a number param would slip past it.
 *
 * Pure: no app imports, so the tests import it as it ships.
 */

/** The trailing pair that keeps the close-up portrait in step with the bodies (batch 5's L1). */
const L1 = ' Make the same change in the close-up portrait on the right. Keep everything else exactly as it is.';

/**
 * The SAM3 lock each change runs under: `Input_Lock` of flow_character_sheet_edit.json.
 * 1 = head, hair and face on all three panels (Clothes keeps the person); 2 = the face on the
 * front and the portrait (Hairstyle changes the hair around it); 0 = a free edit. Accessories
 * is free: a head lock blocks glasses and hats (A4). Body shape runs on the Qwen graph, which
 * has no lock.
 */
const LOCK = { clothes: 1, hair: 2 };

/** The describer's age read when it gave none: a typical adult sheet. */
const ADULT = 35;

/** Below this target a younger adult gets smooth skin and no grey hair; from it, only a younger face. */
const YOUNG_ADULT_MAX = 40;

/** A younger target this close to the describer's read takes no direction word (it reads old faces 10-15 high). */
const NEAR = 15;

function _words(text) {
    return String(text ?? '').trim().replace(/[\s.]+$/, '');
}

/** The slider's age: -1 = keep (Off), 0 = a newborn, 1-100 = years. No value at all is keep, never a newborn. */
function _age(value) {
    const n = value === null || value === '' ? NaN : Number(value);
    return Number.isFinite(n) ? Math.max(-1, Math.round(n)) : -1;
}

/**
 * The describer's answer to "how old does the person look?" as a number, or NaN. It reads
 * old faces 10-15 years high (A4), which only matters for the younger / older word.
 * @param {*} answer
 * @returns {number}
 */
export function parseApparentAge(answer) {
    const m = String(answer ?? '').match(/\d+/);
    return m ? Number(m[0]) : NaN;
}

/**
 * What an optional Reference picture (`image2`, the graph's `Input_Image_2`) stands for, per change
 * that takes one (Fabio, 2026-10-10: optional, words alone keep working). Any other change ignores it.
 */
const REF_THING = { clothes: 'the outfit', accessories: 'the accessory', hair: 'the hairstyle and hair color' };

/** Whether the run carries a Reference picture (the second media slot). */
function _hasRef(values) {
    return (values.mediaItems || []).some(m => m?.role === 'image2' && (m.url || m.filePath));
}

/** Whether this run's change takes its Reference picture. */
function _usesRef(values) {
    return Object.hasOwn(REF_THING, values.change) && _hasRef(values);
}

/**
 * The edit for one picked change, or null when there is nothing to change by.
 * @param {string} change - clothes | accessories | hair | condition | body
 * @param {string} words  - what the user wrote; optional with a reference
 * @param {boolean} [ref] - a Reference picture is given (used by Clothes, Accessories and Hairstyle only)
 * @returns {?string}
 */
export function buildChangePrompt(change, words, ref = false) {
    let w = _words(words);
    if (ref && Object.hasOwn(REF_THING, change)) w = `${REF_THING[change]} from the reference picture${w ? `: ${w}` : ''}`;
    if (!w) return null;
    switch (change) {
        // The views, and the parts that disagreed, are named: "Dress the character the same way in the close-up"
        // left the sleeves to each panel, and Fabio's keyhole dress came back short-sleeved on the front and a
        // halter in the close-up (MPI-1041 F1: 4/5 seeds -> 5/5). Lock 1 freezes every head, so naming the back
        // view cannot redraw the layout here.
        case 'clothes':
            return `Dress the character in ${w}. The front view, the back view and the close-up portrait on the right `
                + 'all show the same outfit, with the same neckline, sleeves and straps. Keep everything else exactly as it is.';
        // L1 named only the close-up, so the back view lost the scarf (or the close-up did): 4/8 -> 7/8 (F1).
        // A free edit has no head lock: "the back view" or "all three figures" made Klein redraw the layout
        // (an extra back figure); "the character seen from behind" never did (0 of 10).
        case 'accessories':
            return `Give the character ${w}. Make the same change on the character seen from behind and in the close-up `
                + 'portrait on the right. Keep everything else exactly as it is.';
        // A hat hides the hair it is meant to change: the fisher's beanie stayed on the front view (F1).
        case 'hair':
            return `Give the character ${w}, with the head uncovered and no hat, so the new hair shows.` + L1;
        case 'condition':
            return `Make the character look ${w}.` + L1;
        case 'body':
            return `Make the character's body ${w}.` + L1;
        default:
            return null;
    }
}

/**
 * The exact-age edit (batch 15's neutral template, A4's teen and older wordings; batch 21's
 * swaddled newborn and toddler).
 * @param {number} age      - the target, 0 (a newborn) to 100
 * @param {number} apparent - the describer's read of the sheet, NaN when unknown
 * @returns {string}
 */
export function buildAgePrompt(age, apparent) {
    const older = age > (Number.isFinite(apparent) ? apparent : ADULT);
    const younger = 'Change the character in this character sheet to be a younger version of themselves as ';
    // A newborn is swaddled, never dressed: a baby in the sheet's suit and boots reads wrong (Fabio, 2026-10-10).
    if (age === 0) {
        return younger + "a newborn baby a few weeks old, with a baby's round face, smooth skin and very little hair, "
            + 'swaddled in a soft cream knit blanket so only the face shows.' + L1;
    }
    // At 1 the plain child wording lost the hair, and a "toddler" wording kept the fisher's beard (batch 20).
    if (age === 1) {
        return younger + "a 1-year-old child, with a child's smooth face, no beard and no wrinkles, the same hairstyle "
            + 'and hair color, wearing the same clothes.' + L1;
    }
    const head = `Change the character in this character sheet to be ${older ? 'an older' : 'a younger'} `
        + `version of themselves as a ${age}-year-old`;
    if (age <= 12) return head + " child, with a child's smooth face, no beard and no wrinkles, wearing the same clothes." + L1;
    if (age <= 17) {
        return head + ", with a teenager's smooth face, no beard and no wrinkles, the same hairstyle and hair color, "
            + 'wearing the same clothes.' + L1;
    }
    // An older target near the read overshoots (Ava, ~42, at 50 came back ~70), but every other wording F1 tried
    // aged only the close-up, so this one stays: the panels agree.
    if (older) return head + '.' + L1;
    // The fisher reads 80 and is ~70: "a younger version ... with a younger face" at 70 shaved his beard on the
    // front or on all three; with no direction word he kept it, panels agreeing (F1, 2 of 2).
    if (age >= YOUNG_ADULT_MAX && apparent - age <= NEAR) {
        return `Change the character in this character sheet to be a ${age}-year-old.` + L1;
    }
    // Smooth skin and no grey hair hold for a young adult only (benched at 30): told the same at
    // 70, the fisher, read ~80, lost his white beard and came back ~35 (MPI-1041 Phase E).
    return age < YOUNG_ADULT_MAX ? head + ', with a younger face, smooth skin and no grey hair.' + L1
        : head + ', with a younger face.' + L1;
}

/**
 * A child's body, redrawn from the edited portrait by Character Sheet from Images (batch 17):
 * an edit keeps the adult's size, a rebuild draws a child's.
 * A newborn takes no caption: with one, the bodies came back in the clothes while the close-up
 * stayed swaddled (batch 21). The graph still draws it standing; Fabio took that (2026-10-10).
 * @param {number} age
 * @param {string} caption - the clothes, one sentence starting "Wearing"
 * @returns {string}
 */
export function buildRebuildPrompt(age, caption) {
    if (age === 0) {
        return 'A newborn baby a few weeks old, swaddled snugly in a soft cream knit blanket so only its face shows, '
            + 'lying on its back. It is too small to stand.';
    }
    const clothes = _words(caption);
    const body = age === 1
        ? "A 1-year-old toddler taking its first steps, with a toddler's body proportions: a short, chubby body with "
            + 'short chubby arms and legs and a large head for the body.'
        : `A ${age}-year-old child with a child's height and body proportions: a short, small body with shorter arms `
            + 'and legs, a shorter torso and a larger head for the body.';
    return body + (clothes ? ` ${clothes}.` : '');
}

/**
 * Why this run cannot start, or null. Checked before anything is queued.
 * @param {Object} values - the run's field values (`change`, `words`, `Input_Age`)
 * @returns {?string}
 */
export function characterSheetEditorRefusal(values = {}) {
    const change = values.change || 'none';
    const age = _age(values.Input_Age);
    if (change !== 'none' && !_words(values.words) && !_usesRef(values)) {
        return Object.hasOwn(REF_THING, change) ? 'Say what to change, or add a Reference picture.' : 'Say what to change first.';
    }
    if (change === 'none' && age < 0) return 'Pick something to change, or an age.';
    // The child-safety gate reads words only: a reference picture could put swimwear or underwear on a
    // child's sheet with no word for it to read (docs/child-safety.md).
    if (_usesRef(values) && age >= 0 && age <= 17) {
        return 'A Reference picture cannot be used with an age under 18. Describe the change in words instead.';
    }
    return null;
}

/**
 * The result card's name: the card it edits, then the change in the user's own words and the age
 * ("John - beaten up", "John - age 30"), so the result and the sheet it came from read apart.
 * @param {Object} values - the run's field values
 * @param {?string} sourceName - the edited card's name; null for a file from outside the project
 * @returns {string}
 */
export function characterSheetEditorCardName(values = {}, sourceName = null) {
    const age = _age(values.Input_Age);
    const words = (values.change || 'none') !== 'none'
        ? _words(values.words) || (_usesRef(values) ? `${REF_THING[values.change].replace(/^the /, '')} from a reference` : '')
        : '';
    const change = [words, age === 0 ? 'newborn' : age > 0 ? `age ${age}` : ''].filter(Boolean).join(', ');
    return `${String(sourceName || '').trim() || 'Character sheet'} - ${change}`;
}

/** One part's prompt, or '' when the run does not take it. */
function _part(part, values) {
    const age = _age(values.Input_Age);
    if (part === 'age') return age >= 0 ? buildAgePrompt(age, parseApparentAge(values.sheetAge)) : '';
    if (part === 'rebuild') {
        if (!(age >= 0 && age <= 12)) return '';
        // A Clothes change replaced what the describer saw on the original sheet.
        const caption = values.change === 'clothes' ? `Wearing ${_words(values.words)}` : values.sheetClothes;
        return buildRebuildPrompt(age, caption);
    }
    return buildChangePrompt(values.change, values.words, _usesRef(values)) || '';
}

/**
 * The prompt and lock for one leg of the run.
 *
 * Each leg also carries `runPrompt`: EVERY part this run takes, joined. No graph has a node of that
 * name, but the child-safety gate reads a job's string params (`configTexts`), and it checks one
 * job at a time - so without it "Clothes: a bikini" then "Age: 10" would pass leg 1 (no age in its
 * words) and leg 2 (no bikini in its words). With it, leg 1 is refused before anything runs.
 *
 * @param {'change'|'age'|'rebuild'} part - which leg (FlowDef `chain[].prompt`; leg 1 is `change`)
 * @param {Object} values - the run's field values plus the describe answers (`sheetAge`, `sheetClothes`)
 * @returns {{positive: string, injectionParams: Object}}
 */
export function characterSheetEditor(part, values = {}) {
    const runPrompt = ['change', 'age', 'rebuild'].map(p => _part(p, values)).filter(Boolean).join('\n');
    const injectionParams = { runPrompt };
    // The Klein graph's lock; the Qwen and from-images graphs have no `Input_Lock` and skip it.
    if (part !== 'rebuild') injectionParams.Input_Lock = part === 'age' ? 0 : (LOCK[values.change] ?? 0);
    // Only the change leg reads the Reference picture: an age leg that starts the run is handed the
    // user's media too, and would otherwise dress the sheet from it.
    if (part !== 'rebuild') injectionParams.Input_Reference = part === 'change' && _usesRef(values);
    return { positive: _part(part, values), injectionParams };
}
