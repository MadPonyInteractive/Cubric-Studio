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
let PANEL_KINDS;
let ICONS;

test.before(async () => {
    const url = pathToFileURL(path.join(__dirname, '..', 'js', 'utils', 'assetKinds.js'));
    ({ ASSET_KINDS, PANEL_KINDS, kindOfItem } = await import(url.href));
    ({ ICONS } = await import(pathToFileURL(path.join(__dirname, '..', 'js', 'utils', 'icons.js')).href));
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

test('the panel lists Images, Videos, Audio, 3D Scenes — its own order, not match order', () => {
    assert.deepStrictEqual(PANEL_KINDS.map(k => k.kind), ['image', 'video', 'audio', 'scene']);
    assert.strictEqual(new Set(ASSET_KINDS.map(k => k.panelOrder)).size, ASSET_KINDS.length);
});

test('every kind row is complete: a unique id, both labels, and an icon that exists', () => {
    assert.strictEqual(new Set(ASSET_KINDS.map(k => k.kind)).size, ASSET_KINDS.length);
    for (const k of ASSET_KINDS) {
        assert.ok(k.label && k.singular, `${k.kind} needs label and singular`);
        assert.ok(ICONS[k.icon], `${k.kind}: icon '${k.icon}' is not in js/utils/icons.js`);
        assert.strictEqual(typeof k.match, 'function');
    }
});
