'use strict';

/**
 * MPI-925 — every user-image sharp() path reads a 16K photo.
 *
 * Photographers load 16384x16384 stills (Fabio, 2026-09-25). That is 268,435,456 px,
 * just past sharp's default `limitInputPixels` (268,402,689 = 16383^2), and the limit
 * fires on `metadata()` and on raw / joinChannel / composite inputs too, not only on a
 * decode: "Input image exceeds pixel limit". Each test below feeds a REAL 16K JPEG
 * through one fixed path; before the fix every one of them threw that error.
 *
 * Deliberately not tested here, because a 16K image cannot reach them: the GIF
 * frame-store readers (gifCutout, gifToVideo, gifTransform, gifFrames.buildGif) and
 * the ffmpeg-sourced reads in gifMaker / gifFrames.extractFramesFromGif. Make GIF is
 * the only way a still enters the frame store, and it now bounds the frame to 4096.
 */

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('fs-extra');
const os = require('node:os');
const path = require('node:path');
const express = require('express');
const sharp = require('sharp');
const { scratchDir } = require('./helpers/scratch.cjs');

// Keep this run out of the developer's app.log.
process.env.APP_USER_DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'sharp-16k-'));

const SIDE = 16384;
const NO_LIMIT = { limitInputPixels: false };

/** A real 16K JPEG on disk (~1.5 MB: a flat colour compresses to almost nothing). */
async function bigJpeg(dir, name, background) {
    const p = path.join(dir, name);
    await sharp({ create: { width: SIDE, height: SIDE, channels: 3, background }, ...NO_LIMIT })
        .jpeg({ quality: 50 }).toFile(p);
    return p;
}

let _fixtures = null;
/** Built once per file: two 16K JPEGs, ~1 s each. */
function fixtures() {
    _fixtures ??= (async () => {
        const dir = await scratchDir('sharp-16k-');
        return {
            dir,
            red: await bigJpeg(dir, 'red16k.jpg', { r: 220, g: 30, b: 30 }),
            blue: await bigJpeg(dir, 'blue16k.jpg', { r: 30, g: 30, b: 220 }),
        };
    })();
    return _fixtures;
}

/** One pixel, read without decoding all 268 MP. */
async function pixel(file, x, y) {
    const data = await sharp(file, NO_LIMIT).extract({ left: x, top: y, width: 1, height: 1 }).raw().toBuffer();
    return { r: data[0], g: data[1], b: data[2] };
}

const near = (a, b, what) => assert.ok(
    Math.abs(a.r - b.r) < 12 && Math.abs(a.g - b.g) < 12 && Math.abs(a.b - b.b) < 12,
    `${what}: ${JSON.stringify(a)} is not ${JSON.stringify(b)}`);

async function serve(router) {
    const app = express();
    app.use(express.json());
    app.use(router);
    const server = await new Promise(r => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
    return {
        base: `http://127.0.0.1:${server.address().port}`,
        stop: () => new Promise(r => server.close(r)),
    };
}

const postJson = (url, body) => fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
}).then(r => r.json());

// ── The fixture really is past the limit ─────────────────────────────────────

test('the 16K fixture is past sharp\'s default limit, metadata() included', async () => {
    const { red } = await fixtures();
    await assert.rejects(sharp(red).metadata(), /exceeds pixel limit/);
    assert.equal((await sharp(red, NO_LIMIT).metadata()).width, SIDE);
});

// ── services/imageCrop.js ────────────────────────────────────────────────────

test('cropExtended: a crop inside a 16K image', async () => {
    const { cropExtended } = require('../services/imageCrop.js');
    const { dir, red } = await fixtures();
    const out = path.join(dir, 'crop-inside.jpg');
    const size = await cropExtended(red, out, { x: 8000, y: 8000, w: 1000, h: 600 });
    assert.deepEqual(size, { width: 1000, height: 600 });
    assert.equal((await sharp(out).metadata()).width, 1000);
});

test('cropExtended: a crop that extends past a 16K image (the padded pass)', async () => {
    const { cropExtended } = require('../services/imageCrop.js');
    const { dir, red } = await fixtures();
    const out = path.join(dir, 'crop-extend.jpg');
    const size = await cropExtended(red, out, { x: -100, y: -100, w: 1000, h: 1000, fill: '#000000' });
    assert.deepEqual(size, { width: 1000, height: 1000 });
    near(await pixel(out, 500, 500), { r: 220, g: 30, b: 30 }, 'inside the source');
});

// ── services/imageComposite.js ───────────────────────────────────────────────

