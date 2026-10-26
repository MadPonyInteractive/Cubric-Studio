'use strict';

/**
 * routes/videoExtract.js — MPI-1073: the video workspace's mask + Extract, non-GPU side.
 *
 * The SAM3 video track runs in the RENDERER through `runGifCutoutTrack()`
 * (js/services/commandExecutor.js), unchanged from the GIF cut-out: its graph loads
 * EVERY frame of `Input_Video` (`force_rate: 0`) and returns ONE mask PNG per frame,
 * in order. This route builds that input and applies what comes back.
 *
 * POST /video-extract/source
 * Body: { folderPath, sourcePath, trimIn?, trimOut? }
 * -> { success, videoPath, frameCount, fps, width, height }
 * The trimmed range, DOWNSCALED to a long edge of <= 1024 (never up), H.264, no audio,
 * under `Media/.video-extract-tmp/` (self-swept like `.gif-cutout-tmp`). Why downscale:
 * the loader holds every frame as float32 — a 1080p x 121 clip is ~3 GB, a 10 s 4K one
 * ~24 GB — and SAM3 works at ~1008 px anyway. `-fps_mode passthrough` keeps it ONE
 * output frame per decoded frame, so mask i belongs to frame i of the same trim.
 *
 * POST /video-extract/apply
 * Body: { folderPath, sourcePath, trimIn?, trimOut?, masks: [dataUrl|http URL],
 *         background: '#rrggbb' | null, itemId?, groupId? }
 * -> { success, item, group } (the `routes/videoReverse.js` shape)
 * The FULL-RES trimmed source, each mask scaled up to it, paired by frame INDEX
 * (`setpts=N` on both sides — timestamps of two different time bases can round a mask
 * onto its neighbour). A mask is white = what STAYS (SAM3's own polarity).
 * - `background: null` -> WebM VP9 `yuva420p` + Opus. The RGB outside the mask is
 *   zeroed first: every alpha-blind decoder (ffmpeg's native vp9 for the poster, the
 *   H.264 hover proxy) would otherwise show the ORIGINAL frame, background and all.
 *   Zeroed by a HARD mask (any coverage keeps its RGB), so a soft edge keeps its real
 *   colour and does not pick up a dark fringe.
 * - `background: '#rrggbb'` -> composited onto that colour, MP4 H.264 + AAC.
 * The source's own alpha is the ceiling (min with the mask), so extracting a transparent
 * WebM again keeps the first cut — decoded by libvpx, since ffmpeg's native vp9 drops alpha.
 * Source audio is kept, trimmed by the same input seek.
 */

const express = require('express');
const router  = express.Router();
const fs      = require('fs-extra');
const path    = require('path');
const { diskPathOf } = require('../services/projectFileUrl');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { v4: uuidv4 } = require('uuid');
const logger = require('./logger');
const { ffmpegPath } = require('../services/ffmpegBinary');
const { probeVideo } = require('../services/ffprobeVideo');
const { writeVideoCard } = require('../services/outputCard');
const { nextSequence } = require('./projects');
const { resolveMaskBufferInput } = require('./gifCutout');

const execFileP = promisify(execFile);

const TEMP_DIRNAME = '.video-extract-tmp';
const TEMP_MAX_AGE_MS = 60 * 60 * 1000;
const TRACK_MAX_EDGE = 1024;


/** The same input seek on both routes, so the tracker and the cut see the same frames. */
function _trimArgs(trimIn, trimOut) {
    const tIn = Number(trimIn);
    const tOut = Number(trimOut);
    return Number.isFinite(tIn) && Number.isFinite(tOut) && tOut > tIn
        ? ['-ss', String(tIn), '-to', String(tOut)]
        : [];
}

async function _sweep(dir) {
    if (!(await fs.pathExists(dir))) return;
    const now = Date.now();
    for (const name of await fs.readdir(dir)) {
        const abs = path.join(dir, name);
        try {
            if (now - (await fs.stat(abs)).mtimeMs > TEMP_MAX_AGE_MS) await fs.remove(abs);
        } catch { /* best-effort GC */ }
    }
}

/**
 * Encode the tracker's source: trimmed, long edge <= TRACK_MAX_EDGE, one frame per frame.
 * @returns {Promise<{ videoPath: string, frameCount: number, width: number, height: number }>}
 */
async function encodeTrackSource({ inputPath, trimIn, trimOut, outPath }) {
    const m = TRACK_MAX_EDGE;
    const args = ['-y', ..._trimArgs(trimIn, trimOut), '-i', inputPath,
        '-map', '0:v:0', '-an', '-fps_mode', 'passthrough',
        '-vf', `scale=w='min(${m},iw)':h='min(${m},ih)':force_original_aspect_ratio=decrease:force_divisible_by=2`,
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '14', '-pix_fmt', 'yuv420p', outPath];
    await execFileP(ffmpegPath, args, { maxBuffer: 8 * 1024 * 1024, windowsHide: true });
    const meta = await probeVideo(outPath) || {};
    return { videoPath: outPath, frameCount: meta.frameCount || 0, width: meta.width || 0, height: meta.height || 0 };
}

