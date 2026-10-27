'use strict';

/**
 * routes/videoReverse.js — POST /api/video/reverse
 *
 * Body: {
 *   folderPath:  string  (project folder path),
 *   sourcePath:  string  (absolute file path OR /project-file?path=... URL),
 *   outFileName: string  (optional, default "videoReverse_NNN.mp4"),
 *   groupId:     string  (optional — for caller context, echoed back),
 *   itemId:      string  (optional — source item id, echoed back),
 *   trimIn:      number  (optional — slice source starting at this offset, seconds),
 *   trimOut:     number  (optional — slice source ending at this offset, seconds),
 *   mode:        string  (optional — 'both' (default) | 'video' | 'audio')
 * }
 *
 * mode 'both'  → -vf reverse + -af areverse (both streams re-encoded).
 * mode 'video' → -vf reverse, audio copied forward (or -an if none).
 * mode 'audio' → -af areverse, video copied forward (re-encoded only under trim).
 * Spawns ffmpeg with -vf reverse (and -af areverse when source has audio).
 * Writes output to project Media/, writes .meta/<uuid>.json sidecar with probe data,
 * returns { success, item, group } shaped for projectService.addGroup().
 */

const express = require('express');
const router  = express.Router();
const fs      = require('fs-extra');
const path    = require('path');
const { diskPathOf } = require('../services/projectFileUrl');
const logger = require('./logger');
const { ffmpegPath, runFfmpeg } = require('../services/ffmpegBinary');
const { probeVideo } = require('../services/ffprobeVideo');
const { writeVideoCard } = require('../services/outputCard');
const { nextSequence } = require('./projects');


router.post('/api/video/reverse', async (req, res) => {
    let outputPath = '';
    try {
        const { folderPath, sourcePath, outFileName, groupId, itemId, trimIn, trimOut } = req.body || {};
        if (!folderPath || !sourcePath) {
            return res.status(400).json({ success: false, error: 'folderPath, sourcePath required' });
        }
        // 'both' (video+audio, default/back-compat) | 'video' (video only) | 'audio' (audio only)
        const mode = ['both', 'video', 'audio'].includes(req.body?.mode) ? req.body.mode : 'both';

        const inputPath = diskPathOf(sourcePath) || '';
        if (!(await fs.pathExists(inputPath))) {
            return res.status(404).json({ success: false, error: 'source file not found: ' + inputPath });
        }

        const srcMeta = await probeVideo(inputPath);
        if (!srcMeta || !srcMeta.width || !srcMeta.height) {
            return res.status(500).json({ success: false, error: 'could not probe source dimensions' });
        }
        if (mode === 'audio' && !srcMeta.hasAudio) {
            return res.status(400).json({ success: false, error: 'source has no audio to reverse' });
        }

        const mediaDir = path.join(folderPath, 'Media');
        await fs.ensureDir(mediaDir);

        let finalName;
        if (outFileName && /\.(mp4|mov|webm)$/i.test(outFileName)) {
            finalName = outFileName;
        } else {
            finalName = await nextSequence(folderPath, mediaDir, 'videoReverse', 'mp4');
        }
        outputPath = path.join(mediaDir, finalName);

        const tIn  = Number(trimIn);
        const tOut = Number(trimOut);
        const hasTrim = Number.isFinite(tIn) && Number.isFinite(tOut) && tOut > tIn;

        // Trim BEFORE -i for fast input-seek; `reverse`/`areverse` buffer the
        // whole stream so trimming first keeps memory bounded on long clips.
        const args = ['-y'];
        if (hasTrim) args.push('-ss', String(tIn), '-to', String(tOut));
        args.push('-i', inputPath);

        const reverseVideo = mode === 'both' || mode === 'video';
        const reverseAudio = (mode === 'both' || mode === 'audio') && srcMeta.hasAudio;

        // Video branch: reverse (re-encode) or passthrough. A copied stream under
        // input-seek trim can start off-keyframe → re-encode instead of copy.
        if (reverseVideo) {
            args.push('-vf', 'reverse', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p');
        } else if (hasTrim) {
            args.push('-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p');
        } else {
            args.push('-c:v', 'copy');
        }

        // Audio branch: reverse (re-encode), passthrough copy, or drop.
        // ponytail: audio copy under trim can land off-frame; upgrade to re-encode if users report clicks.
        if (reverseAudio) {
            args.push('-af', 'areverse', '-c:a', 'aac', '-b:a', '192k');
        } else if (srcMeta.hasAudio) {
            args.push('-c:a', 'copy');
        } else {
            args.push('-an');
        }
        args.push(outputPath);

        logger.info('project', `video-reverse (mode=${mode}) ffmpeg: ${ffmpegPath} ${args.join(' ')}`);
        await runFfmpeg(args, { maxBuffer: 8 * 1024 * 1024 });

        // The waveform is baked from the REVERSED output, so it reads in the direction it plays.
        const { item, group } = await writeVideoCard({
            outputPath,
            metaDir: path.join(mediaDir, '.meta'),
            operation: 'reverse',
            fallback: { fps: srcMeta.fps },
            fields: {
                pixelDimensions: { w: srcMeta.width, h: srcMeta.height },
                sourceItemId: itemId  || null,
                sourceGroupId: groupId || null,
            },
        });

        res.json({ success: true, item, group });
    } catch (err) {
        logger.error('project', 'video-reverse failed', err);
        if (outputPath) { try { await fs.remove(outputPath); } catch {} }
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
