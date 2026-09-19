'use strict';

// MPI-821 — "Cleanup assets" is the pre-share slimming step. It drops what a project
// can REBUILD and nothing else:
//   - Media/.meta/<id>.thumb.* and <id>.proxy.*  → gone (backfill bakes them again)
//   - Media/.meta/<id>.splat.ply                 → KEPT. It rides DERIVATIVE_RE but the
//                                                  still is rendered FROM it: it is a
//                                                  master, and removing it destroys data.
//   - the sidecar's thumbPath/thumbPathLg/proxyPath → NULLED. /backfill-media-derivatives
//                                                  gates on the sidecar, never on disk
//                                                  (`if (meta.thumbPath) continue`), so
//                                                  leaving them set means the pass skips
//                                                  the item and a video card is blank
//                                                  forever — it has no filePath fallback.
//   - Media/.preview-assets/*                    → gone, except the .migrated-v1 marker.
//   - Media/<master files> and the sidecar JSON itself → untouched.

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('fs-extra');
const path = require('node:path');
const os = require('node:os');

const { cleanupRebuildableAssets } = require('../routes/projects.js');

async function seedProject() {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mpi821-'));
    const mediaDir = path.join(root, 'Media');
    const metaDir = path.join(mediaDir, '.meta');
    const storeDir = path.join(mediaDir, '.preview-assets');
    await fs.ensureDir(metaDir);
    await fs.ensureDir(storeDir);

    await fs.writeFile(path.join(mediaDir, 'vid_001.mp4'), 'master');
    await fs.writeFile(path.join(mediaDir, 'img_001.png'), 'master');

    for (const f of [
        'vid_001.thumb.webp', 'vid_001.thumb.1280.webp', 'vid_001.proxy.mp4',
        'img_001.thumb.jpg', 'img_001.thumb.webp',
    ]) await fs.writeFile(path.join(metaDir, f), 'derivative');

    await fs.writeFile(path.join(metaDir, 'splat_001.splat.ply'), 'master');

    await fs.writeJson(path.join(metaDir, 'vid_001.json'), {
        id: 'vid_001', type: 'video', prompt: 'a cat',
        thumbPath: '/project-file?path=vid_001.thumb.webp',
        thumbPathLg: '/project-file?path=vid_001.thumb.1280.webp',
        proxyPath: '/project-file?path=vid_001.proxy.mp4',
    });
    await fs.writeJson(path.join(metaDir, 'img_001.json'), {
        id: 'img_001', type: 'image', prompt: 'a dog',
        thumbPath: '/project-file?path=img_001.thumb.webp',
    });

    await fs.writeFile(path.join(storeDir, 'deadbeef.png'), 'reuse frame');
    await fs.writeFile(path.join(storeDir, '.migrated-v1'), '');

    return { root, mediaDir, metaDir, storeDir };
}

test('cleanup removes derivatives, keeps masters and the splat', async () => {
    const { root, mediaDir, metaDir, storeDir } = await seedProject();
    try {
        const removed = await cleanupRebuildableAssets(root);

        for (const f of [
            'vid_001.thumb.webp', 'vid_001.thumb.1280.webp', 'vid_001.proxy.mp4',
            'img_001.thumb.jpg', 'img_001.thumb.webp',
        ]) assert.equal(await fs.pathExists(path.join(metaDir, f)), false, `${f} removed`);

        assert.ok(await fs.pathExists(path.join(metaDir, 'splat_001.splat.ply')), 'splat is a master, kept');
        assert.ok(await fs.pathExists(path.join(mediaDir, 'vid_001.mp4')), 'video master kept');
        assert.ok(await fs.pathExists(path.join(mediaDir, 'img_001.png')), 'image master kept');
        assert.ok(await fs.pathExists(path.join(metaDir, 'vid_001.json')), 'sidecar kept');

        assert.equal(await fs.pathExists(path.join(storeDir, 'deadbeef.png')), false, 'store wiped');
        assert.ok(await fs.pathExists(path.join(storeDir, '.migrated-v1')), 'migration marker kept');

        assert.equal(removed, 6, '5 derivatives + 1 store entry');
    } finally {
        await fs.remove(root);
    }
});

test('cleanup nulls the sidecar fields so the backfill pass re-bakes', async () => {
    const { root, metaDir } = await seedProject();
    try {
        await cleanupRebuildableAssets(root);

        const vid = await fs.readJson(path.join(metaDir, 'vid_001.json'));
        assert.equal(vid.thumbPath, null);
        assert.equal(vid.thumbPathLg, null);
        assert.equal(vid.proxyPath, null);
        assert.equal(vid.prompt, 'a cat', 'every other key survives');
        assert.equal(vid.type, 'video');

        // The image sidecar never carried thumbPathLg/proxyPath. The backfill pass
        // reads them as absent either way, so writing an explicit null is harmless —
        // what matters is that `thumbPath` no longer points at a deleted file.
        const img = await fs.readJson(path.join(metaDir, 'img_001.json'));
        assert.equal(img.thumbPath, null);
        assert.equal(img.prompt, 'a dog');
    } finally {
        await fs.remove(root);
    }
});

test('cleanup is idempotent and survives a project with no .meta', async () => {
    const { root, metaDir } = await seedProject();
    try {
        await cleanupRebuildableAssets(root);
        assert.equal(await cleanupRebuildableAssets(root), 0, 'second pass finds nothing');
        assert.ok(await fs.pathExists(path.join(metaDir, 'vid_001.json')));
    } finally {
        await fs.remove(root);
    }

    const bare = await fs.mkdtemp(path.join(os.tmpdir(), 'mpi821-bare-'));
    try {
        assert.equal(await cleanupRebuildableAssets(bare), 0);
    } finally {
        await fs.remove(bare);
    }
});
