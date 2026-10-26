'use strict';

/**
 * routes/imageSheet.js — MPI-1094: POST /combine-images — gallery Combine on 2+ stills packs
 * them into ONE image card (a character or clothes sheet, a mood board).
 *
 * The arrangement is the dialog's (`MpiImageSheet`): it packs with `js/utils/sheetLayout.js`
 * and sends the tree it previewed, so the sheet is the one the user framed. This route only
 * re-measures each picture (upright, `autoOrient`) and renders that tree at the chosen size.
 * With NO tree (Cosmo and MCP `make_sheet`, MPI-1099, over the `sheet.make` job) it packs
 * here with the same `packSheet`, every picture framed on its centre.
 *
 * Body: {
 *   folderPath, itemIds[],          // itemIds in the dialog's order: tree ids index into it
 *   tree?,                          // sheetLayout `{id}` / `{kind,a,b}`, every index once
 *   shape?,                         // a SHEET_SHAPES value ('auto', the default = the tree's own
 *                                   // shape) or any "w:h" label (sheetShapeRatio, MPI-1268)
 *   longEdge?,                      // one of SHEET_SIZES, default the smallest
 *   frames[],                       // per picture { zoom, cx, cy } (sheetLayout.frameRect)
 *   numbered?,                      // MPI-1268, a stack's Create Sheet: each picture numbered
 *                                   // top-left, 1 = itemIds[0]; with no tree, packed in rows
 *   whole?                          // MPI-1268: every picture uncropped in an even grid
 *                                   // (sheetLayout.gridSheet); tree and frames are ignored
 * }
 * Response: { success, item } — the raw-descriptor shape `/gif/make` and `/combine-videos`
 * return; the client builds the ItemGroup and `addGroup()` owns the project.json write.
 *
 * Every cell is filled (cover + the user's framing), so the only background left is the
 * black gutter. A sheet above 4096 px is written as JPEG: a 16K PNG of photos is hundreds of
 * MB and takes a minute to compress.
 */

const express = require('express');
const router = express.Router();
const fs = require('fs-extra');
const path = require('path');
const { diskPathOf, projectFileUrlBusted } = require('../services/projectFileUrl');
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');
const logger = require('./logger');
const { nextSequence, writeImageRenditions } = require('./projects');
const { isEligibleStillImage } = require('./gifMake');
const {
    SHEET_SIZES, isValidTree, packSheet, sheetPixelSize, sheetGutter, placeSheet, frameRect, autoRatio, sheetBadge,
    gridSheet, placeGrid, containRect, sheetShapeRatio,
} = require('../js/utils/sheetLayout.js');

const GREY = { r: 128, g: 128, b: 128 };   // under a transparent picture's see-through parts
const PNG_MAX_EDGE = 4096;

/** The tree's own shape from real aspects, as `sheetLayout.packSheet` measures it. */
function _treeRatio(t, aspects) {
    if (t.kind === undefined) return aspects[t.id];
    const a = _treeRatio(t.a, aspects);
    const b = _treeRatio(t.b, aspects);
    return t.kind === 'H' ? a + b : 1 / (1 / a + 1 / b);
}

/** A numbered sheet's badge (MPI-1268): white number on black, the gutter's colour. */
function _badge(cell, n) {
    const b = sheetBadge(cell, n);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${b.w}" height="${b.h}">`
        + `<rect width="${b.w}" height="${b.h}" rx="${Math.round(b.h * 0.22)}" fill="black"/>`
        + `<text x="${b.w / 2}" y="${Math.round(b.h / 2 + b.font * 0.36)}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="${b.font}" fill="white">${n}</text>`
        + '</svg>';
    return { input: Buffer.from(svg), left: b.x, top: b.y };
}

/**
 * Render the sheet. Pictures are decoded one at a time: nine 16K photos at once would not
 * fit a 16 GB machine (the same rule as routes/ingredientsSheet.js).
 * @param {string[]} sources - absolute paths, in tree-id order
 * @param {{tree?: object, shape: string, longEdge: number, frames?: object[], numbered?: boolean,
 *   whole?: boolean}} opts - no tree = pack here; `whole` = the uncropped grid (`gridSheet`), tree
 *   and frames unused
 * @returns {Promise<{sharp: object, width: number, height: number}>}
 */
