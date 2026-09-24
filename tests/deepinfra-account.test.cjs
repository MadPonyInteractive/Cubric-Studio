'use strict';

/**
 * deepinfra-account.test.cjs — MPI-855, the Remote panel's spend readout.
 *
 * `GET /deepinfra/account` reads `/payment/checklist`, whose body ALSO carries the billing
 * address and card last4. The only mitigation is field-picking, so this drives the real route
 * with that body and asserts nothing personal reaches the response or `logger.*` (the log is
 * downloadable, and an error dialog turns a message into a public GitHub issue URL).
 */

const assert = require('node:assert/strict');
const test = require('node:test');
const http = require('node:http');
const express = require('express');

process.env.DEEPINFRA_API_KEY = 'test-key';
const logger = require('../routes/logger');
const logged = [];
for (const level of ['info', 'warn', 'error', 'debug']) {
    logger[level] = (...args) => { logged.push(JSON.stringify(args)); };
}
const router = require('../routes/deepinfra.js');
const { _accountSummary } = router;

// The probed 2026-09-24 shape, strings replaced by markers the assertions hunt for.
const CHECKLIST = {
    billing_type: 'balance', stripe_balance: -4.44, recent: 2.9, limit: 5, topup: false,
    billing_address_info: { name: 'SECRET_NAME', line1: 'SECRET_LINE1', postal_code: 'SECRET_POSTCODE' },
    payment_method_info: { card: { last4: '9876', brand: 'visa' } },
    email: 'SECRET_EMAIL',
};
const LEAKS = /SECRET_|9876|line1|postal_code|last4|"name"|email/;

function serve(upstream) {
    const realFetch = global.fetch;
    global.fetch = async (url, opts) => {
        if (String(url).startsWith('https://api.deepinfra.com')) return upstream(url, opts);
        return realFetch(url, opts);
    };
    const app = express();
    app.use(router);
    const server = app.listen(0);
    const get = () => new Promise((resolve, reject) => {
        http.get(`http://127.0.0.1:${server.address().port}/deepinfra/account`, (res) => {
            let body = '';
            res.on('data', c => { body += c; });
            res.on('end', () => resolve(body));
        }).on('error', reject);
    });
    return { get, close: () => { global.fetch = realFetch; server.close(); } };
}

test('the summary is four named numbers, matching the dashboard', () => {
    const s = _accountSummary(CHECKLIST);
    assert.deepEqual(Object.keys(s).sort(), ['balanceUsd', 'limitRoomUsd', 'limitUsd', 'spentUsd']);
    assert.equal(s.spentUsd, 2.9);
    assert.equal(s.limitUsd, 5);
    assert.ok(Math.abs(s.balanceUsd - 1.54) < 1e-9);
    assert.ok(Math.abs(s.limitRoomUsd - 2.1) < 1e-9);
    assert.equal(_accountSummary({ ...CHECKLIST, limit: 0 }).limitUsd, null);
});

test('the route answers the numbers and nothing personal, and logs none of the body', async () => {
    logged.length = 0;
    const srv = serve(async () => new Response(JSON.stringify(CHECKLIST), { status: 200 }));
    try {
        const raw = await srv.get();
        const json = JSON.parse(raw);
        assert.equal(json.ok, true);
        assert.equal(json.spentUsd, 2.9);
        assert.doesNotMatch(raw, LEAKS);
        assert.doesNotMatch(logged.join('\n'), LEAKS);
    } finally { srv.close(); }
});

test('a failed billing read is a code this file wrote, with no upstream text anywhere', async () => {
    logged.length = 0;
    const srv = serve(async () => new Response(JSON.stringify({ detail: 'SECRET_LINE1 SECRET_NAME' }), { status: 500 }));
    try {
        const raw = await srv.get();
        assert.equal(JSON.parse(raw).error.code, 'PROVIDER_ERROR');
        assert.doesNotMatch(raw, LEAKS);
        assert.doesNotMatch(logged.join('\n'), LEAKS);
    } finally { srv.close(); }

    const thrown = serve(async () => { throw new Error('boom SECRET_LINE1'); });
    try {
        const raw = await thrown.get();
        assert.equal(JSON.parse(raw).error.code, 'PROVIDER_ERROR');
        assert.doesNotMatch(raw + logged.join('\n'), LEAKS);
    } finally { thrown.close(); }
});

// Outside Electron the fork bridge answers null, so with no env key there is no profile
// either: NO_PROFILE here, NO_KEY in the app (profile saved, key not). Same early return.
test('no key saved refuses cleanly, before any billing read', async () => {
    const saved = process.env.DEEPINFRA_API_KEY;
    delete process.env.DEEPINFRA_API_KEY;
    let called = false;
    const srv = serve(async () => { called = true; throw new Error('must not be called'); });
    try {
        assert.match(JSON.parse(await srv.get()).error.code, /^NO_(KEY|PROFILE)$/);
        assert.equal(called, false);
    } finally { srv.close(); process.env.DEEPINFRA_API_KEY = saved; }
});
