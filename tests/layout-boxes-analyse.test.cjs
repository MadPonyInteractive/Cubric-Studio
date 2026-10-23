'use strict';

/**
 * layout-boxes-analyse.test.cjs — MPI-1253.
 *
 * Create boxes: the describer answers `{caption, items:[{name, label, <box>, caption, text}]}` on
 * 0-1000, the box in its family's own format (`analyseQuestion`); `boxesFromAnalysis` turns it
 * into panel boxes.
 */

const assert = require('node:assert/strict');
const test = require('node:test');

const { boxesFromAnalysis, analyseQuestion, mossLayoutPrompt } = require('../js/data/layoutBoxes.js');

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
        ...Array.from({ length: 22 }, (_, i) => ({ name: `n${i}`, bbox_2d: [0, 0, 500, 500] })),
    ];
    const { boxes } = boxesFromAnalysis(JSON.stringify({ caption: '', items }));
    assert.equal(boxes.length, 20);
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

test('each describer family is asked in its own trained box format', () => {
    // Qwen3-VL-4B asked named edges guessed on a 100-step grid; asked bbox_2d it was tight.
    assert.match(analyseQuestion('qwen'), /"bbox_2d": \[x1, y1, x2, y2\]/);
    assert.match(analyseQuestion('gemma'), /"box_2d": \[y1, x1, y2, x2\]/);
    assert.match(analyseQuestion('named'), /"box": \{"top"/);
    assert.equal(analyseQuestion(undefined), analyseQuestion('named'));
});

test('a lettering item quotes its words at the head of the desc, one line, kind text', () => {
    // Qwen3-VL-4B's answer on the Vogue cover (research/qwen-bench/D_named_injected.txt)
    const items = [
        { name: 'Fashion Headline', label: 'text', bbox_2d: [47, 217, 290, 385], caption: 'Large black serif', text: 'Style\nSpeaks\nLouder' },
        { name: 'Main Image', label: 'character', bbox_2d: [267, 177, 824, 912], caption: 'Woman in sunglasses', text: [] },
    ];
    const { boxes } = boxesFromAnalysis(JSON.stringify({ caption: 'A cover.', items }));
    assert.equal(boxes[0].desc, '"Style Speaks Louder": Large black serif');
    assert.equal(boxes[0].kind, 'text');
    assert.equal(boxes[1].desc, 'Woman in sunglasses');
    assert.equal(boxes[1].kind, undefined);
});

test('an answer cut off by the token cap keeps its finished items', () => {
    const whole = JSON.stringify({ caption: 'A cover.', items: [
        { name: 'title', bbox_2d: [47, 45, 890, 183] },
        { name: 'woman', bbox_2d: [267, 177, 824, 912] },
    ] });
    const cut = whole.slice(0, whole.indexOf('[267') + 6); // inside the second box
    const { caption, boxes } = boxesFromAnalysis(cut);
    assert.equal(caption, 'A cover.');
    assert.deepEqual(boxes.map((b) => b.name), ['title']);
});

test('MOSS gets a text box as a text item printing the quoted words', () => {
    const boxes = [
        { x: 0, y: 0, w: 1, h: 0.2, desc: '"VOGUE": bold black serif', name: 'title', kind: 'text' },
        { x: 0, y: 0.2, w: 1, h: 0.8, desc: 'a woman "smiling"', name: 'woman' },
    ];
    const { items } = JSON.parse(mossLayoutPrompt('A cover.', boxes, 1000, 1000));
    assert.equal(items[0].label, 'text');
    assert.equal(items[0].text, 'VOGUE');
    assert.equal(items[1].label, 'object');
    assert.equal(items[1].text, undefined);
});
