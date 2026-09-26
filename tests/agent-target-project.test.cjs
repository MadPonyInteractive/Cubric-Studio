/**
 * agent-target-project.test.cjs — a submit names its own project (MPI-873).
 *
 * Live 2026-09-21: an agent opened "Deepinfra model tests", Fabio moved the app to another
 * project, and five Flow outputs landed there. A submit now carries `folderPath`, open or
 * closed. The trap these pin: the open project must come back as the LIVE object, or
 * generationService reads it as closed, writes the card server-side, and the open project's
 * next save writes over it.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.join(__dirname, '..');
const esm = (p) => import('file://' + path.join(repoRoot, p).replace(/\\/g, '/'));

const OPEN = { id: 'p-open', folderPath: 'C:/Projects/Bikes', itemGroups: [] };

/** Stub fetch for one test; returns the calls it saw. */
function stubFetch(answer) {
    const calls = [];
    const real = global.fetch;
    global.fetch = async (url, init) => {
        calls.push({ url, body: init?.body ? JSON.parse(init.body) : null });
        return answer(url);
    };
    return { calls, restore: () => { global.fetch = real; } };
}
const reply = (status, body) => ({ ok: status < 400, status, json: async () => body });

test('no folderPath: the open project, as the live object', async () => {
    const { targetProject } = await esm('js/shell/agentDispatch.js');
    const { state } = await esm('js/state.js');
    state.currentProject = OPEN;
    const t = await targetProject({});
    assert.equal(t.project, state.currentProject, 'the same object, not a copy');
    assert.equal(t.open, true);
    state.currentProject = null;
    assert.deepEqual(await targetProject({}), { project: null, open: false });
});

test('the open project named in another spelling is still the live object, and nothing is read', async () => {
    const { targetProject } = await esm('js/shell/agentDispatch.js');
    const { state } = await esm('js/state.js');
    state.currentProject = OPEN;
    const f = stubFetch(() => reply(200, {}));
    try {
        const t = await targetProject({ folderPath: 'c:\\projects\\bikes' });
        assert.equal(t.project, state.currentProject);
        assert.equal(t.open, true);
        assert.equal(f.calls.length, 0);
    } finally { f.restore(); state.currentProject = null; }
});

test('a closed project is read, not opened', async () => {
    const { targetProject } = await esm('js/shell/agentDispatch.js');
    const { state } = await esm('js/state.js');
    state.currentProject = OPEN;
    const closed = { id: 'p-b', folderPath: 'C:/Projects/Boats', itemGroups: [] };
    const f = stubFetch(() => reply(200, { success: true, project: closed }));
    try {
        const t = await targetProject({ folderPath: 'C:/Projects/Boats' });
        assert.deepEqual(t, { project: closed, open: false });
        assert.deepEqual(f.calls, [{ url: '/get-project', body: { folderPath: 'C:/Projects/Boats' } }]);
        assert.equal(state.currentProject, OPEN, 'the view stays on the open project');
    } finally { f.restore(); state.currentProject = null; }
});

test('a project that cannot be read is PROJECT_NOT_FOUND, never the open one', async () => {
    const { targetProject } = await esm('js/shell/agentDispatch.js');
    const { state } = await esm('js/state.js');
    state.currentProject = OPEN;
    const f = stubFetch(() => reply(500, { success: false, error: 'ENOENT' }));
    try {
        const t = await targetProject({ folderPath: 'C:/Projects/Gone' });
        assert.equal(t.error.code, 'PROJECT_NOT_FOUND');
        assert.match(t.error.message, /ENOENT/);
    } finally { f.restore(); state.currentProject = null; }
});

test('a card name reaches a card that landed in a closed project, on disk shape', async () => {
    const { nameCard } = await esm('js/shell/agentDispatch.js');
    const { state } = await esm('js/state.js');
    state.currentProject = OPEN; // the card is not in here
    const group = { id: 'g1', type: 'image', history: [{ id: 'it1', filePath: '/project-file?path=x' }], selectedIndex: 0 };
    const f = stubFetch(() => reply(200, { success: true }));
    try {
        const named = await nameCard(group, '  Red boat ', { folderPath: 'C:/Projects/Boats' });
        assert.equal(named.customName, 'Red boat');
        assert.equal(f.calls.length, 1);
        assert.equal(f.calls[0].url, '/project-groups');
        assert.equal(f.calls[0].body.folderPath, 'C:/Projects/Boats');
        const [sent] = f.calls[0].body.groups;
        assert.equal(sent.customName, 'Red boat');
        assert.deepEqual(sent.history, ['it1'], 'history as item ids, or the route refuses it');
    } finally { f.restore(); state.currentProject = null; }
});

