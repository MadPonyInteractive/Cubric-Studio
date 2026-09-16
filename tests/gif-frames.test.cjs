'use strict';

/**
 * gif-frames.test.cjs — MPI-768.
 *
 * Guards the GIF frames store and builder (services/gifFrames.js + routes/gif.js).
 * The whole reason this file exists: ffmpeg's OWN demuxer duration reporting
 * drifts on a naive GIF build (proven in
 * .agents/mpi-kanban/tasks/MPI-757/research/2026-09-15-investigation.md — asked
 * 10,50,3,2,7 hundredths, a concat + per-file-duration build wrote
 * 12,48,4,1,7,4), so every delay assertion below re-reads the OUTPUT bytes with
 * an INDEPENDENT GIF block walker (not gifFrames.js's own `patchGifDelays`,
 * which writes the very offsets a shared bug could hide) AND cross-checks with
 * `sharp(path,{animated:true}).metadata()`, exactly as the plan's research
 * proved the two must agree.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs-extra');
const path = require('node:path');
const os = require('node:os');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const execFileP = promisify(execFile);
const { ffmpegPath } = require('../services/ffmpegBinary');
const sharp = require('sharp');
const gifFrames = require('../services/gifFrames');

/* ---------------------------------------------------------------------------
 * Test-local, INDEPENDENT GIF block walker — a real parser (header, optional
 * GCT, then Extension/Image blocks to the trailer), never a byte scan for
 * `21 F9 04` (which false-matches inside LZW-compressed image data — the exact
 * trap the research file measured a bogus delay of 58178 from). Written
 * separately from gifFrames.js's own walker so a shared bug cannot hide here.
 * ------------------------------------------------------------------------ */
function walkGifDelaysHundredths(buf) {
    const sig = buf.slice(0, 6).toString('ascii');
    assert.match(sig, /^GIF8[79]a$/, 'not a GIF file');
    let i = 6;
    const packed = buf[i + 4];
    i += 7;
    if (packed & 0x80) i += 3 * Math.pow(2, (packed & 0x07) + 1);

    const delays = [];
    while (i < buf.length) {
        const b = buf[i];
        if (b === 0x21) {
            const label = buf[i + 1];
            if (label === 0xF9) {
                const blockSize = buf[i + 2];
                delays.push(buf.readUInt16LE(i + 4));
                i = i + 2 + 1 + blockSize + 1;
            } else {
                i += 2;
                for (;;) { const len = buf[i]; i += 1 + len; if (len === 0) break; }
            }
        } else if (b === 0x2C) {
            const lp = buf[i + 9];
            let j = i + 10;
            if (lp & 0x80) j += 3 * Math.pow(2, (lp & 0x07) + 1);
            j += 1;
            for (;;) { const len = buf[j]; j += 1 + len; if (len === 0) break; }
            i = j;
        } else if (b === 0x3B) {
            break;
        } else {
            throw new Error(`unexpected GIF byte 0x${b.toString(16)} at ${i}`);
        }
    }
    return delays;
}

async function tmpProject(prefix = 'gif-test-') {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
    const mediaDir = path.join(root, 'Media');
    await fs.ensureDir(path.join(mediaDir, '.meta'));
    await fs.writeJson(path.join(root, 'project.json'), { id: 'p', itemGroups: [], sequenceCounters: {} });
    return { root, mediaDir };
}

/** A tiny solid-colour PNG, distinct content per (colour,size) pair. */
async function solidPng(colour, w = 32, h = 24) {
    const tmp = path.join(os.tmpdir(), `solid-${colour}-${w}x${h}-${Date.now()}-${Math.random().toString(36).slice(2)}.png`);
    await execFileP(ffmpegPath, ['-y', '-f', 'lavfi', '-i', `color=c=${colour}:s=${w}x${h}`, '-frames:v', '1', tmp]);
    const buf = await fs.readFile(tmp);
    await fs.remove(tmp);
    return buf;
}

const url = (p) => `/project-file?path=${encodeURIComponent(p)}`;

/* ── build: exact per-frame delays (block walk AND sharp) ──────────────────── */

