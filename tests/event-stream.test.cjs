'use strict';

// MPI-1142 — every renderer channel rides ONE server-sent-events connection.
//
// Four always-open streams (connector jobs, agent, concat, downloads) held four of
// Chromium's six sockets per host, so pictures and fetches shared two; on a busy Pod
// each slow poll took one of those for seconds (live net log 2026-10-16: thumbnails
// and mascots queued 3-60 s). Server half: one /events/stream connection carries the
// connector `job` frame and the downloads connect snapshot, and closing it detaches
// every channel. Client half: services/eventStream.js opens ONE EventSource however
// many events are subscribed, and reopens a dropped one.

const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const path = require('path');
const express = require('express');

process.env.CUBRIC_MODELS_ROOT = path.join(os.tmpdir(), 'mpi1142-es-' + process.pid);
require('./helpers/sandbox-roots.cjs');

const connector = require('../routes/connector.js');

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

test('server: one /events/stream carries connector jobs and the downloads snapshot', async (t) => {
    const app = express();
    app.use(express.json());
    app.use(require('../routes/eventStream.js'));
    app.use(connector);
    const server = await new Promise((r) => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
    const base = `http://127.0.0.1:${server.address().port}`;
    const ac = new AbortController();
    t.after(() => { ac.abort(); server.close(); });

    const res = await fetch(`${base}/events/stream`, { signal: ac.signal });
    assert.equal(res.headers.get('content-type'), 'text/event-stream');
    const reader = res.body.getReader();

    let buf = await readUntil(reader, /event: download:snapshot/);
    assert.match(buf, /event: connected/);
    assert.match(buf, /event: download:snapshot/, 'downloads hands a fresh connection its snapshot');

    const caps = await (await fetch(`${base}/connector/capabilities`)).json();
    assert.equal(caps.generationSubmit, true, 'the shared stream counts as a listening renderer');

    connector.dispatchToRenderer('test.ping', { n: 1 }, 'job-1142');
    buf = await readUntil(reader, /event: job/);
    assert.match(buf, /event: job\ndata: \{"jobId":"job-1142","capability":"test.ping"/);

    ac.abort();
    await new Promise((r) => setTimeout(r, 100));
    const after = await (await fetch(`${base}/connector/capabilities`)).json();
    assert.equal(after.generationSubmit, false, 'closing the shared stream detaches the connector');
});

test('client: one EventSource for every channel, reopened after a drop', async () => {
    const opened = [];
    globalThis.EventSource = class {
        constructor(url) { this.url = url; this.l = {}; this.readyState = 1; opened.push(this); }
        addEventListener(n, fn) { (this.l[n] = this.l[n] || []).push(fn); }
        removeEventListener() {}
        close() { this.readyState = 2; }
        fire(n, data) { (this.l[n] || []).forEach((fn) => fn({ type: n, data })); }
    };
    globalThis.window = {};
    globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
    const url = require('node:url').pathToFileURL(path.join(__dirname, '..', 'js', 'services', 'eventStream.js')).href;
    const { onStream, onStreamOpen } = await import(url);

    const got = [];
    let opens = 0;
    onStream('job', (e) => got.push(['job', e.data]));
    onStream('download:snapshot', (e) => got.push(['snap', e.data]));
    onStreamOpen(() => { opens += 1; });
    const unsub = onStream('agent:message', (e) => got.push(['agent', e.data]));

    assert.equal(opened.length, 1, 'three channels, one connection');
    assert.equal(opened[0].url, '/events/stream');
    opened[0].fire('open');
    opened[0].fire('job', 'j');
    opened[0].fire('download:snapshot', 's');
    opened[0].fire('agent:message', 'a');
    unsub();
    opened[0].fire('agent:message', 'a2');
    assert.deepEqual(got, [['job', 'j'], ['snap', 's'], ['agent', 'a']]);
    assert.equal(opens, 1);

    opened[0].fire('error');
    assert.equal(opened[0].readyState, 2, 'a dropped stream is closed, not left to retry on its own');
    await new Promise((r) => setTimeout(r, 3100));
    assert.equal(opened.length, 2, 'and reopened once');
    opened[1].fire('open');
    opened[1].fire('job', 'j2');
    assert.equal(opens, 2, 'reconnect re-runs the open hooks (downloads resets its version floor)');
    assert.deepEqual(got.at(-1), ['job', 'j2'], 'listeners carry over to the new connection');
});
