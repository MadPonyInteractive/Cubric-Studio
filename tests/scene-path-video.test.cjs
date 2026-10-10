'use strict';
/**
 * MPI-623 P2: a camera path's guide frames become ONE video for the engine (routes/projects.js
 * `frames-to-video`): the frames in order, the hole mask's edges unsmeared (4:4:4), and the
 * per-frame PNGs gone afterwards. Mounted router, throwaway project folder, the app's ffmpeg.
 *
 * Run: node --test tests/scene-path-video.test.cjs
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const express = require('express');
const sharp = require('sharp');
const router = require('../routes/projects');
const { ffprobePath } = require('../services/ffmpegBinary');

async function serve() {
    const app = express();
    app.use(express.json({ limit: '10mb' }));
    app.use(router);
    const s = await new Promise((resolve) => { const srv = app.listen(0, '127.0.0.1', () => resolve(srv)); });
    return { s, base: `http://127.0.0.1:${s.address().port}` };
}

const { pathToFileURL } = require('node:url');
const esm = (p) => import(pathToFileURL(path.join(__dirname, '..', p)).href);

/** An io that records what renderPath asks of the app; `landed` is what the engine hands back. */
function fakeIo({ landed = { id: 'v1', filePath: '/project-file?path=v.mp4' }, start = true } = {}) {
    const calls = { renders: [], posts: [], enqueue: [], encode: [] };
    const io = {
        describe: async () => ({ ok: true, text: 'A stylized 3D cartoon render.' }),
        renderPano: (view, renderer, frame) => {
            calls.renders.push(frame);
            return { w: 2, h: 1, rgba: new Uint8ClampedArray([9, 9, 9, 255, 8, 8, 8, 255]), mask: new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255]) };
        },
        encodePng: async (rgba, w, h) => { calls.encode.push({ rgba: [...rgba], w, h }); return new Blob(['png']); },
        blobToDataUrl: async () => 'data:image/png;base64,AA==',
        post: async (url, body) => {
            calls.posts.push({ url, body });
            if (url.includes('place-preview-asset')) return { sha256: String(calls.posts.length).padStart(64, '0') };
            return { filePath: '/project-file?path=guide.mp4' };
        },
        enqueue: (config, cb) => { calls.enqueue.push(config); if (start) queueMicrotask(() => cb.onComplete({ item: landed })); return start; },
    };
    return { io, calls };
}
const PROJECT = { id: 'p', folderPath: 'C:/P' };
const SCENE = { scenePath: '/project-file?path=s.scene.json', filePath: '/project-file?path=s.png' };

test('renderPath: 81 guide frames over their holes -> one guide video -> the scenePathVideo op', async () => {
    const { renderPath, PATH_LINE } = await esm('js/services/scene/scenePathVideo.js');
    const { io, calls } = fakeIo();
    const steps = [];
    const item = await renderPath({ project: PROJECT, sceneItem: SCENE, view: {}, renderer: {}, points: [[0, 0, 0], [0, 0, -1]],
        fillLine: ' a cosy room ', onStep: (s) => steps.push(s) }, io);
    assert.equal(item.id, 'v1');
    assert.equal(calls.renders.length, 81);
    assert.deepEqual(calls.renders[0].pos, [0, 0, 0], 'frame 0 is the pano');
    assert.deepEqual(calls.encode[0], { rgba: [9, 9, 9, 255, 8, 8, 8, 255, 255, 255, 255, 255, 0, 0, 0, 255], w: 2, h: 2 }, 'the frame over its holes');
    const video = calls.posts.at(-1);
    assert.match(video.url, /^\/project-media\/p\/frames-to-video\?folderPath=C%3A%2FP$/);
    assert.equal(video.body.frames.length, 81);
    assert.deepEqual(video.body.frames, calls.posts.slice(0, 81).map((_, i) => String(i + 1).padStart(64, '0')), 'in order');
    const [config] = calls.enqueue;
    assert.equal(config.operation, 'scenePathVideo');
    assert.deepEqual(config.model, { id: null, mediaType: 'video' });
    assert.deepEqual(config.mediaItems, [{ url: '/project-file?path=guide.mp4', mediaType: 'video', role: 'video1' }]);
    assert.equal(config.positive, `${PATH_LINE} A stylized 3D cartoon render. a cosy room`);
    assert.deepEqual([...new Set(steps)], ['style', 'guide', 'upload', 'wan']);
});