test('build writes exact per-frame delays — real block walk and sharp agree', async () => {
    const { mediaDir } = await tmpProject();
    const colours = ['red', 'green', 'blue', 'yellow', 'white'];
    const wanted = [10, 50, 3, 2, 7];
    const hashes = [];
    for (const c of colours) {
        const { hash } = await gifFrames.writeFrame(mediaDir, await solidPng(c));
        hashes.push(hash);
    }

    const outPath = path.join(mediaDir, 'built.gif');
    await gifFrames.buildGif({
        frames: hashes.map((hash, i) => ({ hash, delay: wanted[i] })),
        loop: 1,
        output: { maxEdge: 1024, colours: 256, edgeColour: null },
    }, mediaDir, outPath);

    const buf = await fs.readFile(outPath);
    assert.deepEqual(walkGifDelaysHundredths(buf), wanted,
        'an independent GIF block walk must read back the exact delays asked for');

    const meta = await sharp(outPath, { animated: true }).metadata();
    assert.equal(meta.pages, 5);
    assert.deepEqual(meta.delay, wanted.map(d => d * 10),
        'sharp reports delay in ms = hundredths x10 — must agree with the block walk');
    assert.equal(meta.loop, 1, 'loop=1 (total plays, once) must round-trip through the raw -loop remap');
});

/* ── delay floor ────────────────────────────────────────────────────────── */

test('never writes a delay under the floor (Chromium plays 0/1 as 10)', async () => {
    const { mediaDir } = await tmpProject();
    const { hash: h1 } = await gifFrames.writeFrame(mediaDir, await solidPng('red'));
    const { hash: h2 } = await gifFrames.writeFrame(mediaDir, await solidPng('green'));
    const { hash: h3 } = await gifFrames.writeFrame(mediaDir, await solidPng('blue'));

    const outPath = path.join(mediaDir, 'floor.gif');
    await gifFrames.buildGif({
        frames: [{ hash: h1, delay: 0 }, { hash: h2, delay: 1 }, { hash: h3, delay: 9 }],
        loop: 0,
        output: { maxEdge: 1024, colours: 256, edgeColour: null },
    }, mediaDir, outPath);

    const delays = walkGifDelaysHundredths(await fs.readFile(outPath));
    assert.deepEqual(delays, [2, 2, 9], 'requests of 0 and 1 must be floored to 2; 9 passes through untouched');
    assert.ok(delays.every(d => d >= gifFrames.MIN_DELAY_HUNDREDTHS));
});

/* ── transparent pixels never show the previous frame ──────────────────────── */

test('transparent pixels show the build background, never the previous frame', async () => {
    const { mediaDir } = await tmpProject();
    const redRgba = await sharp(await solidPng('red')).ensureAlpha().png().toBuffer();
    const { hash: red } = await gifFrames.writeFrame(mediaDir, redRgba);
    // Frame 1: left half fully transparent (hidden RGB green), right half opaque blue.
    const w = 32, h = 24;
    const raw = Buffer.alloc(w * h * 4);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const o = (y * w + x) * 4;
            if (x < w / 2) raw.set([0, 255, 0, 0], o); else raw.set([0, 0, 255, 255], o);
        }
    }
    const half = await sharp(raw, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
    const { hash: cut } = await gifFrames.writeFrame(mediaDir, half);
    const frames = [{ hash: red, delay: 10 }, { hash: cut, delay: 10 }];

    const pixel = async (file, page) => {
        const { data, info } = await sharp(file, { page }).raw().toBuffer({ resolveWithObject: true });
        return [...data.subarray(0, info.channels)].concat(info.channels === 4 ? [] : [255]);
    };

    const opaque = path.join(mediaDir, 'opaque.gif');
    await gifFrames.buildGif({ frames, loop: 0, output: { edgeColour: null } }, mediaDir, opaque);
    assert.deepEqual(await pixel(opaque, 1), [0, 0, 0, 255], 'opaque build: transparency becomes black');

    const clear = path.join(mediaDir, 'clear.gif');
    await gifFrames.buildGif({ frames, loop: 0, output: { edgeColour: '#ffffff' } }, mediaDir, clear);
    assert.equal((await pixel(clear, 1))[3], 0, 'transparent build: the pixel stays transparent over the red frame');
    assert.deepEqual(walkGifDelaysHundredths(await fs.readFile(clear)), [10, 10]);

    // An RGB frame beside an RGBA one used to cost a frame in the concat build.
    const { hash: rgb } = await gifFrames.writeFrame(mediaDir, await solidPng('yellow'));
    for (const edgeColour of [null, '#ffffff']) {
        const mixed = path.join(mediaDir, `mixed-${edgeColour ? 'clear' : 'opaque'}.gif`);
        await gifFrames.buildGif({ frames: [{ hash: rgb, delay: 5 }, ...frames], loop: 0, output: { edgeColour } }, mediaDir, mixed);
        assert.deepEqual(walkGifDelaysHundredths(await fs.readFile(mixed)), [5, 10, 10], `mixed formats keep every frame (edgeColour ${edgeColour})`);
    }
});

/* ── extraction round trip on a variable-delay GIF ─────────────────────────── */