/**
 * Cut `inputPath`'s trimmed range through a mask sequence (`maskDir/m_%05d.png`).
 * @param {{ inputPath: string, trimIn?: number, trimOut?: number, maskDir: string,
 *           width: number, height: number, fps: string, hasAudio: boolean,
 *           background: string|null, outPath: string, codec?: string }} o  `fps` is ffprobe's
 *   `r_frame_rate` (`num/den`) — the output's rate.
 */
async function extractThroughMaskSequence(o) {
    const { width: W, height: H, background } = o;
    const [num, den] = String(o.fps || '24/1').split('/').map(Number);
    const outPts = `setpts=N*${den || 1}/${num || 24}/TB`;
    // Index pairing: both streams onto one time base, PTS = frame number.
    const idx = 'settb=1/1000,setpts=N';
    // The source's own alpha is the ceiling (`darken` = min), as in the GIF cut-out: an
    // earlier transparent Extract stays cut. An opaque source gets alpha 255 from
    // `format=yuva420p`, so the min is just the mask.
    const head = [
        `[0:v]${idx},format=yuva420p,split[vs][va]`,
        '[va]alphaextract[sa]',
        `[1:v]${idx},format=gray,scale=${W}:${H}:flags=bicubic[mm]`,
        '[sa][mm]blend=all_mode=darken',
    ];
    let graph;
    if (background) {
        const hex = background.replace('#', '0x');
        graph = [
            ...head.slice(0, 3), `${head[3]}[m]`,
            '[vs]split[v1][v2]',
            `[v2]drawbox=x=0:y=0:w=iw:h=ih:color=${hex}@1:t=fill[bg]`,
            '[v1][m]alphamerge[fg]',
            `[bg][fg]overlay=format=auto,format=yuv420p,${outPts}[out]`,
        ].join(';');
    } else {
        graph = [
            ...head.slice(0, 3), `${head[3]},split[ma][mb]`,
            '[vs]format=gbrp[v]',
            "[mb]lut=c0='if(gt(val,0),255,0)',format=gbrp[hard]",
            '[v][hard]blend=all_mode=multiply[vk]',
            `[vk][ma]alphamerge,format=yuva420p,${outPts}[out]`,
        ].join(';');
    }
    // ffmpeg's native vp9 decoder DROPS alpha; libvpx keeps it.
    const decoder = o.codec === 'vp9' ? ['-c:v', 'libvpx-vp9'] : [];
    const args = ['-y', ..._trimArgs(o.trimIn, o.trimOut), ...decoder, '-i', o.inputPath,
        '-framerate', String(o.fps || '24'), '-i', path.join(o.maskDir, 'm_%05d.png'),
        '-filter_complex', graph, '-map', '[out]'];
    if (o.hasAudio) args.push('-map', '0:a:0?');
    if (background) {
        args.push('-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p');
        if (o.hasAudio) args.push('-c:a', 'aac', '-b:a', '192k');
    } else {
        args.push('-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-crf', '30', '-b:v', '0',
            '-row-mt', '1', '-deadline', 'good', '-cpu-used', '4');
        if (o.hasAudio) args.push('-c:a', 'libopus', '-b:a', '160k');
    }
    args.push(o.outPath);
    logger.info('project', `video-extract ffmpeg: ${args.join(' ')}`);
    await execFileP(ffmpegPath, args, { maxBuffer: 8 * 1024 * 1024, windowsHide: true });
}

