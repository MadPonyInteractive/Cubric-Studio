'use strict';

/**
 * services/cardView.js — one picture an agent can look at, for any card file (MPI-593).
 *
 * A still comes back as itself, at most VIEW_PX on its long edge. A video or a GIF comes back
 * as ONE contact sheet: `frames` stills spread evenly across the clip, tiled left to right,
 * top to bottom, with their times beside it as data. One image, not six, because a vision
 * model reads a grid fine and pays per image; and because the in-app describer takes exactly
 * one image, so the same sheet serves `look` there.
 *
 * Audio is not in the picture. `hasAudio` says there is some, so the agent can say it did not
 * hear it rather than imply the clip is silent.
 */

const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const sharp = require('sharp');
const { ffmpegPath } = require('./ffmpegBinary');
const { probeVideo } = require('./ffprobeVideo');

const execFileP = promisify(execFile);

const VIEW_PX = 1024;       // a still's long edge
const SHEET_CELL_PX = 512;  // one frame's width in the sheet; 3 across is 1536, near a vision model's own cap
const MOVING = new Set(['.mp4', '.webm', '.mov', '.mkv', '.m4v', '.gif']);
const STILL = new Set(['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.tif', '.tiff']);

const isViewable = (file) => MOVING.has(path.extname(file).toLowerCase()) || STILL.has(path.extname(file).toLowerCase());

/**
 * @param {string} file absolute path of an image, video or GIF
 * @param {{frames?: number}} [opts] frames in a video's sheet, 2-12, default 6
 * @returns {Promise<{kind:'image'|'video', data:Buffer, mimeType:string, width?:number, height?:number,
 *   duration?:number, times?:number[], columns?:number, hasAudio?:boolean}>}
 */
async function viewFile(file, { frames = 6 } = {}) {
    const ext = path.extname(file).toLowerCase();
    if (!MOVING.has(ext)) {
        // limitInputPixels off + rotate(): the same 16K-still and EXIF rules as the gallery thumbs.
        const img = sharp(file, { limitInputPixels: false }).rotate();
        const { width, height } = await img.metadata();
        const data = await img.resize({ width: VIEW_PX, height: VIEW_PX, fit: 'inside', withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
        return { kind: 'image', data, mimeType: 'image/webp', width, height };
    }

    const probe = await probeVideo(file);
    if (!probe) throw new Error(`could not read "${path.basename(file)}" as a video`);
    // Frames are picked by INDEX, not by time: an `fps=` sampler dropped the last tick at the
    // end of a real 1.87 s clip and left a black cell. A GIF has no duration for ffprobe at
    // all; its own header has the frame count and each frame's delay.
    let count;
    let timeOf;
    if (ext === '.gif') {
        const meta = await sharp(file, { animated: true, limitInputPixels: false }).metadata();
        count = meta.pages || 1;
        timeOf = (k) => (meta.delay || []).slice(0, k).reduce((s, d) => s + d, 0) / 1000;
        probe.duration = Number(timeOf(count).toFixed(3));
    } else {
        count = probe.frameCount || Math.round(probe.fps * probe.duration);
        timeOf = (k) => k / probe.fps;
    }
    if (!(count > 0)) throw new Error(`"${path.basename(file)}" has no frames to sample`);
    const n = Math.min(count, 12, Math.max(2, Math.round(Number(frames) || 6)));
    // The MIDDLE of each of n equal slices, so neither the first nor the last frame (often a
    // fade or a hold) takes a whole cell.
    const idx = Array.from({ length: n }, (_, i) => Math.floor(((i + 0.5) * count) / n));
    const times = idx.map((k) => Number(timeOf(k).toFixed(2)));
    const columns = n <= 4 ? 2 : n <= 9 ? 3 : 4;
    const rows = Math.ceil(n / columns);
    const { stdout } = await execFileP(ffmpegPath, [
        '-v', 'error',
        '-i', file,
        '-vf', `select='${idx.map((k) => `eq(n\\,${k})`).join('+')}',scale=${SHEET_CELL_PX}:-2,tile=${columns}x${rows}:padding=4:color=black`,
        '-frames:v', '1',
        // PNG through image2pipe, NOT `-f webp -`: the webp muxer writes its RIFF sizes by
        // seeking back, which a pipe allows only inside its 32 KB buffer, so any real sheet
        // came out with a zero-size header that nothing decodes. sharp encodes the webp.
        '-c:v', 'png', '-f', 'image2pipe', '-',
    ], { encoding: 'buffer', maxBuffer: 64 * 1024 * 1024, windowsHide: true });
    if (!stdout?.length) throw new Error(`no frames came out of "${path.basename(file)}"`);
    return {
        kind: 'video', data: await sharp(stdout).webp({ quality: 82 }).toBuffer(), mimeType: 'image/webp',
        width: probe.width, height: probe.height, duration: probe.duration,
        times, columns, hasAudio: probe.hasAudio,
    };
}

module.exports = { viewFile, isViewable };
