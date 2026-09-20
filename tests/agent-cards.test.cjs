/**
 * agent-cards.test.cjs — MPI-817.
 *
 * The agent's image refs are a per-session allowlist, so after a restart it could see none
 * of the project it was sitting in. Live, 2026-09-19: "I can't see the duck image in this
 * turn", in a project of eighteen cards, with its own note naming the file. `list_cards`
 * reads the cards and their sidecars off disk and makes their refs usable.
 *
 * A real project folder on disk, because the two things worth pinning are both about disk:
 * the prompt lives in the SIDECAR and nowhere else, and a sidecar is untrusted input whose
 * paths must not be allowed to leave the project.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const esm = (p) => import('file://' + path.join(__dirname, '..', p).replace(/\\/g, '/'));
const url = (abs) => `/project-file?path=${encodeURIComponent(abs)}&v=1789844863482`;

/** Three cards: a still, the outpaint made from it, and the clip made from that. */
function makeProject(t) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-cards-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const media = path.join(root, 'Media');
    fs.mkdirSync(path.join(media, '.meta'), { recursive: true });
    const file = (name) => path.join(media, name);
    const sidecar = (id, meta) => fs.writeFileSync(path.join(media, '.meta', `${id}.json`), JSON.stringify(meta));

    sidecar('item-still-old', { filePath: url(file('i2i_000.png')), prompt: 'the rejected take', modelId: 'krea2', operation: 'i2i' });
    sidecar('item-still', { filePath: url(file('i2i_001.png')), prompt: 'a duck on a pony', modelId: 'krea2', operation: 'i2i',
        pixelDimensions: { w: 896, h: 1088 }, seed: 7 });
    sidecar('item-out', { filePath: url(file('flowOutpaint_002.png')), prompt: '', flowId: 'outpaint', operation: 'flowOutpaint',
        pixelDimensions: { w: 768, h: 1360 },
        flowInputs: { mediaItems: [{ role: 'image1', url: url(file('i2i_001.png')) }], injectionParams: { Input_is_Turbo: true } } });
    sidecar('item-clip', { filePath: url(file('i2v_006.mp4')), prompt: `${'The pony rears. '.repeat(40)}END`, negativePrompt: 'blur',
        modelId: 'minimax-h3', operation: 'i2v_ms', duration: 5.875, pixelDimensions: { w: 768, h: 1344 }, generationMs: 337532,
        generationSettings: { injectionParams: { Input_Duration: 6, Ratio_Label: '9:16' },
            mediaItems: [{ role: 'startFrame', url: url(file('flowOutpaint_002.png')) }] } });
    // A sidecar is plain JSON in a folder that can come from anywhere.
    sidecar('item-hostile', { filePath: url(path.join(os.homedir(), '.ssh', 'id_rsa')), prompt: 'x', modelId: 'krea2', operation: 't2i',
        generationSettings: { mediaItems: [{ role: 'image1', url: url(path.join(root, 'Media', '..', '..', 'secrets.png')) }] } });

    fs.writeFileSync(path.join(root, 'project.json'), JSON.stringify({ itemGroups: [
        { id: 'g-still', type: 'image', name: 'i2i_001', createdAt: '2026-09-19T17:36:00Z', selectedIndex: 1, history: ['item-still-old', 'item-still'] },
        { id: 'g-out', type: 'image', name: 'flowOutpaint_002', customName: 'Duck riding pony 9:16', createdAt: '2026-09-19T19:07:00Z', selectedIndex: 0, history: ['item-out'] },
        { id: 'g-clip', type: 'video', name: 'i2v_006', createdAt: '2026-09-19T19:30:00Z', selectedIndex: 0, history: ['item-clip'] },
        { id: 'g-gone', type: 'image', name: 'binned', createdAt: '2026-09-19T19:40:00Z', archived: true, history: ['item-still'] },
        { id: 'g-hostile', type: 'image', name: 'hostile', createdAt: '2026-09-19T10:00:00Z', selectedIndex: 0, history: ['item-hostile'] },
    ] }));
    return { root, file };
}

test('the newest cards come back first, one short row each, off the SIDECAR', async (t) => {
    const { listCards } = await esm('services/agentCards.mjs');
    const { root, file } = makeProject(t);
    const { cards, total, files } = await listCards(root);

    assert.deepEqual(cards.map((c) => c.groupId), ['g-clip', 'g-out', 'g-still', 'g-hostile'], 'newest first, the archived card left out');
    assert.equal(total, 4);

    const clip = cards[0];
    assert.equal(clip.ref, 'i2v_006.mp4');
    assert.equal(clip.kind, 'video');
    assert.equal(clip.modelId, 'minimax-h3');
    assert.equal(clip.durationSeconds, 5.875, 'the length the FILE has, not the 6 that was asked for');
    assert.equal(clip.size, '768x1344');
    assert.ok(clip.prompt.length <= 201 && clip.prompt.endsWith('…'), 'a row carries the start of the prompt, never the whole thing');

    assert.equal(cards[1].name, 'Duck riding pony 9:16', 'the name the user sees on the card, not the file stem');
    assert.equal(cards[1].flowId, 'outpaint');
    assert.equal(cards[2].prompt, 'a duck on a pony', 'the version the card is SHOWING (selectedIndex), not the first one');
    assert.equal(files['i2v_006.mp4'].path, path.resolve(file('i2v_006.mp4')));
    assert.ok(!('_file' in clip) && !JSON.stringify(cards).includes(root), 'no absolute path rides in what the model reads');
});

