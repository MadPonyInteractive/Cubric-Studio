'use strict';

// MPI-975 — a stack Remove BG left one result with a broken gallery thumb.
//
// Every writer lays an item's renditions (`<id>.thumb.webp`, `<id>.thumb.1280.webp`)
// BEFORE its sidecar, because the sidecar records their paths. save-generation's GC used
// to sweep any derivative with no sidecar, so a save landing while another was between
// its thumbs and its sidecar deleted the other one's fresh 512 thumb (the 1280, written
// after the sweep's readdir, survived). A stack batch saves N results at once.

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('fs-extra');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const express = require('express');
const sharp = require('sharp');

test('save-generation leaves an in-flight item\'s renditions alone', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mpi975-'));
    const metaDir = path.join(root, 'Media', '.meta');
    await fs.ensureDir(metaDir);
    await fs.writeJson(path.join(root, 'project.json'), { id: 'p', itemGroups: [] });

    // Another save, mid-flight: its media and thumbs are on disk, its sidecar is not yet.
    const inFlight = 'bbbbbbbb-0000-0000-0000-000000000975';
    await fs.writeFile(path.join(root, 'Media', 'removeBackground_004.png'), 'x');
    const itsThumbs = [`${inFlight}.thumb.webp`, `${inFlight}.thumb.1280.webp`];
    for (const f of itsThumbs) await fs.writeFile(path.join(metaDir, f), 'x');

    const png = await sharp({ create: { width: 64, height: 64, channels: 4, background: '#f00' } }).png().toBuffer();
    const view = http.createServer((req, res) => res.end(png));
    await new Promise(r => view.listen(0, '127.0.0.1', r));
    const app = express();
    app.use(express.json());
    app.use(require('../routes/projects.js'));
    const server = await new Promise(r => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
    try {
        const res = await fetch(`http://127.0.0.1:${server.address().port}/project/save-generation`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                folderPath: root,
                comfyViewUrl: `http://127.0.0.1:${view.address().port}/view?filename=removeBackground_005.png`,
                itemId: 'aaaaaaaa-0000-0000-0000-000000000975',
                operation: 'removeBackground',
                mediaType: 'image',
            }),
        }).then(r => r.json());
        assert.equal(res.success, true, JSON.stringify(res));

        const left = await fs.readdir(metaDir);
        for (const f of itsThumbs) assert.ok(left.includes(f), `${f} was swept by another item's save`);
    } finally {
        await new Promise(r => server.close(r));
        await new Promise(r => view.close(r));
        await fs.remove(root);
    }
});
