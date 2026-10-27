// MPI-475: the `@` reference picker's matcher. The popup around it is DOM, but which
// tags match a half-typed `@pic` is string work, and that is where the edge cases are —
// an email address must not open a picker, a space must close one, and "Picture 1" has
// to be reachable by typing "pic" even though the tag carries a space.
//
// Also pins the tag data itself: ref2v_ms is the only op with tags, and its ordinals
// are per TYPE, which is exactly what a chip's strip position is NOT.

const assert = require('node:assert');
const test = require('node:test');

let matchRefTagQuery, commands, filterMediaInputsForModel, refTagHandle;

test.before(async () => {
    ({ matchRefTagQuery, commands, filterMediaInputsForModel, refTagHandle } = await import('../js/data/commandRegistry.js'));
});

const TAGS = [{ tag: 'Picture 1' }, { tag: 'Picture 2' }, { tag: 'Video 1' }, { tag: 'Audio 1' }];
/** Query at the end of `value`, which is where a user typing actually is. */
const at = (value, tags = TAGS) => matchRefTagQuery(value, value.length, tags);

test('a bare @ offers every staged reference', () => {
    const q = at('a shot of @');
    assert.ok(q, 'expected the picker to open');
    assert.strictEqual(q.at, 10, 'must point at the @, so the insertion replaces it');
    assert.deepStrictEqual(q.matches.map(m => m.tag), ['Picture 1', 'Picture 2', 'Video 1', 'Audio 1']);
});

test('typing narrows, and the space inside a tag does not have to be typed', () => {
    assert.deepStrictEqual(at('@pic').matches.map(m => m.tag), ['Picture 1', 'Picture 2']);
    assert.deepStrictEqual(at('@picture2').matches.map(m => m.tag), ['Picture 2']);
    assert.deepStrictEqual(at('@AUD').matches.map(m => m.tag), ['Audio 1'], 'case-insensitive');
});

test('no match closes rather than offering everything', () => {
    assert.strictEqual(at('@zzz'), null);
});

test('an email address does not open a picker', () => {
    // The regex demands a boundary before the @, which is the whole guard.
    assert.strictEqual(at('write to fabio@picture'), null);
    assert.strictEqual(at('fabio@'), null);
});

test('a space after the @ closes it', () => {
    assert.strictEqual(at('@ '), null);
    assert.strictEqual(at('@pic ture'), null);
});

test('a boundary that is not whitespace still opens it', () => {
    // Typing a tag straight after an opening bracket or quote is normal prose.
    for (const prefix of ['(', '[', '"', "'"]) {
        assert.ok(at(`${prefix}@pic`), `expected "${prefix}@pic" to open the picker`);
    }
});

test('no staged references means no picker, whatever is typed', () => {
    assert.strictEqual(matchRefTagQuery('@pic', 4, []), null);
    assert.strictEqual(matchRefTagQuery('@pic', 4, undefined), null);
});

test('the caret is what counts, not the end of the value', () => {
    const value = 'a @pic and then some trailing words';
    assert.deepStrictEqual(
        matchRefTagQuery(value, 6, TAGS).matches.map(m => m.tag), ['Picture 1', 'Picture 2']);
    // Caret parked in the trailing words: nothing under it, so no picker.
    assert.strictEqual(matchRefTagQuery(value, value.length, TAGS), null);
});

test('the tagged ops are the reference ops and the multi-picture image ops', () => {
    const tagged = Object.entries(commands)
        .filter(([, cmd]) => (cmd.mediaInputs || []).some(s => s.tag))
        .map(([key]) => key)
        .sort();
    // ref2v (cloud, MPI-923) re-checked: badge and picker read `slot.tag` per active op.
    // MPI-1312: the image edit/control ops joined, their tags written as prose.
    assert.deepStrictEqual(tagged, ['control', 'edit', 'kleinEdit', 'krea2Edit', 'qwenEdit', 'ref2v', 'ref2v_ms'],
        'another tagged op needs the chip badge + picker re-checked, not just a slot list');

    // ref2v wears the names the CLOUD model reads (Wan 3.0: "Image n" / "Video n").
    const cloud = commands.ref2v.mediaInputs.map(s => s.tag);
    assert.deepStrictEqual([cloud[0], cloud[8], cloud[9], cloud[12]], ['Image 1', 'Image 9', 'Video 1', 'Audio 1']);
    assert.strictEqual(new Set(cloud).size, 15);

    const slots = commands.ref2v_ms.mediaInputs;
    const tags = slots.map(s => s.tag);
    // MPI-1060: 15 tagged slots (9 pictures + 3 videos + 3 audio) + 1 untagged start-frame
    // slot (LTX only, requiresCapability:'referenceSheet', no tag) = 16 total.
    assert.strictEqual(tags.length, 16, 'nine images, three videos, three audio, plus one untagged LTX start-frame slot');
    assert.deepStrictEqual(tags.slice(0, 3), ['Picture 1', 'Picture 2', 'Picture 3']);
    // The ninth slot is Picture 9 and the TENTH is Video 1 — if these ever became strip
    // positions the tenth chip would badge "10" and address nothing.
    assert.strictEqual(tags[8], 'Picture 9');
    assert.strictEqual(tags[9], 'Video 1');
    assert.strictEqual(tags[12], 'Audio 1');
    // The last slot (start frame) has no tag; it is LTX-only and not prompt-addressable.
    assert.strictEqual(tags[15], undefined, 'start-frame slot carries no tag');
    // Every non-undefined tag unique, or the picker offers two rows inserting the same handle.
    const definedTags = tags.filter(t => t !== undefined);
    assert.strictEqual(new Set(definedTags).size, definedTags.length);
});

