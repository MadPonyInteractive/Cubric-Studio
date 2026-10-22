'use strict';

/**
 * layout-boxes-analyse.test.cjs — MPI-1253.
 *
 * The Boxes panel's Analyse: the describer answers `{caption, items:[{name, desc, bbox_2d}]}`
 * with bbox_2d = [x1, y1, x2, y2] on 0-1000; `boxesFromAnalysis` turns it into panel boxes.
 */

const assert = require('node:assert/strict');
const test = require('node:test');

const { boxesFromAnalysis } = require('../js/data/layoutBoxes.js');

test('a fenced answer becomes fraction boxes with unique lower-case names', () => {
    const text = 'Here:\n```json\n' + JSON.stringify({
        caption: 'A pink soap bar in a bath.',
        items: [
            { name: 'Soap Bar', desc: 'cracked pink soap', bbox_2d: [250, 100, 750, 500] },
            { name: 'soap bar', desc: 'a second bar', bbox_2d: [0, 600, 1000, 1000] },
            { name: 'Headline', desc: '"STINK NO MORE" in purple', bbox_2d: [100, 700, 900, 850] },
        ],
    }) + '\n```';
    const { caption, boxes } = boxesFromAnalysis(text);
    assert.equal(caption, 'A pink soap bar in a bath.');
    assert.deepEqual(boxes.map((b) => b.name), ['soap_bar', 'soap_bar_2', 'headline']);
    assert.deepEqual([boxes[0].x, boxes[0].y, boxes[0].w, boxes[0].h], [0.25, 0.1, 0.5, 0.4]);
    assert.equal(boxes[2].desc, '"STINK NO MORE" in purple');
});

test('boxes off the grid are clamped, empty ones dropped, the count capped', () => {
    const items = [
        { name: 'big', bbox_2d: [-20, 0, 1200, 1000] },
        { name: 'flat', bbox_2d: [100, 100, 100, 400] },
        { name: 'bad', bbox_2d: [1, 2, 3] },
        ...Array.from({ length: 12 }, (_, i) => ({ name: `n${i}`, bbox_2d: [0, 0, 500, 500] })),
    ];
    const { boxes } = boxesFromAnalysis(JSON.stringify({ caption: '', items }));
    assert.equal(boxes.length, 10);
    assert.deepEqual([boxes[0].x, boxes[0].w], [0, 1]);
    assert.ok(!boxes.some((b) => b.name === 'flat' || b.name === 'bad'));
});

test('no JSON in the answer is null, not an empty layout', () => {
    assert.equal(boxesFromAnalysis('I cannot see the picture.'), null);
});
