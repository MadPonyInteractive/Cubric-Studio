/**
 * character-sheet-editor.test.cjs — MPI-1041 Phase B. The Character Sheet Editor Flow:
 *
 *   1. every change builds the template that passed on the bench, word for word
 *      (tasks/MPI-1041/validation.md, research/templates.md) - a rewording is a new bench run;
 *   2. the age is written as WORDS, and a child / teen / adult run of every leg clears the
 *      child-safety gate on both models, while a child age with unclothed or swimwear words is
 *      refused - on LEG 1 already: every leg carries the run's typed words and the Age slider
 *      (`flowGateInputs`, MPI-1156; the gate checks one job at a time);
 *   3. the FlowDef routes each change to its editor, runs the right legs, resolves each leg's
 *      model for its op, and asks for Qwen-Image 2.1 only when the run needs it;
 *   4. (Phase C) the picture check the gate cannot make - an undressed sheet made a minor -
 *      refuses with ONE code and message on the hand, agent and routine paths; the result card
 *      is named after the input.
 */

'use strict';

// Must exist BEFORE llmService loads (section 4 reaches the describer): its preferences read it.
const _ls = {};
global.localStorage = {
    getItem: k => (Object.prototype.hasOwnProperty.call(_ls, k) ? _ls[k] : null),
    setItem: (k, v) => { _ls[k] = String(v); },
    removeItem: (k) => { delete _ls[k]; },
};

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const esm = p => import('file://' + path.join(ROOT, p).replace(/\\/g, '/'));
const builder = () => esm('js/data/flowPrompts/characterSheetEditor.js');
const gate = () => esm('js/data/childSafety.js');

const L1 = ' Make the same change in the close-up portrait on the right. Keep everything else exactly as it is.';

// ── 1. The bench templates ───────────────────────────────────────────────────

test('every change builds its bench template verbatim', async () => {
    const { buildChangePrompt } = await builder();
    assert.strictEqual(buildChangePrompt('clothes', 'a red leather jacket, black jeans and boots'),
        "Change the character's clothes in image 1: a red leather jacket, black jeans and boots. The front view, the "
        + 'character seen from behind and the close-up portrait on the right all show the same change, with the same '
        + "neckline, sleeves and straps. Keep the character's own face and hair. Keep everything else exactly as it is.");
    // MPI-1086 r30: Accessories runs on Qwen, every figure named, "to wear or hold" (a bare "Mask" became a matte).
    // ac2: "Add nothing else" (a G3 came with a thigh pouch, belt and sling). ff1: pass 1 sees no back figure, so
    // names none ("a basketball under his arm" landed on the back view only).
    assert.strictEqual(buildChangePrompt('accessories', 'a red scarf and round glasses'),
        'Give the character in image 1 this accessory to wear or hold: a red scarf and round glasses. The full-body '
        + 'figure on the left and the close-up portrait on the right both show it wherever it can be seen. '
        + "Add nothing else: no other gear, bags, belts or straps. Keep the character's own face, hair, skin and "
        + 'clothes. Keep everything else exactly as it is.');
    // MPI-1086 r34: Makeup and Tattoos in words, on Qwen; her own face named, no limb named for tattoos.
    // r47: Makeup edits the two faces only (the graph's face canvas), each face kept its own.
    assert.strictEqual(buildChangePrompt('makeup', 'dark gothic makeup with smoky eyes and black lipstick'),
        "Image 1 shows the same person's face twice. Give both faces this makeup: dark gothic makeup with smoky eyes and "
        + "black lipstick. Keep each face's own shape, eyes, nose, lips, eyebrows, facial hair, skin tone and hair exactly "
        + 'as they are; only the makeup changes. Keep everything else exactly as it is.');
    assert.strictEqual(buildChangePrompt('tattoos', 'a large blue and orange koi fish tattoo covering the whole back'),
        'Give the character in image 1 this tattoo: a large blue and orange koi fish tattoo covering the whole back. The '
        + 'front view, the character seen from behind and the close-up portrait on the right all show it wherever it can '
        + "be seen. Add no other tattoos. Keep the character's own face, hair, skin tone and clothes. Keep everything else "
        + 'exactly as it is.');
    // MPI-1086 r28: on Qwen, every figure named.
    const HAIR = w => `Give the character this hairstyle: ${w}. The head is uncovered, no hat. The front view, the character `
        + 'seen from behind and the close-up portrait on the right all show the same new hairstyle. '
        + "Keep the character's own face and clothes. Keep everything else exactly as it is.";
    assert.strictEqual(buildChangePrompt('hair', 'a short blonde bob haircut'), HAIR('a short blonde bob haircut'));
    // MPI-1086 bd2: the bench's b_each string, byte for byte.
    assert.strictEqual(buildChangePrompt('beard', 'a short neat grey goatee'),
        'Give the character this beard: a short neat grey goatee. The full-body front view and the close-up portrait on '
        + 'the right both show this beard on the face, and the character seen from behind shows it wherever it can be '
        + 'seen. Keep the character\'s own face, hair and clothes. Keep everything else exactly as it is.');
    // bd4: an empty box asks for a full beard in the hair's colour.
    assert.strictEqual(buildChangePrompt('beard', ' '), buildChangePrompt('beard',
        'a full, neatly trimmed beard and moustache in the same colour as the hair'));
    assert.strictEqual(buildChangePrompt('condition', 'beaten up after a fight: a bruised, cut face and torn, dirty clothes'),
        'Make the character look beaten up after a fight: a bruised, cut face and torn, dirty clothes.' + L1);
    assert.strictEqual(buildChangePrompt('body', 'heavyset and overweight'), "Make the character's body heavyset and overweight." + L1);
    // MPI-1086 qh6 C2, the view words said the safe way.
    assert.strictEqual(buildChangePrompt('custom', 'holding a sword on the back view.'),
        'Change the character in this character sheet: holding a sword seen from behind. Make the same change on the '
        + 'character seen from behind and in the close-up portrait on the right. Keep everything else exactly as it is.');
    // The user's own full stop is not doubled; no words, no prompt.
    assert.strictEqual(buildChangePrompt('hair', '  a buzz cut. '), HAIR('a buzz cut'));
    assert.strictEqual(buildChangePrompt('clothes', '   '), null);
    assert.strictEqual(buildChangePrompt('none', 'anything'), null);
});

test('the age template: child, teen, younger and older adult, by the describer\'s read', async () => {
    const { buildAgePrompt, parseApparentAge } = await builder();
    const C = 'Change the character in this character sheet to be a younger version of themselves as a ';
    assert.strictEqual(buildAgePrompt(10, 42),
        C + "10-year-old child, with a child's smooth face, no beard and no wrinkles, wearing the same clothes." + L1);
    assert.strictEqual(buildAgePrompt(15, 42),
        C + "15-year-old, with a teenager's smooth face, no beard and no wrinkles, the same hairstyle and hair color, "
        + 'wearing the same clothes.' + L1);
    assert.strictEqual(buildAgePrompt(30, 68), C + '30-year-old, with a younger face, smooth skin and no grey hair, the same hairstyle and hair color.' + L1);
    // Phase E: an old sheet read older than an old target keeps its grey hair and beard; F1: near the read
    // (within 15) no direction word, or the beard goes. Further off, the younger wording stays.
    assert.strictEqual(buildAgePrompt(70, 82), 'Change the character in this character sheet to be a 70-year-old.' + L1);
    assert.strictEqual(buildAgePrompt(45, 82), C + '45-year-old, with a younger face.' + L1);
    assert.strictEqual(buildAgePrompt(35, 45), C + '35-year-old, with a younger face, smooth skin and no grey hair, the same hairstyle and hair color.' + L1);
    assert.strictEqual(buildAgePrompt(70, 42),
        'Change the character in this character sheet to be an older version of themselves as a 70-year-old.' + L1);
    // No read: a typical adult (35), so 60 is older and 25 younger.
    assert.match(buildAgePrompt(60, NaN), /an older version of themselves as a 60-year-old\./);
    assert.match(buildAgePrompt(25, NaN), /a younger version of themselves as a 25-year-old,/);
    // Batch 21: a newborn is swaddled; a 1-year-old keeps the hair.
    assert.strictEqual(buildAgePrompt(0, 40), C.slice(0, -2) + "a newborn baby a few weeks old, with a baby's round face, "
        + 'smooth skin and very little hair, swaddled in a soft cream knit blanket so only the face shows.' + L1);
    assert.strictEqual(buildAgePrompt(1, 40), C + "1-year-old child, with a child's smooth face, no beard and no wrinkles, "
        + 'the same hairstyle and hair color, wearing the same clothes.' + L1);
    assert.strictEqual(parseApparentAge('About 40.'), 40);
    assert.ok(Number.isNaN(parseApparentAge('')));
});

test('a child\'s bodies are rebuilt with batch 17\'s words and the sheet\'s clothes', async () => {
    const { buildRebuildPrompt, characterSheetEditor } = await builder();
    const caption = 'Wearing an olive green utility-style jacket over a mustard yellow ribbed sweater, paired with matching olive green trousers and brown leather shoes.';
    assert.strictEqual(buildRebuildPrompt(10, caption),
        "A 10-year-old child with a child's height and body proportions: a short, small body with shorter arms and legs, "
        + 'a shorter torso and a larger head for the body. ' + caption);
    // A Clothes change replaces the described clothes with the user's words.
    const built = characterSheetEditor('rebuild', { change: 'clothes', words: 'a navy wool coat', Input_Age: 8, sheetClothes: caption });
    assert.match(built.positive, /^A 8-year-old child .* Wearing a navy wool coat\.$/);
    // A newborn is swaddled: no caption, or the bodies come back dressed (batch 21).
    assert.strictEqual(buildRebuildPrompt(0, caption), 'A newborn baby a few weeks old, swaddled snugly in a soft cream '
        + 'knit blanket so only its face shows, lying on its back. It is too small to stand.');
    assert.strictEqual(buildRebuildPrompt(1, caption), "A 1-year-old toddler taking its first steps, with a toddler's body "
        + 'proportions: a short, chubby body with short chubby arms and legs and a large head for the body. ' + caption);
});

