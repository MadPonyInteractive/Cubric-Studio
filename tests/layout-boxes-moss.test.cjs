'use strict';

/**
 * layout-boxes-moss.test.cjs — MPI-1243.
 *
 * MOSS-Image takes boxes as its WHOLE prompt in JSON, what core `MOSSImageLayoutPrompt`
 * builds: `{summary:{caption}, items:[{label, caption, bbox}], bbox_coord_space:
 * "abs_centralized", bbox_format:"yxyx"}`, bbox in output pixels with the origin at the centre.
 */

const assert = require('node:assert/strict');
const test = require('node:test');

const { withLayoutBoxes, modelTakesBoxes } = require('../js/data/generationControls.js');
const { MODELS } = require('../js/data/modelConstants/models.js');

const MOSS = MODELS.find((m) => m.id === 'moss-image');
const FOX = { x: 0.05, y: 0.55, w: 0.3, h: 0.4, desc: 'red fox sitting', name: 'fox' };

test('the layout is MOSSImageLayoutPrompt`s: caption, object items, centred pixel yxyx', () => {
    const out = JSON.parse(withLayoutBoxes(MOSS, 'A meadow with a <fox>.', [FOX], 't2i', { width: 1024, height: 768 }));
    // core: floor(550*768/1000)-384, floor(50*1024/1000)-512, ceil(950*768/1000)-384, ceil(350*1024/1000)-512
    assert.deepEqual(out, {
        summary: { caption: 'A meadow with a fox.' },
        items: [{ label: 'object', caption: 'red fox sitting', bbox: [38, -461, 346, -153] }],
        bbox_coord_space: 'abs_centralized', bbox_format: 'yxyx',
    });
});

test('moss boxes on t2i only; no boxes or no size leaves the prompt alone', () => {
    assert.equal(modelTakesBoxes(MOSS, 't2i'), true);
    assert.equal(withLayoutBoxes(MOSS, ' hi ', [], 't2i', { width: 1024, height: 1024 }), 'hi');
    assert.equal(withLayoutBoxes(MOSS, 'hi', [FOX], 't2i'), 'hi');
});
