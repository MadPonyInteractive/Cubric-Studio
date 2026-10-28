'use strict';

// MPI-1323 — the landing's project list loaded only on arrival, so a project an agent
// created over the connector (B-roll, 2026-10-28) was missing until the user left the
// landing and came back. The server now sends `projects:changed` on /events/stream
// when a project is created or a card lands in a closed one; the landing reloads on it.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const express = require('express');

process.env.CUBRIC_MODELS_ROOT = path.join(os.tmpdir(), 'mpi1323-pc-' + process.pid);
require('./helpers/sandbox-roots.cjs');

async function readUntil(reader, re, ms = 3000) {
    const dec = new TextDecoder();
    let buf = '';
    const end = Date.now() + ms;
    while (Date.now() < end) {
        const { value, done } = await Promise.race([
            reader.read(),
            new Promise((r) => setTimeout(() => r({ value: null, done: false }), end - Date.now())),
        ]);
        if (done) break;
        if (value) buf += dec.decode(value);
        if (re.test(buf)) return buf;
    }
    return buf;
}

test('creating a project and landing a card in a closed one each reach the open stream', async (t) => {
    const parent = await fs.mkdtemp(path.join(os.tmpdir(), 'mpi1323-'));
    const app = express();
    app.use(express.json());
    app.use(require('../routes/eventStream.js'));
    app.use(require('../routes/projects.js'));
    const server = await new Promise((r) => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
    const base = `http://127.0.0.1:${server.address().port}`;
    const ac = new AbortController();
    t.after(async () => { ac.abort(); server.close(); await fs.remove(parent); });

    const reader = (await fetch(`${base}/events/stream`, { signal: ac.signal })).body.getReader();
    await readUntil(reader, /event: connected/);

    const post = (route, body) => fetch(`${base}${route}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }).then((r) => r.json());

    const made = await post('/create-project', { name: 'B-roll', folderPath: parent });
    assert.equal(made.success, true);
    let buf = await readUntil(reader, /event: projects:changed/);
    assert.match(buf, /event: projects:changed\ndata: \{"folderPath":"[^"]*B-roll"\}/);

    const landed = await post('/project-groups', { folderPath: made.project.folderPath, groups: [{ id: 'g1', history: ['i1'] }] });
    assert.equal(landed.success, true);
    buf = await readUntil(reader, /event: projects:changed/);
    assert.match(buf, /event: projects:changed/, 'a card in a closed project moves its landing row too');
});