test('a run with no words for its change, or nothing to change, is refused', async () => {
    const { characterSheetEditorRefusal: refuse } = await builder();
    assert.ok(refuse({ change: 'clothes', words: '' }));
    assert.ok(refuse({ change: 'none', Input_Age: -1 }));
    assert.ok(refuse({ change: 'none' }), 'no age at all is keep, never a newborn');
    assert.ok(refuse({ change: 'none', Input_Age: null }));
    assert.strictEqual(refuse({ change: 'none', Input_Age: 0 }), null, '0 is a newborn: a change');
    assert.strictEqual(refuse({ change: 'none', Input_Age: 30 }), null);
    assert.strictEqual(refuse({ change: 'hair', words: 'a bob', Input_Age: -1 }), null);
    // Beard with an empty box is a full beard (Fabio), never a refusal.
    assert.strictEqual(refuse({ change: 'beard', words: '' }), null);
});

test('each leg carries its lock, its head removal and the mannequin flag', async () => {
    const { characterSheetEditor } = await builder();
    const values = { change: 'clothes', words: 'a tweed suit', Input_Age: 10, sheetAge: '40', sheetClothes: 'Wearing a coat.' };
    const change = characterSheetEditor('change', values);
    assert.strictEqual(change.injectionParams.Input_Lock, 1);
    assert.strictEqual(characterSheetEditor('change', { ...values, change: 'accessories' }).injectionParams.Input_Lock, 0);
    assert.strictEqual(characterSheetEditor('change', { ...values, change: 'custom' }).injectionParams.Input_Lock, 0);
    assert.strictEqual(characterSheetEditor('age', values).injectionParams.Input_Lock, 0);
    assert.ok(!('Input_Lock' in characterSheetEditor('rebuild', values).injectionParams));
    // MPI-1086: the change leg removes the head in its own graph only when no Age leg follows it.
    assert.strictEqual(change.injectionParams.Input_Headless, false, 'an age leg follows');
    assert.strictEqual(characterSheetEditor('change', { ...values, Input_Age: -1 }).injectionParams.Input_Headless, true);
    assert.strictEqual(characterSheetEditor('age', { ...values, Input_Age: -1 }).injectionParams.Input_Headless, false);
    assert.ok(!('Input_Headless' in characterSheetEditor('rebuild', values).injectionParams));
    // The describer's yes/no on the Reference picture: a mannequin is not made into one again.
    const hair = (refIsMannequin) => characterSheetEditor('change', { ...values, change: 'hair', refIsMannequin }).injectionParams;
    assert.strictEqual(hair('Yes.').Input_Is_Mannequin, true);
    assert.strictEqual(hair('yes, a wig head').Input_Is_Mannequin, true);
    assert.strictEqual(hair('No.').Input_Is_Mannequin, false);
    assert.strictEqual(hair(undefined).Input_Is_Mannequin, false);
});

