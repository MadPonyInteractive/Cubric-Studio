/**
 * agent-video-attachment.test.cjs — MPI-817: a video could not be handed to the agent.
 *
 * Fabio's toast, twice: "Media type not supported for this model", in agent mode, where no
 * model is the point. Two gates. The prompt box's drop guard let only images through, and
 * behind it the only transport was a base64 data URL into a JPEG/PNG/WebP-only stager.
 *
 * A clip does not travel as bytes. It is already a file of the open project (a gallery card,
 * or a dropped file the box imported), so it goes BY REFERENCE and the server honours the
 * path only inside that project's own Media/.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const esm = (p) => import('file://' + path.join(__dirname, '..', p).replace(/\\/g, '/'));
const url = (abs) => `/project-file?path=${encodeURIComponent(abs)}&v=1789844863482`;
const read = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8');

test('a referenced path is honoured only inside the project`s own Media/', async () => {
    const { ownedMedia } = await esm('services/agentCards.mjs');
    const root = path.join(os.tmpdir(), 'agent-video-proj');
    const clip = path.join(root, 'Media', 'i2v_006.mp4');
    assert.equal(ownedMedia(root, url(clip)), path.resolve(clip));
    assert.equal(ownedMedia(root, url(path.join(root, 'Media', '..', '..', 'other', 'clip.mp4'))), null);
    assert.equal(ownedMedia(root, url(path.join(os.homedir(), 'Videos', 'private.mp4'))), null);
    assert.equal(ownedMedia(root, 'blob:http://127.0.0.1:3000/abc'), null, 'a dropped file with no project open is a blob: nothing can read');
});

test('a referenced video registers like a card: generate takes it by url, make_gif by item id', async () => {
    const { AgentLoop } = await esm('services/agentLoop.mjs');
    const { DeepInfraEngine } = await esm('services/llmEngines.mjs');
    const clip = path.join(os.tmpdir(), 'agent-video-proj', 'Media', 'i2v_006.mp4');
    const made = [];
    const placed = [];
    const loop = new AgentLoop({
        tools: {
            readKnowledge: async () => ({ ok: true, entries: [] }),
            initAttachmentDir: async () => {},
            readMemory: async () => ({ ok: true, notes: [] }),
            placeAsset: async (...a) => { placed.push(a); return { success: true, filePath: 'x' }; },
            makeGif: async (body) => { made.push(body); return { ok: true, output: { itemId: 'item-gif', groupId: 'g-gif', type: 'image', filePath: url(clip.replace('.mp4', '.gif')) } }; },
        },
        resolveEndpoint: async () => ({ profile: { id: 'deepinfra', baseURL: 'http://127.0.0.1:9' }, key: 'k' }),
        lookupContextWindow: async () => 32_768,
    });
    const heard = [];
    const orig = DeepInfraEngine.prototype.chat;
    DeepInfraEngine.prototype.chat = async (req) => { heard.push(req.messages[req.messages.length - 1].content); return { text: 'ok' }; };
    const project = { folderPath: path.dirname(path.dirname(clip)), name: 'P' };
    try {
        await loop.runTurn('make this a gif', [{ id: 'i2v_006.mp4', name: 'Pony rears', filePath: clip, reference: true, mediaType: 'video', itemId: 'item-clip' }],
            project, 'auto', 'deepinfra', 't1', { model: 'fake-model' });
    } finally {
        DeepInfraEngine.prototype.chat = orig;
    }

    assert.match(heard[0], /\[Attached video 1: Pony rears \(ref: i2v_006\.mp4\)/);
    assert.match(heard[0], /look cannot open a video/);
    const ref = loop._resolveImage('i2v_006.mp4');
    assert.equal(ref.kind, 'result', 'not an attachment: generate would place it as a picture, and a reset would delete it');
    assert.equal(ref.path, clip);
    assert.equal(loop.attachmentPath('i2v_006.mp4'), null, 'and the attachment route never serves a project file');

    await loop._executeTool('make_gif', { video: 'i2v_006.mp4', fps: 12 }, 't1', project);
    assert.deepEqual(made, [{ videoItemId: 'item-clip', fps: 12 }]);
    assert.equal(placed.length, 0);
});

test('a clip that is not a card yet is still usable as media, and says why make_gif cannot take it', async () => {
    const { AgentLoop } = await esm('services/agentLoop.mjs');
    const { DeepInfraEngine } = await esm('services/llmEngines.mjs');
    const loop = new AgentLoop({
        tools: { readKnowledge: async () => ({ ok: true, entries: [] }), initAttachmentDir: async () => {}, readMemory: async () => ({ ok: true, notes: [] }) },
        resolveEndpoint: async () => ({ profile: { id: 'deepinfra', baseURL: 'http://127.0.0.1:9' }, key: 'k' }),
        lookupContextWindow: async () => 32_768,
    });
    const heard = [];
    const orig = DeepInfraEngine.prototype.chat;
    DeepInfraEngine.prototype.chat = async (req) => { heard.push(req.messages[req.messages.length - 1].content); return { text: 'ok' }; };
    try {
        await loop.runTurn('extend this', [{ id: 'drop.mp4', name: 'drop.mp4', filePath: 'C:/p/Media/drop.mp4', reference: true, mediaType: 'video', itemId: null }],
            { folderPath: 'C:/p', name: 'P' }, 'auto', 'deepinfra', 't1', { model: 'fake-model' });
    } finally {
        DeepInfraEngine.prototype.chat = orig;
    }
    assert.match(heard[0], /not a gallery card yet, so make_gif cannot take it until list_cards returns it/);
    const out = JSON.parse(await loop._executeTool('make_gif', { video: 'drop.mp4', fps: 12 }, 't1', { folderPath: 'C:/p', name: 'P' }));
    assert.equal(out.error.code, 'NOT_A_CARD');
});

// The route does not load under Node (it needs a live session layer), so its gate is pinned
// where it is written.
test('the server gate: a referenced path is honoured only inside the open project', () => {
    const route = read('routes', 'agent.js');
    const branch = route.slice(route.indexOf('if (!att.dataUrl && att.url)'), route.indexOf('tools.saveAttachment('));
    assert.match(branch, /ownedMedia\(project\.folderPath, att\.url\)/, 'the route honours the path only inside the open project');
    assert.match(branch, /reference: true/);
});

// ── The UI gate is OWED AGAIN (MPI-797 Phase 3, 2026-09-21) ──────────────────
// This used to assert MPI-817's other half against MpiPromptBox: its drop guard accepted a
// video in agent mode with a project open, and `_sendAgentTurn` pushed it as
// `{ url, name, mediaType: 'video', itemId }` — by reference, never bytes.
//
// MPI-797 Phase 3 deleted agent mode from the prompt box, and that send path went with it.
// The SERVER half above is untouched and still correct; what is gone is the only UI that
// could reach it. The panel's own composer (`MpiAgentChat._addImageFile`) guards on
// `image/` and silently ignores a dropped clip, so there is no way to hand the agent a
// video today. Nothing is broken-but-hidden — the transport is simply unreachable.
//
// Owned by MPI-867 now (Fabio split it out of MPI-797's close-out, 2026-09-21). Left as a
// `todo` rather than deleted, so the contract stays on the board on every run, and making
// this pass is that card's definition of done.
// Restoring it is not a line of Phase 3: MpiPromptBox staged its clip with its own private
// `_importMediaFile`, there is no shared import service, and the panel composer has no
// project-media machinery at all. That is a surface of its own, and Fabio's call.
test('the UI gate: a video can be handed to the agent by reference', { todo: 'MPI-867: MPI-817 lost its UI half to MPI-797 Phase 3 — the panel composer takes images only' }, () => {
    // assert.ok on a boolean, not assert.match on the source: a failing `match` prints the
    // whole component into the run, and this one is EXPECTED to fail until the gap is filled.
    const chat = read('js', 'components', 'Compounds', 'MpiAgentChat', 'MpiAgentChat.js');
    assert.ok(/mediaType: 'video', itemId:/.test(chat),
        'a clip travels as a url + item id, never a data URL');
});
