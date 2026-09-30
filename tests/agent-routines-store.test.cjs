'use strict';
/**
 * tests/agent-routines-store.test.cjs — the agent's saved operation chains (MPI-970).
 *
 * The store (services/agentRoutines.mjs) against real temp folders; isolated from
 * APP_USER_DATA exactly as agent-memory.test.cjs isolates the global dir.
 *
 * Run: node --test tests/agent-routines-store.test.cjs
 */

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { scratchDirSync } = require('./helpers/scratch.cjs');

const rtn = () => import('../services/agentRoutines.mjs');

const made = [];
after(() => made.forEach((d) => fs.rmSync(d, { recursive: true, force: true })));

function tempDir(prefix) {
    const dir = scratchDirSync(prefix);
    made.push(dir);
    return dir;
}

function makeProject() {
    const dir = tempDir('agent-routines-');
    fs.writeFileSync(path.join(dir, 'project.json'), '{}');
    return dir;
}

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

describe('store — project scope', () => {
    test('a project with no routines lists none', async () => {
        const r = await rtn();
        const p = makeProject();
        assert.deepEqual(await r.listRoutines(p), { routines: [] });
    });

    test('writing a routine creates the folder and the file', async () => {
        const r = await rtn();
        const p = makeProject();
        const routine = makeRoutine('upscale-detail');
        const w = await r.writeRoutine(p, routine);
        assert.deepEqual(w, { name: 'upscale-detail', created: true });

        const filePath = path.join(p, 'Agent', 'routines', 'upscale-detail.json');
        assert.ok(fs.existsSync(filePath), 'file was created');
        const on_disk = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        assert.equal(on_disk.name, 'upscale-detail');
        assert.equal(on_disk.schema, 'cubric/routine/v1');
    });

    test('listRoutines returns name, summary and step count', async () => {
        const r = await rtn();
        const p = makeProject();
        await r.writeRoutine(p, makeRoutine('alpha'));
        await r.writeRoutine(p, makeRoutine('beta', { summary: 'Beta routine', steps: [{ op: 'a' }, { op: 'b' }, { op: 'c' }] }));

        const { routines } = await r.listRoutines(p);
        assert.equal(routines.length, 2);
        const names = routines.map((r) => r.name).sort();
        assert.deepEqual(names, ['alpha', 'beta']);
        const beta = routines.find((r) => r.name === 'beta');
        assert.equal(beta.summary, 'Beta routine');
        assert.equal(beta.steps, 3);
    });

    test('readRoutine returns the parsed object', async () => {
        const r = await rtn();
        const p = makeProject();
        const routine = makeRoutine('my-chain');
        await r.writeRoutine(p, routine);
        const result = await r.readRoutine(p, 'my-chain');
        assert.equal(result.name, 'my-chain');
        assert.deepEqual(result.routine.steps, routine.steps);
    });

    test('overwriting a routine replaces the file and returns created:false', async () => {
        const r = await rtn();
        const p = makeProject();
        await r.writeRoutine(p, makeRoutine('chain'));
        const updated = makeRoutine('chain', { summary: 'Updated summary', steps: [{ op: 'a' }] });
        const w = await r.writeRoutine(p, updated);
        assert.equal(w.created, false);
        const result = await r.readRoutine(p, 'chain');
        assert.equal(result.routine.summary, 'Updated summary');
        assert.equal(result.routine.steps.length, 1);
    });

    test('deleteRoutine moves the file to deleted/, not erased', async () => {
        const r = await rtn();
        const p = makeProject();
        await r.writeRoutine(p, makeRoutine('vanish'));
        const d = await r.deleteRoutine(p, 'vanish');
        assert.deepEqual(d, { name: 'vanish', deleted: true });

        const live = path.join(p, 'Agent', 'routines', 'vanish.json');
        const deleted = path.join(p, 'Agent', 'routines', 'deleted', 'vanish.json');
        assert.ok(!fs.existsSync(live), 'live file is gone');
        assert.ok(fs.existsSync(deleted), 'file moved to deleted/');

        const { routines } = await r.listRoutines(p);
        assert.equal(routines.length, 0, 'deleted/ files do not appear in the list');
    });

    test('a second delete of the same name keeps both copies in deleted/', async () => {
        const r = await rtn();
        const p = makeProject();

        // First save + delete
        await r.writeRoutine(p, makeRoutine('reused', { summary: 'first' }));
        await r.deleteRoutine(p, 'reused');

        // Second save + delete (different content)
        await r.writeRoutine(p, makeRoutine('reused', { summary: 'second' }));
        await r.deleteRoutine(p, 'reused');

        const deletedDir = path.join(p, 'Agent', 'routines', 'deleted');
        const files = fs.readdirSync(deletedDir).filter((f) => f.startsWith('reused'));
        assert.equal(files.length, 2, `both copies kept; found: ${files.join(', ')}`);
    });

    test('deleted/ files do not count toward the 50-routine cap', async () => {
        const r = await rtn();
        const p = makeProject();
        // Write and delete one so it lands in deleted/
        await r.writeRoutine(p, makeRoutine('gone'));
        await r.deleteRoutine(p, 'gone');
        // Fill to exactly MAX_ROUTINES
        for (let i = 0; i < r.MAX_ROUTINES; i++) {
            await r.writeRoutine(p, makeRoutine(`n${i}`));
        }
        // One more new name must fail
        await rejectsWith(r.writeRoutine(p, makeRoutine('one-more')), 'ROUTINES_FULL');
        // Overwriting an existing name at the cap is fine
        const w = await r.writeRoutine(p, makeRoutine('n7', { summary: 'updated' }));
        assert.equal(w.created, false, 'overwrite at cap succeeds');
        assert.equal((await r.listRoutines(p)).routines.length, r.MAX_ROUTINES);
    });

    test('bad slug names are refused with INVALID_NAME (no silent slugifying)', async () => {
        const r = await rtn();
        const p = makeProject();
        for (const name of ['', 'Has-Caps', '../escape', 'a/b', 'a b', '-start', undefined]) {
            const routine = makeRoutine('placeholder');
            routine.name = name;
            await rejectsWith(r.writeRoutine(p, routine), 'INVALID_NAME');
            await rejectsWith(r.readRoutine(p, name), 'INVALID_NAME');
            await rejectsWith(r.deleteRoutine(p, name), 'INVALID_NAME');
        }
        // Nothing was created
        assert.equal(fs.existsSync(path.join(p, 'Agent', 'routines')), false,
            'no refused write created the folder');
    });

    test('non-project folder is refused with NOT_A_PROJECT', async () => {
        const r = await rtn();
        const bare = tempDir('agent-routines-bare-');
        await rejectsWith(r.listRoutines(bare), 'NOT_A_PROJECT');
        await rejectsWith(r.writeRoutine(bare, makeRoutine('x')), 'NOT_A_PROJECT');
        await rejectsWith(r.listRoutines('relative/path'), 'BAD_REQUEST');
        await rejectsWith(r.listRoutines(undefined), 'BAD_REQUEST');
    });

    test('reading a missing routine is refused with ROUTINE_NOT_FOUND', async () => {
        const r = await rtn();
        const p = makeProject();
        await rejectsWith(r.readRoutine(p, 'no-such-routine'), 'ROUTINE_NOT_FOUND');
        await rejectsWith(r.deleteRoutine(p, 'no-such-routine'), 'ROUTINE_NOT_FOUND');
    });

    test('non-object or non-serialisable arguments are refused with BAD_REQUEST', async () => {
        const r = await rtn();
        const p = makeProject();
        await rejectsWith(r.writeRoutine(p, null), 'BAD_REQUEST');
        await rejectsWith(r.writeRoutine(p, []), 'BAD_REQUEST');
        // A valid slug name but the routine object has no `name` field
        await rejectsWith(r.writeRoutine(p, { summary: 'no name' }), 'INVALID_NAME');
    });
});