test('F2: an optional Reference picture replaces or joins the words, Clothes / Accessories / Hairstyle, on the change leg only', async () => {
    const { characterSheetEditor, characterSheetEditorRefusal: refuse, characterSheetEditorCardName: name, buildChangePrompt } = await builder();
    const REF = { role: 'image2', mediaType: 'image', url: '/project-file?path=C%3A%2Fp%2FMedia%2Fdress.png' };
    const run = (change, words, age = -1) => ({ change, words, Input_Age: age, mediaItems: [{ role: 'image1', url: 'x' }, REF] });
    // The MPI-1090 bench strings (tasks/MPI-1090/validation.md, rounds 2-4, on the graph's shoulder lock): every
    // figure named, the back one only as "seen from behind" (naming "the back view" with a reference drew an
    // extra figure, MPI-1041 F2 round 2). The old clothes are taken off in words (F2 rounds 4-7: a bikini kept
    // the jeans); "everything else" only with no words, since with words it stripped what they left out.
    const ALL = ' The front view, the character seen from behind and the close-up portrait on the right all show the '
        + 'same outfit, with the same neckline, sleeves and straps.';
    const KEEP = ' Keep everything else exactly as it is.';
    assert.strictEqual(buildChangePrompt('clothes', '', true), 'Dress the character in only the outfit from the reference '
        + 'picture. Take off everything else the character wears now, trousers, skirt and top included.' + ALL + KEEP);
    // The words get their OWN sentence: spliced into the reference clause, "G string on the back view" became
    // the whole outfit and redrew the front figure as a second back view (Fabio, flowCSE_012).
    assert.strictEqual(buildChangePrompt('clothes', 'the green jacket.', true),
        'Dress the character in the outfit from the reference picture, replacing all of the clothes the character '
        + 'wears now, top and bottom.' + ALL + ' Change only this about the outfit: the green jacket. The close-up '
        + 'portrait on the right shows the top of the outfit from the reference picture, with its neckline.' + KEEP);
    assert.match(buildChangePrompt('clothes', 'G string on the back view', true),
        /outfit: G string seen from behind\. /, 'a view the words name is said the safe way');
    assert.match(buildChangePrompt('clothes', 'a bow at The Back View, lace in the back view', true),
        /outfit: a bow seen from behind, lace seen from behind\. /);
    assert.match(buildChangePrompt('clothes', 'a bow on the back of the dress', true), /a bow on the back of the dress\./,
        'only "the back view" is a view; "the back of" is the garment');
    assert.doesNotMatch(buildChangePrompt('clothes', 'the green jacket', true), /everything else the character/);
    for (const w of ['', 'G string on the back view']) {
        assert.doesNotMatch(buildChangePrompt('clothes', w, true), /back view/);
    }
    // MPI-1086 r29: Accessories takes the picture WITH words naming it, on Qwen: the raw picture as image 2, only the
    // thing taken from it. A leading article is dropped ("the the ..."), the first letter lowered as benched.
    assert.strictEqual(buildChangePrompt('accessories', '', true), null);
    const ACC = t => `Give the character in image 1 the ${t} from image 2. The full-body figure on the left and the `
        + `close-up portrait on the right both show the ${t} wherever it can be seen. Take only the ${t} from `
        + "image 2, not the person: keep the character's own face, hair, skin and clothes." + KEEP;
    assert.strictEqual(buildChangePrompt('accessories', 'the large gold hoop earrings', true), ACC('large gold hoop earrings'));
    assert.strictEqual(buildChangePrompt('accessories', 'Mini gun', true), ACC('mini gun'));
    assert.strictEqual(buildChangePrompt('accessories', 'A mask', true), ACC('mask'));
    const acc = characterSheetEditor('change', run('accessories', 'the bandana')).injectionParams;
    assert.strictEqual(acc.Input_Reference, true);
    assert.strictEqual(acc.Input_Is_Mannequin, true, 'the raw picture goes in: no mannequin is made of it');
    assert.strictEqual(refuse(run('accessories', '')), 'Say what the Reference picture shows, for example "the gold hoop earrings".');
    assert.strictEqual(refuse(run('accessories', 'the bandana')), null);
    assert.strictEqual(refuse({ change: 'accessories', words: '' }), 'Say what to change, or add a Reference picture.');
    // MPI-1086 r41/r42: Makeup with a picture = the graph's MANNEQUIN wearing only the makeup as image 2, the
    // describer's words naming it again, the character's own face named part by part (the raw picture put its
    // person's face on a man's sheet). The user's words LEAD (r42b: after the description "red lipstick" stayed black).
    // r47: on the graph's face canvas, so "both faces".
    const OWN = " Keep each face's own shape, eyes, nose, lips, eyebrows, facial hair, skin tone and hair exactly as they "
        + 'are; only the makeup changes.';
    const APPLY = "Image 1 shows the same person's face twice. Apply the makeup from image 2 onto both faces in image 1";
    const SPIDER = 'Black spiderweb face paint with orange eyeshadow, black eyeliner, false lashes, and black lipstick.';
    const SPIDER_W = 'Black spiderweb face paint with orange eyeshadow, black eyeliner, false lashes, and black lipstick';
    assert.strictEqual(buildChangePrompt('makeup', '', true, '', SPIDER), `${APPLY}: ${SPIDER_W}.${OWN}${KEEP}`);
    assert.strictEqual(buildChangePrompt('makeup', 'red lipstick.', true, '', SPIDER), `${APPLY}, changed like this: red `
        + `lipstick. The makeup in image 2: ${SPIDER_W}. Make it red lipstick on both faces.${OWN}${KEEP}`);
    assert.strictEqual(buildChangePrompt('makeup', '', true), `${APPLY}.${OWN}${KEEP}`, 'no description: the mannequin alone');
    assert.strictEqual(buildChangePrompt('makeup', 'no lashes', true), `${APPLY}, changed like this: no lashes. Make it `
        + `no lashes on both faces.${OWN}${KEEP}`);
    assert.strictEqual(refuse(run('makeup', '')), null, 'the picture alone is enough');
    const mk = characterSheetEditor('change', { ...run('makeup', ''), refMakeup: SPIDER }).injectionParams;
    assert.strictEqual(mk.Input_Is_Mannequin, false, 'a makeup mannequin is made of the picture');
    assert.match(mk.Input_Mannequin_Prompt, /^Replace the head of the person with a plain bald mannequin head, and keep only the makeup/);
    assert.strictEqual(mk.Input_Face_Crop, true, 'r47: Makeup edits the two faces only');
    assert.strictEqual(characterSheetEditor('change', { change: 'makeup', words: 'red lipstick' }).injectionParams.Input_Face_Crop, true);
    assert.strictEqual(characterSheetEditor('change', run('hair', '')).injectionParams.Input_Face_Crop, false, 'hair: the whole sheet');
    assert.strictEqual(characterSheetEditor('age', { change: 'makeup', words: 'red lipstick', Input_Age: 30 }).injectionParams.Input_Face_Crop,
        false, 'an age leg edits the whole sheet');
    assert.match(characterSheetEditor('change', { ...run('makeup', ''), refMakeup: SPIDER }).positive, /: Black spiderweb face paint/);
    assert.strictEqual(characterSheetEditor('change', { ...run('makeup', ''), refIsMannequin: 'Yes.' }).injectionParams.Input_Is_Mannequin, true,
        'a picture that is a mannequin already is not made into one again');
    assert.ok(!('Input_Mannequin_Prompt' in characterSheetEditor('change', run('hair', '')).injectionParams),
        'hair keeps the graph\'s own (hairstyle) mannequin prompt');
    assert.strictEqual(name(run('makeup', ''), 'Ava'), 'Ava - makeup from a reference');
    // MPI-1086 bp1: a Beard picture alone is enough; the bench's b_ref string, byte for byte, and its mannequin.
    const B_ON = ' The full-body front view and the close-up portrait on the right both show this beard on the face, and '
        + "the character seen from behind shows it wherever it can be seen. Keep the character's own face, hair and clothes. "
        + 'Keep everything else exactly as it is.';
    const GREY = 'Long, full, graying beard and moustache with natural, unkempt trim';
    assert.strictEqual(buildChangePrompt('beard', '', true, '', '', `${GREY}.`),
        `Give the character in image 1 the beard and moustache from image 2: ${GREY}.${B_ON}`);
    assert.strictEqual(buildChangePrompt('beard', '', true), `Give the character in image 1 the beard and moustache from image 2.${B_ON}`,
        'no description: the mannequin alone, never the empty-box default');
    assert.strictEqual(buildChangePrompt('beard', 'in red.', true, '', '', GREY), 'Give the character in image 1 the beard and '
        + `moustache from image 2, changed like this: in red. The beard in image 2: ${GREY}. Make it in red.${B_ON}`);
    assert.strictEqual(refuse(run('beard', '')), null, 'the picture alone is enough');
    const bd = characterSheetEditor('change', { ...run('beard', ''), refBeard: GREY });
    assert.strictEqual(bd.injectionParams.Input_Is_Mannequin, false, 'a beard mannequin is made of the picture');
    assert.strictEqual(bd.injectionParams.Input_Mannequin_Prompt, 'Replace the head of the person with a plain white mannequin '
        + 'head, and keep only the beard and moustache, exactly as they are: the same colour, length, shape and style. No '
        + 'hair on the head, no jewellery and no clothes, on a plain grey background.', 'bp3 W: WHITE, a skin-coloured head took the face');
    assert.strictEqual(bd.injectionParams.Input_Face_Crop, false, 'a long beard spills past a face crop: the whole sheet');
    assert.match(bd.positive, /from image 2: Long, full, graying beard/);
    assert.strictEqual(name(run('beard', ''), 'Ava'), 'Ava - beard from a reference');
    // MPI-1086 r34/r35: a tattoo picture ALONE inked limbs it never showed (4 of 6): words saying where are required.
    assert.strictEqual(refuse(run('tattoos', '')), 'Say what the Reference picture shows, for example "the neck and chest tattoos".');
    assert.strictEqual(refuse(run('tattoos', 'Neck and chest tattoos')), null);
    assert.strictEqual(buildChangePrompt('tattoos', 'Neck and chest tattoos', true),
        'Give the character in image 1 the neck and chest tattoos from image 2. The front view, the character seen from '
        + 'behind and the close-up portrait on the right all show the neck and chest tattoos wherever it can be seen. Add '
        + 'no other tattoos. The face stays bare: no tattoo on the face. Take only the neck and chest tattoos from image 2, '
        + "not the person: keep the character's own face, hair, skin and clothes." + KEEP);
    // ac4-ac7: a picture with no face inked the cheek anyway; words naming the face drop the bare-face line.
    assert.doesNotMatch(buildChangePrompt('tattoos', 'Face and neck tattoos', true), /face stays bare/);
    assert.doesNotMatch(buildChangePrompt('tattoos', 'a koi on the back'), /face stays bare/, 'a picture only');
    assert.strictEqual(characterSheetEditor('change', run('tattoos', 'a back tattoo')).injectionParams.Input_Is_Mannequin, true);
    assert.doesNotMatch(buildChangePrompt('accessories', 'a bandana', true), /tattoos/, 'Accessories keeps its own string');
    // fa1-fa4: tattoo words naming the face and nothing else edit the two faces only, sides said as the picture's (fa3 W6).
    const INK_OWN = " Keep each face's own shape, eyes, nose, lips, eyebrows, facial hair, skin tone and hair exactly as they "
        + 'are; only the tattoos are added.' + KEEP;
    assert.strictEqual(buildChangePrompt('tattoos', 'a small black star tattoo on the left cheekbone'), "Image 1 shows the "
        + "same person's face twice. Add these face tattoos to both faces, in the same place on each: a small black star "
        + 'tattoo on the cheekbone on the right side of the picture.' + INK_OWN, 'fa3_ts_W6');
    assert.strictEqual(buildChangePrompt('tattoos', 'a small black teardrop tattoo under the left eye, and thin black tribal '
        + 'lines across the right temple and cheekbone'), "Image 1 shows the same person's face twice. Add these face "
        + 'tattoos to both faces, in the same place on each: a small black teardrop tattoo under the eye on the right side '
        + 'of the picture, and thin black tribal lines across the temple on the left side of the picture and cheekbone.'
        + INK_OWN, 'fa3_tw_W6');
    assert.strictEqual(buildChangePrompt('tattoos', 'Face and head tattoos', true), "Image 1 shows the same person's face "
        + 'twice. Copy the face and head tattoos from image 2 onto both faces in image 1, the same designs in the same place '
        + 'on the face and head, on the same side of the face as in image 2. Add no other tattoos, none on the neck, and no '
        + 'makeup.' + INK_OWN, 'fa4_tp_P4');
    const fw = characterSheetEditor('change', { change: 'tattoos', words: 'a star under her left eye', Input_Age: -1 }).injectionParams;
    assert.deepStrictEqual([fw.Input_Face_Crop, fw.Input_Back_Pass, fw.Input_Ref_Head_Crop], [true, false, false]);
    const fp = characterSheetEditor('change', run('tattoos', 'Face and head tattoos')).injectionParams;
    assert.deepStrictEqual([fp.Input_Face_Crop, fp.Input_Back_Pass, fp.Input_Ref_Head_Crop, fp.Input_Is_Mannequin],
        [true, false, true, false], 'a picture: its head made a mannequin (fa1 P1: the raw head brought its makeup)');
    assert.strictEqual(fp.Input_Mannequin_Prompt, 'Replace the head of the person with a plain bald mannequin head, and keep '
        + 'only the tattoos on the face, exactly as they are: the same designs, colours and places. The scalp and the neck '
        + 'are bare, with no tattoo. No hair, no makeup, no jewellery and no clothes, on a plain grey background.',
        'fh3_F: no scalp or neck ink in the mannequin, so none lands on the cheek');
    for (const w of ['Face and neck tattoos', 'Neck and chest tattoos', 'a rose on the left arm', 'a koi on the back',
        'Full-body tattoos, face included']) {
        const p = characterSheetEditor('change', run('tattoos', w)).injectionParams;
        assert.deepStrictEqual([p.Input_Face_Crop, p.Input_Ref_Head_Crop, p.Input_Is_Mannequin], [false, false, true], w);
    }
    assert.strictEqual(characterSheetEditor('age', run('tattoos', 'a star on the cheek', 30)).injectionParams.Input_Face_Crop,
        false, 'an age leg edits the whole sheet');
    // MPI-1086 r37: Tattoos redraw the back figure from the edited front one; words go into that pass, a picture does not.
    // ac2: image 2 = the sheet's original back figure, so the outfit's back stays; the skin and ink come from image 1.
    const TURN = 'Turn the character in image 1 around so the character is seen from behind, full body from head to '
        + 'feet, standing in the same pose, on the same plain grey background. Image 2 is this character seen from behind: ';
    const TAT = TURN + 'keep the hair, clothes and shoes exactly as in image 2, and the skin and its tattoos as in image 1.';
    const pic = characterSheetEditor('change', run('tattoos', 'Leg tattoo')).injectionParams;
    assert.deepStrictEqual([pic.Input_Back_Pass, pic.Input_Positive_2], [true, TAT + KEEP]);
    const words = characterSheetEditor('change', { change: 'tattoos', words: 'a black snake tattoo on the right leg',
        Input_Age: -1, mediaItems: [{ role: 'image1', url: 'x' }] }).injectionParams;
    assert.deepStrictEqual([words.Input_Back_Pass, words.Input_Positive_2], [true, TAT + ' The character has this '
        + 'tattoo: a black snake tattoo on the right leg. Show it wherever it can be seen from behind.' + KEEP]);
    // ac4: a tattoo on the back alone takes one pass (turned round from the front, the back piece was lost, ac3).
    for (const w of ['Back tattoos', 'a koi covering the whole back']) {
        assert.strictEqual(characterSheetEditor('change', run('tattoos', w)).injectionParams.Input_Back_Pass, false, w);
    }
    for (const w of ['Back and arm tattoos', 'tattoos on the back of the neck', 'full body tattoos, back included']) {
        assert.strictEqual(characterSheetEditor('change', run('tattoos', w)).injectionParams.Input_Back_Pass, true, w);
    }
    // ac2: Accessories take the back pass too (a held G3 stuck out at his side from behind), words or picture; only
    // what can be seen from behind (a necklace's pendant was drawn on her back). ff1: no example object named (Fabio:
    // "only a chain or strap shows at the back" drew a chain on his basketball). ff4: the sides swap from behind (a
    // walking stick on the right side 1/4 -> 4/4).
    const ACC2 = TURN + 'keep the hair, body, skin tone, clothes and shoes exactly as in image 2. The character has this '
        + 'accessory: a G3 held in both hands, held as in image 1. Seen from behind, left and right swap: a thing in the '
        + 'hand on the left side of image 1 is in the hand on the right side of the picture, and a thing on the right '
        + 'side of image 1 is on the left side of the picture. Show only what can be seen from behind.' + KEEP;
    for (const v of [run('accessories', 'a G3 held in both hands'), { change: 'accessories', words: 'a G3 held in both hands' }]) {
        const p = characterSheetEditor('change', { Input_Age: -1, ...v }).injectionParams;
        assert.deepStrictEqual([p.Input_Back_Pass, p.Input_Positive_2, p.Input_Front_Crop], [true, ACC2, true]);
    }
    for (const c of ['makeup', 'hair', 'body']) {
        assert.strictEqual(characterSheetEditor('change', run(c, 'x')).injectionParams.Input_Back_Pass, false, c);
    }
    // ff2/ff3: a thing hanging on the front takes no back pass (the heart pendant was drawn on her back 4/4 whatever
    // the wording); pass 1 still sees the front | close-up only, so the cuts still go in.
    for (const w of ['A long gold necklace with a heart pendant', 'a silver locket', 'a red bow tie', 'a police badge']) {
        const p = characterSheetEditor('change', { ...run('accessories', w), sheetCuts: '450,882' }).injectionParams;
        assert.deepStrictEqual([p.Input_Back_Pass, p.Input_Positive_2, p.Input_Front_Crop, p.Input_Cut_1, p.Input_Cut_2],
            [false, '', true, 450, 882], w);
    }
    // ff6 (Fabio's double pouch): a bag worn on the front with a strap -> the back pass names only the strap, pass 1
    // names it in the close-up; with no strap named, no back pass.
    const POUCH = 'A small black crossbody sling bag worn on the chest, its strap over one shoulder and across the back';
    const accWords = w => ({ change: 'accessories', words: w, Input_Age: -1 });
    const pouch = characterSheetEditor('change', accWords(POUCH));
    // ff10: the close-up line names where the strap runs (1/4 -> 4/4), for any bag on a shoulder strap.
    const STRAP_LINE = 'wherever it can be seen. The close-up portrait on the right shows the strap running over the '
        + 'shoulder and down across the chest. Add nothing else';
    assert.ok(pouch.positive.includes(STRAP_LINE), pouch.positive);
    assert.strictEqual(pouch.injectionParams.Input_Positive_2, TURN + 'keep the hair, body, skin tone, clothes and shoes '
        + 'exactly as in image 2. The character wears a thin strap that runs diagonally across the back, from one shoulder '
        + 'down to the other side of the waist. Seen from behind, left and right swap: the shoulder on the left side of '
        + 'image 1 is on the right side of the picture.' + KEEP);
    assert.strictEqual(characterSheetEditor('change', accWords('a leather chest pouch')).injectionParams.Input_Back_Pass, false);
    assert.ok(!characterSheetEditor('change', accWords('A black hiking backpack')).positive.includes('the strap running'));
    assert.ok(!characterSheetEditor('change', accWords('a watch with a leather strap')).positive.includes('the strap running'));
    // Cosmo's hip pouch: the strap runs across the chest, the bag hangs at the hip and shows from behind.
    const hip = characterSheetEditor('change', accWords('a small tan leather pouch worn at the hip, on a strap over one shoulder across the chest'));
    assert.ok(hip.injectionParams.Input_Positive_2.includes('The character has this accessory: a small tan leather pouch'));
    assert.ok(hip.positive.includes(STRAP_LINE), hip.positive);
    for (const w of ['Large gold hoop earrings', 'a wooden walking stick', 'A black hiking backpack', 'tied-up boots']) {
        assert.strictEqual(characterSheetEditor('change', run('accessories', w)).injectionParams.Input_Back_Pass, true, w);
    }
    // ff1: only Accessories edits the front body | close-up alone; Tattoos keep the whole sheet in pass 1.
    for (const c of ['tattoos', 'makeup', 'hair', 'clothes']) {
        assert.strictEqual(characterSheetEditor('change', run(c, 'Leg tattoo')).injectionParams.Input_Front_Crop, false, c);
    }
    assert.strictEqual(characterSheetEditor('age', run('accessories', 'a hat', 30)).injectionParams.Input_Front_Crop, false,
        'an age leg edits the whole sheet');
    assert.strictEqual(characterSheetEditor('age', run('tattoos', 'Leg tattoo', 30)).injectionParams.Input_Back_Pass, false,
        'only the change leg takes the back pass');
    // MPI-1086 r44: the back pass stitches the sheet at the cuts the app measured; none = the graph's 25% / 50%.
    const cut = (values) => { const p = characterSheetEditor('change', values).injectionParams; return [p.Input_Cut_1, p.Input_Cut_2]; };
    assert.deepStrictEqual(cut({ ...run('tattoos', 'Leg tattoo'), sheetCuts: '510,1002' }), [510, 1002]);
    assert.deepStrictEqual(cut(run('tattoos', 'Leg tattoo')), [0, 0], 'not measured: the default cuts');
    assert.deepStrictEqual(cut({ ...run('tattoos', 'Leg tattoo'), sheetCuts: '' }), [0, 0], 'no clear gaps');
    assert.deepStrictEqual(cut({ ...run('makeup', ''), sheetCuts: '510,1002' }), [0, 0], 'no back pass, no cuts');
    // MPI-1086 r21-r23: Hairstyle from a picture runs on Qwen (image 1 = the sheet, image 2 = the mannequin the graph
    // makes of the picture), with the describer's words (`refHair`) and every figure named.
    const HAIR = ', with the head uncovered and no hat. The front view, the character seen from behind and the close-up '
        + "portrait on the right all show the same hairstyle and hair colour. Keep the character's own face and clothes." + KEEP;
    assert.strictEqual(buildChangePrompt('hair', '', true, 'pink hair styled in two high buns with bangs.'),
        'Give the character in image 1 the hairstyle and hair colour from image 2: pink hair styled in two high buns '
        + 'with bangs' + HAIR);
    assert.strictEqual(buildChangePrompt('hair', '', true), 'Give the character in image 1 the hairstyle and hair colour '
        + 'from image 2' + HAIR, 'no description: the picture alone');
    assert.match(characterSheetEditor('change', { ...run('hair', ''), refHair: 'black, a high bun' }).positive, /image 2: black, a high bun, with/);
    // qh15 round 9 W2: the user's words LEAD, or the description's colour outvotes them on the bodies.
    assert.strictEqual(buildChangePrompt('hair', 'in blue', true, 'pink hair styled in two high buns with bangs'),
        'Give the character in image 1 the hairstyle from image 2, changed like this: in blue. The hairstyle in '
        + 'image 2: pink hair styled in two high buns with bangs. Make it in blue on every figure, with the head '
        + 'uncovered and no hat. The front view, the character seen from behind and the close-up portrait on the right all '
        + "show the same changed hairstyle. Keep the character's own face and clothes." + KEEP);
    assert.strictEqual(buildChangePrompt('condition', '', true), null, 'Condition never takes a reference');
    // Wanted only by the change leg of a change that takes one: an age leg that starts the run is handed it too.
    assert.strictEqual(characterSheetEditor('change', run('clothes', '')).injectionParams.Input_Reference, true);
    assert.strictEqual(characterSheetEditor('change', run('condition', 'muddy')).injectionParams.Input_Reference, false);
    assert.strictEqual(characterSheetEditor('change', run('hair', 'a bob')).injectionParams.Input_Reference, true);
    assert.strictEqual(characterSheetEditor('age', run('none', '', 60)).injectionParams.Input_Reference, false);
    assert.strictEqual(characterSheetEditor('change', { change: 'clothes', words: 'a suit' }).injectionParams.Input_Reference, false);
    // Words OR a reference; never a reference under 18 (the gate reads words only).
    assert.strictEqual(refuse(run('clothes', '')), null);
    assert.strictEqual(refuse({ change: 'clothes', words: '' }), 'Say what to change, or add a Reference picture.');
    assert.strictEqual(refuse({ change: 'condition', words: '', mediaItems: [REF] }), 'Say what to change first.');
    assert.strictEqual(refuse({ change: 'hair', words: '', mediaItems: [REF] }), null, 'a hairstyle picture needs no words');
    assert.match(refuse(run('clothes', '', 10)), /cannot be used with an age under 18/);
    assert.match(refuse(run('clothes', 'a suit', 17)), /under 18/);
    assert.match(refuse(run('hair', 'a bob', 17)), /under 18/);
    assert.strictEqual(refuse(run('clothes', '', 18)), null);
    assert.strictEqual(refuse(run('condition', 'muddy', 10)), null, 'a change that ignores the reference is not refused for it');
    assert.strictEqual(name(run('clothes', ''), 'Ava'), 'Ava - outfit from a reference');
    assert.strictEqual(name(run('hair', ''), 'Ava'), 'Ava - hairstyle from a reference');
    assert.strictEqual(name(run('hair', 'a pixie cut', 30), 'Ava'), 'Ava - a pixie cut, age 30');
});

