'use strict';

/**
 * MPI-959 — a photo whose EXIF tag says "turn me" is upright everywhere.
 *
 * Chromium (the canvas) and the engine's loader (`MpiLoadImage`, `exif_transpose`) both
 * show an EXIF-rotated photo UPRIGHT, so every rect, mask, paint layer and box the app
 * hands the server is in upright pixels. Sharp reads the STORED grid unless told to
 * orient. So a file lands upright on import, and every server reader that plans in
 * pixels orients first (for the files already on disk).
 *
 * Each check runs a function on the rotated file and on its upright twin (the same
 * pixels, turned and saved lossless) and wants the same answer. The fixture is a ramp,
 * so a wrong region cannot match by luck - a solid half-and-half image did (brief).
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
process.env.APP_USER_DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'image-orientation-'));

const { cropExtended } = require('../services/imageCrop.js');
const { compositeThroughMask, compositeOverlay } = require('../services/imageComposite.js');
const { viewFile } = require('../services/cardView.js');

// Stored 40x20; orientations 5-8 turn it a quarter, so the canvas shows 20x40.
const RAW_W = 40;
const RAW_H = 20;

const ENCODE = {
    jpeg: s => s.jpeg({ quality: 100, chromaSubsampling: '4:4:4' }),
    png: s => s.png(),
    webp: s => s.webp({ lossless: true }),
};

/** A ramp stored under EXIF `orientation`, plus its upright twin as a PNG. */
async function fixture(dir, orientation, tag = '', format = 'jpeg') {
    const raw = Buffer.alloc(RAW_W * RAW_H * 3);
    for (let y = 0; y < RAW_H; y++) {
        for (let x = 0; x < RAW_W; x++) {
            const i = (y * RAW_W + x) * 3;
            raw[i] = x * 6;
            raw[i + 1] = y * 12;
            raw[i + 2] = tag ? 40 : 200;
        }
    }
    const rotated = path.join(dir, `o${orientation}${tag}.${format}`);
    await ENCODE[format](sharp(raw, { raw: { width: RAW_W, height: RAW_H, channels: 3 } }))
        .withMetadata({ orientation })
        .toFile(rotated);
    const upright = path.join(dir, `o${orientation}${tag}-${format}-upright.png`);
    await sharp(rotated).autoOrient().png().toFile(upright);
    return { rotated, upright };
}

async function pixels(input) {
    const { data, info } = await sharp(input).raw().toBuffer({ resolveWithObject: true });
    return { data, size: [info.width, info.height, info.channels] };
}

/** Same size, and pixels within `meanTol` on average (0 for a lossless pair, a little for JPEG). */
async function assertSameImage(actual, expected, label, meanTol = 0) {
    const a = await pixels(actual);
    const e = await pixels(expected);
    assert.deepEqual(a.size, e.size, `${label}: size`);
    let sum = 0;
    let worst = 0;
    for (let i = 0; i < a.data.length; i++) {
        const d = Math.abs(a.data[i] - e.data[i]);
        sum += d;
        worst = Math.max(worst, d);
    }
    const mean = sum / a.data.length;
    if (meanTol === 0) assert.equal(worst, 0, `${label}: pixels differ by up to ${worst}`);
    else assert.ok(mean <= meanTol, `${label}: mean difference ${mean.toFixed(2)} (worst ${worst})`);
}

