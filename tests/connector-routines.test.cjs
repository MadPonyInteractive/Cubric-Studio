'use strict';

/**
 * MPI-970 W1 — `/connector/routines`: the store routes and the relay to the app.
 *
 * A real socket with a fake renderer on the SSE relay (as tests/connector-gif.test.cjs),
 * because a save and a run reach the RENDERER: a save is checked there (package Flows
 * exist only in its `FLOWS`) and stored as that check returns it, and a run carries the
 * routine AS STORED, so the assertions are on the jobs the app receives and on disk.
 * The runner itself is tests/routine-runner.test.cjs; this pins the wiring only.
 */

const assert = require('node:assert/strict');
const { test, after } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const { scratchDirSync } = require('./helpers/scratch.cjs');

const connectorRoutes = require('../routes/connector');

const made = [];
after(() => made.forEach((d) => fs.rmSync(d, { recursive: true, force: true })));

function makeProject() {
    const dir = scratchDirSync('connector-routines-');
    made.push(dir);
    fs.writeFileSync(path.join(dir, 'project.json'), '{}');
    return dir;
}

async function startServer() {
    const app = express();
    app.use(express.json());
    app.use(connectorRoutes);
    const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
    return { base: `http://127.0.0.1:${server.address().port}`, stop: () => new Promise((r) => server.close(r)) };
}

/** A renderer on the relay that answers every job with `answer(job)` and records it. */
async function fakeRenderer(base, answer) {
    const ac = new AbortController();
    const reader = (await fetch(`${base}/connector/jobs/stream`, { signal: ac.signal })).body.getReader();
    const decoder = new TextDecoder();
    const jobs = [];
    let buffer = '';
    const pump = (async () => {
        for (;;) {
            let chunk;
            try { chunk = await reader.read(); } catch { return; }
            if (chunk.done) return;
            buffer += decoder.decode(chunk.value, { stream: true });
            let idx;
            while ((idx = buffer.indexOf('\n\n')) !== -1) {
                const raw = buffer.slice(0, idx);
                buffer = buffer.slice(idx + 2);
                if (/^event: (.+)$/m.exec(raw)?.[1] !== 'job') continue;
                const job = JSON.parse(/^data: (.+)$/m.exec(raw)[1]);
                jobs.push(job);
                await postJson(`${base}/connector/jobs/${job.jobId}/result`, answer(job));
            }
        }
    })();
    return { jobs, close: () => { ac.abort(); return pump; } };
}

const postJson = (url, body) => fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
}).then((r) => r.json().then((json) => ({ status: r.status, json })));

const RAW = { name: 'shrink-and-cut', summary: 'shrink, then cut out', steps: [{ operation: 'downscale' }, { operation: 'removeBackground' }] };
// What the app's check hands back: the routine as it will be stored.
const CHECKED = { schema: 'cubric/routine/v1', ...RAW, inputs: [{ id: 'bg', kind: 'image' }], created_at: '2026-09-30T00:00:00Z' };

/** Every test gets a server, a renderer answering `answer`, and a project. */
async function withApp(answer, fn) {
    const { base, stop } = await startServer();
    const app = await fakeRenderer(base, answer);
    try {
        await fn({ base, jobs: app.jobs, p: makeProject() });
    } finally {
        await app.close();
        await stop();
    }
}

const okAnswer = (job) => (job.capability === 'routine.validate'
    ? { ok: true, output: { routine: CHECKED, summary: 'shrink-and-cut — shrink, then cut out' } }
    : { ok: true, output: { echo: job.capability } });