// ── 2. The child-safety gate ─────────────────────────────────────────────────

/** The configs a whole run would queue: one per leg, as flowService builds them (MPI-1156: the typed words + the age). */
async function runConfigs(values) {
    const { characterSheetEditor } = await builder();
    const { getFlowById, flowGateInputs } = await esm('js/data/flowsRegistry.js');
    const typed = flowGateInputs(getFlowById('character-sheet-editor'), values);
    const age = values.Input_Age ?? -1;
    const parts = [values.change !== 'none' && 'change', age >= 0 && 'age', age >= 0 && age <= 12 && 'rebuild'].filter(Boolean);
    return parts.map((part) => {
        const built = characterSheetEditor(part, values);
        return { positive: built.positive, injectionParams: { ...values, ...built.injectionParams }, ...typed };
    });
}

const verdicts = async (values, modelId) => {
    const { checkChildSafety, gateWords, configContext } = await gate();
    return (await runConfigs(values)).map(c => checkChildSafety(gateWords(c), { ...configContext(c), modelId }));
};

const CAPTION = 'Wearing a mustard-yellow double-breasted suit with matching trousers, brown leather shoes, and a red ribbed knit beanie.';

test('child, teen and adult runs of every change clear the gate on both models', async () => {
    for (const modelId of ['klein-9b', 'qwen-image-2-1']) {
        for (const age of [0, 1, 2, 5, 10, 12, 13, 15, 17, 18, 30, 60, 90]) {
            for (const [change, words] of [['clothes', 'a navy wool coat, jeans and boots'], ['accessories', 'round glasses'],
                ['hair', 'a short bob'], ['condition', 'muddy and soaked'], ['body', 'heavyset'], ['none', '']]) {
                const v = await verdicts({ change, words, Input_Age: age, sheetAge: '40', sheetClothes: CAPTION }, modelId);
                for (const r of v) assert.strictEqual(r.verdict, 'ok', `${modelId} ${change} age ${age}: ${r.reason}`);
            }
        }
    }
});