test('findProjectByFolder matches any case, either slash, a trailing slash', () => {
    const { findProjectByFolder } = require('../routes/connector');
    const list = [{ folderPath: 'C:\\Projects\\Boats' }, { folderPath: 'D:/Other' }];
    assert.equal(findProjectByFolder(list, 'c:/projects/boats/'), list[0]);
    assert.equal(findProjectByFolder(list, 'C:/Projects/Boat'), null, 'a prefix is not a match');
    assert.equal(findProjectByFolder(list, ''), null);
});

// The renderer decides "open or closed?" by exact string, so the route must dispatch the
// project list's spelling, never the caller's.
test('/connector/generate dispatches folderPath in the project list\'s spelling, and refuses an unknown one', async () => {
    const express = require('express');
    const app = express();
    app.use(express.json());
    app.post('/list-projects', (_q, r) => r.json({ success: true, projects: [{ name: 'Boats', folderPath: 'C:\\Projects\\Boats' }] }));
    app.use(require('../routes/connector'));
    const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
    const base = `http://127.0.0.1:${server.address().port}`;
    const prevPort = process.env.CUBRIC_PORT;
    process.env.CUBRIC_PORT = String(server.address().port);

    // A fake renderer: the job stream, one frame at a time.
    const ac = new AbortController();
    const reader = (await fetch(`${base}/connector/jobs/stream`, { signal: ac.signal })).body.getReader();
    let buf = '';
    const nextJob = async () => {
        for (;;) {
            const i = buf.indexOf('\n\n');
            if (i !== -1) {
                const raw = buf.slice(0, i); buf = buf.slice(i + 2);
                if (/^event: job$/m.test(raw)) return JSON.parse(/^data: (.+)$/m.exec(raw)[1]);
                continue;
            }
            const { value } = await reader.read();
            buf += new TextDecoder().decode(value);
        }
    };
    const post = (p, body) => fetch(`${base}${p}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        .then(async (r) => ({ status: r.status, json: await r.json() }));
    const settle = (job) => post(`/connector/jobs/${job.jobId}/result`, { ok: true, output: {} });
    try {
        await new Promise((r) => setTimeout(r, 50)); // the subscription registers
        const named = post('/connector/generate', { modelId: 'krea2', operation: 't2i', positive: 'x', folderPath: 'c:/projects/boats/' });
        const job = await nextJob();
        assert.equal(job.input.folderPath, 'C:/Projects/Boats');
        await settle(job); await named;

        const plain = post('/connector/generate', { modelId: 'krea2', operation: 't2i', positive: 'x' });
        const job2 = await nextJob();
        assert.equal('folderPath' in job2.input, false, 'no folderPath: the input is exactly as before');
        await settle(job2); await plain;

        const unknown = await post('/connector/generate', { flowId: 'outpaint', folderPath: 'C:/Projects/Gone' });
        assert.equal(unknown.status, 400);
        assert.equal(unknown.json.error.code, 'PROJECT_NOT_FOUND');
        assert.equal((await post('/connector/generate', { modelId: 'krea2', operation: 't2i', folderPath: 7 })).json.error.code, 'INVALID_FOLDER_PATH');
    } finally {
        ac.abort();
        if (prevPort === undefined) delete process.env.CUBRIC_PORT; else process.env.CUBRIC_PORT = prevPort;
        await new Promise((resolve) => server.close(resolve));
    }
});

test('a Flow carries its project as a RUN-only input: never into the sidecar, and on to every pass', () => {
    const src = fs.readFileSync(path.join(repoRoot, 'js/services/flowService.js'), 'utf8');
    assert.match(src, /const \{ runMediaItems, runInputs, runNextPass, runOriginProject, \.\.\.snapshot \} = inputs;/);
    assert.match(src, /runOriginProject \? \{ _originProject: runOriginProject \}/);
    assert.match(src, /runMediaItems: media, runOriginProject,/);
});