async function renderSheet(sources, { tree: given, shape, longEdge, frames = [], numbered = false, whole = false }) {
    const dims = [];
    for (const abs of sources) {
        const { width, height } = (await sharp(abs, { limitInputPixels: false, autoOrient: true }).metadata()).autoOrient;
        dims.push({ width, height });
    }
    const aspects = dims.map(d => d.width / d.height);
    const fixed = sheetShapeRatio(shape);
    let width, height, cells;
    if (whole) {
        const { grid, r } = gridSheet(aspects, { shape: fixed || null });
        ({ width, height } = sheetPixelSize(r, longEdge));
        cells = placeGrid(grid, sources.length, width, height, sheetGutter(width, height))
            .map((c, i) => containRect(aspects[i], c));
    } else {
        const tree = given || packSheet(aspects, { shape: fixed || null, ordered: numbered }).tree;
        ({ width, height } = sheetPixelSize(fixed || autoRatio(_treeRatio(tree, aspects)), longEdge));
        cells = placeSheet(tree, aspects, width, height, sheetGutter(width, height));
    }

    const parts = [];
    for (const [i, abs] of sources.entries()) {
        const c = cells[i];
        const { width: W, height: H } = dims[i];
        const f = whole ? { x: 0, y: 0, w: 1, h: 1 } : frameRect(aspects[i], c.w / c.h, frames[i] || {});
        const left = Math.min(W - 1, Math.round(f.x * W));
        const top = Math.min(H - 1, Math.round(f.y * H));
        const part = await sharp(abs, { limitInputPixels: false, autoOrient: true })
            .extract({
                left,
                top,
                width: Math.max(1, Math.min(W - left, Math.round(f.w * W))),
                height: Math.max(1, Math.min(H - top, Math.round(f.h * H))),
            })
            .resize(c.w, c.h, { fit: 'fill' })
            .flatten({ background: GREY })
            .raw()
            .toBuffer({ resolveWithObject: true });
        parts.push({
            input: part.data,
            raw: { width: part.info.width, height: part.info.height, channels: part.info.channels },
            limitInputPixels: false,
            left: c.x,
            top: c.y,
        });
    }
    if (numbered) cells.forEach((c, i) => parts.push(_badge(c, i + 1)));
    const img = sharp({ create: { width, height, channels: 3, background: { r: 0, g: 0, b: 0 } }, limitInputPixels: false })
        .composite(parts);
    return { sharp: img, width, height };
}

router.post('/combine-images', async (req, res) => {
    let outputPath = '';
    try {
        const { folderPath, itemIds, tree, shape = 'auto', longEdge = SHEET_SIZES[0], frames, numbered, whole } = req.body || {};
        if (!folderPath) return res.status(400).json({ success: false, error: 'folderPath required' });
        if (!Array.isArray(itemIds) || itemIds.length < 2) {
            return res.status(400).json({ success: false, error: 'itemIds[] with >=2 entries required' });
        }
        if (tree !== undefined && !isValidTree(tree, itemIds.length)) {
            return res.status(400).json({ success: false, error: 'tree must place every picture exactly once' });
        }
        if (!SHEET_SIZES.includes(longEdge)) {
            return res.status(400).json({ success: false, error: `longEdge must be one of ${SHEET_SIZES.join(', ')}` });
        }
        if (sheetShapeRatio(shape) === undefined) {
            return res.status(400).json({ success: false, error: `unknown shape: ${shape}` });
        }

        const mediaDir = path.join(folderPath, 'Media');
        const metaDir = path.join(mediaDir, '.meta');
        const sources = [];
        for (const id of itemIds) {
            const metaPath = path.join(metaDir, `${id}.json`);
            if (!(await fs.pathExists(metaPath))) {
                return res.status(404).json({ success: false, error: `sidecar not found: ${id}` });
            }
            const sidecar = await fs.readJson(metaPath);
            if (!isEligibleStillImage(sidecar)) {
                return res.status(400).json({ success: false, error: `item ${id} is not an eligible still image` });
            }
            const abs = diskPathOf(sidecar.filePath);
            if (!abs || !(await fs.pathExists(abs))) {
                return res.status(404).json({ success: false, error: `source file missing for item ${id}` });
            }
            sources.push(abs);
        }

        const { sharp: sheet, width, height } = await renderSheet(sources, {
            tree, shape, longEdge, frames: Array.isArray(frames) ? frames : [], numbered: numbered === true, whole: whole === true,
        });
        const ext = longEdge > PNG_MAX_EDGE ? 'jpg' : 'png';
        const finalName = await nextSequence(folderPath, mediaDir, 'sheet', ext);
        outputPath = path.join(mediaDir, finalName);
        await (ext === 'png' ? sheet.png() : sheet.jpeg({ quality: 95 })).toFile(outputPath);

        const id = uuidv4();
        const meta = {
            id,
            type: 'image',
            filePath: projectFileUrlBusted(outputPath),
            operation: 'combine-images',
            displayName: finalName.replace(/\.[^.]+$/, ''),
            prompt: '',
            negativePrompt: '',
            seed: -1,
            modelId: null,
            createdAt: new Date().toISOString(),
            name: null,
            uploaded: false,
            pixelDimensions: { w: width, h: height },
            generationMs: null,
        };
        await writeImageRenditions(outputPath, metaDir, id, meta, width);
        await fs.writeJson(path.join(metaDir, `${id}.json`), meta, { spaces: 2 });
        res.json({ success: true, item: { ...meta } });
    } catch (err) {
        logger.error('project', 'combine-images failed', err);
        if (outputPath) { try { await fs.remove(outputPath); } catch {} }
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
module.exports.renderSheet = renderSheet;