test('a child age with unclothed or swimwear words is refused on the FIRST leg', async () => {
    for (const modelId of ['klein-9b', 'qwen-image-2-1']) {
        for (const words of ['a red swimsuit', 'a bikini', 'a sports bra and shorts', 'no clothing', 'underwear']) {
            const [first] = await verdicts({ change: 'clothes', words, Input_Age: 10, sheetAge: '40', sheetClothes: CAPTION }, modelId);
            assert.strictEqual(first.verdict, 'refuse', `${modelId} "${words}" at 10`);
        }
        // It is the slider's age that refuses leg 1: its built words name no age, and are not read.
        const { checkChildSafety, gateWords } = await gate();
        const [leg1] = await runConfigs({ change: 'clothes', words: 'a bikini', Input_Age: 10, sheetAge: '40' });
        assert.ok(!/10/.test(leg1.positive), 'leg 1 prompt names no age');
        assert.strictEqual(checkChildSafety(gateWords(leg1), { modelId }).verdict, 'ok', 'without the age it would pass');
    }
});

test('the describer\'s words are never read: a sheet\'s caption or a makeup picture\'s "nude" (MPI-1156)', async () => {
    // A child rebuilt from a sheet in swimwear is the dressed checks' (SHEET_CLOTHES_CHECKS), which
    // refuse in the describe step, before the gate: the caption is app prose, not the user's words.
    const v = await verdicts({ change: 'none', Input_Age: 8, sheetAge: '30', sheetClothes: 'Wearing a red swimsuit.' }, 'klein-9b');
    assert.ok(v.every(r => r.verdict === 'ok'), JSON.stringify(v));
    const m = await verdicts({ change: 'makeup', words: '', Input_Age: 10, sheetAge: '30', refMakeup: 'Nude lipstick, bare skin.', mediaItems: [{ role: 'image2', url: 'x' }] }, 'klein-9b');
    assert.ok(m.every(r => r.verdict === 'ok'), JSON.stringify(m));
    assert.ok((await verdicts({ change: 'makeup', words: 'nude', Input_Age: 10, sheetAge: '30' }, 'klein-9b')).every(r => r.verdict === 'refuse'));
});

test('16-17: the gate rule in force - ordinary swimwear passes, revealing swimwear does not', async () => {
    // docs/child-safety.md (Fabio 2026-10-10): 16 or 17, ordinary swimwear anywhere, a sheet included.
    const ok = await verdicts({ change: 'clothes', words: 'a blue one-piece swimsuit', Input_Age: 17, sheetAge: '25' }, 'klein-9b');
    assert.ok(ok.every(r => r.verdict === 'ok'), JSON.stringify(ok));
    const no = await verdicts({ change: 'clothes', words: 'a micro bikini', Input_Age: 17, sheetAge: '25' }, 'klein-9b');
    assert.strictEqual(no[0].verdict, 'refuse');
});

test('every leg carries the typed words and the slider age; Keep is no age', async () => {
    const configs = await runConfigs({ change: 'hair', words: 'a bob', Input_Age: 10, sheetAge: '40' });
    assert.strictEqual(configs.length, 3);
    for (const c of configs) assert.deepStrictEqual([c.userWords, c.minorAge], [['a bob'], 10]);
    const [keep] = await runConfigs({ change: 'hair', words: 'a bob', Input_Age: -1, sheetAge: '40' });
    assert.ok(!('minorAge' in keep));
});

// ── 3. The FlowDef ───────────────────────────────────────────────────────────

const registry = () => esm('js/data/flowsRegistry.js');
const stage = async (installed) => {
    const { state } = await esm('js/state.js');
    state.s_installedModelIds = installed;
};
const run = (change, age, headless = true) => ({ change, words: 'x', injectionParams: { Input_Age: age, Input_Remove_Head: headless } });

test('each change routes to its editor and the age picks the legs', async () => {
    const { getFlowById, flowOperation, flowRunLegs, flowToggleLeg } = await registry();
    const flow = getFlowById('character-sheet-editor');
    assert.ok(flow, 'the Flow is registered');
    for (const c of ['clothes', 'condition']) assert.strictEqual(flowOperation(flow, run(c, -1)), 'flowCharacterSheetEdit');
    // MPI-1086 r28/r30: a Hairstyle and Accessories run on Qwen with a picture or without.
    for (const c of ['body', 'hair', 'accessories', 'makeup', 'tattoos']) assert.strictEqual(flowOperation(flow, run(c, -1)), 'flowCharacterSheetEditQwen');
    assert.strictEqual(flowOperation(flow, run('none', 30)), null);
    // MPI-1086: a Hairstyle WITH a Reference picture goes to Qwen (the graph makes the mannequin); in words, Klein.
    const withRef = { ...run('hair', -1), mediaItems: [{ role: 'image2', url: 'ref.png' }] };
    assert.strictEqual(flowOperation(flow, withRef), 'flowCharacterSheetEditQwen');
    assert.deepStrictEqual(flowRunLegs(flow, withRef).map(l => l.operation), ['flowCharacterSheetEditQwen']);
    assert.strictEqual(flowOperation(flow, { ...run('clothes', -1), mediaItems: withRef.mediaItems }), 'flowCharacterSheetEdit');
    const ops = r => flowRunLegs(flow, r).map(l => l.operation);
    // MPI-1086: with no Age the edit graph removes the head itself (a version, shown or not by the toggle);
    // the chained head leg runs only after age legs, so it is still the run's last step.
    assert.deepStrictEqual(ops(run('clothes', -1)), ['flowCharacterSheetEdit']);
    assert.deepStrictEqual(ops(run('clothes', -1, false)), ['flowCharacterSheetEdit']);
    assert.deepStrictEqual(ops(run('body', 30)), ['flowCharacterSheetEditQwen', 'flowCharacterSheetEdit', 'flowCharacterSheetHeadless']);
    assert.deepStrictEqual(ops(run('none', 10)), ['flowCharacterSheetEdit', 'flowCharacterSheetImages', 'flowCharacterSheetHeadless']);
    assert.deepStrictEqual(ops(run('none', 1)), ['flowCharacterSheetEdit', 'flowCharacterSheetImages', 'flowCharacterSheetHeadless']);
    // A newborn is swaddled and lying down: its head stays, whatever the toggle says.
    assert.deepStrictEqual(ops(run('none', 0)), ['flowCharacterSheetEdit', 'flowCharacterSheetImages']);
    assert.strictEqual(flowToggleLeg(flow), 2, 'the head leg keeps its result-pane toggle');
    assert.deepStrictEqual(ops(run('clothes', undefined)), ['flowCharacterSheetEdit'], 'no age = keep');
    assert.deepStrictEqual(ops(run('none', 13)), ['flowCharacterSheetEdit', 'flowCharacterSheetHeadless']);
    // Leg 1 (the change) defaults to Clothes when the run names none.
    assert.strictEqual(flowOperation(flow, { injectionParams: {} }), 'flowCharacterSheetEdit');
});

test('MPI-1159: Clothes words that take the clothes off run on Qwen, with their own prompt; a child age refuses them', async () => {
    const { getFlowById, flowOperation } = await registry();
    const { buildChangePrompt } = await builder();
    const flow = getFlowById('character-sheet-editor');
    const FABIO = 'Remove all the clothes, leaving you nude and barefoot. ';
    const clothes = (words, media) => ({ change: 'clothes', words, injectionParams: { Input_Age: -1 }, ...(media ? { mediaItems: media } : {}) });
    for (const w of [FABIO, 'naked', 'take off her dress', 'topless, keep the jeans', 'nua e descalça']) {
        assert.strictEqual(flowOperation(flow, clothes(w)), 'flowCharacterSheetEditQwen', w);
    }
    // Dressing stays on Klein (MPI-1041): underwear is clothes ON, a negation is not a request, a picture is Klein's.
    for (const w of ['red lace lingerie', 'a bikini', 'a blue dress, no nudity']) {
        assert.strictEqual(flowOperation(flow, clothes(w)), 'flowCharacterSheetEdit', w);
    }
    assert.strictEqual(flowOperation(flow, clothes(FABIO, [{ role: 'image2', url: 'ref.png' }])), 'flowCharacterSheetEdit');
    // The ud1 bench string, verbatim (q_verb: every figure undressed, own face and hair, 2/2).
    assert.strictEqual(buildChangePrompt('clothes', FABIO),
        "Change the character's clothes in image 1: Remove all the clothes, leaving you nude and barefoot. The front view, "
        + 'the character seen from behind and the close-up portrait on the right all show the same change. Keep the '
        + "character's own face and hair. Keep everything else exactly as it is.");
    for (const modelId of ['klein-9b', 'qwen-image-2-1']) {
        for (const age of [0, 10, 16, 17]) {
            const [first] = await verdicts({ change: 'clothes', words: FABIO, Input_Age: age, sheetAge: '40', sheetClothes: CAPTION }, modelId);
            assert.strictEqual(first.verdict, 'refuse', `${modelId} undress at ${age}`);
        }
    }
});

