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

function _words(text) {
    return String(text ?? '').trim().replace(/[\s.]+$/, '');
}

function _age(value) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.round(n) : 0;
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
 * The edit for one picked change, or null when there are no words.
 * @param {string} change - clothes | accessories | hair | condition | body
 * @param {string} words  - what the user wrote
 * @returns {?string}
 */
export function buildChangePrompt(change, words) {
    const w = _words(words);
    if (!w) return null;
    switch (change) {
        case 'clothes':
            return `Dress the character in ${w}. Dress the character the same way in the close-up portrait on the right. `
                + 'Keep everything else exactly as it is.';
        case 'accessories':
        case 'hair':
            return `Give the character ${w}.` + L1;
        case 'condition':
            return `Make the character look ${w}.` + L1;
        case 'body':
            return `Make the character's body ${w}.` + L1;
        default:
            return null;
    }
}

/**
 * The exact-age edit (batch 15's neutral template, A4's teen and older wordings).
 * @param {number} age      - the target, 1-100
 * @param {number} apparent - the describer's read of the sheet, NaN when unknown
 * @returns {string}
 */
export function buildAgePrompt(age, apparent) {
    const older = age > (Number.isFinite(apparent) ? apparent : ADULT);
    const head = `Change the character in this character sheet to be ${older ? 'an older' : 'a younger'} `
        + `version of themselves as a ${age}-year-old`;
    if (age <= 12) return head + " child, with a child's smooth face, no beard and no wrinkles, wearing the same clothes." + L1;
    if (age <= 17) {
        return head + ", with a teenager's smooth face, no beard and no wrinkles, the same hairstyle and hair color, "
            + 'wearing the same clothes.' + L1;
    }
    return older ? head + '.' + L1 : head + ', with a younger face, smooth skin and no grey hair.' + L1;
}

/**
 * A child's body, redrawn from the edited portrait by Character Sheet from Images (batch 17):
 * an edit keeps the adult's size, a rebuild draws a child's.
 * @param {number} age
 * @param {string} caption - the clothes, one sentence starting "Wearing"
 * @returns {string}
 */
export function buildRebuildPrompt(age, caption) {
    const clothes = _words(caption);
    return `A ${age}-year-old child with a child's height and body proportions: a short, small body with shorter arms `
        + 'and legs, a shorter torso and a larger head for the body.' + (clothes ? ` ${clothes}.` : '');
}

/**
 * Why this run cannot start, or null. Checked before anything is queued.
 * @param {Object} values - the run's field values (`change`, `words`, `Input_Age`)
 * @returns {?string}
 */
export function characterSheetEditorRefusal(values = {}) {
    const change = values.change || 'none';
    if (change !== 'none' && !_words(values.words)) return 'Say what to change first.';
    if (change === 'none' && !(_age(values.Input_Age) > 0)) return 'Pick something to change, or an age.';
    return null;
}

/** One part's prompt, or '' when the run does not take it. */
function _part(part, values) {
    const age = _age(values.Input_Age);
    if (part === 'age') return age > 0 ? buildAgePrompt(age, parseApparentAge(values.sheetAge)) : '';
    if (part === 'rebuild') {
        if (!(age > 0 && age <= 12)) return '';
        // A Clothes change replaced what the describer saw on the original sheet.
        const caption = values.change === 'clothes' ? `Wearing ${_words(values.words)}` : values.sheetClothes;
        return buildRebuildPrompt(age, caption);
    }
    return buildChangePrompt(values.change, values.words) || '';
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
    return { positive: _part(part, values), injectionParams };
}