test('extraction round-trips a variable-delay GIF back to the same delays', async () => {
    const { mediaDir } = await tmpProject();
    const wanted = [10, 50, 3, 2, 7];
    const hashes = [];
    for (const c of ['red', 'green', 'blue', 'yellow', 'white']) {
        const { hash } = await gifFrames.writeFrame(mediaDir, await solidPng(c));
        hashes.push(hash);
    }
    const outPath = path.join(mediaDir, 'variable.gif');
    await gifFrames.buildGif({
        frames: hashes.map((hash, i) => ({ hash, delay: wanted[i] })),
        loop: 0,
        output: { maxEdge: 1024, colours: 256, edgeColour: null },
    }, mediaDir, outPath);

    const extracted = await gifFrames.extractFramesFromGif(outPath, mediaDir);
    assert.equal(extracted.frames.length, 5, 'must recover all 5 frames, not a demuxer-drifted count');
    assert.deepEqual(extracted.frames.map(f => f.delay), wanted,
        'extracted per-frame delays must exactly match what was built, not ffmpeg demuxer duration drift');
    assert.equal(extracted.loop, 0);
    assert.ok(extracted.frames.every(f => /^[0-9a-f]{64}$/.test(f.hash)));
});

/* ── dedup ──────────────────────────────────────────────────────────────── */

test('identical frame content is written once, even when the list repeats it', async () => {
    const { mediaDir } = await tmpProject();
    const redBuf = await solidPng('red');
    const { hash: h1 } = await gifFrames.writeFrame(mediaDir, redBuf);
    const { hash: h2 } = await gifFrames.writeFrame(mediaDir, redBuf); // same bytes again
    assert.equal(h1, h2, 'identical content must hash identically');

    const dir = await fs.readdir(gifFrames.framesDir(mediaDir));
    const pngCount = dir.filter(f => f === `${h1}.png`).length;
    assert.equal(pngCount, 1, 'the store must hold exactly one copy of the bytes');

    // A frame LIST may still repeat the same hash with different delays — the
    // repetition lives in the list, never in the store.
    const { hash: hGreen } = await gifFrames.writeFrame(mediaDir, await solidPng('green'));
    const outPath = path.join(mediaDir, 'dedup.gif');
    await gifFrames.buildGif({
        frames: [{ hash: h1, delay: 10 }, { hash: hGreen, delay: 20 }, { hash: h1, delay: 30 }],
        loop: 0,
        output: { maxEdge: 1024, colours: 256, edgeColour: null },
    }, mediaDir, outPath);
    const delays = walkGifDelaysHundredths(await fs.readFile(outPath));
    assert.deepEqual(delays, [10, 20, 30], 'a repeated hash still produces its own GIF frame per list entry');

    const dirAfterBuild = await fs.readdir(gifFrames.framesDir(mediaDir));
    assert.equal(dirAfterBuild.filter(f => f === `${h1}.png`).length, 1, 'the build must not duplicate the stored frame');
});

/* ── sweep: only unreferenced frames are removed, archived survives ───────── */

test('sweep deletes only unreferenced frames; an archived reference survives', async () => {
    const { mediaDir } = await tmpProject();
    const { hash: hActive } = await gifFrames.writeFrame(mediaDir, await solidPng('red'));
    const { hash: hArchived } = await gifFrames.writeFrame(mediaDir, await solidPng('green'));
    const { hash: hOrphan } = await gifFrames.writeFrame(mediaDir, await solidPng('blue'));

    const metaDir = path.join(mediaDir, '.meta');
    await fs.writeJson(path.join(metaDir, 'active.json'),
        { id: 'active', type: 'image', gif: { frames: [{ hash: hActive, delay: 10 }], loop: 0, output: {} } });
    await fs.writeJson(path.join(metaDir, 'archived.json'),
        { id: 'archived', type: 'image', gif: { frames: [{ hash: hArchived, delay: 10 }], loop: 0, output: {} } });
    // project.json marks the archived item's GROUP archived — the sweep must
    // still count it: archiving is a project.json flag flip, never a sidecar
    // deletion (docs/gallery.md § Retention), and the sweep reads sidecars only.
    await fs.writeJson(path.join(mediaDir, '..', 'project.json'),
        { id: 'p', itemGroups: [{ id: 'g1', archived: true, history: ['archived'] }], sequenceCounters: {} });
    // hOrphan is referenced by nothing.

    const before = await fs.readdir(gifFrames.framesDir(mediaDir));
    assert.equal(before.length, 6, 'sanity: 3 frames x (png + thumb) before the sweep');

    const { removed } = await gifFrames.sweepGifFrames(mediaDir);
    assert.equal(removed, 2, 'exactly the orphan\'s png + thumb are removed');

    const after = await fs.readdir(gifFrames.framesDir(mediaDir));
    assert.ok(after.some(f => f.startsWith(hActive)), 'the active reference survives');
    assert.ok(after.some(f => f.startsWith(hArchived)), 'the ARCHIVED reference survives');
    assert.ok(!after.some(f => f.startsWith(hOrphan)), 'the unreferenced frame is gone');
});

