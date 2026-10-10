'use strict';

// MPI-623 — the scene's picture doors (js/services/scene/scenePicture.js) the 360 player's Take
// picture and Render path share. Wrong here, a Klein clean-up lands as a stray gallery card, the
// pano is described on every press (or a failed describe lets a job run in the wrong style), or a
// cleaned picture drifts off the frame's colours.

const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const esm = (p) => import(pathToFileURL(path.join(__dirname, '..', p)).href);
const pf = (p) => `/project-file?path=${encodeURIComponent(p)}`;
const STYLE = 'Flat toon shading, warm palette.';

const describer = (answer) => {
    const calls = [];
    return { calls, io: { describe: async (args) => { calls.push(args); return answer; } } };
};

test('the pano\'s style: the PANO is asked, lead punctuation dropped, once a scene', async () => {
    const { sceneStyle, STYLE_ASK } = await esm('js/services/scene/scenePicture.js');
    const item = { filePath: pf('C:/P/Media/pano1.png'), scenePath: pf('C:/P/Media/.meta/once.scene.json') };
    const t = describer({ ok: true, text: `: ${STYLE}` });
    const steps = [];
    assert.equal(await sceneStyle(t.io, item, (s) => steps.push(s)), STYLE);
    assert.deepEqual(t.calls, [{ imagePath: item.filePath, question: STYLE_ASK }]);
    assert.deepEqual(steps, ['style']);
    const again = describer({ ok: true, text: 'something else' });
    assert.equal(await sceneStyle(again.io, item, () => {}), STYLE);
    assert.equal(again.calls.length, 0, 'the same scene is not described twice');
});

test('a describer that fails stops the job and says where it is picked', async () => {
    const { sceneStyle } = await esm('js/services/scene/scenePicture.js');
    const item = { filePath: pf('C:/P/Media/pano1.png'), scenePath: pf('C:/P/Media/.meta/fail.scene.json') };
    await assert.rejects(sceneStyle(describer({ ok: false, error: 'No API key.' }).io, item, () => {}),
        /style could not be read \(No API key\)\. Check Remote > Language Models/);
    await assert.rejects(sceneStyle(describer({ cancelled: true }).io, item, () => {}), /cancelled/);
});

test('a Klein job lands no card: deferCommit, no existingGroup; it resolves the item or rejects', async () => {
    const { kleinJob } = await esm('js/services/scene/scenePicture.js');
    const calls = [];
    const io = (outcome) => ({
        klein: { id: 'klein-9b' },
        enqueue: (config, cb, opts) => {
            calls.push({ config, opts });
            setImmediate(() => (outcome === 'ok' ? cb.onComplete({ item: { filePath: 'x.png' } })
                : outcome === 'error' ? cb.onError({ message: 'engine down' }) : cb.onCancel()));
            return true;
        },
    });
    assert.deepEqual(await kleinJob(io('ok'), 'kleinEdit', 'in.png', 'POLISH'), { filePath: 'x.png' });
    assert.deepEqual(calls[0].opts, { deferCommit: true });
    assert.equal(calls[0].config.model.id, 'klein-9b');
    assert.deepEqual(calls[0].config.mediaItems, [{ url: 'in.png', mediaType: 'image', role: 'inputImage', source: 'history' }]);
    await assert.rejects(kleinJob(io('error'), 'kleinEdit', 'in.png', 'P'), /engine down/);
    await assert.rejects(kleinJob(io('cancel'), 'kleinEdit', 'in.png', 'P'), /cancelled/);
    await assert.rejects(kleinJob({ ...io('ok'), enqueue: () => false }, 'kleinEdit', 'in.png', 'P'), /did not start/);
});

test('the colour lock: a frame keeps its colours, a drifted edit returns to the frame\'s', async () => {
    const { colorLock } = await esm('js/services/scene/scenePicture.js');
    const n = 64, src = new Uint8ClampedArray(n * 4), edit = new Uint8ClampedArray(n * 4);
    for (let i = 0; i < n; i++) {
        src.set([40 + i, 90 + (i % 7) * 9, 200 - i, 255], i * 4);
        edit.set([Math.min(255, 70 + i), 120 + (i % 7) * 9, 230 - i, 255], i * 4); // brighter, bluer
    }
    const same = colorLock(src, src);
    assert.ok(same.every((v, k) => Math.abs(v - src[k]) <= 1), 'identity within 1/255');
    const mean = (a, c) => a.filter((_, k) => k % 4 === c).reduce((s, v) => s + v, 0) / n;
    const locked = colorLock(edit, src);
    for (const c of [0, 1, 2]) {
        assert.ok(Math.abs(mean(locked, c) - mean(src, c)) < 2, `channel ${c}: ${mean(locked, c)} vs ${mean(src, c)}`);
    }
    assert.ok(locked.filter((_, k) => k % 4 === 3).every(v => v === 255));
});
