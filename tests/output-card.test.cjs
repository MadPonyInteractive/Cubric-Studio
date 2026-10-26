'use strict';

/**
 * MPI-1302 (AUDIT D3) — the one card writer behind every edit/tool output route.
 * Real files, real ffmpeg: the sidecar on disk is what the reconciler and Reuse read.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('fs-extra');
const sharp = require('sharp');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { scratchDir } = require('./helpers/scratch.cjs');
const { ffmpegPath } = require('../services/ffmpegBinary');
const { writeImageCard, writeVideoCard } = require('../services/outputCard');

const BASE_KEYS = ['id', 'type', 'filePath', 'operation', 'displayName', 'prompt', 'negativePrompt',
    'seed', 'modelId', 'createdAt', 'name', 'uploaded'];

test('writeImageCard writes the shared shape, the route fields and both renditions', async () => {
    const dir = await scratchDir('output-card-image-');
    const metaDir = path.join(dir, '.meta');
    await fs.ensureDir(metaDir);
    const outputPath = path.join(dir, 'composite_001.png');
    await sharp({ create: { width: 1600, height: 900, channels: 3, background: '#808080' } }).png().toFile(outputPath);

    const card = await writeImageCard({
        outputPath, metaDir, id: 'img-1', operation: 'composite', width: 1600, height: 900,
        fields: { sourceFile: 'base.png' },
    });
    const onDisk = await fs.readJson(path.join(metaDir, 'img-1.json'));
    assert.deepEqual(onDisk, card);
    for (const k of BASE_KEYS) assert.ok(k in onDisk, `missing ${k}`);
    assert.equal(onDisk.displayName, 'composite_001');
    assert.equal(onDisk.seed, -1);
    assert.equal(onDisk.flowId, null);
    assert.deepEqual(onDisk.pixelDimensions, { w: 1600, h: 900 });
    assert.equal(onDisk.sourceFile, 'base.png');
    assert.match(onDisk.filePath, /composite_001\.png&v=\d+$/);
    assert.ok(onDisk.thumbPath && onDisk.thumbPathLg, 'a 1600-wide still gets both tiers');

    const bare = await writeImageCard({ outputPath, metaDir, id: 'img-2', operation: 'crop', width: 1600, height: 900, renditions: false });
    assert.equal(bare.thumbPath, undefined);
});

test('writeVideoCard probes the output, lets route fields win, and returns item + group', async () => {
    const dir = await scratchDir('output-card-video-');
    const metaDir = path.join(dir, '.meta');
    const outputPath = path.join(dir, 'videoCrop_001.mp4');
    await promisify(execFile)(ffmpegPath, ['-y', '-f', 'lavfi', '-i', 'testsrc=size=64x48:rate=10:duration=1',
        '-c:v', 'libx264', '-pix_fmt', 'yuv420p', outputPath], { windowsHide: true });

    const { item, group } = await writeVideoCard({
        outputPath, metaDir, operation: 'crop', fallback: { fps: 99 },
        fields: { pixelDimensions: { w: 32, h: 24 }, sourceItemId: 'src' },
    });
    const onDisk = await fs.readJson(path.join(metaDir, `${item.id}.json`));
    assert.deepEqual(onDisk, item);
    for (const k of BASE_KEYS) assert.ok(k in onDisk, `missing ${k}`);
    assert.equal(onDisk.type, 'video');
    assert.equal(onDisk.fps, 10, 'the probe wins over the fallback');
    assert.equal(onDisk.frameCount, 10);
    assert.equal(onDisk.hasAudio, false);
    assert.deepEqual(onDisk.pixelDimensions, { w: 32, h: 24 }, 'route fields win over the probe');
    assert.equal(onDisk.sourceItemId, 'src');
    assert.ok(onDisk.thumbPath, 'poster written');
    assert.equal(onDisk.wavePath, undefined, 'a silent clip gets no waveform');
    assert.equal(group.operation, 'crop');
    assert.equal(group.fps, 10);
    assert.deepEqual(group.items, [item]);
    assert.notEqual(group.id, item.id);
});