test('sweep is a cheap no-op for a project that never had a GIF', async () => {
    const { mediaDir } = await tmpProject();
    const result = await gifFrames.sweepGifFrames(mediaDir);
    assert.deepEqual(result, { removed: 0 });
});

/* ── routes/gif.js: Update writes a new sequenced name, deletes the old file ── */

test('gif entry Update rewrites the current item under a NEW filename (E5)', async (t) => {
    const express = require('express');
    const projectsRouter = require('../routes/projects.js');
    const gifRouter = require('../routes/gif.js');

    const { root, mediaDir } = await tmpProject();
    const metaDir = path.join(mediaDir, '.meta');

    const { hash: h1 } = await gifFrames.writeFrame(mediaDir, await solidPng('red'));
    const { hash: h2 } = await gifFrames.writeFrame(mediaDir, await solidPng('green'));

    const firstPath = path.join(mediaDir, 'gif_001.gif');
    const firstEntry = { frames: [{ hash: h1, delay: 10 }], loop: 0, output: { maxEdge: 1024, colours: 256, edgeColour: null } };
    await gifFrames.buildGif(firstEntry, mediaDir, firstPath);
    await fs.writeJson(path.join(metaDir, 'item1.json'), {
        id: 'item1', type: 'image', filePath: url(firstPath), gif: firstEntry, displayName: 'gif_001',
    });

    const app = express();
    app.use(express.json());
    app.use(projectsRouter);
    app.use(gifRouter);
    const server = await new Promise(r => { const s = app.listen(0, '127.0.0.1', () => r(s)); });

    try {
        const res = await fetch(`http://127.0.0.1:${server.address().port}/gif/entry`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                folderPath: root, mode: 'update', itemId: 'item1',
                frames: [{ hash: h1, delay: 10 }, { hash: h2, delay: 20 }],
                loop: 0, output: { maxEdge: 1024, colours: 256, edgeColour: null },
            }),
        }).then(r => r.json());

        assert.equal(res.success, true);
        const newAbs = path.normalize(decodeURIComponent(res.item.filePath.replace(/^.*[?&]path=/, '').split('&')[0]));
        assert.notEqual(path.basename(newAbs), 'gif_001.gif', 'Update must mint a NEW sequenced filename, never overwrite the old one');
        assert.equal(await fs.pathExists(newAbs), true, 'the new .gif must exist');
        assert.equal(await fs.pathExists(firstPath), false, 'the OLD .gif must be removed once the new one lands (E5)');
        assert.equal(res.item.id, 'item1', 'Update keeps the SAME item id — it is not a new history entry');

        const onDisk = await fs.readJson(path.join(metaDir, 'item1.json'));
        assert.equal(onDisk.gif.frames.length, 2);
    } finally {
        await new Promise(r => server.close(r));
        await fs.remove(root);
    }
});

/* ── legacy .gif extracts lazily, on the first ensure-frames call ─────────── */

