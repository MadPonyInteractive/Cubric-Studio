'use strict';

/**
 * MPI-933 — an imported SVG lands as a PNG.
 *
 * Every tool in the app reads pixels (thumbnails, edits, describe, references), and an
 * SVG is a vector: ffmpeg cannot thumb it and nothing else reads it either. So the
 * import route renders it once and never writes the `.svg` (Fabio, 2026-09-25).
 * Size: the SVG's own, the long edge raised to 2048 (vectors enlarge for free) and
 * capped at 4096.
 */

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('fs-extra');
const os = require('node:os');
const path = require('node:path');
const express = require('express');
const sharp = require('sharp');
const { scratchDir } = require('./helpers/scratch.cjs');

// Keep this run out of the developer's app.log.
process.env.APP_USER_DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'svg-import-'));

const svg = (w, h, body = `<rect width="${w}" height="${h}" fill="#c33"/>`) =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${body}</svg>`;

async function importSvg(text, { viaPath = true } = {}) {
    const root = await scratchDir('svg-import-');
    await fs.writeJson(path.join(root, 'project.json'), { id: 'p', itemGroups: [], sequenceCounters: {} });
    const src = path.join(root, 'logo.svg');
    await fs.writeFile(src, text);
    const app = express();
    app.use(express.json({ limit: '50mb' }));
    app.use(require('../routes/projects.js'));
    const server = await new Promise(r => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
    try {
        const itemId = 'aaaaaaaa-0000-0000-0000-000000000933';
        const res = await fetch(`http://127.0.0.1:${server.address().port}/project-media/p/upload?folderPath=${encodeURIComponent(root)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                filename: 'imported_001.svg',
                ...(viaPath ? { sourcePath: src } : { base64Data: `data:image/svg+xml;base64,${Buffer.from(text).toString('base64')}` }),
                autoSequence: true, itemId, mediaType: 'image',
                // What the renderer measures off an <img> of an SVG: its declared size, or junk.
                width: 150, height: 150,
            }),
        }).then(r => r.json());
        assert.equal(res.success, true, JSON.stringify(res));
        const mediaDir = path.join(root, 'Media');
        const sidecar = await fs.readJson(path.join(mediaDir, '.meta', `${itemId}.json`));
        const media = (await fs.readdir(mediaDir)).filter(f => !f.startsWith('.'));
        return { res, sidecar, media, mediaDir };
    } finally {
        await new Promise(r => server.close(r));
    }
}

test('an SVG import lands as a PNG, raised to 2048 on the long edge, and the SVG is not kept', async () => {
    const { res, sidecar, media, mediaDir } = await importSvg(svg(800, 600));
    assert.match(res.filename, /\.png$/);
    assert.deepEqual(media, [res.filename], 'one file, the PNG: the .svg is replaced, not kept beside it');
    const m = await sharp(path.join(mediaDir, res.filename)).metadata();
    assert.equal(m.format, 'png');
    assert.deepEqual([m.width, m.height], [2048, 1536]);
    assert.deepEqual(sidecar.pixelDimensions, { w: 2048, h: 1536 }, 'the PNG size, not the renderer\'s guess');
    assert.deepEqual(res.pixelDimensions, { w: 2048, h: 1536 }, 'the live card needs it before any reload');
    assert.ok(sidecar.thumbPath && sidecar.thumbPathLg, 'both gallery renditions');
    assert.equal(sidecar.displayName, res.filename.replace(/\.png$/, ''));
});

test('a huge declared size is capped at 4096 (base64 import)', async () => {
    const { res, mediaDir } = await importSvg(svg(20000, 10000), { viaPath: false });
    const m = await sharp(path.join(mediaDir, res.filename)).metadata();
    assert.equal(m.format, 'png');
    assert.deepEqual([m.width, m.height], [4096, 2048]);
});

test('a size already between 2048 and 4096 is kept', async () => {
    const { res, mediaDir } = await importSvg(svg(3000, 1000));
    const m = await sharp(path.join(mediaDir, res.filename)).metadata();
    assert.equal(m.format, 'png');
    assert.deepEqual([m.width, m.height], [3000, 1000]);
});

test('transparency survives: what the SVG does not paint is alpha 0', async () => {
    const { res, mediaDir } = await importSvg(svg(400, 400, '<circle cx="200" cy="200" r="50" fill="#3c3"/>'));
    const file = path.join(mediaDir, res.filename);
    const corner = await sharp(file).ensureAlpha().extract({ left: 0, top: 0, width: 1, height: 1 }).raw().toBuffer();
    const centre = await sharp(file).ensureAlpha().extract({ left: 1024, top: 1024, width: 1, height: 1 }).raw().toBuffer();
    assert.equal(corner[3], 0, 'corner is transparent');
    assert.equal(centre[3], 255, 'the circle is opaque');
});
