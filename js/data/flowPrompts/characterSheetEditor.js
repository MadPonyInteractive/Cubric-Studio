/**
 * MPI-1041 - the Character Sheet Editor's prompts, built in code, never typed by the user.
 *
 * Every string below is VERBATIM from a bench run that passed (tasks/MPI-1041/validation.md
 * batches 3-17, research/templates.md); a rewording is a new bench run, not an edit here.
 * The user's own words fill one slot. The age reaches the prompt as WORDS: the child-safety
 * gate reads strings only (docs/child-safety.md), so a number param would slip past it.
 *
 * Pure: no app imports (childSafety.js is pure too), so the tests import it as it ships.
 */

import { asksToUndress } from '../childSafety.js';

/** The trailing pair that keeps the close-up portrait in step with the bodies (batch 5's L1). */
const L1 = ' Make the same change in the close-up portrait on the right. Keep everything else exactly as it is.';

/**
 * The SAM3 lock each change runs under: `Input_Lock` of flow_character_sheet_edit.json.
 * 1 = head, hair and face on all three panels (Clothes keeps the person); 0 = a free edit. Body shape,
 * Hairstyle and Accessories (MPI-1086) run on the Qwen graph, which has no lock; the Klein graph's lock 2
 * (the face only) is now reached by nothing.
 */
const LOCK = { clothes: 1 };

/** The describer's age read when it gave none: a typical adult sheet. */
const ADULT = 35;

/** Below this target a younger adult gets smooth skin and no grey hair; from it, only a younger face. */
const YOUNG_ADULT_MAX = 40;

/** A younger target this close to the describer's read takes no direction word (it reads old faces 10-15 high). */
const NEAR = 15;

/** Beard with the box left empty (Fabio: "it's a beard, what do I write?"): a beard, in the hair's colour (MPI-1086 bd4). */
const BEARD = 'a full, neatly trimmed beard and moustache in the same colour as the hair';

/**
 * Where a beard goes (MPI-1086 bd2): the Hairstyle shape (every figure named) left a long beard off the small front
 * face (0/3); naming "the full-body front view" with the close-up, the beard "on the face", put it there 2/2.
 */
const BEARD_ON = 'The full-body front view and the close-up portrait on the right both show this beard on the face, and '
    + "the character seen from behind shows it wherever it can be seen. Keep the character's own face, hair and clothes. "
    + 'Keep everything else exactly as it is.';

/**
 * The in-graph mannequin for a Beard picture (`Input_Mannequin_Prompt`), as for Makeup: the raw picture put its
 * person's old, lined face and grey hair on a young man's sheet (MPI-1086 bp1 b1). A skin-coloured bald head put ITSELF on
 * the small front figure (bp1/bp3 b3: pale mannequin face, the hair gone, 0/2); a WHITE one, which cannot pass for skin,
 * kept his face 2/2 (bp3 W), where a "take only the beard, not the head" line did not (P 0/2).
 */
const BEARD_MANNEQUIN = 'Replace the head of the person with a plain white mannequin head, and keep only the beard and '
    + 'moustache, exactly as they are: the same colour, length, shape and style. No hair on the head, no jewellery and '
    + 'no clothes, on a plain grey background.';

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
 * Accessories need words with one (`REF_NEEDS_WORDS`): a product shot does not say where a thing is worn.
 */
const REF_THING = {
    clothes: 'the outfit', accessories: 'the accessory', hair: 'the hairstyle', makeup: 'the makeup', tattoos: 'the tattoos',
    beard: 'the beard',
};

/**
 * Changes whose Reference picture must come with words naming what it shows, and the refusal's example. With none,
 * gold hoops became a necklace and bracelets and a rose tattoo went on the face (MPI-1086 qh5, 4 of 4); named, 4 of 4
 * landed. A tattoo picture alone inked arms and legs it never showed, and moved a leg tattoo to the arms (r34, 4 of 6):
 * a cropped photo does not say where on the body it is.
 */
const REF_NEEDS_WORDS = { accessories: '"the gold hoop earrings"', tattoos: '"the neck and chest tattoos"' };

/**
 * A tattoo picture with no face in it inked her cheek and jaw anyway (Fabio; MPI-1086 ac4, "Full body tattoos", seed
 * 31022). This line cut it to a faint line at the jaw, another seed and a neck picture bare; a picture that shows face
 * ink still passes it on (t_all). "... unless image 2 shows a tattooed face" changed nothing (ac4/ac5), and naming the
 * cheeks and jaw drew more there (ac7). Left out when the user's words name the face.
 */
const NO_FACE_INK = 'The face stays bare: no tattoo on the face. ';

