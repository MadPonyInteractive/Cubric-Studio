'use strict';

/**
 * MPI-1204 — two engine-tree jobs at once must not both run.
 *
 * `/engine/upgrade` answered "upgrade-started" and ran with no in-flight check. On the 2.1.1
 * update test a second POST 4 s after the app's own hit the first's git lock, fell back to the
 * full reinstall and deleted the portable the first was still using. Download, repair and
 * upgrade all rewrite the same tree, so they share one guard: a later call attaches.
 */

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'mpi1204-'));
process.env.APP_USER_DATA = TMP;
process.env.CUBRIC_ENGINE_ROOT = TMP;

const { oneEngineJob } = require('../routes/engine');

const fakeRes = () => ({ body: null, json(b) { this.body = b; } });

test('overlapping engine jobs run ONE; the later calls attach and start nothing', async () => {
    const runs = [];
    let release;
    const gate = new Promise((r) => { release = r; });
    const job = (name) => async () => { runs.push(name); await gate; };

    const resA = fakeRes(), resB = fakeRes(), resC = fakeRes();
    const a = oneEngineJob('upgrade', resA, job('a'));
    const b = oneEngineJob('upgrade', resB, job('b'));   // the second POST /engine/upgrade
    const c = oneEngineJob('repair', resC, job('c'));    // a repair while the upgrade runs
    release();
    await Promise.all([a, b, c]);

    assert.deepEqual(runs, ['a']);
    assert.deepEqual(resB.body, { success: true, status: 'already-running', running: 'upgrade' });
    assert.deepEqual(resC.body, { success: true, status: 'already-running', running: 'upgrade' });
    assert.equal(resA.body, null, 'the running job answers for itself');
});

test('the guard frees when a job ends, even by throwing', async () => {
    await assert.rejects(oneEngineJob('upgrade', fakeRes(), async () => { throw new Error('boom'); }));
    let ran = false;
    await oneEngineJob('upgrade', fakeRes(), async () => { ran = true; });
    assert.equal(ran, true);
});

test('every engine-tree route goes through the guard', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'routes', 'engine.js'), 'utf8');
    for (const [route, kind] of [['download', 'download'], ['repair-deps', 'repair'], ['upgrade', 'upgrade']]) {
        assert.match(src, new RegExp(`router\\.post\\('/engine/${route}', \\(req, res\\) => _oneEngineJob\\('${kind}', res, `),
            `/engine/${route} must run its body through _oneEngineJob`);
    }
});
