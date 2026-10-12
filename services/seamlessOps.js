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
 *         windows: [{ i, rect:{left,top,width,height}, axis:'x'|'y' }, ...]
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
 * For the x-band (vertical stripe, seam runs along y): windows split along y (~1024 target)
 * and along x if band is wider than 4096.  Same pattern transposed for y-band.
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
 * Plan windows for one band axis.
 *
 * axis 'x' (x-seam, vertical stripe): the band covers [band.start, band.end) in x,
 *   full height h.  Seam runs along y, so windows tile y at ~WINDOW_TARGET px each.
 *   If band width > 4096, also tile x.
 *
 * axis 'y' (y-seam, horizontal stripe): the band covers [band.start, band.end) in y,
 *   full width w.  Seam runs along x, so windows tile x at ~WINDOW_TARGET px each.
 *   If band height > 4096, also tile y.
 *
 * @returns {{ rect:{left,top,width,height}, axis:string }[]}
 */
function planAxis(w, h, band, axis) {
    if (!band) return [];
    const { start, end } = band;
    const bLen = end - start;   // band thickness (perpendicular to seam)
    if (bLen <= 0) return [];
    const windows = [];

    if (axis === 'x') {
        // Tile along y (seam direction) at ~WINDOW_TARGET, along x if bLen > 4096.
        const nSeam  = Math.max(1, Math.ceil(h    / WINDOW_TARGET));
        const nPerp  = Math.max(1, Math.ceil(bLen / 4096));
        const yStep  = Math.ceil(h    / nSeam);
        const xStep  = Math.ceil(bLen / nPerp);
        for (let kx = 0; kx < nPerp; kx++) {
            const relL = kx * xStep;
            const ww   = Math.min(xStep, bLen - relL);
            if (ww <= 0) continue;
            for (let ky = 0; ky < nSeam; ky++) {
                const top  = ky * yStep;
                const wh   = Math.min(yStep, h - top);
                if (wh <= 0) continue;
                windows.push({ rect: { left: start + relL, top, width: ww, height: wh }, axis });
            }
        }
    } else {
        // Tile along x (seam direction) at ~WINDOW_TARGET, along y if bLen > 4096.
        const nSeam  = Math.max(1, Math.ceil(w    / WINDOW_TARGET));
        const nPerp  = Math.max(1, Math.ceil(bLen / 4096));
        const xStep  = Math.ceil(w    / nSeam);
        const yStep  = Math.ceil(bLen / nPerp);
        for (let ky = 0; ky < nPerp; ky++) {
            const relT = ky * yStep;
            const wh   = Math.min(yStep, bLen - relT);
            if (wh <= 0) continue;
            for (let kx = 0; kx < nSeam; kx++) {
                const left = kx * xStep;
                const ww   = Math.min(xStep, w - left);
                if (ww <= 0) continue;
                windows.push({ rect: { left, top: start + relT, width: ww, height: wh }, axis });
            }
        }
    }
    return windows;
}

// ── Feathered mask ────────────────────────────────────────────────────────────

/**
 * Build a 1-channel (greyscale) mask buffer for paste compositing.
 * Full white (255) in the center; ramps to 0 at the band-perpendicular edges
 * (inward feather only — band-parallel edges that are seam-internal stay white).
 *
 * axis 'x': feather at left and right edges of the window cut (band boundaries).
 * axis 'y': feather at top and bottom edges.
 *
 * The ramp is linear: 0 at the edge pixel, 255 at feather_px inward.
 */
function makeMaskBuffer(ww, wh, axis) {
    const buf = Buffer.allocUnsafe(ww * wh);
    const fp  = Math.max(1, Math.min(FEATHER_PX,
        axis === 'x' ? Math.floor(ww / 4) : Math.floor(wh / 4)));

    for (let y = 0; y < wh; y++) {
        for (let x = 0; x < ww; x++) {
            let alpha;
            if (axis === 'x') {
                const d = Math.min(x, ww - 1 - x);
                alpha = d >= fp ? 255 : Math.round(255 * d / fp);
            } else {
                const d = Math.min(y, wh - 1 - y);
                alpha = d >= fp ? 255 : Math.round(255 * d / fp);
            }
            buf[y * ww + x] = alpha;
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

    // Roll and store as working copy.
    const workPath = path.join(runDir, 'working.png');
    await rollImage(flatPath, dx, dy, workPath);
    await fs.remove(flatPath);

    // Band ranges in the rolled image's coordinate space.
    // x-band: lo = left handle (leading edge), hi = right handle (trailing edge).
    // y-band: lo = top handle, hi = bottom handle.
    const bandX = hasX ? bandRange(w, hL, hR) : null;
    const bandY = hasY ? bandRange(h, hT, hB) : null;

    // Window plan.
    const wins = [
        ...planAxis(w, h, bandX, 'x'),
        ...planAxis(w, h, bandY, 'y'),
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

    const { rect, axis } = win;
    const workPath = path.join(runDir, 'working.png');

    // Cut image (sharp fixed order: extract → materialise → PNG).
    const imgPath = path.join(runDir, `win_${i}_img.png`);
    await sharp(workPath, INPUT)
        .extract(rect)
        .png()
        .toFile(imgPath);

    // Mask: the full window is within the band, feathered at band-perpendicular edges.
    const maskBuf  = makeMaskBuffer(rect.width, rect.height, axis);
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

    // Build feathered alpha mask buffer.
    const maskBuf = makeMaskBuffer(rect.width, rect.height, axis);

    // Materialise result as 3-channel raw at the window's exact size.
    // Trap 1: flatten(), not removeAlpha(), before joinChannel on the next pipeline.
    const { data: rgbData, info: rgbInfo } = await sharp(resultPath, INPUT)
        .resize(rect.width, rect.height, { fit: 'fill' })
        .flatten({ background: '#000000' })
        .raw()
        .toBuffer({ resolveWithObject: true });

    // Join the feathered alpha channel.
    const overlay = await sharp(rgbData, { raw: rgbInfo, limitInputPixels: false })
        .joinChannel(maskBuf, { raw: { width: rect.width, height: rect.height, channels: 1 } })
        .png()
        .toBuffer();

    // Composite onto working copy, write to a temp file then replace.
    const tmpPath = workPath + '.tmp';
    await sharp(workPath, INPUT)
        .composite([{
            input: overlay,
            limitInputPixels: false,
            left:  rect.left,
            top:   rect.top,
            blend: 'over',
        }])
        .png()
        .toFile(tmpPath);

    await fs.move(tmpPath, workPath, { overwrite: true });
}

/**
 * Roll the working copy back to the original orientation and write to outPath.
 * Rolling right by dx then right by (w - dx) = rolling right by w = identity.
 */
async function finish(runId, outPath) {
    const runDir = runDirOf(runId);
    const state  = await fs.readJson(path.join(runDir, 'state.json'));
    const { width: w, height: h, dx, dy } = state;
    const workPath = path.join(runDir, 'working.png');

    const undoDx = dx > 0 ? w - dx : 0;
    const undoDy = dy > 0 ? h - dy : 0;
    await rollImage(workPath, undoDx, undoDy, outPath);
    return outPath;
}

module.exports = {
    // Public API
    prepare, windowCut, paste, finish, sweepScratch, runDirOf,
    // Exported for tests
    bandRange, planAxis, rollImage, lightenFlatten, makeMaskBuffer,
};