test('each leg runs its own model, and Qwen-Image 2.1 is asked for only when the run needs it', async () => {
    const { getFlowById, flowModelIds, flowRunAvailability, flowAvailability } = await registry();
    const flow = getFlowById('character-sheet-editor');
    await stage(['klein-9b']);
    assert.deepStrictEqual(flowModelIds(flow, { op: 'flowCharacterSheetEdit' }), ['klein-9b', null]);
    assert.deepStrictEqual(flowModelIds(flow, { op: 'flowCharacterSheetImages' }), [null, 'qwen-image-2-1']);
    assert.deepStrictEqual(flowModelIds(flow, { op: 'flowCharacterSheetEditQwen' }), [null, 'qwen-image-2-1']);
    assert.strictEqual(flowAvailability(flow).available, true, 'Klein alone makes the Flow available');
    assert.strictEqual(flowRunAvailability(flow, run('clothes', 30)).available, true);
    assert.deepStrictEqual(flowRunAvailability(flow, run('body', -1)).missing, ['qwen-image-2-1']);
    assert.deepStrictEqual(flowRunAvailability(flow, run('none', 10)).missing, ['qwen-image-2-1']);
    await stage(['klein-9b', 'qwen-image-2-1']);
    assert.strictEqual(flowRunAvailability(flow, run('body', 10)).available, true);
    await stage([]);
    assert.strictEqual(flowAvailability(flow).available, false);
});

test('each leg takes the rack of the model it runs, into nodes its graph carries', async () => {
    const { getFlowById, flowModelIds, flowLoraPhases } = await registry();
    const flow = getFlowById('character-sheet-editor');
    await stage(['klein-9b', 'qwen-image-2-1']);
    // flowService's filter: only the phases whose slot THIS op runs.
    const phasesFor = op => flowLoraPhases(flow).filter(({ phase }) => flowModelIds(flow, { op })[phase - 1]);
    const titles = file => JSON.stringify(require(path.join(ROOT, 'comfy_workflows', file)));
    assert.deepStrictEqual(phasesFor('flowCharacterSheetEdit'), [{ phase: 1, modelId: 'klein-9b' }]);
    assert.deepStrictEqual(phasesFor('flowCharacterSheetEditQwen'), [{ phase: 2, modelId: 'qwen-image-2-1' }]);
    assert.match(titles('flow_character_sheet_edit.json'), /Input_Lora_Phase1_6/);
    assert.match(titles('flow_character_sheet_edit_qwen.json'), /Input_Lora_Phase2_6/);
    // The rebuild leg's graph is titled phase 1 for its own Flow: no Klein rack can land in it.
    assert.deepStrictEqual(phasesFor('flowCharacterSheetImages'), [{ phase: 2, modelId: 'qwen-image-2-1' }]);
    assert.doesNotMatch(titles('flow_character_sheet_from_images.json'), /Input_Lora_Phase2_/);
    await stage([]);
});

test('the Qwen graph makes a mannequin of the Reference picture, only when one is given and wanted (MPI-1086 r23)', () => {
    const g = require(path.join(ROOT, 'comfy_workflows', 'flow_character_sheet_edit_qwen.json'));
    const by = t => Object.entries(g).find(([, n]) => n._meta?.title === t);
    const [photo] = by('Input_Image_2');
    const [want] = by('Input_Reference');
    assert.strictEqual(g[photo].inputs.block_if_empty, false, 'Body shape runs with no picture');
    // Its prompt is an input (MPI-1086 r42: Makeup asks for its own mannequin); the default is the hairstyle one.
    const [mp] = by('Input_Mannequin_Prompt');
    assert.match(g[mp].inputs.string, /^Replace the person with a plain white mannequin seen in a three-quarter view/);
    assert.ok(Object.values(g).some(n => n.class_type === 'CLIPTextEncode' && n.inputs.text?.[0] === mp),
        'the Klein mannequin encodes Input_Mannequin_Prompt');
    // KSampler's three inputs each come through a switch on "picture given AND Input_Reference".
    const [, ks] = Object.entries(g).find(([, n]) => n.class_type === 'KSampler');
    for (const name of ['positive', 'negative', 'latent_image']) {
        const pick = g[ks.inputs[name][0]];
        assert.strictEqual(pick.class_type, 'MpiIfElse', `${name} is switched`);
        const both = g[pick.inputs.boolean[0]];
        assert.deepStrictEqual([both.inputs.mode, both.inputs.a, both.inputs.b], ['both_true', [photo, 4], [want, 0]]);
        assert.ok(g[pick.inputs.true[0]].inputs['images.image_2'], `${name}: the true side reads the mannequin`);
        assert.ok(!g[pick.inputs.false[0]].inputs['images.image_2'], `${name}: the false side is the old one-picture edit`);
    }
});

test('the Qwen graph\'s back pass is lazy and every reader of the edit gets the merged picture (MPI-1086 r37)', () => {
    const g = require(path.join(ROOT, 'comfy_workflows', 'flow_character_sheet_edit_qwen.json'));
    const id = t => Object.keys(g).find(k => g[k]._meta?.title === t);
    const mid = Object.keys(g).find(k => g[k].class_type === 'MpiIfElse' && g[k].inputs.boolean?.[0] === id('Input_Back_Pass'));
    assert.ok(mid, 'a lazy if/else on Input_Back_Pass picks the picture');
    const merged = g[mid];
    // r44: on = the sheet STITCHED front | new back | the rest, cut at Input_Cut_1 / Input_Cut_2 (0 = 25% / 50%):
    // a stamp over a fixed 25-50% left the old back figure's arm where the sheet's back panel ran past 50%.
    const st = g[merged.inputs.true[0]];
    assert.strictEqual(st.class_type, 'ImageStitch', 'on: the stitched sheet');
    assert.strictEqual(g[st.inputs.image1[0]].class_type, 'ImageStitch', 'front | new back, then the rest');
    assert.ok(!Object.values(g).some(n => n.class_type === 'ImageCompositeMasked' && /back panel/.test(n._meta?.title)), 'no stamp');
    for (const [input, half] of [['Input_Cut_1', 'a // 4'], ['Input_Cut_2', 'a // 2']]) {
        assert.strictEqual(g[id(input)].inputs.int, 0, `${input} ships 0`);
        const math = Object.values(g).find(n => n.class_type === 'MpiMath' && n.inputs.b?.[0] === id(input));
        assert.strictEqual(math.inputs.math_expression, `${half} * (b <= 0) + b * (b > 0)`, `${input}: 0 = the old cut`);
    }
    assert.strictEqual(g[merged.inputs.false[0]]._meta.title, 'the edit: the faces pasted back when Input_Face_Crop',
        'off: the edit as before (r47: the sheet-sized edit, or the faces pasted back)');
    assert.strictEqual(g[id('Output_Image_2')].inputs.images[0], mid, 'the edit capture reads the merged picture');
    const enc = Object.values(g).find(n => n.class_type === 'TextEncodeQwenImage21' && n.inputs.prompt?.[0] === id('Input_Positive_2'));
    // ac2: picture 2 = the INPUT sheet's back figure, cropped at the same cuts, so the outfit's back stays.
    const crop = g[g[enc.inputs['images.image_2'][0]].inputs.image[0]];
    assert.deepStrictEqual([crop.class_type, crop.inputs.image], ['MpiBoxCrop', [id('Input_Image'), 0]], 'the original sheet');
    const box = g[crop.inputs.mpi_box[0]];
    assert.strictEqual(g[box.inputs.x[0]]._meta.title.startsWith('cut 1'), true, 'from cut 1');
    assert.deepStrictEqual(g[box.inputs.width[0]].inputs.b, [Object.keys(g).find(k => g[k]._meta?.title.startsWith('cut 2')), 0],
        'to cut 2');
});

