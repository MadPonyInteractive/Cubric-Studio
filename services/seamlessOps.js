'use strict';

/**
 * seamlessOps.js — pixel work for the Make Seamless Flow (MPI-1101).
 *
 * A run keeps a lossless full-size WORKING COPY in os.tmpdir()/cubric-seamless/<runId>/.
 * All intermediates are PNG (lossless); JPEG is never used.
 *
 * Route contract (routes/seamless.js):
 *   POST /seamless/prepare  { sourcePath, handles:{left,right,top,bottom}, lightingFlatten? }
 *     → { ok:true, runId, width, height, bandX, bandY, windows }
 *         bandX/bandY: { start:number, end:number } | null
 *         windows: [{ i, rect, paint, band, axis:'x'|'y' }, ...]  (rects {left,top,width,height}; planAxis)
 *   POST /seamless/window   { runId, i }
 *     → { ok:true, imagePath, maskPath }
 *   POST /seamless/paste    { runId, i, resultPath }
 *     → { ok:true }
 *   POST /seamless/finish   { runId, outPath }
 *     → { ok:true, path }
 *
 * Band math (brainstorm.md): after rolling the image right by dx=w//2 and down by dy=h//2,
 * the x-seam band is [w//2 - right*w, w//2 + left*w) and the y-seam band is
 * [h//2 - bottom*h, h//2 + top*h).  A handle pair at 0 → no band on that axis.
 *
 * The working copy stays UNROLLED; each window carries its own roll (its frame fx, fy) and its
 * rects are in that rolled frame.  x-band windows sit in frame (dx, 0), y-band windows in (0, dy),
 * and a both-ways run adds one corner window in (dx, dy).  Rolling the whole copy by (dx, dy) once
 * (the first build) made each band one window whose two free ends were neighbouring rows of the
 * picture's MIDDLE, painted apart: a hard break at h/2 and w/2 on every both-ways result.  Now an
 * x window's ends land on the top/bottom edge, which the y band repaints; a y window's ends meet
 * inside the joined side seam, which the corner window repaints.
 *
 * For the x-band (vertical stripe, seam runs along y): windows walk down y (~1024 target), each
 * cut with CONTEXT_PX of picture either side of the band and OVERLAP_PX over the window before
 * (planAxis).  Same pattern transposed for y-band.
 *
 * sharp traps observed in this file (see ~/.claude/memory/tools/sharp.md):
 *  - limitInputPixels:false on EVERY input descriptor (constructor, raw, composite, joinChannel)
 *  - fixed pipeline order: extract before composite → always materialise between pipelines
 *  - joinChannel: use flatten() not removeAlpha() before joinChannel
 *  - 1-channel raw output from blur: add toColourspace('b-w') before .raw()
 *  - sharp.cache({ files: 0 }) at module load (EBUSY on Windows for WebP)
 *  - blur-then-threshold runs threshold first → each step needs its own pipeline
 */

const fs    = require('fs-extra');
const os    = require('os');
const path  = require('path');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');

// libvips file cache causes EBUSY on Windows when a WebP is read then deleted.
sharp.cache({ files: 0 });

const SCRATCH_BASE   = path.join(os.tmpdir(), 'cubric-seamless');
const KEEP_MS        = 24 * 60 * 60 * 1000;   // 24 h, same as cubric-engine-inputs
const WINDOW_TARGET  = 1024;                   // target px along the seam per window
const FEATHER_PX     = 32;                     // inward feather at band edges
const CONTEXT_PX     = 256;                    // least picture each side of the band a cut shows the model
const OVERLAP_PX     = 256;                    // least seam length a window re-reads from the one before
const MAX_CUT        = 4096;                   // longest edge of a cut across the band
const RAMP_FRAC      = 0.4;                    // the model's mask reaches full strength this far into the band
const DIV_K          = 12;                     // px either side of the seam a drawn divider is looked for in (seamScore)
const INPUT          = { limitInputPixels: false };

/** runId comes off the wire: only a uuid may name a run dir, never a path that climbs out. */
function runDirOf(runId) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(String(runId))) throw new Error(`seamless: bad runId ${runId}`);
    return path.join(SCRATCH_BASE, runId);
}

