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

// MPI-759 — GIF is an image item, matched two ways: a truthy `gif` field
// (MPI-768's own items) or a legacy `.gif` filename (matched case-insensitively,
// before frames are extracted). Neither depends on the field's inner shape.
test('an image item carrying a truthy gif field is a GIF, not an image', () => {
    assert.strictEqual(kindOfItem({ type: 'image', gif: { frames: [], loop: 0 } }).kind, 'gif');
    // The field's inner shape never matters — only truthiness does.
    assert.strictEqual(kindOfItem({ type: 'image', gif: true }).kind, 'gif');
});

test('a legacy .gif import with no gif field is still a GIF, matched by extension', () => {
    assert.strictEqual(kindOfItem({ type: 'image', filePath: '/Media/mascot.gif' }).kind, 'gif');
    assert.strictEqual(kindOfItem({ type: 'image', filePath: '/Media/MASCOT.GIF' }).kind, 'gif', 'case-insensitive');
});

test('gif wins over the image catch-all, but never shadows a real video or audio item', () => {
    assert.strictEqual(kindOfItem({ type: 'image', filePath: '/Media/a.gif' }).kind, 'gif');
    // A video/audio item is kinded by its type before the gif row is ever
    // reached — a `.gif`-suffixed path or a stray truthy `gif` field on one
    // (neither happens in practice; `gif` items are always `type: 'image'`)
    // must not steal it from its real kind.
    assert.strictEqual(kindOfItem({ type: 'video', filePath: '/Media/a.gif' }).kind, 'video');
    assert.strictEqual(kindOfItem({ type: 'audio', gif: true }).kind, 'audio');
});

test('only video, GIF and 3D Scene carry the corner badge', () => {
    assert.deepStrictEqual(ASSET_KINDS.filter(k => k.badge).map(k => k.kind).sort(), ['gif', 'scene', 'video']);
});

test('image is the last row, so the catch-all can never shadow a real kind', () => {
    assert.strictEqual(ASSET_KINDS.at(-1).kind, 'image');
});

test('the panel lists Images, GIFs, Videos, Audio, 3D Scenes — its own order, not match order', () => {
    assert.deepStrictEqual(PANEL_KINDS.map(k => k.kind), ['image', 'gif', 'video', 'audio', 'scene']);
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
