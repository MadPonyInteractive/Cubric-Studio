'use strict';

/**
 * MPI-1206 — two engine starts at once must not both run.
 *
 * `/comfy/start` keeps the engine down through the curated pip pass and marks it running
 * only at the spawn, so a second call during that pass used to start a second pip on the
 * same site-packages. On the 2.1.1 update test one of them died on WinError 32 and left
 * the engine reading "degraded" until a restart.
 */

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'mpi1206-'));
process.env.APP_USER_DATA = TMP;
process.env.CUBRIC_ENGINE_ROOT = TMP;

const { oneStartAtATime } = require('../routes/comfy');

test('a start called while another is in flight waits for it, never overlaps', async () => {
    let running = 0;
    let peak = 0;
    const order = [];
    const start = (name) => async () => {
        running++;
        peak = Math.max(peak, running);
        order.push(`${name}:in`);
        await new Promise((r) => setTimeout(r, 30));   // the pip pass
        order.push(`${name}:out`);
        running--;
        return name;
    };

    const results = await Promise.all([
        oneStartAtATime(start('a')),
        oneStartAtATime(start('b')),
        oneStartAtATime(start('c')),
    ]);

    assert.equal(peak, 1, `starts overlapped: ${order.join(' ')}`);
    assert.deepEqual(results, ['a', 'b', 'c']);
    assert.deepEqual(order, ['a:in', 'a:out', 'b:in', 'b:out', 'c:in', 'c:out']);
});

test('the route goes through the guard', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'routes', 'comfy.js'), 'utf8');
    assert.match(src, /router\.post\('\/comfy\/start', \(req, res\) => _oneStartAtATime\(/,
        '/comfy/start must run its body through _oneStartAtATime');
});
