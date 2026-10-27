'use strict';

/**
 * The card an edit or tool output lands as (MPI-1302, AUDIT D3/D10): crop, reverse,
 * combine, extract, GIF-to-video, sheets, composites, paint, and every new GIF card.
 *
 * Every one of those routes wrote the same sidecar literal by hand, so a field the
 * reconciler or Reuse came to need had to be added in ten places, and a site that
 * missed it misbehaved silently. The shape lives here once; a route passes only what
 * makes its output different (`fields`), which is spread LAST so it wins.
 *
 * Generated cards (save-generation, uploads) write their own richer sidecar and do
 * not go through here.
 */

const path = require('path');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');
const { projectFileUrlBusted } = require('./projectFileUrl');
const { probeVideo } = require('./ffprobeVideo');
const { extractImageThumb, extractImageThumbs, writeVideoDerivatives, IMAGE_RENDITION_PX } = require('./ffmpegThumb');
const { buildGif, builtGifDimensions } = require('./gifFrames');

/**
 * The fields every output sidecar starts with. `filePath` is cache-busted on the
 * output's mtime, so a re-run that overwrites a reused name plays fresh bytes.
 * @param {{ id: string, type: 'image'|'video', outputPath: string, operation: string }} o
 */
function outputSidecar({ id, type, outputPath, operation }) {
    return {
        id,
        type,
        filePath: projectFileUrlBusted(outputPath),
        operation,
        displayName: path.basename(outputPath).replace(/\.[^.]+$/, ''),
        prompt: '',
        negativePrompt: '',
        seed: -1,
        modelId: null,
        createdAt: new Date().toISOString(),
        name: null,
        uploaded: false,
    };
}

/**
 * Write an image's gallery renditions and stamp the sidecar (MPI-319 + MPI-633).
 *
 * Five routes had grown the same three lines around `extractImageThumb`; the second
 * rendition would have made that five copies of six. `sourceWidth` is the clamp the
 * ladder needs: a "1280" rendition of an image that is already 1280 or narrower is
 * the ORIGINAL, so it is never written and the card mounts `filePath` for that tier.
 * Unknown width (0/undefined) writes it — ffmpeg's `min(w,iw)` can only ever
 * downscale, so the worst case is a same-size WebP, never an upscaled derivative.
 *
 * Uses the path each call RETURNS, never the one it was passed (MPI-627).
 */
async function writeImageRenditions(inputPath, metaDir, id, metaContent, sourceWidth) {
    const base = path.join(metaDir, `${id}.thumb.jpg`);
    const withLarge = !(sourceWidth > 0) || sourceWidth > IMAGE_RENDITION_PX.large;
    const [small, large] = await extractImageThumbs(inputPath, base,
        withLarge ? [IMAGE_RENDITION_PX.small, IMAGE_RENDITION_PX.large] : [IMAGE_RENDITION_PX.small]);
    if (small) metaContent.thumbPath = `/project-file?path=${encodeURIComponent(small)}`;
    if (large) metaContent.thumbPathLg = `/project-file?path=${encodeURIComponent(large)}`;
    return metaContent;
}

/**
 * Write a still's sidecar (+ renditions) to `.meta/<id>.json` and return it.
 * `renditions: false` is crop-media, which has never written them.
 * @param {{ outputPath: string, metaDir: string, id: string, operation: string,
 *           width: number, height: number, fields?: object, renditions?: boolean }} o
 */
async function writeImageCard({ outputPath, metaDir, id, operation, width, height, fields = {}, renditions = true }) {
    const sidecar = {
        ...outputSidecar({ id, type: 'image', outputPath, operation }),
        flowId: null,   // Flow provenance parity (MPI-256): a tool output is never a Flow gen
        flowInputs: null,
        pixelDimensions: { w: width, h: height },
        generationMs: null,
        ...fields,
    };
    if (renditions) await writeImageRenditions(outputPath, metaDir, id, sidecar, width);
    await fs.writeJson(path.join(metaDir, `${id}.json`), sidecar, { spaces: 2 });
    return sidecar;
}

