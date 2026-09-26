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

// ── The UI gate (MPI-867) ────────────────────────────────────────────────────
// MPI-797 Phase 3 deleted the prompt box's agent mode and with it the only UI path for a
// clip; the panel then sent a video card as its 512 thumbnail. The panel now hands every
// card over by reference through `cardReference`, a clip included.
test('the UI gate: a video card is handed to the agent by reference', async () => {
    const { cardReference } = await esm('js/utils/mediaActions.js');
    const clip = path.join(os.tmpdir(), 'agent-video-proj', 'Media', 'i2v_006.mp4');
    const ref = cardReference({ groupId: 'g-clip', itemId: 'item-clip', type: 'video', filePath: url(clip) });
    assert.deepEqual({ mediaType: ref.mediaType, itemId: ref.itemId, groupId: ref.groupId }, { mediaType: 'video', itemId: 'item-clip', groupId: 'g-clip' });
    assert.ok(ref.url.startsWith('/project-file?path='), 'a clip travels as a url, never a data URL');
    const chat = read('js', 'components', 'Compounds', 'MpiAgentChat', 'MpiAgentChat.js');
    assert.ok(chat.includes('cardReference(card)'), 'the panel`s drop is what uses it');
});

test('a dragged video card joins the cards the agent may name, and the bubble gets its poster', async () => {
    const { AgentLoop } = await esm('services/agentLoop.mjs');
    const { DeepInfraEngine } = await esm('services/llmEngines.mjs');
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-video-card-'));
    const clip = path.join(root, 'Media', 'i2v_006.mp4');
    fs.mkdirSync(path.join(root, 'Media', '.meta'), { recursive: true });
    fs.writeFileSync(path.join(root, 'Media', '.meta', 'item-clip.thumb.webp'), '');
    const loop = new AgentLoop({
        tools: { readKnowledge: async () => ({ ok: true, entries: [] }), initAttachmentDir: async () => {}, readMemory: async () => ({ ok: true, notes: [] }) },
        resolveEndpoint: async () => ({ profile: { id: 'deepinfra', baseURL: 'http://127.0.0.1:9' }, key: 'k' }),
        lookupContextWindow: async () => 32_768,
    });
    const heard = [];
    const orig = DeepInfraEngine.prototype.chat;
    DeepInfraEngine.prototype.chat = async (req) => { heard.push(req.messages[req.messages.length - 1].content); return { text: 'ok' }; };
    try {
        await loop.runTurn('use this as the reference', [{ id: 'i2v_006.mp4', name: 'i2v_006.mp4', filePath: clip, reference: true, mediaType: 'video', itemId: 'item-clip', groupId: 'g-clip' }],
            { folderPath: root, name: 'P' }, 'auto', 'deepinfra', 't1', { model: 'fake-model' });
    } finally {
        DeepInfraEngine.prototype.chat = orig;
        fs.rmSync(root, { recursive: true, force: true });
    }
    assert.match(heard[0], /\[Attached video 1: i2v_006\.mp4 \(ref: i2v_006\.mp4\)\. A gallery card of this project \(groupId g-clip\)/);
    assert.ok(loop._groups.has('g-clip'), 'rename_card / mark_card may name it');
    const user = loop.getHistory().entries.find((e) => e.kind === 'user');
    assert.match(user.attachments[0].url, /item-clip\.thumb\.webp/, 'the bubble draws the poster, not the mp4');
});