// MPI-1060: slot narrowing for LTX vs H3 on ref2v_ms.
test('H3 ref2v_ms: slot list is byte-for-byte unchanged (9 picture, 3 video, 3 audio)', () => {
    const h3 = { id: 'minimax-h3-ref2va', capabilities: { audio: true, multiRefMedia: true } };
    const slots = filterMediaInputsForModel(commands.ref2v_ms.mediaInputs, h3);
    const tagged = slots.filter(s => s.tag);
    assert.strictEqual(tagged.length, 15, 'H3 sees 15 tagged slots (9 picture + 3 video + 3 audio)');
    assert.strictEqual(slots.filter(s => s.mediaType === 'video').length, 3, '3 video slots');
    assert.strictEqual(slots.filter(s => s.mediaType === 'audio').length, 3, '3 audio slots');
    assert.strictEqual(slots.some(s => s.key === 'inputStartFrame'), false, 'start-frame hidden from H3');
    const tagList = tagged.map(s => s.tag);
    assert.strictEqual(tagList[8], 'Picture 9');
    assert.strictEqual(tagList[9], 'Video 1');
    assert.strictEqual(tagList[12], 'Audio 1');
});

test('LTX ref2v_ms: only pictures, one audio and one start-frame slot', () => {
    const ltx = { id: 'ltx-23-balanced', capabilities: { audio: true, referenceSheet: true } };
    const slots = filterMediaInputsForModel(commands.ref2v_ms.mediaInputs, ltx);
    assert.strictEqual(slots.filter(s => s.mediaType === 'video').length, 0, 'no video slots for LTX');
    assert.strictEqual(slots.filter(s => s.mediaType === 'audio').length, 1, 'exactly one audio slot');
    assert.strictEqual(slots.filter(s => s.mediaType === 'audio')[0].tag, 'Audio 1');
    const startFrame = slots.find(s => s.key === 'inputStartFrame');
    assert.ok(startFrame, 'start-frame slot present for LTX');
    assert.strictEqual(startFrame.tag, undefined, 'start-frame carries no prompt tag');
    // Picture 1-9 unaffected
    assert.strictEqual(slots.filter(s => s.tag?.startsWith('Picture')).length, 9);
});

// MPI-1312: Qwen-Image 2.1, FLUX.3 and Klein took several pictures with no `@` picker at
// all, because their slots carried no tag. This is the guard for the NEXT model: any op a
// model offers with two or more reference slots must tag every one of them. Start and end
// frames are not references the prompt names, so they are left out.
test('every model op taking 2+ references tags every reference slot', async () => {
    const { MODELS } = await import('../js/data/modelConstants/models.js');
    const missing = [];
    for (const model of MODELS) {
        for (const op of model.supportedOps || []) {
            const refs = filterMediaInputsForModel(commands[op]?.mediaInputs || [], model)
                .filter(s => !/frame/i.test(s.key));
            if (refs.length > 1 && refs.some(s => !s.tag)) missing.push(`${model.id} ${op}`);
        }
    }
    assert.deepStrictEqual(missing, [], 'tag these slots (commandRegistry mediaInputs) so the @ picker arms');
});

test('the @ picker writes each model\'s own words for a picture', () => {
    const prose = { tagInProse: true };
    assert.strictEqual(refTagHandle('Image 2', { capabilities: {} }, prose), 'image 2', 'FLUX/Klein/Krea2/Qwen Edit/cloud edits');
    assert.strictEqual(refTagHandle('Image 2', { capabilities: { qwenRefTags: true } }, prose), '<image2>', 'Qwen-Image 2.1');
    // The reference-video forms are unchanged.
    assert.strictEqual(refTagHandle('Picture 1', { capabilities: {} }), '<Picture 1>');
    assert.strictEqual(refTagHandle('Image 1', { capabilities: { atRefTags: true } }), '@image1');
});
