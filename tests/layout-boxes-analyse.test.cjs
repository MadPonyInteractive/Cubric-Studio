'use strict';

/**
 * layout-boxes-analyse.test.cjs — MPI-1253.
 *
 * Create boxes: the describer answers `{caption, items:[{name, desc, box:{top,left,bottom,right}}]}`
 * on 0-1000 (older answers: bbox_2d [x1,y1,x2,y2]); `boxesFromAnalysis` turns it into panel boxes.
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

test('named edges are read by name; an array is read in its own key\'s order', () => {
    // Gemma 4's answer on Fabio's meadow picture: the sky is the TOP strip. Read as [x1,y1,x2,y2]
    // it became a strip down the left side, the reported bug.
    const items = [
        { name: 'sky', box: { top: 0, left: 0, bottom: 253, right: 1000 } },
        { name: 'sky google', box_2d: [0, 0, 253, 1000] },
        { name: 'sky qwen', bbox_2d: [0, 0, 1000, 253] },
    ];
    const { boxes } = boxesFromAnalysis(JSON.stringify({ caption: '', items }));
    for (const b of boxes) assert.deepEqual([b.x, b.y, b.w, b.h], [0, 0, 1, 0.253], b.name);
});

test('no JSON in the answer is null, not an empty layout', () => {
    assert.equal(boxesFromAnalysis('I cannot see the picture.'), null);
});
