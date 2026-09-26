// ── Ad-hoc: multi-reference understanding (Fabio 2026-09-26) ─────────────────
// Two pictures of one place from different angles; content from A must land in B.
// A FRAGMENT of scripts/agent-test.mjs, not a module: it was spliced in just above
// "Running one conversation" (a scratch copy with absolute imports) and replaced CASES.
// To make it permanent, move the three cases into CASES and drop the last two lines.
const ROOM_FULL = { id: 'att_room_a', name: 'IMG_4410.JPG', filePath: 'C:/Temp/cubric-agent/attachments/att_room_a.jpg' };
const ROOM_EMPTY = { id: 'att_room_b', name: 'IMG_4415.JPG', filePath: 'C:/Temp/cubric-agent/attachments/att_room_b.jpg' };
const PARK_FULL = { id: 'att_park_a', name: 'IMG_5120.JPG', filePath: 'C:/Temp/cubric-agent/attachments/att_park_a.jpg' };
const PARK_EMPTY = { id: 'att_park_b', name: 'IMG_5133.JPG', filePath: 'C:/Temp/cubric-agent/attachments/att_park_b.jpg' };
const said = (text) => ({ ok: true, output: { text } });
const ROOM_LOOKS = {
    [ROOM_FULL.filePath]: said('Living room photographed from the doorway, looking toward the window wall. An orange accent wall on the left. A light grey L-shaped sectional sofa sits against the orange wall, chaise end toward the window. A low white oval coffee table in front of it on a cream rug. A potted fiddle-leaf fig in a white pot in the corner by the window. A black TV on a white low cabinet on the right wall. Beige tiled floor, daylight from the window.'),
    [ROOM_EMPTY.filePath]: said('Empty living room photographed from the window corner, looking back toward the doorway. The orange accent wall is now on the right side of the frame. Beige tiled floor, white walls, bare, no furniture at all. Daylight from behind the camera.'),
};
const PARK_LOOKS = {
    [PARK_FULL.filePath]: said('A woman in a red coat sitting on a wooden bench on the left side of a park path, facing the camera. A lamp post behind her, autumn trees, a pond on the right.'),
    [PARK_EMPTY.filePath]: said('The same park path seen from the pond side, looking back at the wooden bench, which is now centre-right. Lamp post behind the bench. Nobody in the picture.'),
};
const EDITORS = ['boogu-edit-high', 'boogu-edit-balanced', 'klein-9b', 'klein-4b', 'krea2', 'qwen-edit'];
// His friend's box, from the 2026-09-26 log: Boogu High and Klein 9B ran; nothing says Qwen/Krea were there.
const FRIEND = setInstalled((m) => ['boogu-edit-high', 'klein-9b'].includes(m.id), true,
    setInstalled((m) => EDITORS.includes(m.id) || m.id === 'krea2-nsfw', false));
const ALL_EDITORS = setInstalled((m) => ['boogu-edit-high', 'klein-9b', 'qwen-edit', 'krea2'].includes(m.id), true);

/** The first ok generate, graded: both pictures sent, the EMPTY one as the image being edited. */
function gradeTwoRefs(run, full, empty) {
    const ok = calledAll(run, 'generate').filter((c) => c.result?.ok);
    if (!ok.length) return ['never generated'];
    const a = ok[0].args;
    const media = a.media || [];
    const f = [];
    const slot = (att) => media.find((m) => m.image === att.id)?.role || null;
    if (media.length < 2) f.push(`sent ${media.length} image(s) to ${a.modelId}/${a.operation}: the other angle never reached the model`);
    if (/^boogu/.test(a.modelId)) f.push(`picked ${a.modelId}, which takes one image`);
    if (slot(empty) !== 'inputImage') f.push(`the empty/target picture is in slot ${slot(empty)}, not inputImage (the one edited)`);
    if (!slot(full)) f.push('the picture holding the content was not sent');
    return f;
}

const REF_CASES = [
    {
        id: 'room-friend',
        title: 'furniture from angle A into empty angle B, his friend\'s models (Boogu High + Klein 9B)',
        setup: {
            models: FRIEND, look: ROOM_LOOKS, attachments: [ROOM_FULL, ROOM_EMPTY],
            turns: ['These are two photos of the same living room from different angles. The first has the furniture, the second is empty. Put the same furniture in the second photo, where it would be seen from that angle.'],
        },
        flip: { attachments: [ROOM_EMPTY] },
        check: (run) => gradeTwoRefs(run, ROOM_FULL, ROOM_EMPTY),
    },
    {
        id: 'room-all',
        title: 'same ask, every editor installed',
        setup: {
            models: ALL_EDITORS, look: ROOM_LOOKS, attachments: [ROOM_FULL, ROOM_EMPTY],
            turns: ['These are two photos of the same living room from different angles. The first has the furniture, the second is empty. Put the same furniture in the second photo, where it would be seen from that angle.'],
        },
        flip: { attachments: [ROOM_EMPTY] },
        check: (run) => gradeTwoRefs(run, ROOM_FULL, ROOM_EMPTY),
    },
    {
        id: 'character-angle',
        title: 'a character from shot A placed into the empty reverse angle B, every editor installed',
        setup: {
            models: ALL_EDITORS, look: PARK_LOOKS, attachments: [PARK_FULL, PARK_EMPTY],
            turns: ['Same park, two angles. Put the woman from the first picture into the second one, sitting on the same bench, seen from this new angle.'],
        },
        flip: { attachments: [PARK_EMPTY] },
        check: (run) => gradeTwoRefs(run, PARK_FULL, PARK_EMPTY),
    },
];
CASES.length = 0;
CASES.push(...REF_CASES);