// ── Sweep ─────────────────────────────────────────────────────────────────────

/** Remove run directories older than KEEP_MS. Best-effort, never throws. */
async function sweepScratch(now = Date.now()) {
    const entries = await fs.readdir(SCRATCH_BASE).catch(() => []);
    for (const name of entries) {
        const dir = path.join(SCRATCH_BASE, name);
        const stat = await fs.stat(dir).catch(() => null);
        if (stat?.isDirectory() && now - stat.mtimeMs > KEEP_MS) {
            await fs.remove(dir).catch(() => {});
        }
    }
}

// ── Band math ─────────────────────────────────────────────────────────────────

/**
 * Band pixel range after a roll by n//2:
 *   [n//2 - round(hi*n), n//2 + round(lo*n))
 * lo = the leading-edge handle (its strip moves INTO the band from the leading side).
 * hi = the trailing-edge handle (its strip lands on the far side of the seam).
 * Returns null when both handles are 0 (no band on this axis).
 * @param {number} n  dimension in pixels
 * @param {number} lo handle fraction 0..0.5
 * @param {number} hi handle fraction 0..0.5
 */
function bandRange(n, lo, hi) {
    if (lo === 0 && hi === 0) return null;
    const c = Math.floor(n / 2);
    return {
        start: Math.max(0, c - Math.round(hi * n)),
        end:   Math.min(n, c + Math.round(lo * n)),
    };
}

// ── Roll ──────────────────────────────────────────────────────────────────────

/**
 * Roll an image right by dx px and down by dy px (circular shift, lossless PNG).
 * Two sequential passes (horizontal then vertical) so only two halves are in memory
 * at once.  Each half materialises through a raw buffer to avoid the sharp fixed-
 * pipeline trap (extract before composite).
 */
async function rollImage(srcPath, dx, dy, outPath) {
    const meta = await sharp(srcPath, INPUT).metadata();
    const w = meta.width, h = meta.height;

    // Flatten to opaque RGB so the working copy is always 3-channel PNG.
    const ch = 3;

    // ── Horizontal roll ──────────────────────────────────────────────────────
    let mid;   // PNG Buffer
    if (dx > 0 && dx < w) {
        // Roll right by dx: pixel at old_x moves to (old_x + dx) % w.
        // Right slice [w-dx, w) → new position [0, dx)
        // Left slice  [0, w-dx) → new position [dx, w)
        const [rSlice, lSlice] = await Promise.all([
            sharp(srcPath, INPUT).flatten({ background: '#000000' })
                .extract({ left: w - dx, top: 0, width: dx,     height: h })
                .raw().toBuffer({ resolveWithObject: true }),
            sharp(srcPath, INPUT).flatten({ background: '#000000' })
                .extract({ left: 0,      top: 0, width: w - dx, height: h })
                .raw().toBuffer({ resolveWithObject: true }),
        ]);
        mid = await sharp({
            create: { width: w, height: h, channels: ch, background: { r: 0, g: 0, b: 0 } },
        }).composite([
            { input: rSlice.data, raw: rSlice.info, limitInputPixels: false, left: 0,  top: 0 },
            { input: lSlice.data, raw: lSlice.info, limitInputPixels: false, left: dx, top: 0 },
        ]).png().toBuffer();
    } else {
        // No horizontal roll — just flatten and encode.
        mid = await sharp(srcPath, INPUT).flatten({ background: '#000000' }).png().toBuffer();
    }

    // ── Vertical roll ────────────────────────────────────────────────────────
    if (dy > 0 && dy < h) {
        // Roll down by dy: pixel at old_y moves to (old_y + dy) % h.
        // Bottom slice [h-dy, h) → new position [0, dy)
        // Top slice    [0, h-dy) → new position [dy, h)
        const [bSlice, tSlice] = await Promise.all([
            sharp(mid, INPUT)
                .extract({ left: 0, top: h - dy, width: w, height: dy     })
                .raw().toBuffer({ resolveWithObject: true }),
            sharp(mid, INPUT)
                .extract({ left: 0, top: 0,      width: w, height: h - dy })
                .raw().toBuffer({ resolveWithObject: true }),
        ]);
        await sharp({
            create: { width: w, height: h, channels: ch, background: { r: 0, g: 0, b: 0 } },
        }).composite([
            { input: bSlice.data, raw: bSlice.info, limitInputPixels: false, left: 0, top: 0  },
            { input: tSlice.data, raw: tSlice.info, limitInputPixels: false, left: 0, top: dy },
        ]).png().toFile(outPath);
    } else {
        await fs.writeFile(outPath, mid);
    }
}