/** Changes whose Reference picture goes into the Qwen graph raw, never made a mannequin first (`Input_Is_Mannequin`). */
const RAW_REF = new Set(['accessories', 'tattoos']);

/**
 * The in-graph mannequin for a Makeup picture (`Input_Mannequin_Prompt`; the graph's default is the hairstyle one).
 * The raw picture put its person's face on a man's sheet (Fabio's eye test, flowCSE_051/053: a firmer own-face line,
 * naming him "the man" and a partial redraw all failed, MPI-1086 r39/r40); a bald head wearing only the makeup, plus
 * the makeup in words, kept his face and the exact design 6/6 (r41/r42, Cosmo's own recipe, edit_007).
 */
const MAKEUP_MANNEQUIN = 'Replace the head of the person with a plain bald mannequin head, and keep only the makeup, '
    + 'exactly as it is: the same colours, shapes and patterns of the face paint, eyeshadow, eyeliner and lipstick. '
    + 'No hair, no jewellery and no clothes, on a plain grey background.';

/**
 * Makeup edits the FACES only (`Input_Face_Crop`, MPI-1086 r45-r47): the Qwen graph crops the front figure's face and
 * the close-up's face, puts them side by side as image 1, and pastes the edit back through the face masks. Same makeup
 * on both faces, 2.3x faster than the whole sheet, and the mannequin's pale skin no longer leaks onto a darker face
 * (r46: skin saturation 0.34 vs the whole sheet's 0.27, 0.38 before). Each face stays its own: without this the
 * picture's face came with it (r31, 5 of 7).
 */
const TWO_FACES = "Image 1 shows the same person's face twice.";
const OWN_FACES = "Keep each face's own shape, eyes, nose, lips, eyebrows, facial hair, skin tone and hair exactly as they "
    + 'are; only the makeup changes.';

/**
 * Face tattoos edit the two faces only, as Makeup (`Input_Face_Crop`, MPI-1086 fa1-fa4): tattoo words that name the
 * face and no other part of the body. `OWN_FACES` with the tattoos, not the makeup, as the one change.
 */
const FACE_PART = /\b(?:face|facial|cheeks?|cheekbones?|forehead|jaw|jawline|temples?|eyes?|eyebrows?|brows?|chin|nose|lips?)\b/i;
const BODY_PART = /\b(?:back|arms?|legs?|thighs?|calf|calves|ankles?|feet|foot|hands?|wrists?|fingers?|chest|neck|shoulders?|stomach|belly|ribs?|sleeves?|full[- ]body|whole[- ]body|all over)\b/i;
const OWN_FACES_INK = "Keep each face's own shape, eyes, nose, lips, eyebrows, facial hair, skin tone and hair exactly as "
    + 'they are; only the tattoos are added.';

/**
 * The mannequin for a face-tattoo picture, made of the picture's HEAD (`Input_Ref_Head_Crop`): a mannequin of a
 * full-body photo kept the face ink too small to read (r45); of the head crop, the designs copied 6/6 (fa1/fa3), where
 * the raw head put the picture's makeup on her and shaved his temple (fa1 P1). Face tattoos only, scalp and neck bare
 * (fh3): a mannequin carrying scalp or neck ink had Qwen paint it on the cheek of a character whose hair covers the
 * scalp 16/16, whatever the edit words said (fh1/fh2); without it the face takes only the face's own marks 8/8.
 */
const TATTOO_MANNEQUIN = 'Replace the head of the person with a plain bald mannequin head, and keep only the tattoos on the '
    + 'face, exactly as they are: the same designs, colours and places. The scalp and the neck are bare, with no tattoo. '
    + 'No hair, no makeup, no jewellery and no clothes, on a plain grey background.';

/** Whether this run's tattoos go on the face only. */
function _faceInk(change, words) {
    const w = _words(words);
    return change === 'tattoos' && FACE_PART.test(w) && !BODY_PART.test(w);
}

/**
 * The character's left and right said as the PICTURE's side (fa3): "under the left eye" put the ink on both cheeks of
 * the front face or on the other side (fa1/fa2: a side sentence, swapped words and "drawn once" all 0/8 on one star);
 * "the eye on the right side of the picture" put one star where it belongs 3/4. A face that looks at the viewer shows
 * its left on the picture's right, front and three-quarter alike.
 * @param {string} w
 * @returns {string}
 */
function _pictureSides(w) {
    return w.replace(/\b(?:(?:her|his|their|the)\s+)?(left|right)\s+([a-z]+)/gi,
        (_m, side, part) => `the ${part} on the ${side.toLowerCase() === 'left' ? 'right' : 'left'} side of the picture`);
}

