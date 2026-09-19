'use strict';
/**
 * tests/agent-sessions.test.cjs — one agent conversation per project (MPI-774 Phase 3c).
 *
 * Fabio, 2026-09-16, with D4-D6 as recommended: each project keeps its own conversation,
 * one turn runs at a time app-wide, the landing conversation MOVES into a project it opens
 * that has none (else the request is CARRIED over), and nothing outlives the app. Plus the
 * landing agent's project jobs: list_projects / create_project, and open_project only on a
 * folder the app gave or the user typed.
 *
 * Fake engine and fake tools: no app, no GPU, no spend. The two connector routes run for
 * real against a throwaway documents folder.
 *
 * Run: node --test tests/agent-sessions.test.cjs
 */

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ENDPOINT = { profile: { id: 'deepinfra', name: 'DeepInfra', baseURL: 'http://127.0.0.1:9' }, key: 'k' };
const A = { folderPath: 'C:/Projects/Alpha', name: 'Alpha' };
const B = { folderPath: 'C:/Projects/Beta', name: 'Beta' };

const toolCall = (id, name, args) => ({ text: '', toolCalls: [{ id, type: 'function', function: { name, arguments: JSON.stringify(args) } }] });

/**
 * The fake model: a user line "open <folder>" opens it, "install <model>" asks to install,
 * "list" lists projects, "create <name>" creates one; after a tool result it answers in text.
 */
function fakeModel(gate) {
    let n = 0;
    return async (req) => {
        if (gate) await gate();
        const last = req.messages[req.messages.length - 1];
        if (last.role === 'tool') return { text: 'done' };
        const lines = String(last.content).split('\n');
        const said = lines.find((l) => /^((open|install|create) .+|list)$/.test(l)) || lines.pop();
        const m = /^(open|install|create) (.+)$/.exec(said);
        n += 1;
        if (m?.[1] === 'open') return toolCall(`o${n}`, 'open_project', { folderPath: m[2] });
        if (m?.[1] === 'install') return toolCall(`i${n}`, 'install_model', { modelId: m[2] });
        if (m?.[1] === 'create') return toolCall(`c${n}`, 'create_project', { name: m[2] });
        if (said === 'list') return toolCall(`l${n}`, 'list_projects', {});
        return { text: `reply to ${said}` };
    };
}

