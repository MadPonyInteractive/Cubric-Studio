'use strict';

// MPI-623 single shot (plan A2/A3) — a converted pano carries `scenePath`, the manifest
// `.meta/<id>.scene.json`, and its records as sibling `<id>.scene.*` files. Two silent
// failures guarded here, beside splat-companion.test.cjs's own:
//   - a scene file the delete sweep does not claim leaks forever; one it claims for the
//     wrong id deletes a live card's records;
//   - a copied card whose `scenePath` still names the SOURCE project works until that
//     project is deleted.
// And A3: scene-ness is the CARD's. A scene card whose selected entry is one of its plain
// pictures must still open as a scene, wear the scene chip, filter as a scene, never stack.

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('fs-extra');
const path = require('node:path');
const os = require('node:os');
const { pathToFileURL } = require('node:url');

const { DERIVATIVE_RE, removeItemThumbs } = require('../routes/projects.js');

const ID = '11111111-2222-3333-4444-555555555555';
const OTHER = '99999999-8888-7777-6666-555555555555';
const SCENE_FILES = (id) => [`${id}.scene.json`, `${id}.scene.depth.f32`, `${id}.scene.layer0.png`, `${id}.scene.layer0.depth.f32`];
const esm = (p) => import(pathToFileURL(path.join(__dirname, '..', p)).href);

test('DERIVATIVE_RE claims every scene record for its own id, and nothing else', () => {
    for (const f of SCENE_FILES(ID)) assert.equal(DERIVATIVE_RE.exec(f)?.[1], ID, f);
    assert.equal(DERIVATIVE_RE.exec(`${ID}.json`)?.[1], undefined, 'the sidecar is not a companion');
    assert.equal(DERIVATIVE_RE.exec('scene_001.png')?.[1], undefined, 'a media file named scene is not a companion');
});

test('deleting an item sweeps its scene records and leaves every other item alone', async () => {
    const metaDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mpi623-scene-'));
    try {
        for (const f of [`${ID}.json`, ...SCENE_FILES(ID), `${OTHER}.json`, ...SCENE_FILES(OTHER)]) {
            await fs.writeFile(path.join(metaDir, f), 'x');
        }
        removeItemThumbs(metaDir, ID);
        assert.deepEqual((await fs.readdir(metaDir)).sort(), [`${ID}.json`, `${OTHER}.json`, ...SCENE_FILES(OTHER)].sort());
    } finally {
        await fs.remove(metaDir);
    }
});

test('add-from-cards copies the whole scene set under the new id and re-points scenePath', async (t) => {
    const express = require('express');
    const app = express();
    app.use(express.json());
    app.use(require('../routes/projects.js'));
    const server = await new Promise(r => { const s = app.listen(0, '127.0.0.1', () => r(s)); });

    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mpi623-scene-copy-'));
    const srcRoot = path.join(root, 'src');
    const srcMeta = path.join(srcRoot, 'Media', '.meta');
    const dstRoot = path.join(root, 'dst');
    const dstMeta = path.join(dstRoot, 'Media', '.meta');
    await fs.ensureDir(srcMeta);
    await fs.ensureDir(dstMeta);
    await fs.writeJson(path.join(dstRoot, 'project.json'), { id: 'dst', itemGroups: [] });

    const url = (p) => `/project-file?path=${encodeURIComponent(p)}`;
    const srcStill = path.join(srcRoot, 'Media', 'pano_001.png');
    const srcManifest = path.join(srcMeta, `${ID}.scene.json`);
    await fs.writeFile(srcStill, 'pano-bytes');
    for (const f of SCENE_FILES(ID)) await fs.writeFile(path.join(srcMeta, f), `bytes of ${f.slice(ID.length)}`);
    await fs.writeFile(path.join(srcMeta, `${OTHER}.scene.depth.f32`), 'another card');
    await fs.writeJson(path.join(srcMeta, `${ID}.json`), { id: ID, type: 'image', filePath: url(srcStill), scenePath: url(srcManifest) });

    const copy = async () => (await fetch(`http://127.0.0.1:${server.address().port}/project-media/dst/add-from-cards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderPath: dstRoot, cards: [{ type: 'image', name: 'Pano',
            item: { id: ID, filePath: url(srcStill), scenePath: url(srcManifest) } }] }),
    })).json();
    const copiedMeta = async () => {
        const written = (await fs.readdir(dstMeta)).filter(f => /^[0-9a-f-]+\.json$/.test(f));
        assert.equal(written.length, 1, 'exactly one sidecar per copied card');
        return fs.readJson(path.join(dstMeta, written[0]));
    };

    try {
        await t.test('every record travels, renamed to the copy, and nothing of another card', async () => {
            assert.deepEqual(await copy(), { success: true, added: 1 });
            const meta = await copiedMeta();
            assert.notEqual(meta.id, ID);
            assert.equal(decodeURIComponent(meta.scenePath.replace(/^.*[?&]path=/, '')), path.join(dstMeta, `${meta.id}.scene.json`));
            for (const f of SCENE_FILES(meta.id)) {
                assert.equal(await fs.readFile(path.join(dstMeta, f), 'utf8'), `bytes of ${f.slice(meta.id.length)}`, f);
            }
            assert.equal((await fs.readdir(dstMeta)).some(f => f.startsWith(OTHER) || f.startsWith(ID)), false);
        });

        await t.test('a scenePath whose manifest is gone is dropped, not inherited', async () => {
            await fs.emptyDir(dstMeta);
            await fs.remove(srcManifest);
            assert.deepEqual(await copy(), { success: true, added: 1 });
            assert.equal('scenePath' in await copiedMeta(), false);
        });
    } finally {
        await new Promise(r => server.close(r));
        await fs.remove(root);
    }
});

test('a scene card stays a scene whichever entry is selected (A3)', async () => {
    const { getSceneItem, kindOfItem } = await esm('js/utils/assetKinds.js');
    const { kindItemOf } = await esm('js/utils/galleryFilter.js');
    const { stackableKind } = await esm('js/data/stackModel.js');
    const { createImageItem } = await esm('js/data/projectModel.js');

    assert.equal(createImageItem().scenePath, null, 'declared, so it survives a spread');
    const pano = createImageItem({ scenePath: '/project-file?path=x.scene.json' });
    const picture = createImageItem();
    const card = { id: 'g', type: 'image', history: [pano, picture], selectedIndex: 1 };

    assert.equal(getSceneItem(card), pano);
    assert.equal(kindOfItem(kindItemOf(card, picture)).kind, 'scene', 'chip and filter read the card');
    assert.equal(stackableKind(card), null, 'a scene card never stacks');
    const plain = { id: 'p', type: 'image', history: [picture], selectedIndex: 0 };
    assert.equal(getSceneItem(plain), null);
    assert.equal(kindOfItem(kindItemOf(plain, picture)).kind, 'image');
    assert.equal(stackableKind(plain), 'image');
    assert.equal(kindOfItem({ type: 'image', splatPath: 'a.ply' }).kind, 'scene', 'a splat card is still a scene');
});
