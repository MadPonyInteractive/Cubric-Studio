/**
 * agent-card-marks.test.cjs — MPI-817 Phase F: the agent's view of cards.
 *
 * Fabio, 2026-09-20: "do this to all the triangles" and "do this to the cards I can see" were
 * both impossible. The marks already existed (MPI-785) and the agent could neither see nor
 * set one; and the gallery filter lives only in the renderer's memory, so nothing reading
 * project.json can know what is on screen.
 *
 * A real project folder and the REAL router with a fake renderer, because the two things
 * worth pinning are both seams: what disk says a mark is, and which half answers "visible".
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const express = require('express');

const esm = (p) => import('file://' + path.join(__dirname, '..', p).replace(/\\/g, '/'));
const url = (abs) => `/project-file?path=${encodeURIComponent(abs)}`;

/** Four cards: a triangle, a pre-MPI-785 heart (`true`), an unmarked one, an ARCHIVED square. */
function makeProject(t) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-marks-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const media = path.join(root, 'Media');
    fs.mkdirSync(path.join(media, '.meta'), { recursive: true });
    const card = (id, n, extra) => {
        fs.writeFileSync(path.join(media, '.meta', `item-${id}.json`),
            JSON.stringify({ filePath: url(path.join(media, `${id}.png`)), prompt: id, modelId: 'krea2', operation: 't2i' }));
        return { id: `g-${id}`, type: 'image', name: id, createdAt: `2026-09-20T10:0${n}:00Z`, selectedIndex: 0, history: [`item-${id}`], ...extra };
    };
    fs.writeFileSync(path.join(root, 'project.json'), JSON.stringify({ itemGroups: [
        card('tri', 1, { favourite: 'triangle' }),
        card('heart', 2, { favourite: true }),
        card('plain', 3, { favourite: false }),
        card('binned', 4, { favourite: 'square', archived: true }),
    ] }));
    return root;
}

async function startServer() {
    const app = express();
    app.use(express.json());
    app.use(require('../routes/connector'));
    const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
    return { base: `http://127.0.0.1:${server.address().port}`, stop: () => new Promise((r) => { server.closeAllConnections(); server.close(r); }) };
}

/** Subscribes to the job stream; `answer(capability)` returns what the renderer reports. */
async function fakeRenderer(base, answer) {
    const ac = new AbortController();
    const res = await fetch(`${base}/connector/jobs/stream`, { signal: ac.signal });
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    const jobs = [];
    let buffer = '';
    let ready;
    const connected = new Promise((r) => { ready = r; });
    (async () => {
        for (;;) {
            const { value, done } = await reader.read();
            if (done) return;
            buffer += decoder.decode(value, { stream: true });
            for (let i = buffer.indexOf('\n\n'); i !== -1; i = buffer.indexOf('\n\n')) {
                const raw = buffer.slice(0, i);
                buffer = buffer.slice(i + 2);
                const event = /^event: (.+)$/m.exec(raw)?.[1];
                if (event === 'connected') ready();
                if (event !== 'job') continue;
                const job = JSON.parse(/^data: (.+)$/m.exec(raw)[1]);
                jobs.push(job);
                await fetch(`${base}/connector/jobs/${job.jobId}/result`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(answer(job)),
                });
            }
        }
    })().catch(() => { /* aborted at close */ });
    await connected;
    return { jobs, close: () => ac.abort() };
}

test('a row carries its mark, a legacy heart is a dot, and `mark` lists only that shape', async (t) => {
    const { listCards } = await esm('services/agentCards.mjs');
    const root = makeProject(t);

    const all = await listCards(root);
    const marks = Object.fromEntries(all.cards.map((c) => [c.groupId, c.mark]));
    assert.deepEqual(marks, { 'g-plain': undefined, 'g-heart': 'dot', 'g-tri': 'triangle' });
    assert.ok(!('mark' in all.cards.find((c) => c.groupId === 'g-plain')), 'an unmarked row pays nothing');

    const tri = await listCards(root, { mark: 'triangle' });
    assert.deepEqual(tri.cards.map((c) => c.groupId), ['g-tri']);
    assert.equal(tri.total, 1);
    assert.deepEqual((await listCards(root, { mark: 'dot' })).cards.map((c) => c.groupId), ['g-heart']);
    await assert.rejects(listCards(root, { mark: 'circle' }), { code: 'BAD_REQUEST' });
});

test('the visible set is the RENDERER`s ids in ITS order, rows off disk, archived included', async (t) => {
    const root = makeProject(t);
    const { base, stop } = await startServer();
    // The user is in the archived scope AND the grid is oldest-first: both are things only the
    // renderer knows, and `g-binned` is exactly what /connector/cards can never return.
    const renderer = await fakeRenderer(base, () => ({ ok: true, output: {
        folderPath: root, groupIds: ['g-binned', 'g-tri', 'g-not-on-disk'], order: 'oldest', scope: 'archived', filtered: true, filter: 'Squares' } }));
    try {
        const seen = await (await fetch(`${base}/connector/visible-cards`)).json();
        assert.equal(renderer.jobs[0].capability, 'gallery.visible');
        assert.deepEqual(seen.cards.map((c) => c.groupId), ['g-binned', 'g-tri']);
        assert.equal(seen.cards[0].mark, 'square');
        assert.equal(seen.total, 2);
        assert.equal(seen.filter, 'Squares');
        assert.equal(seen.scope, 'archived');
        assert.equal(seen.folderPath, undefined);
        assert.equal(seen.files['binned.png'].itemId, 'item-binned', 'its ref joins the allowlist like any other card');

        const top = await (await fetch(`${base}/connector/visible-cards?limit=1`)).json();
        assert.deepEqual(top.cards.map((c) => c.groupId), ['g-binned'], '"the first one" is the grid`s first');
        assert.equal(top.total, 2);
    } finally {
        renderer.close();
        await stop();
    }
});

