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
    assert.match(kept.ask, /^This picture is a reference for a video edit\. Describe only the person, each of them/);
    // MPI-1154: it describes everyone {who} names, not "the main person" (the horse went undescribed).
    const two = fe.describeAsks(flow, run(4, { Input_Who: 'The monkey and the horse ' }), [CLIP, PIC]).find(a => a.to === 'Input_Kept');
    assert.match(two.ask, /Describe only The monkey and the horse, each of them in turn if that is more than one:/);
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

test('describeFlowRun: a repeat run reuses the answer, a new picture is described again', async () => {
    // Fabio, 2026-10-09: re-describing the same picture every run is "ridiculous", and the
    // wording drifts, so two runs of one setup would get different prompts.
    const { fe, flow } = await load();
    let n = 0;
    const deps = { cache: new Map(), describe: async () => ({ ok: true, via: 'endpoint', text: `Look ${++n}.` }) };
    const go = pic => fe.describeFlowRun(flow, { injectionParams: run(2), mediaItems: [CLIP, pic] }, null, deps);
    assert.deepEqual((await go(PIC)).injectionParams, { Input_Look: 'Look 1.' });
    assert.deepEqual((await go(PIC)).injectionParams, { Input_Look: 'Look 1.' }, 'same picture: the first answer');
    assert.deepEqual((await go({ ...PIC, url: `${PIC.url}?other` })).injectionParams, { Input_Look: 'Look 2.' });
    assert.equal(n, 2);
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

    assert.deepEqual(fe.describeAsks(flow, { box1 }, [FACE]).map(d => d.to), ['Input_Character_Kind', 'Input_Face_Pose']);
    assert.deepEqual(fe.describeAsks(flow, { box1 }, [FACE, BODY]).map(d => d.to), ['Input_Character_Kind', 'Input_Face_Pose', 'Input_Body_Clothes']);

    const crops = [];
    const asked = [];
    const deps = {
        describe: async (a) => {
            asked.push(a.imagePath);
            if (!a.imagePath.endsWith('crop.png')) return { ok: true, text: 'No clothing.' };
            return { ok: true, text: a.question.includes('PERSON or OTHER') ? 'PERSON' : 'TURNED' };
        },
        boxCrop: async (url, box, project) => { crops.push([url, box, project.folderPath]); return 'C:/p/Media/.preview/crop.png'; },
    };
    const res = await fe.describeFlowRun(flow, { injectionParams: { box1 }, mediaItems: [FACE, BODY] }, { id: 'p1', folderPath: 'C:/p' }, deps);
    assert.deepEqual(res, { ok: true, injectionParams: { Input_Character_Kind: 'PERSON', Input_Face_Pose: 'TURNED', Input_Body_Clothes: 'No clothing.' } });
    assert.ok(crops.length && crops.every(c => c[0] === FACE.url && c[1] === box1), 'the face is cropped to its box; the body is described whole');
    assert.deepEqual(asked.filter(p => !p.endsWith('crop.png')), [BODY.url]);

    // No box (an agent that measured none): the whole picture is described.
    crops.length = 0;
    await fe.describeFlowRun(flow, { injectionParams: {}, mediaItems: [FACE] }, { id: 'p1', folderPath: 'C:/p' }, deps);
    assert.deepEqual(crops, []);

    // The graph takes both answers as blank MpiText, and reads the turn off the word "turned".
    for (const file of ['flow_character_sheet_from_images.json']) {
        const g = JSON.parse(fs.readFileSync(repo(`comfy_workflows/${file}`), 'utf8'));
        const byTitle = new Map(Object.values(g).map(n => [n._meta?.title, n]));
        for (const to of ['Input_Character_Kind', 'Input_Face_Pose', 'Input_Body_Clothes']) {
            assert.equal(byTitle.get(to)?.class_type, 'MpiText', `${file} ${to}`);
            assert.equal(byTitle.get(to).inputs.string, '', `${file} ${to} ships blank`);
        }
        assert.ok(Object.values(g).some(n => n.class_type === 'MpiTextContains' && n.inputs.words === 'turned'), file);
        // OTHER reads off the kind answer; blank (no describer) stays on the person wording (MPI-1306).
        const other = byTitle.get('character is not a person?');
        assert.equal(other?.inputs.words, 'other', file);
        assert.equal(other.inputs.text[0], Object.keys(g).find(k => g[k]._meta?.title === 'Input_Character_Kind'), file);
    }
});

