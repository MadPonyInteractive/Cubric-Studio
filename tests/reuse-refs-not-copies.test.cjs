'use strict';

// MPI-821 — Reuse points at the SOURCE CARD, not at a hidden copy of it.
//
// MPI-227 copied every input image into `Media/.preview-assets/<sha256>` so a Reuse
// would still work after the source card was deleted. Archive covers that now, so the
// copy is gone and the sidecar records the source's own url. A source the user really
// did delete takes its inputs with it — `resolvePromptReuseMediaItems` HEADs every url
// and drops the dead ones, so the reuse degrades to a toast rather than a broken chip.
//
// What must NOT regress: `placeContentAsset` and the `place-preview-asset` route stay,
// because they serve files that have NO gallery card at all — the agent's `placeAsset`
// and a Flow's OS-file drop. Those are a published contract.

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('fs-extra');
const path = require('node:path');
const os = require('node:os');

const projects = require('../routes/projects.js');
const { materializePreviewAssets, placeContentAsset } = projects;

function pngUrl(bytes) {
    return `data:image/png;base64,${Buffer.from(bytes).toString('base64')}`;
}

async function scratch() {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mpi821-reuse-'));
    const mediaDir = path.join(root, 'Media');
    await fs.ensureDir(mediaDir);
    return { root, mediaDir };
}

test('a preview-stage snapshot records the source url and copies nothing', async () => {
    const { root, mediaDir } = await scratch();
    try {
        const frozenParams = {
            seed: 7,
            mediaItems: [
                { id: 'm1', url: '/project-file?path=C:/p/Media/img_001.png', mediaType: 'image', role: 'startFrame' },
            ],
        };

        const out = await materializePreviewAssets({
            projectRoot: root,
            mediaDir,
            itemId: 'item-1',
            stage: 'preview',
            frozenParams,
            previewAssets: {
                latent: null,
                snapshots: [
                    { id: 'm1', role: 'startFrame', mediaType: 'image', url: '/project-file?path=C:/p/Media/img_001.png' },
                ],
            },
            comfyViewUrl: null,
        });

        const [snap] = out.previewAssets.snapshots;
        assert.equal(snap.role, 'startFrame');
        assert.equal(snap.status, 'available');
        // The ref IS the source url. `promptReuse._mediaItemsFromPreviewAssets` reads
        // `filePath || url`, so a `filePath` here would mean a copy came back.
        assert.equal(snap.url, '/project-file?path=C:/p/Media/img_001.png');
        assert.equal(snap.filePath, undefined, 'no copy path — nothing was placed');
        assert.equal(snap.relativePath, undefined);

        // frozenParams is handed back untouched: it already names the same inputs, and
        // the rewrite that repointed it at the copy left with the copy.
        assert.equal(out.frozenParams, frozenParams, 'same object, not a rewritten clone');
        assert.equal(out.frozenParams.mediaItems[0].url, '/project-file?path=C:/p/Media/img_001.png');
        assert.equal(out.frozenParams.mediaItems[0].source, undefined);

        assert.equal(
            await fs.pathExists(path.join(mediaDir, '.preview-assets')),
            false,
            'the store is not even created for a gallery-sourced input',
        );
    } finally {
        await fs.remove(root);
    }
});

test('a snapshot with no role is still skipped, and a non-preview stage does nothing', async () => {
    const { root, mediaDir } = await scratch();
    try {
        const withoutRole = await materializePreviewAssets({
            projectRoot: root, mediaDir, itemId: 'item-2', stage: 'preview',
            frozenParams: null,
            previewAssets: { latent: null, snapshots: [{ id: 'm1', mediaType: 'image', url: 'x.png' }] },
            comfyViewUrl: null,
        });
        assert.deepEqual(withoutRole.previewAssets.snapshots, [], 'a role-less input has nothing to resurface against');

        const finalStage = await materializePreviewAssets({
            projectRoot: root, mediaDir, itemId: 'item-3', stage: 'final',
            frozenParams: null,
            previewAssets: { latent: null, snapshots: [{ id: 'm1', role: 'startFrame', url: 'x.png' }] },
            comfyViewUrl: null,
        });
        assert.equal(finalStage.previewAssets, null);
    } finally {
        await fs.remove(root);
    }
});

test('the store survives for files that have NO gallery card', async () => {
    // The agent's `placeAsset` and a Flow's OS-file drop both land here. Nothing in
    // MPI-821 may take this away: their source is a scratch file or the desktop, so
    // there is no card for Archive to keep.
    assert.equal(typeof placeContentAsset, 'function');
    assert.equal(projects.materializeGenerationFrameSnapshots, undefined,
        'the gallery-sourced copier is gone');

    const { root, mediaDir } = await scratch();
    try {
        const placed = await placeContentAsset(pngUrl([9, 9, 9]), '.png', mediaDir, root);
        assert.ok(await fs.pathExists(placed.absPath));
        assert.equal(path.dirname(placed.absPath), path.join(mediaDir, '.preview-assets'));
    } finally {
        await fs.remove(root);
    }
});
