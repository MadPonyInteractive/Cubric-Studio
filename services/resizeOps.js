'use strict';

/**
 * resizeOps.js — the Resize tool's pixels, with no ComfyUI (MPI-1069).
 *
 * Resize used to be a ComfyUI graph (ImageResizeKJv2 -> ImageFlip -> ImageRotate). Its
 * video twin decoded EVERY frame of the clip as float32 before resizing one: a 14 s 4K
 * phone clip needed ~82 GB and died with MemoryError, and as an engine job the tool was
 * locked while any generation ran. Resize, flip, rotate and pad are plain pixel ops, so
 * they run here, where Crop already runs: sharp for a still, streaming ffmpeg for a clip.
 *
 * ONE planner, TWO renderers. `planResize` is the whole of the old node's maths (KJNodes
 * `ImageResizeKJv2.resize`, read 2026-10-10), so the image and video renderers cannot
 * disagree about a size, an offset or a rounding. Python's `round()` is round-half-even,
 * and the node used it, so the planner does too.
 *
 *   resize -> crop/scale (keep_proportion) -> pad (pad family) -> flip -> rotate (clockwise)
 *
 * Flip `x` mirrors top-bottom and `y` left-right (ImageFlip's "x-axis: vertically" /
 * "y-axis: horizontally"); ImageRotate's `rot90(dims=[2,1])` turns CLOCKWISE.
 */

const fs = require('fs-extra');
const sharp = require('sharp');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { ffmpegPath } = require('./ffmpegBinary');
const { probeVideo } = require('./ffprobeVideo');

const execFileP = promisify(execFile);

// Photographers load 16K stills (past sharp's 268 MP default, and the limit fires on
// metadata() too - MPI-925). autoOrient: the panel shows the picture upright (MPI-959).
const INPUT = { limitInputPixels: false, autoOrient: true };

const DEFAULTS = Object.freeze({
    width: 512, height: 512, keep_proportion: 'crop',
    pad_color: { r: 0, g: 0, b: 0 }, crop_position: 'center', divisible_by: 16,
    flip: 'none', rotation: 'none',
});

// Always Lanczos (Fabio, 2026-10-10): the panel offers no method. An old card's
// `upscale_method` is ignored.
const SHARP_KERNEL = 'lanczos3';
const FFMPEG_FLAGS = 'lanczos';

const KEEP = new Set(['stretch', 'resize', 'pad', 'pad_edge', 'pad_edge_pixel', 'crop', 'pillarbox_blur', 'total_pixels']);
const POSITIONS = new Set(['center', 'top', 'bottom', 'left', 'right']);
const ROTATIONS = new Set([0, 90, 180, 270]);
const PAD_MODES = Object.freeze({ pad: 'color', pad_edge: 'edge', pad_edge_pixel: 'edge_pixel', pillarbox_blur: 'pillarbox_blur' });

/** Python 3 `round()`: half to even. */
function pyRound(x) {
    const f = Math.floor(x);
    const d = x - f;
    if (d > 0.5) return f + 1;
    if (d < 0.5) return f;
    return f % 2 === 0 ? f : f + 1;
}

const _int = (v, fallback, min = 1) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= min ? Math.round(n) : fallback;
};
const _channel = (v) => Math.max(0, Math.min(255, Math.round(Number(v) || 0)));

/** Any panel / agent / old-card params -> the values the planner trusts. */
function normalizeResizeParams(params = {}) {
    const p = params && typeof params === 'object' ? params : {};
    const color = p.pad_color && typeof p.pad_color === 'object' ? p.pad_color : DEFAULTS.pad_color;
    const rotation = p.rotation === 'none' ? 0 : Number(p.rotation);
    return {
        width: _int(p.width, DEFAULTS.width),
        height: _int(p.height, DEFAULTS.height),
        keep_proportion: KEEP.has(p.keep_proportion) ? p.keep_proportion : DEFAULTS.keep_proportion,
        pad_color: { r: _channel(color.r), g: _channel(color.g), b: _channel(color.b) },
        crop_position: POSITIONS.has(p.crop_position) ? p.crop_position : DEFAULTS.crop_position,
        divisible_by: _int(p.divisible_by, DEFAULTS.divisible_by),
        flip: p.flip === 'x' || p.flip === 'y' ? p.flip : 'none',
        rotation: ROTATIONS.has(rotation) ? rotation : 0,
    };
}

