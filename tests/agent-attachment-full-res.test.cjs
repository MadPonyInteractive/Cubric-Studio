'use strict';
/**
 * agent-attachment-full-res.test.cjs — MPI-884.
 *
 * A gallery card dropped on the agent chat was attaching its 512 thumbnail. Proven
 * 2026-09-22, not inferred: the staged file `att_6ae33f4a.webp` (512x682) was BYTE-IDENTICAL
 * to `Anime Kids and Dog/Media/.meta/998f15b2-….thumb.webp`, whose card t2i_003 is 768x1024
 * — and a second identical copy sat in that project's `.preview-assets/`, so the thumbnail
 * had already fed a real generation. Nothing in our code downscaled it: `saveAttachment`
 * writes the posted bytes verbatim and `_addImageFile` FileReaders the dropped File verbatim.
 *
 * The shrink is the DRAG. A card's `<img>` is the 512 rendition `pickImageRendition` picks
 * for an unpromoted card, and Chromium synthesises `dataTransfer.files` from that element's
 * own image resource. The card's real `filePath` rides the same drag in
 * `application/mpi-media` — `MpiPromptBox._handleMediaDrop` reads it first, `MpiAgentChat`'s
 * drop never did.
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
const CARD = {
    groupId: 'g-1',
    itemId: '998f15b2-e0ba-42d9-be60-cb7531d23a67',
    filePath: url(`${MEDIA}\\t2i_003.png`),
    type: 'image',
    name: 'Kids fishing',
};
/** What the same card's `<img>` is showing, and therefore what `dataTransfer.files` carries. */
const THUMB = url(`${MEDIA}\\.meta\\998f15b2-e0ba-42d9-be60-cb7531d23a67.thumb.webp`);

test('a dropped image card resolves to the card`s own file, never the 512 rendition', async () => {
    const { cardAttachmentSource, extractAbsPath } = await esm('js/utils/mediaActions.js');

    const source = cardAttachmentSource(JSON.stringify(CARD));
    assert.ok(source, 'an image card must offer a full-resolution source');
    assert.equal(extractAbsPath(source.url), `${MEDIA}\\t2i_003.png`);
    assert.equal(source.name, 't2i_003.png');
    assert.doesNotMatch(source.url, /\.thumb\./,
        'this is the whole bug: the rendition must never be what gets attached');
    assert.notEqual(source.url, THUMB);

    // Parsed and raw JSON are the same decision — the drop handler has the raw string.
    assert.deepEqual(cardAttachmentSource(CARD), source);
});

test('a card with no stageable still falls through, so the old path still runs', async () => {
    const { cardAttachmentSource } = await esm('js/utils/mediaActions.js');

    const cases = {
        'a video card': { ...CARD, type: 'video', filePath: url(`${MEDIA}\\i2v_006.mp4`) },
        'an audio card': { ...CARD, type: 'audio', filePath: url(`${MEDIA}\\tts_002.wav`) },
        // `type` is 'image' for a GIF card, and its filePath IS the animated file.
        'a gif card': { ...CARD, filePath: url(`${MEDIA}\\gif_004.gif`) },
        'a blob/preview card with nothing on disk': { ...CARD, filePath: 'blob:http://127.0.0.1:3000/abc' },
        'a card with no filePath at all': { ...CARD, filePath: '' },
    };
    for (const [what, card] of Object.entries(cases)) {
        assert.equal(cardAttachmentSource(JSON.stringify(card)), null, what);
    }
    assert.equal(cardAttachmentSource('{not json'), null, 'a malformed payload');
    assert.equal(cardAttachmentSource(''), null, 'no payload at all — an OS file drop');
});

test('what it accepts is exactly what saveAttachment will stage', async () => {
    const { cardAttachmentSource } = await esm('js/utils/mediaActions.js');
    const { saveAttachment } = await esm('services/agentTools.mjs');

    // Routing an extension the stager rejects would turn a working (if small) attachment
    // into a staging error in the chat, so the two ends have to agree.
    const rejected = await saveAttachment('gif_004.gif', 'data:image/gif;base64,R0lGODlhAQABAAAAACw=')
        .then(() => null, (err) => err);
    assert.equal(rejected?.code, 'UNSUPPORTED_TYPE', 'saveAttachment takes only JPEG/PNG/WebP');
    assert.equal(cardAttachmentSource(JSON.stringify({ ...CARD, filePath: url(`${MEDIA}\\a.gif`) })), null);

    for (const ext of ['png', 'jpg', 'jpeg', 'webp', 'PNG']) {
        assert.ok(cardAttachmentSource(JSON.stringify({ ...CARD, filePath: url(`${MEDIA}\\a.${ext}`) })),
            `.${ext} is stageable and must be taken`);
    }
});

test('the chat`s drop reads the card payload BEFORE dataTransfer.files', () => {
    const js = read(CHAT_JS);
    const handler = js.match(/on\(el, 'drop',[\s\S]*?\n {8}\}\)\);/);
    assert.ok(handler, 'the drop handler must still be there to guard');
    // Comments out: the prose here names both `files` and `await`, and would satisfy the
    // ordering checks on its own.
    const body = handler[0].replace(/\/\/.*$/gm, '');

    const card = body.indexOf("getData('application/mpi-media')");
    const files = body.indexOf('dataTransfer.files');
    assert.notEqual(card, -1, 'the card payload is the only thing naming the real file');
    assert.notEqual(files, -1, 'an OS file drop must still work');
    assert.ok(card < files, 'reading `files` first is what attached the thumbnail');

    // Both must be read before the first await: `dataTransfer` is emptied once the handler
    // yields, so a card that falls through would find no files left.
    const await0 = body.indexOf('await');
    assert.ok(await0 === -1 || files < await0,
        '`dataTransfer.files` must be read before the handler yields');
});
