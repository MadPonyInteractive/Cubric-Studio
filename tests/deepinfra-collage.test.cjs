'use strict';

/**
 * deepinfra-collage.test.cjs — MPI-919.
 *
 * DeepInfra's Nano Banana endpoints take ONE image, so up to four prompt-box references
 * are collaged into one sheet server-side. Held down here:
 *   - the sheet's geometry, and that each reference lands in the cell its NUMBER names;
 *   - the output ratio follows IMAGE 1, not the sheet;
 *   - only a `referenceCollage` model is offered more than one reference;
 *   - the executor sends every reference in strip order, and a sheet prices as one image;
 *   - every shipped model's OUTPUT shape (base64, a link in `images`, `image_url`, `videos`)
 *     becomes real media, and bytes of no known type are refused, never saved.
 * No provider call: the stubbed shapes are enough, and a real one spends money.
 */

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const sharp = require('sharp');

const { buildCollage, collagePreamble } = require('../routes/deepinfraCollage.js');
const { getAvailableCommands } = require('../js/data/commandRegistry.js');
const { MODELS } = require('../js/data/modelConstants/models.js');
const { cloudRunFields, estimateRunCost } = require('../js/services/cloudExecutor.js');

const COLOURS = [[220, 30, 30], [30, 60, 220], [30, 170, 60], [230, 200, 20]];

async function refs(count, sizes = []) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mpi919-'));
    return Promise.all(COLOURS.slice(0, count).map(async ([r, g, b], i) => {
        const [width, height] = sizes[i] || [600, 600];
        const file = path.join(dir, `ref${i + 1}.png`);
        await sharp({ create: { width, height, channels: 3, background: { r, g, b } } }).png().toFile(file);
        return file;
    }));
}

async function pixel(jpeg, x, y) {
    const { data, info } = await sharp(jpeg).raw().toBuffer({ resolveWithObject: true });
    const i = (y * info.width + x) * info.channels;
    return [data[i], data[i + 1], data[i + 2]];
}

function near(actual, expected, label) {
    assert.ok(actual.every((v, i) => Math.abs(v - expected[i]) < 24), `${label}: got ${actual}, want ${expected}`);
}

// Image 1 fills a 1536 square on the left; the rest stack in a 640-wide column right of a
// 16 px gutter (column x = 1552..2192). The layout that beat an even grid in a paid A/B.
test('image 1 takes the big left cell, the others stack in the right column in number order', async () => {
    const two = await buildCollage(await refs(2));
    const twoMeta = await sharp(two.jpeg).metadata();
    assert.deepEqual([twoMeta.width, twoMeta.height], [2192, 1536]);
    near(await pixel(two.jpeg, 768, 768), COLOURS[0], 'image 1 big cell');
    near(await pixel(two.jpeg, 1872, 768), COLOURS[1], 'image 2 column');

    const four = await buildCollage(await refs(4));
    const cell = Math.floor((1536 - 2 * 16) / 3);
    for (let j = 0; j < 3; j++) {
        near(await pixel(four.jpeg, 1872, j * (cell + 16) + Math.floor(cell / 2)), COLOURS[j + 1], `image ${j + 2}`);
    }
    near(await pixel(four.jpeg, 768, 768), COLOURS[0], 'image 1 big cell');
});

test('a reference is contained, never cropped: a wide image 1 leaves grey above and below', async () => {
    const sheet = await buildCollage(await refs(2, [[1200, 400], [600, 600]]));
    near(await pixel(sheet.jpeg, 768, 20), [128, 128, 128], 'pad above image 1');
    near(await pixel(sheet.jpeg, 20, 768), COLOURS[0], 'image 1 reaches the cell edge');
});

test('the output ratio is IMAGE 1\'s, not the sheet\'s', async () => {
    const sheet = await buildCollage(await refs(3, [[720, 1280], [800, 800], [1000, 500]]));
    assert.deepEqual([sheet.width, sheet.height], [720, 1280]);
});

test('the preamble numbers the cells the way the grid lays them out', () => {
    assert.match(collagePreamble(2), /Image 1 is the large picture on the left, Image 2 the small one on the right\./);
    assert.match(collagePreamble(4), /Image 3 the small one in the middle right, Image 4 the small one at the bottom right\./);
    assert.match(collagePreamble(3), /3 separate images/);
    assert.match(collagePreamble(4), /Instruction: $/, 'the user prompt is appended after it');
});

test('only a referenceCollage model is offered more than one edit reference', () => {
    const edit = (model, imageCount) => getAvailableCommands('image', model, { imageCount })
        .find(c => c.key === 'edit')?.available;
    const lite = MODELS.find(m => m.id === 'nano-banana-2-lite-cloud');
    const boogu = MODELS.find(m => m.id === 'boogu-edit-high');
    assert.equal(edit(lite, 4), true);
    assert.equal(edit(lite, 5), false, 'four is the cap');
    assert.equal(edit(boogu, 1), true);
    assert.equal(edit(boogu, 2), false, 'Boogu\'s graph has one image slot');
    for (const id of ['nano-banana-2-lite-cloud', 'nano-banana-2-cloud', 'nano-banana-pro-cloud']) {
        assert.equal(MODELS.find(m => m.id === id).capabilities.referenceCollage, true, id);
    }
});

