'use strict';

/**
 * cloud-edit-follows-source.test.cjs — MPI-918 reopen (2026-10-02).
 *
 * An edit that follows its source (`imageSizedOps`) hides the ratio picker, so the request
 * carries no size. FLUX 2 dev and Klein 9B on DeepInfra do NOT follow the input then: their
 * width/height default to 1024x1024, which centre-cuts any other shape. Fabio's 1365x1024
 * crop (the original plus black bars) came back 1024x1024 with the bars cut off, which read
 * as "the first image in the card went to the cloud". Held down here:
 *   - a pixel ('wh') endpoint gets the SOURCE's shape at its own default area;
 *   - an explicit size still wins (the Flow path and the ratio picker);
 *   - Nano Banana ('aspect') and Seedream 5 Pro ('size') send nothing, as before: with no
 *     field they follow the reference (measured, research 01d section 4) or a tier;
 *   - the real route reads image 1's upright size and sends it.
 * No provider call: the provider is stubbed.
 */

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const sharp = require('sharp');

const { buildSizeFields } = require('../js/data/modelConstants/deepinfraSizing.js');

const KLEIN = 'black-forest-labs/FLUX-2-klein-9b';
const DEV = 'black-forest-labs/FLUX-2-dev';

function shapeOf(out) {
    return out.width / out.height;
}

test('a pixel endpoint with no size gets the source shape at its default area', () => {
    for (const id of [KLEIN, DEV]) {
        const out = buildSizeFields(id, { sourceWidth: 1365, sourceHeight: 1024 });
        assert.ok(out.width && out.height, `${id}: no size sent`);
        assert.ok(Math.abs(shapeOf(out) - 1365 / 1024) < 0.04, `${id}: ${out.width}x${out.height} is not 4:3`);
        assert.ok(Math.abs(out.width * out.height - 1024 * 1024) < 0.06 * 1024 * 1024, `${id}: ${out.width}x${out.height} is not ~1 MP`);
    }
    const tall = buildSizeFields(KLEIN, { sourceWidth: 1080, sourceHeight: 1920 });
    assert.ok(tall.height > tall.width, `portrait came back ${tall.width}x${tall.height}`);
    // A 32K panorama still lands inside the endpoint's 1920 box, its shape kept to within
    // FLUX's 32 px grid (8:1 comes back 1920x256, 7.5:1).
    const pano = buildSizeFields(KLEIN, { sourceWidth: 32000, sourceHeight: 4000 });
    assert.ok(pano.width <= 1920 && Math.abs(Math.log(shapeOf(pano) / 8)) < 0.1, `${pano.width}x${pano.height}`);
});

test('an explicit size wins over the source (Flows, the ratio picker)', () => {
    const out = buildSizeFields(KLEIN, { width: 1024, height: 1024, sourceWidth: 1365, sourceHeight: 1024 });
    assert.deepEqual([out.width, out.height], [1024, 1024]);
});

test('no source and no size still sends nothing (t2i keeps the provider default)', () => {
    assert.deepEqual(buildSizeFields(KLEIN, {}), {});
});

test('Nano Banana and Seedream 5 Pro send no size for a source: they follow it already', () => {
    assert.deepEqual(buildSizeFields('google/nano-banana-2-lite', { sourceWidth: 1365, sourceHeight: 1024 }), {});
    assert.deepEqual(buildSizeFields('ByteDance/Seedream-5.0-Pro', { sourceWidth: 1365, sourceHeight: 1024 }), {});
});

test('the route sends image 1\'s upright shape for a Klein 9B cloud edit with no size', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mpi918-src-'));
    const file = path.join(dir, 'crop.png');
    await sharp({ create: { width: 1365, height: 1024, channels: 3, background: { r: 0, g: 0, b: 0 } } }).png().toFile(file);
    // A phone portrait stored landscape with EXIF 6: upright it is TALL.
    const turned = path.join(dir, 'turned.jpg');
    await sharp({ create: { width: 1600, height: 900, channels: 3, background: { r: 90, g: 90, b: 90 } } })
        .withMetadata({ orientation: 6 }).jpeg().toFile(turned);

    const express = require('express');
    const app = express();
    app.use(express.json({ limit: '50mb' }));
    app.use(require('../routes/deepinfra.js'));
    const server = await new Promise(r => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
    process.env.DEEPINFRA_API_KEY = 'test-key';
    const real = global.fetch;
    const sent = [];
    global.fetch = async (url, init = {}) => {
        url = String(url);
        if (url.startsWith('http://127.0.0.1')) return real(url, init);
        if (url.startsWith('https://api.deepinfra.com/v1/inference/')) {
            sent.push(JSON.parse(init.body));
            return new Response(JSON.stringify({ detail: 'stubbed' }), { status: 500 });
        }
        throw new Error(`unexpected fetch ${url}`);
    };
    const post = (imagePath) => fetch(`http://127.0.0.1:${server.address().port}/deepinfra/generate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelId: 'klein-9b-cloud', operation: 'edit', prompt: 'fill the black areas',
            imagePaths: [imagePath], media: [{ mediaType: 'image', role: 'inputImage', path: imagePath }] }),
    }).then(r => r.json());
    try {
        await post(file);
        await post(turned);
    } finally {
        global.fetch = real;
        delete process.env.DEEPINFRA_API_KEY;
        server.close();
        fs.rmSync(dir, { recursive: true, force: true });
    }
    assert.equal(sent.length, 2, 'the provider was not called');
    assert.ok(sent[0].width && sent[0].height, `no size sent: ${JSON.stringify(Object.keys(sent[0]))}`);
    assert.ok(Math.abs(sent[0].width / sent[0].height - 1365 / 1024) < 0.04, `${sent[0].width}x${sent[0].height}`);
    assert.ok(sent[1].height > sent[1].width, `EXIF 6 portrait sent as ${sent[1].width}x${sent[1].height}`);
});
