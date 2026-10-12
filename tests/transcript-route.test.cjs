/**
 * transcript-route.test.cjs — MPI-1071. An agent's Transcribe run writes its subtitles to
 * <project>/Transcripts/<source>.srt: no card, no project.json write, and a name that tries
 * to be a path still lands in Transcripts/.
 */

'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('fs-extra');
const path = require('node:path');
const express = require('express');
const { scratchDir } = require('./helpers/scratch.cjs');

const SRT = '1\n00:00:00,000 --> 00:00:01,500\nHello.\n';

async function post(root, body) {
    const app = express();
    app.use(express.json());
    app.use(require('../routes/projects.js'));
    const server = await new Promise(r => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
    try {
        return await fetch(`http://127.0.0.1:${server.address().port}/project-media/agent/transcript?folderPath=${encodeURIComponent(root)}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        }).then(r => r.json());
    } finally {
        await new Promise(r => server.close(r));
    }
}

test('writes Transcripts/<source>.srt and touches nothing else', async () => {
    const root = await scratchDir('transcript-');
    const projectJson = JSON.stringify({ id: 'p', itemGroups: [] });
    await fs.writeFile(path.join(root, 'project.json'), projectJson);
    const res = await post(root, { name: 'take 1.webm', srt: SRT });
    assert.equal(res.success, true, JSON.stringify(res));
    assert.equal(res.filePath, path.join(root, 'Transcripts', 'take 1.srt'));
    assert.equal(await fs.readFile(res.filePath, 'utf8'), SRT);
    assert.equal(await fs.readFile(path.join(root, 'project.json'), 'utf8'), projectJson, 'no project.json write');
    assert.deepEqual((await fs.readdir(root)).sort(), ['Transcripts', 'project.json']);
});

test('a name that is a path stays inside Transcripts/', async () => {
    const root = await scratchDir('transcript-');
    const res = await post(root, { name: '..\\..\\evil/../x.mp4', srt: SRT });
    assert.equal(path.dirname(res.filePath), path.join(root, 'Transcripts'));
});

test('an agent gets the plain text plus the .srt path; other text passes through untouched', async () => {
    const { flowTextOutput } = require('../js/shell/agentDispatch.js');
    const calls = [];
    const realFetch = global.fetch;
    global.fetch = async (url, init) => {
        calls.push({ url, body: JSON.parse(init.body) });
        return { json: async () => ({ success: true, filePath: 'C:/p/Transcripts/take 1.srt' }) };
    };
    try {
        const project = { id: 'p1', folderPath: 'C:/p' };
        const media = [{ url: `/project-file?path=${encodeURIComponent('C:/p/Media/take 1.webm')}` }];
        assert.deepEqual(await flowTextOutput(SRT, project, media), { text: 'Hello.', srtPath: 'C:/p/Transcripts/take 1.srt' });
        assert.equal(calls.length, 1);
        assert.match(calls[0].url, /^\/project-media\/p1\/transcript\?folderPath=C%3A%2Fp$/);
        assert.deepEqual(calls[0].body, { name: 'take 1.webm', srt: SRT });

        assert.deepEqual(await flowTextOutput('A cat on a mat.', project, media), { text: 'A cat on a mat.' });
        assert.equal(calls.length, 1, 'a describe answer writes no file');

        // An MCP-staged file sits in the store under its hash: `name` keeps the user's filename.
        await flowTextOutput(SRT, project, [{ url: '/project-file?path=C%3A%2Fp%2FMedia%2F.preview-assets%2F95d8.webm', name: 'clip1.webm' }]);
        assert.equal(calls[1].body.name, 'clip1.webm');

        global.fetch = async () => { throw new Error('offline'); };
        assert.deepEqual(await flowTextOutput(SRT, project, media), { text: 'Hello.' }, 'the words survive a failed write');
    } finally {
        global.fetch = realFetch;
    }
});

test('no srt is a 400, no name falls back to transcript.srt', async () => {
    const root = await scratchDir('transcript-');
    assert.equal((await post(root, { name: 'a' })).success, false);
    assert.equal(path.basename((await post(root, { srt: SRT })).filePath), 'transcript.srt');
});