async function serve(router) {
    const app = express();
    app.use(express.json({ limit: '50mb' }));
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

// ── services/imageCrop.js ────────────────────────────────────────────────────

for (const orientation of [6, 8, 5]) {
    test(`crop: orientation ${orientation} cuts the rect the canvas showed`, async () => {
        const dir = await scratchDir('orient-crop-');
        // The overhang pads through an intermediate in the INPUT's format (a JPEG
        // re-encode for a JPEG), so it runs on a PNG, where the comparison is exact.
        const jpeg = await fixture(dir, orientation);
        const png = await fixture(dir, orientation, '', 'png');
        const rects = {
            inside: [jpeg, { x: 2, y: 5, w: 12, h: 20 }],
            resampled: [jpeg, { x: 0, y: 0, w: 20, h: 40, outW: 10, outH: 20 }],
            overhang: [png, { x: -4, y: 30, w: 20, h: 16, fill: '#00ff00' }],
        };
        for (const [name, [{ rotated, upright }, rect]] of Object.entries(rects)) {
            const got = path.join(dir, `${name}-got.png`);
            const want = path.join(dir, `${name}-want.png`);
            const size = await cropExtended(rotated, got, rect);
            await cropExtended(upright, want, rect);
            await assertSameImage(got, want, name);
            const meta = await sharp(got).metadata();
            assert.deepEqual([meta.width, meta.height], [size.width, size.height], `${name}: the size it reports`);
        }
    });
}

// ── services/imageComposite.js ───────────────────────────────────────────────

/** A canvas-drawn layer, upright-sized: `rects` opaque in `rgba`, the rest transparent. */
function layer(rects, rgba) {
    const w = RAW_H;
    const h = RAW_W;
    const data = Buffer.alloc(w * h * 4);
    for (const r of rects) {
        for (let y = r.y; y < r.y + r.h; y++) {
            for (let x = r.x; x < r.x + r.w; x++) data.set(rgba, (y * w + x) * 4);
        }
    }
    return sharp(data, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
}

for (const orientation of [6, 8]) {
    test(`composite: orientation ${orientation} - mask and paint land where they were drawn`, async () => {
        const dir = await scratchDir('orient-composite-');
        const base = await fixture(dir, orientation);
        const over = await fixture(dir, orientation === 6 ? 8 : 6, '-over');
        const maskBuffer = await layer([{ x: 0, y: 0, w: 20, h: 15 }], [255, 255, 255, 255]);
        const paint = await layer([{ x: 3, y: 25, w: 10, h: 8 }], [255, 0, 0, 255]);

        const run = async (fn, name, which) => {
            const outPath = path.join(dir, `${name}-${which}.png`);
            const size = await fn(which === 'got' ? { base: base.rotated, over: over.rotated } : { base: base.upright, over: over.upright }, outPath);
            assert.deepEqual(size, { width: RAW_H, height: RAW_W }, `${name}: upright size`);
            return outPath;
        };
        const masked = (f, outPath) => compositeThroughMask({ basePath: f.base, overlayPath: f.over, maskBuffer, outPath, feather: 0 });
        const painted = (f, outPath) => compositeOverlay({ basePath: f.base, overlayBuffer: paint, outPath, opacity: 0.75 });

        await assertSameImage(await run(masked, 'mask', 'got'), await run(masked, 'mask', 'want'), 'compositeThroughMask');
        await assertSameImage(await run(painted, 'paint', 'got'), await run(painted, 'paint', 'want'), 'compositeOverlay');
    });
}

// ── routes/projects.js: import ───────────────────────────────────────────────

async function importFile(src, { viaPath, filename = 'IMG_0001.jpg' }) {
    const root = await scratchDir('orient-import-');
    await fs.writeJson(path.join(root, 'project.json'), { id: 'p', itemGroups: [], sequenceCounters: {} });
    const { base, stop } = await serve(require('../routes/projects.js'));
    try {
        const res = await postJson(`${base}/project-media/p/upload?folderPath=${encodeURIComponent(root)}`, {
            filename,
            ...(viaPath ? { sourcePath: src } : { base64Data: `data:image/jpeg;base64,${(await fs.readFile(src)).toString('base64')}` }),
            autoSequence: true, itemId: 'aaaaaaaa-0000-0000-0000-000000000959', mediaType: 'image',
            width: RAW_H, height: RAW_W,
        });
        assert.equal(res.success, true, JSON.stringify(res));
        const sidecar = await fs.readJson(path.join(root, 'Media', '.meta', 'aaaaaaaa-0000-0000-0000-000000000959.json'));
        assert.deepEqual(sidecar.pixelDimensions, { w: RAW_H, h: RAW_W }, 'the sidecar holds the upright size');
        return res.filePath;
    } finally {
        await stop();
    }
}

for (const viaPath of [true, false]) {
    test(`import (${viaPath ? 'disk path' : 'base64'}): an orientation-6 photo lands upright, its tag at 1`, async () => {
        const dir = await scratchDir('orient-src-');
        const { rotated, upright } = await fixture(dir, 6);
        const landed = await importFile(rotated, { viaPath });
        const meta = await sharp(landed).metadata();
        assert.equal(meta.format, 'jpeg');
        assert.deepEqual([meta.width, meta.height], [RAW_H, RAW_W], 'stored upright');
        assert.equal(meta.orientation ?? 1, 1, 'no turn left for anything to apply twice');
        // Re-encoded once (q95): close to the upright twin, nowhere near a wrong turn.
        await assertSameImage(landed, upright, 'landed pixels', 3);
    });
}

// PNG carries its tag in an eXIf chunk and Chromium honours it; Chromium IGNORES a WebP's,
// so the renderer sends the stored size for one - the sidecar must not keep it.
for (const format of ['png', 'webp']) {
    test(`import: an orientation-6 ${format} lands upright, its tag at 1`, async () => {
        const dir = await scratchDir('orient-src-');
        const { rotated, upright } = await fixture(dir, 6, '', format);
        const landed = await importFile(rotated, { viaPath: true, filename: `IMG_0001.${format}` });
        const meta = await sharp(landed).metadata();
        assert.equal(meta.format, format);
        assert.deepEqual([meta.width, meta.height], [RAW_H, RAW_W], 'stored upright');
        assert.equal(meta.orientation ?? 1, 1);
        await assertSameImage(landed, upright, 'landed pixels', format === 'png' ? 0 : 3);
    });
}

test('import: a photo with nothing to turn is copied byte for byte', async () => {
    const dir = await scratchDir('orient-src-');
    const { rotated } = await fixture(dir, 1);
    const landed = await importFile(rotated, { viaPath: true });
    assert.ok((await fs.readFile(landed)).equals(await fs.readFile(rotated)));
});

// ── services/cardView.js ─────────────────────────────────────────────────────

test('view_card: the size it reports is the size of the picture it returns', async () => {
    const dir = await scratchDir('orient-view-');
    const { rotated } = await fixture(dir, 6);
    const v = await viewFile(rotated);
    const shown = await sharp(v.data).metadata();
    assert.deepEqual([v.width, v.height], [RAW_H, RAW_W]);
    assert.deepEqual([shown.width, shown.height], [RAW_H, RAW_W]);
});

// ── routes/llm.js ────────────────────────────────────────────────────────────

/** Run /llm/describe against a stubbed DeepInfra and return the JPEG it sent. */
async function llmDescribe(body) {
    let sent = null;
    const real = global.fetch;
    global.fetch = (url, init) => {
        if (String(url).startsWith('http://127.0.0.1')) return real(url, init);
        const user = JSON.parse(init.body).messages.find(m => m.role === 'user');
        sent = Buffer.from(user.content.find(p => p.type === 'image_url').image_url.url.split(',')[1], 'base64');
        const payload = { choices: [{ message: { content: 'A ramp.' } }], usage: null };
        return Promise.resolve({ ok: true, status: 200, statusText: 'OK', json: async () => payload, text: async () => JSON.stringify(payload) });
    };
    const prevKey = process.env.DEEPINFRA_API_KEY;
    process.env.DEEPINFRA_API_KEY = 'test-key';
    const { base, stop } = await serve(require('../routes/llm'));
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

test('/llm/describe: the describer sees the photo upright, and a crop is an upright rect', async () => {
    const dir = await scratchDir('orient-llm-');
    const { rotated, upright } = await fixture(dir, 6);
    await assertSameImage(await llmDescribe({ imagePath: rotated }), upright, 'whole photo', 3);
    const wantCrop = await sharp(upright).extract({ left: 0, top: 20, width: 20, height: 10 }).png().toBuffer();
    await assertSameImage(await llmDescribe({ imagePath: rotated, crop: { x: 0, y: 20, width: 20, height: 10 } }), wantCrop, 'crop', 3);
});

// ── routes/connector.js ──────────────────────────────────────────────────────

/** POST /connector/describe with a fake renderer that answers `text`; returns [response, relayed input]. */
async function connectorDescribe(body, text) {
    const { base, stop } = await serve(require('../routes/connector'));
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
        const job = await Promise.race([nextFrame(), pending.then(r => {
            throw new Error(`answered without relaying a job: ${JSON.stringify(r)}`);
        })]);
        await postJson(`${base}/connector/jobs/${job.data.jobId}/result`, { ok: true, output: { text } });
        return [await pending, job.data.input];
    } finally {
        ac.abort();
        await stop();
    }
}

test('/connector/describe: the agent is told the upright size, and its crop is an upright rect', async () => {
    const dir = await scratchDir('orient-connector-');
    const { rotated, upright } = await fixture(dir, 6);
    // Stored 40x20: this rect is out of bounds unless the route reads the upright 20x40.
    const [res, input] = await connectorDescribe({ imagePath: rotated, question: 'What?', crop: { x: 0, y: 20, width: 20, height: 10 } }, 'A ramp.');
    assert.equal(res.ok, true, JSON.stringify(res));
    assert.deepEqual(res.output.imageSize, { w: RAW_H, h: RAW_W });
    const wantCrop = await sharp(upright).extract({ left: 0, top: 20, width: 20, height: 10 }).png().toBuffer();
    await assertSameImage(input.imagePath, wantCrop, 'crop the describer saw', 3);
});

// ── routes/gifMake.js ────────────────────────────────────────────────────────

test('GIF from stills: a rotated photo makes an upright frame', async () => {
    const root = await scratchDir('orient-gif-');
    const mediaDir = path.join(root, 'Media');
    await fs.ensureDir(path.join(mediaDir, '.meta'));
    await fs.writeJson(path.join(root, 'project.json'), { id: 'p', itemGroups: [], sequenceCounters: {} });
    const { rotated, upright } = await fixture(mediaDir, 6);
    const id = 'aaaaaaaa-0000-0000-0000-000000000959';
    await fs.writeJson(path.join(mediaDir, '.meta', `${id}.json`), {
        id, type: 'image', filePath: `/project-file?path=${encodeURIComponent(rotated)}`,
        pixelDimensions: { w: RAW_H, h: RAW_W }, uploaded: true,
    });
    const { base, stop } = await serve(require('../routes/gifMake.js'));
    try {
        const res = await postJson(`${base}/gif/make`, { folderPath: root, itemIds: [id, id] });
        assert.equal(res.success, true, JSON.stringify(res));
        const frame = require('../services/gifFrames').frameAbsPath(mediaDir, res.item.gif.frames[0].hash);
        await assertSameImage(await sharp(frame).removeAlpha().png().toBuffer(), upright, 'frame');
    } finally {
        await stop();
    }
});
