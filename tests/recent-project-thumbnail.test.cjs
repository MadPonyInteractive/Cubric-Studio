'use strict';

// MPI-963 — the Landing recent-project card is a few hundred px, so it shows the newest
// card's sidecar THUMB, not its original. A 32K import as the newest card left the card
// blank (Chromium cannot decode one) and a 16K PNG decoded for seconds. The original is
// only a fallback, for a sidecar whose thumb was never baked or is gone from disk.

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('fs-extra');
const path = require('node:path');
const os = require('node:os');

const { findRecentProjectThumbnail } = require('../routes/projects.js');

const url = (p) => `/project-file?path=${encodeURIComponent(p)}`;

async function seed(entries) {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mpi963-'));
    const mediaDir = path.join(root, 'Media');
    const metaDir = path.join(mediaDir, '.meta');
    await fs.ensureDir(metaDir);
    for (const [i, e] of entries.entries()) {
        const file = path.join(mediaDir, e.name);
        await fs.writeFile(file, 'master');
        const thumb = path.join(metaDir, `id${i}.thumb.webp`);
        if (e.thumbOnDisk) await fs.writeFile(thumb, 'thumb');
        await fs.writeJson(path.join(metaDir, `id${i}.json`), {
            filePath: url(file),
            thumbPath: e.thumb === false ? null : url(thumb),
            createdAt: e.createdAt,
        });
    }
    return { root, mediaDir, metaDir };
}

test('the newest card shows its sidecar thumb, typed image', async () => {
    const { root, mediaDir, metaDir } = await seed([
        { name: 'old_001.png', createdAt: '2026-01-01T00:00:00Z', thumbOnDisk: true },
        { name: 'huge_001.jpg', createdAt: '2026-09-28T00:00:00Z', thumbOnDisk: true },
    ]);
    try {
        assert.deepEqual(await findRecentProjectThumbnail(mediaDir), {
            recentThumbnail: url(path.join(metaDir, 'id1.thumb.webp')),
            recentThumbnailType: 'image',
        });
    } finally { await fs.remove(root); }
});

test('a video with a thumb shows the thumb as an image', async () => {
    const { root, mediaDir, metaDir } = await seed([
        { name: 'clip_001.mp4', createdAt: '2026-09-28T00:00:00Z', thumbOnDisk: true },
    ]);
    try {
        assert.deepEqual(await findRecentProjectThumbnail(mediaDir), {
            recentThumbnail: url(path.join(metaDir, 'id0.thumb.webp')),
            recentThumbnailType: 'image',
        });
    } finally { await fs.remove(root); }
});

test('no thumb on disk, or none recorded, falls back to the original', async () => {
    const { root, mediaDir } = await seed([
        { name: 'a_001.png', createdAt: '2026-09-27T00:00:00Z', thumbOnDisk: false },
        { name: 'clip_001.mp4', createdAt: '2026-09-28T00:00:00Z', thumb: false },
    ]);
    try {
        assert.deepEqual(await findRecentProjectThumbnail(mediaDir), {
            recentThumbnail: url(path.join(mediaDir, 'clip_001.mp4')),
            recentThumbnailType: 'video',
        });
        await fs.remove(path.join(mediaDir, 'clip_001.mp4'));
        assert.deepEqual(await findRecentProjectThumbnail(mediaDir), {
            recentThumbnail: url(path.join(mediaDir, 'a_001.png')),
            recentThumbnailType: 'image',
        });
    } finally { await fs.remove(root); }
});