test('limit is honoured and clamped', async (t) => {
    const { listCards, MAX_LIMIT } = await esm('services/agentCards.mjs');
    const { root } = makeProject(t);
    assert.equal((await listCards(root, { limit: 2 })).cards.length, 2);
    assert.equal((await listCards(root, { limit: '1' })).cards.length, 1, 'the route hands it over as a query string');
    assert.equal((await listCards(root, { limit: MAX_LIMIT * 10 })).cards.length, 4);
});

test('a sidecar cannot name a file outside the project`s own Media/', async (t) => {
    const { listCards, readCard } = await esm('services/agentCards.mjs');
    const { root } = makeProject(t);
    const { cards, files } = await listCards(root);
    const hostile = cards.find((c) => c.groupId === 'g-hostile');
    assert.equal(hostile.ref, undefined, 'a card whose file is elsewhere is listed, and gets NO ref');
    assert.deepEqual(Object.keys(files).sort(), ['flowOutpaint_002.png', 'i2i_001.png', 'i2v_006.mp4']);

    const full = await readCard(root, 'g-hostile');
    assert.deepEqual(full.card.madeFrom, [], 'a `..` that climbs out of Media/ is not a project file either');
    assert.deepEqual(full.files, {});
});

test('one card in full: the whole prompt, what ran, and what it was made from', async (t) => {
    const { readCard } = await esm('services/agentCards.mjs');
    const { root, file } = makeProject(t);
    const { card, files } = await readCard(root, 'g-clip');
    assert.ok(card.prompt.endsWith('END'), 'the whole prompt, untruncated');
    assert.equal(card.negativePrompt, 'blur');
    assert.deepEqual(card.settings, { Input_Duration: 6, Ratio_Label: '9:16' });
    assert.deepEqual(card.madeFrom, [{ role: 'startFrame', ref: 'flowOutpaint_002.png' }]);
    assert.equal(files['flowOutpaint_002.png'].path, path.resolve(file('flowOutpaint_002.png')), 'what it was made from is reachable too');

    const flow = await readCard(root, 'g-out');
    assert.deepEqual(flow.card.madeFrom, [{ role: 'image1', ref: 'i2i_001.png' }], 'a Flow keeps its inputs under flowInputs');
    assert.deepEqual(flow.card.settings, { Input_is_Turbo: true });
});

test('named refusals', async (t) => {
    const { listCards, readCard } = await esm('services/agentCards.mjs');
    const { root } = makeProject(t);
    await assert.rejects(() => readCard(root, 'nope'), { code: 'UNKNOWN_CARD' });
    await assert.rejects(() => readCard(root, 'g-gone'), { code: 'UNKNOWN_CARD' }, 'an archived card is not offered');
    await assert.rejects(() => listCards(os.tmpdir()), { code: 'NOT_A_PROJECT' });
    await assert.rejects(() => listCards('relative/path'), { code: 'BAD_REQUEST' });
});

test('the route serves both hops in the connector envelope', async (t) => {
    const express = require('express');
    const { root } = makeProject(t);
    const app = express();
    app.use(require('../routes/connector.js'));
    const server = app.listen(0, '127.0.0.1');
    await new Promise((r) => server.once('listening', r));
    t.after(() => { server.closeAllConnections(); server.close(); });
    const base = `http://127.0.0.1:${server.address().port}/connector/cards`;
    const q = `?folderPath=${encodeURIComponent(root)}`;

    const list = await (await fetch(`${base}${q}&limit=1`)).json();
    assert.equal(list.ok, true);
    assert.deepEqual(list.cards.map((c) => c.ref), ['i2v_006.mp4']);

    const one = await (await fetch(`${base}/g-out${q}`)).json();
    assert.equal(one.card.name, 'Duck riding pony 9:16');

    const miss = await fetch(`${base}/nope${q}`);
    assert.equal(miss.status, 200, 'a named miss is an answer, not a transport error');
    assert.equal((await miss.json()).error.code, 'UNKNOWN_CARD');
    assert.equal((await fetch(base)).status, 400);
});

