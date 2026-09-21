'use strict';
/**
 * tests/agent-wake.test.cjs — MPI-870: the agent speaks when the generations drain.
 *
 * A finished generation used to be SILENT. `settle()` pushes its note into `_notes`, which
 * is read at the START of the next turn, so nothing reached the user until they typed.
 * Fabio hit it twice on the morning of 2026-09-21 — once sitting for thirty minutes with
 * the answer one inch away from the chat.
 *
 * The split these tests pin, and the reason for it: the loop only ANNOUNCES the drain
 * (`agent:drained`). The renderer decides, because the connector's generate route has no
 * project targeting — a dispatch lands in whatever project is OPEN — so a wake turn raised
 * for project A while B is open would render A's work into B. The server cannot see which
 * project is open. So `wake()` takes the project the RENDERER names, and no-ops when that
 * conversation has nothing to report; that no-op is what makes the second post, on project
 * open, safe to send unconditionally.
 *
 * Fake engine, fake tools: no app, no GPU, no spend.
 *
 * Run: node --test tests/agent-wake.test.cjs
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const ENDPOINT = { profile: { id: 'deepinfra', name: 'DeepInfra', baseURL: 'http://127.0.0.1:9' }, key: 'k' };
const A = { folderPath: 'C:/Projects/Alpha', name: 'Alpha' };
const B = { folderPath: 'C:/Projects/Beta', name: 'Beta' };

const toolCall = (id, name, args) => ({ text: '', toolCalls: [{ id, type: 'function', function: { name, arguments: JSON.stringify(args) } }] });

/**
 * Tools whose `generate` never settles on its own: the test resolves it, which is the whole
 * point — the drain has to be driven, not waited for.
 */
function fakeTools() {
    const calls = { generate: [] };
    let settleOne = null;
    return {
        calls,
        /** Resolve the generation now pending, as the queue would when the render finished. */
        land: (output = { type: 'image', filePath: '/project/Media/fox.png', groupId: 'g1', modelId: 'test-model' }) => {
            const f = settleOne;
            settleOne = null;
            f({ ok: true, output });
        },
        readKnowledge: async () => ({ ok: true, entries: [] }),
        readMemory: async () => ({ ok: true, notes: [] }),
        listModels: async () => ({ ok: true, models: [], flows: [] }),
        listProjects: async () => ({ ok: true, projects: [], total: 0 }),
        discardAttachments: async () => {},
        storedLook: async () => null,
        storeLook: async () => {},
        // The auto-look on an image result. Kept instant so the note order under test is the
        // real one: the wake must not fire until the look note is in.
        look: async () => ({ ok: true, output: { text: 'A fox.' } }),
        generate: (body) => {
            calls.generate.push(body);
            return new Promise((resolve) => { settleOne = resolve; });
        },
    };
}

/** "make X" dispatches an unwaited generate; anything else is answered in words. */
function fakeModel(seen) {
    let n = 0;
    return async (req) => {
        seen.push(req);
        const last = req.messages[req.messages.length - 1];
        if (last.role === 'tool') return { text: 'dispatched' };
        const said = String(last.content);
        if (/^make /m.test(said)) {
            n += 1;
            return toolCall(`g${n}`, 'generate', { modelId: 'test-model', operation: 't2i', prompt: 'A fox' });
        }
        return { text: said.includes('Nothing was typed') ? 'Your fox landed.' : 'reply' };
    };
}

let _mods = null;
async function load() {
    if (!_mods) {
        const sessions = await import('../services/agentSessions.mjs');
        const engines = await import('../services/llmEngines.mjs');
        _mods = { ...sessions, DeepInfraEngine: engines.DeepInfraEngine };
    }
    return _mods;
}

async function makeSessions() {
    const { AgentSessions, DeepInfraEngine } = await load();
    const tools = fakeTools();
    const sessions = new AgentSessions({
        loopOptions: { tools, resolveEndpoint: async () => ENDPOINT, lookupContextWindow: async () => 1_048_576 },
    });
    const events = [];
    sessions.addSubscriber({
        write(payload) {
            events.push({
                event: /^event: (.+)$/m.exec(payload)[1],
                data: JSON.parse(/^data: (.+)$/m.exec(payload)[1]),
            });
        },
    });
    const seen = [];
    const orig = DeepInfraEngine.prototype.chat;
    DeepInfraEngine.prototype.chat = fakeModel(seen);
    const restore = () => { DeepInfraEngine.prototype.chat = orig; };

    let turn = 0;
    const send = (text, project) => sessions.send({
        text, attachments: [], project, mode: 'auto', profileId: 'deepinfra', turnId: `t${++turn}`, model: 'fake',
    });
    const wake = (project) => sessions.wake({ project, mode: 'auto', profileId: 'deepinfra', model: 'fake' });
    return { sessions, tools, events, seen, send, wake, restore };
}

/** Let the microtask chain behind a settled generate run out. */
const flush = () => new Promise((r) => setTimeout(r, 20));

/** Dispatch a generation in `project` and land it, leaving that conversation idle with notes. */
async function dispatchAndLand(h, project) {
    await h.send('make a fox', project);
    h.tools.land();
    await flush();
}

