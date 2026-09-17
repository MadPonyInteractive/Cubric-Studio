'use strict';

/**
 * MPI-792 — the install screen must keep moving. `elapsedTicker` is the part of it that
 * runs without a DOM: a clock that always ticks, and hints that appear only after a
 * quiet stretch and rotate while it lasts. A `touch()` (any install event) clears them.
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

// Throwaway engine root before any route loads (docs/testing-harnesses.md § 2).
const SCRATCH = fs.mkdtempSync(path.join(os.tmpdir(), 'mpi792-'));
process.env.CUBRIC_ENGINE_ROOT = path.join(SCRATCH, 'engine');
test.after(() => fs.rmSync(SCRATCH, { recursive: true, force: true }));

let formatClock;
let startElapsedTicker;

test.before(async () => {
    const url = pathToFileURL(path.join(__dirname, '..', 'js', 'utils', 'elapsedTicker.js'));
    ({ formatClock, startElapsedTicker } = await import(url.href));
});

test('formatClock: m:ss under an hour, h:mm:ss over it, never negative', () => {
    assert.strictEqual(formatClock(0), '0:00');
    assert.strictEqual(formatClock(75_000), '1:15');
    assert.strictEqual(formatClock(59_999), '0:59');
    assert.strictEqual(formatClock(3_725_000), '1:02:05');
    assert.strictEqual(formatClock(-5), '0:00');
});

test('ticker: paints at once, every second, hints only after the quiet window, rotating', (t) => {
    t.mock.timers.enable({ apis: ['setInterval', 'Date'], now: 0 });
    const ticks = [];
    const ticker = startElapsedTicker((elapsed, hint) => ticks.push([elapsed, hint]),
        { hints: ['A', 'B'], quietAfterMs: 15_000, rotateMs: 8_000 });

    assert.deepStrictEqual(ticks.at(-1), ['0:00', null], 'first paint is immediate');

    t.mock.timers.tick(14_000);
    assert.deepStrictEqual(ticks.at(-1), ['0:14', null], 'no hint inside the quiet window');
    assert.strictEqual(ticks.length, 15, 'one paint per second');

    t.mock.timers.tick(1_000);
    assert.deepStrictEqual(ticks.at(-1), ['0:15', 'A'], 'first hint at exactly the window');

    t.mock.timers.tick(8_000);
    assert.deepStrictEqual(ticks.at(-1), ['0:23', 'B'], 'rotates after rotateMs');

    t.mock.timers.tick(8_000);
    assert.deepStrictEqual(ticks.at(-1), ['0:31', 'A'], 'wraps around');

    ticker.touch();
    t.mock.timers.tick(1_000);
    assert.deepStrictEqual(ticks.at(-1), ['0:32', null], 'activity clears the hint, the clock keeps counting');

    ticker.stop();
    const n = ticks.length;
    t.mock.timers.tick(5_000);
    assert.strictEqual(ticks.length, n, 'stop() ends the painting');
});

test('ticker: no hints configured means never a hint', (t) => {
    t.mock.timers.enable({ apis: ['setInterval', 'Date'], now: 0 });
    let last;
    const ticker = startElapsedTicker((elapsed, hint) => { last = hint; });
    t.mock.timers.tick(120_000);
    assert.strictEqual(last, null);
    ticker.stop();
});

// ── The quit guard sees the whole engine job ────────────────────────────────
// Users closed an install that looked stuck. The guard only knew about the engine
// ARCHIVE download, so every later step (unpack, uv install, nodes, repair, upgrade,
// the first-start pip pass) closed without a word.

const { beginEngineJob, engineJobRunning } = require('../routes/engineJobs');
const { quitWarning } = require('../main/quitWarning.cjs');

test('engine jobs: counted, nested, and ending twice ends once', () => {
    assert.strictEqual(engineJobRunning(), false);
    const endOuter = beginEngineJob();
    const endInner = beginEngineJob(); // repair-deps can run a full install inside itself
    endInner();
    endInner();
    assert.strictEqual(engineJobRunning(), true, 'the outer job is still running');
    endOuter();
    assert.strictEqual(engineJobRunning(), false);
});

test('GET /comfy/downloads/active reports a running engine job with no download at all', async () => {
    const express = require('express');
    const { router } = require('../routes/downloadManager');
    const app = express();
    app.use(router);
    const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
    const active = async () => (await fetch(`http://127.0.0.1:${server.address().port}/comfy/downloads/active`)).json();
    try {
        assert.strictEqual((await active()).engine, false);
        const end = beginEngineJob();
        assert.strictEqual((await active()).engine, true, 'an unpack or a pip pass must still warn');
        end();
        assert.strictEqual((await active()).engine, false);
    } finally {
        await new Promise((resolve) => server.close(resolve));
    }
});

test('every engine job route and the first-start pip pass hold a job', () => {
    const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
    const engine = read('routes/engine.js');
    for (const route of ['/engine/download', '/engine/repair-deps', '/engine/upgrade']) {
        const at = engine.indexOf(`router.post('${route}'`);
        assert.notStrictEqual(at, -1, route);
        const body = engine.slice(at, engine.indexOf('\n});', at));
        assert.match(body, /beginEngineJob\(\)/, `${route} does not hold an engine job`);
        assert.match(body, /endJob\)|endJob\(\)/, `${route} never ends its engine job`);
    }
    assert.match(read('routes/comfy.js'),
        /beginEngineJob\(\);\s*try \{\s*await ensureCuratedPythonDeps\(\);[\s\S]{0,300}finally \{\s*endJob\(\);/);
});

test('quit warning: nothing running, downloads only, and an engine job', () => {
    assert.strictEqual(quitWarning(null), null, 'server unreachable: no dialog');
    assert.strictEqual(quitWarning({ models: [], engine: false }), null);

    const dl = quitWarning({ models: [{}, {}], engine: false });
    assert.strictEqual(dl.title, 'Downloads are still running');
    assert.match(dl.detail, /^2 model downloads will resume/);

    const eng = quitWarning({ models: [{}], engine: true });
    assert.strictEqual(eng.title, 'The engine is still installing');
    assert.deepStrictEqual(eng.buttons, ['Quit anyway', 'Keep installing'], 'button 1 is the default: stay');
    assert.match(eng.detail, /interrupts it/);
    assert.match(eng.detail, /1 model download will resume/);
});