test('compositeThroughMask: two 16K images through a mask', async () => {
    const { compositeThroughMask } = require('../services/imageComposite.js');
    const { dir, red, blue } = await fixtures();
    // Right half white: the mask is scaled up to the base, so a small one covers 16K.
    const white = await sharp({ create: { width: 32, height: 64, channels: 3, background: '#ffffff' } }).png().toBuffer();
    const maskBuffer = await sharp({ create: { width: 64, height: 64, channels: 3, background: '#000000' } })
        .composite([{ input: white, left: 32, top: 0 }]).png().toBuffer();
    const out = path.join(dir, 'composite-mask.jpg');
    const size = await compositeThroughMask({ basePath: red, overlayPath: blue, maskBuffer, outPath: out, feather: 0 });
    assert.deepEqual(size, { width: SIDE, height: SIDE });
    near(await pixel(out, 100, 100), { r: 220, g: 30, b: 30 }, 'unmasked left = base');
    near(await pixel(out, SIDE - 100, 100), { r: 30, g: 30, b: 220 }, 'masked right = overlay');
});

test('compositeOverlay: a paint layer onto a 16K image, opacity below 1', async () => {
    const { compositeOverlay } = require('../services/imageComposite.js');
    const { dir, red } = await fixtures();
    const overlayBuffer = await sharp({ create: { width: 64, height: 64, channels: 4, background: { r: 0, g: 0, b: 255, alpha: 1 } } })
        .png().toBuffer();
    const out = path.join(dir, 'composite-overlay.jpg');
    const size = await compositeOverlay({ basePath: red, overlayBuffer, outPath: out, opacity: 0.5 });
    assert.deepEqual(size, { width: SIDE, height: SIDE });
    const px = await pixel(out, 100, 100);
    assert.ok(px.b > 90 && px.r > 90, `half-opacity blue over red: ${JSON.stringify(px)}`);
});

// ── routes/llm.js ────────────────────────────────────────────────────────────

/** Run /llm/describe against a stubbed DeepInfra and return the JPEG it sent. */
async function describe(body) {
    const llmRouter = require('../routes/llm');
    let sent = null;
    const real = global.fetch;
    global.fetch = (url, init) => {
        if (String(url).startsWith('http://127.0.0.1')) return real(url, init);
        const user = JSON.parse(init.body).messages.find(m => m.role === 'user');
        sent = Buffer.from(user.content.find(p => p.type === 'image_url').image_url.url.split(',')[1], 'base64');
        const payload = { choices: [{ message: { content: 'A red square.' } }], usage: null };
        return Promise.resolve({ ok: true, status: 200, statusText: 'OK', json: async () => payload, text: async () => JSON.stringify(payload) });
    };
    const prevKey = process.env.DEEPINFRA_API_KEY;
    process.env.DEEPINFRA_API_KEY = 'test-key';
    const { base, stop } = await serve(llmRouter);
    try {
        const res = await postJson(`${base}/llm/describe`, { profileId: 'deepinfra', modelId: 'some/vision-model', ...body });
        assert.equal(res.ok, true, `describe failed: ${JSON.stringify(res)}`);
        return sent;
    } finally {
        await stop();
        global.fetch = real;
        if (prevKey === undefined) delete process.env.DEEPINFRA_API_KEY;
        else process.env.DEEPINFRA_API_KEY = prevKey;
    }
}

test('/llm/describe: a 16K image goes out bounded to 1 MP', async () => {
    const { red } = await fixtures();
    const meta = await sharp(await describe({ imagePath: red })).metadata();
    assert.equal(meta.format, 'jpeg');
    assert.ok(meta.width * meta.height <= 1_000_000, `sent ${meta.width}x${meta.height}`);
    assert.equal(meta.width, meta.height, 'a square stays square');
});

test('/llm/describe: a crop of a 16K image', async () => {
    const { red } = await fixtures();
    const meta = await sharp(await describe({ imagePath: red, crop: { x: 100, y: 100, width: 2000, height: 1000 } })).metadata();
    assert.ok(meta.width * meta.height <= 1_000_000, `sent ${meta.width}x${meta.height}`);
    assert.ok(meta.width > meta.height, `the crop's 2:1 shape is kept: ${meta.width}x${meta.height}`);
});

// ── routes/connector.js ──────────────────────────────────────────────────────

/** POST /connector/describe with a fake renderer that answers `text`; returns [response, relayed input]. */
async function connectorDescribe(body, text) {
    const connector = require('../routes/connector');
    const { base, stop } = await serve(connector);
    const ac = new AbortController();
    try {
        const stream = await fetch(`${base}/connector/jobs/stream`, { signal: ac.signal });
        const reader = stream.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        const nextFrame = async () => {
            for (;;) {
                const i = buffer.indexOf('\n\n');
                if (i !== -1) {
                    const raw = buffer.slice(0, i);
                    buffer = buffer.slice(i + 2);
                    return { event: /^event: (.+)$/m.exec(raw)?.[1], data: JSON.parse(/^data: (.+)$/m.exec(raw)?.[1] || 'null') };
                }
                const { value, done } = await reader.read();
                if (done) throw new Error('stream closed');
                buffer += decoder.decode(value, { stream: true });
            }
        };
        assert.equal((await nextFrame()).event, 'connected');
        const pending = postJson(`${base}/connector/describe`, body);
        // A route that fails before relaying answers without a job: fail on that, never hang.
        const job = await Promise.race([nextFrame(), pending.then(r => {
            throw new Error(`answered without relaying a job: ${JSON.stringify(r)}`);
        })]);
        assert.equal(job.data.capability, 'agent.describe');
        await postJson(`${base}/connector/jobs/${job.data.jobId}/result`, { ok: true, output: { text } });
        return [await pending, job.data.input];
    } finally {
        ac.abort();
        await stop();
    }
}