// ── Lighting flatten ──────────────────────────────────────────────────────────

/**
 * Reduce large-scale luminance gradient.
 * amount = 0 → no-op (file copy).  amount = 1 → full normalisation.
 *
 * Method: low-pass the luminance via a blur, compute per-pixel scale =
 * (mean_luma / local_luma)^amount, multiply each channel by that scale.
 *
 * Two separate pipelines for blur (sharp.md: blur/threshold fixed order means
 * blur+greyscale cannot be chained reliably — materialise greyscale first, then blur).
 * toColourspace('b-w') before .raw() keeps the output 1-channel (sharp.md Trap 2).
 */
async function lightenFlatten(srcPath, amount, outPath) {
    if (amount <= 0) { await fs.copyFile(srcPath, outPath); return; }

    const { width: w, height: h } = await sharp(srcPath, INPUT).metadata();

    // Step 1: materialise greyscale (1-channel).
    const { data: lumaData, info: lumaInfo } = await sharp(srcPath, INPUT)
        .flatten({ background: '#000000' })
        .greyscale()
        .toColourspace('b-w')
        .raw()
        .toBuffer({ resolveWithObject: true });

    // Step 2: low-pass blur on the greyscale, separate pipeline (fixed order trap).
    const sigma = Math.max(0.3, Math.min(256, Math.min(w, h) * 0.1));
    const { data: blurData } = await sharp(lumaData, { raw: lumaInfo, limitInputPixels: false })
        .blur({ sigma, minAmplitude: 0.01 })
        .toColourspace('b-w')
        .raw()
        .toBuffer({ resolveWithObject: true });

    // Step 3: global mean luminance.
    let total = 0;
    for (let i = 0; i < lumaData.length; i++) total += lumaData[i];
    const meanLuma = total / lumaData.length;

    // Step 4: source RGB (3-channel).
    const { data: rgbData, info: rgbInfo } = await sharp(srcPath, INPUT)
        .flatten({ background: '#000000' })
        .raw()
        .toBuffer({ resolveWithObject: true });
    const c = rgbInfo.channels;

    // Step 5: apply scale per pixel.
    const out = Buffer.allocUnsafe(rgbData.length);
    for (let i = 0; i < w * h; i++) {
        const local = Math.max(1, blurData[i]);
        const scale = Math.pow(meanLuma / local, amount);
        for (let k = 0; k < c; k++) {
            out[i * c + k] = Math.max(0, Math.min(255, Math.round(rgbData[i * c + k] * scale)));
        }
    }

    await sharp(out, { raw: { width: w, height: h, channels: c }, limitInputPixels: false })
        .png()
        .toFile(outPath);
}

// ── Window plan ───────────────────────────────────────────────────────────────

/**
 * Plan windows for one band axis. Each window has three rects, in rolled-image pixels:
 *   rect  — the CUT the model sees: the band plus CONTEXT_PX of picture each side of it.
 *           A cut that was only the band (the first build) left the model no surroundings to
 *           continue, so every window came back a new picture with hard edges (MPI-1101 Phase 4).
 *   paint — what the model repaints at full strength: the band, minus the OVERLAP_PX the window
 *           re-reads from the window before it along the seam, already painted. The mask rises
 *           through that overlap from 0 (`windowMaskBuffer`), so the two windows meet without a line.
 *   band  — what is pasted back: the band's part of the cut. Outside the band nothing is pasted.
 *
 * axis 'x' (x-seam, vertical stripe [band.start, band.end) in x): windows walk down y,
 *   WINDOW_TARGET tall. axis 'y': the same, transposed.
 *
 * @returns {{ rect:Object, paint:Object, band:Object, axis:string }[]}
 */
