'use strict';

/**
 * routes/gifToVideo.js — MPI-773 (server half): POST /gif/to-video.
 *
 * Own route file per the MPI-757 plan's E3. A GIF's frame list (full-colour
 * PNGs in `services/gifFrames.js`'s content-addressed store) becomes a
 * constant-30fps h264 MP4 — built from those PNGs directly, NEVER from the
 * 256-colour `.gif` the entry also carries (docs/gif.md never treats the
 * built `.gif` as a source of truth; the frames are). Precedent:
 * `routes/videoReverse.js` for the ffmpeg-output + sidecar + derivatives
 * shape, `services/gifFrames.js`'s `buildGif()` for the "constant rate, one
 * list entry per source frame" technique that sidesteps ffmpeg's own
 * duration-drift (docs/gif.md § Build) — applied here to a real video
 * instead of a delay-patched GIF, so there is no post-hoc patch step: each
 * GIF frame is repeated in the concat list enough times to hold its OWN
 * delay at the fixed 30fps output, and `-r 30` before the concat input makes
 * every list entry exactly one 1/30s frame — no ffmpeg duration directive
 * involved (the thing proven to drift), no post-encode timestamp patch
 * needed.
 *
 * Body: {
 *   folderPath, frames: [{hash, delay}] (delay = hundredths of a second,
 *     the same GIF-native unit `services/gifFrames.js` uses; every frame
 *     MUST share one pixel size — a GIF's frames always do), background?
 *     ('#rrggbb', default black — where a transparent frame area lands,
 *     since h264/yuv420p carries no alpha), itemId?, groupId? (source
 *     item/group for caller context, echoed back — same field names
 *     `routes/videoReverse.js` already uses, since this route's OUTPUT is a
 *     video card just like that one, not a GIF card),
 * }
 * Response: { success: true, item, group } — `item` is a video sidecar
 * (type: 'video'), `group` wraps it as a single-item ItemGroup. Same shape
 * `routes/videoReverse.js` returns, so the caller builds the new card the
 * same way (`_handleCropSnapshot` / `grid.on('combine')` precedent).
 *
 * Even dimensions (forced, never rejected — h264 4:2:0 needs them): the
 * canvas is read from frame 0, and any odd edge is PADDED by exactly 1px
 * with the same background colour used for the alpha flatten, never
 * cropped — a forced dimension never costs the source a pixel of content.
 * Validation at the boundary (root-cause rule): an unknown frame hash, a
 * missing/empty frame list, or a frame whose size disagrees with frame 0's
 * all fail loudly with 400, never a silent cap or a best-effort resize.
 */

const express = require('express');
const router = express.Router();
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');
const logger = require('./logger');
const { frameAbsPath, frameExists } = require('../services/gifFrames');
const { parseFill } = require('../services/imageCrop');
const { ffmpegPath } = require('../services/ffmpegBinary');
const { probeVideo } = require('../services/ffprobeVideo');
const { writeVideoDerivatives } = require('../services/ffmpegThumb');
const { nextSequence } = require('./projects');

const execFileP = promisify(execFile);

// Fixed output rate (plan MPI-773). Each concat-list entry is exactly one
// frame at this rate — the same "constant rate, one list entry per source
// frame" principle `services/gifFrames.js`'s buildGif() proves against
// ffmpeg's own duration-directive drift (docs/gif.md § Build), applied here
// with frame REPETITION standing in for the GCE-delay patch that GIF output
// uses instead.
const OUTPUT_FPS = 30;
const DEFAULT_BACKGROUND = '#000000';

function projectFileUrl(filePath) {
    return `/project-file?path=${encodeURIComponent(filePath)}`;
}

