'use strict';
/**
 * agent-attachment-full-res.test.cjs — MPI-884, reshaped by MPI-867.
 *
 * A gallery card dropped on the agent chat was attaching its 512 thumbnail. Proven
 * 2026-09-22, not inferred: the staged file `att_6ae33f4a.webp` (512x682) was BYTE-IDENTICAL
 * to `Anime Kids and Dog/Media/.meta/998f15b2-….thumb.webp`, whose card t2i_003 is 768x1024.
 * The shrink is the DRAG: Chromium synthesises `dataTransfer.files` from the card's `<img>`,
 * which is the 512 rendition. The card's real `filePath` rides in `application/mpi-media`.
 *
 * MPI-867 (Fabio, 2026-09-26): the agent receives the CARD, never its pixels. Nothing is
 * staged any more; every card goes by reference, a clip included, and the thumbnail survives
 * only as the user's chip.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const esm = (p) => import('file://' + path.join(__dirname, '..', p).replace(/\\/g, '/'));
const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

const CHAT_JS = 'js/components/Compounds/MpiAgentChat/MpiAgentChat.js';

const MEDIA = 'C:\\Users\\Fabio\\Documents\\Cubric Vision\\Projects\\Anime Kids and Dog\\Media';
const url = (abs) => `/project-file?path=${encodeURIComponent(abs)}&v=1789990791593`;

/** The drag payload MpiGalleryGrid's dragstart sets, for the card that produced the bug. */
const THUMB = url(`${MEDIA}\\.meta\\998f15b2-e0ba-42d9-be60-cb7531d23a67.thumb.webp`);
const CARD = {
    groupId: 'g-1',
    itemId: '998f15b2-e0ba-42d9-be60-cb7531d23a67',
    filePath: url(`${MEDIA}\\t2i_003.png`),
    type: 'image',
    thumbPath: THUMB,
};

test('a dropped card is handed over as the card`s own file, never the 512 rendition', async () => {
    const { cardReference, extractAbsPath } = await esm('js/utils/mediaActions.js');

    const ref = cardReference(JSON.stringify(CARD));
    assert.ok(ref, 'an image card must be handed over');
    assert.equal(extractAbsPath(ref.url), `${MEDIA}\\t2i_003.png`);
    assert.equal(ref.name, 't2i_003.png');
    assert.equal(ref.mediaType, 'image');
    assert.equal(ref.itemId, CARD.itemId);
    assert.equal(ref.groupId, 'g-1');
    assert.doesNotMatch(ref.url, /\.thumb\./, 'the rendition must never be what the agent receives');
    assert.equal(ref.thumb, THUMB, 'the rendition is the chip, for the user only');

    // Parsed and raw JSON are the same decision — the drop handler has the raw string.
    assert.deepEqual(cardReference(CARD), ref);
});

test('a video card and a GIF card go by reference too; nothing is staged, so nothing is refused', async () => {
    const { cardReference } = await esm('js/utils/mediaActions.js');
    const clip = cardReference({ ...CARD, type: 'video', filePath: url(`${MEDIA}\\i2v_006.mp4`) });
    assert.equal(clip.mediaType, 'video');
    assert.match(clip.url, /i2v_006\.mp4/);
    assert.equal(clip.thumb, THUMB, 'an <img> cannot paint the mp4: the chip is the poster');
    assert.equal(cardReference({ ...CARD, filePath: url(`${MEDIA}\\gif_004.gif`) }).mediaType, 'image');

    // The card's poster <img> sets a payload with no thumbPath (Fabio's live drop, 2026-09-26):
    // the chip drew the mp4 and showed only its alt text.
    const bare = cardReference({ ...CARD, thumbPath: undefined, type: 'video', filePath: url(`${MEDIA}\\i2v_006.mp4`) });
    assert.match(decodeURIComponent(bare.thumb), /Media\/\.meta\/998f15b2-e0ba-42d9-be60-cb7531d23a67\.thumb\.webp$/);
});

test('what cannot be handed over is refused, never swapped for the thumbnail', async () => {
    const { cardReference } = await esm('js/utils/mediaActions.js');
    const cases = {
        'an audio card': { ...CARD, type: 'audio', filePath: url(`${MEDIA}\\tts_002.wav`) },
        'a blob/preview card with nothing on disk': { ...CARD, filePath: 'blob:http://127.0.0.1:3000/abc' },
        'a card with no filePath at all': { ...CARD, filePath: '' },
        'a payload with no groupId': { ...CARD, groupId: undefined },
    };
    for (const [what, card] of Object.entries(cases)) {
        assert.equal(cardReference(JSON.stringify(card)), null, what);
    }
    assert.equal(cardReference('{not json'), null, 'a malformed payload');
    assert.equal(cardReference(''), null, 'no payload at all — an OS file drop');
});

test('the chat`s drop: the card or nothing, an OS file becomes a card, and the prompt box never sees it', () => {
    const js = read(CHAT_JS);
    const handler = js.match(/on\(el, 'drop',[\s\S]*?\n {8}\}\)\);/);
    assert.ok(handler, 'the drop handler must still be there to guard');
    const body = handler[0].replace(/\/\/.*$/gm, '');

    assert.match(body, /e\.stopPropagation\(\)/, 'MpiPromptBox takes every card drop that reaches window');
    const card = body.indexOf("getData('application/mpi-media')");
    const files = body.indexOf('dataTransfer.files');
    const await0 = body.indexOf('await');
    assert.ok(card !== -1 && files !== -1, 'both are read');
    assert.ok(await0 === -1 || (card < await0 && files < await0),
        '`dataTransfer` is emptied once the handler yields');
    assert.match(body, /if \(card\) \{[\s\S]*?return;\s*\}/, 'a card never falls through to its thumbnail files');
    assert.match(body, /_importFile\(file\)/, 'an OS file is imported as a card first');
    assert.match(js, /Events\.emit\('media:imported', \{[^}]*groupId/, 'through the one import listener, with the id the reference carries');
    assert.doesNotMatch(js, /readAsDataURL/, 'nothing reaches the agent as bytes');
});