function planAxis(w, h, band, axis) {
    if (!band) return [];
    const { start, end } = band;
    if (end - start <= 0) return [];
    const along = axis === 'x' ? h : w;            // the seam's length
    const across = axis === 'x' ? w : h;
    // The bench's proportions (MPI-1101 rounds 1-5, Phase 4): the model needs about half the band
    // again of picture on each side, or the band is most of what it sees and it paints a new
    // picture there. Square cuts, so a long seam does not get one tall sliver of context.
    const ctx = Math.max(CONTEXT_PX, Math.min(Math.round((end - start) / 2), Math.floor((MAX_CUT - (end - start)) / 2)));
    // ponytail: a band wider than MAX_CUT minus its context is split into side-by-side columns,
    // which meet in a straight line inside the band. Only an 8K+ picture with handles past ~25%
    // a side gets there; overlap the columns the way the windows overlap if one ever shows.
    const span = MAX_CUT - 2 * ctx;
    const nCols = Math.max(1, Math.ceil((end - start) / span));
    const colW = Math.ceil((end - start) / nCols);
    const box = (a0, a1, c0, c1) => (axis === 'x'
        ? { left: c0, top: a0, width: c1 - c0, height: a1 - a0 }
        : { left: a0, top: c0, width: a1 - a0, height: c1 - c0 });
    const windows = [];
    for (let k = 0; k < nCols; k++) {
        const b0 = start + k * colW;
        const b1 = Math.min(end, b0 + colW);
        if (b1 <= b0) continue;
        const c0 = Math.max(0, b0 - ctx);
        const c1 = Math.min(across, b1 + ctx);
        // A seam up to MAX_CUT long is ONE window, as on the bench: a later window that sees only the
        // seam's far end (a panorama's floor) paints a picture of its own there.
        const len = along <= MAX_CUT ? along : Math.max(WINDOW_TARGET, c1 - c0);
        const overlap = Math.max(OVERLAP_PX, Math.round(len / 4));
        let painted = 0;
        while (painted < along) {
            const a0 = painted === 0 ? 0 : Math.max(0, Math.min(painted - overlap, along - len));
            const a1 = Math.min(along, a0 + len);
            windows.push({ rect: box(a0, a1, c0, c1), paint: box(painted, a1, b0, b1), band: box(a0, a1, b0, b1), axis });
            painted = a1;
        }
    }
    return windows;
}

/**
 * The corner window of a both-ways run, in frame (dx, dy): the y band cut across a stretch of x
 * centred on frame x = dx, where the y windows' two ends meet (the picture's left/right edge).
 * `fade` ramps both its mask and its paste to 0 at the stretch's ends, so it blends into what the
 * y windows painted instead of leaving two new edges of its own.
 */
function planCorner(w, h, bandY, dx) {
    const ys = planAxis(w, h, bandY, 'y');
    if (!ys.length) return [];
    const len = Math.min(w, Math.max(WINDOW_TARGET, ys[0].rect.height));
    const x0 = Math.max(0, Math.min(w - len, dx - Math.floor(len / 2)));
    return planAxis(len, h, bandY, 'y').map((win) => {
        const shift = (r) => ({ ...r, left: r.left + x0 });
        return { ...win, rect: shift(win.rect), paint: shift(win.paint), band: shift(win.band), fade: true };
    });
}

// ── Frames ────────────────────────────────────────────────────────────────────

/** [a, a+len) of a frame rolled by f, as spans of the unrolled axis n: { o: offset in the run, p: position, l: length }. */
function wrapSpans(a, len, f, n) {
    const spans = [];
    let p = ((a - f) % n + n) % n;
    for (let o = 0; o < len; p = 0) {
        const l = Math.min(len - o, n - p);
        spans.push({ o, p, l });
        o += l;
    }
    return spans;
}

