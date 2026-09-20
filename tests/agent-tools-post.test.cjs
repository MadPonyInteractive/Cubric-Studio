/**
 * agent-tools-post.test.cjs — MPI-817.
 *
 * `services/agentTools.mjs` posts to routes that answer only when the work is DONE:
 * `/connector/generate` holds its response for the whole render. Node's `fetch` abandons any
 * response whose headers take over 300 s, whatever `signal` it was given, so every
 * generation over five minutes came back `fetch failed` with the clip sitting in the
 * gallery. Live, 2026-09-19: a 337 s H3 clip; the agent was told it had failed, told Fabio
 * "no clip was ever created", and re-ran the same five-minute render.
 *
 * The limit itself cannot be reproduced in a unit test (it is 300 s, and it cannot be
 * lowered without the dispatcher this fix avoids). It was measured once, by hand, with a
 * loopback server answering at 310 s: see tasks/MPI-817/validation.md. What this file pins
 * is the thing that must not regress: the long posts do not go through `fetch` at all.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');

const esm = (p) => import('file://' + path.join(__dirname, '..', p).replace(/\\/g, '/'));

/** A loopback stand-in for the app's own server; `CUBRIC_PORT` points the table at it. */
async function withServer(handler, run) {
    const server = http.createServer((req, res) => {
        let body = '';
        req.on('data', (c) => { body += c; });
        req.on('end', () => handler(req, res, body));
    }).listen(0, '127.0.0.1');
    await new Promise((r) => server.once('listening', r));
    const prevPort = process.env.CUBRIC_PORT;
    process.env.CUBRIC_PORT = String(server.address().port);
    try {
        return await run();
    } finally {
        if (prevPort === undefined) delete process.env.CUBRIC_PORT; else process.env.CUBRIC_PORT = prevPort;
        server.closeAllConnections();
        server.close();
    }
}

test('a generate is posted WITHOUT fetch, so the 300 s headers limit cannot reach it', async () => {
    const tools = await esm('services/agentTools.mjs');
    const origFetch = global.fetch;
    global.fetch = async () => { throw new TypeError('fetch failed'); };
    try {
        const seen = {};
        const result = await withServer((req, res, body) => {
            Object.assign(seen, { method: req.method, url: req.url, type: req.headers['content-type'], body: JSON.parse(body) });
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true, output: { filePath: 'x.mp4' } }));
        }, () => tools.generate({ modelId: 'minimax-h3', duration: 6 }));

        assert.deepEqual(result, { ok: true, output: { filePath: 'x.mp4' } });
        assert.equal(seen.method, 'POST');
        assert.equal(seen.url, '/connector/generate');
        assert.equal(seen.type, 'application/json');
        assert.deepEqual(seen.body, { modelId: 'minimax-h3', duration: 6 });
    } finally {
        global.fetch = origFetch;
    }
});

test('a refusal is still an ANSWER: a 400 with a JSON body resolves, as it did under fetch', async () => {
    const tools = await esm('services/agentTools.mjs');
    const refusal = { ok: false, error: { code: 'INVALID_DURATION', message: 'no' } };
    const result = await withServer((_req, res) => {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(refusal));
    }, () => tools.generate({}));
    assert.deepEqual(result, refusal, 'the loop reads { ok, error } off the body; a thrown 400 would hide the named reason');
});

// A card's description is kept in its sidecar (Fabio, 2026-09-20). The READ is off disk; the
// WRITE goes through the route that owns the per-sidecar queue, and must never create a sidecar.
test('a kept look: read off the sidecar, written through update-meta, and only for a real card', async () => {
    const tools = await esm('services/agentTools.mjs');
    const fsx = require('node:fs');
    const project = fsx.mkdtempSync(path.join(require('node:os').tmpdir(), 'cubric-look-'));
    const media = path.join(project, 'Media');
    fsx.mkdirSync(path.join(media, '.meta'), { recursive: true });
    fsx.writeFileSync(path.join(media, '.meta', 'item-1.json'), JSON.stringify({ prompt: 'a fox' }));
    const image = path.join(media, 't2i_001.png');
    try {
        assert.equal(await tools.storedLook(image, 'item-1'), null, 'a sidecar with no look is a miss');

        const posts = [];
        await withServer((req, res, body) => {
            posts.push({ url: req.url, body: JSON.parse(body) });
            res.setHeader('Content-Type', 'application/json');
            res.end('{"success":true}');
        }, async () => {
            await tools.storeLook(image, 'item-1', 'An upright rider.');
            await tools.storeLook(image, 'item-none', 'No sidecar, so no card.');
            await tools.storeLook(path.join(media, '.preview-assets', 'abc.png'), 'item-1', 'Not in Media/.');
        });

        assert.equal(posts.length, 1, 'a missing sidecar is never created, and a file outside Media/ has no card');
        assert.equal(posts[0].url, `/project-media/agent/update-meta?folderPath=${encodeURIComponent(project)}`);
        assert.equal(posts[0].body.itemId, 'item-1');
        assert.equal(posts[0].body.updates.look.text, 'An upright rider.');
        assert.deepEqual(Object.keys(posts[0].body.updates), ['look'], 'it merges ONE field and touches no other');

        // What the route does with that body: `{ ...prev, ...updates }`.
        fsx.writeFileSync(path.join(media, '.meta', 'item-1.json'), JSON.stringify({ prompt: 'a fox', ...posts[0].body.updates }));
        assert.equal(await tools.storedLook(image, 'item-1'), 'An upright rider.');
    } finally {
        fsx.rmSync(project, { recursive: true, force: true });
    }
});

test('a dead server REJECTS rather than hanging, so the loop can report it', async () => {
    const tools = await esm('services/agentTools.mjs');
    const prevPort = process.env.CUBRIC_PORT;
    process.env.CUBRIC_PORT = '1'; // nothing listens on 127.0.0.1:1
    try {
        await assert.rejects(() => tools.generate({}));
    } finally {
        if (prevPort === undefined) delete process.env.CUBRIC_PORT; else process.env.CUBRIC_PORT = prevPort;
    }
});
