'use strict';
// AUDIT D8 (MPI-1302): the small helpers that replaced local copies across the UI.
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const load = (rel) => import(pathToFileURL(path.join(__dirname, '..', 'js', 'utils', rel)).href);

let escapeHtml, basename, clamp, clampNumber, clampInt, formatClock, ratios;
before(async () => {
    ({ escapeHtml } = await load('string.js'));
    ({ basename } = await load('file.js'));
    ({ clamp, clampNumber, clampInt } = await load('math.js'));
    ({ formatClock } = await load('elapsedTicker.js'));
    ratios = await load('ratios.js');
});

test('escapeHtml escapes all five characters, single quote included', () => {
    assert.equal(escapeHtml(`<a href="x" title='y'>&</a>`),
        '&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;');
    assert.equal(escapeHtml(null), '');
    assert.equal(escapeHtml(undefined), '');
    assert.equal(escapeHtml(0), '0');
});

test('basename splits on both separators', () => {
    assert.equal(basename('C:\\Users\\me\\img.png'), 'img.png');
    assert.equal(basename('loras/style/x.safetensors'), 'x.safetensors');
    assert.equal(basename('SDXL\\Models/mixed.ckpt'), 'mixed.ckpt');
    assert.equal(basename('plain.txt'), 'plain.txt');
    assert.equal(basename(''), '');
    assert.equal(basename(null), '');
    assert.equal(basename('dir/'), '');
});

test('clamp pins between the bounds', () => {
    assert.equal(clamp(5, 0, 1), 1);
    assert.equal(clamp(-5, 0, 1), 0);
    assert.equal(clamp(0.5, 0, 1), 0.5);
});

test('clampNumber: non-numbers give the fallback, unclamped; bounds are optional', () => {
    assert.equal(clampNumber('7.5', 0, 0, 5), 5);
    assert.equal(clampNumber('abc', 99, 0, 5), 99);
    assert.equal(clampNumber(Infinity, 3, 0, 5), 3);
    assert.equal(clampNumber('-2'), -2);
});

test('clampInt rounds, clamps and keeps the old copies\' behaviour', () => {
    // MpiToolOptionsCrop / Resize: at least 1, rounded.
    assert.equal(clampInt('0.4', 8, 1), 1);
    assert.equal(clampInt('12.6', 8, 1), 13);
    assert.equal(clampInt('', 8, 1), 1);       // Number('') is 0, as before
    assert.equal(clampInt('x', 8, 1), 8);
    // MpiToolOptionsGif / gifTiming: both bounds.
    assert.equal(clampInt(75, 10, 1, 60), 60);
    assert.equal(clampInt(-3, 0, 0, 999), 0);
    assert.equal(clampInt(undefined, 10, 1, 60), 10);
});

test('formatClock is the one m:ss (and h:mm:ss) clock', () => {
    assert.equal(formatClock(0), '0:00');
    assert.equal(formatClock(59_999), '0:59');   // floors: never "0:60" (B3)
    assert.equal(formatClock(75_000), '1:15');
    assert.equal(formatClock(3_725_000), '1:02:05');
    assert.equal(formatClock(-5), '0:00');
});

test('ORIENTATION_OPTIONS / ratioIcon / cropRatioOptions', () => {
    const { ORIENTATION_OPTIONS, ratioIcon, cropRatioOptions, CROP_RATIOS } = ratios;
    assert.deepEqual(ORIENTATION_OPTIONS.map(o => o.value), ['portrait', 'landscape']);
    assert.ok(Object.isFrozen(ORIENTATION_OPTIONS));
    assert.equal(ratioIcon({ icon: 'rect_16_9' }), 'ratio_16_9');

    const land = cropRatioOptions('landscape');
    assert.equal(land.length, CROP_RATIOS.landscape.length);
    assert.deepEqual(land[4], { label: '16:9', value: '16:9', icon: 'ratio_16_9', info: '16:9' });
    assert.deepEqual(cropRatioOptions('sideways'), cropRatioOptions('portrait'));
});
