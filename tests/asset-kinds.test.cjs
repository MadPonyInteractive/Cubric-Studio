'use strict';

/**
 * MPI-749 — asset kinds. The table is ORDERED and first match wins: a 3D Scene is an
 * image item carrying `splatPath`, so a type-only lookup would call it an image.
 */

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

let ASSET_KINDS;
let kindOfItem;

test.before(async () => {
    const url = pathToFileURL(path.join(__dirname, '..', 'js', 'utils', 'assetKinds.js'));
    ({ ASSET_KINDS, kindOfItem } = await import(url.href));
});

test('an image item carrying a splat is a 3D Scene, not an image', () => {
    assert.strictEqual(kindOfItem({ type: 'image', splatPath: 'scene.ply' }).kind, 'scene');
});

test('video and audio items are kinded by their type', () => {
    assert.strictEqual(kindOfItem({ type: 'video' }).kind, 'video');
    assert.strictEqual(kindOfItem({ type: 'audio' }).kind, 'audio');
});

test('a plain image, null and an unknown type all fall through to image', () => {
    for (const item of [{ type: 'image' }, null, undefined, { type: 'midi' }]) {
        assert.strictEqual(kindOfItem(item).kind, 'image');
    }
});

test('only video and 3D Scene carry the corner badge', () => {
    assert.deepStrictEqual(ASSET_KINDS.filter(k => k.badge).map(k => k.kind).sort(), ['scene', 'video']);
});

test('image is the last row, so the catch-all can never shadow a real kind', () => {
    assert.strictEqual(ASSET_KINDS.at(-1).kind, 'image');
});