test('renderPath: no second point, a stop, a refused start', async () => {
    const { renderPath } = await esm('js/services/scene/scenePathVideo.js');
    const args = { project: PROJECT, sceneItem: SCENE, view: {}, renderer: {}, points: [[0, 0, 0], [1, 0, 0]] };
    await assert.rejects(renderPath({ ...args, points: [[0, 0, 0]] }, fakeIo().io), /second point/);
    const stop = new AbortController(); stop.abort();
    const a = fakeIo();
    await assert.rejects(renderPath({ ...args, sceneItem: { ...SCENE, scenePath: 'other' }, signal: stop.signal }, a.io), /cancelled/);
    assert.equal(a.calls.enqueue.length, 0, 'nothing reaches the engine');
    await assert.rejects(renderPath({ ...args, sceneItem: { ...SCENE, scenePath: 'third' } }, fakeIo({ start: false }).io), /did not start/);
});

test('renderPath: the same path again while it renders is refused, another path queues, a landed one renders again', async () => {
    const { renderPath } = await esm('js/services/scene/scenePathVideo.js');
    const { io } = fakeIo();
    const held = [];
    io.enqueue = (config, cb) => { held.push(cb); return true; };
    const args = { project: PROJECT, sceneItem: { ...SCENE, scenePath: 'held' }, view: {}, renderer: {}, points: [[0, 0, 0], [1, 0, 0]] };
    const first = renderPath(args, io);
    const dup = renderPath({ ...args, fillLine: ' ' }, io).then(() => 'ran', (e) => e.code);
    assert.equal(await Promise.race([dup, new Promise((r) => setImmediate(() => r('still running')))]), 'rendering',
        'same scene, points and fill line: refused at once');
    const other = renderPath({ ...args, points: [[0, 0, 0], [0, 0, -1]] }, io);
    while (held.length < 2) await new Promise((r) => setImmediate(r));
    held.forEach((cb) => cb.onComplete({ item: { id: 'v', filePath: 'v.mp4' } }));
    await Promise.all([first, other]);
    assert.equal((await renderPath(args, fakeIo().io)).id, 'v1', 'landed: the same path may render again');
});

test('pathEtaMin: the measured runs; other cards scale the 5090 Pod run by the Gen speed table; an unmeasured card has none', async () => {
    const { pathEtaMin } = await esm('js/services/scene/scenePathVideo.js');
    assert.equal(pathEtaMin('NVIDIA GeForce RTX 5090'), 7, 'measured on a Pod: 420 s');
    assert.equal(pathEtaMin('NVIDIA GeForce RTX 4060 Ti'), 30, 'measured locally: 1810 s');
    assert.equal(pathEtaMin('NVIDIA RTX PRO 6000 Blackwell Server Edition'), 5, 'a faster card is quicker (1.51 s vs 2.28 s an image)');
    assert.equal(pathEtaMin('NVIDIA RTX 2000 Ada Generation'), 40, 'a slower card takes longer');
    assert.equal(pathEtaMin('NVIDIA GeForce RTX 3060'), null, 'nobody measured it');
    assert.equal(pathEtaMin(null), null);
    assert.equal(pathEtaMin('constructor'), null, 'a name is looked up, never a property');
});

test('frames-to-video: placed frames -> one 4:4:4 video in the store, the frames removed', async (t) => {
    const project = fs.mkdtempSync(path.join(os.tmpdir(), 'p2-guide-'));
    const store = path.join(project, 'Media', '.preview-assets');
    fs.mkdirSync(store, { recursive: true });
    const shas = [];
    for (const v of [0, 128, 255]) {
        const png = await sharp({ create: { width: 64, height: 32, channels: 3, background: { r: v, g: 255 - v, b: 40 } } }).png().toBuffer();
        const sha = crypto.createHash('sha256').update(png).digest('hex');
        fs.writeFileSync(path.join(store, `${sha}.png`), png);
        shas.push(sha);
    }
    const { s, base } = await serve();
    t.after(() => { s.close(); fs.rmSync(project, { recursive: true, force: true }); });
    const post = (body) => fetch(`${base}/project-media/p/frames-to-video?folderPath=${encodeURIComponent(project)}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

    const res = await post({ frames: [...shas, shas[0]], fps: 16 });
    const out = await res.json();
    assert.equal(res.status, 200, JSON.stringify(out));
    assert.equal(path.dirname(out.absPath), store);
    assert.match(path.basename(out.absPath), /^[0-9a-f]{64}\.mp4$/);
    const probe = JSON.parse(execFileSync(ffprobePath, ['-v', 'error', '-count_frames', '-select_streams', 'v:0',
        '-show_entries', 'stream=width,height,pix_fmt,nb_read_frames,r_frame_rate', '-of', 'json', out.absPath]).toString()).streams[0];
    assert.deepEqual([probe.width, probe.height, probe.pix_fmt, Number(probe.nb_read_frames), probe.r_frame_rate], [64, 32, 'yuv444p', 4, '16/1']);
    for (const sha of shas) assert.ok(!fs.existsSync(path.join(store, `${sha}.png`)), 'a frame is gone once encoded');

    assert.equal((await post({ frames: ['../../secret'] })).status, 400, 'only store hashes, never a path');
    assert.equal((await post({ frames: [] })).status, 400);
});
