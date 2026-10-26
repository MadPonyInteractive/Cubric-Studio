/**
 * phone-route.test.cjs — MPI-1300. The phone page is dev-gated: served on a source run,
 * 404 on a release (CUBRIC_DEV_MODE=off stands in for a stamped build hash), and the
 * static server never hands phone.html out past the gate.
 */

'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const express = require('express');

async function get(urlPath) {
    const app = express();
    app.use(require('../routes/phone.js'));
    app.use(express.static(path.join(__dirname, '..')));   // same order as server.js
    const server = await new Promise(r => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
    try {
        const res = await fetch(`http://127.0.0.1:${server.address().port}${urlPath}`);
        return { status: res.status, body: await res.text() };
    } finally {
        await new Promise(r => server.close(r));
    }
}

test('dev run: /phone serves the phone page', async () => {
    delete process.env.CUBRIC_DEV_MODE;
    const res = await get('/phone');
    assert.equal(res.status, 200);
    assert.match(res.body, /js\/phone\/init\.js/);
});

test('release: /phone and /phone.html are 404', async (t) => {
    process.env.CUBRIC_DEV_MODE = 'off';
    t.after(() => { delete process.env.CUBRIC_DEV_MODE; });
    assert.equal((await get('/phone')).status, 404);
    assert.equal((await get('/phone.html')).status, 404, 'the static server must not serve it past the gate');
});

test('server.js registers the phone route before the static server', () => {
    const src = require('node:fs').readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
    const phone = src.indexOf("require('./routes/phone')");
    assert.ok(phone > 0, 'routes/phone is registered');
    assert.ok(phone < src.indexOf('express.static(__dirname)'), 'before express.static');
});
