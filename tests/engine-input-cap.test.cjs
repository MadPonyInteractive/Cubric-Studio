'use strict';

// MPI-971 — the engine never gets more than ENGINE_MAX_EDGE (4096) on the long edge for a
// model-resolution op. MpiLoadImage opens a 16K original with Pillow's 178.9 MP bomb limit
// and a float32 tensor of the whole image (3.2 GB at 16K), for pixels the graph throws away
// the moment it scales to model size. The server's ENGINE copy is `resolveDisplayImage(...,
// { engine: true })`: lossless PNG, EXIF turned upright, cached under `.thumb.` like the
// display copy, and — unlike it — made even for a file no sidecar owns (a Flow input).

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('fs-extra');
const path = require('node:path');
const os = require('node:os');
const { pathToFileURL } = require('node:url');
const sharp = require('sharp');

const { resolveDisplayImage, DERIVATIVE_RE } = require('../routes/projects.js');

// libvips' file cache holds a read file open, and Windows then refuses the temp-dir delete.
sharp.cache({ files: 0 });

const engine = (file) => resolveDisplayImage(file, 4096, { engine: true });
const solid = (width, height) => sharp({ create: { width, height, channels: 3, background: '#808080' } });

async function project() {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mpi971-'));
    const mediaDir = path.join(root, 'Media');
    const metaDir = path.join(mediaDir, '.meta');
    await fs.ensureDir(metaDir);
    return { root, mediaDir, metaDir };
}

async function addItem({ mediaDir, metaDir }, id, name, img) {
    const file = path.join(mediaDir, name);
    await img.toFile(file);
    await fs.writeJson(path.join(metaDir, `${id}.json`), { filePath: `/project-file?path=${encodeURIComponent(file)}&v=1` });
    return file;
}

test('exactly 4096 goes to the engine as the original: url null, nothing written', async () => {
    const p = await project();
    const file = await addItem(p, 'edge', 'edge_001.png', solid(4096, 2000).png());
    assert.deepEqual(await engine(file), { url: null, width: 4096, height: 2000 });
    assert.deepEqual(await fs.readdir(p.metaDir), ['edge.json']);
    await fs.remove(p.root);
});

test('4097 gets a lossless 4096 copy swept with its item, and a second run reuses it', async () => {
    const p = await project();
    const file = await addItem(p, 'big', 'big_001.jpg', solid(4097, 3000).jpeg());
    const r = await engine(file);
    const out = path.join(p.metaDir, 'big.thumb.engine4096.png');
    assert.equal(r.width, 4097);
    assert.equal(r.height, 3000);
    assert.ok(r.url.startsWith(`/project-file?path=${encodeURIComponent(out)}&v=`), r.url);
    const m = await sharp(out).metadata();
    assert.equal(m.format, 'png');
    assert.equal(m.width, 4096);
    assert.equal(m.height, Math.round(3000 * 4096 / 4097));
    assert.equal(DERIVATIVE_RE.exec(path.basename(out))?.[1], 'big', 'deleted with the card');

    const before = (await fs.stat(out)).mtimeMs;
    assert.equal((await engine(file)).url, r.url);
    assert.equal((await fs.stat(out)).mtimeMs, before, 'cache hit: not re-made');
    await fs.remove(p.root);
});

test('EXIF 6 portrait: the copy is turned upright, the size reported as Chromium shows it', async () => {
    const p = await project();
    // Stored 6000 x 3000, EXIF 6 = rotate 90: the canvas sees 3000 wide, 6000 tall.
    const file = await addItem(p, 'turn', 'turn_001.jpg', solid(6000, 3000).jpeg().withMetadata({ orientation: 6 }));
    const r = await engine(file);
    assert.equal(r.width, 3000);
    assert.equal(r.height, 6000);
    const m = await sharp(path.join(p.metaDir, 'turn.thumb.engine4096.png')).metadata();
    assert.equal(m.height, 4096);
    assert.equal(m.width, 2048);
    assert.ok(!(m.orientation > 1), 'no EXIF turn left for the engine to apply twice');
    await fs.remove(p.root);
});

test('a file no sidecar owns (a Flow input, an agent\'s own file) gets a temp copy, nothing beside it', async () => {
    const p = await project();
    const store = path.join(p.mediaDir, '.preview-assets');
    await fs.ensureDir(store);
    const file = path.join(store, 'abc123.png');
    await solid(5000, 1000).png().toFile(file);
    const r = await engine(file);
    const out = decodeURIComponent(r.url.match(/[?&]path=([^&]+)/)[1]);
    assert.equal(path.dirname(out), path.join(os.tmpdir(), 'cubric-engine-inputs'));
    assert.equal((await sharp(out).metadata()).width, 4096);
    assert.deepEqual(await fs.readdir(store), ['abc123.png'], 'no .meta written into a folder we do not own');

    // The display copy keeps its old rule there: no sidecar, serve the original.
    assert.equal((await resolveDisplayImage(file, 4096)).url, null);
    await fs.remove(out);
    await fs.remove(p.root);
});

test('the capped copy is offered only to ops whose graphs shrink their inputs', async () => {
    const { commands } = await import(pathToFileURL(path.join(__dirname, '..', 'js', 'data', 'commandRegistry.js')).href);
    const flagged = Object.keys(commands).filter(k => commands[k].modelSizedInputs).sort();
    // Changing this list means re-reading every graph that runs the op (VERIFY IN THE GRAPH).
    assert.deepEqual(flagged, ['control', 'edit', 'flowScribble', 'i2i', 'i2v', 'i2v_ms', 'imageDescribe',
        'kleinEdit', 'krea2Edit', 'pid', 'qwenEdit', 'ref2v_ms']);
    // Source-sized output: a capped copy would come back small.
    for (const op of ['upscale', 'detail', 'inpaint', 'imageUpscale', 'removeBackground', 'resize']) {
        assert.ok(!commands[op]?.modelSizedInputs, `${op} must get the original`);
    }
});
