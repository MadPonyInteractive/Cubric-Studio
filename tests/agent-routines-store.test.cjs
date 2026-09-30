'use strict';
/**
 * tests/agent-routines-store.test.cjs — the agent's saved operation chains (MPI-970).
 *
 * The store (services/agentRoutines.mjs) against real temp folders: one set of routines
 * for every project, in app data. Each test gets its own APP_USER_DATA, exactly as
 * agent-memory.test.cjs isolates the global dir.
 *
 * Run: node --test tests/agent-routines-store.test.cjs
 */

const { test, describe, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { scratchDirSync } = require('./helpers/scratch.cjs');

const rtn = () => import('../services/agentRoutines.mjs');

const made = [];
const prevUserData = process.env.APP_USER_DATA;
after(() => {
    made.forEach((d) => fs.rmSync(d, { recursive: true, force: true }));
    if (prevUserData === undefined) delete process.env.APP_USER_DATA;
    else process.env.APP_USER_DATA = prevUserData;
});

// A fresh app data folder per test; the routines folder inside it.
let dir;
beforeEach(() => {
    process.env.APP_USER_DATA = scratchDirSync('agent-routines-');
    made.push(process.env.APP_USER_DATA);
    dir = path.join(process.env.APP_USER_DATA, 'agent', 'routines');
});

function makeRoutine(name, overrides = {}) {
    return {
        schema: 'cubric/routine/v1',
        name,
        summary: `Summary for ${name}`,
        steps: [{ op: 'upscale' }, { op: 'detail-face' }],
        created_at: '2026-09-30T00:00:00.000Z',
        ...overrides,
    };
}

async function rejectsWith(promise, code) {
    await assert.rejects(promise, (err) => {
        assert.equal(err.code, code, `expected ${code}, got ${err.code}: ${err.message}`);
        return true;
    });
}

describe('store — one set of routines, in app data', () => {
    test('no routines yet lists none', async () => {
        const r = await rtn();
        assert.deepEqual(await r.listRoutines(), { routines: [] });
    });

    test('writing a routine creates the folder and the file in app data', async () => {
        const r = await rtn();
        const w = await r.writeRoutine(makeRoutine('upscale-detail'));
        assert.deepEqual(w, { name: 'upscale-detail', created: true });

        const filePath = path.join(dir, 'upscale-detail.json');
        assert.ok(fs.existsSync(filePath), 'file was created');
        const on_disk = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        assert.equal(on_disk.name, 'upscale-detail');
        assert.equal(on_disk.schema, 'cubric/routine/v1');
    });

    test('listRoutines returns name, summary and step count', async () => {
        const r = await rtn();
        await r.writeRoutine(makeRoutine('alpha'));
        const look = [{ id: 'look', kind: 'image', label: 'the style picture' }];
        await r.writeRoutine(makeRoutine('beta', { summary: 'Beta routine', inputs: look, steps: [{ op: 'a' }, { op: 'b' }, { op: 'c' }] }));

        const { routines } = await r.listRoutines();
        assert.equal(routines.length, 2);
        const names = routines.map((r) => r.name).sort();
        assert.deepEqual(names, ['alpha', 'beta']);
        const beta = routines.find((r) => r.name === 'beta');
        assert.equal(beta.summary, 'Beta routine');
        assert.equal(beta.steps, 3);
        assert.deepEqual(beta.inputs, look, 'the run inputs it needs (D9)');
        assert.deepEqual(routines.find((r) => r.name === 'alpha').inputs, []);
    });

    test('readRoutine returns the parsed object', async () => {
        const r = await rtn();
        const routine = makeRoutine('my-chain');
        await r.writeRoutine(routine);
        const result = await r.readRoutine('my-chain');
        assert.equal(result.name, 'my-chain');
        assert.deepEqual(result.routine.steps, routine.steps);
    });

    test('overwriting a routine replaces the file and returns created:false', async () => {
        const r = await rtn();
        await r.writeRoutine(makeRoutine('chain'));
        const updated = makeRoutine('chain', { summary: 'Updated summary', steps: [{ op: 'a' }] });
        const w = await r.writeRoutine(updated);
        assert.equal(w.created, false);
        const result = await r.readRoutine('chain');
        assert.equal(result.routine.summary, 'Updated summary');
        assert.equal(result.routine.steps.length, 1);
    });

    test('deleteRoutine moves the file to deleted/, not erased', async () => {
        const r = await rtn();
        await r.writeRoutine(makeRoutine('vanish'));
        const d = await r.deleteRoutine('vanish');
        assert.deepEqual(d, { name: 'vanish', deleted: true });

        assert.ok(!fs.existsSync(path.join(dir, 'vanish.json')), 'live file is gone');
        assert.ok(fs.existsSync(path.join(dir, 'deleted', 'vanish.json')), 'file moved to deleted/');

        const { routines } = await r.listRoutines();
        assert.equal(routines.length, 0, 'deleted/ files do not appear in the list');
    });

    test('renameRoutine renames in place: one copy, steps kept, a taken name refused', async () => {
        const r = await rtn();
        await r.writeRoutine(makeRoutine('crop-to-916-and-upscale-2x'));
        await r.writeRoutine(makeRoutine('taken'));
        assert.deepEqual(await r.renameRoutine('crop-to-916-and-upscale-2x', '9-16-crop-and-upscale'),
            { name: '9-16-crop-and-upscale', renamed: 'crop-to-916-and-upscale-2x' });

        const { routines } = await r.listRoutines();
        assert.deepEqual(routines.map((x) => x.name).sort(), ['9-16-crop-and-upscale', 'taken'], 'no copy left under the old name');
        const { routine } = await r.readRoutine('9-16-crop-and-upscale');
        assert.equal(routine.name, '9-16-crop-and-upscale', 'the name inside the file follows');
        assert.deepEqual(routine.steps, makeRoutine('x').steps);

        await assert.rejects(r.renameRoutine('9-16-crop-and-upscale', 'taken'), { code: 'NAME_TAKEN' });
        await assert.rejects(r.renameRoutine('nope', 'fresh'), { code: 'ROUTINE_NOT_FOUND' });
        await assert.rejects(r.renameRoutine('taken', 'Bad Name'), { code: 'INVALID_NAME' });
        assert.equal((await r.readRoutine('taken')).routine.summary, 'Summary for taken', 'a refused rename changes nothing');
    });

    test('a second delete of the same name keeps both copies in deleted/', async () => {
        const r = await rtn();
        await r.writeRoutine(makeRoutine('reused', { summary: 'first' }));
        await r.deleteRoutine('reused');
        await r.writeRoutine(makeRoutine('reused', { summary: 'second' }));
        await r.deleteRoutine('reused');

        const files = fs.readdirSync(path.join(dir, 'deleted')).filter((f) => f.startsWith('reused'));
        assert.equal(files.length, 2, `both copies kept; found: ${files.join(', ')}`);
    });

    test('deleted/ files do not count toward the 50-routine cap', async () => {
        const r = await rtn();
        // Write and delete one so it lands in deleted/
        await r.writeRoutine(makeRoutine('gone'));
        await r.deleteRoutine('gone');
        // Fill to exactly MAX_ROUTINES
        for (let i = 0; i < r.MAX_ROUTINES; i++) {
            await r.writeRoutine(makeRoutine(`n${i}`));
        }
        // One more new name must fail
        await rejectsWith(r.writeRoutine(makeRoutine('one-more')), 'ROUTINES_FULL');
        // Overwriting an existing name at the cap is fine
        const w = await r.writeRoutine(makeRoutine('n7', { summary: 'updated' }));
        assert.equal(w.created, false, 'overwrite at cap succeeds');
        assert.equal((await r.listRoutines()).routines.length, r.MAX_ROUTINES);
    });

    test('bad slug names are refused with INVALID_NAME (no silent slugifying)', async () => {
        const r = await rtn();
        for (const name of ['', 'Has-Caps', '../escape', 'a/b', 'a b', '-start', undefined]) {
            const routine = makeRoutine('placeholder');
            routine.name = name;
            await rejectsWith(r.writeRoutine(routine), 'INVALID_NAME');
            await rejectsWith(r.readRoutine(name), 'INVALID_NAME');
            await rejectsWith(r.deleteRoutine(name), 'INVALID_NAME');
        }
        assert.equal(fs.existsSync(dir), false, 'no refused write created the folder');
    });

    test('reading a missing routine is refused with ROUTINE_NOT_FOUND', async () => {
        const r = await rtn();
        await rejectsWith(r.readRoutine('no-such-routine'), 'ROUTINE_NOT_FOUND');
        await rejectsWith(r.deleteRoutine('no-such-routine'), 'ROUTINE_NOT_FOUND');
    });

    test('non-object or non-serialisable arguments are refused with BAD_REQUEST', async () => {
        const r = await rtn();
        await rejectsWith(r.writeRoutine(null), 'BAD_REQUEST');
        await rejectsWith(r.writeRoutine([]), 'BAD_REQUEST');
        // A valid slug name but the routine object has no `name` field
        await rejectsWith(r.writeRoutine({ summary: 'no name' }), 'INVALID_NAME');
    });
});
