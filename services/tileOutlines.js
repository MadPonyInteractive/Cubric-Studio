'use strict';

/**
 * services/tileOutlines.js — Use Tiles' "Describe each tile" pictures (MPI-1232 Phase 3).
 *
 * One copy of the whole picture per tile, the tile outlined in red, at the describer's ~1 MP:
 * bench method 8 (tasks/MPI-1232) asks "ignoring any people, name what fills that area", and
 * the describer reads the area better with the whole scene around it than from a bare crop.
 *
 * Copies live in os.tmpdir()/cubric-tile-outlines/<runId>/, swept after 24 h like
 * cubric-seamless: they are read once by the describer and never become cards.
 */

const os    = require('os');
const path  = require('path');
const fs    = require('fs-extra');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');

// libvips holds inputs open on Windows otherwise (EBUSY on the sweep).
sharp.cache({ files: 0 });

const SCRATCH_BASE = path.join(os.tmpdir(), 'cubric-tile-outlines');
const KEEP_MS      = 24 * 60 * 60 * 1000;
const TARGET_PX    = 1024 * 1024;   // what image_descriptor.json's ScaleToTotalPixels feeds the describer
const STROKE_FRAC  = 0.003;         // outline width, of the long side (4 px at the bench's 1344)

/** Remove run directories older than KEEP_MS. Best-effort, never throws. */
async function sweepScratch(now = Date.now()) {
    const entries = await fs.readdir(SCRATCH_BASE).catch(() => []);
    for (const name of entries) {
        const dir = path.join(SCRATCH_BASE, name);
        const stat = await fs.stat(dir).catch(() => null);
        if (stat?.isDirectory() && now - stat.mtimeMs > KEEP_MS) await fs.remove(dir).catch(() => {});
    }
}

/**
 * @param {string} imagePath  absolute path of the picture
 * @param {Array<{x1:number,y1:number,x2:number,y2:number}>} rects  in FRACTIONS (0..1) of the picture
 * @returns {Promise<string[]>}  one outlined copy per rect, same order
 */
async function outlineTiles(imagePath, rects) {
    await fs.ensureDir(SCRATCH_BASE);
    sweepScratch().catch(() => {});
    const dir = path.join(SCRATCH_BASE, uuidv4());
    await fs.ensureDir(dir);

    // Upright, like the engine and the describer route see it (autoOrient); never enlarged.
    const meta = await sharp(imagePath, { limitInputPixels: false, autoOrient: true }).metadata();
    const [w0, h0] = (meta.orientation || 1) >= 5 ? [meta.height, meta.width] : [meta.width, meta.height];
    const scale = Math.min(1, Math.sqrt(TARGET_PX / (w0 * h0)));
    const w = Math.max(1, Math.round(w0 * scale));
    const h = Math.max(1, Math.round(h0 * scale));
    const base = await sharp(imagePath, { limitInputPixels: false, autoOrient: true })
        .resize(w, h).removeAlpha().toBuffer();
    const stroke = Math.max(2, Math.round(STROKE_FRAC * Math.max(w, h)));

    const out = [];
    for (const [i, r] of rects.entries()) {
        const x = Math.round(r.x1 * w), y = Math.round(r.y1 * h);
        const rw = Math.max(1, Math.round(r.x2 * w) - x), rh = Math.max(1, Math.round(r.y2 * h) - y);
        // The stroke sits inside the tile so an edge tile's outline is not cut off by the frame.
        const half = stroke / 2;
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">`
            + `<rect x="${x + half}" y="${y + half}" width="${Math.max(1, rw - stroke)}" height="${Math.max(1, rh - stroke)}"`
            + ` fill="none" stroke="#ff0000" stroke-width="${stroke}"/></svg>`;
        const file = path.join(dir, `tile_${String(i).padStart(3, '0')}.jpg`);
        await sharp(base).composite([{ input: Buffer.from(svg) }]).jpeg({ quality: 90 }).toFile(file);
        out.push(file);
    }
    return out;
}

module.exports = { outlineTiles, sweepScratch };