test('no gallery on screen is a named refusal, never the whole project', async () => {
    const { base, stop } = await startServer();
    const renderer = await fakeRenderer(base, () => ({ ok: false, error: { code: 'GALLERY_NOT_OPEN', message: 'The gallery is not on screen.' } }));
    try {
        const seen = await (await fetch(`${base}/connector/visible-cards`)).json();
        assert.equal(seen.ok, false);
        assert.equal(seen.error.code, 'GALLERY_NOT_OPEN');
        assert.equal(seen.cards, undefined);
    } finally {
        renderer.close();
        await stop();
    }
});

test('card-mark relays a mark or a clear, and refuses a shape that is not a string', async () => {
    const { base, stop } = await startServer();
    const renderer = await fakeRenderer(base, (job) => ({ ok: true, output: { groupId: job.input.groupId, mark: job.input.mark || null } }));
    const post = (body) => fetch(`${base}/connector/card-mark`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    try {
        assert.equal((await (await post({ groupId: 'g-tri', mark: 'square' })).json()).output.mark, 'square');
        await post({ groupId: 'g-tri', mark: null });
        assert.deepEqual(renderer.jobs.map((j) => [j.capability, j.input]), [
            ['card.mark', { groupId: 'g-tri', mark: 'square' }],
            ['card.mark', { groupId: 'g-tri', mark: false }],
        ]);
        assert.equal((await post({ mark: 'dot' })).status, 400);
        assert.equal((await post({ groupId: 'g-tri', mark: 3 })).status, 400);
    } finally {
        renderer.close();
        await stop();
    }
});

test('the loop: "none" clears, a visible card`s ref works, and the model never reads a path', async () => {
    const { AgentLoop } = await esm('services/agentLoop.mjs');
    const sent = [];
    const loop = new AgentLoop({ tools: {
        visibleCards: async () => ({ ok: true, cards: [{ groupId: 'g-tri', ref: 'tri.png', mark: 'triangle' }], total: 1, filter: 'Triangles',
            files: { 'tri.png': { path: 'C:/p/Media/tri.png', modelId: 'krea2', itemId: 'item-tri' } } }),
        markCard: async (groupId, mark) => { sent.push([groupId, mark]); return { ok: true, output: { groupId, mark: mark || null } }; },
    } });
    const project = { folderPath: 'C:/p', name: 'P' };

    const seen = await loop._executeTool('visible_cards', {}, 't1', project);
    assert.ok(!seen.includes('"files"') && !seen.includes('C:/p/Media'));
    assert.equal(loop._resolveImage('tri.png').itemId, 'item-tri');

    // Live, 2026-09-20: "give names to all the square and triangle cards" - it listed them, then
    // refused all four because it had not GENERATED them. A listed card is nameable; an id the
    // app never showed it still reaches nothing.
    const named = [];
    loop._tools.renameCard = async (groupId, name) => { named.push([groupId, name]); return { ok: true }; };
    assert.equal(JSON.parse(await loop._executeTool('rename_card', { groupId: 'g-tri', name: 'Cowboy desert prairie' }, 't1', project)).ok, true);
    assert.equal(JSON.parse(await loop._executeTool('rename_card', { groupId: 'g-made-up', name: 'x' }, 't1', project)).error.code, 'UNKNOWN_CARD');
    assert.deepEqual(named, [['g-tri', 'Cowboy desert prairie']]);

    await loop._executeTool('mark_card', { groupId: 'g-tri', mark: 'none' }, 't1', project);
    await loop._executeTool('mark_card', { groupId: 'g-tri', mark: 'dot' }, 't1', project);
    assert.deepEqual(sent, [['g-tri', false], ['g-tri', 'dot']]);
});

// The renderer half cannot load under Node (it imports the app). What CAN drift silently is
// the one thing this pins: a second copy of the grid's filter.
test('the renderer answers "visible" with the GRID`s own predicate and comparator', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'shell', 'agentDispatch.js'), 'utf8');
    const body = src.slice(src.indexOf('function _visibleCards('), src.indexOf('/**', src.indexOf('function _visibleCards(')));
    assert.match(body, /matchesGallerySort\(g, g\.history\?\.\[g\.selectedIndex\] \?\? \{ type: g\.type \}, sort\)/);
    assert.match(body, /\.sort\(byGalleryOrder\(sort\.order\)\)/);
    assert.match(body, /currentPage !== PAGE_GALLERY/);
    assert.match(src, /'gallery\.visible': _visibleCards/);
    assert.match(src, /'card\.mark': _markCard/);
});
