'use strict';
// D10 GIF throwaway: drive every GIF-card route on a tiny project, dump what each wrote.
// usage: node d10snap.cjs <repoRoot> <out.json>
const repo = process.argv[2];
const out = process.argv[3];
const path = require('node:path');
const R = p => require(path.join(repo, p));
const os = require('node:os');
const fs = R('node_modules/fs-extra');
const sharp = R('node_modules/sharp');
const express = R('node_modules/express');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { ffmpegPath } = R('services/ffmpegBinary');
const { writeFrame } = R('services/gifFrames');

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;

(async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'd10snap-'));
    const mediaDir = path.join(root, 'Media');
    const metaDir = path.join(mediaDir, '.meta');
    await fs.ensureDir(metaDir);
    await fs.writeJson(path.join(root, 'project.json'), { id: 'p', itemGroups: [], sequenceCounters: {} });
    const url = p => `/project-file?path=${encodeURIComponent(p)}`;

    const vid = path.join(mediaDir, 'src.mp4');
    await promisify(execFile)(ffmpegPath, ['-y', '-f', 'lavfi', '-i', 'testsrc=size=64x48:rate=10:duration=2',
        '-c:v', 'libx264', '-pix_fmt', 'yuv420p', vid], { windowsHide: true });
    const hashes = [];
    for (const [i, colour] of ['#c83232', '#32c832', '#3232c8'].entries()) {
        const p = path.join(mediaDir, `still${i}.png`);
        await sharp({ create: { width: 64, height: 48, channels: 4, background: colour } }).png().toFile(p);
        await fs.writeJson(path.join(metaDir, `s${i}.json`), { id: `s${i}`, type: 'image', filePath: url(p), pixelDimensions: { w: 64, h: 48 } });
        hashes.push((await writeFrame(mediaDir, await fs.readFile(p), null)).hash);
    }
    const frames = hashes.map((hash, i) => ({ hash, delay: 10 + i }));
    const mask = await sharp({ create: { width: 64, height: 48, channels: 3, background: '#ffffff' } }).png().toBuffer();
    const maskUrl = `data:image/png;base64,${mask.toString('base64')}`;

    const app = express();
    app.use(express.json({ limit: '50mb' }));
    for (const r of ['routes/gif', 'routes/gifMake', 'routes/gifMaker', 'routes/gifCutout', 'routes/gifTransform']) app.use(R(r));
    const server = app.listen(0);
    const base = `http://127.0.0.1:${server.address().port}`;
    let newId = null;
    const cases = {
        preview: () => ['/gif/preview', { folderPath: root, frames, output: { colours: 64.4 } }],
        entryNew: () => ['/gif/entry', { folderPath: root, mode: 'new', frames, loop: 2, output: { maxEdge: 512 }, sourceItemId: 's0', sourceGroupId: 'g' }],
        entryUpdate: () => ['/gif/entry', { folderPath: root, mode: 'update', itemId: newId, frames: frames.slice(0, 2), loop: 'x', output: {} }],
        make: () => ['/gif/make', { folderPath: root, itemIds: ['s0', 's1', 's2'] }],
        maker: () => ['/gif/maker', { folderPath: root, sourcePath: url(vid), fps: 5, sizePreset: '320xauto', loop: 0, trimIn: 0.2, trimOut: 1.2 }],
        cutout: () => ['/gif-cutout/apply', { folderPath: root, frames, loop: 0, masks: frames.map(() => maskUrl), invert: false, sourceItemId: 's1' }],
        crop: () => ['/gif/crop', { folderPath: root, frames, loop: 3, output: { maxEdge: 2048, colours: 256, edgeColour: null }, x: 0, y: 0, w: 32, h: 24, sourceGroupId: 'g' }],
        resize: () => ['/gif/resize', { folderPath: root, frames, loop: 5, output: { maxEdge: 800, colours: 128, edgeColour: '#ff0000' }, width: 32, height: 24 }],
        resizeNoOutput: () => ['/gif/resize', { folderPath: root, frames, width: 32, height: 24 }],
    };
    const result = {};
    for (const [name, make] of Object.entries(cases)) {
        const [route, body] = make();
        const before = new Set(await fs.readdir(metaDir));
        const res = await fetch(base + route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const data = await res.json();
        if (name === 'entryNew') newId = data.item?.id;
        const added = (await fs.readdir(metaDir)).filter(n => !before.has(n)).sort();
        const sidecarFile = name === 'entryUpdate' ? `${newId}.json` : added.find(n => /^[0-9a-f-]{36}\.json$/.test(n));
        const sidecar = sidecarFile ? await fs.readJson(path.join(metaDir, sidecarFile)) : null;
        // Does every thumb a sidecar names exist on disk?
        const thumbOk = sidecar?.thumbPath ? await fs.pathExists(decodeURIComponent(sidecar.thumbPath.split('path=')[1])) : null;
        result[name] = { status: res.status, data, files: added.map(n => n.replace(UUID, '<id>')), sidecar, thumbOk };
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