/** A rect in frame (fx, fy) as up to four pieces of the unrolled picture; ox/oy place each piece in the rect. */
function framePieces(rect, fx, fy, w, h) {
    const pieces = [];
    for (const sx of wrapSpans(rect.left, rect.width, fx, w)) {
        for (const sy of wrapSpans(rect.top, rect.height, fy, h)) {
            pieces.push({ ox: sx.o, oy: sy.o, left: sx.p, top: sy.p, width: sx.l, height: sy.l });
        }
    }
    return pieces;
}

// ── Masks ─────────────────────────────────────────────────────────────────────

/**
 * A 1-channel mask the size of `rect`: 255 inside `sub` (in the same image space), 0 outside.
 * With `featherAxis`, the inside ramps from 0 at `sub`'s edges across that axis (the band's
 * edges) to 255 FEATHER_PX inward, so a paste fades into the picture beside the band and never
 * reaches past it. The ramp is linear.
 */
function makeMaskBuffer(rect, sub, featherAxis = null) {
    const ww = rect.width, wh = rect.height;
    const buf = Buffer.alloc(ww * wh);
    const x0 = sub.left - rect.left, y0 = sub.top - rect.top;
    const sw = sub.width, sh = sub.height;
    const fp = Math.max(1, Math.min(FEATHER_PX, Math.floor((featherAxis === 'x' ? sw : sh) / 4)));
    for (let y = Math.max(0, y0); y < Math.min(wh, y0 + sh); y++) {
        for (let x = Math.max(0, x0); x < Math.min(ww, x0 + sw); x++) {
            let alpha = 255;
            if (featherAxis) {
                const d = featherAxis === 'x' ? Math.min(x - x0, x0 + sw - 1 - x) : Math.min(y - y0, y0 + sh - 1 - y);
                alpha = d >= fp ? 255 : Math.round(255 * d / fp);
            }
            buf[y * ww + x] = alpha;
        }
    }
    return buf;
}

/**
 * The model's mask for a window: 0 outside `paint`; inside it, a smoothstep from 0 at each edge of the
 * whole band (`band` = { start, end } across `axis`, rolled pixels) to 255 RAMP_FRAC of the band in.
 * The graph's DifferentialDiffusion reads it as per-pixel strength: near the band's edges the picture keeps
 * its own content and only the seam is repainted freely. A hard band mask let the model redraw the band
 * right up to its edges, which showed as two straight lines (MPI-1101 eye test, 2026-10-12). Measured from
 * the BAND, not the window's column, so columns of a split band meet at full strength.
 */
function rampMaskBuffer(rect, paint, axis, band) {
    const buf = makeMaskBuffer(rect, paint);
    const ww = rect.width, wh = rect.height;
    const ramp = Math.max(1, RAMP_FRAC * (band.end - band.start));
    const n = axis === 'x' ? ww : wh;
    const off = axis === 'x' ? rect.left : rect.top;
    const level = new Float32Array(n);
    for (let i = 0; i < n; i++) {
        const t = Math.min(1, Math.max(0, Math.min(off + i - band.start, band.end - 1 - (off + i)) / ramp));
        level[i] = t * t * (3 - 2 * t);
    }
    for (let y = 0; y < wh; y++) {
        for (let x = 0; x < ww; x++) {
            const p = y * ww + x;
            if (buf[p]) buf[p] = Math.round(buf[p] * level[axis === 'x' ? x : y]);
        }
    }
    return buf;
}

/**
 * The model's whole mask for a window: `rampMaskBuffer` over the band's part of the cut, rising along
 * the seam through the OVERLAP the window re-reads from the one before it: 0 where the cut starts, full
 * where its own paint starts. A mask that switched on at full strength right at the paint start let the
 * model begin a new picture there, a line across the seam where two windows meet (16K real photo,
 * row step 2.5x at y=4096, MPI-1101 2026-10-13). Ramped, the earlier window's rows are where it starts
 * from; they are pasted back (the paste covers the band's part of the cut), so the join is continuous.
 * A corner window's `fade` scales it last.
 */
