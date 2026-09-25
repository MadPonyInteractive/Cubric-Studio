'use strict';

/**
 * deepinfra-collage.test.cjs — MPI-919.
 *
 * DeepInfra's Nano Banana endpoints take ONE image, so up to four prompt-box references
 * are collaged into one sheet server-side. Held down here:
 *   - the sheet's geometry, and that each reference lands in the cell its NUMBER names;
 *   - the output ratio follows IMAGE 1, not the sheet;
 *   - only a `referenceCollage` model is offered more than one reference;
 *   - the executor sends every reference in strip order, and a sheet prices as one image.
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

test('two references sit side by side, four fill a 2x2 grid, each in its numbered cell', async () => {
    const two = await buildCollage(await refs(2));
    const twoMeta = await sharp(two.jpeg).metadata();
    assert.deepEqual([twoMeta.width, twoMeta.height], [1024 * 2 + 16, 1024]);
    near(await pixel(two.jpeg, 512, 512), COLOURS[0], 'image 1 left');
    near(await pixel(two.jpeg, 1040 + 512, 512), COLOURS[1], 'image 2 right');

    const four = await buildCollage(await refs(4));
    const fourMeta = await sharp(four.jpeg).metadata();
    assert.deepEqual([fourMeta.width, fourMeta.height], [2064, 2064]);
    const centres = [[512, 512], [1552, 512], [512, 1552], [1552, 1552]];
    for (const [i, [x, y]] of centres.entries()) near(await pixel(four.jpeg, x, y), COLOURS[i], `image ${i + 1}`);
});

test('a reference is contained, never cropped: a wide image leaves grey above and below', async () => {
    const sheet = await buildCollage(await refs(2, [[1200, 400], [600, 600]]));
    near(await pixel(sheet.jpeg, 512, 20), [128, 128, 128], 'pad above image 1');
    near(await pixel(sheet.jpeg, 20, 512), COLOURS[0], 'image 1 reaches the cell edge');
});

test('the output ratio is IMAGE 1\'s, not the sheet\'s', async () => {
    const sheet = await buildCollage(await refs(3, [[720, 1280], [800, 800], [1000, 500]]));
    assert.deepEqual([sheet.width, sheet.height], [720, 1280]);
});

test('the preamble numbers the cells the way the grid lays them out', () => {
    assert.match(collagePreamble(2), /Image 1 on the left, Image 2 on the right\./);
    assert.match(collagePreamble(4), /Image 4 at the bottom right\./);
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

test('the executor sends every reference in strip order, and a sheet prices as one image', () => {
    const lite = MODELS.find(m => m.id === 'nano-banana-2-lite-cloud');
    const items = ['a.png', 'b.png', 'c.png', 'd.png'].map(filePath => ({ mediaType: 'image', filePath }));
    assert.deepEqual(cloudRunFields(lite, {}, items).imagePaths, ['a.png', 'b.png', 'c.png', 'd.png']);
    assert.equal(estimateRunCost(lite, {}, items).usd, estimateRunCost(lite, {}, items.slice(0, 1)).usd);
});
