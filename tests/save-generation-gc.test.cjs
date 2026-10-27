'use strict';

// The orphan-sidecar sweep (`sweepOrphanSidecars`, routes/projects.js). It ran inside every
// save-generation until AUDIT P1; it now runs once per project open (`/migrate-project`).
//
// MPI-975 — a stack Remove BG left one result with a broken gallery thumb.
// Every writer lays an item's renditions (`<id>.thumb.webp`, `<id>.thumb.1280.webp`)
// BEFORE its sidecar, because the sidecar records their paths. The GC used to sweep any
// derivative with no sidecar, so a sweep landing while a save was between its thumbs and
// its sidecar deleted that save's fresh 512 thumb.

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('fs-extra');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const express = require('express');
const sharp = require('sharp');
const { sweepOrphanSidecars } = require('../routes/projects.js');

const fileUrl = (p) => `/project-file?path=${encodeURIComponent(p)}`;

async function project(prefix) {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
    const metaDir = path.join(root, 'Media', '.meta');
    await fs.ensureDir(metaDir);
    await fs.writeJson(path.join(root, 'project.json'), { id: 'p', itemGroups: [] });
    return { root, metaDir };
}

test('the sweep leaves an in-flight item\'s renditions alone', async () => {
    const { root, metaDir } = await project('mpi975-');
    try {
        // A save, mid-flight: its media and thumbs are on disk, its sidecar is not yet.
        const inFlight = 'bbbbbbbb-0000-0000-0000-000000000975';
        await fs.writeFile(path.join(root, 'Media', 'removeBackground_004.png'), 'x');
        const itsThumbs = [`${inFlight}.thumb.webp`, `${inFlight}.thumb.1280.webp`];
        for (const f of itsThumbs) await fs.writeFile(path.join(metaDir, f), 'x');

        await sweepOrphanSidecars(root);

        const left = await fs.readdir(metaDir);
        for (const f of itsThumbs) assert.ok(left.includes(f), `${f} was swept`);
    } finally {
        await fs.remove(root);
    }
});

// MPI-623 — Take picture's Klein job saved a generation, and the GC read the scene card's
// manifest `<id>.scene.json` as a sidecar: no `filePath`, so `Media/<id>.scene` "was gone"
// and the manifest was deleted. Every generation in a project wiped its scenes.
test('the sweep keeps a scene card\'s manifest', async () => {
    const { root, metaDir } = await project('mpi623-gc-');
    try {
        const scene = 'cccccccc-0000-0000-0000-000000000623';
        const pano = path.join(root, 'Media', 'imported_001.png');
        await fs.writeFile(pano, 'x');
        await fs.writeJson(path.join(metaDir, `${scene}.json`), { id: scene, type: 'image', filePath: fileUrl(pano) });
        const companions = [`${scene}.scene.json`, `${scene}.scene.pano.png`, `${scene}.scene.pano_depth.f32`];
        await fs.writeJson(path.join(metaDir, companions[0]), { version: 1, pano: { image: 'pano.png', depth: 'pano_depth.f32', w: 2, h: 1 }, layers: [] });
        for (const f of companions.slice(1)) await fs.writeFile(path.join(metaDir, f), 'x');

        await sweepOrphanSidecars(root);

        const left = await fs.readdir(metaDir);
        for (const f of companions) assert.ok(left.includes(f), `${f} was swept`);
    } finally {
        await fs.remove(root);
    }
});

// AUDIT P1 — the sweep moved from every save to project open. A save leaves an orphan
// where it is; opening the project removes it with its derivatives and keeps a live card
// (whose filePath carries the `&v=` cache-bust the greedy regex once broke on).
test('project open sweeps an orphaned sidecar; a save no longer does', async () => {
    const { root, metaDir } = await project('p1-sweep-');
    const png = await sharp({ create: { width: 64, height: 64, channels: 4, background: '#f00' } }).png().toBuffer();
    const view = http.createServer((req, res) => res.end(png));
    await new Promise(r => view.listen(0, '127.0.0.1', r));
    const app = express();
    app.use(express.json());
    app.use(require('../routes/projects.js'));
    const server = await new Promise(r => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
    const post = (route, body) => fetch(`http://127.0.0.1:${server.address().port}${route}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    }).then(r => r.json());
    try {
        const orphan = 'eeeeeeee-0000-0000-0000-000000000001';
        await fs.writeJson(path.join(metaDir, `${orphan}.json`), { id: orphan, filePath: fileUrl(path.join(root, 'Media', 'gone_001.png')) });
        await fs.writeFile(path.join(metaDir, `${orphan}.thumb.webp`), 'x');
        const live = 'eeeeeeee-0000-0000-0000-000000000002';
        const liveMedia = path.join(root, 'Media', 't2i_001.png');
        await fs.writeFile(liveMedia, 'x');
        await fs.writeJson(path.join(metaDir, `${live}.json`), { id: live, filePath: `${fileUrl(liveMedia)}&v=123` });

        const saved = await post('/project/save-generation', {
            folderPath: root,
            comfyViewUrl: `http://127.0.0.1:${view.address().port}/view?filename=t2i_002.png`,
            itemId: 'eeeeeeee-0000-0000-0000-000000000003',
            operation: 't2i',
            mediaType: 'image',
        });
        assert.equal(saved.success, true, JSON.stringify(saved));
        assert.ok(await fs.pathExists(path.join(metaDir, `${orphan}.json`)), 'save-generation swept: P1 moved that to project open');

        const opened = await post('/migrate-project', { folderPath: root });
        assert.equal(opened.success, true, JSON.stringify(opened));
        // The sweep runs after the response.
        for (let i = 0; i < 100 && await fs.pathExists(path.join(metaDir, `${orphan}.json`)); i++) {
            await new Promise(r => setTimeout(r, 20));
        }
        const left = await fs.readdir(metaDir);
        assert.ok(!left.includes(`${orphan}.json`), 'the orphaned sidecar survived project open');
        assert.ok(!left.includes(`${orphan}.thumb.webp`), 'the orphan\'s thumb survived project open');
        assert.ok(left.includes(`${live}.json`), 'a live card\'s sidecar was swept');
    } finally {
        await new Promise(r => server.close(r));
        await new Promise(r => view.close(r));
        await fs.remove(root);
    }
});
