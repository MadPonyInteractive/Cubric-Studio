'use strict';
// MPI-919: native multi-reference. The edit op shows as many slots as the model has numbered
// fields, and a megapixel-billed endpoint gets each reference shrunk to 1 MP.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const sharp = require('sharp');
const { MODELS } = require('../js/data/modelConstants/models.js');
const { _readReference, _codeForStatus } = require('../routes/deepinfra.js');

// Real upstream answers, 2026-09-25: only the first is the model refusing.
test('a refusal reads as filtered; a request we malformed reads as a provider error', () => {
    assert.equal(_codeForStatus(500, 'gemini-3.1-flash-lite-image returned no image data'), 'CONTENT_FILTERED');
    assert.equal(_codeForStatus(500, 'Request to https://aiplatform.googleapis.com/v1/x:generateContent failed with status: 400, response: {"error":{"status":"INVALID_ARGUMENT"}}'), 'PROVIDER_ERROR');
    assert.equal(_codeForStatus(422, ''), 'PROVIDER_ERROR');
    assert.equal(_codeForStatus(500, 'Request to https://x failed with status: 400, response: blocked by safety filters'), 'CONTENT_FILTERED');
    assert.equal(_codeForStatus(500, ''), 'CONTENT_FILTERED');
    assert.equal(_codeForStatus(402, ''), 'NO_CREDIT');
});

const slotsFor = async (id) => {
    const { getCommand, filterMediaInputsForModel } = await import('../js/data/commandRegistry.js');
    const model = MODELS.find(m => m.id === id);
    return filterMediaInputsForModel(getCommand('edit').mediaInputs, model).length;
};

test('edit slots match each model\'s reference fields', async () => {
    const cases = {
        'seedream-5-pro-cloud': 4, 'flux2-dev-cloud': 4, 'flux2-pro-cloud': 4, 'flux2-max-cloud': 8,
        'nano-banana-2-cloud': 4, 'seedream-4-cloud': 1,
    };
    for (const [id, n] of Object.entries(cases)) assert.equal(await slotsFor(id), n, id);
    for (const m of MODELS.filter(m => m.cloud?.imageFields)) {
        assert.equal(await slotsFor(m.id), m.cloud.imageFields.length, `${m.id} slots = fields`);
    }
});

test('a megapixel-billed reference is shrunk to one started megapixel', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mpi919-ref-'));
    const big = path.join(dir, 'big.png');
    await sharp({ create: { width: 2048, height: 1536, channels: 3, background: '#808080' } }).png().toFile(big);
    const out = await sharp(await _readReference(big, 1048576)).metadata();
    assert.ok(out.width * out.height <= 1048576, `${out.width}x${out.height}`);
    assert.ok(Math.abs(out.width / out.height - 2048 / 1536) < 0.01, 'ratio kept');
    const same = await _readReference(big);
    assert.deepEqual(same, fs.readFileSync(big), 'under the default cap = bytes untouched');
    fs.rmSync(dir, { recursive: true, force: true });
});

// Photographers load 16K frames; 16384^2 is past sharp's default 268 MP decode ceiling.
test('a 16K reference is decoded and bounded, not refused or sent raw', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mpi919-16k-'));
    const huge = path.join(dir, 'huge.jpg');
    await sharp({ create: { width: 16384, height: 16384, channels: 3, background: '#808080' }, limitInputPixels: false })
        .jpeg().toFile(huge);
    for (const cap of [undefined, 1048576]) {
        const out = await sharp(await _readReference(huge, cap)).metadata();
        assert.ok(out.width * out.height <= (cap || 4096 * 4096), `${cap}: ${out.width}x${out.height}`);
    }
    const { buildCollage } = require('../routes/deepinfraCollage.js');
    const sheet = await buildCollage([huge, huge]);
    assert.equal(sheet.width, 16384, 'image 1 size read from the header');
    fs.rmSync(dir, { recursive: true, force: true });
});

test('an EXIF-rotated photo is shrunk upright, not cropped', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mpi919-exif-'));
    const phone = path.join(dir, 'phone.jpg');
    // Stored 4000x2000, orientation 6: upright it is 2000 wide, 4000 tall.
    await sharp({ create: { width: 4000, height: 2000, channels: 3, background: '#808080' } })
        .withMetadata({ orientation: 6 }).jpeg().toFile(phone);
    const out = await sharp(await _readReference(phone, 1048576)).metadata();
    assert.ok(out.height > out.width, `${out.width}x${out.height} must be portrait`);
    assert.ok(Math.abs(out.height / out.width - 2) < 0.02, 'no crop: ratio kept');
    fs.rmSync(dir, { recursive: true, force: true });
});