/** With a reference, every figure is named and the back one only as "seen from behind" (MPI-1090 rounds 2-3). */
const REF_ALL = 'The front view, the character seen from behind and the close-up portrait on the right all show the same '
    + 'outfit, with the same neckline, sleeves and straps.';

/** The close-up lost the neckline whenever the user's words were in the prompt (0/6) until it was named (5/5). */
const REF_NECK = 'The close-up portrait on the right shows the top of the outfit from the reference picture, with its neckline.';

/**
 * The user's words with "the back view" said the safe way. Fabio's "G string on the back view" redrew the front
 * figure as a second back view; "seen from behind" never redrew the layout (MPI-1041 F1 0/10, MPI-1090 5/5).
 * @param {string} w
 * @returns {string}
 */
function _unview(w) {
    return w.replace(/(?:\b(?:on|in|at|for)\s+)?\bthe\s+back\s+view\b/gi, 'seen from behind');
}

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
 * @param {string} change - clothes | accessories | makeup | tattoos | hair | beard | condition | body | custom
 * @param {string} words  - what the user wrote; optional with a reference
 * @param {boolean} [ref] - a Reference picture is given (used by the changes in REF_THING)
 * @param {string} [refHair] - the describer's words for the reference's hairstyle (`describe` → `refHair`)
 * @param {string} [refMakeup] - the describer's words for the reference's makeup (`describe` → `refMakeup`)
 * @param {string} [refBeard] - the describer's words for the reference's beard (`describe` → `refBeard`)
 * @returns {?string}
 */