/**
 * A GIF card's one thumb (the small tier only: a GIF is at most a few hundred px a side
 * in the grid). The URL of the file `extractImageThumb` RETURNS, or null when none was
 * written — never a recomputed path that may not exist (MPI-627).
 */
async function writeGifThumb(gifPath, metaDir, id) {
    const thumb = await extractImageThumb(gifPath, path.join(metaDir, `${id}.thumb.jpg`), { width: IMAGE_RENDITION_PX.small });
    return thumb ? `/project-file?path=${encodeURIComponent(thumb)}` : null;
}

/**
 * Build `gifEntry` into `outputPath` (the caller picks the sequenced name, and removes
 * it if this throws), write the card's sidecar + thumb, and return `{ item, group }`.
 * `pixelDimensions` is measured off the built file (MPI-844): `buildGif` caps the
 * frames at `maxEdge`, so the frame canvas is not the GIF's size.
 * @param {{ outputPath: string, mediaDir: string, metaDir: string, gifEntry: object,
 *           operation: string, fields?: object }} o
 */
async function writeGifCard({ outputPath, mediaDir, metaDir, gifEntry, operation, fields = {} }) {
    await buildGif(gifEntry, mediaDir, outputPath);
    const id = uuidv4();
    const sidecar = {
        ...outputSidecar({ id, type: 'image', outputPath, operation }),
        pixelDimensions: await builtGifDimensions(outputPath),
        generationMs: null,
        gif: gifEntry,
        ...fields,
    };
    const thumbPath = await writeGifThumb(outputPath, metaDir, id);
    if (thumbPath) sidecar.thumbPath = thumbPath;
    await fs.writeJson(path.join(metaDir, `${id}.json`), sidecar, { spaces: 2 });

    const item = { ...sidecar };
    const group = {
        id: uuidv4(),
        type: 'image',
        operation,
        createdAt: new Date().toISOString(),
        items: [item],
    };
    return { item, group };
}

/**
 * Probe a finished video, write its sidecar + poster, 720p hover proxy and trim-bar
 * waveform (MPI-633, MPI-829), and return the `{ item, group }` the renderer's
 * `addGroup()` takes.
 *
 * Timing comes from the probe; `fallback` covers a probe that came back short.
 * Size defaults to the probe's too; a route that knows better passes
 * `fields.pixelDimensions`, and `derivativeSize` when the derivatives should be sized
 * from something other than the probe. `fields.hasAudio: false` also skips the wave.
 * @param {{ outputPath: string, metaDir: string, operation: string,
 *           fallback?: { fps?: number, duration?: number, frameCount?: number },
 *           fields?: object, derivativeSize?: { w: number, h: number } }} o
 */
async function writeVideoCard({ outputPath, metaDir, operation, fallback = {}, fields = {}, derivativeSize }) {
    const outMeta = await probeVideo(outputPath) || {};
    const id = uuidv4();
    await fs.ensureDir(metaDir);
    const sidecar = {
        ...outputSidecar({ id, type: 'video', outputPath, operation }),
        pixelDimensions: { w: outMeta.width || 0, h: outMeta.height || 0 },
        fps: outMeta.fps || fallback.fps || 0,
        duration: outMeta.duration || fallback.duration || 0,
        frameCount: outMeta.frameCount || fallback.frameCount || 0,
        hasAudio: !!outMeta.hasAudio,
        ...fields,
    };
    const size = derivativeSize || { w: outMeta.width, h: outMeta.height };
    const derivatives = await writeVideoDerivatives(outputPath, metaDir, id, {
        sourceWidth: size.w, sourceHeight: size.h, hasAudio: sidecar.hasAudio,
    });
    for (const [key, value] of Object.entries(derivatives)) {
        if (value) sidecar[key] = value;
    }
    await fs.writeJson(path.join(metaDir, `${id}.json`), sidecar, { spaces: 2 });

    const item = { ...sidecar };
    const group = {
        id: uuidv4(),
        type: 'video',
        operation,
        createdAt: new Date().toISOString(),
        fps: sidecar.fps,
        duration: sidecar.duration,
        items: [item],
    };
    return { item, group };
}

module.exports = { outputSidecar, writeImageRenditions, writeImageCard, writeGifThumb, writeGifCard, writeVideoCard };