describe('store — global scope', () => {
    test('global routines live in app data, apart from every project', async () => {
        const r = await rtn();
        const prev = process.env.APP_USER_DATA;
        process.env.APP_USER_DATA = tempDir('agent-routines-global-');
        try {
            assert.deepEqual(await r.listGlobalRoutines(), { routines: [] });

            const w = await r.writeGlobalRoutine(makeRoutine('house-style', { summary: 'Global style chain' }));
            assert.deepEqual(w, { name: 'house-style', created: true });

            const dir = path.join(process.env.APP_USER_DATA, 'agent', 'routines');
            assert.ok(fs.existsSync(path.join(dir, 'house-style.json')));

            const { routines } = await r.listGlobalRoutines();
            assert.equal(routines.length, 1);
            assert.equal(routines[0].name, 'house-style');
            assert.equal(routines[0].summary, 'Global style chain');
            assert.equal(routines[0].steps, 2);

            const result = await r.readGlobalRoutine('house-style');
            assert.equal(result.name, 'house-style');

            // A project's routines and the global ones never mix.
            const p = makeProject();
            assert.deepEqual(await r.listRoutines(p), { routines: [] });

            // Delete global routine
            const del = await r.deleteGlobalRoutine('house-style');
            assert.deepEqual(del, { name: 'house-style', deleted: true });
            assert.deepEqual(await r.listGlobalRoutines(), { routines: [] });
            assert.ok(fs.existsSync(path.join(dir, 'deleted', 'house-style.json')));
        } finally {
            if (prev === undefined) delete process.env.APP_USER_DATA;
            else process.env.APP_USER_DATA = prev;
        }
    });

    test('global scope respects the 50-routine cap and allows overwrite at cap', async () => {
        const r = await rtn();
        const prev = process.env.APP_USER_DATA;
        process.env.APP_USER_DATA = tempDir('agent-routines-global-cap-');
        try {
            for (let i = 0; i < r.MAX_ROUTINES; i++) {
                await r.writeGlobalRoutine(makeRoutine(`g${i}`));
            }
            await rejectsWith(r.writeGlobalRoutine(makeRoutine('overflow')), 'ROUTINES_FULL');
            const w = await r.writeGlobalRoutine(makeRoutine('g5', { summary: 'overwrite' }));
            assert.equal(w.created, false);
        } finally {
            if (prev === undefined) delete process.env.APP_USER_DATA;
            else process.env.APP_USER_DATA = prev;
        }
    });
});