export function buildChangePrompt(change, words, ref = false, refHair = '', refMakeup = '', refBeard = '') {
    const w = _words(words) || (change === 'beard' ? BEARD : '');
    // MPI-1086 (tasks/MPI-1086/validation.md, rounds 16-24): a hairstyle FROM A PICTURE runs on Qwen-Image 2.1 (the
    // registry routes it), never on Klein: Klein's face lock pasted the old face onto a head it redrew (double jaw,
    // a second ear, ~11/17). The Qwen graph first turns the picture into a bare mannequin wearing the hair (Klein,
    // inside the same graph) and hands Qwen that as image 2: 17/18 (r21), 6/6 (r23). The raw photo as image 2 put its
    // make-up on the front figure (r22). Qwen names its pictures "image 1" (the sheet) and "image 2"; the describer's
    // words still lead the style, since the full bodies follow words more than a picture.
    if (ref && change === 'hair') {
        const d = _words(refHair);
        // The user's words LEAD (qh15 round 9, W2 on Klein): "in blue" after the description kept the bodies the
        // picture's pink - the description outvotes them. Moving part of a style ("the bun lower") ADDED a bun in
        // every wording: words change colour and add things, a different shape needs a different picture.
        if (w) {
            return `Give the character in image 1 the hairstyle from image 2, changed like this: ${_unview(w)}. `
                + (d ? `The hairstyle in image 2: ${d}. ` : '')
                + `Make it ${_unview(w)} on every figure, with the head uncovered and no hat. The front view, the character `
                + 'seen from behind and the close-up portrait on the right all show the same changed hairstyle. '
                + "Keep the character's own face and clothes. Keep everything else exactly as it is.";
        }
        return `Give the character in image 1 the hairstyle and hair colour from image 2${d ? `: ${d}` : ''}, with the `
            + 'head uncovered and no hat. The front view, the character seen from behind and the close-up portrait on the '
            + "right all show the same hairstyle and hair colour. Keep the character's own face and clothes. "
            + 'Keep everything else exactly as it is.';
    }
    // The old clothes must be taken off in words, or Klein keeps what the picture does not cover (Fabio's
    // bikini kept the jeans, MPI-1041 F2 rounds 4-7). With no words the picture IS the outfit, so everything
    // else goes; with words that would strip what they leave out (a jacket and scarf cut the trousers to
    // shorts), so they get the softer "replacing" clause. MPI-1090 (tasks/MPI-1090/validation.md, on the graph's
    // shoulder lock): every figure is named, the back one as "seen from behind" (naming "the back view" with a
    // reference drew an extra figure, F2 round 2); the user's words get their OWN sentence after that line, not
    // spliced into the reference clause, where "G string on the back view" became the whole outfit and the
    // front a second back view. Words: front, layout and close-up 5/5, back 4/5; picking "the green jacket"
    // off a full outfit kept her own trousers 3/3 (the splice took the corduroys 2/2). No words: close-up 3/3.
    if (ref && change === 'clothes') {
        return w
            ? 'Dress the character in the outfit from the reference picture, replacing all of the clothes the character '
                + `wears now, top and bottom. ${REF_ALL} Change only this about the outfit: ${_unview(w)}. ${REF_NECK} `
                + 'Keep everything else exactly as it is.'
            : 'Dress the character in only the outfit from the reference picture. Take off everything else the character '
                + `wears now, trousers, skirt and top included. ${REF_ALL} Keep everything else exactly as it is.`;
    }
    // MPI-1086 r41/r42, on Qwen: image 2 is the graph's MANNEQUIN wearing only the makeup (`MAKEUP_MANNEQUIN`), and
    // the describer's words name the makeup again: his own face and the exact design 6/6 on a man's sheet, where the
    // raw picture (r33's "copied exactly" string) put the picture's face on him. The user's words LEAD, as with hair
    // (r42b): "no lashes" and "red lipstick" first landed 4/4; after the description "red lipstick" stayed black.
    if (ref && change === 'makeup') {
        const d = _words(refMakeup);
        return `${TWO_FACES} Apply the makeup from image 2 onto both faces in image 1`
            + (w ? `, changed like this: ${w}. ${d ? `The makeup in image 2: ${d}. ` : ''}Make it ${w} on both faces. `
                : `${d ? `: ${d}` : ''}. `)
            + `${OWN_FACES} Keep everything else exactly as it is.`;
    }
    // MPI-1086 bp1, on Qwen: image 2 is the graph's MANNEQUIN wearing only the beard (`BEARD_MANNEQUIN`), and the
    // describer's words name the beard again (`refBeard`), as for Makeup. A picture alone is enough (Fabio): the
    // empty-box default (`BEARD`) never applies to a picture.
    if (ref && change === 'beard') {
        const d = _words(refBeard);
        const own = _words(words);
        return own
            ? `Give the character in image 1 the beard and moustache from image 2, changed like this: ${own}. `
                + `${d ? `The beard in image 2: ${d}. ` : ''}Make it ${own}. ${BEARD_ON}`
            : `Give the character in image 1 the beard and moustache from image 2${d ? `: ${d}` : ''}. ${BEARD_ON}`;
    }
    if (!w) return null;
    // MPI-1086 fa1-fa4: face tattoos edit the two faces only (`_faceInk`). A picture is the graph's mannequin of its
    // head (`TATTOO_MANNEQUIN`); "on the same side of the face as in image 2" kept the glyphs off the other cheek (fa3
    // P3 + fa4 6/6, without it 3/4); "none on the neck" cut the picture's neck ink, which the face paste cuts into a
    // ghost at the chin, from 4/4 to 2/4 (fa4).
    if (_faceInk(change, w)) {
        if (ref) {
            const t = w.replace(/^(?:the|a|an)\s+/i, '');
            return `${TWO_FACES} Copy the ${t[0].toLowerCase() + t.slice(1)} from image 2 onto both faces in image 1, the `
                + 'same designs in the same place on the face and head, on the same side of the face as in image 2. Add no '
                + `other tattoos, none on the neck, and no makeup. ${OWN_FACES_INK} Keep everything else exactly as it is.`;
        }
        return `${TWO_FACES} Add these face tattoos to both faces, in the same place on each: ${_pictureSides(w)}. `
            + `${OWN_FACES_INK} Keep everything else exactly as it is.`;
    }
    // MPI-1086 r29: Accessories runs on Qwen-Image 2.1 (the registry routes it), the raw picture straight in as image 2
    // (no mannequin: `Input_Is_Mannequin` is forced). Klein redrew the front figure as a second back view 4/4 and took
    // the picture's person (her face, her green hair); this kept layout, face and hair 4/4 and put the thing where it
    // belongs (the gun in her hand, the mask on her face) with no "where" words. Tattoos take the same string, the
    // words saying where (r31: 4 pass + 2 partial), plus "Add no other tattoos" (r35).
    if (ref && (change === 'accessories' || change === 'tattoos')) {
        const t = _unview(w).replace(/^(?:the|a|an)\s+/i, '');
        const thing = t[0].toLowerCase() + t.slice(1);
        return `Give the character in image 1 the ${thing} from image 2. `
            + (change === 'accessories'
                ? `The full-body figure on the left and the close-up portrait on the right both show the ${thing} wherever it can be seen. `
                : `The front view, the character seen from behind and the close-up portrait on the right all show the ${thing} wherever it can be seen. `)
            + (change === 'tattoos' ? 'Add no other tattoos. ' : '')
            + (change === 'tattoos' && !/\b(?:face|facial|cheeks?|forehead|jaw)\b/i.test(w) ? NO_FACE_INK : '')
            + `Take only the ${thing} from image 2, not the person: keep the character's own face, hair, skin and clothes. `
            + 'Keep everything else exactly as it is.';
    }
    switch (change) {
        // The views, and the parts that disagreed, are named: "Dress the character the same way in the close-up"
        // left the sleeves to each panel, and Fabio's keyhole dress came back short-sleeved on the front and a
        // halter in the close-up (MPI-1041 F1: 4/5 seeds -> 5/5). Lock 1 freezes every head, so naming the back
        // view cannot redraw the layout here.
        // MPI-1159: words that take the clothes OFF run on Qwen (the registry routes them), the words their own
        // sentence. "Dress the character in Remove all the clothes..." came back dressed on Klein; on Qwen this
        // undressed every figure, barefoot, own face and hair, 2/2 on Fabio's adult sheet (scratchpad ud1).
        case 'clothes':
            if (asksToUndress(w)) {
                return `Change the character's clothes in image 1: ${w}. The front view, the character seen from behind `
                    + "and the close-up portrait on the right all show the same change. Keep the character's own face "
                    + 'and hair. Keep everything else exactly as it is.';
            }
            // ff7-ff11 (Fabio's shoe edit on his hip-pouch sheet): "Dress the character in" drew a ghost second
            // head in the back panel 2/5 on the app's own input; this opening 0/5, pouch kept 5/5 both, keyhole
            // dress 4/5 (was 5/5). Fabio picked it (2026-10-18). Never NAME a kept object: a named thing gets drawn.
            return `Change the character's clothes in image 1: ${w}. The front view, the character seen from behind `
                + 'and the close-up portrait on the right all show the same change, with the same neckline, sleeves and '
                + "straps. Keep the character's own face and hair. Keep everything else exactly as it is.";
        // MPI-1086 r30: on Qwen, every figure named. Klein's string redrew the front figure as a back view 4/4 on
        // Fabio's sheet. "this accessory to wear or hold": a bare "Mask" otherwise came back as a matte over the sheet.
        // ac2: "Holding a G3 machine gun" also strapped a thigh pouch, belt and sling on him (Fabio's seed); "Add
        // nothing else" left the gun alone. The back view is redrawn by the back pass (`buildBackPassPrompt`).
        // ff1 (Fabio, flowCSE_069): with the back figure named, "a basketball under his arm" landed on the back view
        // only. Pass 1 now sees the front body and the close-up alone (`Input_Front_Crop`), and names only those.
        case 'accessories':
            return `Give the character in image 1 this accessory to wear or hold: ${w}. The full-body figure on the left `
                + 'and the close-up portrait on the right both show it wherever it can be seen. '
                + (SHOULDER_STRAP.test(w) || (FRONT_WORN.test(w) && STRAPPED.test(w)) ? CLOSE_STRAP : '') + 'Add '
                + "nothing else: no other gear, bags, belts or straps. Keep the character's own face, hair, skin and "
                + 'clothes. Keep everything else exactly as it is.';
        // MPI-1086 r34: her own face named as with a picture; smoky eyes + black lips, pink glitter + white liner 2/2.
        // r47: the two faces only, as with a picture (`TWO_FACES`).
        case 'makeup':
            return `${TWO_FACES} Give both faces this makeup: ${w}. ${OWN_FACES} Keep everything else exactly as it is.`;
        // MPI-1086 r34: a koi on the whole back landed on the back view only; a sleeve on "the left arm" was mirrored
        // on the back view (as with Accessories, r31) - a known partial. Name no limb here: r32's "arm or leg" sentence
        // ADDED sleeves to both arms.
        case 'tattoos':
            return `Give the character in image 1 this tattoo: ${_unview(w)}. The front view, the character seen from `
                + 'behind and the close-up portrait on the right all show it wherever it can be seen. Add no other '
                + "tattoos. Keep the character's own face, hair, skin tone and clothes. Keep everything else exactly as it is.";
        // A hat hides the hair it is meant to change: the fisher's beanie stayed on the front view (F1).
        // MPI-1086 r28: hair runs on QWEN (Klein turned a mohawk into silver braids). Naming every figure is what
        // reaches the bodies: with L1 Qwen changed the close-up only; this got all three figures 4/4.
        case 'hair':
            return `Give the character this hairstyle: ${w}. The head is uncovered, no hat. The front view, the character `
                + 'seen from behind and the close-up portrait on the right all show the same new hairstyle. '
                + "Keep the character's own face and clothes. Keep everything else exactly as it is.";
        // MPI-1086 bd1-bd3 (Fabio: its own entry, not a Hairstyle switch), on Qwen; `BEARD_ON` kept shaving and a
        // moustache working too.
        case 'beard':
            return `Give the character this beard: ${w}. ${BEARD_ON}`;
        case 'condition':
            return `Make the character look ${w}.` + L1;
        case 'body':
            return `Make the character's body ${w}.` + L1;
        // A free edit in the user's own words (MPI-1086, Fabio's "Custom"), lock 0. The words as typed, then the
        // accessories tail, redrew the front figure as a back view on "holding a sword" (1 of 2); this framing kept
        // the layout 6 of 6 (vampire, robot, sword). The close-up is a head and shoulders: a whole-body change (a
        // robot) does not reach its face.
        case 'custom':
            return `Change the character in this character sheet: ${_unview(w)}. Make the same change on the character `
                + 'seen from behind and in the close-up portrait on the right. Keep everything else exactly as it is.';
        default:
            return null;
    }
}

