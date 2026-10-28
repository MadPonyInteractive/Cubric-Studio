'use strict';
/**
 * tests/agent-midturn-message.test.cjs — a message typed mid-turn reaches that turn (MPI-1286).
 *
 * Fabio, live 2026-10-28: "save that operation as a note, we'll do it next session" was
 * typed while Cosmo set up a clip join. It waited behind the turn (MPI-840) and the turn
 * submitted the video first. Typed in the running conversation, it is read before the next
 * model call now, and runs only once.
 *
 * Fake engine and fake tools: no app, no GPU, no spend.
 *
 * Run: node --test tests/agent-midturn-message.test.cjs
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');

const ENDPOINT = { profile: { id: 'deepinfra', name: 'DeepInfra', baseURL: 'http://127.0.0.1:9' }, key: 'k' };
const A = { folderPath: 'C:/Projects/Alpha', name: 'Alpha' };
const B = { folderPath: 'C:/Projects/Beta', name: 'Beta' };

const tools = {
    readKnowledge: async () => ({ ok: true, entries: [] }),
    readMemory: async () => ({ ok: true, notes: [] }),
    listProjects: async () => ({ ok: true, projects: [A, B], total: 2 }),
};

const turn = (text, project, turnId, extra = {}) => ({ text, attachments: [], project, mode: 'auto', profileId: 'deepinfra', turnId, model: 'fake', ...extra });

async function setup(t) {
    const { AgentSessions, sessionKey } = await import('../services/agentSessions.mjs');
    const { DeepInfraEngine } = await import('../services/llmEngines.mjs');
    const sessions = new AgentSessions({ loopOptions: { tools, resolveEndpoint: async () => ENDPOINT, lookupContextWindow: async () => 1_048_576 } });
    const events = [];
    sessions.addSubscriber({ write: (p) => events.push({ event: /^event: (.+)$/m.exec(p)[1], data: JSON.parse(/^data: (.+)$/m.exec(p)[1]) }) });

    // The first call of the turn asks for a tool and waits on the gate; after that, a turn
    // whose last message is the user's answers in words, and a tool result reads "done".
    let release;
    const gate = new Promise((r) => { release = r; });
    const requests = [];
    const orig = DeepInfraEngine.prototype.chat;
    DeepInfraEngine.prototype.chat = async (req) => {
        requests.push(req.messages.map((m) => ({ ...m })));
        if (requests.length === 1) {
            await gate;
            return { text: '', toolCalls: [{ id: 'l1', type: 'function', function: { name: 'list_projects', arguments: '{}' } }] };
        }
        const last = req.messages[req.messages.length - 1];
        return { text: last.role === 'tool' ? 'done' : `reply to ${String(last.content).split('\n').pop()}` };
    };
    t.after(() => { DeepInfraEngine.prototype.chat = orig; });
    const history = (p) => sessions.history(p.folderPath).entries;
    return { sessions, sessionKey, events, requests, release, history };
}

const userTexts = (entries) => entries.filter((e) => e.kind === 'user').map((e) => e.text);

test('a message typed in the running conversation is read before the next step, once', async (t) => {
    const { sessions, events, requests, release, history } = await setup(t);
    const running = sessions.send(turn('join the clips', A, 't1'));
    sessions.queue(turn("leave it, we'll do it next session", A, 'q1'));
    release();
    await running;

    const second = requests[1];
    const last = second[second.length - 1];
    assert.equal(last.role, 'user', 'the typed message follows the tool result');
    assert.match(last.content, /^\[Typed just now, while you were working on this turn\./);
    assert.match(last.content, /we'll do it next session$/);
    assert.equal(second[second.length - 2].role, 'tool', 'nothing sits between a call and its result');

    assert.equal(sessions.busy(), false, 'taken from the queue, nothing waits behind the turn');
    assert.deepEqual(userTexts(history(A)), ['join the clips', "leave it, we'll do it next session"]);
    assert.deepEqual(events.filter((e) => e.event === 'agent:message').map((e) => e.data.text),
        ["reply to leave it, we'll do it next session"], 'answered in the same turn, and not run a second time');
});

test('another conversation`s message and an attachment still wait for the turn to end', async (t) => {
    const { sessions, requests, release, history } = await setup(t);
    const running = sessions.send(turn('join the clips', A, 't1'));
    sessions.queue(turn('one in beta', B, 'q1'));
    sessions.queue(turn('use this one', A, 'q2', { attachments: [{ id: 'a1', name: 'x.png', filePath: 'C:/x.png' }] }));
    release();
    await running;

    assert.equal(requests[1][requests[1].length - 1].role, 'tool', 'the running turn read neither');
    assert.deepEqual(userTexts(history(B)), ['one in beta']);
    assert.deepEqual(userTexts(history(A)), ['join the clips', 'use this one']);
});