/** Where a `size` box sits inside `total` for a position: [before, after]. */
function _place(total, size, position, startKey, endKey) {
    const spare = total - size;
    if (position === startKey) return [0, spare];
    if (position === endKey) return [spare, 0];
    const before = Math.floor(spare / 2);
    return [before, spare - before];
}

/**
 * The old node's maths, for a `srcW` x `srcH` source (upright pixels).
 * @returns {{ crop: {left,top,width,height}|null, width:number, height:number,
 *   pad: {left,right,top,bottom}|null, padMode: string|null, color: {r,g,b},
 *   flip: 'none'|'x'|'y', rotation: 0|90|180|270, outW: number, outH: number }}
 */
function planResize(srcW, srcH, params) {
    if (!(srcW > 0 && srcH > 0)) throw new Error('Resize: the source has no size');
    const p = normalizeResizeParams(params);
    const mode = p.keep_proportion;
    const div = p.divisible_by;
    const padMode = PAD_MODES[mode] || null;
    let width = p.width;
    let height = p.height;
    let pad = null;

    if (mode === 'resize' || mode === 'total_pixels' || padMode) {
        let nw, nh;
        if (mode === 'total_pixels') {
            const total = width * height;
            const aspect = srcW / srcH;
            nh = Math.floor(Math.sqrt(total / aspect));
            nw = Math.floor(Math.sqrt(total * aspect));
        } else {
            const ratio = Math.min(width / srcW, height / srcH);
            nw = pyRound(srcW * ratio);
            nh = pyRound(srcH * ratio);
        }
        if (padMode) {
            // The node takes left/right from crop_position's horizontal word and
            // top/bottom from its vertical one; the other axis centres.
            const [left, right] = _place(width, nw, p.crop_position, 'left', 'right');
            const [top, bottom] = _place(height, nh, p.crop_position, 'top', 'bottom');
            pad = { left: Math.max(0, left), right: Math.max(0, right), top: Math.max(0, top), bottom: Math.max(0, bottom) };
        }
        width = nw;
        height = nh;
    }

    // divisible_by floors the size; a size it floors to nothing keeps one step.
    if (div > 1) {
        width = Math.max(div, width - (width % div));
        height = Math.max(div, height - (height % div));
    }

    let crop = null;
    if (mode === 'crop') {
        const newAspect = width / height;
        let cw, ch;
        if (srcW / srcH > newAspect) { cw = pyRound(srcH * newAspect); ch = srcH; }
        else { cw = srcW; ch = pyRound(srcW / newAspect); }
        cw = Math.max(1, Math.min(srcW, cw));
        ch = Math.max(1, Math.min(srcH, ch));
        const [left] = _place(srcW, cw, p.crop_position, 'left', 'right');
        const [top] = _place(srcH, ch, p.crop_position, 'top', 'bottom');
        crop = { left, top, width: cw, height: ch };
    }

    if (pad && !(pad.left || pad.right || pad.top || pad.bottom)) pad = null;
    if (pad && div > 1) {
        // The padded frame is rounded UP to divisible_by, on the right and bottom.
        const pw = width + pad.left + pad.right;
        const ph = height + pad.top + pad.bottom;
        if (pw % div) pad.right += div - (pw % div);
        if (ph % div) pad.bottom += div - (ph % div);
    }

    const fullW = width + (pad ? pad.left + pad.right : 0);
    const fullH = height + (pad ? pad.top + pad.bottom : 0);
    const quarter = p.rotation === 90 || p.rotation === 270;
    return {
        crop, width, height, pad, padMode: pad ? padMode : null, color: p.pad_color,
        flip: p.flip, rotation: p.rotation,
        outW: quarter ? fullH : fullW, outH: quarter ? fullW : fullH,
    };
}