/** Tattoo words that name the back and no part a front view shows (`buildBackPassPrompt`). */
const BACK_ONLY = /\bback\b/i;
/**
 * Accessory words naming a thing that hangs on the front of the body: no back pass. The back pass repeats the user's
 * words, and "a heart pendant" drew the heart on her back 4/4 whatever the sentence around it (ff1/ff2); without the
 * words a ball or a backpack is lost from behind. The sheet's own back view stays.
 * ponytail: a word list; "earrings and a pendant" loses the earrings from behind. Upgrade path: the describer says
 * what of the thing shows from behind (Fabio's check pass).
 */
const FRONT_HANGING = /\b(?:necklaces?|pendants?|lockets?|chokers?|brooch(?:es)?|ties?|bow ?ties?|badges?|medals?|medallions?)\b/i;
/**
 * The accessory turned round with its sides swapped (ff4). "held or worn as in image 1" put a walking stick in the
 * hand on the same picture side from behind 3/4 (ff3: mirrored, or one in each hand); this put it on the other side
 * 4/4, whichever hand pass 1 drew it in. No hand is fixed, so the user's words and pass 1 choose it.
 */
const ACC_SWAP = 'held as in image 1. Seen from behind, left and right swap: a thing in the hand on the left side of '
    + 'image 1 is in the hand on the right side of the picture, and a thing on the right side of image 1 is on the left '
    + 'side of the picture.';
