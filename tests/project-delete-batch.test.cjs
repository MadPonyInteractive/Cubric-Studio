'use strict';

// AUDIT P3 — a multi-select delete was one DELETE per card, each listing `.meta` and
// sweeping the GIF frame store (which reads every sidecar): O(cards x sidecars), ~2 min for
// 50 cards in a 5,000-card project. `POST /project-media/:projectId/delete-batch` deletes
// the whole selection in one request with one sweep, and reports each card on its own so
// the Gallery keeps a card whose files did not go.

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('fs-extra');
const path = require('node:path');
const express = require('express');
const sharp = require('sharp');
const { scratchDir } = require('./helpers/scratch.cjs');
const gifFrames = require('../services/gifFrames');

const fileUrl = (p) => `/project-file?path=${encodeURIComponent(p)}`;

test('delete-batch removes each card, keeps the rest, and frees an unreferenced GIF frame', async () => {
    const root = await scratchDir('p3-batch-');
    const mediaDir = path.join(root, 'Media');
    const metaDir = path.join(mediaDir, '.meta');
    await fs.ensureDir(metaDir);
    await fs.writeJson(path.join(root, 'project.json'), { id: 'p', itemGroups: [] });

    const card = async (id, filename, extra = {}) => {
        const fp = path.join(mediaDir, filename);
        await fs.writeFile(fp, 'x');
        await fs.writeFile(path.join(metaDir, `${id}.thumb.webp`), 'x');
        await fs.writeJson(path.join(metaDir, `${id}.json`), { id, filePath: fileUrl(fp), ...extra });
        return fp;
    };
    const a = await card('a', 't2i_001.png');
    const keep = await card('keep', 't2i_003.png');
    // A GIF card whose only frame nobody else references: freed once it is deleted.
    const buf = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#0f0' } }).png().toBuffer();
    const { hash } = await gifFrames.writeFrame(mediaDir, buf);
    const g = await card('g', 'gif_001.gif', { gif: { frames: [{ hash, delay: 10 }] } });
    // `b` is deleted by a filename another card now owns (a re-minted sequence name), while
    // its sidecar names its own file: the ownership guard keeps the other card's file.
    const b = await card('b', 't2i_002.png');

    const app = express();
    app.use(express.json());
    app.use(require('../routes/projects.js'));
    const server = await new Promise(r => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
    try {
        const framesBefore = await fs.readdir(path.join(mediaDir, '.gif-frames'));
        assert.ok(framesBefore.length > 0, 'fixture wrote no GIF frame');

        const res = await fetch(`http://127.0.0.1:${server.address().port}/project-media/p/delete-batch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                folderPath: root,
                items: [
                    { filename: 't2i_001.png', itemId: 'a' },
                    { filename: '../project.json', itemId: 'evil' },
                    { filename: 'gif_001.gif', itemId: 'g' },
                    { filename: 't2i_003.png', itemId: 'b' },
                ],
            }),
        }).then(r => r.json());

        assert.equal(res.success, true, JSON.stringify(res));
        assert.deepEqual(res.results, [
            { itemId: 'a', ok: true },
            { itemId: 'evil', ok: false },
            { itemId: 'g', ok: true },
            { itemId: 'b', ok: true },
        ]);
        assert.equal(await fs.pathExists(a), false, 'a\'s media survived');
        assert.equal(await fs.pathExists(g), false, 'the GIF survived');
        assert.ok(await fs.pathExists(path.join(root, 'project.json')), 'a ../ filename reached outside Media');
        assert.ok(await fs.pathExists(keep), 'the ownership guard let b delete another card\'s file');
        assert.ok(await fs.pathExists(b), 'b\'s own file goes with a delete by its own name, not this one');

        const left = (await fs.readdir(metaDir)).sort();
        assert.deepEqual(left, ['keep.json', 'keep.thumb.webp']);
        assert.deepEqual(await fs.readdir(path.join(mediaDir, '.gif-frames')).catch(() => []), [],
            'the deleted GIF\'s frame was not swept');
    } finally {
        await new Promise(r => server.close(r));
    }
});
