'use strict';

// MPI-961 — the History canvas and Prompt preview draw a DISPLAY copy of a big still, made
// by the server with sharp, so the renderer never decodes a 16K original to show it and a
// 32K (which Chromium cannot decode at all) opens. The copy is pure cache named
// `<id>.thumb.fit<edge>.webp`: the `.thumb.` infix is what the delete paths, the orphan GC
// and Manual Cleanup already match, so it must stay under DERIVATIVE_RE.

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('fs-extra');
const path = require('node:path');
const os = require('node:os');
const sharp = require('sharp');

const { resolveDisplayImage, DERIVATIVE_RE } = require('../routes/projects.js');

const url = (p) => `/project-file?path=${encodeURIComponent(p)}`;

async function project() {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mpi961-'));
    const mediaDir = path.join(root, 'Media');
    const metaDir = path.join(mediaDir, '.meta');
    await fs.ensureDir(metaDir);
    return { root, mediaDir, metaDir };
}

async function addItem({ mediaDir, metaDir }, id, name, img) {
    const file = path.join(mediaDir, name);
    await img.toFile(file);
    // Sidecars carry a `&v=` cache-bust on fresh outputs; the owner lookup must see past it.
    await fs.writeJson(path.join(metaDir, `${id}.json`), { filePath: `${url(file)}&v=123` });
    return file;
}

const solid = (width, height) => sharp({ create: { width, height, channels: 3, background: '#808080' }, limitInputPixels: false });

test('a still within the cap needs no copy: url null, nothing written', async () => {
    const p = await project();
    const file = await addItem(p, 'small', 'small_001.png', solid(800, 600).png());
    const r = await resolveDisplayImage(file, 4096);
    assert.deepEqual(r, { url: null, width: 800, height: 600 });
    assert.deepEqual((await fs.readdir(p.metaDir)).sort(), ['small.json']);
    await fs.remove(p.root);
});

test('a 32K EXIF-rotated JPEG past sharp\'s pixel limit gets a turned copy inside the cap', async () => {
    const p = await project();
    // 32768 x 8200 = 268.7 MP, past sharp's default 268.4 MP limit, and rotated 90 degrees
    // by EXIF 6 — so Chromium (and the canvas) see it 8200 wide, 32768 tall.
    const file = await addItem(p, 'big', 'big_001.jpg', solid(32768, 8200).jpeg({ quality: 50 }).withMetadata({ orientation: 6 }));
    const r = await resolveDisplayImage(file, 4096);
    assert.equal(r.width, 8200);
    assert.equal(r.height, 32768);
    const out = path.join(p.metaDir, 'big.thumb.fit4096.webp');
    assert.match(r.url, new RegExp(`^${url(out).replace(/[.?]/g, '\\$&')}&v=\\d+$`));
    // Read through sharp on purpose: with libvips' default file cache this held the WebP
    // open, and the re-make below died EBUSY on Windows (see `services/ffmpegThumb.js`).
    const m = await sharp(out).metadata();
    assert.equal(m.height, 4096);
    assert.equal(m.width, Math.round(8200 * 4096 / 32768));
    assert.equal(DERIVATIVE_RE.exec(path.basename(out))?.[1], 'big', 'the copy is swept with its item');
    assert.ok(!(await fs.pathExists(`${out}.tmp`)));

    // Cached: a second open reuses the file untouched.
    const before = (await fs.stat(out)).mtimeMs;
    assert.equal((await resolveDisplayImage(file, 4096)).url, r.url);
    assert.equal((await fs.stat(out)).mtimeMs, before);

    // A changed original is re-made — once, even dated in the future (a file copied in from
    // a machine whose clock ran ahead), not on every open after it.
    const later = new Date(Date.now() + 3600e3);
    await fs.utimes(file, later, later);
    const again = await resolveDisplayImage(file, 4096);
    assert.notEqual(again.url, r.url, 'a re-made copy carries a new cache-bust');
    const remade = (await fs.stat(out)).mtimeMs;
    assert.notEqual(remade, before);
    assert.equal((await resolveDisplayImage(file, 4096)).url, again.url);
    assert.equal((await fs.stat(out)).mtimeMs, remade, 'no re-make on the open after');
    await fs.remove(p.root);
});

test('a chip preview is the sidecar thumb; the original only without one', async () => {
    const { projectThumbFor } = require('../routes/projects.js');
    const p = await project();
    const file = await addItem(p, 'chip', 'chip_001.png', solid(64, 64).png());
    assert.equal(await projectThumbFor(file), file, 'no thumb recorded');
    const thumb = path.join(p.metaDir, 'chip.thumb.webp');
    await fs.writeJson(path.join(p.metaDir, 'chip.json'), { filePath: url(file), thumbPath: url(thumb) });
    assert.equal(await projectThumbFor(file), file, 'thumb recorded but gone from disk');
    await solid(16, 16).webp().toFile(thumb);
    assert.equal(await projectThumbFor(file), thumb);
    await fs.remove(p.root);
});

test('a big still no sidecar owns falls back to the original', async () => {
    const p = await project();
    const file = path.join(p.mediaDir, 'stray.png');
    await solid(5000, 100).png().toFile(file);
    const r = await resolveDisplayImage(file, 4096);
    assert.deepEqual(r, { url: null, width: 5000, height: 100 });
    assert.deepEqual(await fs.readdir(p.metaDir), []);
    await fs.remove(p.root);
});