// pillarbox_blur's background: the picture blown up to cover, blurred, 20 % toward grey
// and dimmed to 35 % (KJNodes ImagePadKJ). Both colour steps are one linear map.
const PILLAR_DIM = 0.35;
const PILLAR_DESAT = 0.2;
const LUMA = [0.2126, 0.7152, 0.0722];
const PILLAR_MATRIX = [0, 1, 2].map(row => LUMA.map((l, col) =>
    PILLAR_DIM * ((row === col ? 1 - PILLAR_DESAT : 0) + PILLAR_DESAT * l)));
const _pillarSigma = (w, h) => Math.max(1, 0.006 * Math.min(w, h));

/** Mean colour of the inner picture's four edges, from its raw pixels. */
function _edgeMeans({ data, info }) {
    const { width: w, height: h, channels: c } = info;
    const mean = (pixels) => {
        const sum = [0, 0, 0];
        for (const i of pixels) for (let k = 0; k < 3; k++) sum[k] += data[i * c + (c >= 3 ? k : 0)];
        return { r: Math.round(sum[0] / pixels.length), g: Math.round(sum[1] / pixels.length), b: Math.round(sum[2] / pixels.length) };
    };
    const row = (y) => Array.from({ length: w }, (_, x) => y * w + x);
    const col = (x) => Array.from({ length: h }, (_, y) => y * w + x);
    return { top: mean(row(0)), bottom: mean(row(h - 1)), left: mean(col(0)), right: mean(col(w - 1)) };
}

/**
 * The padded frame for the two pad modes sharp's `extend` cannot express, built on a
 * `create` canvas from the inner picture's raw pixels.
 */
async function _composedFrame(inner, plan) {
    const { width: w, height: h, channels } = inner.info;
    const { left: L, right: R, top: T, bottom: B } = plan.pad;
    const OW = w + L + R;
    const OH = h + T + B;
    const raw = { raw: { width: w, height: h, channels }, limitInputPixels: false };
    const layers = [];
    let base;
    if (plan.padMode === 'edge') {
        // Painted in the node's order: top, bottom, then left and right over the corners.
        const m = _edgeMeans(inner);
        const band = (width, height, c, left, top) => (width > 0 && height > 0
            ? [{ input: { create: { width, height, channels: 3, background: c } }, left, top }] : []);
        layers.push(...band(OW, T, m.top, 0, 0), ...band(OW, B, m.bottom, 0, T + h),
            ...band(L, OH, m.left, 0, 0), ...band(R, OH, m.right, L + w, 0));
        base = sharp({ create: { width: OW, height: OH, channels: 3, background: m.top } });
    } else {
        // Two pipelines, so the blur runs on the cropped cover and never on the picture
        // before it is blown up (sharp's op order is fixed, not the call order). Blur and
        // recomb are both linear, so their order inside the second does not matter.
        const cover = await sharp(inner.data, raw).removeAlpha()
            .resize(OW, OH, { fit: 'cover', kernel: 'linear' }).raw().toBuffer({ resolveWithObject: true });
        const bg = await sharp(cover.data, { raw: cover.info, limitInputPixels: false })
            .blur({ sigma: _pillarSigma(OW, OH), minAmplitude: 0.01 }).recomb(PILLAR_MATRIX)
            .raw().toBuffer({ resolveWithObject: true });
        base = sharp(bg.data, { raw: bg.info, limitInputPixels: false });
    }
    layers.push({ input: inner.data, raw: { width: w, height: h, channels }, limitInputPixels: false, left: L, top: T });
    return base.composite(layers);
}

