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
    const origFetch = globalThis.fetch;
    globalThis.fetch = async (url, opts = {}) => {
        const p = new URL(url).pathname.split('/').map((s) => (s === ARG ? ':id' : s)).join('/');
        seen.add(`${String(opts.method || 'GET').toUpperCase()} ${p}`);
        return { json: async () => ({ ok: true }) };
    };
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
        globalThis.fetch = origFetch;
    }
    assert.ok(seen.size > 0, 'no request was recorded, so the stub is broken');
    for (const req of seen) {
        assert.ok(!req.startsWith('DELETE '), `${req} uses the DELETE method`);
        assert.doesNotMatch(req, DELETE_SHAPED, `${req} looks like a delete`);
        assert.ok(ALLOWED_REQUESTS.has(req), `${req} is not on the in-app agent's allowlist`);
    }
});