test('a save is checked by the app and stored AS CHECKED; list, read and delete follow', async () => {
    await withApp(okAnswer, async ({ base, jobs, p }) => {
        const saved = await postJson(`${base}/connector/routines`, { folderPath: p, routine: RAW });
        assert.deepEqual(saved.json, { ok: true, name: 'shrink-and-cut', created: true, summary: 'shrink-and-cut — shrink, then cut out' });
        assert.deepEqual(jobs.map((j) => [j.capability, j.input]), [['routine.validate', { routine: RAW }]]);

        const q = `?folderPath=${encodeURIComponent(p)}`;
        const list = await fetch(`${base}/connector/routines${q}`).then((r) => r.json());
        assert.deepEqual(list, { ok: true, routines: [{ name: 'shrink-and-cut', summary: 'shrink, then cut out', steps: 2, inputs: CHECKED.inputs }] });
        const one = await fetch(`${base}/connector/routines/shrink-and-cut${q}`).then((r) => r.json());
        assert.deepEqual(one, { ok: true, name: 'shrink-and-cut', routine: CHECKED }, 'stored as the app returned it, not as sent');

        const gone = await postJson(`${base}/connector/routines`, { folderPath: p, name: 'shrink-and-cut', delete: true });
        assert.deepEqual(gone.json, { ok: true, name: 'shrink-and-cut', deleted: true });
        assert.deepEqual((await fetch(`${base}/connector/routines${q}`).then((r) => r.json())).routines, []);
        assert.ok(fs.existsSync(path.join(p, 'Agent', 'routines', 'deleted', 'shrink-and-cut.json')), 'D5: moved, not destroyed');
    });
});

test('a save the app refuses stores nothing and passes the refusal through', async () => {
    const refusal = { ok: false, error: { code: 'UNKNOWN_FLOW', message: 'no such Flow' } };
    await withApp(() => refusal, async ({ base, p }) => {
        const saved = await postJson(`${base}/connector/routines`, { folderPath: p, routine: RAW });
        assert.deepEqual(saved.json, refusal);
        assert.equal(fs.existsSync(path.join(p, 'Agent', 'routines')), false);
    });
});

test('quote and run relay the STORED routine with the cards, inputs and project', async () => {
    await withApp(okAnswer, async ({ base, jobs, p }) => {
        await postJson(`${base}/connector/routines`, { folderPath: p, routine: RAW });
        const body = { folderPath: p, cards: ['A', 'stack-1'], inputs: { bg: 'C:/bg.png' } };
        for (const verb of ['quote', 'run']) {
            const r = await postJson(`${base}/connector/routines/shrink-and-cut/${verb}`, body);
            assert.deepEqual(r.json, { ok: true, output: { echo: `routine.${verb}` } });
        }
        assert.deepEqual(jobs.slice(1).map((j) => [j.capability, j.input]), [
            ['routine.quote', { routine: CHECKED, cards: ['A', 'stack-1'], inputs: { bg: 'C:/bg.png' }, folderPath: p }],
            ['routine.run', { routine: CHECKED, cards: ['A', 'stack-1'], inputs: { bg: 'C:/bg.png' }, folderPath: p }],
        ]);
    });
});

test('a global routine runs in the open project when no folderPath is given; an unknown one dispatches nothing', async () => {
    const prev = process.env.APP_USER_DATA;
    process.env.APP_USER_DATA = scratchDirSync('connector-routines-global-');
    made.push(process.env.APP_USER_DATA);
    try {
        await withApp(okAnswer, async ({ base, jobs }) => {
            await postJson(`${base}/connector/routines`, { scope: 'global', routine: RAW });
            await postJson(`${base}/connector/routines/shrink-and-cut/run`, { scope: 'global', cards: ['A'] });
            assert.deepEqual(jobs[1].input, { routine: CHECKED, cards: ['A'] }, 'no folderPath: the app runs it in the open project');

            const miss = await postJson(`${base}/connector/routines/nope/run`, { scope: 'global', cards: ['A'] });
            assert.equal(miss.json.error.code, 'ROUTINE_NOT_FOUND');
            assert.equal(jobs.length, 2, 'nothing reaches the app for a routine that is not there');
        });
    } finally {
        if (prev === undefined) delete process.env.APP_USER_DATA; else process.env.APP_USER_DATA = prev;
    }
});

test('a project-scope call with no folderPath is a 400', async () => {
    await withApp(okAnswer, async ({ base }) => {
        const r = await fetch(`${base}/connector/routines`);
        assert.equal(r.status, 400);
        assert.equal((await r.json()).error.code, 'BAD_REQUEST');
    });
});
