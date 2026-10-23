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

const { boxesFromAnalysis, analyseQuestion, mossLayoutPrompt, zoomTargets, zoomCrop, zoomQuestion, fromZoom } = require('../js/data/layoutBoxes.js');

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

test('a bare "box" array is read in the order given (yx or xy)', () => {
    // Gemma 4 asked for box_2d, Bazaar cover 2026-10-23 (app.log): every item under "box", so
    // all of them were dropped and Create boxes said "found nothing".
    const text = '```json\n' + JSON.stringify({
        caption: 'A magazine cover.',
        items: [
            { name: 'magazine masthead', label: 'text', box: [21, 36, 188, 973], caption: 'Large serif title.', text: 'BAZAAR' },
            { name: 'model', label: 'character', box: [115, 286, 1000, 765], caption: 'A woman in profile.', text: '' },
        ],
    }, null, 2) + '\n```';
    const { boxes } = boxesFromAnalysis(text, 'yx');
    assert.deepEqual(boxes.map((b) => b.name), ['magazine_masthead', 'model']);
    assert.deepEqual([boxes[0].x, boxes[0].y], [0.036, 0.021]);
    assert.ok(Math.abs(boxes[0].w - 0.937) < 1e-9 && Math.abs(boxes[0].h - 0.167) < 1e-9);
    assert.equal(boxes[0].desc, '"BAZAAR": Large serif title.');
    assert.deepEqual(boxesFromAnalysis(text, 'xy').boxes[0].x, 0.021);
});

test('an array of any key is read in the order given', () => {
    // Gemma writes y-first under Qwen's key too, so the order is the picture's call (fitAnalysis).
    const items = [{ name: 'sky', bbox_2d: [0, 0, 253, 1000] }, { name: 'sky b', box_2d: [0, 0, 253, 1000] }];
    const text = JSON.stringify({ caption: '', items });
    for (const b of boxesFromAnalysis(text, 'yx').boxes) assert.deepEqual([b.x, b.y, b.w, b.h], [0, 0, 1, 0.253], b.name);
    for (const b of boxesFromAnalysis(text, 'xy').boxes) assert.deepEqual([b.x, b.y, b.w, b.h], [0, 0, 0.253, 1], b.name);
});

test('fitAnalysis: the picture picks the box order, any model, any key', async () => {
    const { fitAnalysis } = await import('../js/data/layoutBoxes.js');
    // 200x200 white page, two text blocks: x 20-80, y 40-70 and x 120-180, y 150-170.
    const W = 200, H = 200, data = new Uint8Array(W * H).fill(235);
    for (let y = 40; y < 70; y++) for (let x = 20; x < 80; x++) data[y * W + x] = 20;
    for (let y = 150; y < 170; y++) for (let x = 120; x < 180; x++) data[y * W + x] = 20;
    const img = { data, width: W, height: H, channels: 1 };
    const answer = (key, a, b) => JSON.stringify({ caption: 'c', items: [{ name: 'title', [key]: a }, { name: 'tag', [key]: b }] });
    const at = (bx) => [bx.x, bx.y, bx.w, bx.h].map((v) => Math.round(v * 1000) / 1000);
    // y-first under Qwen's key (Gemma's habit) and x-first under Google's both land on the blocks.
    for (const [key, a, b, order] of [
        ['bbox_2d', [190, 90, 360, 410], [740, 590, 860, 910], 'yx'],
        ['box_2d', [90, 190, 410, 360], [590, 740, 910, 860], 'xy'],
    ]) {
        const found = fitAnalysis(answer(key, a, b), img);
        assert.equal(found.order, order, key);
        assert.deepEqual(at(found.boxes[0]), [0.1, 0.2, 0.3, 0.15], key);
        assert.deepEqual(at(found.boxes[1]), [0.6, 0.75, 0.3, 0.1], key);
    }
    // One stray snap is no evidence (Tokyo, a photo collage, 2026-10-23): the key's order stands.
    assert.equal(fitAnalysis(answer('bbox_2d', [190, 90, 360, 410], [0, 0, 50, 50]), img).order, 'key');
    // A blank picture cannot tell: the key's own order stands.
    const blank = { data: new Uint8Array(W * H).fill(235), width: W, height: H, channels: 1 };
    assert.equal(fitAnalysis(answer('box_2d', [190, 90, 360, 410], [740, 590, 860, 910]), blank).order, 'key');
    assert.equal(fitAnalysis('no json', img), null);
});

