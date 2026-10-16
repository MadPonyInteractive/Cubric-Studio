/**
 * import-card.test.cjs — MPI-1136. "Send cards to another project", Cosmo's half and the card
 * picker both surfaces share (the MCP tool is in mcp.test.cjs). Fabio's words: he looks at cards
 * and sends them OUT ("take these to project X"), picked by hand or as "the last two we made",
 * "all the audio", "every card marked with a dot", and after a send to a NEW project the work
 * carries on there.
 *
 * Pinned: `selectCards` picks by kind, mark (through `markOf`, so a legacy heart is a dot) and
 * newest, newest first, stack members in, archived and stacks out; Cosmo sends by ref (a set ref
 * sends its cards) or by those picks, to a listed project or a new one, and a ref with no card
 * behind it is refused before anything is sent.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const esm = (p) => import('file://' + path.join(__dirname, '..', p).replace(/\\/g, '/'));

test('selectCards: the newest N of a kind and a mark, the way list_cards orders them', async (t) => {
    const { selectCards } = await esm('services/agentCards.mjs');
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'send-cards-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const at = (h) => `2026-10-16T${String(h).padStart(2, '0')}:00:00Z`;
    fs.writeFileSync(path.join(root, 'project.json'), JSON.stringify({ itemGroups: [
        { id: 'v1', type: 'video', createdAt: at(1), history: ['a'], favourite: 'triangle' },
        { id: 'i2', type: 'image', createdAt: at(2), history: ['b'], favourite: true },
        { id: 'a3', type: 'audio', createdAt: at(3), history: ['c'] },
        { id: 'v4', type: 'video', createdAt: at(4), history: ['d'], stackId: 's1' },
        { id: 'v5', type: 'video', createdAt: at(5), history: ['e'], archived: true },
        { id: 's1', type: 'stack', kind: 'video', createdAt: at(6), history: [], members: ['v4'] },
        { id: 'i7', type: 'image', createdAt: at(7), history: ['f'], favourite: 'dot' },
    ] }));
    assert.deepEqual(await selectCards(root, { newest: 2 }), ['i7', 'v4'], 'the last two made, a stack member included');
    assert.deepEqual(await selectCards(root, { kind: 'video' }), ['v4', 'v1'], 'archived and the stack itself left out');
    assert.deepEqual(await selectCards(root, { kind: 'audio' }), ['a3']);
    assert.deepEqual(await selectCards(root, { mark: 'dot' }), ['i7', 'i2'], 'a legacy heart is a dot');
    assert.deepEqual(await selectCards(root, { kind: 'video', mark: 'triangle' }), ['v1']);
    await assert.rejects(selectCards(root, { mark: 'star' }), /mark must be one of/);
});

test('Cosmo sends cards out of the open project, by ref or by pick, to a listed project or a new one', async () => {
    const { AgentLoop } = await esm('services/agentLoop.mjs');
    const ep1 = { folderPath: 'C:/p/Episode 1', name: 'Episode 1' };
    const ep2 = 'C:/p/Episode 2';
    const sent = [];
    const loop = new AgentLoop({ tools: {
        listProjects: async () => ({ ok: true, projects: [ep1, { name: 'Episode 2', folderPath: ep2 }] }),
        sendCards: async (body) => {
            sent.push(body);
            const folderPath = body.folderPath || `C:/p/${body.newProject}`;
            return { ok: true, output: { copied: 2, folderPath, cards: [{ cardName: 'Mira' }, {}], ...(body.newProject ? { opened: true } : {}) } };
        },
    } });
    const run = async (tool, args) => JSON.parse(await loop._executeTool(tool, args, 't1', ep1));
    // What list_cards, a dropped selection and a finished generation register.
    loop._images.set('mira.png', { path: 'C:/p/Episode 1/Media/mira.png', kind: 'result', itemId: 'i1', groupId: 'g-mira' });
    loop._registerResult('/project-file?path=C%3A%2Fp%2FEpisode%201%2FMedia%2Fbar.png', 'krea2', 'i2', 'g-bar');
    loop._images.set('photo.png', { path: 'C:/tmp/photo.png', kind: 'attachment' });
    loop._sets.set('sel', ['mira.png', '/project-file?path=C%3A%2Fp%2FEpisode%201%2FMedia%2Fbar.png']);

    assert.equal((await run('send_cards', { cards: ['mira.png'], folderPath: ep2 })).error.code, 'UNKNOWN_PROJECT', 'a path the model made up is no target');
    assert.equal((await run('send_cards', { cards: ['photo.png'], newProject: 'X' })).error.code, 'NOT_A_CARD', 'an attachment is not a card');
    assert.equal((await run('send_cards', { newProject: 'X' })).error.code, 'BAD_REQUEST', 'no cards named or picked');
    assert.equal(sent.length, 0, 'a refusal sends nothing');

    await run('list_projects', {});
    const r = await run('send_cards', { cards: ['set:sel'], folderPath: ep2 });
    assert.deepEqual(r, { ok: true, copied: 2, folderPath: ep2, names: ['Mira'] });
    assert.deepEqual(sent.at(-1), { sourceFolderPath: ep1.folderPath, groupIds: ['g-mira', 'g-bar'], folderPath: ep2 }, 'a generation\'s own result is a card too');

    const fresh = await run('send_cards', { kind: 'audio', newest: 2, newProject: 'Episode 3' });
    assert.equal(fresh.opened, true, 'a new project opens, so the work carries on there');
    assert.deepEqual(sent.at(-1), { sourceFolderPath: ep1.folderPath, kind: 'audio', mark: undefined, newest: 2, newProject: 'Episode 3' });

    const closed = JSON.parse(await loop._executeTool('send_cards', { cards: ['mira.png'], folderPath: ep2 }, 't1', null));
    assert.equal(closed.error.code, 'NO_PROJECT');
});