test('/connector/describe: a crop of a 16K image, and its size reported', async () => {
    const { red } = await fixtures();
    const [res, input] = await connectorDescribe(
        { imagePath: red, question: 'What colour?', crop: { x: 4000, y: 4000, width: 1200, height: 800 } }, 'Red.');
    assert.equal(res.ok, true, JSON.stringify(res));
    assert.deepEqual(res.output.imageSize, { w: SIDE, h: SIDE });
    const cropped = await sharp(input.imagePath).metadata();
    assert.deepEqual([cropped.width, cropped.height], [1200, 800], 'the crop the describer saw');
});

test('/connector/describe: a box on a 16K image', async () => {
    const { red } = await fixtures();
    const [res] = await connectorDescribe(
        { imagePath: red, question: 'the red square', box: true }, '{"bbox_2d": [250, 250, 750, 750]}');
    assert.equal(res.ok, true, JSON.stringify(res));
    assert.deepEqual(res.output.imageSize, { w: SIDE, h: SIDE });
    assert.equal(res.output.box.width, SIDE / 2);
});

// ── routes/projects.js ───────────────────────────────────────────────────────

test('save-generation: a 16K result with no pixelDimensions gets its size probed', async () => {
    const http = require('node:http');
    const { red } = await fixtures();
    const root = await scratchDir('sharp-16k-save-');
    const metaDir = path.join(root, 'Media', '.meta');
    await fs.ensureDir(metaDir);
    await fs.writeJson(path.join(root, 'project.json'), { id: 'p', itemGroups: [] });
    const view = http.createServer((req, res) => fs.createReadStream(red).pipe(res));
    await new Promise(r => view.listen(0, '127.0.0.1', r));
    const { base, stop } = await serve(require('../routes/projects.js'));
    try {
        const res = await postJson(`${base}/project/save-generation`, {
            folderPath: root,
            comfyViewUrl: `http://127.0.0.1:${view.address().port}/view?filename=big_001.jpg`,
            itemId: 'aaaaaaaa-0000-0000-0000-00000000925a',
            operation: 't2i',
            mediaType: 'image',
        });
        assert.equal(res.success, true, JSON.stringify(res));
        const sidecar = await fs.readJson(path.join(metaDir, 'aaaaaaaa-0000-0000-0000-00000000925a.json'));
        assert.deepEqual(sidecar.pixelDimensions, { w: SIDE, h: SIDE });
    } finally {
        await stop();
        await new Promise(r => view.close(r));
    }
});

// ── routes/gifMake.js ────────────────────────────────────────────────────────

test('Make GIF: a 16K still is read, and stored as a frame no bigger than 4096', async () => {
    const gifFrames = require('../services/gifFrames');
    const { red, blue } = await fixtures();
    const root = await scratchDir('sharp-16k-gif-');
    const mediaDir = path.join(root, 'Media');
    const metaDir = path.join(mediaDir, '.meta');
    await fs.ensureDir(metaDir);
    await fs.writeJson(path.join(root, 'project.json'), { id: 'p', itemGroups: [], sequenceCounters: {} });
    const ids = ['aaaaaaaa-0000-0000-0000-00000000925b', 'bbbbbbbb-0000-0000-0000-00000000925c'];
    for (const [id, src] of [[ids[0], red], [ids[1], blue]]) {
        const abs = path.join(mediaDir, `${id}.jpg`);
        await fs.copy(src, abs);
        await fs.writeJson(path.join(metaDir, `${id}.json`), {
            id, type: 'image', filePath: `/project-file?path=${encodeURIComponent(abs)}`,
            pixelDimensions: { w: SIDE, h: SIDE }, uploaded: true,
        });
    }
    const { base, stop } = await serve(require('../routes/gifMake.js'));
    try {
        const res = await postJson(`${base}/gif/make`, { folderPath: root, itemIds: ids });
        assert.equal(res.success, true, `gif/make failed: ${res.error}`);
        assert.equal(res.item.gif.frames.length, 2);
        for (const f of res.item.gif.frames) {
            const m = await sharp(gifFrames.frameAbsPath(mediaDir, f.hash)).metadata();
            assert.deepEqual([m.width, m.height], [4096, 4096], 'bounded, and square stays square');
        }
    } finally {
        await stop();
    }
});
