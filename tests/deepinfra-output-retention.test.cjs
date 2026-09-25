'use strict';
// MPI-919: a paid cloud output survives until any save has long finished — the scratch
// sweep removes only files older than a day, never a fresh one.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { _sweepOutputs } = require('../routes/deepinfra.js');

test('sweep keeps a fresh output and removes a day-old one', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mpi919-sweep-'));
    const fresh = path.join(dir, 'fresh.jpg');
    const old = path.join(dir, 'old.jpg');
    fs.writeFileSync(fresh, 'x');
    fs.writeFileSync(old, 'x');
    const dayAgo = (Date.now() - 25 * 60 * 60 * 1000) / 1000;
    fs.utimesSync(old, dayAgo, dayAgo);

    await _sweepOutputs(dir);

    assert.ok(fs.existsSync(fresh), 'a fresh paid output must survive');
    assert.ok(!fs.existsSync(old), 'a day-old output is swept');
    fs.rmSync(dir, { recursive: true, force: true });
});

test('sweep of a missing dir is a no-op', async () => {
    await _sweepOutputs(path.join(os.tmpdir(), 'mpi919-sweep-missing-' + process.pid));
});