/**
 * A bag worn on the front (Fabio's sling bag, flowCSE_062): the back pass repeated the words and drew the bag on his
 * back too, and the close-up had no strap. With a strap named, the back pass names only the strap (ff6: strap only,
 * other side, 8/8) and pass 1 names it in the close-up (0/4 -> 2/4); with no strap, no back pass (as FRONT_HANGING).
 * "across the chest" is not on the list: it says where the STRAP runs (Cosmo's "pouch worn at the hip, on a strap
 * over one shoulder across the chest" is a hip bag, seen from behind too).
 * ponytail: a word list, as FRONT_HANGING.
 */
const FRONT_WORN = /\b(?:worn on the (?:chest|front)|on (?:his|her|their|the) (?:chest|front)|chest (?:bags?|pouch(?:es)?|rigs?)|cross-?body|sling bags?)\b/i;
const STRAPPED = /\b(?:straps?|bands?|cross-?body|sling)\b/i;
const BACK_STRAP = 'The character wears a thin strap that runs diagonally across the back, from one shoulder down to the '
    + 'other side of the waist. Seen from behind, left and right swap: the shoulder on the left side of image 1 is on '
    + 'the right side of the picture. ';
/**
 * ff10: the strap named in the close-up for any bag on a shoulder strap, chest or hip. "shows its strap over the
 * shoulder" put it there 2/4 (ff6, chest bag) and 1/4 (Cosmo's hip pouch); naming where it runs, 4/4 (hip pouch).
 */
const SHOULDER_STRAP = /\b(?:shoulder strap|over (?:one|the|his|her|their|a) shoulder|cross-?body|sling)\b/i;
const CLOSE_STRAP = 'The close-up portrait on the right shows the strap running over the shoulder and down across the '
    + 'chest. ';
const FRONT_PART = /\b(?:arms?|legs?|thighs?|calf|calves|ankles?|feet|foot|hands?|wrists?|fingers?|chest|neck|face|stomach|belly|ribs?|sleeves?|full[- ]body|whole[- ]body|all over)\b/i;

