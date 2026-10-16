/**
 * import-card.test.cjs — MPI-1136. Cosmo's half of "import a card from another project"
 * (the MCP half is in mcp.test.cjs). Series work: episode 2 open, Mira lives in episode 1.
 *
 * Pinned: another project's rows reach the model with NO ref (nothing there is usable here
 * until imported), only a project the app listed or the user typed is read, and import_card
 * always lands in the OPEN project and hands back a ref the next step can use.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const esm = (p) => import('file://' + path.join(__dirname, '..', p).replace(/\\/g, '/'));
const url = (abs) => `/project-file?path=${encodeURIComponent(abs)}`;

function makeEpisode(t, name) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), `import-card-${name}-`));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const media = path.join(root, 'Media');
    fs.mkdirSync(path.join(media, '.meta'), { recursive: true });
    fs.writeFileSync(path.join(media, '.meta', 'item-mira.json'), JSON.stringify({ filePath: url(path.join(media, 'mira.png')), prompt: 'Mira, red coat', modelId: 'krea2', operation: 't2i' }));
    fs.writeFileSync(path.join(root, 'project.json'), JSON.stringify({ itemGroups: [
        { id: 'g-mira', type: 'image', name: 't2i_001', customName: 'Mira', createdAt: '2026-10-16T10:00:00Z', selectedIndex: 0, history: ['item-mira'] },
    ] }));
    return root;
}

test('Cosmo reads another project only to import from it, and the copy lands in the open one', async (t) => {
    const { AgentLoop } = await esm('services/agentLoop.mjs');
    const cards = await esm('services/agentCards.mjs');
    const ep1 = makeEpisode(t, 'ep1');
    const ep2 = { folderPath: fs.mkdtempSync(path.join(os.tmpdir(), 'import-card-ep2-')), name: 'Episode 2' };
    t.after(() => fs.rmSync(ep2.folderPath, { recursive: true, force: true }));
    const copy = path.join(ep2.folderPath, 'Media', 'mira_1234.png');
    const imported = [];
    const loop = new AgentLoop({ tools: {
        listProjects: async () => ({ ok: true, projects: [{ name: 'Episode 1', folderPath: ep1 }, ep2] }),
        listCards: async (folderPath, groupId, limit) => ({ ok: true, ...(groupId ? await cards.readCard(folderPath, groupId) : await cards.listCards(folderPath, { limit })) }),
        importCard: async (body) => { imported.push(body); return { ok: true, output: { itemId: 'item-copy', groupId: 'g-copy', type: 'image', filePath: url(copy), cardName: 'Mira' } }; },
    } });
    const run = async (tool, args) => JSON.parse(await loop._executeTool(tool, args, 't1', ep2));

    assert.equal((await run('list_cards', { folderPath: ep1 })).error.code, 'UNKNOWN_PROJECT', 'a path the model made up is not read');
    assert.equal((await run('import_card', { sourceFolderPath: ep1, groupId: 'g-mira' })).error.code, 'UNKNOWN_PROJECT');
    assert.equal(imported.length, 0);

    await run('list_projects', {});
    const other = await run('list_cards', { folderPath: ep1 });
    assert.equal(other.cards[0].groupId, 'g-mira');
    assert.equal(other.cards[0].ref, undefined, 'no ref: nothing in another project is usable here');
    assert.equal(other.files, undefined);
    assert.equal(loop._resolveImage('mira.png'), null, 'and nothing was registered');
    assert.equal((await run('list_cards', { folderPath: ep1, groupId: 'g-mira' })).card.ref, undefined);

    const r = await run('import_card', { sourceFolderPath: ep1, groupId: 'g-mira' });
    assert.equal(r.ok, true);
    assert.deepEqual(imported.at(-1), { sourceFolderPath: ep1, groupId: 'g-mira', folderPath: ep2.folderPath }, 'into the OPEN project');
    assert.equal(r.output.groupId, 'g-copy');
    assert.ok(loop._resolveImage(url(copy)), 'the copy is a ref the next step can use');

    const closed = JSON.parse(await loop._executeTool('import_card', { sourceFolderPath: ep1, groupId: 'g-mira' }, 't1', null));
    assert.equal(closed.error.code, 'NO_PROJECT');
});