function windowMaskBuffer(win, band) {
    const { rect, axis } = win;
    const buf = rampMaskBuffer(rect, win.band, axis, band);
    const o = axis === 'x' ? win.paint.top - win.band.top : win.paint.left - win.band.left;   // overlap length
    const o0 = axis === 'x' ? win.band.top - rect.top : win.band.left - rect.left;
    if (o > 0) {
        const ww = rect.width, wh = rect.height;
        for (let y = 0; y < wh; y++) {
            for (let x = 0; x < ww; x++) {
                const i = (axis === 'x' ? y : x) - o0;
                if (i >= o) continue;
                const t = Math.max(0, i / o);
                const p = y * ww + x;
                buf[p] = Math.round(buf[p] * t * t * (3 - 2 * t));
            }
        }
    }
    if (win.fade) fadeAlong(buf, rect, axis);
    return buf;
}

/**
 * How badly a window's result failed to join, measured where the picture's two edges meet in its cut
 * (frame x = fx for an x window, frame y = fy for a y window), block by block along the paint:
 *   edge    — the step across the seam line over the median step of the lines just beside it. A seam the
 *             model kept (it reproduced the cut it was shown) stands 50-70x above its texture; a healed
 *             one sits under ~15 (16K real photo, MPI-1101 2026-10-13).
 *   divider — a line the model DREW on the seam: the lines within DIV_K of it, against the mean of the
 *             lines DIV_K..3*DIV_K out, in luma levels (a white ~20 px stripe read 30-65; clean 1-10).
 * @param {Object} win - a planned window
 * @param {{width:number, height:number, data:Buffer}} luma - the result at the cut's size, 1 channel
 * @returns {?{edge:number, divider:number}} null when the seam is not inside this cut
 */
function seamScore(win, luma) {
    const { rect, axis } = win;
    const vertical = axis === 'x';                       // an x seam is a vertical line in the cut
    const s = vertical ? win.fx - rect.left : win.fy - rect.top;
    const across = vertical ? luma.width : luma.height;
    if (s < 3 * DIV_K || s > across - 3 * DIV_K) return null;
    const p0 = vertical ? win.paint.top - rect.top : win.paint.left - rect.left;
    const p1 = p0 + (vertical ? win.paint.height : win.paint.width);
    const at = (c, a) => (vertical ? luma.data[a * luma.width + c] : luma.data[c * luma.width + a]);
    const step = (c, a0, a1) => { let t = 0; for (let a = a0; a < a1; a++) t += Math.abs(at(c, a) - at(c - 1, a)); return t / (a1 - a0); };
    const mean = (c, a0, a1) => { let t = 0; for (let a = a0; a < a1; a++) t += at(c, a); return t / (a1 - a0); };
    const med = (v) => v.sort((x, y) => x - y)[v.length >> 1];
    const block = Math.max(64, Math.round((p1 - p0) / 16));
    let edge = 0, divider = 0;
    for (let a0 = p0; a0 < p1; a0 += block) {
        const a1 = Math.min(p1, a0 + block);
        if (a1 - a0 < 16) continue;
        const beside = [];
        for (let d = DIV_K; d < 3 * DIV_K; d += 4) beside.push(step(s - d, a0, a1), step(s + d, a0, a1));
        edge = Math.max(edge, step(s, a0, a1) / Math.max(0.5, med(beside)));
        let far = 0, n = 0;
        for (let d = DIV_K; d < 3 * DIV_K; d++) { far += mean(s + d, a0, a1) + mean(s - d - 1, a0, a1); n += 2; }
        far /= n;
        for (let d = -DIV_K; d < DIV_K; d++) divider = Math.max(divider, Math.abs(mean(s + d, a0, a1) - far));
    }
    return { edge, divider };
}

/** A corner window's fade: scales `buf` (the rect's mask) by a smoothstep from 0 at both ends of the seam's run to 1 a quarter in. */
function fadeAlong(buf, rect, axis) {
    const ww = rect.width, wh = rect.height;
    const n = axis === 'x' ? wh : ww;               // the seam runs along y for an x band
    const ramp = Math.max(1, n / 4);
    for (let y = 0; y < wh; y++) {
        for (let x = 0; x < ww; x++) {
            const i = axis === 'x' ? y : x;
            const t = Math.min(1, Math.min(i, n - 1 - i) / ramp);
            const p = y * ww + x;
            buf[p] = Math.round(buf[p] * t * t * (3 - 2 * t));
        }
    }
    return buf;
}

