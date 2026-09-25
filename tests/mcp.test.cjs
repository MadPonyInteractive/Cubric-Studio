'use strict';

/**
 * MPI-593 — routes/mcp.js speaks MCP over one POST, and every tool reaches its connector
 * route. The connector routes here are fakes on a port this test owns: agentTools refuses
 * the user's :3000 under the test runner, so CUBRIC_PORT is set before the first call.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');

let base;
let server;
const seen = [];
const held = new Map(); // requestId -> the held /connector/generate response
const UUID = /^[0-9a-f-]{36}$/;
const withoutId = ({ requestId, ...rest }) => rest;

// A result on disk with the gallery's own thumbnail beside it, as the app saves one.
const media = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-test-'));
const png = path.join(media, 'a.png');
fs.writeFileSync(png, 'not really a png');
fs.mkdirSync(path.join(media, '.meta'));
fs.writeFileSync(path.join(media, '.meta', 'it1.thumb.webp'), 'THUMB');
const DONE = { ok: true, output: { itemId: 'it1', type: 'image', filePath: `/project-file?path=${encodeURIComponent(png)}&v=1` } };

test.before(async () => {
    const app = express();
    app.use(bodyParser.json());
    app.get('/connector/capabilities', (_q, r) => r.json({ generationSubmit: true }));
    app.get('/connector/projects', (_q, r) => r.json({ ok: true, projects: [{ name: 'Bikes', folderPath: 'C:/p/Bikes' }] }));
    app.get('/connector/models', (_q, r) => r.json({
        ok: true,
        models: [
            { id: 'krea2', name: 'Krea 2', type: 'image', installed: true, guides: ['krea-2'], ops: [{ op: 't2i', task: 't2i', rank: 1, params: { ratio: ['1:1'] } }] },
            { id: 'h3', name: 'H3', type: 'video', installed: true, ops: [{ op: 't2v', task: 't2v', rank: 1 }] },
        ],
        flows: [],
    }));
    app.get('/connector/knowledge/:id', (q, r) => r.json({ ok: true, id: q.params.id, title: 'Krea 2', text: 'Write prose.' }));
    app.post('/connector/generate', (q, r) => {
        seen.push(q.body);
        // `appstop` is the user pressing Stop in the app; a video waits for /connector/cancel.
        if (q.body.positive === 'appstop') return r.json({ ok: false, error: { code: 'CANCELLED', message: 'The generation was cancelled or produced no output.' } });
        if (q.body.modelId === 'h3') return held.set(q.body.requestId, r);
        setTimeout(() => r.json(DONE), q.body.positive === 'slow' ? 700 : 0);
    });
    app.post('/connector/cancel', (q, r) => {
        const job = held.get(q.body.requestId);
        if (!job) return r.json({ ok: false, error: { code: 'NOT_IN_FLIGHT', message: 'Nothing in flight.' } });
        held.delete(q.body.requestId);
        job.json({ ok: false, error: { code: 'CANCELLED', message: 'The generation was cancelled or produced no output.' } });
        r.json({ ok: true, output: { cancelled: true, was: 'running' } });
    });
    // `veo` bills, everything else is local.
    app.post('/connector/quote', (q, r) => r.json({ ok: true, output: q.body.modelId === 'veo'
        ? { billed: true, modelName: 'Veo 3', count: 1, usd: 4, display: 'about $4.00' }
        : { billed: false } }));
    process.env.CUBRIC_MCP_WAIT_MS = '300';
    app.use(require('../routes/mcp'));
    await new Promise((resolve) => { server = app.listen(0, '127.0.0.1', resolve); });
    process.env.CUBRIC_PORT = String(server.address().port);
    base = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => {
    server.close();
    fs.rmSync(media, { recursive: true, force: true });
});

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
    assert.deepEqual(names, ['status', 'list_models', 'describe_model', 'list_projects', 'create_project', 'open_project', 'generate', 'wait_generation', 'cancel_generation', 'read_knowledge']);
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

test('generate passes its arguments to /connector/generate untouched, under its own requestId', async () => {
    const args = { modelId: 'krea2', operation: 't2i', positive: 'a red bicycle', cardName: 'Bike' };
    const r = await call('generate', args);
    assert.equal(r.isError, false);
    assert.deepEqual(withoutId(seen.at(-1)), args);
    assert.match(seen.at(-1).requestId, UUID);
});

test('a result carries the path on disk, not the app URL, and the picture itself', async () => {
    const r = await call('generate', { modelId: 'krea2', operation: 't2i', positive: 'a bell' });
    assert.equal(JSON.parse(r.content[0].text).output.filePath, png);
    assert.deepEqual(r.content[1], { type: 'image', data: Buffer.from('THUMB').toString('base64'), mimeType: 'image/webp' });
});

test('a video answers running at once, and cancel_generation stops the render', async () => {
    const started = JSON.parse((await call('generate', { modelId: 'h3', operation: 't2v', positive: 'a train' })).content[0].text);
    assert.equal(started.running, true);
    assert.match(started.message, /end your turn/);
    assert.ok(held.has(started.jobId), 'submitted under the jobId as requestId');

    assert.equal(JSON.parse((await call('cancel_generation', { jobId: started.jobId })).content[0].text).cancelled, true);
    const after = await call('wait_generation', { jobId: started.jobId });
    assert.equal(after.isError, true);
    assert.match(JSON.parse(after.content[0].text).error.message, /cancel_generation, as asked/);
    assert.equal((await call('cancel_generation', { jobId: 'nope' })).isError, true);
});

test('Stop in the chat (notifications/cancelled) stops the render the blocked call waits on', async () => {
    const { jobId } = JSON.parse((await call('generate', { modelId: 'h3', operation: 't2v', positive: 'a ship' })).content[0].text);
    const waiting = rpc('tools/call', { name: 'wait_generation', arguments: { jobId } }, 77).then((x) => x.json());
    await new Promise((resolve) => setTimeout(resolve, 50));
    const note = await fetch(`${base}/mcp`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/cancelled', params: { requestId: 77, reason: 'user' } }) });
    assert.equal(note.status, 202);
    const { result } = await waiting;
    assert.match(JSON.parse(result.content[0].text).error.message, /Stop in the chat/);
    assert.equal(held.has(jobId), false);
});

test('a render stopped in the app says so, so the agent does not re-run it', async () => {
    const r = await call('generate', { modelId: 'krea2', operation: 't2i', positive: 'appstop' });
    assert.equal(r.isError, true);
    assert.match(JSON.parse(r.content[0].text).error.message, /stopped this render in the Cubric Studio app.*Do not run it again/);
});

test('read_knowledge reaches the guide route, and the instructions say to read it first', async () => {
    assert.equal(JSON.parse((await call('read_knowledge', { id: 'krea-2' })).content[0].text).text, 'Write prose.');
    const { result } = await (await rpc('initialize', { protocolVersion: '2025-06-18' })).json();
    assert.match(result.instructions, /read_knowledge/);
});

test('a slow generate answers running + jobId, and wait_generation delivers it without a second submit', async () => {
    const before = seen.length;
    const first = JSON.parse((await call('generate', { modelId: 'krea2', operation: 't2i', positive: 'slow' })).content[0].text);
    assert.equal(first.running, true);
    let r = first;
    while (r.running) r = JSON.parse((await call('wait_generation', { jobId: first.jobId })).content[0].text);
    assert.equal(r.output.filePath, png);
    assert.equal(seen.length, before + 1);
    assert.equal((await call('wait_generation', { jobId: 'nope' })).isError, true);
});

test('a paid model generates nothing until the call repeats the quoted price', async () => {
    const before = seen.length;
    const ask = { modelId: 'veo', operation: 't2v', positive: 'a taxi' };

    const refused = await call('generate', ask);
    assert.equal(refused.isError, true);
    const why = JSON.parse(refused.content[0].text);
    assert.equal(why.error.code, 'CONFIRM_COST');
    assert.equal(why.price, 'about $4.00');
    assert.match(why.error.message, /about \$4\.00/);

    assert.equal(JSON.parse((await call('generate', { ...ask, confirmCost: 'about $0.10' })).content[0].text).error.code, 'CONFIRM_COST');
    assert.equal(seen.length, before, 'nothing reached /connector/generate');

    const ran = await call('generate', { ...ask, confirmCost: 'about $4.00' });
    assert.equal(ran.isError, false);
    assert.equal(seen.length, before + 1);
    assert.deepEqual(withoutId(seen.at(-1)), ask, 'confirmCost is not forwarded');
});

test('an unknown tool and an unknown method are errors, GET is 405', async () => {
    assert.equal((await call('nope')).isError, true);
    assert.equal((await (await rpc('resources/list')).json()).error.code, -32601);
    assert.equal((await fetch(`${base}/mcp`)).status, 405);
});