test('a gallery image travels as a DISK path, never as its /project-file URL', () => {
    // The shape a staged gallery card really has (read off a sidecar, 2026-09-25): filePath
    // IS the renderer URL. Sent raw, the route could not read it, so no edit saw its image.
    const lite = MODELS.find(m => m.id === 'nano-banana-2-lite-cloud');
    const url = '/project-file?path=C%3A%5CUsers%5CFabio%5CProjects%5CKaiju%5CMedia%5Ct2i_002.png&v=1790314891991';
    const items = [{ mediaType: 'image', url, filePath: url }, { mediaType: 'image', filePath: 'D:\\refs\\dog.png' }];
    assert.deepEqual(cloudRunFields(lite, {}, items).imagePaths,
        ['C:\\Users\\Fabio\\Projects\\Kaiju\\Media\\t2i_002.png', 'D:\\refs\\dog.png']);
});

test('a prompt-box chip, which carries only `url`, reaches the route as a disk path', () => {
    // What the executor is really handed at dispatch: the chip `_tryAddMedia` builds
    // (MpiPromptBox.js), `{ id, url, file, mediaType, source }`, with NO filePath. The
    // sidecar shape above is a later clone. Reading only filePath sent every in-app edit
    // with no reference: a paid text-to-image before 214955b7, a refusal after it.
    const lite = MODELS.find(m => m.id === 'nano-banana-2-lite-cloud');
    const chip = (name) => ({ id: name, url: `/project-file?path=C%3A%5Cp%5CMedia%5C${name}`, file: null, mediaType: 'image', source: 'app' });
    const items = [chip('t2i_002.png'), chip('dog.png')];
    assert.deepEqual(cloudRunFields(lite, {}, items).imagePaths, ['C:\\p\\Media\\t2i_002.png', 'C:\\p\\Media\\dog.png']);
    // And the price tag counts the reference: with none it quoted a text-to-image.
    assert.ok(estimateRunCost(lite, {}, items).usd > estimateRunCost(lite, {}, []).usd);
});

test('an edit with no reference is REFUSED before any key or provider is touched', async () => {
    const express = require('express');
    const app = express();
    app.use(express.json());
    app.use(require('../routes/deepinfra.js'));
    const server = await new Promise(r => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
    const realFetch = global.fetch;
    let upstream = false;
    global.fetch = async (url, init) => {
        if (String(url).includes('deepinfra.com')) { upstream = true; throw new Error('must not reach the provider'); }
        return realFetch(url, init);
    };
    try {
        const res = await fetch(`http://127.0.0.1:${server.address().port}/deepinfra/generate`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ modelId: 'nano-banana-2-lite-cloud', operation: 'edit', prompt: 'swap the boat', imagePaths: [] }),
        });
        const json = await res.json();
        assert.equal(res.status, 400);
        assert.equal(json.ok, false);
        assert.equal(upstream, false);
    } finally {
        global.fetch = realFetch;
        server.close();
    }
});

test('the executor sends every reference in strip order, and a sheet prices as one image', () => {
    const lite = MODELS.find(m => m.id === 'nano-banana-2-lite-cloud');
    const items = ['a.png', 'b.png', 'c.png', 'd.png'].map(filePath => ({ mediaType: 'image', filePath }));
    assert.deepEqual(cloudRunFields(lite, {}, items).imagePaths, ['a.png', 'b.png', 'c.png', 'd.png']);
    assert.equal(estimateRunCost(lite, {}, items).usd, estimateRunCost(lite, {}, items.slice(0, 1)).usd);
});

test('every shipped output shape becomes real media; a link read as base64 never does', async () => {
    // The answer shapes each endpoint's schema_out publishes, measured live 2026-09-25.
    const { _outputsOf, _bytesOf, _extOf } = require('../routes/deepinfra.js');
    const png = await sharp({ create: { width: 4, height: 4, channels: 3, background: '#f00' } }).png().toBuffer();
    const link = 'https://ark.example.com/seedream/0217.jpeg?X-Tos-Algorithm=x';
    assert.deepEqual(_outputsOf({ images: [png.toString('base64')] }), [png.toString('base64')]); // Gemini, FLUX-2 dev
    assert.deepEqual(_outputsOf({ images: [link] }), [link]);                                     // Seedream
    assert.deepEqual(_outputsOf({ status: 'ok', image_url: link }), [link]);                      // FLUX-2 pro/max
    assert.deepEqual(_outputsOf({ video_url: link }), [link]);                                    // Seedance, Wan
    assert.deepEqual(_outputsOf({ status: 'ok', videos: [link, link] }), [link, link]);           // Veo
    assert.deepEqual(_outputsOf({ status: 'ok' }), []);

    assert.deepEqual(await _bytesOf(`data:image/png;base64,${png.toString('base64')}`), png);
    assert.deepEqual(await _bytesOf(png.toString('base64')), png);
    const realFetch = global.fetch;
    global.fetch = async (url) => ({ ok: url === link, status: 404, arrayBuffer: async () => png });
    try {
        assert.deepEqual(await _bytesOf(link), png);
        await assert.rejects(_bytesOf('https://gone.example.com/x'));
    } finally { global.fetch = realFetch; }

    assert.equal(_extOf(png), 'png');
    assert.equal(_extOf(Buffer.from('ffd8ffe0', 'hex')), 'jpg');
    assert.equal(_extOf(Buffer.from('000000186674797069736f6d', 'hex')), 'mp4');
    // What the route used to write for Seedream: the link itself, base64-decoded.
    assert.equal(_extOf(Buffer.from(link, 'base64')), null);
});