/**
 * The Qwen graph's back pass (`Input_Positive_2`): the back figure redrawn from the EDITED front one and pasted over
 * the back panel, so no single pass sees two views of one side. In one pass a tattoo on her left leg came back on her
 * right leg from behind; this put it on her left (MPI-1086 r37: t_leg1, the left-arm roses, the right-leg snake).
 * Accessories too (ac2, Fabio): in one pass "a G3 held with both hands" came back sticking out at his side from
 * behind; turned round from the front, the gun and a right-hand katana land on the right side.
 * Image 2 is the sheet's ORIGINAL back figure (the graph crops it at the cuts): from the front alone the pass redrew
 * a strappy open back as a halter (r38 12/12, ac2 B1); with it the straps stayed. With words only, tattoo words come
 * along (they put the snake right even where pass 1 left the front bare); with a picture they do not (in pass 2 it
 * invented arm ink 3 of 4). An accessory always names itself (a picture needs words). "Show it wherever it can be
 * seen" drew a necklace's pendant on her back: the front of the body hides it.
 * A tattoo on the back alone takes no back pass: turned round from a front that cannot show it, the back piece was
 * lost (ac3 t_back); in one pass it lands on the back view only (r35, ac4).
 * @param {string} change
 * @param {string} words
 * @param {boolean} ref - a Reference picture is given
 * @returns {string} '' when the change takes no back pass
 */