test('the Qwen graph edits the two faces only when Input_Face_Crop, lazily (MPI-1086 r47)', () => {
    const g = require(path.join(ROOT, 'comfy_workflows', 'flow_character_sheet_edit_qwen.json'));
    const id = t => Object.keys(g).find(k => g[k]._meta?.title === t);
    const on = id('Input_Face_Crop');
    assert.strictEqual(g[on].inputs.boolean, false, 'ships off: every other change edits the whole sheet');
    const pic1 = g[id('picture 1: the face canvas when Input_Face_Crop, else the sheet')];
    assert.deepStrictEqual([pic1.class_type, pic1.inputs.boolean, pic1.inputs.false], ['MpiIfElse', [on, 0], [id('Input_Image'), 0]]);
    assert.strictEqual(g[pic1.inputs.true[0]].class_type, 'ImageStitch', 'on: the front face | the close-up face');
    const encs = Object.values(g).filter(n => n.class_type === 'TextEncodeQwenImage21' && n.inputs.prompt?.[0] === id('Input_Positive'));
    assert.strictEqual(encs.length, 2, 'the edit, with and without the mannequin');
    const front1 = g[encs[0].inputs['images.image_1'][0]];
    assert.deepStrictEqual(front1.inputs.false, [id(pic1._meta.title), 0], 'with Input_Front_Crop off, picture 1 as before');
    for (const e of encs) assert.deepStrictEqual(e.inputs['images.image_1'], encs[0].inputs['images.image_1'], 'both encode picture 1');
    const edit = g[id('the edit: the faces pasted back when Input_Face_Crop')];
    const rebuilt = g[edit.inputs.false[0]];
    assert.deepStrictEqual([edit.class_type, edit.inputs.boolean, g[rebuilt.inputs.false[0]]._meta.title],
        ['MpiIfElse', [on, 0], "back to the sheet's own size"], 'off (both crops): the sheet-sized edit, as before');
    const close = g[edit.inputs.true[0]];
    assert.strictEqual(close.class_type, 'ImageCompositeMasked', 'on: the close-up face pasted ...');
    const front = g[close.inputs.destination[0]];
    assert.deepStrictEqual([front.class_type, front.inputs.destination], ['ImageCompositeMasked', [id('Input_Image'), 0]],
        '... over the front face pasted onto the untouched sheet');
    for (const p of [front, close]) assert.strictEqual(g[p.inputs.mask[0]].class_type, 'ImageToMask', 'through the feathered face mask');
    const readers = Object.values(g).filter(n => Object.values(n.inputs).some(v => Array.isArray(v) && v[0] === id("back to the sheet's own size")));
    assert.deepStrictEqual(readers, [rebuilt], 'nothing else reads the sheet-sized edit');
});

test('the Qwen graph shows Accessories pass 1 the front body | close-up only when Input_Front_Crop (MPI-1086 ff1)', () => {
    const g = require(path.join(ROOT, 'comfy_workflows', 'flow_character_sheet_edit_qwen.json'));
    const id = t => Object.keys(g).find(k => g[k]._meta?.title === t);
    const on = id('Input_Front_Crop');
    assert.strictEqual(g[on].inputs.boolean, false, 'ships off: every other change edits the whole sheet');
    const pic = g[id('picture 1: the front canvas when Input_Front_Crop, else as before')];
    assert.deepStrictEqual([pic.class_type, pic.inputs.boolean], ['MpiIfElse', [on, 0]]);
    const canvas = g[pic.inputs.true[0]];
    assert.deepStrictEqual([canvas.class_type, g[canvas.inputs.image1[0]]._meta.title, g[canvas.inputs.image2[0]]._meta.title],
        ['ImageStitch', 'front panel crop', 'close-up panel crop'], 'no back figure in the picture');
    const ed = g[id('the edit: the sheet rebuilt when Input_Front_Crop, else the edit')];
    assert.deepStrictEqual([ed.inputs.boolean, g[ed.inputs.false[0]]._meta.title], [[on, 0], "back to the sheet's own size"]);
    const sheet = g[ed.inputs.true[0]], left = g[sheet.inputs.image1[0]];
    assert.deepStrictEqual([left.class_type, g[left.inputs.image1[0]]._meta.title, g[sheet.inputs.image2[0]]._meta.title],
        ['ImageStitch', 'front canvas: the edited body', 'front canvas: the edited close-up']);
    const back = g[left.inputs.image2[0]];
    assert.deepStrictEqual([back._meta.title, back.inputs.image], ['front canvas: the ORIGINAL back panel', [id('Input_Image'), 0]],
        "pass 1 never draws on the back panel: the sheet's own, for the back pass to replace");
    assert.deepStrictEqual(g[id('the edit: the faces pasted back when Input_Face_Crop')].inputs.false, [id(ed._meta.title), 0]);
});

test('the Qwen graph crops the Reference picture to its head when Input_Ref_Head_Crop, lazily (MPI-1086 fa1)', () => {
    const g = require(path.join(ROOT, 'comfy_workflows', 'flow_character_sheet_edit_qwen.json'));
    const id = t => Object.keys(g).find(k => g[k]._meta?.title === t);
    const on = id('Input_Ref_Head_Crop');
    assert.strictEqual(g[on].inputs.boolean, false, 'ships off: Makeup, Hairstyle and Beard pictures stay whole');
    const pick = id('the reference: its head when Input_Ref_Head_Crop, else the picture');
    assert.deepStrictEqual([g[pick].class_type, g[pick].inputs.boolean, g[pick].inputs.false], ['MpiIfElse', [on, 0], [id('Input_Image_2'), 0]]);
    assert.strictEqual(g[g[pick].inputs.true[0]].class_type, 'MpiBoxCrop', 'on: the head crop');
    assert.deepStrictEqual(g[id('the photo to 1 MP')].inputs.image, [pick, 0], 'the mannequin is made of the head');
    assert.deepStrictEqual(g[id('picture 2: the reference itself when it is a mannequin')].inputs.true, [pick, 0]);
    const w = g[id('reference head: width (no face = the whole picture)')];
    assert.deepStrictEqual([w.inputs.math_expression, w.inputs.b], ['a if a > 0 else b', [id('Input_Image_2'), 2]], 'no face: the whole picture');
});

test('every op the Flow dispatches takes the sheet on image1', async () => {
    const { getFlowById, flowOperations } = await registry();
    const { getCommand } = await esm('js/data/commandRegistry.js');
    const flow = getFlowById('character-sheet-editor');
    for (const op of flowOperations(flow)) {
        const keys = (getCommand(op)?.mediaInputs || []).map(m => m.key);
        assert.ok(keys.includes('image1'), `${op} takes image1`);
    }
});

// ── 4. The picture checks and the card name (Phase C) ──────────────────────────

const SHEET = { role: 'image1', mediaType: 'image', url: '/project-file?path=C%3A%2Fp%2FMedia%2Fsheet.png' };
const editor = async () => (await registry()).getFlowById('character-sheet-editor');
const values = async (change, words, age) => (await registry()).flowRunValues(await editor(),
    { change, words, injectionParams: { Input_Age: age } });
/** What a run asks, in order: a check by its passing answer, a target by its id. */
const asked = async (change, words, age) => (await esm('js/services/flowEnhance.js'))
    .describeAsks(await editor(), await values(change, words, age), [SHEET]).map(d => d.to || d.refuseUnless);
const CODE = 'CHILD_SAFETY';
const DRESS_FIRST = /^Dress the sheet first: pick Clothes/;

const C4 = ['CLOTHES', 'CLOTHES', 'CLOTHES', 'CLOTHES'];

test('the picture checks run only when they can matter, and before any other question', async () => {
    // Under 18 the sheet must show ordinary clothes; never when the change itself dresses it.
    assert.deepStrictEqual(await asked('condition', 'muddy', 10), [...C4, 'sheetAge', 'sheetClothes']);
    assert.deepStrictEqual(await asked('none', '', 0), [...C4, 'sheetAge'], 'a newborn is a child age; swaddled, it needs no caption');
    assert.deepStrictEqual(await asked('hair', 'a bob', 15), [...C4, 'sheetAge']);
    assert.deepStrictEqual(await asked('hair', 'a bob', 16), [...C4, 'sheetAge']);
    assert.deepStrictEqual(await asked('none', '', 17), [...C4, 'sheetAge']);
    assert.deepStrictEqual(await asked('clothes', 'a navy coat', 10), ['sheetAge'], 'Clothes dresses it; its words are the caption');
    assert.deepStrictEqual(await asked('hair', 'a bob', 18), ['sheetAge']);
    assert.deepStrictEqual(await asked('clothes', 'a red jacket', -1), [], 'an ordinary change asks nothing');
    // How old the sheet LOOKS is the child-safety gate's call, never this Flow's (Fabio, 2026-10-10).
    assert.deepStrictEqual(await asked('clothes', 'a red bikini', -1), []);
    // MPI-1086: a Hairstyle picture is put into words; no picture, or another change, asks nothing more.
    const REF2 = { role: 'image2', mediaType: 'image', url: '/project-file?path=C%3A%2Fp%2FMedia%2Fbuns.png' };
    const fe = await esm('js/services/flowEnhance.js');
    const withRef = async (change) => fe.describeAsks(await editor(), await values(change, '', -1), [SHEET, REF2]).map(d => d.to);
    assert.deepStrictEqual(await withRef('hair'), ['refHair', 'refIsMannequin']);
    assert.deepStrictEqual(await withRef('makeup'), ['refMakeup', 'refIsMannequin'], 'MPI-1086 r42: makeup is put into words too');
    assert.deepStrictEqual(await withRef('beard'), ['refBeard', 'refIsMannequin'], 'MPI-1086 bp1: a beard picture too');
    assert.deepStrictEqual(await withRef('accessories'), ['sheetCuts'], 'ac2: the back pass needs the cuts');
    assert.deepStrictEqual(await withRef('tattoos'), ['sheetCuts'], 'MPI-1086 r44: a MEASURE of the sheet, not a question');
    assert.deepStrictEqual(await asked('hair', '', -1), []);
});

test('the checks ask the upper and lower body of the front and the back view, never the whole sheet', async () => {
    // Asked of the whole sheet, the default describer cleared a bikini, lingerie and a nude sheet
    // (Phase E round 1); per view and per half it read 9 of 10 test sheets (round 3).
    const checks = (await editor()).describe.filter(d => !d.to);
    assert.deepStrictEqual(checks.map(d => [d.region.x, d.region.width, /upper/.test(d.ask) ? 'upper' : 'lower']), [
        [0, 0.25, 'upper'], [0.25, 0.25, 'upper'], [0, 0.25, 'lower'], [0.25, 0.25, 'lower'],
    ]);
    for (const d of checks) assert.ok(d.region.y === 0 && d.region.height === 1 && d.code === CODE && d.refuseUnless === 'CLOTHES');
});

