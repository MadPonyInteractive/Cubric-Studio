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
        assert.ok(/import \{ podSessionCost \} from '\.\.\/utils\/podCost\.js'/.test(src),
            `${name} no longer imports podSessionCost — the two surfaces can disagree again`);
        assert.ok(!/uptimeSeconds \/ 3600/.test(src), `${name} computes the cost itself again`);
    }
});

test('the remote:connection listener feeds the idle label its spend', () => {
    const at = statusBar.indexOf("Events.on('remote:connection'");
    assert.ok(at > 0, 'remote:connection listener is gone');
    const listener = statusBar.slice(at, statusBar.indexOf('}));', at));
    assert.ok(/podSessionCost\(\{ uptimeSeconds, pricePerHr \}\)/.test(listener),
        'the listener drops the feed\'s uptime/price, so the label never shows a spend');

    const label = statusBar.slice(statusBar.indexOf('function _idleScopeLabel('),
        statusBar.indexOf('\n}\n', statusBar.indexOf('function _idleScopeLabel(')));
    assert.ok(/Remote · \$\$\{_podCost\.toFixed\(2\)\}/.test(label), 'idle label no longer shows the spend');
    assert.ok(/_podCost === null \? 'Remote'/.test(label), 'no cost data must still read plain Remote');
});
