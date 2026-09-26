'use strict';

/**
 * MPI-935 — Node processes trust the OS certificate store, so antivirus HTTPS scanning
 * (a root installed only in the Windows store) stops failing every download.
 *
 * Runs in a child with NODE_USE_SYSTEM_CA stripped: a shell that sets it already trusts
 * the store, and the "before" half would pass for the wrong reason.
 */

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const PROBE = `
const tls = require('tls');
const { X509Certificate } = require('crypto');
// By fingerprint: the store re-encodes a PEM it already holds, so strings don't compare.
const ids = pems => new Set(pems.map(p => new X509Certificate(p).fingerprint256));
const has = (set, sub) => [...sub].every(id => set.has(id));
const system = ids(tls.getCACertificates('system'));
const before = ids(tls.getCACertificates('default'));
require(${JSON.stringify(path.join(__dirname, '..', 'routes', 'systemCa.js'))}).trustSystemCa();
const after = ids(tls.getCACertificates('default'));
console.log(JSON.stringify({
  system: system.size,
  beforeHasSystem: has(before, system),
  afterHasSystem: has(after, system),
  afterHasBefore: has(after, before),
}));
`;

test('trustSystemCa adds every system cert and keeps every default one', () => {
    const env = { ...process.env };
    delete env.NODE_USE_SYSTEM_CA;
    delete env.NODE_OPTIONS;
    const r = spawnSync(process.execPath, ['-e', PROBE], { env, encoding: 'utf8' });
    assert.strictEqual(r.status, 0, r.stderr);
    const out = JSON.parse(r.stdout);
    assert.ok(out.system > 0, 'the OS store returned no certificates');
    assert.strictEqual(out.beforeHasSystem, false, 'Node already trusted the system store — probe is vacuous');
    assert.strictEqual(out.afterHasSystem, true);
    assert.strictEqual(out.afterHasBefore, true);
});