test('a legacy .gif with no `gif` field extracts lazily via /gif/ensure-frames', async (t) => {
    const express = require('express');
    const gifRouter = require('../routes/gif.js');

    const { root, mediaDir } = await tmpProject();
    const metaDir = path.join(mediaDir, '.meta');

    // Build a real variable-delay GIF directly with ffmpeg — bypassing
    // gifFrames.js entirely — to stand in for a GIF imported before this
    // feature shipped (no `.gif-frames` entry owns its bytes at all).
    const frameDir = await fs.mkdtemp(path.join(os.tmpdir(), 'legacy-src-'));
    const names = [];
    for (const [i, c] of ['red', 'green', 'blue'].entries()) {
        const p = path.join(frameDir, `f${i}.png`);
        await execFileP(ffmpegPath, ['-y', '-f', 'lavfi', '-i', `color=c=${c}:s=16x16`, '-frames:v', '1', p]);
        names.push(`f${i}.png`);
    }
    await fs.writeFile(path.join(frameDir, 'list.txt'), names.map(n => `file '${n}'`).join('\n') + '\n');
    const legacyPath = path.join(mediaDir, 'legacy.gif');
    await execFileP(ffmpegPath, [
        '-y', '-r', '10', '-f', 'concat', '-safe', '0', '-i', path.join(frameDir, 'list.txt'),
        '-filter_complex', '[0:v] split [a][b];[a] palettegen [p];[b][p] paletteuse',
        '-loop', '0', legacyPath,
    ], { cwd: frameDir });
    await fs.remove(frameDir);

    await fs.writeJson(path.join(metaDir, 'legacyItem.json'), {
        id: 'legacyItem', type: 'image', filePath: url(legacyPath), displayName: 'legacy', uploaded: true,
    }); // deliberately NO `gif` field — this is the pre-MPI-768 shape

    assert.equal(await fs.pathExists(gifFrames.framesDir(mediaDir)), false, 'nothing must run on project open — no frames store yet');

    const app = express();
    app.use(express.json());
    app.use(gifRouter);
    const server = await new Promise(r => { const s = app.listen(0, '127.0.0.1', () => r(s)); });

    try {
        const res = await fetch(`http://127.0.0.1:${server.address().port}/gif/ensure-frames`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ folderPath: root, itemId: 'legacyItem' }),
        }).then(r => r.json());

        assert.equal(res.success, true);
        assert.equal(res.gif.frames.length, 3, 'the first open must extract every frame');
        assert.ok(res.gif.frames.every(f => f.url && f.thumbUrl), 'each frame carries a ready-to-mount url + thumbUrl');

        const patched = await fs.readJson(path.join(metaDir, 'legacyItem.json'));
        assert.equal(patched.gif.frames.length, 3, 'the sidecar on disk is patched, so a reload does not re-extract');

        // Second call is a no-op read, not a re-extraction (same hashes back).
        const res2 = await fetch(`http://127.0.0.1:${server.address().port}/gif/ensure-frames`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ folderPath: root, itemId: 'legacyItem' }),
        }).then(r => r.json());
        assert.deepEqual(res2.gif.frames.map(f => f.hash), res.gif.frames.map(f => f.hash));
    } finally {
        await new Promise(r => server.close(r));
        await fs.remove(root);
    }
});

/* ── add-from-cards copies the referenced frames into the destination store ── */

test('add-from-cards copies a GIF item\'s frames into the destination project', async (t) => {
    const express = require('express');
    const projectsRouter = require('../routes/projects.js');

    const { root: srcRoot, mediaDir: srcMediaDir } = await tmpProject('gif-src-');
    const { root: dstRoot, mediaDir: dstMediaDir } = await tmpProject('gif-dst-');

    const { hash } = await gifFrames.writeFrame(srcMediaDir, await solidPng('red'));
    const srcGifPath = path.join(srcMediaDir, 'gif_001.gif');
    const gifField = { frames: [{ hash, delay: 10 }], loop: 0, output: { maxEdge: 1024, colours: 256, edgeColour: null } };
    await gifFrames.buildGif(gifField, srcMediaDir, srcGifPath);
    const srcId = '11111111-2222-3333-4444-555555555555';
    await fs.writeJson(path.join(srcMediaDir, '.meta', `${srcId}.json`),
        { id: srcId, type: 'image', filePath: url(srcGifPath), gif: gifField, displayName: 'gif_001' });

    const app = express();
    app.use(express.json());
    app.use(projectsRouter);
    const server = await new Promise(r => { const s = app.listen(0, '127.0.0.1', () => r(s)); });

    try {
        const res = await fetch(`http://127.0.0.1:${server.address().port}/project-media/dst/add-from-cards`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                folderPath: dstRoot,
                cards: [{ type: 'image', name: 'GIF', item: { id: srcId, filePath: url(srcGifPath) } }],
            }),
        }).then(r => r.json());
        assert.deepEqual(res, { success: true, added: 1 });

        const destFramePng = gifFrames.frameAbsPath(dstMediaDir, hash);
        assert.equal(await fs.pathExists(destFramePng), true, 'the referenced frame PNG must be copied into the destination store');
        assert.equal(await fs.pathExists(gifFrames.frameThumbAbsPath(dstMediaDir, hash)), true, 'the thumbnail travels too');

        const written = (await fs.readdir(path.join(dstMediaDir, '.meta'))).filter(f => f.endsWith('.json'));
        assert.equal(written.length, 1);
        const dstMeta = await fs.readJson(path.join(dstMediaDir, '.meta', written[0]));
        assert.deepEqual(dstMeta.gif.frames.map(f => f.hash), [hash], 'the copy keeps the same content hash — it is the same content-addressed store shape');
    } finally {
        await new Promise(r => server.close(r));
        await fs.remove(srcRoot);
        await fs.remove(dstRoot);
    }
});