/**
 * hundredths-of-a-second GIF delays -> whole output frames at OUTPUT_FPS, one
 * count per input frame, floor 1 so no GIF frame disappears.
 *
 * Rounding each frame's own delay independently (`round(delay/100*fps)`)
 * makes every frame's rounding error compound in the SAME direction across
 * the whole GIF: delay 7 (70ms) rounds to round(2.1)=2 frames (66.7ms, ~5%
 * short) EVERY time, so a 100-frame GIF at delay 7 plays 6.67s instead of
 * 7.0s; delay 5 (50ms) rounds to round(1.5)=2 (66.7ms, +33%) every time.
 * Neither error ever cancels because it is computed fresh per frame.
 *
 * Fix: track the RUNNING total instead. Frame i's count is
 * `round(idealCumulative_i) - actualCumulative_{i-1}`, where
 * `idealCumulative_i` is the true elapsed seconds through frame i (in output
 * frames, a float) and `actualCumulative_{i-1}` is the whole-frame count
 * ACTUALLY emitted so far (not the ideal one). Using the ACTUAL running
 * total — not the ideal one — is what carries a floor's surplus forward: if
 * a frame's delay is too short to earn even one frame on its own, the floor
 * bumps its count up to 1, `actualCumulative` absorbs that extra frame, and
 * the next frame's delta is computed against that already-inflated total, so
 * the surplus is repaid rather than compounding. This telescopes exactly to
 * `round(idealCumulative_last)` total frames whenever the floor never binds
 * (every delay here is large enough that it never does).
 */
function _repeatCounts(frames) {
    let idealCumulative = 0;
    let actualCumulative = 0;
    const counts = [];
    for (const f of frames) {
        const delayHundredths = Number(f.delay) || 10;
        idealCumulative += (delayHundredths / 100) * OUTPUT_FPS;
        const count = Math.max(1, Math.round(idealCumulative) - actualCumulative);
        counts.push(count);
        actualCumulative += count;
    }
    return counts;
}

