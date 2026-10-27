'use strict';

/**
 * MPI-1302 (AUDIT D10) — the one scratch sweep behind nine temp dirs.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const fs = require('fs-extra');
const { sweepOlderThan } = require('../services/scratchSweep');

const HOUR = 60 * 60 * 1000;

async function scratch() {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mpi1302-sweep-'));
    const old = (Date.now() - 2 * HOUR) / 1000;
    for (const f of ['old.png', 'fresh.png']) await fs.writeFile(path.join(dir, f), 'x');
    for (const d of ['oldRun', 'freshRun']) await fs.ensureDir(path.join(dir, d));
    await fs.utimes(path.join(dir, 'old.png'), old, old);
    await fs.utimes(path.join(dir, 'oldRun'), old, old);
    return dir;
}

const left = async dir => (await fs.readdir(dir)).sort();

test('either kind: removes old files and old dirs, keeps fresh ones', async () => {
    const dir = await scratch();
    await sweepOlderThan(dir, HOUR);
    assert.deepEqual(await left(dir), ['fresh.png', 'freshRun']);
    await fs.remove(dir);
});

test('only file: an old run dir survives', async () => {
    const dir = await scratch();
    await sweepOlderThan(dir, HOUR, { only: 'file' });
    assert.deepEqual(await left(dir), ['fresh.png', 'freshRun', 'oldRun']);
    await fs.remove(dir);
});

test('only dir: an old file survives', async () => {
    const dir = await scratch();
    await sweepOlderThan(dir, HOUR, { only: 'dir' });
    assert.deepEqual(await left(dir), ['fresh.png', 'freshRun', 'old.png']);
    await fs.remove(dir);
});

test('per-name age: null leaves a name alone, a longer keep spares it', async () => {
    const dir = await scratch();
    await sweepOlderThan(dir, name => (name === 'oldRun' ? null : name === 'old.png' ? 3 * HOUR : HOUR));
    assert.deepEqual(await left(dir), ['fresh.png', 'freshRun', 'old.png', 'oldRun']);
    await fs.remove(dir);
});

test('a missing dir is a no-op', async () => {
    await sweepOlderThan(path.join(os.tmpdir(), `mpi1302-sweep-missing-${process.pid}`), HOUR);
});