test('snap: a box fits its whole ink block; ink running off into a photo leaves it as drawn', async () => {
    const { snapBoxes } = await import('../js/data/layoutBoxes.js');
    // 200x200 white page: a 3-line text block at x 20-80, y 40-70 (lines 2 px apart),
    // and a black "photo" from x 120 to the right edge, y 100 to the bottom.
    const W = 200, H = 200, data = new Uint8Array(W * H).fill(235);
    const ink = (x0, y0, x1, y1) => { for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) data[y * W + x] = 20; };
    ink(20, 40, 80, 48); ink(20, 50, 80, 58); ink(20, 60, 80, 70);
    ink(120, 100, 200, 200);
    const img = { data, width: W, height: H, channels: 1 };
    // The describer missed the first line and ran wide: the box snaps to the whole block.
    const [text] = snapBoxes([{ x: 0.08, y: 0.24, w: 0.36, h: 0.13, name: 'headline' }], img);
    assert.deepEqual([text.x, text.y, text.w, text.h], [0.1, 0.2, 0.3, 0.15]);
    assert.equal(text.name, 'headline');
    // Lettering on the photo: its block runs out of the window, the box stays as drawn.
    const onPhoto = { x: 0.62, y: 0.55, w: 0.2, h: 0.1, name: 'caption' };
    assert.equal(snapBoxes([onPhoto], img)[0], onPhoto);
    // A box over blank page has no ink to fit.
    const blank = { x: 0.05, y: 0.8, w: 0.2, h: 0.1 };
    assert.equal(snapBoxes([blank], img)[0], blank);
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

test('the zoom pass picks small boxes the ink did not fix, and maps a crop answer back', () => {
    const found = {
        order: 'key',
        boxes: [
            { x: 0, y: 0, w: 1, h: 0.2, name: 'title' },          // big: seen well enough
            { x: 0.1, y: 0.4, w: 0.2, h: 0.1, name: 'sidebar' },  // small, unsnapped
            { x: 0.6, y: 0.4, w: 0.2, h: 0.1, name: 'snapped' },  // small, ink fixed it
        ],
        fixed: [false, false, true],
    };
    assert.deepEqual(zoomTargets(found), [1]);

    const b = found.boxes[1];
    const crop = zoomCrop(b);
    assert.ok(crop.x <= b.x && crop.y <= b.y && crop.x + crop.w >= b.x + b.w && crop.y + crop.h >= b.y + b.h);
    assert.ok(crop.x >= 0 && crop.y >= 0 && crop.x + crop.w <= 1 && crop.y + crop.h <= 1);

    // The model answers on the crop: the block sits a little lower than the first box said.
    const answer = JSON.stringify({ items: [{ name: 'sidebar', bbox_2d: [250, 300, 750, 800] }] });
    const r = fromZoom(answer, crop, found.order, b);
    assert.ok(Math.abs(r.x - (crop.x + 0.25 * crop.w)) < 1e-9);
    assert.ok(Math.abs(r.y - (crop.y + 0.3 * crop.h)) < 1e-9);
    assert.equal(r.name, 'sidebar');

    // The whole crop, nothing, or a neighbour that misses the box: keep the first box.
    assert.equal(fromZoom(JSON.stringify({ items: [{ name: 'x', bbox_2d: [0, 0, 1000, 1000] }] }), crop, 'key', b), null);
    assert.equal(fromZoom('{"items": []}', crop, 'key', b), null);
    assert.equal(fromZoom(JSON.stringify({ items: [{ name: 'x', bbox_2d: [900, 900, 1000, 1000] }] }), crop, 'key', b), null);
});

test('the zoom question asks in the describer\'s own box format', () => {
    const b = { name: 'feature_headline', desc: '"THE DENIM EDIT": bold caps', kind: 'text' };
    assert.match(zoomQuestion('gemma', b), /"box_2d": \[y1, x1, y2, x2\]/);
    assert.match(zoomQuestion('qwen', b), /"bbox_2d": \[x1, y1, x2, y2\]/);
    assert.match(zoomQuestion('gemma', b), /feature headline - "THE DENIM EDIT"/);
    assert.match(zoomQuestion('gemma', b), /every line of the text block/);
});
