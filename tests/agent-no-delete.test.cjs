'use strict';
/**
 * tests/agent-no-delete.test.cjs — the in-app agent can never delete (MPI-774 Phase 3b, item 1).
 *
 * Fabio, 2026-09-16: "Only the user can delete cards and projects." The rule binds the IN-APP
 * agent only: external CLI agents and the external skills keep the delete routes (also his call).
 * So this pins what the in-app agent can REACH, not what the connector serves:
 *   1. the tool names the model is offered, and an invented one being refused,
 *   2. every HTTP request services/agentTools.mjs can make (an allowlist plus the delete shape),
 *   3. the deletion rule in the system prompt.
 * A new tool or route fails here until someone adds it on purpose.
 *
 * Run: node --test tests/agent-no-delete.test.cjs
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');

const DELETE_SHAPED = /delete|remove|trash|unlink|uninstall|purge|erase|wipe|destroy/i;

// Every request the in-app agent can make. Add one only for a reason that is not deletion.
const ALLOWED_REQUESTS = new Set([
    'GET /connector/models',
    'GET /connector/knowledge',
    'GET /connector/knowledge/:id',
    'POST /connector/install',
    'POST /connector/generate',
    'POST /connector/describe',
    'POST /connector/open-project',
    'POST /connector/rename-card',
    'GET /connector/memory',
    'GET /connector/memory/:id',
    'POST /connector/memory',
    'POST /project-media/agent/place-preview-asset',
    // Phase 3c: the landing agent lists and creates projects. Creating never replaces one.
    'GET /connector/projects',
    'POST /connector/create-project',
    // MPI-817: what the open project already holds. Read-only, off disk.
    'GET /connector/cards',
    'GET /connector/cards/:id',
    // MPI-840 (Fabio, 2026-09-20: "The agent should be able to cancel generations"). Not a
    // delete: it stops a render the agent ITSELF started, named by its own requestId, and a
    // cancelled generation never made a card or a file. It cannot reach the user's own runs.
    'POST /connector/cancel',
    // MPI-817 Phase E: the GIF verbs. None removes anything: make and to-video land a NEW card,
    // edit and cutout add an ENTRY to the card's history and leave the source entry on it.
    'POST /connector/gif/make',
    'POST /connector/gif/edit',
    'POST /connector/gif/cutout',
    'POST /connector/gif/to-video',
    // MPI-817 Phase F. visible-cards is a read. card-mark sets a card's dot | square | triangle;
    // clearing one is `mark: false`, a field going back to empty - no card, file or entry goes.
    'GET /connector/visible-cards',
    'POST /connector/card-mark',
    // MPI-876: what a generate body WOULD cost, so the agent can ask before it spends the
    // user's own money. A read — the renderer resolves the run and prices it, queues nothing,
    // writes nothing and bills nothing. It is the opposite of a delete: it exists so that
    // something irreversible cannot happen without the user pressing Yes first.
    'POST /connector/quote',
    // MPI-817: a card's description is kept in its sidecar. A MERGE of one field (`look`) into
    // an existing sidecar; `storeLook` refuses to create one. The model has no tool for it.
    'POST /project-media/agent/update-meta',
]);

// Exports that only touch the agent's own scratch dirs, never a project.
const LOCAL_HELPERS = new Set(['attachmentDir', 'cropDir', 'initAttachmentDir', 'newAttachmentId', 'saveAttachment', 'discardAttachments']);

const ARG = '__ARG__';

async function runOneTurn(text) {
    const { AgentLoop } = await import('../services/agentLoop.mjs');
    const { DeepInfraEngine } = await import('../services/llmEngines.mjs');
    const offered = [];
    const orig = DeepInfraEngine.prototype.chat;
    DeepInfraEngine.prototype.chat = async (req) => {
        offered.push(...(req.tools || []));
        return { text: 'Only you can delete it.' };
    };
    const loop = new AgentLoop({
        tools: { readKnowledge: async () => ({ ok: true, entries: [] }), initAttachmentDir: async () => {} },
        resolveEndpoint: async () => ({ profile: { id: 'deepinfra', baseURL: 'http://127.0.0.1:9' }, key: 'k' }),
        lookupContextWindow: async () => 32_768,
    });
    try {
        await loop.runTurn(text, [], null, 'auto', 'deepinfra', 't1', { model: 'fake-model' });
    } finally {
        DeepInfraEngine.prototype.chat = orig;
    }
    return { loop, offered };
}

test('the model is offered no delete-shaped tool', async () => {
    const { offered } = await runOneTurn('Delete my project.');
    assert.ok(offered.length > 0, 'the loop offered no tools at all, so the capture is broken');
    for (const t of offered) {
        assert.doesNotMatch(t.function.name, DELETE_SHAPED, `tool "${t.function.name}" looks like a delete`);
    }
});

test('a tool the model invents is refused, whatever it is called', async () => {
    const { loop } = await runOneTurn('hi');
    for (const name of ['delete_card', 'delete_project', 'remove_media']) {
        const out = JSON.parse(await loop._executeTool(name, { id: 'x' }, 't2', { folderPath: '/p', name: 'P' }));
        assert.equal(out.error?.code, 'UNKNOWN_TOOL', `${name} was not refused`);
    }
});

test('the system prompt carries the deletion rule', async () => {
    const { loop } = await runOneTurn('hi');
    const system = loop._messages[0];
    assert.equal(system.role, 'system');
    assert.match(system.content, /Deletion rule: You never delete anything/);
});

test('agentTools.mjs reaches only allowlisted routes, none of them a delete', async () => {
    const tools = await import('../services/agentTools.mjs');
    const seen = new Set();

    // A REAL server of this test's own, never a stub of one transport. This used to stub
    // `globalThis.fetch`, which made two promises it could not keep: that it saw every
    // request, and that none of them left the process. The day the table's POSTs moved to
    // `node:http` (MPI-817, the 300 s headers limit) both broke at once - the POSTs went
    // unrecorded, and with no CUBRIC_PORT set they were REAL requests to 127.0.0.1:3000,
    // the user's live app, which created a project called "__ARG__" in his Projects folder.
    // Pointing the table at a port this test owns is blind to the transport and cannot
    // reach anything else.
    const server = require('node:http').createServer((req, res) => {
        const p = new URL(req.url, 'http://x').pathname.split('/').map((s) => (s === ARG ? ':id' : s)).join('/');
        seen.add(`${req.method} ${p}`);
        req.resume();
        req.on('end', () => { res.setHeader('Content-Type', 'application/json'); res.end('{"ok":true}'); });
    }).listen(0, '127.0.0.1');
    await new Promise((r) => server.once('listening', r));
    const prevPort = process.env.CUBRIC_PORT;
    process.env.CUBRIC_PORT = String(server.address().port);
    try {
        for (const [name, fn] of Object.entries(tools)) {
            if (typeof fn !== 'function' || LOCAL_HELPERS.has(name)) continue;
            // Both branches: no argument (e.g. the knowledge index) and with arguments. A branch that
            // throws before its request made none, and every request made is already recorded.
            for (const args of [[], [ARG, ARG, ARG]]) {
                try { await fn(...args); } catch { /* this branch needs other arguments */ }
            }
        }
    } finally {
        if (prevPort === undefined) delete process.env.CUBRIC_PORT; else process.env.CUBRIC_PORT = prevPort;
        server.closeAllConnections();
        server.close();
    }
    assert.ok([...seen].some((r) => r.startsWith('POST ')), 'no POST was recorded, so the capture is blind to the transport the long posts use');
    assert.ok(seen.size > 0, 'no request was recorded, so the stub is broken');
    for (const req of seen) {
        assert.ok(!req.startsWith('DELETE '), `${req} uses the DELETE method`);
        assert.doesNotMatch(req, DELETE_SHAPED, `${req} looks like a delete`);
        assert.ok(ALLOWED_REQUESTS.has(req), `${req} is not on the in-app agent's allowlist`);
    }
});
