'use strict';
// D3 throwaway: drive every sidecar-writing route on a tiny project, dump what each wrote.
// usage: node d3snap.cjs <repoRoot> <out.json>
const repo = process.argv[2];
const out = process.argv[3];
const R = p => require(require('node:path').join(repo, p));
const path = require('node:path');
const os = require('node:os');
const fs = R('node_modules/fs-extra');
const sharp = R('node_modules/sharp');
const express = R('node_modules/express');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { ffmpegPath } = R('services/ffmpegBinary');
const { writeFrame } = R('services/gifFrames');
const { packSheet } = R('js/utils/sheetLayout.js');

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;

(async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'd3snap-'));
    const mediaDir = path.join(root, 'Media');
    const metaDir = path.join(mediaDir, '.meta');
    await fs.ensureDir(metaDir);
    await fs.writeJson(path.join(root, 'project.json'), { id: 'p', itemGroups: [], sequenceCounters: {} });

    const vid = path.join(mediaDir, 'src.mp4');
    await promisify(execFile)(ffmpegPath, ['-y', '-f', 'lavfi', '-i', 'testsrc=size=64x48:rate=10:duration=1',
        '-f', 'lavfi', '-i', 'sine=frequency=440:duration=1', '-shortest', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', vid], { windowsHide: true });
    const vid2 = path.join(mediaDir, 'src2.mp4');
    await fs.copy(vid, vid2);
    const img = path.join(mediaDir, 'src.png');
    await sharp({ create: { width: 64, height: 48, channels: 3, background: { r: 200, g: 50, b: 50 } } }).png().toFile(img);
    const url = p => `/project-file?path=${encodeURIComponent(p)}`;
    for (const [id, type, p] of [['v1', 'video', vid], ['v2', 'video', vid2], ['i1', 'image', img], ['i2', 'image', img]]) {
        await fs.writeJson(path.join(metaDir, `${id}.json`), { id, type, filePath: url(p), pixelDimensions: { w: 64, h: 48 } });
    }
    const half = await sharp({ create: { width: 64, height: 48, channels: 3, background: { r: 255, g: 255, b: 255 } } }).png().toBuffer();
    const maskUrl = `data:image/png;base64,${half.toString('base64')}`;
    const frameBuf = await sharp(img).png().toBuffer();
    const frameHash = await writeFrame(mediaDir, frameBuf, null).then(r => (typeof r === 'string' ? r : r.hash));

    const app = express();
    app.use(express.json({ limit: '50mb' }));
    for (const r of ['routes/videoConcat', 'routes/videoCrop', 'routes/videoReverse', 'routes/videoExtract', 'routes/gifToVideo', 'routes/imageSheet', 'routes/projects']) {
        const mod = R(r);
        app.use(mod.router || mod);
    }
    const server = app.listen(0);
    const base = `http://127.0.0.1:${server.address().port}`;
    const cases = {
        combine: ['/combine-videos', { folderPath: root, itemIds: ['v1', 'v2'] }],
        videoCrop: ['/api/video/crop', { folderPath: root, sourcePath: url(vid), cropRect: { x: 0, y: 0, width: 0.5, height: 0.5 }, itemId: 'v1', groupId: 'g1' }],
        videoCropTrim: ['/api/video/crop', { folderPath: root, sourcePath: url(vid), cropRect: { x: 0.25, y: 0.25, width: 0.5, height: 0.5 }, trimIn: 0.2, trimOut: 0.6 }],
        reverse: ['/api/video/reverse', { folderPath: root, sourcePath: url(vid), itemId: 'v1', groupId: 'g1' }],
        reverseVideoOnly: ['/api/video/reverse', { folderPath: root, sourcePath: url(vid), mode: 'video' }],
        videoExtract: ['/video-extract/apply', { folderPath: root, sourcePath: vid, trimIn: 0.2, trimOut: 0.7, masks: Array(5).fill(maskUrl), background: '#00ff00', itemId: 'v1', groupId: 'g1' }],
        gifToVideo: ['/gif/to-video', { folderPath: root, frames: [{ hash: frameHash, delay: 10 }, { hash: frameHash, delay: 10 }], itemId: 'gg', groupId: 'g1' }],
        sheet: ['/combine-images', { folderPath: root, itemIds: ['i1', 'i2'], tree: packSheet([64 / 48, 64 / 48]).tree, longEdge: 2048 }],
        cropMedia: ['/project/crop-media', { folderPath: root, sourceFilePath: url(img), x: 0, y: 0, w: 32, h: 24 }],
        compositeMedia: ['/project/composite-media', { folderPath: root, basePath: url(img), overlayPath: img, maskDataUrl: maskUrl }],
        applyPaint: ['/project/apply-paint', { folderPath: root, sourceFilePath: url(img), paintDataUrl: maskUrl, opacity: 0.5, operation: 'composite' }],
        extractMedia: ['/project/extract-media', { folderPath: root, sourceFilePath: url(img), maskDataUrl: maskUrl, background: '#000000' }],
    };
    const result = {};
    for (const [name, [route, body]] of Object.entries(cases)) {
        const before = new Set(await fs.readdir(metaDir));
        const res = await fetch(base + route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const data = await res.json();
        const added = (await fs.readdir(metaDir)).filter(n => !before.has(n)).sort();
        const sidecars = {};
        for (const n of added.filter(n => /^[0-9a-f-]{36}\.json$/.test(n))) sidecars['<sidecar>'] = await fs.readJson(path.join(metaDir, n));
        result[name] = { status: res.status, data, files: added.map(n => n.replace(UUID, '<id>')), sidecars };
    }
    server.close();
    const norm = JSON.stringify(result, null, 2)
        .split(root.replace(/\\/g, '\\\\')).join('<root>')
        .split(encodeURIComponent(root)).join('<root>')
        .replace(UUID, '<id>')
        .replace(/\d{4}-\d\d-\d\dT[\d:.]+Z/g, '<date>')
        .replace(/(%26|&)v=\d+/g, '$1v=<mtime>');
    await fs.writeFile(out, norm);
    console.log('wrote', out, Object.keys(result).map(k => `${k}:${result[k].status}`).join(' '));
    process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
