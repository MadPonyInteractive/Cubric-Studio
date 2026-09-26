'use strict';
/**
 * tests/agent-memory.test.cjs — the agent's per-project notes (MPI-774 Phase 3b, item 5).
 *
 * The store (services/agentMemory.mjs) against real temp project folders, then the three
 * connector routes on an ephemeral port. The loop side lives in agent-loop.test.cjs (h).
 *
 * Run: node --test tests/agent-memory.test.cjs
 */

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { scratchDirSync } = require('./helpers/scratch.cjs');
const path = require('node:path');

const mem = () => import('../services/agentMemory.mjs');

const made = [];
after(() => made.forEach((d) => fs.rmSync(d, { recursive: true, force: true })));

function tempDir(prefix) {
    const dir = scratchDirSync(prefix);
    made.push(dir);
    return dir;
}

function makeProject() {
    const dir = tempDir('agent-memory-');
    fs.writeFileSync(path.join(dir, 'project.json'), '{}');
    return dir;
}

async function rejectsWith(promise, code) {
    await assert.rejects(promise, (err) => {
        assert.equal(err.code, code, `expected ${code}, got ${err.code}: ${err.message}`);
        return true;
    });
}

describe('store', () => {
    test('a project with no notes lists none, and writing one creates the folder, the note and the index', async () => {
        const m = await mem();
        const p = makeProject();
        assert.deepEqual(await m.readIndex(p), { notes: [] });

        const w = await m.writeNote(p, { file: 'mira.md', title: 'Mira, the courier', hook: 'the main character', text: 'Red hair, yellow raincoat.' });
        assert.deepEqual(w, { file: 'mira.md', created: true });
        assert.equal(fs.readFileSync(path.join(p, 'Agent', 'mira.md'), 'utf8'), 'Red hair, yellow raincoat.\n');

        const index = fs.readFileSync(path.join(p, 'Agent', 'README.md'), 'utf8');
        assert.match(index, /^# Agent notes\n/);
        assert.match(index, /\n\n- \[Mira, the courier\]\(mira\.md\): the main character\n$/, 'the first note sits under a blank line');
        assert.deepEqual((await m.readIndex(p)).notes, [{ title: 'Mira, the courier', file: 'mira.md', hook: 'the main character' }]);
        assert.deepEqual(await m.readNote(p, 'mira.md'), { file: 'mira.md', text: 'Red hair, yellow raincoat.\n' });
    });

    test('writing the same file replaces the note and its line, and keeps every other line', async () => {
        const m = await mem();
        const p = makeProject();
        await m.writeNote(p, { file: 'ratio.md', title: 'Ratio', text: '16:9' });
        await m.writeNote(p, { file: 'style.md', title: 'Style', text: 'Moody' });
        const indexPath = path.join(p, 'Agent', 'README.md');
        fs.appendFileSync(indexPath, 'A line the user wrote.\n');

        const w = await m.writeNote(p, { file: 'ratio.md', title: 'Ratio for YouTube', hook: 'every image', text: '16:9 always' });
        assert.equal(w.created, false);
        const index = fs.readFileSync(indexPath, 'utf8');
        assert.match(index, /- \[Ratio for YouTube\]\(ratio\.md\): every image\n- \[Style\]\(style\.md\)\n/);
        assert.match(index, /A line the user wrote\./);
        assert.equal((await m.readIndex(p)).notes.length, 2);
        assert.equal((await m.readNote(p, 'ratio.md')).text, '16:9 always\n');
    });

    test('a title and hook stay on one line, and brackets cannot break the index', async () => {
        const m = await mem();
        const p = makeProject();
        await m.writeNote(p, { file: 'odd.md', title: 'Two\nlines [and] brackets', hook: 'a\n  b', text: 'x' });
        assert.deepEqual((await m.readIndex(p)).notes, [{ title: 'Two lines and brackets', file: 'odd.md', hook: 'a b' }]);
    });

    test('a note name can never leave the notes folder', async () => {
        const m = await mem();
        const p = makeProject();
        for (const file of ['../escape.md', 'a/b.md', 'a\\b.md', 'README.md', 'readme.md', 'Upper.md', 'note.txt', '.md', '', undefined]) {
            await rejectsWith(m.writeNote(p, { file, title: 't', text: 'x' }), 'BAD_REQUEST');
            await rejectsWith(m.readNote(p, file), 'BAD_REQUEST');
        }
        assert.equal(fs.existsSync(path.join(p, 'escape.md')), false);
        assert.equal(fs.existsSync(path.join(p, 'Agent')), false, 'no refused write created the folder');
    });

    test('only a real project folder holds notes', async () => {
        const m = await mem();
        const bare = tempDir('agent-memory-bare-');
        await rejectsWith(m.readIndex(bare), 'NOT_A_PROJECT');
        await rejectsWith(m.writeNote(bare, { file: 'a.md', title: 't', text: 'x' }), 'NOT_A_PROJECT');
        await rejectsWith(m.readIndex('relative/folder'), 'BAD_REQUEST');
        await rejectsWith(m.readIndex(undefined), 'BAD_REQUEST');
    });

    test('the caps: a long note, a full index, a missing note, empty fields', async () => {
        const m = await mem();
        const p = makeProject();
        await rejectsWith(m.writeNote(p, { file: 'big.md', title: 't', text: 'x'.repeat(m.MAX_NOTE_BYTES + 1) }), 'NOTE_TOO_LONG');
        await rejectsWith(m.writeNote(p, { file: 'a.md', title: '', text: 'x' }), 'BAD_REQUEST');
        await rejectsWith(m.writeNote(p, { file: 'a.md', title: 't'.repeat(81), text: 'x' }), 'BAD_REQUEST');
        await rejectsWith(m.writeNote(p, { file: 'a.md', title: 't', hook: 'h'.repeat(161), text: 'x' }), 'BAD_REQUEST');
        await rejectsWith(m.writeNote(p, { file: 'a.md', title: 't', text: '   ' }), 'BAD_REQUEST');
        await rejectsWith(m.readNote(p, 'missing.md'), 'UNKNOWN_NOTE');

        for (let i = 0; i < m.MAX_NOTES; i++) await m.writeNote(p, { file: `n${i}.md`, title: `Note ${i}`, text: 'x' });
        await rejectsWith(m.writeNote(p, { file: 'one-more.md', title: 'Too many', text: 'x' }), 'MEMORY_FULL');
        const again = await m.writeNote(p, { file: 'n7.md', title: 'Note 7, updated', text: 'y' });
        assert.equal(again.created, false, 'a full project still takes an update');
        assert.equal((await m.readIndex(p)).notes.length, m.MAX_NOTES);
    });

    // MPI-774 Phase 6 (Fabio, 2026-09-18; built 2026-09-26): notes that hold across every
    // project live in app data, beside the attachments, so no one project owns them. Same
    // shape as a project's: a README index of pointer lines, one note a file, same caps.
    test('global notes live in app data, apart from every project, in the same README shape', async () => {
        const m = await mem();
        const prev = process.env.APP_USER_DATA;
        process.env.APP_USER_DATA = tempDir('agent-global-');
        try {
            assert.deepEqual(await m.readGlobalIndex(), { notes: [] }, 'nothing before the first note');
            const w = await m.writeGlobalNote({ file: 'house-style.md', title: 'House style', hook: 'every image', text: 'Warm light, 35mm.' });
            assert.deepEqual(w, { file: 'house-style.md', created: true });

            const dir = path.join(process.env.APP_USER_DATA, 'agent', 'memory');
            assert.equal(fs.readFileSync(path.join(dir, 'house-style.md'), 'utf8'), 'Warm light, 35mm.\n');
            assert.match(fs.readFileSync(path.join(dir, 'README.md'), 'utf8'), /^- \[House style\]\(house-style\.md\): every image$/m);
            assert.deepEqual((await m.readGlobalIndex()).notes, [{ title: 'House style', file: 'house-style.md', hook: 'every image' }]);
            assert.equal((await m.readGlobalNote('house-style.md')).text, 'Warm light, 35mm.\n');

            // A project's notes and the global ones never mix.
            const p = makeProject();
            assert.deepEqual(await m.readIndex(p), { notes: [] });
            await rejectsWith(m.readGlobalNote('../project.json'), 'BAD_REQUEST');
            await rejectsWith(m.writeGlobalNote({ file: 'big.md', title: 't', text: 'x'.repeat(m.MAX_NOTE_BYTES + 1) }), 'NOTE_TOO_LONG');
        } finally {
            if (prev === undefined) delete process.env.APP_USER_DATA; else process.env.APP_USER_DATA = prev;
        }
    });
});

describe('connector routes', () => {
    let server;
    let base;
    before(async () => {
        const express = require('express');
        const app = express();
        app.use(express.json());
        app.use(require('../routes/connector'));
        await new Promise((resolve) => { server = app.listen(0, '127.0.0.1', resolve); });
        base = `http://127.0.0.1:${server.address().port}`;
    });
    after(() => server && server.close());

    const q = (p) => `?folderPath=${encodeURIComponent(p)}`;

    test('write, list and read a note', async () => {
        const p = makeProject();
        const w = await fetch(`${base}/connector/memory`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ folderPath: p, file: 'goal.md', title: 'The goal', text: 'A trailer.' }),
        }).then((r) => r.json());
        assert.deepEqual(w, { ok: true, file: 'goal.md', created: true });

        const list = await fetch(`${base}/connector/memory${q(p)}`).then((r) => r.json());
        assert.deepEqual(list, { ok: true, notes: [{ title: 'The goal', file: 'goal.md', hook: '' }] });

        const one = await fetch(`${base}/connector/memory/goal.md${q(p)}`).then((r) => r.json());
        assert.deepEqual(one, { ok: true, file: 'goal.md', text: 'A trailer.\n' });
    });

    test('errors use the connector envelope: 400 for a malformed request, 200 for a named miss', async () => {
        const p = makeProject();
        const noPath = await fetch(`${base}/connector/memory`);
        assert.equal(noPath.status, 400);
        assert.equal((await noPath.json()).error.code, 'BAD_REQUEST');

        const badFile = await fetch(`${base}/connector/memory/..%2Fproject.json${q(p)}`);
        assert.equal(badFile.status, 400);

        const miss = await fetch(`${base}/connector/memory/nope.md${q(p)}`);
        assert.equal(miss.status, 200);
        assert.deepEqual((await miss.json()).error.code, 'UNKNOWN_NOTE');
    });

    test('scope=global reads and writes the global notes, and needs no project', async () => {
        const prev = process.env.APP_USER_DATA;
        process.env.APP_USER_DATA = tempDir('agent-global-route-');
        try {
            const w = await fetch(`${base}/connector/memory`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ scope: 'global', file: 'voice.md', title: 'Voice', text: 'Short replies.' }),
            }).then((r) => r.json());
            assert.deepEqual(w, { ok: true, file: 'voice.md', created: true });
            const list = await fetch(`${base}/connector/memory?scope=global`).then((r) => r.json());
            assert.deepEqual(list, { ok: true, notes: [{ title: 'Voice', file: 'voice.md', hook: '' }] });
            const one = await fetch(`${base}/connector/memory/voice.md?scope=global`).then((r) => r.json());
            assert.deepEqual(one, { ok: true, file: 'voice.md', text: 'Short replies.\n' });
        } finally {
            if (prev === undefined) delete process.env.APP_USER_DATA; else process.env.APP_USER_DATA = prev;
        }
    });

    test('there is no delete route for notes', async () => {
        const p = makeProject();
        const r = await fetch(`${base}/connector/memory/goal.md${q(p)}`, { method: 'DELETE' });
        assert.equal(r.status, 404);
    });
});