describe('the drain is announced', () => {
    test('agent:drained fires once, for the conversation that dispatched, and only when the last one lands', async (t) => {
        const h = await makeSessions();
        t.after(h.restore);
        const { sessionKey } = await load();

        await h.send('make a fox', A);
        assert.equal(h.events.filter((e) => e.event === 'agent:drained').length, 0,
            'still in flight: the drain has not happened');

        h.tools.land();
        await flush();

        const drained = h.events.filter((e) => e.event === 'agent:drained');
        assert.equal(drained.length, 1);
        assert.equal(drained[0].data.session, sessionKey(A.folderPath), 'tagged with the conversation, as every agent event is');
    });

    test('the drain fires AFTER the auto-look note, not before it', async (t) => {
        const h = await makeSessions();
        t.after(h.restore);
        // A slow look: if the drain were emitted when `_inflight` empties rather than at the
        // end of settle, the wake would run without the description the user is waiting for.
        h.tools.look = async () => { await new Promise((r) => setTimeout(r, 40)); return { ok: true, output: { text: 'A fox.' } }; };

        await h.send('make a fox', A);
        h.tools.land();
        await flush();
        assert.equal(h.events.filter((e) => e.event === 'agent:drained').length, 0, 'the look is still running');

        await new Promise((r) => setTimeout(r, 80));
        assert.equal(h.events.filter((e) => e.event === 'agent:drained').length, 1);
        const loop = h.sessions._loops.get((await load()).sessionKey(A.folderPath));
        assert.equal(loop._notes.some((n) => n.includes('You looked at it')), true,
            'and the look note is in hand before anything can report it');
    });
});

describe('the wake itself', () => {
    test('an idle conversation with notes speaks, once, with no user bubble', async (t) => {
        const h = await makeSessions();
        t.after(h.restore);
        await dispatchAndLand(h, A);

        const before = h.events.filter((e) => e.event === 'agent:message').length;
        assert.deepEqual(h.wake(A), { ok: true, woke: true, session: (await load()).sessionKey(A.folderPath) });
        await flush();

        const said = h.events.filter((e) => e.event === 'agent:message');
        assert.equal(said.length, before + 1, 'it spoke');
        assert.equal(said.at(-1).data.text, 'Your fox landed.');

        // The user typed once. A wake bubble would be a message they never sent.
        const history = h.sessions.history(A.folderPath);
        assert.deepEqual(history.entries.filter((e) => e.kind === 'user').map((e) => e.text), ['make a fox']);

        // Nothing is left to report, so a second wake is a no-op — which is what makes the
        // renderer's post-on-project-open safe to send unconditionally.
        assert.equal(h.wake(A).woke, false);
    });

    test('a wake turn cannot move the user: no open_project, no create_project', async (t) => {
        const h = await makeSessions();
        t.after(h.restore);
        await dispatchAndLand(h, A);
        h.wake(A);
        await flush();

        const names = (req) => (req.tools || []).map((d) => d.function?.name);
        const typed = h.seen[0];
        const woke = h.seen.at(-1);
        assert.equal(names(typed).includes('open_project'), true, 'a turn the user asked for still has them');
        assert.equal(names(woke).includes('open_project'), false);
        assert.equal(names(woke).includes('create_project'), false);
        assert.equal(names(woke).includes('generate'), true, 'everything else is untouched');
    });

    test('a conversation that never ran, or has nothing pending, does not wake', async (t) => {
        const h = await makeSessions();
        t.after(h.restore);
        assert.equal(h.wake(B).woke, false, 'no conversation at all');
        await h.send('hello', A);
        assert.equal(h.wake(A).woke, false, 'a conversation with nothing in flight and nothing to report');
    });

    test('the project the RENDERER names is the one that wakes, never the one that drained', async (t) => {
        const h = await makeSessions();
        t.after(h.restore);
        await dispatchAndLand(h, A);

        // The user walked over to Beta while Alpha was rendering. The renderer posts for the
        // project it has OPEN, and nothing may run in Alpha's name while Beta is on screen.
        assert.equal(h.wake(B).woke, false);
        const loop = h.sessions._loops.get((await load()).sessionKey(A.folderPath));
        assert.equal(loop._notes.length > 0, true, 'Alpha keeps its report');

        // ...and gets it when they come back, which is the second post the renderer makes on
        // project open. This IS the "while you were away" report; it needs no other machinery.
        assert.equal(h.wake(A).woke, true);
    });

    test('a turn already queued for that conversation wakes nothing: it reads the same notes', async (t) => {
        const h = await makeSessions();
        t.after(h.restore);
        await dispatchAndLand(h, A);

        h.sessions.queue({ text: 'and?', attachments: [], project: A, mode: 'auto', profileId: 'deepinfra', turnId: 'q1', model: 'fake' });
        assert.equal(h.wake(A).woke, false, 'the queued turn opens with these notes anyway — waking would say it twice');
    });
});

describe('the runaway bound', () => {
    test('three wakes in a row with nothing typed, then it stops — and one message from the user clears it', async (t) => {
        const h = await makeSessions();
        t.after(h.restore);
        const loop = h.sessions._loops.get((await load()).sessionKey(A.folderPath))
            || (await h.send('hello', A), h.sessions._loops.get((await load()).sessionKey(A.folderPath)));

        // A wake turn can itself dispatch a generation, whose drain wakes again. Standing in
        // for that chain: a fresh note each time, exactly as a landing generation leaves.
        for (let i = 1; i <= 3; i += 1) {
            loop._notes.push(`[Generation finished: card g${i}]`);
            assert.equal(h.wake(A).woke, true, `wake ${i}`);
            await flush();
        }
        loop._notes.push('[Generation finished: card g4]');
        assert.equal(h.wake(A).woke, false, 'the fourth is the runaway');
        assert.equal(loop._notes.length > 0, true, 'and its report is still there for the next turn to open with');

        await h.send('thanks', A);
        loop._notes.push('[Generation finished: card g5]');
        assert.equal(h.wake(A).woke, true, 'a message from the user clears the streak');
    });
});
