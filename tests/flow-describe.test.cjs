/**
 * flow-describe.test.cjs — a Flow's picture put into words before the run (MPI-1036).
 *
 * Video Edit's whole-frame edits failed on the bench until the prompt DESCRIBED the picture
 * (swap kept the clip's person, a background change kept the clip's room). The words come from
 * the describer picked in Remote (`llmService.describeImage`), asked by the FlowDef's `describe`
 * declaration, run by `flowEnhance.describeFlowRun` from `flowService.submitFlowGeneration` for
 * hand, agent and routine runs alike. This pins which question each option asks, that the graph
 * has the inputs the answers land in, and that a failed describe generates nothing.
 *
 * Run: node --test tests/flow-describe.test.cjs
 */

'use strict';

// Must exist BEFORE llmService loads: the backend preferences read it.
const _ls = {};
global.localStorage = {
    getItem: k => (Object.prototype.hasOwnProperty.call(_ls, k) ? _ls[k] : null),
    setItem: (k, v) => { _ls[k] = String(v); },
    removeItem: (k) => { delete _ls[k]; },
};

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repo = p => path.join(__dirname, '..', p);
const esm = p => import('file://' + repo(p).replace(/\\/g, '/'));

const PIC = { role: 'image1', mediaType: 'image', url: '/project-file?path=C%3A%2Fp%2FMedia%2Fpic.png' };
const CLIP = { role: 'video1', mediaType: 'video', url: '/project-file?path=C%3A%2Fp%2FMedia%2Fclip.mp4' };
const run = (op, extra = {}) => ({ Input_Operation: op, Input_Keep_Background: true, ...extra });

async function load() {
    const fe = await esm('js/services/flowEnhance.js');
    const reg = await esm('js/data/flowsRegistry.js');
    return { fe, flow: reg.getFlowById('video-edit') };
}

test('no picture, nothing is described: the no-picture templates carry no description', async () => {
    const { fe, flow } = await load();
    for (const op of [1, 2, 3, 4, 5]) {
        assert.deepEqual(fe.describeAsks(flow, run(op), [CLIP]), [], `op ${op}`);
    }
});

test('each option asks its own question about the picture', async () => {
    const { fe, flow } = await load();
    const look = (v) => {
        const asks = fe.describeAsks(flow, v, [CLIP, PIC]);
        const d = asks.find(a => a.to === 'Input_Look');
        assert.equal(d.media, 'image1');
        return d.ask;
    };
    assert.match(look(run(1)), /Describe only the main person/);
    assert.doesNotMatch(look(run(1)), /the place/, 'a swap in the clip\'s own room does not describe the picture\'s');
    // Template 6: the person INTO the picture's room. Declared before op 1's plain ask, so it wins.
    assert.match(look(run(1, { Input_Keep_Background: false })), /the main person.*and then the place/);
    assert.match(look(run(2)), /head/);
    assert.match(look(run(3)), /wears/);
    assert.match(look(run(4)), /the place.*Leave out any people/);
    assert.match(look(run(5)), /main subject/);
    for (const op of [1, 2, 3, 4, 5]) {
        assert.match(look(run(op)), /^This picture is a reference for a video edit\. .* Reply with one or two plain sentences/);
    }
});

test('a background change also describes the clip\'s own person, from its first frame', async () => {
    const { fe, flow } = await load();
    const kept = fe.describeAsks(flow, run(4), [CLIP, PIC]).find(a => a.to === 'Input_Kept');
    assert.equal(kept.media, 'video1');
    assert.equal(kept.frame, 'first');
    assert.match(kept.ask, /Describe only the main person/);
    for (const op of [2, 3, 5]) {
        assert.ok(!fe.describeAsks(flow, run(op), [CLIP, PIC]).some(a => a.to === 'Input_Kept'), `op ${op}`);
    }
});

test('a person swap that keeps the clip\'s room describes that room, from its first frame', async () => {
    const { fe, flow } = await load();
    const kept = fe.describeAsks(flow, run(1), [CLIP, PIC]).find(a => a.to === 'Input_Kept');
    assert.equal(kept.media, 'video1');
    assert.equal(kept.frame, 'first');
    assert.match(kept.ask, /Describe only the place.*Leave out any people/);
    // Into the picture's room (template 6) the clip's room is not wanted; with no picture nothing is described.
    assert.ok(!fe.describeAsks(flow, run(1, { Input_Keep_Background: false }), [CLIP, PIC]).some(a => a.to === 'Input_Kept'));
    assert.deepEqual(fe.describeAsks(flow, run(1), [CLIP]), []);
});

