'use strict';

// MPI-1058 — the landing re-read every sidecar of every project on each visit (17 MB of
// JSON for 76 projects) to pick covers, and asked /project-stats once per row. The cache
// answers from two folder mtimes; these pin when it may and may not answer.

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('fs-extra');
const path = require('node:path');
const os = require('node:os');

const { projectSummary } = require('../routes/projectListCache.js');

// A folder touched in the last 2 s is never cached (projectListCache RACY_MS), so a project
// the tests expect a hit on is dated a minute back, as one untouched since its last save.
async function age(mediaDir) {
    const then = new Date(Date.now() - 60_000);
    await fs.utimes(path.join(mediaDir, '.meta'), then, then);
    await fs.utimes(mediaDir, then, then);
}

async function project() {
    const mediaDir = path.join(await fs.mkdtemp(path.join(os.tmpdir(), 'mpi1058-')), 'Media');
    await fs.ensureDir(path.join(mediaDir, '.meta'));
    await fs.writeFile(path.join(mediaDir, 't2i_001.png'), Buffer.alloc(10));
    await fs.writeJson(path.join(mediaDir, '.meta', 'a.json'), { filePath: 'x' });
    await age(mediaDir);
    let scans = 0;
    const findCover = async () => { scans++; return { recentThumbnail: `/cover/${scans}`, recentThumbnailType: 'image' }; };
    return { mediaDir, findCover, scans: () => scans };
}

test('a second visit with nothing changed is answered without a scan', async () => {
    const p = await project();
    const first = await projectSummary(p.mediaDir, p.findCover);
    const second = await projectSummary(p.mediaDir, p.findCover);
    assert.equal(p.scans(), 1);
    assert.deepEqual(second, first);
    assert.deepEqual(first.stats, { count: 1, bytes: 10 });
});

test('a new card (media file + sidecar) is seen on the next visit', async () => {
    const p = await project();
    await projectSummary(p.mediaDir, p.findCover);
    await fs.writeFile(path.join(p.mediaDir, 't2i_002.png'), Buffer.alloc(5));
    await fs.writeJson(path.join(p.mediaDir, '.meta', 'b.json'), { filePath: 'y' });
    const after = await projectSummary(p.mediaDir, p.findCover);
    assert.equal(p.scans(), 2);
    assert.equal(after.recentThumbnail, '/cover/2');
    assert.deepEqual(after.stats, { count: 2, bytes: 15 });
});

test('a sidecar re-saved through tmp + rename invalidates the cover', async () => {
    const p = await project();
    await projectSummary(p.mediaDir, p.findCover);
    const meta = path.join(p.mediaDir, '.meta', 'a.json');
    await fs.writeJson(`${meta}.tmp`, { filePath: 'x', thumbPath: 'z' });
    await fs.rename(`${meta}.tmp`, meta);
    await projectSummary(p.mediaDir, p.findCover);
    assert.equal(p.scans(), 2);
});

test('a folder changed this instant is never cached: a re-save in the same tick would keep its mtime', async () => {
    const p = await project();
    await fs.writeJson(path.join(p.mediaDir, '.meta', 'b.json'), { filePath: 'y' });
    await projectSummary(p.mediaDir, p.findCover);
    await projectSummary(p.mediaDir, p.findCover);
    assert.equal(p.scans(), 2);
});

test('a project with no Media folder lists with zero stats and no cover scan error', async () => {
    const mediaDir = path.join(await fs.mkdtemp(path.join(os.tmpdir(), 'mpi1058-')), 'Media');
    const summary = await projectSummary(mediaDir, async () => ({ recentThumbnail: null, recentThumbnailType: null }));
    assert.deepEqual(summary, { recentThumbnail: null, recentThumbnailType: null, stats: { count: 0, bytes: 0 } });
});
