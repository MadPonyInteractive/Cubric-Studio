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
 *
 * MPI-1168 — MCP `view_card` asks for more (the clients there see images themselves, so no
 * one-image describer limits them): `scene` picks one frame per SHOT rather than per slice and
 * drops near-identical frames, `from`/`to` narrow the clip, `separate` returns each frame as its
 * own picture instead of a sheet. Cosmo passes none of them and gets exactly the old sheet.
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

const THUMB = 16;      // a frame's fingerprint for the scene pick: 16x16 grey, 256 bytes
const CUT_DIFF = 16;   // mean |difference| (0-255) between neighbouring fingerprints a cut must pass...
const CUT_SPIKE = 3;   // ...AND this many times the median change of the 8 frames around it: a pan over a
                       // busy pattern moves ~17 a frame for seconds, a cut is one lone jump
const DUP_DIFF = 2;    // at or below this two picked frames are the same picture (Watch skill's value)
// ponytail: fixed thresholds on 16x16 grey, no colour or motion model; a slow cross-fade reads as
// no cut (one shot, so frames fall back to even spacing) — tune these if real clips miss cuts.

const isViewable = (file) => MOVING.has(path.extname(file).toLowerCase()) || STILL.has(path.extname(file).toLowerCase());

const meanDiff = (a, b) => {
    let s = 0;
    for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]);
    return s / a.length;
};

// n picks spread evenly over a list: the middle of each of n equal slices.
const spread = (list, n) => (list.length <= n ? list : Array.from({ length: n }, (_, i) => list[Math.floor(((i + 0.5) * list.length) / n)]));

/**
 * At most `n` frames over [lo, hi), every shot in them, near-duplicates dropped. Every frame in
 * the window is fingerprinted in ONE ffmpeg pass; a cut is a jump between neighbours. More shots
 * than `n`: n shots spread across the clip. Fewer: each shot's frame, the rest spread evenly
 * (a pan or one long take is one shot, so it is all spread). Even spacing alone walks past a
 * shot shorter than a slice. A still clip comes back as fewer frames than asked.
 */
async function _scenePick(file, lo, hi, n) {
    const { stdout } = await execFileP(ffmpegPath, [
        '-v', 'error', '-i', file, '-an', '-sn',
        '-vf', `select='between(n\\,${lo}\\,${hi - 1})',scale=${THUMB}:${THUMB}:flags=area,format=gray`,
        '-fps_mode', 'passthrough', '-f', 'rawvideo', '-',
    ], { encoding: 'buffer', maxBuffer: 1024 * 1024 * 1024, windowsHide: true });
    const size = THUMB * THUMB;
    const got = Math.floor(stdout.length / size);
    if (!got) throw new Error(`no frames came out of "${path.basename(file)}"`);
    const print = (k) => stdout.subarray((k - lo) * size, (k - lo + 1) * size);
    const step = Array.from({ length: got }, (_, i) => (i ? meanDiff(print(lo + i), print(lo + i - 1)) : 0));
    const around = (i) => {
        const near = [...step.slice(Math.max(1, i - 4), i), ...step.slice(i + 1, i + 5)].sort((a, b) => a - b);
        return near.length ? near[Math.floor(near.length / 2)] : 0;
    };
    const cuts = [lo, ...step.flatMap((d, i) => (i && d > CUT_DIFF && d > CUT_SPIKE * around(i) ? [lo + i] : []))];
    // A shot's MIDDLE frame, not its first: the frame on a cut is often half a transition.
    const shots = cuts.map((c, i) => Math.floor((c + (cuts[i + 1] ?? lo + got)) / 2));
    const isShot = new Set(shots);
    const even = Array.from({ length: n }, (_, i) => lo + Math.floor(((i + 0.5) * got) / n));
    const pool = shots.length >= n ? shots : [...new Set([...shots, ...even])].sort((a, b) => a - b);
    const distinct = [];
    for (const k of pool) if (!distinct.length || meanDiff(print(k), print(distinct.at(-1))) > DUP_DIFF) distinct.push(k);
    if (distinct.length <= n || shots.length >= n) return spread(distinct, n);
    // Over n with fill frames in: every shot stays, the even frames are what thins.
    const kept = distinct.filter((k) => isShot.has(k));
    return [...kept, ...spread(distinct.filter((k) => !isShot.has(k)), n - kept.length)].sort((a, b) => a - b);
}