test('a target that already holds text is not asked again', async () => {
    const { fe, flow } = await load();
    const asks = fe.describeAsks(flow, run(4, { Input_Look: 'a bedroom' }), [CLIP, PIC]);
    assert.deepEqual(asks.map(a => a.to), ['Input_Kept']);
});

test('every describe target is an MpiText input the shipped graph declares', async () => {
    const { flow } = await load();
    const g = JSON.parse(fs.readFileSync(repo(`comfy_workflows/${flow.workflow}`), 'utf8'));
    const byTitle = new Map(Object.values(g).map(n => [n._meta?.title, n]));
    for (const to of new Set(flow.describe.map(d => d.to))) {
        // MpiText, never MpiString: an Input_* MpiString is staged as a media FILE (comfyController).
        assert.equal(byTitle.get(to)?.class_type, 'MpiText', to);
        assert.equal(byTitle.get(to).inputs.string, '', `${to} ships blank`);
    }
    // ...and the graph splices both into the prompt H3 reads.
    const replaces = Object.values(g).filter(n => n.class_type === 'StringReplace').map(n => n.inputs.find);
    assert.ok(replaces.includes('{look}') && replaces.includes('{kept}'));
    assert.ok(!Object.values(g).some(n => ['TextGenerate', 'PreviewAny'].includes(n.class_type)),
        'no describer in the graph: the words follow the Remote pick (Fabio, 2026-10-08)');
});

test('describeFlowRun: the answers land trimmed, the first frame is staged for the clip', async () => {
    const { fe, flow } = await load();
    const calls = [];
    const frames = [];
    const deps = {
        describe: async (a) => { calls.push(a); return { ok: true, via: 'endpoint', model: 'm', text: a.imagePath.endsWith('frame.png') ? '  : A blonde woman.' : 'A bedroom.' }; },
        firstFrame: async (url, project) => { frames.push([url, project.folderPath]); return 'C:/p/Media/.preview/frame.png'; },
    };
    const res = await fe.describeFlowRun(flow, { injectionParams: run(4), mediaItems: [CLIP, PIC] }, { id: 'p1', folderPath: 'C:/p' }, deps);
    assert.deepEqual(res, { ok: true, injectionParams: { Input_Look: 'A bedroom.', Input_Kept: 'A blonde woman.' } });
    assert.deepEqual(frames, [[CLIP.url, 'C:/p']]);
    assert.deepEqual(calls.map(c => c.imagePath), [PIC.url, 'C:/p/Media/.preview/frame.png']);
});

test('describeFlowRun: a failed describe generates nothing and says where to fix it', async () => {
    const { fe, flow } = await load();
    const realWarn = console.warn;
    console.warn = () => {};
    try {
        const cfg = { injectionParams: run(1), mediaItems: [CLIP, PIC] };
        const fail = error => fe.describeFlowRun(flow, cfg, null, { describe: async () => ({ ok: false, via: 'endpoint', error }) });

        const timedOut = await fail('The model timed out');
        assert.equal(timedOut.ok, false);
        assert.match(timedOut.message, /^Nothing was generated: the picture could not be described for Video Edit\. The model timed out\. Check Remote > Language Models\.$/);
        // The describer's own fix wins over the generic hint.
        const missing = await fail('Image Describer is not installed — add it from the Model Library (Plugins).');
        assert.doesNotMatch(missing.message, /Check Remote/);

        const empty = await fe.describeFlowRun(flow, cfg, null, { describe: async () => ({ ok: true, text: ' : ' }) });
        assert.equal(empty.ok, false, 'punctuation alone is no description');

        const cancelled = await fe.describeFlowRun(flow, cfg, null, { describe: async () => ({ ok: false, cancelled: true }) });
        assert.equal(cancelled.cancelled, true);

        const noFrame = await fe.describeFlowRun(flow, { injectionParams: run(4), mediaItems: [CLIP, PIC] }, null, {
            describe: async () => ({ ok: true, text: 'A bedroom.' }),
            firstFrame: async () => { throw new Error('The clip could not be read.'); },
        });
        assert.match(noFrame.message, /The clip could not be read\./);
    } finally {
        console.warn = realWarn;
    }
});