router.post('/gif/to-video', async (req, res) => {
    let outputPath = '';
    let tmpDir = '';
    try {
        const { folderPath, frames, background, itemId, groupId } = req.body || {};
        if (!folderPath || typeof folderPath !== 'string') {
            return res.status(400).json({ success: false, error: 'folderPath required' });
        }
        if (!Array.isArray(frames) || !frames.length) {
            return res.status(400).json({ success: false, error: 'frames required (non-empty array)' });
        }

        const mediaDir = path.join(folderPath, 'Media');
        for (const f of frames) {
            if (!f?.hash || !(await frameExists(mediaDir, f.hash))) {
                return res.status(400).json({ success: false, error: `unknown frame hash: ${f?.hash}` });
            }
        }

        // Read every frame's own dimensions up front (metadata only, cheap) and
        // validate they all agree — a route boundary check, before any pixel
        // work or file write happens.
        let width = 0, height = 0;
        const dims = [];
        for (const f of frames) {
            const meta = await sharp(frameAbsPath(mediaDir, f.hash)).metadata();
            if (!width) { width = meta.width; height = meta.height; }
            if (meta.width !== width || meta.height !== height) {
                return res.status(400).json({
                    success: false,
                    error: `frame size mismatch: frame 0 is ${width}x${height}, another frame is ${meta.width}x${meta.height} — every GIF frame must share one size`,
                });
            }
            dims.push(meta);
        }
        if (!(width > 0) || !(height > 0)) {
            return res.status(400).json({ success: false, error: 'could not read frame dimensions' });
        }

        const bgRgb = parseFill(background || DEFAULT_BACKGROUND);
        const evenW = width % 2 === 0 ? width : width + 1;
        const evenH = height % 2 === 0 ? height : height + 1;
        const padRight = evenW - width;
        const padBottom = evenH - height;

        const repeatCounts = _repeatCounts(frames);

        tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gif-to-video-'));
        const listLines = [];
        for (let i = 0; i < frames.length; i++) {
            const buf = await fs.readFile(frameAbsPath(mediaDir, frames[i].hash));
            // Flatten transparency onto the background FIRST (never
            // removeAlpha() — memory/tools/sharp.md: h264/yuv420p carries no
            // alpha at all, so an untouched transparent pixel would fall to
            // whatever the encoder's own default is, not the caller's choice).
            // Pad the same operation's background onto any odd edge so the
            // forced-even border is invisible against a flat background.
            let pipeline = sharp(buf).flatten({ background: bgRgb });
            if (padRight || padBottom) {
                pipeline = pipeline.extend({ top: 0, left: 0, right: padRight, bottom: padBottom, background: bgRgb });
            }
            const flatBuf = await pipeline.png().toBuffer();
            const name = `f_${String(i).padStart(5, '0')}.png`;
            await fs.writeFile(path.join(tmpDir, name), flatBuf);

            const repeat = repeatCounts[i];
            for (let r = 0; r < repeat; r++) listLines.push(`file '${name}'`);
        }
        await fs.writeFile(path.join(tmpDir, 'list.txt'), listLines.join('\n') + '\n');

        const mediaOutDir = mediaDir;
        await fs.ensureDir(mediaOutDir);
        const finalName = await nextSequence(folderPath, mediaOutDir, 'gifToVideo', 'mp4');
        outputPath = path.join(mediaOutDir, finalName);

        await execFileP(ffmpegPath, [
            '-y', '-r', String(OUTPUT_FPS), '-f', 'concat', '-safe', '0', '-i', 'list.txt',
            '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p',
            outputPath,
        ], { cwd: tmpDir, windowsHide: true, maxBuffer: 16 * 1024 * 1024 });

        const outMeta = await probeVideo(outputPath) || {};
        const newId = uuidv4();
        const metaDir = path.join(mediaDir, '.meta');
        await fs.ensureDir(metaDir);
        const _mtime = (await fs.stat(outputPath).catch(() => null))?.mtimeMs || 0;
        const filePathUrl = `${projectFileUrl(outputPath)}&v=${Math.round(_mtime)}`;

        const sidecar = {
            id: newId,
            type: 'video',
            filePath: filePathUrl,
            operation: 'gifToVideo',
            displayName: finalName.replace(/\.[^.]+$/, ''),
            prompt: '',
            negativePrompt: '',
            seed: -1,
            modelId: null,
            createdAt: new Date().toISOString(),
            name: null,
            uploaded: false,
            pixelDimensions: { w: evenW, h: evenH },
            fps: outMeta.fps || OUTPUT_FPS,
            duration: outMeta.duration || Number((listLines.length / OUTPUT_FPS).toFixed(3)),
            frameCount: outMeta.frameCount || listLines.length,
            hasAudio: false,
            sourceItemId: itemId || null,
            sourceGroupId: groupId || null,
        };
        // Poster + 720p hover proxy (MPI-633 precedent, routes/videoReverse.js). No
        // trim-bar waveform (MPI-829) and no `wavePath` to destructure: a GIF has no audio
        // stream, which is why `hasAudio` is hard-false above, and passing it keeps this
        // route from spending an ffmpeg run to discover that.
        const { thumbPath, thumbPathLg, proxyPath } = await writeVideoDerivatives(outputPath, metaDir, newId, { sourceWidth: evenW, sourceHeight: evenH, hasAudio: false });
        if (thumbPath) sidecar.thumbPath = thumbPath;
        if (thumbPathLg) sidecar.thumbPathLg = thumbPathLg;
        if (proxyPath) sidecar.proxyPath = proxyPath;

        await fs.writeJson(path.join(metaDir, `${newId}.json`), sidecar, { spaces: 2 });

        const item = { ...sidecar };
        const group = {
            id: uuidv4(),
            type: 'video',
            operation: 'gifToVideo',
            createdAt: new Date().toISOString(),
            fps: sidecar.fps,
            duration: sidecar.duration,
            items: [item],
        };
        res.json({ success: true, item, group });
    } catch (err) {
        logger.error('project', 'gif-to-video failed', err);
        if (outputPath) { try { await fs.remove(outputPath); } catch { /* best-effort */ } }
        res.status(500).json({ success: false, error: err.message });
    } finally {
        if (tmpDir) await fs.remove(tmpDir).catch(() => {});
    }
});

module.exports = router;