router.post('/video-extract/source', async (req, res) => {
    try {
        const { folderPath, sourcePath, trimIn, trimOut } = req.body || {};
        if (!folderPath || !sourcePath) {
            return res.status(400).json({ success: false, error: 'folderPath, sourcePath required' });
        }
        const inputPath = diskPathOf(sourcePath) || '';
        if (!(await fs.pathExists(inputPath))) {
            return res.status(404).json({ success: false, error: 'source file not found: ' + inputPath });
        }
        const srcMeta = await probeVideo(inputPath);
        if (!srcMeta?.width) return res.status(500).json({ success: false, error: 'could not probe source' });

        const outDir = path.join(folderPath, 'Media', TEMP_DIRNAME);
        await fs.ensureDir(outDir);
        await _sweep(outDir);
        const out = await encodeTrackSource({
            inputPath, trimIn, trimOut, outPath: path.join(outDir, `track_${uuidv4()}.mp4`),
        });
        res.json({ success: true, ...out, fps: srcMeta.fps });
    } catch (err) {
        logger.error('project', 'video-extract source failed', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

router.post('/video-extract/apply', async (req, res) => {
    let outputPath = '';
    let maskDir = '';
    try {
        const { folderPath, sourcePath, trimIn, trimOut, masks, itemId, groupId } = req.body || {};
        const background = /^#[0-9a-f]{6}$/i.test(req.body?.background || '') ? req.body.background : null;
        if (!folderPath || !sourcePath) {
            return res.status(400).json({ success: false, error: 'folderPath, sourcePath required' });
        }
        if (!Array.isArray(masks) || !masks.length) {
            return res.status(400).json({ success: false, error: 'masks required (non-empty array)' });
        }
        const inputPath = diskPathOf(sourcePath) || '';
        if (!(await fs.pathExists(inputPath))) {
            return res.status(404).json({ success: false, error: 'source file not found: ' + inputPath });
        }
        const srcMeta = await probeVideo(inputPath);
        if (!srcMeta?.width || !srcMeta?.height) {
            return res.status(500).json({ success: false, error: 'could not probe source dimensions' });
        }

        const mediaDir = path.join(folderPath, 'Media');
        maskDir = path.join(mediaDir, TEMP_DIRNAME, `masks_${uuidv4()}`);
        await fs.ensureDir(maskDir);
        for (let i = 0; i < masks.length; i++) {
            const buf = await resolveMaskBufferInput(masks[i]);
            await fs.writeFile(path.join(maskDir, `m_${String(i).padStart(5, '0')}.png`), buf);
        }

        const ext = background ? 'mp4' : 'webm';
        const finalName = await nextSequence(folderPath, mediaDir, 'videoExtract', ext);
        outputPath = path.join(mediaDir, finalName);
        await extractThroughMaskSequence({
            inputPath, trimIn, trimOut, maskDir,
            width: srcMeta.width, height: srcMeta.height,
            fps: srcMeta.rFrameRate || String(srcMeta.fps || 24),
            hasAudio: !!srcMeta.hasAudio, background, outPath: outputPath, codec: srcMeta.codecName,
        });
        await fs.remove(maskDir);
        maskDir = '';

        const { item, group } = await writeVideoCard({
            outputPath,
            metaDir: path.join(mediaDir, '.meta'),
            operation: 'extract',
            fallback: { fps: srcMeta.fps },
            fields: {
                pixelDimensions: { w: srcMeta.width, h: srcMeta.height },
                extract:    { background },
                sourceItemId: itemId  || null,
                sourceGroupId: groupId || null,
            },
            derivativeSize: { w: srcMeta.width, h: srcMeta.height },
        });
        res.json({ success: true, item, group });
    } catch (err) {
        logger.error('project', 'video-extract apply failed', err);
        if (outputPath) { try { await fs.remove(outputPath); } catch {} }
        res.status(500).json({ success: false, error: err.message });
    } finally {
        if (maskDir) { try { await fs.remove(maskDir); } catch {} }
    }
});

/**
 * ProRes 4444 with alpha, for an editor (DaVinci reads it; VP9 alpha it may not).
 * Never a card: it lands in the temp dir and the renderer saves it out.
 */
async function encodeProres({ inputPath, trimIn, trimOut, codec, hasAudio, outPath }) {
    const decoder = codec === 'vp9' ? ['-c:v', 'libvpx-vp9'] : [];
    const args = ['-y', ..._trimArgs(trimIn, trimOut), ...decoder, '-i', inputPath,
        '-map', '0:v:0', '-c:v', 'prores_ks', '-profile:v', '4444', '-pix_fmt', 'yuva444p10le',
        '-vendor', 'apl0'];
    if (hasAudio) args.push('-map', '0:a:0?', '-c:a', 'pcm_s16le');
    args.push(outPath);
    await execFileP(ffmpegPath, args, { maxBuffer: 8 * 1024 * 1024, windowsHide: true });
}

router.post('/video-extract/prores', async (req, res) => {
    try {
        const { folderPath, sourcePath, trimIn, trimOut } = req.body || {};
        if (!folderPath || !sourcePath) {
            return res.status(400).json({ success: false, error: 'folderPath, sourcePath required' });
        }
        const inputPath = diskPathOf(sourcePath) || '';
        if (!(await fs.pathExists(inputPath))) {
            return res.status(404).json({ success: false, error: 'source file not found: ' + inputPath });
        }
        const srcMeta = await probeVideo(inputPath) || {};
        const outDir = path.join(folderPath, 'Media', TEMP_DIRNAME);
        await fs.ensureDir(outDir);
        await _sweep(outDir);
        const fileName = `${path.parse(inputPath).name}_prores4444.mov`;
        const outPath = path.join(outDir, `${uuidv4()}_${fileName}`);
        await encodeProres({
            inputPath, trimIn, trimOut, codec: srcMeta.codecName, hasAudio: !!srcMeta.hasAudio, outPath,
        });
        res.json({ success: true, path: outPath, fileName });
    } catch (err) {
        logger.error('project', 'video-extract prores failed', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
module.exports.encodeProres = encodeProres;
module.exports.encodeTrackSource = encodeTrackSource;
module.exports.extractThroughMaskSequence = extractThroughMaskSequence;
