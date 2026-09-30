'use strict';
/**
 * agent-stacks.test.cjs — MPI-950, the renderer half of "agents see stacks as stacks".
 *
 * A stack owns no media (MPI-949), so with one open in History the turn's workspace named the
 * stack and no entry: the agent could not tell "this one" from the rest. The workspace now
 * names the MEMBER on screen (published by the History block) and the stack around it.
 *
 * Run: node --test tests/agent-stacks.test.cjs
 */

const test   = require('node:test');
const assert = require('node:assert/strict');
const path   = require('node:path');

const sent = [];
globalThis.window = {
    EventSource: class { addEventListener() {} close() {} },
    fetch: async (_url, opts) => { sent.push(JSON.parse(opts.body)); return { ok: true, json: async () => ({ ok: true }) }; },
};
globalThis.EventSource = globalThis.window.EventSource; // concatProgress opens one at import
globalThis.localStorage = {
    _store: {},
    getItem(k) { return this._store[k] ?? null; },
    setItem(k, v) { this._store[k] = v; },
    removeItem(k) { delete this._store[k]; },
};

const esm = (p) => import('file://' + path.join(__dirname, '..', p).replace(/\\/g, '/'));

const member = (id, file) => ({ id, type: 'image', name: id, selectedIndex: 0, stackId: 's1', history: [{ id: `i-${id}`, filePath: file, type: 'image' }] });

test('an open stack sends the member on screen, and the stack around it', async () => {
    const [{ state }, { agentSendMessage }, { setStackMemberReader, clearStackMemberReader }, { PAGE_GROUP_HISTORY }] = await Promise.all([
        esm('js/state.js'),
        esm('js/services/agentService.js'),
        esm('js/shell/activeStackMember.js'),
        esm('js/router.js'),
    ]);
    state.currentProject = { folderPath: 'C:/p', itemGroups: [
        member('g-a', 'C:/p/Media/a.png'),
        member('g-b', 'C:/p/Media/b.png'),
        { id: 's1', type: 'stack', kind: 'image', name: 'Scenes', history: [], members: ['g-a', 'g-b'] },
    ] };
    state.currentPage = PAGE_GROUP_HISTORY;
    state.currentParams = { groupId: 's1' };

    const read = () => 'g-b';
    setStackMemberReader(read);
    await agentSendMessage('this one', [], { folderPath: 'C:/p', name: 'P' });
    let ws = sent.at(-1).workspace;
    assert.equal(ws.groupId, 'g-b', 'the card on screen, not the stack');
    assert.equal(ws.activeEntry.filePath, 'C:/p/Media/b.png');
    assert.deepEqual(ws.card.stack, { groupId: 's1', name: 'Scenes', count: 2 });

    // No reader (the block is still mounting): the stack's first member, never nothing.
    clearStackMemberReader(read);
    await agentSendMessage('this one', [], { folderPath: 'C:/p', name: 'P' });
    ws = sent.at(-1).workspace;
    assert.equal(ws.activeEntry.filePath, 'C:/p/Media/a.png');

    // A plain card carries no stack.
    state.currentParams = { groupId: 'g-a' };
    await agentSendMessage('this one', [], { folderPath: 'C:/p', name: 'P' });
    assert.equal(sent.at(-1).workspace.card.stack, undefined);
});

test('an agent fan-out stacks its NEW cards only: never an edit, a sound, or a closed project', async () => {
    const { agentResultStack } = await esm('js/shell/agentDispatch.js');
    const input = { resultStack: { id: 'stack-1234', total: 3 } };
    const open = { open: true };
    assert.deepEqual(agentResultStack(input, { mediaType: 'video' }, null, open), { id: 'stack-1234', total: 3, kind: 'video' });
    assert.equal(agentResultStack(input, { mediaType: 'image' }, { scope: 'groupHistory' }, open), null, 'an edit is its own card`s next version');
    assert.equal(agentResultStack(input, { mediaType: 'audio' }, null, open), null, 'a stack holds pictures or videos');
    assert.equal(agentResultStack(input, { mediaType: 'image' }, null, { open: false }), null);
    assert.equal(agentResultStack({}, { mediaType: 'image' }, null, open), null, 'one card is one card');
});