// ── Public operations ─────────────────────────────────────────────────────────

/**
 * Prepare a seamless run.
 * @param {object} opts
 * @param {string}  opts.sourcePath
 * @param {{ left:number, right:number, top:number, bottom:number }} opts.handles
 *   percentages 0..50 (clamped)
 * @param {number} [opts.lightingFlatten=0]  0..1
 * @returns {Promise<object>} run state (runId, bandX, bandY, windows, …)
 */
async function prepare({ sourcePath, handles, lightingFlatten = 0 }) {
    await fs.ensureDir(SCRATCH_BASE);
    sweepScratch().catch(() => {});   // best-effort, fire and forget

    const runId  = uuidv4();
    const runDir = path.join(SCRATCH_BASE, runId);
    await fs.ensureDir(runDir);

    const { width: w, height: h } = await sharp(sourcePath, INPUT).metadata();

    // Normalise handles: clamp 0..50 as percentage, convert to fraction.
    const hL = Math.max(0, Math.min(0.5, Number(handles.left)   / 100));
    const hR = Math.max(0, Math.min(0.5, Number(handles.right)  / 100));
    const hT = Math.max(0, Math.min(0.5, Number(handles.top)    / 100));
    const hB = Math.max(0, Math.min(0.5, Number(handles.bottom) / 100));

    const hasX = (hL + hR) > 0;
    const hasY = (hT + hB) > 0;
    const dx   = hasX ? Math.floor(w / 2) : 0;
    const dy   = hasY ? Math.floor(h / 2) : 0;

    // Optional lighting flatten.
    const flatPath = path.join(runDir, 'flat.png');
    await lightenFlatten(sourcePath, lightingFlatten, flatPath);

    // The working copy stays unrolled (flattened to opaque RGB PNG); each window rolls its own cut.
    const workPath = path.join(runDir, 'working.png');
    await rollImage(flatPath, 0, 0, workPath);
    await fs.remove(flatPath);

    // Band ranges in each axis's rolled frame.
    // x-band: lo = left handle (leading edge), hi = right handle (trailing edge).
    // y-band: lo = top handle, hi = bottom handle.
    const bandX = hasX ? bandRange(w, hL, hR) : null;
    const bandY = hasY ? bandRange(h, hT, hB) : null;

    // Window plan: x band in frame (dx, 0), y band in (0, dy), then the corner where they meet.
    const wins = [
        ...planAxis(w, h, bandX, 'x').map((win) => ({ ...win, fx: dx, fy: 0 })),
        ...planAxis(w, h, bandY, 'y').map((win) => ({ ...win, fx: 0, fy: dy })),
        ...(bandX && bandY ? planCorner(w, h, bandY, dx).map((win) => ({ ...win, fx: dx, fy: dy })) : []),
    ].map((win, i) => ({ i, ...win }));

    const state = { runId, sourcePath, width: w, height: h, dx, dy, bandX, bandY, windows: wins };
    await fs.writeJson(path.join(runDir, 'state.json'), state);
    return state;
}

/**
 * Cut window i from the current working copy and write image + mask PNGs to the
 * run directory.  Returns their absolute paths.
 */