test('describeFlowRun asks the Remote pick through describeImage, with the declared question', async () => {
    const { fe, flow } = await load();
    const svc = await esm('js/services/llmService.js');
    const realFetch = global.fetch;
    const bodies = [];
    global.fetch = async (url, init) => {
        if (url === '/llm/describe') bodies.push(JSON.parse(init.body));
        return { ok: true, json: async () => ({ ok: true, text: 'A young woman with freckles.', model: 'x/vl' }) };
    };
    svc.setDescribeBackendPreference('endpoint');
    try {
        const res = await fe.describeFlowRun(flow, { injectionParams: run(2), mediaItems: [CLIP, PIC] }, null);
        assert.deepEqual(res.injectionParams, { Input_Look: 'A young woman with freckles.' });
        assert.equal(bodies.length, 1);
        assert.equal(bodies[0].imagePath, PIC.url);
        assert.equal(bodies[0].question, flow.describe.find(d => d.when?.is === 2).ask);
    } finally {
        svc.setDescribeBackendPreference(null);
        global.fetch = realFetch;
    }
});

test('Character Sheet from Images: the turn is asked on the BOXED face, the clothes only with a body (MPI-1042)', async () => {
    const fe = await esm('js/services/flowEnhance.js');
    const flow = (await esm('js/data/flowsRegistry.js')).getFlowById('character-sheet-from-images');
    const FACE = { role: 'image1', mediaType: 'image', url: '/project-file?path=C%3A%2Fp%2FMedia%2Fface.png' };
    const BODY = { role: 'image2', mediaType: 'image', url: '/project-file?path=C%3A%2Fp%2FMedia%2Fbody.png' };
    const box1 = { x: -20, y: 10, width: 400, height: 500 };

    assert.deepEqual(fe.describeAsks(flow, { box1 }, [FACE]).map(d => d.to), ['Input_Face_Pose']);
    assert.deepEqual(fe.describeAsks(flow, { box1 }, [FACE, BODY]).map(d => d.to), ['Input_Face_Pose', 'Input_Body_Clothes']);

    const crops = [];
    const asked = [];
    const deps = {
        describe: async (a) => { asked.push(a.imagePath); return { ok: true, text: a.imagePath.endsWith('crop.png') ? 'TURNED' : 'No clothing.' }; },
        boxCrop: async (url, box, project) => { crops.push([url, box, project.folderPath]); return 'C:/p/Media/.preview/crop.png'; },
    };
    const res = await fe.describeFlowRun(flow, { injectionParams: { box1 }, mediaItems: [FACE, BODY] }, { id: 'p1', folderPath: 'C:/p' }, deps);
    assert.deepEqual(res, { ok: true, injectionParams: { Input_Face_Pose: 'TURNED', Input_Body_Clothes: 'No clothing.' } });
    assert.deepEqual(crops, [[FACE.url, box1, 'C:/p']], 'the face is cropped to its box; the body is described whole');
    assert.deepEqual(asked, ['C:/p/Media/.preview/crop.png', BODY.url]);

    // No box (an agent that measured none): the whole picture is described.
    crops.length = 0;
    await fe.describeFlowRun(flow, { injectionParams: {}, mediaItems: [FACE] }, { id: 'p1', folderPath: 'C:/p' }, deps);
    assert.deepEqual(crops, []);

    // Both arms take both answers as blank MpiText, and read the turn off the word "turned".
    for (const file of ['flow_character_sheet_from_images.json', 'flow_character_sheet_from_images_klein.json']) {
        const g = JSON.parse(fs.readFileSync(repo(`comfy_workflows/${file}`), 'utf8'));
        const byTitle = new Map(Object.values(g).map(n => [n._meta?.title, n]));
        for (const to of ['Input_Face_Pose', 'Input_Body_Clothes']) {
            assert.equal(byTitle.get(to)?.class_type, 'MpiText', `${file} ${to}`);
            assert.equal(byTitle.get(to).inputs.string, '', `${file} ${to} ships blank`);
        }
        assert.ok(Object.values(g).some(n => n.class_type === 'MpiTextContains' && n.inputs.words === 'turned'), file);
    }
});

test('submitFlowGeneration describes before the graph is queued, on the first call only', () => {
    const src = fs.readFileSync(repo('js/services/flowService.js'), 'utf8');
    const body = src.slice(src.indexOf('export function submitFlowGeneration('), src.indexOf('// ── Cloud edit stage'));
    assert.match(body, /if \(!_leg\.tempId && describeAsks\(flow, config\.injectionParams, mediaItems\)\.length\) \{/);
    const describe = body.indexOf('describeFlowRun(flow, config, runOriginProject || state.currentProject)');
    const merge = body.indexOf('Object.assign(config.injectionParams, d.injectionParams);');
    const startAfter = body.indexOf('if (!start())', merge);
    assert.ok(describe > -1 && merge > describe && startAfter > merge, 'describe -> merge -> queue');
    assert.match(body, /if \(d\.cancelled\) return runCallbacks\.onCancel\?\.\(\);/);
    assert.match(body, /code: 'DESCRIBE_FAILED'/);
});