test('submitFlowGeneration describes before the graph is queued, on the first call only (a later pass: its `everyPass` entries)', () => {
    const src = fs.readFileSync(repo('js/services/flowService.js'), 'utf8');
    const body = src.slice(src.indexOf('export function submitFlowGeneration('), src.indexOf('// ── Cloud edit stage'));
    // The rules read every field the run has (MPI-1041: `change`, `words` are not graph params).
    assert.match(body, /const describeRun = \{ mediaItems, injectionParams: \{ \.\.\.flowRunValues\(flow, run\), \.\.\.config\.injectionParams \} \};/);
    assert.match(body, /if \(\(!_leg\.tempId \|\| laterPass\) && describeAsks\(describing, describeRun\.injectionParams, mediaItems\)\.length\) \{/);
    const describe = body.indexOf('(io.describe || describeFlowRun)(describing, describeRun, runOriginProject || state.currentProject)');
    const merge = body.indexOf('Object.assign(config.injectionParams, d.injectionParams);');
    const startAfter = body.indexOf('if (!start())', merge);
    assert.ok(describe > -1 && merge > describe && startAfter > merge, 'describe -> merge -> queue');
    // Cancelled by the describer OR by the run's handle while it described (MPI-1083).
    assert.match(body, /if \(handle\.cancelled \|\| d\.cancelled\) return runCallbacks\.onCancel\?\.\(/);
    // A check's refusal keeps its own code (MPI-1041: CHILD_SAFETY); a describer failure has none.
    assert.match(body, /code: d\.code \|\| 'DESCRIBE_FAILED'/);
});

// MPI-1086 r44: the Character Sheet Editor's Tattoos back pass stitches the sheet at its OWN panel gaps.
// A synthetic sheet: grey backdrop, three "figures" (one a plain block, as a red dress is), two gaps.
function sheet(w, h, figures) {
    const g = new Float32Array(w * h).fill(190);
    for (const [x0, x1, shade] of figures) {
        for (let y = 10; y < h - 10; y++) for (let x = x0; x < x1; x++) g[y * w + x] = shade + ((x * 7 + y * 3) % 2 ? 6 : 0);
    }
    return g;
}

test('sheetCuts: the middles of the first two gaps between figures, or null when there are none', async () => {
    const fe = await esm('js/services/flowEnhance.js');
    // front 30-100, back 150-230 (a PLAIN block: calm along the column, but not the backdrop), close-up 260-448
    const c = fe.sheetCuts(sheet(448, 280, [[30, 100, 60], [150, 230, 120], [260, 448, 90]]), 448, 280);
    assert.ok(c, 'two gaps found');
    assert.ok(Math.abs(c[0] - 125 / 448) < 0.01 && Math.abs(c[1] - 245 / 448) < 0.01, JSON.stringify(c));
    assert.equal(fe.sheetCuts(new Float32Array(448 * 280).fill(190), 448, 280), null, 'a blank picture: no cuts');
    assert.equal(fe.sheetCuts(sheet(448, 280, [[30, 100, 60], [104, 448, 90]]), 448, 280), null, 'one narrow lull is no gap');
    // a gap in the wrong place (a mannequin close-up, a broken sheet) is not trusted: the graph keeps 25% / 50%
    assert.equal(fe.sheetCuts(sheet(448, 280, [[10, 20, 60], [30, 40, 60], [60, 448, 90]]), 448, 280), null);
    // MPI-1174: a backdrop shaded top to bottom near the left edge (calm, but not one colour) splits the margin before
    // the front figure off the edge; that margin is no gap (flowCharacterSheet_069 measured no cuts: cut 1 at 6%)
    const shaded = sheet(448, 280, [[50, 100, 60], [150, 230, 120], [260, 448, 90]]);
    for (let y = 0; y < 280; y++) for (let x = 0; x < 40; x++) shaded[y * 448 + x] += 80 * (1 - x / 40) * (y / 279 - 0.5) * 2;
    const m = fe.sheetCuts(shaded, 448, 280);
    assert.ok(m && Math.abs(m[0] - 125 / 448) < 0.01 && Math.abs(m[1] - 245 / 448) < 0.01, JSON.stringify(m));
    // shrinkGray averages blocks: a 2x2 checker of 0 / 200 is 100 everywhere, never 0 or 200
    const W = 8, H = 4, big = new Float32Array(W * H).map((_, i) => ((i % W) + Math.floor(i / W)) % 2 ? 200 : 0);
    assert.deepEqual([...fe.shrinkGray(big, W, H, 4, 2)], new Array(8).fill(100));
});

test('describeFlowRun: a MEASURE entry reads pixels, never the describer, and finding nothing is an answer', async () => {
    const fe = await esm('js/services/flowEnhance.js');
    const flow = (await esm('js/data/flowsRegistry.js')).getFlowById('character-sheet-editor');
    const SHEET = { role: 'image1', mediaType: 'image', url: '/project-file?path=C%3A%2Fp%2FMedia%2Fsheet.png' };
    const values = { change: 'tattoos', words: 'a rose on the left arm', Input_Age: -1 };
    assert.deepEqual(fe.describeAsks(flow, values, [SHEET]).map(d => d.to), ['sheetCuts']);
    assert.deepEqual(fe.describeAsks(flow, { ...values, change: 'accessories' }, [SHEET]).map(d => d.to), ['sheetCuts'],
        'Accessories take the back pass too (MPI-1086 ac2)');
    assert.deepEqual(fe.describeAsks(flow, { ...values, change: 'makeup' }, [SHEET]).map(d => d.to), [], 'back-pass changes only');
    const deps = (cuts) => ({ measure: async () => cuts, describe: async () => { throw new Error('no describer'); } });
    for (const cuts of ['510,1002', '']) {
        const res = await fe.describeFlowRun(flow, { injectionParams: values, mediaItems: [SHEET] }, null, deps(cuts));
        assert.deepEqual(res, { ok: true, injectionParams: { sheetCuts: cuts } });
    }
});

// MPI-1231: Storyboard's Plan with Cosmo describes every picture before it plans.
test('describePictures: every picture is described in slot order, a cleared slot is skipped, progress is named', async () => {
    const fe = await esm('js/services/flowEnhance.js');
    const asked = [], seen = [];
    const describe = async (a) => {
        asked.push(a);
        return { ok: true, via: 'endpoint', model: 'gemma', costUsd: 0.0002, text: `: a look of ${a.imagePath}` };
    };
    const step = await fe.describePictures([{ url: 'a' }, null, { url: 'c' }], 'what is it?', {
        describe, onPicture: (n, total) => seen.push(`${n}/${total}`),
    });
    assert.deepEqual(asked, [
        { imagePath: 'a', question: 'what is it?', queued: true },
        { imagePath: 'c', question: 'what is it?', queued: true },
    ], 'each picture is its own queued describe job, so it shows a row and Stop');
    assert.deepEqual(seen, ['1/2', '2/2']);
    assert.deepEqual([...step.looks], ['a look of a', undefined, 'a look of c'], 'stray punctuation is trimmed, slots keep their numbers');
    assert.equal(fe.picturesCostLine(step), 'Described 2 pictures with gemma first, about $0.0002 a picture.');
    // Fabio's toast read "about $0.0000 a picture" for a gemma-4 describe (2026-10-25).
    assert.equal(fe.picturesCostLine({ ...step, costs: [0.000023, undefined, 0.000019] }),
        'Described 2 pictures with gemma first, about $0.00002 a picture.');
});

test('describePictures: a failed or empty describe names the picture, a Stop is quiet, a repeat costs nothing', async () => {
    const fe = await esm('js/services/flowEnhance.js');
    const items = [{ url: 'a' }, { url: 'b' }];
    const failOn = (url, answer) => async a => (a.imagePath === url ? answer : { ok: true, via: 'endpoint', text: 'a cat' });
    const failed = await fe.describePictures(items, 'q', { describe: failOn('b', { ok: false, via: 'endpoint', error: 'No API key saved for this connection.' }) });
    assert.deepEqual(failed, { ok: false, message: 'Nothing was planned: picture 2 could not be described. No API key saved for this connection. Check Remote > Language Models.' });
    const empty = await fe.describePictures(items, 'q', { describe: failOn('a', { ok: true, text: ' . ' }) });
    assert.match(empty.message, /picture 1 could not be described\. It gave no answer\./);
    const stopped = await fe.describePictures(items, 'q', { describe: failOn('a', { ok: false, cancelled: true }) });
    assert.equal(stopped.cancelled, true);

    const cache = new Map();
    let calls = 0;
    const describe = async () => { calls++; return { ok: true, via: 'comfy', text: 'a cat' }; };
    assert.equal(fe.picturesCostLine(await fe.describePictures(items, 'q', { describe, cache })), 'Described 2 pictures on this computer first, at no cost.');
    const again = await fe.describePictures(items, 'q', { describe, cache });
    assert.equal(calls, 2, 'the same pictures and question are not described twice');
    assert.deepEqual(again.looks, ['a cat', 'a cat']);
    assert.equal(fe.picturesCostLine(again), 'The pictures were described before, so nothing was spent on them.');
});

test('restoreSlotItems: a picture goes back to its own slot, never into another group by position (MPI-1287)', async () => {
    const { restoreSlotItems } = await esm('js/utils/declaredFields.js');
    const face = { type: 'image', roles: ['face'], max: 1 };
    const body = { type: 'image', roles: ['body'], max: 1 };
    const saved = [{ mediaType: 'image', role: 'face', url: 'f.png' }];
    assert.deepEqual([...restoreSlotItems(face, saved)], [{ mediaType: 'image', role: 'face', url: 'f.png' }]);
    assert.deepEqual(restoreSlotItems(body, saved), [], 'the face is not sent as the full-body reference');
    const grid = { type: 'image', roles: ['a', 'b', 'c'], max: 3 };
    assert.deepEqual([...restoreSlotItems(grid, [{ mediaType: 'image', role: 'b', url: '2' }])].map(m => m?.url), [undefined, '2'], 'slot 2 alone stays slot 2');
    assert.deepEqual(restoreSlotItems(grid, [{ mediaType: 'image', url: '1' }, { mediaType: 'video', url: 'v' }]).map(m => m.role), ['a'], 'a roleless older snapshot fills by position');
});

test('pictureSentences: the planner reads the note and what the picture shows; the saved notes stay notes', async () => {
    const { pictureSentences, readPictureSentences } = await esm('js/utils/declaredFields.js');
    const notes = ['Sphinx, the bad guy', '', 'Fox.'];
    const looks = ['A hairless grey cat with large ears.', 'a white tiger', undefined];
    assert.equal(pictureSentences(notes, looks),
        'Picture 1 is Sphinx, the bad guy. It shows a hairless grey cat with large ears. Picture 2 shows a white tiger. Picture 3 is Fox.');
    assert.equal(pictureSentences(notes), 'Picture 1 is Sphinx, the bad guy. Picture 3 is Fox.');
    assert.deepEqual(readPictureSentences(pictureSentences(notes)), ['Sphinx, the bad guy', '', 'Fox']);
});

test('pictureSentences: a picture switched to "Several characters" says so, and reads back switched on', async () => {
    // MPI-1309: off (the default) is one character, maybe a character sheet of it; on is a group.
    const { pictureSentences, readPictureSentences, pictureNoteText } = await esm('js/utils/declaredFields.js');
    const notes = ['Cosmo, the director', { text: 'the crew', several: true }, { text: '', several: true }];
    const said = pictureSentences(notes, ['a pink robot', 'four robots']);
    assert.equal(said, 'Picture 1 is Cosmo, the director. It shows a pink robot. Picture 2 is the crew. It shows four robots. Picture 2 has several characters in it. Picture 3 has several characters in it.');
    assert.deepEqual(readPictureSentences(pictureSentences(notes)), ['Cosmo, the director', { text: 'the crew', several: true }, { text: '', several: true }]);
    assert.deepEqual(notes.map(pictureNoteText), ['Cosmo, the director', 'the crew', '']);
});