async function windowCut(runId, i) {
    const runDir  = runDirOf(runId);
    const state   = await fs.readJson(path.join(runDir, 'state.json'));
    const win     = state.windows[i];
    if (!win) throw new Error(`seamless: no window ${i} in run ${runId}`);

    const { rect } = win;
    const workPath = path.join(runDir, 'working.png');

    // Cut image in the window's frame: up to four pieces of the unrolled copy, each materialised
    // (sharp fixed order: extract before composite), laid into a rect-sized canvas.
    const pieces = framePieces(rect, win.fx, win.fy, state.width, state.height);
    const parts = await Promise.all(pieces.map(({ left, top, width, height }) => sharp(workPath, INPUT)
        .extract({ left, top, width, height }).raw().toBuffer({ resolveWithObject: true })));
    const imgPath = path.join(runDir, `win_${i}_img.png`);
    await sharp({ create: { width: rect.width, height: rect.height, channels: 3, background: { r: 0, g: 0, b: 0 } } })
        .composite(parts.map((p, k) => ({ input: p.data, raw: p.info, limitInputPixels: false, left: pieces[k].ox, top: pieces[k].oy })))
        .png()
        .toFile(imgPath);

    // The model's mask: ramped up from the band's edges, and along the seam through the overlap.
    const maskBuf  = windowMaskBuffer(win, win.axis === 'x' ? state.bandX : state.bandY);
    const maskPath = path.join(runDir, `win_${i}_mask.png`);
    await sharp(maskBuf, {
        raw: { width: rect.width, height: rect.height, channels: 1 },
        limitInputPixels: false,
    }).png().toFile(maskPath);

    return { imagePath: imgPath, maskPath };
}

/**
 * Composite the model result for window i back into the working copy.
 * Alpha = feathered band ∩ window.  Pixels outside the window are not touched.
 *
 * sharp.md Trap 1: flatten() before joinChannel(), not removeAlpha().
 * Two pipelines: first materialise result RGB, then joinChannel on a new pipeline.
 */
async function paste(runId, i, resultPath) {
    const runDir = runDirOf(runId);
    const state  = await fs.readJson(path.join(runDir, 'state.json'));
    const win    = state.windows[i];
    if (!win) throw new Error(`seamless: no window ${i} in run ${runId}`);

    const { rect, axis } = win;
    const workPath = path.join(runDir, 'working.png');

    // Paste only the band's part of the cut, feathered inward at the band's edges: the context
    // the model saw either side stays the picture's own, byte for byte.
    const maskBuf = makeMaskBuffer(rect, win.band, axis);
    if (win.fade) fadeAlong(maskBuf, rect, axis);

    // Materialise result as 3-channel raw at the window's exact size.
    // Trap 1: flatten(), not removeAlpha(), before joinChannel on the next pipeline.
    const { data: rgbData, info: rgbInfo } = await sharp(resultPath, INPUT)
        .resize(rect.width, rect.height, { fit: 'fill' })
        .flatten({ background: '#000000' })
        .raw()
        .toBuffer({ resolveWithObject: true });

    // Join the feathered alpha channel.
    const { data: ovData, info: ovInfo } = await sharp(rgbData, { raw: rgbInfo, limitInputPixels: false })
        .joinChannel(maskBuf, { raw: { width: rect.width, height: rect.height, channels: 1 } })
        .raw()
        .toBuffer({ resolveWithObject: true });

    // Unroll the overlay: each piece of the frame lands where it sits in the unrolled copy.
    const pieces = framePieces(rect, win.fx, win.fy, state.width, state.height);
    const parts = await Promise.all(pieces.map(({ ox, oy, width, height }) => sharp(ovData, { raw: ovInfo, limitInputPixels: false })
        .extract({ left: ox, top: oy, width, height }).raw().toBuffer({ resolveWithObject: true })));

    // Composite onto working copy, write to a temp file then replace.
    const tmpPath = workPath + '.tmp';
    await sharp(workPath, INPUT)
        .composite(parts.map((p, k) => ({
            input: p.data, raw: p.info, limitInputPixels: false,
            left: pieces[k].left, top: pieces[k].top, blend: 'over',
        })))
        .png()
        .toFile(tmpPath);

    await fs.move(tmpPath, workPath, { overwrite: true });
}

/** Write the working copy (already unrolled: windows roll only their own cuts) to outPath. */
async function finish(runId, outPath) {
    const workPath = path.join(runDirOf(runId), 'working.png');
    await fs.copy(workPath, outPath);
    return outPath;
}

module.exports = {
    // Public API
    prepare, windowCut, paste, finish, sweepScratch, runDirOf,
    // Exported for tests
    bandRange, planAxis, planCorner, framePieces, rollImage, lightenFlatten, makeMaskBuffer, rampMaskBuffer, windowMaskBuffer, seamScore,
};
