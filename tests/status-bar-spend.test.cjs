'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

/**
 * MPI-1059 — the status bar's idle label carries the live Pod spend next to REMOTE
 * (`IDLE · REMOTE · $0.59`), so the user does not have to go back to the home page to see
 * what a connected Pod has cost. The number comes from the same gate the hero strip uses
 * (`podSessionCost`), so the two surfaces can never disagree on whether there is one.
 */

const REPO = path.join(__dirname, '..');
const statusBar = fs.readFileSync(path.join(REPO, 'js/shell/statusBar.js'), 'utf8');
const heroStats = fs.readFileSync(path.join(REPO, 'js/shell/heroStats.js'), 'utf8');

test('podSessionCost: uptime x $/hr, null unless BOTH are known', async () => {
    const { podSessionCost } = await import('../js/utils/podCost.js');
    // The screenshot that asked for this: 14 min on a $2.49/hr RTX PRO 6000 reads $0.58-0.59.
    assert.strictEqual(podSessionCost({ uptimeSeconds: 14 * 60, pricePerHr: 2.49 }).toFixed(2), '0.58');
    assert.strictEqual(podSessionCost({ uptimeSeconds: 3600, pricePerHr: 2.49 }), 2.49);
    for (const bad of [
        {}, undefined,
        { uptimeSeconds: 600 },                       // price unknown (GPU overlay not loaded)
        { pricePerHr: 2.49 },                         // uptime unknown (Pod just connected)
        { uptimeSeconds: 0, pricePerHr: 2.49 },
        { uptimeSeconds: 600, pricePerHr: 0 },
        { uptimeSeconds: NaN, pricePerHr: 2.49 },
        { uptimeSeconds: null, pricePerHr: null },    // what every Settings/boot emit sends
    ]) {
        assert.strictEqual(podSessionCost(bad), null, `expected null for ${JSON.stringify(bad)}`);
    }
});

test('the status bar and the hero strip read the SAME gate', () => {
    for (const [name, src] of [['statusBar.js', statusBar], ['heroStats.js', heroStats]]) {
        assert.ok(/import \{ podSessionCost, podSpendText \} from '\.\.\/utils\/podCost\.js'/.test(src),
            `${name} no longer imports podSessionCost — the two surfaces can disagree again`);
        assert.ok(!/uptimeSeconds \/ 3600/.test(src), `${name} computes the cost itself again`);
    }
});

test('the remote:connection listener feeds the idle label its spend', () => {
    const at = statusBar.indexOf("Events.on('remote:connection'");
    assert.ok(at > 0, 'remote:connection listener is gone');
    const listener = statusBar.slice(at, statusBar.indexOf('}));', at));
    assert.ok(/podSessionCost\(\{ uptimeSeconds, pricePerHr \}\)/.test(listener) && /podSpendText\(cost, creditUsd\)/.test(listener),
        'the listener drops the feed\'s uptime/price, so the label never shows a spend');

    const label = statusBar.slice(statusBar.indexOf('function _idleScopeLabel('),
        statusBar.indexOf('\n}\n', statusBar.indexOf('function _idleScopeLabel(')));
    assert.ok(/Remote · \$\{_podSpend\}/.test(label), 'idle label no longer shows the spend');
    assert.ok(/_podSpend === null \? 'Remote'/.test(label), 'no cost data must still read plain Remote');
});

test('a running job carries the spend next to its timer', () => {
    // Fabio, 2026-10-10: a 29-minute render on a Pod is exactly when the spend matters,
    // and a running job owns the label, so the spend rides in the time slot.
    const at = statusBar.indexOf('function _renderTime(');
    assert.ok(at > 0, '_renderTime() is gone');
    const render = statusBar.slice(at, statusBar.indexOf('\n}\n', at));
    assert.ok(/_state === 'active' && _podSpend !== null/.test(render), 'the time slot no longer shows the spend');

    // One writer: any other write to the slot would wipe the spend until the next tick.
    const writes = statusBar.match(/_jobTime\.textContent\s*=/g) || [];
    assert.strictEqual(writes.length, 1, 'something writes the time slot outside _renderTime()');

    const listener = statusBar.slice(statusBar.indexOf("Events.on('remote:connection'"));
    assert.ok(/else _renderTime\(\)/.test(listener.slice(0, listener.indexOf('}));'))),
        'a feed tick during a job no longer repaints the spend');
});

/**
 * MPI-1155 — "$0.50 of $15.00": the spend next to the RunPod credit the Pod started from.
 * Fabio: what is LEFT matters more than the month's bill, and it should always be on screen.
 */
test('podSpendText: "of $credit" only when the feed carries a credit', async () => {
    const { podSpendText } = await import('../js/utils/podCost.js');
    assert.strictEqual(podSpendText(0.5, 15), '$0.50 of $15.00');
    assert.strictEqual(podSpendText(0.5, null), '$0.50');
    assert.strictEqual(podSpendText(0.5, undefined), '$0.50');
});

test('client.balance reads myself.clientBalance over GraphQL, null on any failure', async () => {
    process.env.APP_USER_DATA ||= fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'mpi1155-'));
    const { client } = require('../routes/runpodRemote');
    const real = globalThis.fetch;
    let sent = null;
    const answer = (status, body) => { globalThis.fetch = async (url, opts) => { sent = { url: String(url), opts }; return new Response(JSON.stringify(body), { status }); }; };
    try {
        answer(200, { data: { myself: { clientBalance: 14.37 } } });
        assert.strictEqual(await client.balance('rpa_test_key'), 14.37);
        assert.strictEqual(sent.url, 'https://api.runpod.io/graphql');
        assert.strictEqual(sent.opts.headers.Authorization, 'Bearer rpa_test_key');
        assert.match(JSON.parse(sent.opts.body).query, /myself\s*\{\s*clientBalance\s*\}/);

        answer(401, { errors: [{ message: 'Unauthorized' }] });
        assert.strictEqual(await client.balance('rpa_test_key'), null);
        answer(200, { data: { myself: null }, errors: [{ message: 'not allowed' }] });
        assert.strictEqual(await client.balance('rpa_test_key'), null);
    } finally {
        globalThis.fetch = real;
    }
});

test('the specs feed reads the balance once per Pod, adding back what it had billed', () => {
    const src = fs.readFileSync(path.join(REPO, 'routes/remotePodLifecycle.js'), 'utf8');
    const fn = src.slice(src.indexOf('async function _podCredit('), src.indexOf("router.get('/remote/pod/specs'"));
    assert.ok(/_credit\.podId !== podId/.test(fn), 'the balance is read every 5 s tick, not once per Pod');
    assert.ok(/balance \+ \(uptimeSeconds \/ 3600\) \* pricePerHr/.test(fn), 'a resumed Pod\'s spend is counted twice');
    assert.ok(/creditUsd: await _podCredit\(/.test(src), 'the specs feed no longer carries creditUsd');
});