/**
 * Resize a still. `input` is a path or an encoded Buffer (the panel's thumbnail).
 * @returns {Promise<{ image: import('sharp').Sharp, plan: object }>} a PNG-ready pipeline
 */
async function resizeImage(input, params) {
    const meta = await sharp(input, INPUT).metadata();
    const srcW = meta.autoOrient?.width || meta.width;
    const srcH = meta.autoOrient?.height || meta.height;
    const plan = planResize(srcW, srcH, params);

    // extract -> resize -> extend is sharp's own fixed order: one pipeline (docs/crop.md).
    let img = sharp(input, INPUT);
    if (plan.crop) img = img.extract(plan.crop);
    img = img.resize(plan.width, plan.height, { fit: 'fill', kernel: SHARP_KERNEL });
    if (plan.padMode === 'color') img = img.extend({ ...plan.pad, background: { ...plan.color, alpha: 1 } });
    else if (plan.padMode === 'edge_pixel') img = img.extend({ ...plan.pad, extendWith: 'copy' });
    else if (plan.padMode) img = await _composedFrame(await img.raw().toBuffer({ resolveWithObject: true }), plan);

    if (plan.flip !== 'none' || plan.rotation) {
        // ponytail: flip/rotate go on a materialised frame (output-sized raw, so a 16K
        // OUTPUT holds ~1 GB here); sharp orders a rotation against resize/extend by call
        // order, which is not the order a composite takes. Stream through a .v file if a
        // 16K rotate ever matters.
        const frame = await img.raw().toBuffer({ resolveWithObject: true });
        img = sharp(frame.data, { raw: frame.info, limitInputPixels: false });
        if (plan.flip === 'x') img = img.flip();     // top-bottom; sharp flips before it rotates
        if (plan.flip === 'y') img = img.flop();     // left-right
        if (plan.rotation) img = img.rotate(plan.rotation);
    }
    return { image: img.png(), plan };
}

/** Resize a still from disk to a PNG at `outPath`. */
async function resizeImageFile(inputPath, outPath, params) {
    const { image, plan } = await resizeImage(inputPath, params);
    await image.toFile(outPath);
    return { width: plan.outW, height: plan.outH };
}

const _hex = ({ r, g, b }) => '0x' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');

/**
 * The plan as one `-vf` filtergraph. Pad modes run in planar RGB: a 1-px edge row
 * cannot be cropped from 4:2:0 frames, and odd pad offsets would round to the chroma
 * grid. The encoder converts back to yuv420p, which needs EVEN sides, so an odd frame
 * loses its last row or column (divisible_by >= 2 never makes one).
 */