/**
 * @param {string} file absolute path of an image, video or GIF
 * @param {{frames?: number, from?: number, to?: number, scene?: boolean, separate?: boolean}} [opts]
 *   frames 2-12, default 6; from/to in seconds narrow a clip (times stay the clip's own);
 *   scene = one frame per shot, duplicates dropped; separate = one picture per frame, no sheet
 * @returns {Promise<{kind:'image'|'video', data?:Buffer, frames?:{data:Buffer, time:number}[], mimeType:string,
 *   width?:number, height?:number, duration?:number, times?:number[], columns?:number, hasAudio?:boolean}>}
 */
async function viewFile(file, { frames = 6, from, to, scene = false, separate = false } = {}) {
    const ext = path.extname(file).toLowerCase();
    if (!MOVING.has(ext)) {
        // limitInputPixels off + rotate(): the same 16K-still and EXIF rules as the gallery thumbs.
        // metadata() reads the header, not the pipeline: the upright size is its autoOrient (MPI-959).
        const img = sharp(file, { limitInputPixels: false }).rotate();
        const { width, height } = (await img.metadata()).autoOrient;
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
    // The window [lo, hi) in frames: the first frame at or after `from`, the last before `to`.
    let lo = 0;
    let hi = count;
    if (Number.isFinite(from) || Number.isFinite(to)) {
        while (lo < count && Number.isFinite(from) && timeOf(lo) < from) lo++;
        hi = lo;
        while (hi < count && !(Number.isFinite(to) && timeOf(hi) >= to)) hi++;
        if (hi <= lo) throw new Error(`no frames between ${from ?? 0}s and ${to ?? probe.duration}s of "${path.basename(file)}" (it is ${probe.duration}s long)`);
    }
    const n = Math.min(hi - lo, 12, Math.max(2, Math.round(Number(frames) || 6)));
    // The MIDDLE of each of n equal slices, so neither the first nor the last frame (often a
    // fade or a hold) takes a whole cell.
    const idx = scene
        ? await _scenePick(file, lo, hi, n)
        : Array.from({ length: n }, (_, i) => lo + Math.floor(((i + 0.5) * (hi - lo)) / n));
    const times = idx.map((k) => Number(timeOf(k).toFixed(2)));
    const select = `select='${idx.map((k) => `eq(n\\,${k})`).join('+')}'`;
    if (separate) {
        // One strip, one frame per row, then cut apart: one ffmpeg run, whatever the count.
        const { stdout } = await execFileP(ffmpegPath, [
            '-v', 'error', '-i', file,
            '-vf', `${select},scale=w='min(${VIEW_PX},iw)':h='min(${VIEW_PX},ih)':force_original_aspect_ratio=decrease:force_divisible_by=2,tile=1x${idx.length}`,
            '-frames:v', '1', '-c:v', 'png', '-f', 'image2pipe', '-',
        ], { encoding: 'buffer', maxBuffer: 256 * 1024 * 1024, windowsHide: true });
        if (!stdout?.length) throw new Error(`no frames came out of "${path.basename(file)}"`);
        const { width: w, height: stripH } = await sharp(stdout, { limitInputPixels: false }).metadata();
        const h = stripH / idx.length;
        const pics = await Promise.all(idx.map((_, i) => sharp(stdout, { limitInputPixels: false })
            .extract({ left: 0, top: i * h, width: w, height: h }).webp({ quality: 82 }).toBuffer()));
        return {
            kind: 'video', frames: pics.map((data, i) => ({ data, time: times[i] })), mimeType: 'image/webp',
            width: probe.width, height: probe.height, duration: probe.duration, times, hasAudio: probe.hasAudio,
        };
    }
    const columns = n <= 4 ? 2 : n <= 9 ? 3 : 4;
    const rows = Math.ceil(n / columns);
    const { stdout } = await execFileP(ffmpegPath, [
        '-v', 'error',
        '-i', file,
        '-vf', `${select},scale=${SHEET_CELL_PX}:-2,tile=${columns}x${rows}:padding=4:color=black`,
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
