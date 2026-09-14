'use strict';

// MPI-750 — the History page's project bar read "0 ENTRIES · 0 KB" for a group with
// four live entries.
//
// Group mode of GET /project-stats resolves each history item through its sidecar's
// `filePath`. Outputs carry a `&v=<mtime>` cache-bust (projectFileUrlBusted), and a
// greedy `path=(.+)$` folded that suffix into the path, so pathExists() was false for
// every busted item and the route answered a confident `{ count: 0, bytes: 0 }` —
// no error, no log line, and the stats service wrote it over the client's seed.

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('fs-extra');
const path = require('node:path');
const os = require('node:os');
const express = require('express');

const router = require('../routes/projects.js');

test('group stats count and size items whose filePath carries a cache-bust', async () => {
    const folderPath = await fs.mkdtemp(path.join(os.tmpdir(), 'mpi750-'));
    const mediaDir = path.join(folderPath, 'Media');
    const metaDir = path.join(mediaDir, '.meta');
    await fs.ensureDir(metaDir);

    const items = [
        { id: 'aaaaaaaa-0000-0000-0000-000000000001', name: 'inpaint_002.png', size: 7, bust: true },
        { id: 'aaaaaaaa-0000-0000-0000-000000000002', name: 'imported 014.jpg', size: 11, bust: true },
        { id: 'aaaaaaaa-0000-0000-0000-000000000003', name: 'edit_055.png', size: 13, bust: false },
    ];
    for (const it of items) {
        const abs = path.join(mediaDir, it.name);
        await fs.writeFile(abs, Buffer.alloc(it.size));
        const filePath = `/project-file?path=${encodeURIComponent(abs)}${it.bust ? '&v=1789122840335' : ''}`;
        await fs.writeJson(path.join(metaDir, `${it.id}.json`), { filePath });
    }

    const app = express();
    app.use(router);
    const server = app.listen(0, '127.0.0.1');
    try {
        await new Promise(r => server.once('listening', r));
        const params = new URLSearchParams({
            folderPath,
            groupId: 'group-1',
            itemIds: items.map(i => i.id).join(','),
        });
        const res = await fetch(`http://127.0.0.1:${server.address().port}/project-stats/p1?${params}`);
        const body = await res.json();

        assert.deepEqual(body, { success: true, count: 3, bytes: 7 + 11 + 13 });
    } finally {
        server.close();
        await fs.remove(folderPath);
    }
});

// The same greedy parse was fixed at three sites across two commits (c2c1c662, then
// MPI-750); a doc rule did not stop the repeats, so the source is checked instead.
test('no code parses a /project-file url with a greedy path=(.+)', () => {
    const root = path.join(__dirname, '..');
    const offenders = [];
    for (const dir of ['routes', 'services', 'electron', 'js']) {
        const abs = path.join(root, dir);
        if (!fs.existsSync(abs)) continue;
        for (const rel of fs.readdirSync(abs, { recursive: true })) {
            if (!/\.[cm]?js$/.test(rel) || rel.includes('node_modules')) continue;
            fs.readFileSync(path.join(abs, rel), 'utf8').split(/\r?\n/).forEach((line, i) => {
                const code = line.trim();
                if (code.includes('path=(.+)') && !code.startsWith('//') && !code.startsWith('*')) {
                    offenders.push(`${dir}/${rel}:${i + 1}`);
                }
            });
        }
    }
    assert.deepEqual(offenders, [], 'use pathFromProjectFileUrl, which stops at `&`');
});