function fakeTools() {
    const calls = { opens: [], discards: [], installs: [] };
    return {
        calls,
        readKnowledge: async () => ({ ok: true, entries: [] }),
        readMemory: async () => ({ ok: true, notes: [] }),
        listModels: async () => ({ ok: true, models: [{ id: 'm1', name: 'Model One', missingDownloadGb: 2 }], flows: [] }),
        installModel: async (modelId) => { calls.installs.push(modelId); return { ok: true, modelId, started: true }; },
        openProject: async (folderPath) => {
            calls.opens.push(folderPath);
            const p = [A, B].find((x) => x.folderPath === folderPath) || { folderPath, name: path.basename(folderPath) };
            return { ok: true, output: { folderPath: p.folderPath, name: p.name, groupCount: 0 } };
        },
        listProjects: async () => ({ ok: true, projects: [A, B].map((p) => ({ ...p, updatedAt: '2026-09-16T00:00:00Z' })), total: 2 }),
        createProject: async (name) => ({ ok: true, project: { name, folderPath: `C:/Projects/${name}` } }),
        discardAttachments: async (paths) => { calls.discards.push(...paths); },
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

/** Sessions over fake tools, with the fake model installed for the test's lifetime. */
async function makeSessions({ gate } = {}) {
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
    const orig = DeepInfraEngine.prototype.chat;
    DeepInfraEngine.prototype.chat = fakeModel(gate);
    const restore = () => { DeepInfraEngine.prototype.chat = orig; };
    let turn = 0;
    const send = (text, project, attachments = []) => sessions.send({
        text, attachments, project, mode: 'auto', profileId: 'deepinfra', turnId: `t${++turn}`, model: 'fake',
    });
    return { sessions, tools, events, send, restore };
}

const userTexts = (h) => h.entries.filter((e) => e.kind === 'user').map((e) => e.text);
const agentTexts = (h) => h.entries.filter((e) => e.kind === 'agent').map((e) => e.text);

describe('one conversation per project', () => {
    test('two projects and the landing page keep separate histories', async (t) => {
        const { sessions, send, restore, events } = await makeSessions();
        t.after(restore);
        await send('hello alpha', A);
        await send('hello beta', B);
        await send('hello landing', null);
        assert.deepEqual(userTexts(sessions.history(A.folderPath)), ['hello alpha']);
        assert.deepEqual(userTexts(sessions.history(B.folderPath)), ['hello beta']);
        assert.deepEqual(userTexts(sessions.history('')), ['hello landing']);
        assert.deepEqual(userTexts(sessions.history('C:/Projects/Never')), [], 'a project with no conversation reads as empty');

        const { sessionKey } = await load();
        assert.equal(sessions.history(A.folderPath).session, sessionKey(A.folderPath));
        const replies = events.filter((e) => e.event === 'agent:message');
        assert.deepEqual(replies.map((e) => e.data.session), [sessionKey(A.folderPath), sessionKey(B.folderPath), '']);
        assert.deepEqual(replies.map((e) => e.data.text), ['reply to hello alpha', 'reply to hello beta', 'reply to hello landing']);
    });

    test('a folder is one conversation however its path is written', async (t) => {
        const { sessions, send, restore } = await makeSessions();
        t.after(restore);
        await send('first', A);
        await send('second', { folderPath: 'C:\\Projects\\Alpha\\', name: 'Alpha' });
        const expected = process.platform === 'linux' ? ['first'] : ['first', 'second'];
        if (process.platform !== 'linux') {
            await send('third', { folderPath: 'c:/projects/ALPHA', name: 'Alpha' });
            expected.push('third');
        }
        assert.deepEqual(userTexts(sessions.history(A.folderPath)), expected);
    });

    test('D4: one turn at a time across every conversation', async (t) => {
        let release;
        const held = new Promise((r) => { release = r; });
        const { sessions, send, restore } = await makeSessions({ gate: () => held });
        t.after(restore);
        assert.equal(sessions.busy(), false);
        const running = send('slow', A);
        assert.equal(sessions.busy(), true, 'a turn in Alpha makes the whole agent busy');
        release();
        await running;
        assert.equal(sessions.busy(), false);
    });

    test('D5: the landing conversation moves into a project that has none', async (t) => {
        const { sessions, send, restore, events, tools } = await makeSessions();
        t.after(restore);
        const { sessionKey } = await load();
        await send(`open ${A.folderPath}`, null);

        assert.deepEqual(tools.calls.opens, [A.folderPath]);
        assert.deepEqual(userTexts(sessions.history('')), [], 'the landing page starts fresh');
        const moved = sessions.history(A.folderPath);
        assert.deepEqual(userTexts(moved), [`open ${A.folderPath}`]);
        assert.deepEqual(agentTexts(moved), ['done'], 'the turn went on in the project');

        const hop = events.find((e) => e.event === 'agent:session');
        assert.deepEqual(hop?.data, { from: '', to: sessionKey(A.folderPath) });
        const hopAt = events.indexOf(hop);
        assert.ok(events.slice(0, hopAt).every((e) => e.data.session === ''), 'before the move, events belong to the landing page');
        assert.ok(events.slice(hopAt + 1).every((e) => e.data.session === sessionKey(A.folderPath)), 'after it, to the project');

        await send('hi again', null);
        assert.deepEqual(userTexts(sessions.history('')), ['hi again'], 'a new landing conversation');
        assert.deepEqual(userTexts(sessions.history(A.folderPath)), [`open ${A.folderPath}`]);
    });

    test('D5: a project with its own conversation keeps it, and the request is carried over', async (t) => {
        const { sessions, send, restore, events } = await makeSessions();
        t.after(restore);
        const { sessionKey } = await load();
        await send('earlier in alpha', A);
        const att = { id: 'att_1', name: 'fox.png', filePath: '/tmp/att_1.png' };
        await send(`open ${A.folderPath}`, null, [att]);

        const landing = sessions.history('');
        assert.deepEqual(userTexts(landing), [`open ${A.folderPath}`]);
        assert.deepEqual(agentTexts(landing), ["Opened Alpha. I'll carry on in its own chat."]);
        const alpha = sessions.history(A.folderPath);
        assert.deepEqual(userTexts(alpha), ['earlier in alpha', `From the landing page: open ${A.folderPath}`]);
        assert.equal(events.filter((e) => e.event === 'agent:session').length, 0, 'nothing moved');
        assert.equal(sessions.attachmentPath('att_1'), '/tmp/att_1.png', 'the attachment went along');
        const landingLoop = sessions._loops.get('');
        const alphaLoop = sessions._loops.get(sessionKey(A.folderPath));
        assert.equal(landingLoop.attachmentPath('att_1'), null, 'the landing page gave it up');
        assert.equal(alphaLoop.attachmentPath('att_1'), '/tmp/att_1.png');
        assert.equal(sessions.busy(), false, 'the carried turn ran to the end');

        // The carried request shows live in Alpha's chat, as the entry history holds, and only there.
        const users = events.filter((e) => e.event === 'agent:user');
        const carriedEntry = alpha.entries.filter((e) => e.kind === 'user').pop();
        assert.equal(users.length, 1, 'only the carried request is announced');
        assert.equal(users[0].data.session, sessionKey(A.folderPath));
        assert.equal(users[0].data.id, carriedEntry.id);
        assert.equal(users[0].data.text, carriedEntry.text);
        assert.deepEqual(users[0].data.attachments, [{ id: 'att_1', name: 'fox.png' }]);
        // The model there is told the project is already open for it; the landing turn is not.
        const said = (loop) => loop._messages.filter((m) => m.role === 'user').map((m) => m.content);
        assert.match(said(alphaLoop).pop(), /already opened this project/);
        assert.ok(!said(landingLoop).some((c) => /Handed over/.test(c)));
    });

    test('D5: a project conversation that opens another project carries, never moves', async (t) => {
        const { sessions, send, restore } = await makeSessions();
        t.after(restore);
        await send(`open ${B.folderPath}`, A);
        assert.deepEqual(userTexts(sessions.history(A.folderPath)), [`open ${B.folderPath}`]);
        assert.deepEqual(userTexts(sessions.history(B.folderPath)), [`From Alpha: open ${B.folderPath}`]);
    });

    test('a reset clears one conversation and discards only its own staged files', async (t) => {
        const { sessions, send, restore, tools } = await makeSessions();
        t.after(restore);
        await send('with a picture', A, [{ id: 'att_a', name: 'a.png', filePath: '/tmp/att_a.png' }]);
        await send('another picture', B, [{ id: 'att_b', name: 'b.png', filePath: '/tmp/att_b.png' }]);
        await sessions.reset(A.folderPath);
        assert.deepEqual(userTexts(sessions.history(A.folderPath)), []);
        assert.deepEqual(userTexts(sessions.history(B.folderPath)), ['another picture']);
        assert.deepEqual(tools.calls.discards, ['/tmp/att_a.png']);
        assert.equal(sessions.attachmentPath('att_b'), '/tmp/att_b.png');
    });

    test('an install card is answered in the conversation that shows it', async (t) => {
        const { sessions, send, restore, events, tools } = await makeSessions();
        t.after(restore);
        const running = send('install m1', B);
        for (let i = 0; i < 50 && !events.some((e) => e.event === 'agent:confirm'); i++) {
            await new Promise((r) => setTimeout(r, 5));
        }
        const card = events.find((e) => e.event === 'agent:confirm');
        assert.ok(card, 'no install card was shown');
        const { sessionKey } = await load();
        assert.equal(card.data.session, sessionKey(B.folderPath));
        assert.equal(sessions.byConfirm('nope'), null);
        const loop = sessions.byConfirm(card.data.confirmId);
        assert.equal(loop, sessions._loops.get(sessionKey(B.folderPath)));
        await loop.confirm(card.data.confirmId, true);
        await running;
        assert.deepEqual(tools.calls.installs, ['m1']);
    });
});

describe('project jobs: list, create, open', () => {
    test('open_project refuses a folder nobody gave it', async (t) => {
        const { sessions, send, restore, tools } = await makeSessions();
        t.after(restore);
        await send('hi', null);
        const loop = sessions._loops.get('');
        const out = JSON.parse(await loop._executeTool('open_project', { folderPath: 'C:/Users/Public/Invented' }, 't', null));
        assert.equal(out.error?.code, 'UNKNOWN_PROJECT');
        assert.deepEqual(tools.calls.opens, [], 'the refusal happened before the app was asked');
    });

    test('open_project takes a folder from list_projects, from create_project, or one the user typed', async (t) => {
        const { sessions, send, restore, tools } = await makeSessions();
        t.after(restore);
        await send('list', null);
        await send('create Lighthouse', null);
        const loop = sessions._loops.get('');
        const open = async (folderPath) => JSON.parse(await loop._executeTool('open_project', { folderPath }, 't', null));
        assert.equal((await open(B.folderPath)).ok, true, 'a listed project');
        assert.equal((await open('C:/Projects/Lighthouse')).ok, true, 'a created project');
        assert.equal((await open('C:\\Projects\\Beta')).ok, true, 'the same folder written the Windows way');

        const typed = 'D:/Shoots/Harbour Nights';
        assert.equal((await open(typed)).error?.code, 'UNKNOWN_PROJECT');
        await send(`please work in ${typed.replace(/\//g, '\\')}`, null);
        assert.equal((await open(typed)).ok, true, 'a folder the user typed');
        assert.deepEqual(tools.calls.opens, [B.folderPath, 'C:/Projects/Lighthouse', 'C:\\Projects\\Beta', typed]);
    });

    // Fabio, live 2026-09-19: asked for four character sheets and got a project, a saved
    // brief and a question — the background he gave ("this is for a western set in 1876")
    // read as "describing a project", and nothing was made. Making it is not optional.
    test('the system prompt tells the landing agent to create, open and MAKE, background or not', async (t) => {
        const { sessions, send, restore } = await makeSessions();
        t.after(restore);
        await send('hi', null);
        const system = sessions._loops.get('')._messages[0].content;
        assert.match(system, /if the user asks for anything to be MADE, create a project/);
        assert.match(system, /make it in that same turn/);
        assert.match(system, /never a reason to stop/);
        assert.match(system, /open_project only takes a folderPath from list_projects or create_project, or one the user typed/);
    });
});

describe('discardAttachments', () => {
    test('removes only files directly inside the attachment dir', async () => {
        const base = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-discard-'));
        const prev = process.env.APP_USER_DATA;
        process.env.APP_USER_DATA = base;
        try {
            const tools = await import('../services/agentTools.mjs');
            const dir = tools.attachmentDir();
            fs.mkdirSync(dir, { recursive: true });
            const mine = path.join(dir, 'att_1.png');
            const other = path.join(dir, 'att_2.png');
            const outside = path.join(base, 'keep.png');
            const nested = path.join(dir, 'sub', 'att_3.png');
            for (const f of [mine, other, outside, nested]) {
                fs.mkdirSync(path.dirname(f), { recursive: true });
                fs.writeFileSync(f, 'x');
            }
            await tools.discardAttachments([mine, outside, nested, path.join(dir, '..', 'keep.png')]);
            assert.equal(fs.existsSync(mine), false);
            assert.equal(fs.existsSync(other), true, 'another conversation\'s file stays');
            assert.equal(fs.existsSync(outside), true, 'a path outside the dir is never touched');
            assert.equal(fs.existsSync(nested), true, 'nor one below it');
        } finally {
            if (prev === undefined) delete process.env.APP_USER_DATA; else process.env.APP_USER_DATA = prev;
            fs.rmSync(base, { recursive: true, force: true });
        }
    });
});

describe('connector project routes', () => {
    let server;
    let base;
    let docs;
    const saved = {};
    before(async () => {
        docs = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-projects-'));
        for (const k of ['APP_DOCUMENTS', 'CUBRIC_PORT']) saved[k] = process.env[k];
        process.env.APP_DOCUMENTS = docs;
        const express = require('express');
        const app = express();
        app.use(express.json());
        app.use(require('../routes/connector'));
        app.use(require('../routes/projects'));
        await new Promise((resolve) => { server = app.listen(0, '127.0.0.1', resolve); });
        process.env.CUBRIC_PORT = String(server.address().port);
        base = `http://127.0.0.1:${server.address().port}`;
    });
    after(() => {
        if (server) server.close();
        for (const [k, v] of Object.entries(saved)) {
            if (v === undefined) delete process.env[k]; else process.env[k] = v;
        }
        fs.rmSync(docs, { recursive: true, force: true });
    });

    const post = (p, body) => fetch(`${base}${p}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });

    test('create never replaces a project, and the list returns both folders', async () => {
        const first = await (await post('/connector/create-project', { name: 'Fox Shoot' })).json();
        assert.equal(first.ok, true);
        assert.equal(first.project.name, 'Fox Shoot');
        const firstJson = path.join(first.project.folderPath, 'project.json');
        const before = fs.readFileSync(firstJson, 'utf8');

        const second = await (await post('/connector/create-project', { name: 'Fox Shoot' })).json();
        assert.equal(second.ok, true);
        assert.notEqual(second.project.folderPath, first.project.folderPath, 'a taken name gets its own folder');
        assert.equal(fs.readFileSync(firstJson, 'utf8'), before, 'the first project is untouched');

        const list = await (await fetch(`${base}/connector/projects`)).json();
        assert.equal(list.ok, true);
        assert.equal(list.total, 2);
        assert.deepEqual(new Set(list.projects.map((p) => p.folderPath)), new Set([first.project.folderPath, second.project.folderPath]));
        assert.deepEqual(Object.keys(list.projects[0]).sort(), ['folderPath', 'name', 'updatedAt'], 'names and folders only, no cards');
    });

    test('a nameless create is a 400 and makes nothing', async () => {
        const count = () => fs.readdirSync(path.join(docs, 'Cubric Vision', 'Projects')).length;
        const n = count();
        for (const body of [{}, { name: '   ' }, { name: 42 }, { name: 'x'.repeat(101) }]) {
            const r = await post('/connector/create-project', body);
            assert.equal(r.status, 400, JSON.stringify(body));
            assert.equal((await r.json()).error.code, 'BAD_REQUEST');
        }
        assert.equal(count(), n);
    });

    test('there is no delete route for projects on the connector', async () => {
        const r = await fetch(`${base}/connector/projects`, { method: 'DELETE' });
        assert.equal(r.status, 404);
    });
});
