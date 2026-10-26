'use strict';

/**
 * routes/videoCrop.js — POST /api/video/crop
 *
 * Body: {
 *   folderPath:  string  (project folder path),
 *   sourcePath:  string  (absolute file path OR /project-file?path=... URL),
 *   cropRect:    { x, y, width, height } — normalized 0..1 relative to source frame,
 *   absoluteCropPx: { x, y, w, h } — optional, absolute pixel rect already rounded
 *                   by the caller (MPI-261 divisible-by). When present it is used
 *                   directly and the normalized→even-snap path is skipped (the
 *                   caller's multiples of 16 are already even for libx264).
 *   outFileName: string  (optional, default "videoCrop_NNN.mp4"),
 *   groupId:     string  (optional — for caller context, echoed back),
 *   itemId:      string  (optional — source item id, echoed back),
 *   trimIn:      number  (optional — slice source starting at this offset, seconds),
 *   trimOut:     number  (optional — slice source ending at this offset, seconds)
 * }
 *
 * Spawns ffmpeg with -vf crop and h264+aac encode (audio copied if present).
 * Writes output to project Media/, writes .meta/<uuid>.json sidecar with probe data,
 * returns { success, item, group } shaped for projectService.addGroup().
 */

const express = require('express');
const router  = express.Router();
const fs      = require('fs-extra');
const path    = require('path');
const { diskPathOf } = require('../services/projectFileUrl');
const { execFile } = require('child_process');
const { promisify } = require('util');
const logger = require('./logger');
const { ffmpegPath } = require('../services/ffmpegBinary');
const { probeVideo } = require('../services/ffprobeVideo');
const { writeVideoCard } = require('../services/outputCard');
const { nextSequence } = require('./projects');

// windowsHide on EVERY execFileP call below: the forked server.js owns no console,
// so a console-subsystem ffmpeg/ffprobe gets its own conhost - a terminal that flashes
// open on the user's desktop. /backfill-media-derivatives fires one per missing
// rendition, so a project open popped ~20 of them (MPI-651, the tail of MPI-637).
const execFileP = promisify(execFile);


router.post('/api/video/crop', async (req, res) => {
    let outputPath = '';
    try {
        const { folderPath, sourcePath, cropRect, absoluteCropPx, outFileName, groupId, itemId, trimIn, trimOut } = req.body || {};
        if (!folderPath || !sourcePath || !cropRect) {
            return res.status(400).json({ success: false, error: 'folderPath, sourcePath, cropRect required' });
        }
        const { x, y, width, height } = cropRect;
        if (![x, y, width, height].every(n => Number.isFinite(n))) {
            return res.status(400).json({ success: false, error: 'cropRect must be { x, y, width, height } numbers' });
        }

        const inputPath = diskPathOf(sourcePath) || '';
        if (!(await fs.pathExists(inputPath))) {
            return res.status(404).json({ success: false, error: 'source file not found: ' + inputPath });
        }

        // 1. Probe source for dimensions + audio presence
        const srcMeta = await probeVideo(inputPath);
        if (!srcMeta || !srcMeta.width || !srcMeta.height) {
            return res.status(500).json({ success: false, error: 'could not probe source dimensions' });
        }

        // 2. Determine the pixel crop rect. If the caller supplied an
        // already-rounded absolute rect (MPI-261 divisible-by), use it directly
        // and clamp to the source — its multiples of 16 are already even, so no
        // snapEven. Otherwise map the normalized rect and snap to even (libx264).
        let cropW, cropH, cropX, cropY;
        const absOk = absoluteCropPx
            && [absoluteCropPx.x, absoluteCropPx.y, absoluteCropPx.w, absoluteCropPx.h].every(n => Number.isFinite(n));
        if (absOk) {
            cropX = Math.max(0, Math.min(Math.floor(absoluteCropPx.x), srcMeta.width  - 2));
            cropY = Math.max(0, Math.min(Math.floor(absoluteCropPx.y), srcMeta.height - 2));
            cropW = Math.max(2, Math.min(Math.floor(absoluteCropPx.w), srcMeta.width  - cropX));
            cropH = Math.max(2, Math.min(Math.floor(absoluteCropPx.h), srcMeta.height - cropY));
        } else {
            const snapEven = n => Math.max(2, Math.floor(n / 2) * 2);
            cropW = snapEven(width  * srcMeta.width);
            cropH = snapEven(height * srcMeta.height);
            cropX = Math.max(0, Math.floor(x * srcMeta.width));
            cropY = Math.max(0, Math.floor(y * srcMeta.height));
        }

        // 3. Prepare output path — sequenced "videoCrop_NNN.mp4" like image crop
        const mediaDir = path.join(folderPath, 'Media');
        await fs.ensureDir(mediaDir);

        let finalName;
        if (outFileName && /\.(mp4|mov|webm)$/i.test(outFileName)) {
            finalName = outFileName;
        } else {
            finalName = await nextSequence(folderPath, mediaDir, 'videoCrop', 'mp4');
        }
        outputPath = path.join(mediaDir, finalName);

        // 4. Run ffmpeg. Apply optional temporal trim via input-seek
        // (`-ss <in> -to <out>` before `-i`) — fast + keyframe-accurate; the
        // re-encode below produces clean GOPs regardless.
        const tIn  = Number(trimIn);
        const tOut = Number(trimOut);
        const hasTrim = Number.isFinite(tIn) && Number.isFinite(tOut) && tOut > tIn;

        const args = ['-y'];
        if (hasTrim) args.push('-ss', String(tIn), '-to', String(tOut));
        args.push(
            '-i', inputPath,
            '-vf', `crop=${cropW}:${cropH}:${cropX}:${cropY}`,
            '-c:v', 'libx264',
            '-preset', 'medium',
            '-crf', '18',
            '-pix_fmt', 'yuv420p',
        );
        if (srcMeta.hasAudio) args.push('-c:a', 'aac', '-b:a', '192k');
        else                  args.push('-an');
        args.push(outputPath);

        logger.info('project', `video-crop ffmpeg: ${ffmpegPath} ${args.join(' ')}`);
        await execFileP(ffmpegPath, args, { maxBuffer: 8 * 1024 * 1024, windowsHide: true });

        // 5. Write .meta/<uuid>.json sidecar + derivatives; item + group for addGroup()
        const { item, group } = await writeVideoCard({
            outputPath,
            metaDir: path.join(mediaDir, '.meta'),
            operation: 'crop',
            fallback: { fps: srcMeta.fps },
            fields: {
                pixelDimensions: { w: cropW, h: cropH },
                cropRect:   { x, y, w: width, h: height },
                sourceItemId: itemId  || null,
                sourceGroupId: groupId || null,
            },
        });

        res.json({ success: true, item, group });
    } catch (err) {
        logger.error('project', 'video-crop failed', err);
        // Cleanup partial file
        if (outputPath) { try { await fs.remove(outputPath); } catch {} }
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
