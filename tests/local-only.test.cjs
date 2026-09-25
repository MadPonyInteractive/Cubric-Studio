'use strict';

// MPI-921 — the local server answers Cubric Studio itself and nobody else. It used to
// run `cors()` wide open, so any web page in the user's browser could drive every route.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { localOnly } = require('../routes/localOnly');

const guard = localOnly(3000);

/** Runs the guard on a fake request; true = passed through to the routes. */
function passes(headers) {
    let status = null;
    let passed = false;
    const res = { status(s) { status = s; return this; }, json() { return this; } };
    guard({ method: 'POST', path: '/connector/generate', headers }, res, () => { passed = true; });
    assert.ok(passed || status === 403, 'refused requests answer 403');
    return passed;
}

test('the renderer and Node clients pass', () => {
    // Node (CLI, agent tools, the server calling itself): Host only.
    assert.ok(passes({ host: '127.0.0.1:3000' }));
    assert.ok(passes({ host: 'localhost:3000' }));
    // The renderer, served from this origin.
    assert.ok(passes({ host: '127.0.0.1:3000', origin: 'http://127.0.0.1:3000', 'sec-fetch-site': 'same-origin' }));
    // A typed URL or bookmark.
    assert.ok(passes({ host: '127.0.0.1:3000', 'sec-fetch-site': 'none' }));
});

test('a cross-origin page is refused', () => {
    assert.ok(!passes({ host: '127.0.0.1:3000', origin: 'https://evil.example', 'sec-fetch-site': 'cross-site' }));
    // A form POST from a file:// page or a sandboxed iframe.
    assert.ok(!passes({ host: '127.0.0.1:3000', origin: 'null' }));
    // A no-cors GET (<img src>) sends no Origin, only Sec-Fetch-Site.
    assert.ok(!passes({ host: '127.0.0.1:3000', 'sec-fetch-site': 'cross-site' }));
    // Another local server (ComfyUI on 48188, any dev server) is same-SITE, not same-origin.
    assert.ok(!passes({ host: '127.0.0.1:3000', origin: 'http://127.0.0.1:48188', 'sec-fetch-site': 'same-site' }));
});

test('a DNS-rebound page is refused on its Host', () => {
    // Same-origin to itself, so Origin and Sec-Fetch-Site look clean.
    assert.ok(!passes({ host: 'evil.example:3000', origin: 'http://evil.example:3000', 'sec-fetch-site': 'same-origin' }));
    assert.ok(!passes({ host: '127.0.0.1:4000' }));
    assert.ok(!passes({}));
});

test('server.js mounts the guard first and no longer runs cors()', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
    assert.doesNotMatch(src, /require\('cors'\)/);
    const guardAt = src.indexOf('app.use(localOnly(port))');
    assert.ok(guardAt > 0, 'server.js must app.use(localOnly(port))');
    assert.ok(guardAt < src.indexOf('app.use(bodyParser'), 'the guard must run before bodies are parsed');
    assert.ok(guardAt < src.indexOf('app.use(express.static'), 'the guard must run before static files are served');
});