test('describeFlowRun: any view or half not in ordinary clothes refuses before anything else is asked', async () => {
    const fe = await esm('js/services/flowEnhance.js');
    const flow = await editor();
    const realWarn = console.warn;
    console.warn = () => {};
    try {
        // `bad` = the one check (by index) that sees something other than clothes, answering `answer`.
        const go = async (age, bad, answer) => {
            const asked = [];
            const boxCrop = async (url, box) => `${url}#${box.x}`;
            const describe = async ({ question, imagePath }) => {
                const i = asked.length;
                asked.push([imagePath, question]);
                if (/What covers/.test(question)) return { ok: true, via: 'endpoint', text: i === bad ? answer : 'CLOTHES' };
                return { ok: true, via: 'endpoint', text: /How old/.test(question) ? '40' : 'Wearing a coat.' };
            };
            const res = await fe.describeFlowRun(flow, { injectionParams: await values('condition', 'muddy', age), mediaItems: [SHEET] },
                { folderPath: 'C:/p' }, { describe, boxCrop });
            return { res, asked };
        };
        for (const [age, bad, answer] of [[10, 0, 'SWIMWEAR'], [10, 3, 'UNDERWEAR'], [12, 1, 'NOTHING'], [17, 2, 'SWIMWEAR'],
            [16, 3, 'I cannot tell.'], [15, 0, 'Clothes and a bikini']]) {
            const { res, asked } = await go(age, bad, answer);
            assert.deepStrictEqual([res.ok, res.code], [false, CODE], `${age} ${bad} ${answer}`);
            assert.match(res.message, DRESS_FIRST);
            assert.strictEqual(asked.length, bad + 1, 'nothing else is asked once a check refuses');
        }
        const ok = await go(10, -1, '');
        assert.deepStrictEqual(ok.res, { ok: true, injectionParams: { sheetAge: '40', sheetClothes: 'Wearing a coat.' } });
        // Each check reads its own view, a crop of the sheet, never the sheet itself.
        assert.deepStrictEqual(ok.asked.slice(0, 4).map(([path]) => path.split('#')[1]), ['0', '0.25', '0', '0.25']);
        assert.ok(ok.asked.slice(4).every(([path]) => path === SHEET.url), 'the age and the caption read the whole sheet');
    } finally {
        console.warn = realWarn;
    }
});

test('the hand, agent and routine runs refuse with the same code and message', async () => {
    const flow = await editor();
    const { state } = await esm('js/state.js');
    const { Events } = await esm('js/events.js');
    const svc = await esm('js/services/llmService.js');
    const { submitFlowGeneration } = await esm('js/services/flowService.js');
    const project = { id: 'p1', name: 'P', folderPath: 'C:/p', itemGroups: [] };
    state.s_installedModelIds = ['klein-9b', 'qwen-image-2-1'];
    state.currentProject = project;

    const realFetch = global.fetch;
    const realWarn = console.warn;
    const reports = new Map();
    global.fetch = async (url, init) => {
        const body = init?.body ? JSON.parse(init.body) : {};
        if (url === '/llm/describe') {
            return { ok: true, json: async () => ({ ok: true, model: 'vl', text: /What covers/.test(body.question) ? 'UNDERWEAR' : '40' }) };
        }
        if (/place-preview-asset/.test(url)) return { ok: true, json: async () => ({ success: true, filePath: 'C:/p/view.png' }) };
        const job = /^\/connector\/jobs\/([^/]+)\/result$/.exec(url);
        if (job) reports.get(job[1])?.(body);
        return { ok: true, json: async () => ({ ok: true }) };
    };
    svc.setDescribeBackendPreference('endpoint');
    // The checks crop each view in the renderer (flowEnhance stageBoxCrop): a picture and a canvas.
    global.Image = class { set src(_) { this.naturalWidth = 1792; this.naturalHeight = 1120; setTimeout(() => this.onload()); } };
    const drawn = [];
    global.document = { addEventListener() {}, removeEventListener() {},
        createElement: () => ({ getContext: () => ({ drawImage: (img, ...box) => drawn.push(box.slice(0, 4)) }), toDataURL: () => 'data:image/png;base64,AA' }) };
    console.warn = () => {};
    const warnings = [];
    const off = Events.on('ui:warning', ({ message }) => warnings.push(message));
    try {
        // Hand: the Flow pane submits the run itself.
        const hand = await new Promise((resolve) => {
            submitFlowGeneration(flow, {
                change: 'condition', words: 'muddy', mediaItems: [SHEET],
                injectionParams: { Input_Age: 10, Input_Remove_Head: true },
            }, { onError: err => resolve({ code: err.code, message: err.userMessage }), onComplete: () => resolve('ran') });
        });
        assert.strictEqual(hand.code, CODE);
        assert.match(hand.message, DRESS_FIRST);
        assert.deepStrictEqual(warnings, [hand.message], 'the hand run is told on a toast');
        assert.deepStrictEqual(drawn[0], [0, 0, 448, 1120], 'the first check reads the front view, a quarter of the sheet');

        // Routine: a Flow step on a card.
        const { routineDeps } = await esm('js/shell/routineDispatch.js');
        const step = { flowId: flow.id, fields: { change: 'condition', words: 'muddy', Input_Age: 10 } };
        const queued = await routineDeps.submit(step, { url: SHEET.url }, {}, project);
        assert.strictEqual(queued.ok, true, queued.message);
        const routine = await queued.done;
        assert.deepStrictEqual({ code: routine.code, message: routine.message }, hand);

        // Agent: a generation.submit job off the connector stream.
        let stream = null;
        global.EventSource = class { constructor() { stream = this; } addEventListener(t, fn) { this[t] = fn; } };
        global.document = global.document || { addEventListener() {}, removeEventListener() {} };
        global.window = global.window || { addEventListener() {}, removeEventListener() {} };
        const { initAgentDispatch } = await esm('js/shell/agentDispatch.js');
        initAgentDispatch();
        const agent = await new Promise((resolve) => {
            reports.set('j1', resolve);
            stream.job({ data: JSON.stringify({ jobId: 'j1', capability: 'generation.submit',
                input: { flowId: flow.id, fields: step.fields, media: [{ role: 'image1', url: SHEET.url }] } }) });
        });
        assert.strictEqual(agent.ok, false);
        assert.deepStrictEqual(agent.error, hand);

        // The agent's own refusal sees its Reference picture (it was asked without the media once).
        const ref = await new Promise((resolve) => {
            reports.set('j2', resolve);
            stream.job({ data: JSON.stringify({ jobId: 'j2', capability: 'generation.submit',
                input: { flowId: flow.id, fields: { change: 'clothes', words: '', Input_Age: 10 },
                    media: [{ role: 'image1', url: SHEET.url }, { role: 'image2', url: SHEET.url.replace('sheet', 'dress') }] } }) });
        });
        assert.strictEqual(ref.ok, false);
        assert.match(ref.error.message, /A Reference picture cannot be used with an age under 18/);
    } finally {
        off();
        svc.setDescribeBackendPreference(null);
        global.fetch = realFetch;
        console.warn = realWarn;
    }
});

test('the result card is named after the card it edits and the change', async () => {
    const { characterSheetEditorCardName: name } = await builder();
    assert.strictEqual(name({ change: 'condition', words: ' beaten up. ', Input_Age: -1 }, 'John'), 'John - beaten up');
    assert.strictEqual(name({ change: 'none', words: 'ignored', Input_Age: 30 }, 'John'), 'John - age 30');
    assert.strictEqual(name({ change: 'clothes', words: 'a red coat', Input_Age: 10 }, 'John'), 'John - a red coat, age 10');
    assert.strictEqual(name({ change: 'none', Input_Age: 0 }, 'John'), 'John - newborn');
    assert.strictEqual(name({ change: 'none', Input_Age: 1 }, 'John'), 'John - age 1');
    assert.strictEqual(name({ change: 'hair', words: 'a bob', Input_Age: -1 }, null), 'Character sheet - a bob', 'a file from outside the project');
    // Fabio 2026-10-16: an edit of an edit does not pile up every change, and long words are cut to four.
    assert.strictEqual(name({ change: 'clothes', words: 'Remove all the clothes, leaving you nude and barefoot. ', Input_Age: -1 },
        'flowCSFI_003 - high heels - Bob cut with fringe With black and pink gradient'), 'flowCSFI_003 - Remove all the clothes…');
    assert.strictEqual(name({ change: 'hair', words: 'Bob cut, with fringe', Input_Age: 30 }, 'John - high heels'), 'John - Bob cut, with fringe, age 30');

    const { sourceCardName } = await esm('js/services/flowService.js');
    const project = { itemGroups: [
        { name: 'i2i_004', customName: null, history: [{ filePath: 'C:\\p\\Media\\other.png' }] },
        { name: 'flow_002', customName: 'John', history: [{ filePath: 'C:\\p\\Media\\old.png' }, { filePath: 'C:\\p\\Media\\sheet.png' }] },
    ] };
    assert.strictEqual(sourceCardName(SHEET, project), 'John', 'any version of the card, by its file');
    assert.strictEqual(sourceCardName({ url: 'C:/p/Media/other.png' }, project), 'i2i_004', 'no custom name: the derived one');
    assert.strictEqual(sourceCardName({ url: 'D:/elsewhere/x.png' }, project), null);
    assert.strictEqual(sourceCardName({ url: 'D:/elsewhere/x.png', name: 'Picked' }, project), 'Picked');

    // Wired through: the first leg's queue opts carry it, and the gallery card takes it as its customName.
    const fs = require('node:fs');
    const flowSrc = fs.readFileSync(path.join(ROOT, 'js/services/flowService.js'), 'utf8');
    assert.match(flowSrc, /if \(builder\?\.cardName && !later\) \{\s*opts\.cardName = builder\.cardName\(/);
    const genSrc = fs.readFileSync(path.join(ROOT, 'js/services/generationService.js'), 'utf8');
    assert.match(genSrc, /\.\.\.\(opts\.cardName \? \{ customName: opts\.cardName \} : \{\}\)/);
});