function videoFilter(plan) {
    const f = [];
    if (plan.crop) f.push(`crop=${plan.crop.width}:${plan.crop.height}:${plan.crop.left}:${plan.crop.top}`);
    f.push(`scale=${plan.width}:${plan.height}:flags=${FFMPEG_FLAGS}`, 'setsar=1');
    let graph;
    if (plan.padMode) {
        const { left: L, right: R, top: T, bottom: B } = plan.pad;
        const OW = plan.width + L + R;
        const OH = plan.height + T + B;
        const W = plan.width;
        const H = plan.height;
        f.push('format=gbrp');
        if (plan.padMode === 'color') {
            f.push(`pad=${OW}:${OH}:${L}:${T}:color=${_hex(plan.color)}`);
        } else if (plan.padMode === 'edge_pixel') {
            f.push(`pad=${OW}:${OH}:${L}:${T}`, `fillborders=left=${L}:right=${R}:top=${T}:bottom=${B}:mode=smear`);
        } else if (plan.padMode === 'edge') {
            // Each side's mean colour per frame: its 1-px edge averaged to 1x1, then
            // stretched over the band. Painted top, bottom, left, right like the node.
            const bands = [
                ['t', T > 0, `crop=iw:1:0:0`, OW, T, 0, 0],
                ['b', B > 0, `crop=iw:1:0:ih-1`, OW, B, 0, T + H],
                ['l', L > 0, `crop=1:ih:0:0`, L, OH, 0, 0],
                ['r', R > 0, `crop=1:ih:iw-1:0`, R, OH, L + W, 0],
            ].filter(b => b[1]);
            const heads = [`${f.join(',')},split=${bands.length + 1}[c]${bands.map(b => `[${b[0]}]`).join('')}`];
            for (const [k, , cut, bw, bh] of bands) {
                heads.push(`[${k}]${cut},scale=1:1:flags=area,scale=${bw}:${bh}:flags=neighbor[${k}2]`);
            }
            let last = 'p0';
            heads.push(`[c]pad=${OW}:${OH}:${L}:${T}[p0]`);
            bands.forEach(([k, , , , , x, y], i) => {
                const next = `p${i + 1}`;
                heads.push(`[${last}][${k}2]overlay=${x}:${y}[${next}]`);
                last = next;
            });
            graph = { heads, last };
        } else {
            const scaleFill = Math.max(OW / W, OH / H);
            const bw = Math.max(1, pyRound(W * scaleFill));
            const bh = Math.max(1, pyRound(H * scaleFill));
            const heads = [
                `${f.join(',')},split[fg][bg0]`,
                `[bg0]scale=${bw}:${bh}:flags=bilinear,crop=${OW}:${OH},gblur=sigma=${_pillarSigma(OW, OH).toFixed(3)},`
                    + `colorchannelmixer=${['r', 'g', 'b'].map((o, i) => ['r', 'g', 'b'].map((c, j) => `${o}${c}=${PILLAR_MATRIX[i][j].toFixed(5)}`).join(':')).join(':')}[bg]`,
                `[bg][fg]overlay=${L}:${T}[p0]`,
            ];
            graph = { heads, last: 'p0' };
        }
    }
    const tail = [];
    if (plan.flip === 'x') tail.push('vflip');
    if (plan.flip === 'y') tail.push('hflip');
    if (plan.rotation === 90) tail.push('transpose=1');
    if (plan.rotation === 180) tail.push('hflip', 'vflip');
    if (plan.rotation === 270) tail.push('transpose=2');
    if (plan.outW % 2 || plan.outH % 2) tail.push('crop=trunc(iw/2)*2:trunc(ih/2)*2:0:0');
    tail.push('format=yuv420p');
    if (!graph) return [...f, ...tail].join(',');
    return `${graph.heads.join(';')};[${graph.last}]${tail.join(',')}`;
}

/**
 * Resize a clip to an MP4 at `outPath`, streaming: ffmpeg holds a few frames, never the
 * clip. Audio is re-encoded like Crop's (`routes/videoCrop.js`); a trim slices first.
 * `signal` aborts kill ffmpeg.
 */
async function resizeVideoFile(inputPath, outPath, params, { trimIn, trimOut, signal } = {}) {
    const src = await probeVideo(inputPath);
    if (!src?.width || !src?.height) throw new Error('could not probe source dimensions');
    const plan = planResize(src.width, src.height, params);
    const tIn = Number(trimIn);
    const tOut = Number(trimOut);
    const args = ['-y'];
    if (Number.isFinite(tIn) && Number.isFinite(tOut) && tOut > tIn) args.push('-ss', String(tIn), '-to', String(tOut));
    args.push('-i', inputPath, '-vf', videoFilter(plan),
        '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p');
    if (src.hasAudio) args.push('-c:a', 'aac', '-b:a', '192k');
    else args.push('-an');
    args.push(outPath);
    try {
        await execFileP(ffmpegPath, args, { maxBuffer: 8 * 1024 * 1024, windowsHide: true, signal });
    } catch (err) {
        await fs.remove(outPath).catch(() => {});
        throw err;
    }
    return { width: plan.outW - (plan.outW % 2), height: plan.outH - (plan.outH % 2) };
}

module.exports = { planResize, normalizeResizeParams, resizeImage, resizeImageFile, resizeVideoFile, videoFilter, pyRound };