test('list_cards makes the project`s refs usable, and keeps the paths from the model', async (t) => {
    const { AgentLoop } = await esm('services/agentLoop.mjs');
    const cards = await esm('services/agentCards.mjs');
    const { root, file } = makeProject(t);
    const looked = [];
    const loop = new AgentLoop({ tools: {
        listCards: async (folderPath, groupId, limit) => ({ ok: true, ...(groupId ? await cards.readCard(folderPath, groupId) : await cards.listCards(folderPath, { limit })) }),
        look: async (args) => { looked.push(args); return { ok: true, output: { text: 'a duck' } }; },
    } });
    const project = { folderPath: root, name: 'Cowgirl on a Bull' };

    const before = JSON.parse(await loop._executeTool('look', { image: 'flowOutpaint_002.png' }, 't1', project));
    assert.equal(before.error.code, 'IMAGE_NOT_FOUND', 'the bug: a file its own note named, and no way to reach it');

    const seen = await loop._executeTool('list_cards', {}, 't1', project);
    assert.ok(!seen.includes('"files"') && !seen.includes(JSON.stringify(root).slice(1, -1)), 'the model reads rows, never absolute paths');

    const after = JSON.parse(await loop._executeTool('look', { image: 'flowOutpaint_002.png' }, 't1', project));
    assert.equal(after.ok, true);
    assert.equal(looked[0].imagePath, path.resolve(file('flowOutpaint_002.png')));
    assert.match(loop._appStateLine(project), /i2v_006\.mp4 \(made by minimax-h3\)/, 'and the App state line now carries who made what');

    const closed = JSON.parse(await loop._executeTool('list_cards', {}, 't1', null));
    assert.equal(closed.error.code, 'NO_PROJECT');
});

// MPI-817 Phase E. The GIF routes name a card by ITEM id; the model only ever says `ref`.
test('the GIF tools turn a ref into the item id the card is SHOWING, and a chain feeds itself', async (t) => {
    const { AgentLoop } = await esm('services/agentLoop.mjs');
    const cards = await esm('services/agentCards.mjs');
    const { root, file } = makeProject(t);
    const sent = [];
    const reply = (name, output) => async (body) => { sent.push([name, body]); return { ok: true, output }; };
    const gifUrl = url(file('gif_007.gif'));
    const cutUrl = url(file('gif_008.gif'));
    const loop = new AgentLoop({ tools: {
        listCards: async (folderPath, groupId, limit) => ({ ok: true, ...(groupId ? await cards.readCard(folderPath, groupId) : await cards.listCards(folderPath, { limit })) }),
        makeGif: reply('make', { itemId: 'item-gif', groupId: 'g-gif', type: 'image', filePath: gifUrl, frames: 24, loop: 0 }),
        cutoutGif: reply('cutout', { itemId: 'item-cut', groupId: 'g-user', type: 'image', filePath: cutUrl, frames: 24, loop: 0 }),
        editGif: reply('edit', { itemId: 'item-edit', groupId: 'g-user', type: 'image', filePath: cutUrl }),
    } });
    const results = [];
    loop._emit = (event, data) => { if (event === 'agent:result') results.push(data); };
    const project = { folderPath: root, name: 'Cowgirl on a Bull' };
    const run = async (tool, args) => JSON.parse(await loop._executeTool(tool, args, 't1', project));

    const cold = await run('make_gif', { video: 'i2v_006.mp4', fps: 12 });
    assert.equal(cold.error.code, 'NOT_A_CARD', 'a ref nothing listed reaches no route');
    assert.equal(sent.length, 0);

    await run('list_cards', {});
    const made = await run('make_gif', { video: 'i2v_006.mp4', fps: 12, trimIn: 1, trimOut: 3 });
    assert.deepEqual(sent[0], ['make', { videoItemId: 'item-clip', fps: 12, trimIn: 1, trimOut: 3 }]);
    assert.equal(made.output.itemId, undefined, 'the model is never handed a second kind of id');
    assert.equal(results[0].output.itemId, 'item-gif', 'the chat`s result card still gets the whole output');

    // `selectedIndex: 1` — the version on show, not the first in the history.
    await run('make_gif', { images: ['i2i_001.png', 'flowOutpaint_002.png'] });
    assert.deepEqual(sent[1], ['make', { itemIds: ['item-still', 'item-out'] }]);

    const both = await run('make_gif', { images: ['i2i_001.png', 'flowOutpaint_002.png'], video: 'i2v_006.mp4' });
    assert.equal(both.error.code, 'BAD_REQUEST');

    // The reply's ref is what the next step takes.
    await run('cutout_gif', { gif: gifUrl, method: 'background' });
    assert.deepEqual(sent[2], ['cutout', { itemId: 'item-gif', method: 'background' }]);

    await run('edit_gif', { gif: cutUrl, output: { colours: 64, edgeColour: 'opaque' } });
    assert.deepEqual(sent[3], ['edit', { itemId: 'item-cut', output: { colours: 64, edgeColour: null } }]);

    // rename_card reaches what this conversation MADE. A cut-out lands on a card already there.
    assert.ok(loop._groups.has('g-gif'));
    assert.ok(!loop._groups.has('g-user'), 'an edit of the user`s card does not make it the agent`s to rename');
});
