/**
 * agent-card-reference.test.cjs — MPI-886, folded into MPI-891 (Fabio, 2026-09-24).
 *
 * "If I drag a card to the agent, it should go in as a reference, so the agent should have
 * access to the card, not the image." Live, MPI-891 read 1: a dragged card was COPIED into
 * the agent's attachments (`look FRESH attachment att_ec5ef31b.png`), so no card owned the
 * picture and "colour this image" made a new card instead of the card's next version.
 *
 * A card now travels the road a video already did: by reference, nothing copied, the path
 * honoured only inside the open project's Media/.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const esm = (p) => import('file://' + path.join(__dirname, '..', p).replace(/\\/g, '/'));
const read = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8');

test('a dragged card registers AS the card: its own file, its item id, and a card the agent may name', async () => {
    const { AgentLoop } = await esm('services/agentLoop.mjs');
    const { DeepInfraEngine } = await esm('services/llmEngines.mjs');
    const pic = path.join(os.tmpdir(), 'agent-card-proj', 'Media', 't2i_007.png');
    const project = { folderPath: path.dirname(path.dirname(pic)), name: 'P' };
    const placed = [];
    const sent = [];
    const loop = new AgentLoop({
        tools: {
            readKnowledge: async () => ({ ok: true, entries: [] }),
            initAttachmentDir: async () => {},
            readMemory: async () => ({ ok: true, notes: [] }),
            writeMemory: async () => ({ ok: true }),
            listModels: async () => ({ ok: true, flows: [], models: [{ id: 'test-model', name: 'Test', installed: true, ops: [{ op: 'i2i', installed: true, media: [] }] }] }),
            quoteGeneration: async () => ({ ok: true, output: { billed: false } }),
            placeAsset: async (...a) => { placed.push(a); return { success: true, filePath: 'x' }; },
            generate: async (body) => { sent.push(body); return { ok: true, output: { itemId: 'i2', groupId: 'g7', type: 'image', filePath: '/r.png' } }; },
        },
        resolveEndpoint: async () => ({ profile: { id: 'deepinfra', baseURL: 'http://127.0.0.1:9' }, key: 'k' }),
        lookupContextWindow: async () => 32_768,
    });
    const heard = [];
    const orig = DeepInfraEngine.prototype.chat;
    DeepInfraEngine.prototype.chat = async (req) => { heard.push(req.messages[req.messages.length - 1].content); return { text: 'ok' }; };
    try {
        await loop.runTurn('colour this image', [{ id: 't2i_007.png', name: 't2i_007.png', filePath: pic, reference: true, mediaType: 'image', itemId: 'item-7', groupId: 'g7' }],
            project, 'auto', 'deepinfra', 't1', { model: 'fake-model' });
    } finally {
        DeepInfraEngine.prototype.chat = orig;
    }

    assert.match(JSON.stringify(heard[0]), /A gallery card of this project \(groupId g7\)/);
    assert.match(JSON.stringify(heard[0]), /lands as that card's next version/);
    const ref = loop._resolveImage('t2i_007.png');
    assert.equal(ref.kind, 'result', 'an attachment would be placed as a NEW picture, which is the bug');
    assert.equal(ref.itemId, 'item-7', 'so `look` reads the sidecar instead of re-describing it every turn');
    assert.ok(loop._groups.has('g7'), 'rename_card and mark_card may name the card it was handed');
    assert.equal(loop.attachmentPath('t2i_007.png'), null, 'the attachment route still never serves a project file');
    const user = loop.getHistory().entries.find((e) => e.kind === 'user');
    assert.match(user.attachments[0].url, /^\/project-file\?path=.*t2i_007\.png/, 'the bubble redraws from the card\'s own file');

    await loop._executeTool('generate', { modelId: 'test-model', operation: 'i2i', prompt: 'in full colour', media: [{ role: 'inputImage', image: 't2i_007.png' }] }, 't1', project);
    assert.equal(placed.length, 0, 'nothing is copied into the project');
    assert.match(sent[0].media[0].url, /^\/project-file\?path=.*t2i_007\.png/, 'the card\'s own path, which is what routes the edit into the card');
});

test('the route takes an image by reference too, with its card, only inside the open project', () => {
    const route = read('routes', 'agent.js');
    const branch = route.slice(route.indexOf('if (!att.dataUrl && att.url)'), route.indexOf('tools.saveAttachment('));
    assert.match(branch, /ownedMedia\(project\.folderPath, att\.url\)/);
    assert.match(branch, /att\.mediaType === 'image' \? 'image' : 'video'/);
    assert.match(branch, /groupId: typeof att\.groupId === 'string'/);
});

test('the chat sends a dragged card by reference while a project is open, and copies only on the landing page', () => {
    const chat = read('js', 'components', 'Compounds', 'MpiAgentChat', 'MpiAgentChat.js');
    const fn = chat.slice(chat.indexOf('async function _addCardMedia'), chat.indexOf('function _renderAttachments'));
    assert.match(fn, /if \(_projectRef\(\) && card\?\.groupId\)/);
    assert.match(fn, /mediaType: 'image',\s*itemId: card\.itemId \|\| null, groupId: card\.groupId/);
    assert.ok(fn.indexOf('mediaType: \'image\'') < fn.indexOf('window.fetch'), 'the reference is tried BEFORE the copy');
});
