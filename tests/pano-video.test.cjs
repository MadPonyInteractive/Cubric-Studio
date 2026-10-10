'use strict';
/**
 * MPI-623 P3: Take picture in a path video's 360 player (js/services/scene/panoVideo.js). The view
 * on screen is rendered at the picture's size, cleaned up by Klein (POLISH, no card of its own),
 * colour-locked to the render, and saved as a NEW image card carrying its pose, frame and video.
 * The shader's layout is checked live against stitchPano (validation.md § P3 player).
 *
 * Run: node --test tests/pano-video.test.cjs
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const esm = (p) => import(pathToFileURL(path.join(__dirname, '..', p)).href);

test('takeVideoPicture: the view at the picture size -> Klein POLISH -> colour lock -> a new card', async () => {
    const { takeVideoPicture } = await esm('js/services/scene/panoVideo.js');
    const { POLISH } = await esm('js/services/scene/scenePicture.js');
    const steps = [], calls = { renders: [], enqueue: [], posts: [], saved: [] };
    const view = { picture: (renderer, pose, size) => { calls.renders.push({ pose, size }); return { ...size, rgba: new Uint8ClampedArray(size.w * size.h * 4).fill(100) }; } };
    const io = {
        encodePng: async (rgba, w, h) => new Blob([`png ${w}x${h} ${rgba[0]}`]),
        blobToDataUrl: async () => 'data:image/png;base64,AA==',
        post: async (url, body) => { calls.posts.push({ url, body }); return { filePath: '/project-file?path=frame.png' }; },
        klein: { id: 'klein-9b' },
        enqueue: (config, cb, opts) => { calls.enqueue.push({ config, opts }); queueMicrotask(() => cb.onComplete({ item: { filePath: '/project-file?path=clean.png' } })); return true; },
        // Klein's colours drifted (200); the lock pins them back to the render's (100).
        pixelsAt: async (url, w, h) => new Uint8ClampedArray(w * h * 4).fill(url.includes('clean') ? 200 : 100),
        savePictureCard: async (project, blob, size, scenePose) => { calls.saved.push({ text: await blob.text(), size, scenePose }); return { group: { id: 'g' }, entry: { id: 'e' } }; },
    };
    const pose = { pos: [0, 0, 0], yaw: 0.5, pitch: -0.1, roll: 0, mm: 35 };
    const out = await takeVideoPicture({ project: { id: 'p', folderPath: 'C:/P' }, view, renderer: {}, pose, aspect: '16:9', frame: 40,
        videoItem: { id: 'vid1' }, onStep: (s) => steps.push(s) }, io);
    assert.deepEqual(steps, ['render', 'clean', 'save']);
    assert.deepEqual(calls.renders, [{ pose, size: { w: 1360, h: 768 } }], 'the view on screen, at Klein\'s 16:9 size');
    assert.match(calls.posts[0].url, /place-preview-asset/);
    const [{ config, opts }] = calls.enqueue;
    assert.equal(config.operation, 'kleinEdit');
    assert.equal(config.positive, POLISH);
    assert.equal(config.mediaItems[0].url, '/project-file?path=frame.png', 'Klein cleans the rendered view');
    assert.deepEqual(opts, { deferCommit: true }, 'the clean-up lands no card of its own');
    assert.equal(calls.saved.length, 1);
    assert.equal(calls.saved[0].text, 'png 1360x768 100', 'colour-locked back to the render');
    assert.deepEqual(calls.saved[0].scenePose, { ...pose, aspect: '16:9', frame: 40, video: 'vid1' });
    assert.equal(out.entry.id, 'e');
});
