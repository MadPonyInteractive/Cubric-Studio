'use strict';

/**
 * agent-flow-handover.test.cjs — MPI-892, the agent hands a Flow over instead of running it.
 *
 * Fabio, 2026-09-30: Draw It In, Scribble and Object Stamp need the user's hands ("the agent is
 * not going to draw stuff on a canvas"), Song's lyrics are theirs to read first, and any other
 * Flow can be opened for them when it needs something only they have ("You didn't provide the
 * voice sample. I can open the flow for you."). The frame's side is the renderer job here; the
 * loop's routing is in agent-loop.test.cjs (MPI-892 block).
 */

const assert = require('node:assert/strict');
const test = require('node:test');

const { getFlowById, listFlows } = require('../js/data/flowsRegistry.js');
const { openFlow } = require('../js/shell/agentDispatch.js');
const { state } = require('../js/state.js');
const { Events } = require('../js/events.js');

const PHOTO = `/project-file?path=${encodeURIComponent('C:\\Projects\\Test\\Media\\t2i_001.png')}`;

/** Run the renderer job and return what it reported, plus every `flow:open` it emitted. */
async function run(input) {
    const reports = [];
    const opened = [];
    const realFetch = global.fetch;
    global.fetch = async (url, init) => { reports.push(JSON.parse(init.body)); return { ok: true, json: async () => ({}) }; };
    const off = Events.on('flow:open', (p) => opened.push(p));
    try {
        await openFlow(`job-${Math.random()}`, input);
    } finally {
        global.fetch = realFetch;
        off();
    }
    return { report: reports[0], opened };
}

test.beforeEach(() => {
    state.currentProject = { id: 'p1', folderPath: 'C:/Projects/Test', itemGroups: [] };
    state.s_flowInputs = {};
    state.canvasMode = null;
});

test.describe('which Flows open for the user (Fabio\'s sort)', () => {
    test('the four he named open, at a step each one actually has', () => {
        const want = { 'scribble-object': 'paint', scribble: 'paint', 'object-stamp': 'cutout', 'minimax-music': 'run' };
        for (const [id, at] of Object.entries(want)) {
            const flow = getFlowById(id);
            assert.equal(flow.agentOpens, at, id);
            if (at !== 'run') assert.ok(flow.steps.some((s) => s.kind === at), `${id} has no ${at} step`);
        }
    });

    test('every other Flow is the agent\'s to run', () => {
        const runs = listFlows().filter((f) => !f.agentOpens).map((f) => f.id);
        for (const id of ['character-sheet', 'outpaint', 'ltx-extend', 'ltx-foley', 'ltx-upscale', 'stems', 'sound-and-music', 'chatter-box', 'voice-changer']) {
            assert.ok(runs.includes(id), `${id} should run`);
        }
    });
});

test.describe('openFlow — filled, on screen, and nothing runs', () => {
    test('Scribble opens at its drawing step with the prompt filled in', async () => {
        const { report, opened } = await run({ flowId: 'scribble', fields: { positive: 'a cat on a fence' }, media: [], follow: true });
        assert.equal(report.ok, true, JSON.stringify(report));
        assert.equal(report.output.opened, 'Scribble');
        assert.equal(report.output.at, 'Draw what you want');
        assert.deepEqual(opened, [{ flowId: 'scribble', openAt: 'paint' }]);
        assert.equal(state.s_flowInputs.scribble.positive, 'a cat on a fence', 'seeded where MpiBaseFlow reads on mount');
        assert.equal(report.output.empty, undefined, 'the drawing IS what the user makes on that step');
    });

    test('Draw It In with no photo opens where the photo goes, and says so', async () => {
        const { report, opened } = await run({ flowId: 'scribble-object', fields: { positive: 'a balloon' }, follow: true });
        assert.equal(opened[0].openAt, 'inputs');
        assert.equal(report.output.at, 'Inputs');
        assert.match(report.output.empty, /image in the "image1" slot/);
    });

    test('Object Stamp takes both pictures and opens on the clean-up step, hint and all', async () => {
        const media = [{ role: 'image1', url: PHOTO }, { role: 'image2', url: PHOTO.replace('001', '002') }];
        const { report, opened } = await run({ flowId: 'object-stamp', media, follow: true });
        assert.equal(report.output.at, 'Clean up the object');
        assert.match(report.output.hint, /Remove the background/);
        assert.equal(opened[0].openAt, 'cutout');
        assert.deepEqual(state.s_flowInputs['object-stamp'].mediaItems.map((m) => m.role), ['image1', 'image2']);
    });

    test('a Flow the agent would run opens on its inputs while a required slot is empty', async () => {
        const { report, opened } = await run({ flowId: 'chatter-box', fields: { positive: 'Hello there.' }, follow: true });
        assert.equal(report.ok, true, 'an empty slot is the user\'s to fill, not a refusal');
        assert.equal(opened[0].openAt, 'inputs');
        assert.match(report.output.empty, /audio in the "audio1" slot/);
    });

    test('...and on Generate once everything it needs is there', async () => {
        const voice = `/project-file?path=${encodeURIComponent('C:\\Projects\\Test\\Media\\voice.wav')}`;
        const { opened, report } = await run({ flowId: 'chatter-box', fields: { positive: 'Hello.' }, media: [{ role: 'audio1', url: voice }], follow: true });
        assert.equal(opened[0].openAt, 'run');
        assert.equal(report.output.empty, undefined);
    });

    test('never without a typed turn, never over the user\'s work, never with a field it lacks', async () => {
        let r = await run({ flowId: 'scribble', follow: false });
        assert.equal(r.report.error.code, 'NOT_NOW');
        assert.deepEqual(r.opened, []);

        state.canvasMode = 'mask';
        r = await run({ flowId: 'scribble', follow: true });
        assert.equal(r.report.error.code, 'VIEW_BUSY');
        assert.deepEqual(r.opened, []);
        state.canvasMode = null;

        r = await run({ flowId: 'scribble', fields: { lyrics: 'la' }, follow: true });
        assert.equal(r.report.error.code, 'BAD_REQUEST');
        assert.deepEqual(state.s_flowInputs, {}, 'a refusal seeds nothing');
    });
});