export function buildBackPassPrompt(change, words, ref = false) {
    if (change !== 'tattoos' && change !== 'accessories') return '';
    const w = _words(words);
    if (!w) return '';
    if (change === 'tattoos' && BACK_ONLY.test(w) && !FRONT_PART.test(w)) return '';
    if (change === 'accessories' && FRONT_HANGING.test(w)) return '';
    const frontStrap = change === 'accessories' && FRONT_WORN.test(w);
    if (frontStrap && !STRAPPED.test(w)) return '';
    if (_faceInk(change, w)) return '';   // the two faces only: no back figure is touched
    const has = change === 'tattoos'
        ? (ref ? '' : `The character has this tattoo: ${_unview(w)}. Show it wherever it can be seen from behind. `)
        : frontStrap ? BACK_STRAP
        : `The character has this accessory: ${_unview(w)}, ${ACC_SWAP} Show only what can be seen from behind. `;
    return 'Turn the character in image 1 around so the character is seen from behind, full body from head to feet, '
        + 'standing in the same pose, on the same plain grey background. Image 2 is this character seen from behind: '
        + (change === 'tattoos'
            ? 'keep the hair, clothes and shoes exactly as in image 2, and the skin and its tattoos as in image 1. '
            : 'keep the hair, body, skin tone, clothes and shoes exactly as in image 2. ')
        + has
        + 'Keep everything else exactly as it is.';
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
    // 70, the fisher, read ~80, lost his white beard and came back ~35 (MPI-1041 Phase E). Without "the same
    // hairstyle and hair color" a pink-bobbed nude sheet at 18 lost the bob and aged only the close-up; with it, all
    // panels and the bob held, and the fisher at 30 still lost his grey (MPI-1159 ag1/ag2, 2 seeds each).
    return age < YOUNG_ADULT_MAX ? head + ', with a younger face, smooth skin and no grey hair, the same hairstyle and hair color.' + L1
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
    if (Object.hasOwn(REF_NEEDS_WORDS, change) && _usesRef(values) && !_words(values.words)) {
        return `Say what the Reference picture shows, for example ${REF_NEEDS_WORDS[change]}.`;
    }
    if (change !== 'none' && change !== 'beard' && !_words(values.words) && !_usesRef(values)) {
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
 * Short on purpose (Fabio, 2026-10-16): an edit of an edit kept every earlier change and every word
 * ("flowCSFI_003 - high heels - Bob cut with fringe With black and pink gradient - Remove all the
 * clothes, ..."), so only the name before the first " - " stays, and the words keep their first four.
 * ponytail: a user's own name holding " - " loses its tail too; a stored base name if that bites.
 * @param {Object} values - the run's field values
 * @param {?string} sourceName - the edited card's name; null for a file from outside the project
 * @returns {string}
 */
export function characterSheetEditorCardName(values = {}, sourceName = null) {
    const age = _age(values.Input_Age);
    const words = (values.change || 'none') !== 'none'
        ? _shortWords(_words(values.words)) || (_usesRef(values) ? `${REF_THING[values.change].replace(/^the /, '')} from a reference` : '')
        : '';
    const change = [words, age === 0 ? 'newborn' : age > 0 ? `age ${age}` : ''].filter(Boolean).join(', ');
    return `${String(sourceName || '').split(' - ')[0].trim() || 'Character sheet'} - ${change}`;
}

/** The first four words, with an ellipsis when there were more. */
function _shortWords(text) {
    const w = text.split(/\s+/).filter(Boolean);
    return w.length > 4 ? `${w.slice(0, 4).join(' ').replace(/[,;:.]+$/, '')}…` : w.join(' ');
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
    return buildChangePrompt(values.change, values.words, _usesRef(values), values.refHair, values.refMakeup, values.refBeard) || '';
}

/**
 * The prompt and lock for one leg of the run.
 *
 * The child-safety gate never reads these words (MPI-1156): every leg carries the run's TYPED words
 * and the Age slider as `minorAge` (`flowGateInputs`), so "Clothes: a bikini" + "Age: 10" is refused
 * on leg 1, before anything runs.
 *
 * @param {'change'|'age'|'rebuild'} part - which leg (FlowDef `chain[].prompt`; leg 1 is `change`)
 * @param {Object} values - the run's field values plus the describe answers (`sheetAge`, `sheetClothes`)
 * @returns {{positive: string, injectionParams: Object}}
 */
export function characterSheetEditor(part, values = {}) {
    const injectionParams = {};
    // The Klein graph's lock; the Qwen and from-images graphs have no `Input_Lock` and skip it.
    if (part !== 'rebuild') injectionParams.Input_Lock = part === 'age' ? 0 : (LOCK[values.change] ?? 0);
    // Only the change leg reads the Reference picture: an age leg that starts the run is handed the
    // user's media too, and would otherwise dress the sheet from it.
    if (part !== 'rebuild') injectionParams.Input_Reference = part === 'change' && _usesRef(values);
    // MPI-1086: the change leg removes the head IN its graph (the card's Headless version, shown or
    // not by the toggle) unless an Age leg follows: the head removal is the run's last step, so then
    // the chained Headless leg does it after the age legs.
    if (part !== 'rebuild') injectionParams.Input_Headless = part === 'change' && _age(values.Input_Age) < 0;
    // The Reference picture is a mannequin already (the describer said so): the Qwen graph skips
    // making one of it. The Klein graph has no such node and ignores it. Accessories and Tattoos
    // never want one: the raw picture goes in as image 2 (MPI-1086 r29, r31-r35). Makeup gets its
    // own mannequin, the head wearing only the makeup (r41/r42), and Beard the head wearing only the beard (bp1).
    // Face tattoos get a mannequin of the picture's head (fa1 P2: the raw head brought its makeup).
    const faceInk = _faceInk(values.change, values.words);
    if (part === 'change') {
        injectionParams.Input_Is_Mannequin = (RAW_REF.has(values.change) && !faceInk) || /^\W*yes\b/i.test(values.refIsMannequin || '');
        if (values.change === 'makeup') injectionParams.Input_Mannequin_Prompt = MAKEUP_MANNEQUIN;
        if (values.change === 'beard') injectionParams.Input_Mannequin_Prompt = BEARD_MANNEQUIN;
        if (faceInk) injectionParams.Input_Mannequin_Prompt = TATTOO_MANNEQUIN;
    }
    // MPI-1086 r47: Makeup edits the two faces only (`TWO_FACES`), face tattoos too (fa1-fa4); an age leg edits the
    // whole sheet. A face-tattoo picture is cropped to its head first (`Input_Ref_Head_Crop`).
    if (part !== 'rebuild') {
        injectionParams.Input_Face_Crop = part === 'change' && (values.change === 'makeup' || faceInk);
        injectionParams.Input_Ref_Head_Crop = part === 'change' && faceInk && _usesRef(values);
    }
    // MPI-1086 r37: Tattoos redraw the back figure from the edited front one, in the same Qwen graph.
    // r44: the sheet is stitched back together at the panel cuts the app measured (`sheetCuts`, "x1,x2"
    // in the sheet's pixels); 0 = the graph's own 25% / 50%, for a sheet with no clear gaps.
    if (part !== 'rebuild') {
        const back = part === 'change' ? buildBackPassPrompt(values.change, values.words, _usesRef(values)) : '';
        injectionParams.Input_Back_Pass = !!back;
        injectionParams.Input_Positive_2 = back;
        // ff1: Accessories pass 1 sees no back figure (the front body | the close-up); the back pass draws it, or
        // (a necklace) the sheet's own back view stays.
        const front = part === 'change' && values.change === 'accessories' && !!_words(values.words);
        injectionParams.Input_Front_Crop = front;
        const cuts = back || front ? String(values.sheetCuts || '').match(/^(\d+),(\d+)$/) : null;
        injectionParams.Input_Cut_1 = cuts ? Number(cuts[1]) : 0;
        injectionParams.Input_Cut_2 = cuts ? Number(cuts[2]) : 0;
    }
    return { positive: _part(part, values), injectionParams };
}
