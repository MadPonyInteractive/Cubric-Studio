'use strict';

/**
 * MPI-593 — routes/mcp.js speaks MCP over one POST, and every tool reaches its connector
 * route. The connector routes here are fakes on a port this test owns: agentTools refuses
 * the user's :3000 under the test runner, so CUBRIC_PORT is set before the first call.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const bodyParser = require('body-parser');

let base;
let server;
const seen = [];

test.before(async () => {
    const app = express();
    app.use(bodyParser.json());
    app.get('/connector/capabilities', (_q, r) => r.json({ generationSubmit: true }));
    app.get('/connector/projects', (_q, r) => r.json({ ok: true, projects: [{ name: 'Bikes', folderPath: 'C:/p/Bikes' }] }));
    app.get('/connector/models', (_q, r) => r.json({
        ok: true,
        models: [{ id: 'krea2', name: 'Krea 2', type: 'image', installed: true, ops: [{ op: 't2i', task: 't2i', rank: 1, params: { ratio: ['1:1'] } }] }],
        flows: [],
    }));
    app.post('/connector/generate', (q, r) => {
        seen.push(q.body);
        setTimeout(() => r.json({ ok: true, output: { filePath: 'C:/p/Bikes/Media/a.png' } }), q.body.positive === 'slow' ? 300 : 0);
    });
    process.env.CUBRIC_MCP_WAIT_MS = '100';
    app.use(require('../routes/mcp'));
    await new Promise((resolve) => { server = app.listen(0, '127.0.0.1', resolve); });
    process.env.CUBRIC_PORT = String(server.address().port);
    base = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => server.close());

const rpc = (method, params, id = 1) => fetch(`${base}/mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
});
const call = async (name, args) => (await (await rpc('tools/call', { name, arguments: args })).json()).result;

test('initialize echoes a supported protocol version and carries instructions', async () => {
    const { result } = await (await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '0' } })).json();
    assert.equal(result.protocolVersion, '2025-06-18');
    assert.deepEqual(result.capabilities, { tools: {} });
    assert.match(result.instructions, /open_project/);
});

test('an unknown protocol version gets the newest one we speak', async () => {
    const { result } = await (await rpc('initialize', { protocolVersion: '1999-01-01' })).json();
    assert.equal(result.protocolVersion, '2025-11-25');
});

test('a notification is answered 202 with no body', async () => {
    const r = await fetch(`${base}/mcp`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) });
    assert.equal(r.status, 202);
    assert.equal(await r.text(), '');
});

test('tools/list names the spike tools, each with an object schema', async () => {
    const { result } = await (await rpc('tools/list')).json();
    const names = result.tools.map((t) => t.name);
    assert.deepEqual(names, ['status', 'list_models', 'describe_model', 'list_projects', 'create_project', 'open_project', 'generate', 'wait_generation']);
    for (const t of result.tools) assert.equal(t.inputSchema.type, 'object');
});

test('list_projects reaches its connector route', async () => {
    const r = await call('list_projects');
    assert.equal(r.isError, false);
    assert.equal(JSON.parse(r.content[0].text).projects[0].name, 'Bikes');
});

test('list_models is the compact catalogue, not the raw list', async () => {
    const m = JSON.parse((await call('list_models')).content[0].text).models[0];
    assert.equal(m.id, 'krea2');
    assert.equal(m.ops[0].params, undefined);
});

test('describe_model returns the whole entry, and an unknown id is an error', async () => {
    assert.deepEqual(JSON.parse((await call('describe_model', { id: 'krea2' })).content[0].text).model.ops[0].params, { ratio: ['1:1'] });
    assert.equal((await call('describe_model', { id: 'nope' })).isError, true);
});

test('generate passes its arguments to /connector/generate untouched', async () => {
    const args = { modelId: 'krea2', operation: 't2i', positive: 'a red bicycle', cardName: 'Bike' };
    const r = await call('generate', args);
    assert.equal(r.isError, false);
    assert.deepEqual(seen.at(-1), args);
});

test('a slow generate answers running + jobId, and wait_generation delivers it without a second submit', async () => {
    const before = seen.length;
    const first = JSON.parse((await call('generate', { modelId: 'krea2', operation: 't2i', positive: 'slow' })).content[0].text);
    assert.equal(first.running, true);
    let r = first;
    while (r.running) r = JSON.parse((await call('wait_generation', { jobId: first.jobId })).content[0].text);
    assert.equal(r.output.filePath, 'C:/p/Bikes/Media/a.png');
    assert.equal(seen.length, before + 1);
    assert.equal((await call('wait_generation', { jobId: 'nope' })).isError, true);
});

test('an unknown tool and an unknown method are errors, GET is 405', async () => {
    assert.equal((await call('nope')).isError, true);
    assert.equal((await (await rpc('resources/list')).json()).error.code, -32601);
    assert.equal((await fetch(`${base}/mcp`)).status, 405);
});
