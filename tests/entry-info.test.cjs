'use strict';

/**
 * MPI-1162 — what the card-info hover flyout says about one history entry.
 * Pins the field set (and that seed and resolution never appear), the upload labels,
 * the Flow operation, the generation-time format the gallery card shares, and that an
 * empty value drops its row instead of showing a blank.
 */

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

let E;
let M;

test.before(async () => {
    const load = (rel) => import(pathToFileURL(path.join(__dirname, '..', ...rel.split('/'))).href);
    E = await load('js/utils/entryInfo.js');
    M = await load('js/data/modelRegistry.js');
});

const labels = (info) => info.rows.map(r => r.label);
const value = (info, label) => info.rows.find(r => r.label === label)?.value;

test('a generated image shows model, operation, time and date, never the seed or size', () => {
    const model = M.getModelById('sdxl-realistic');
    const tier = M.tierLetterFor(model);
    const info = E.entryInfo({
        type: 'image', modelId: 'sdxl-realistic', operation: 't2i',
        generationMs: 42_000, pixelDimensions: { w: 1792, h: 1120 },
        createdAt: '2026-10-16T19:00:00Z', seed: 987654321,
        prompt: '  a woman in white  ', negativePrompt: 'blurry', notes: 'keep',
    });
    assert.deepStrictEqual(labels(info), ['Model', 'Operation', 'Took', 'Created']);
    assert.strictEqual(value(info, 'Model'), `${model.name}${tier ? ` ${tier}` : ''}`);
    assert.strictEqual(value(info, 'Operation'), 'Text to Image');
    assert.strictEqual(value(info, 'Took'), '42s');
    assert.ok(!JSON.stringify(info).includes('1792'), 'resolution is on the row already');
    assert.strictEqual(info.prompt, 'a woman in white');
    assert.strictEqual(info.negativePrompt, 'blurry');
    assert.strictEqual(info.notes, 'keep');
    assert.ok(!JSON.stringify(info).includes('987654321'), 'seed must not reach the flyout');
});

test('an import says Imported, a recording says Recorded, and neither names an operation', () => {
    const imported = E.entryInfo({ type: 'image', uploaded: true, operation: 'upload', pixelDimensions: { w: 10, h: 10 } });
    assert.strictEqual(value(imported, 'Model'), 'Imported');
    assert.strictEqual(value(imported, 'Operation'), undefined);
    const recorded = E.entryInfo({ type: 'video', uploaded: true, operation: 'recorded' });
    assert.strictEqual(value(recorded, 'Model'), 'Recorded');
});

test('a Flow card names the Flow as its operation', () => {
    const info = E.entryInfo({ type: 'video', flowId: 'ltx-extend', modelId: null });
    assert.strictEqual(value(info, 'Operation'), 'Extend Video');
});

test('empty values drop their row; no item means no flyout', () => {
    const info = E.entryInfo({ type: 'image' });
    assert.deepStrictEqual(info.rows, []);
    assert.strictEqual(info.prompt, '');
    assert.strictEqual(E.entryInfo(null), null);
    assert.strictEqual(E.entryInfo(undefined), null);
});

test('generation time matches the gallery card format', () => {
    assert.strictEqual(E.formatGenTime(0), '');
    assert.strictEqual(E.formatGenTime(undefined), '');
    assert.strictEqual(E.formatGenTime(400), '1s');
    assert.strictEqual(E.formatGenTime(59_400), '59s');
    assert.strictEqual(E.formatGenTime(180_000), '3m');
    assert.strictEqual(E.formatGenTime(185_000), '3m 5s');
});
