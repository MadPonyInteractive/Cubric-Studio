/**
 * engineMask.js — a MASKED engine op on a photo over the engine cap (MPI-971 Phase 2).
 *
 * The canvas paints its mask at a working size of at most 4096 on the long edge and hands
 * it over at that size; the server fits it to the job, where sharp can hold a 32K:
 *
 * - An op whose graph crops around the mask and stitches back (`InpaintCropImproved` →
 *   sample → `InpaintStitchImproved`, or Detail's `MaskDetailerPipe`; the `cropsToMask`
 *   ops) gets the SOURCE CUT AROUND THE MASK, downscaled to the cap if the cut is still
 *   bigger. The graph discards everything outside its context window anyway, so the model
 *   sees what it always saw.
 *   The engine's result is then pasted back into the original through the mask
 *   (`stitchMaskCrop`), so the card stays the source's size and every pixel away from the
 *   mask stays the original's.
 * - Any other masked op gets the mask stretched to the source's size, which is what the
 *   canvas used to send.
 * - Remove Background (Phase 3) runs on the engine copy, and the matte it returns goes onto
 *   the ORIGINAL (`applyMatte`).
 *
 * Every input passes limitInputPixels: false (a 16K photo is 268 MP, past sharp's default)
 * and autoOrient: the canvas draws an EXIF-rotated photo upright, and so does MpiLoadImage
 * (`ImageOps.exif_transpose`), so every rect here is in UPRIGHT source px.
 */

const fs = require('fs-extra');
const sharp = require('sharp');

const FILE_INPUT = { limitInputPixels: false, autoOrient: true };
const BUFFER_INPUT = { limitInputPixels: false };

// Room kept round the mask's box, in source px each side: the larger of the two below. The
// inpaint graphs grow the mask by mask_expand + mask_blend (6 + 32 px, SDXL 0 + 16) and
// square the context window to the 1024^2 target on a 32 px grid; Detail's
// MaskDetailerPipe samples each masked area's box x crop_factor 1.8, i.e. 0.4 of the box
// past each side. A cut this much wider holds either window, so the engine meets the
// cut's edge only where it would have met the photo's.
// ponytail: a cut downscaled to the cap (a mask spanning most of a 32K) shrinks the
// fixed pad below the node's reach; the node then pads at the cut's edge, and the stitch
// below still keeps every pixel away from the mask the original's.
const CONTEXT_PAD = 128;
const CONTEXT_REACH = 0.45;
// How far past the mask the engine may have changed pixels, in ENGINE px: the node's
// expand + blend band plus slack for the square context's blur. The stitch takes the
// engine's pixels this far out, then feathers.
const BLEND_BAND = 48;

/** A mask (data URL or path) as a Buffer or path sharp can open. */
function maskSource(mask) {
    const m = /^data:[^,]*;base64,(.*)$/s.exec(String(mask || ''));
    return m ? Buffer.from(m[1], 'base64') : mask;
}

/** Upright pixel size of an image file. */
async function uprightSize(filePath) {
    const meta = await sharp(filePath, BUFFER_INPUT).metadata();
    const turned = meta.orientation >= 5;
    return { width: turned ? meta.height : meta.width, height: turned ? meta.width : meta.height };
}

/** The mask as one 8-bit channel at its own size; white = masked. */
async function readMask(mask) {
    const { data, info } = await sharp(maskSource(mask), BUFFER_INPUT)
        .flatten({ background: '#000000' })
        .greyscale()
        .toColourspace('b-w')
        .raw()
        .toBuffer({ resolveWithObject: true });
    return { data, width: info.width, height: info.height };
}

/** Inclusive box of the lit pixels (>= 128), or null when nothing is masked. */
function maskBox(data, width, height) {
    let x0 = width, y0 = height, x1 = -1, y1 = -1;
    for (let y = 0; y < height; y++) {
        const row = y * width;
        for (let x = 0; x < width; x++) {
            if (data[row + x] < 128) continue;
            if (x < x0) x0 = x;
            if (x > x1) x1 = x;
            if (y < y0) y0 = y;
            if (y > y1) y1 = y;
        }
    }
    return x1 < 0 ? null : { x0, y0, x1, y1 };
}

/**
 * Where to cut the source for the engine. Pure maths.
 *
 * A SQUARE round the box's centre (the node squares its context for the 1024^2 target),
 * each axis clamped to the photo and slid inside it, then scaled down to `cap` if still
 * bigger. `box` is in MASK px, the rect in upright SOURCE px.
 *
 * @returns {{left:number, top:number, width:number, height:number, outW:number, outH:number}}
 *   `outW`/`outH` the size the engine gets (the rect's own when it fits the cap)
 */
function planMaskCrop({ box, maskW, maskH, srcW, srcH, cap }) {
    const sx = srcW / maskW;
    const sy = srcH / maskH;
    const x0 = Math.floor(box.x0 * sx);
    const y0 = Math.floor(box.y0 * sy);
    const x1 = Math.min(srcW, Math.ceil((box.x1 + 1) * sx));
    const y1 = Math.min(srcH, Math.ceil((box.y1 + 1) * sy));
    const long = Math.max(x1 - x0, y1 - y0);
    const side = long + 2 * Math.max(CONTEXT_PAD, Math.ceil(CONTEXT_REACH * long));
    const span = (lo, hi, size) => {
        const len = Math.min(size, side);
        return [Math.max(0, Math.min(size - len, Math.round((lo + hi - len) / 2))), len];
    };
    const [left, width] = span(x0, x1, srcW);
    const [top, height] = span(y0, y1, srcH);
    const k = Math.min(1, cap / Math.max(width, height));
    return {
        left, top, width, height,
        outW: Math.max(1, Math.round(width * k)),
        outH: Math.max(1, Math.round(height * k)),
    };
}

/**
 * Fit a masked op's image + mask to what the engine can load.
 *
 * @param {object} o
 * @param {string} o.imagePath - the op's `Input_Image`, a file
 * @param {string} o.mask - the canvas mask: a data URL or a file path, any size
 * @param {boolean} o.crop - the op's graph crops round the mask and stitches back
 * @param {number} o.cap - the engine's long-edge cap
 * @param {(name: string) => string} o.outPath - where to write a named output
 * @returns {Promise<{image?: string, mask?: string, stitch?: object}>} paths written;
 *   empty when the photo is within the cap (the canvas mask is already its size) or,
 *   for a crop op, the mask is empty (the graph then runs as an unmasked edit)
 */
async function prepareMaskedInput({ imagePath, mask, crop, cap, outPath }) {
    const { width: srcW, height: srcH } = await uprightSize(imagePath);
    if (Math.max(srcW, srcH) <= cap) return {};

    if (!crop) {
        const maskOut = outPath('mask.png');
        await sharp(maskSource(mask), BUFFER_INPUT)
            .flatten({ background: '#000000' })
            .greyscale()
            .resize(srcW, srcH, { fit: 'fill', kernel: 'linear' })
            .toColourspace('b-w')
            .png()
            .toFile(maskOut);
        return { mask: maskOut };
    }

    const m = await readMask(mask);
    const box = maskBox(m.data, m.width, m.height);
    if (!box) return {};
    const rect = planMaskCrop({ box, maskW: m.width, maskH: m.height, srcW, srcH, cap });
    const { left, top, width, height, outW, outH } = rect;
    const scaled = outW !== width || outH !== height;

    const imageOut = outPath('crop.png');
    let cut = sharp(imagePath, FILE_INPUT).extract({ left, top, width, height });
    if (scaled) cut = cut.resize(outW, outH, { fit: 'fill' });
    await cut.png().toFile(imageOut);

    // The mask on the ENGINE's grid, then cut: stretched to the source scaled by the same
    // factor as the image, so both land at outW x outH (InpaintCropImproved asserts
    // mask == image). libvips is demand-driven, so a 32K-sized mask is never held — only
    // the tiles the extract asks for.
    const gridW = scaled ? Math.round(srcW * outW / width) : srcW;
    const gridH = scaled ? Math.round(srcH * outH / height) : srcH;
    const maskOut = outPath('mask.png');
    await sharp(m.data, { raw: { width: m.width, height: m.height, channels: 1 }, limitInputPixels: false })
        .resize(gridW, gridH, { fit: 'fill', kernel: 'linear' })
        .extract({
            left: Math.min(gridW - outW, Math.round(left * gridW / srcW)),
            top: Math.min(gridH - outH, Math.round(top * gridH / srcH)),
            width: outW,
            height: outH,
        })
        .toColourspace('b-w')
        .png()
        .toFile(maskOut);

    return { image: imageOut, mask: maskOut, stitch: { rect, mask: maskOut } };
}

/**
 * Paste the engine's result for a crop back into the full-size original.
 *
 * Through the crop's mask, grown past the node's own blend band and feathered: at 1:1 the
 * engine's pixels outside that band ARE the original's (the crop went in losslessly), so
 * this equals pasting the whole crop; when the crop was scaled down to fit the cap it is
 * what keeps the scaled-down pixels outside the mask out of the card.
 *
 * @param {object} o
 * @param {string} o.sourcePath - the original photo
 * @param {string} o.resultPath - the engine's output for the crop
 * @param {string} o.maskPath - the crop's mask, as `prepareMaskedInput` wrote it
 * @param {{left:number, top:number, width:number, height:number, outW:number}} o.rect
 * @param {string} o.outPath - PNG to write
 * @returns {Promise<{width: number, height: number}>} the written image's size
 */
async function stitchMaskCrop({ sourcePath, resultPath, maskPath, rect, outPath }) {
    const { left, top, width, height, outW, outH } = rect;
    const { width: srcW, height: srcH } = await uprightSize(sourcePath);
    if (left + width > srcW || top + height > srcH) throw new Error('The crop no longer fits the photo');

    // The overlay is built at the ENGINE's size (<= the cap, so small), and only then
    // stretched to the rect: a crop spanning a 32K is 4 GB of RGBA, never a JS buffer.
    // Each step is its own pipeline — sharp runs ops in a FIXED order, whatever order they
    // are chained in: a threshold chained after a blur ran BEFORE it, and a 3-band -> grey
    // conversion landed after both, which left the mask's middle at 123.
    const raw1 = { raw: { width: outW, height: outH, channels: 1 }, limitInputPixels: false };
    const blurred = await sharp(maskPath, BUFFER_INPUT)
        .greyscale()
        .resize(outW, outH, { fit: 'fill', kernel: 'linear' })
        .toColourspace('b-w')
        .raw()
        .toBuffer()
        // An edge blurred by sigma still reads >= 1/255 ~2.9 sigma out (minAmplitude keeps
        // the kernel that wide), so anything lit is inside the grown band.
        .then((m) => sharp(m, raw1).blur({ sigma: BLEND_BAND / 2.5, minAmplitude: 0.01 }).toColourspace('b-w').raw().toBuffer());
    for (let i = 0; i < blurred.length; i++) blurred[i] = blurred[i] ? 255 : 0;
    const alpha = await sharp(blurred, raw1).blur(2).toColourspace('b-w').raw().toBuffer();

    // Materialise the resize BEFORE joining the alpha — the same trap as
    // imageComposite.compositeThroughMask: joinChannel binds to the pre-resize image.
    const rgb = await sharp(resultPath, BUFFER_INPUT)
        .resize(outW, outH, { fit: 'fill' })
        .flatten({ background: '#000000' })
        .toColourspace('srgb')
        .raw()
        .toBuffer();
    const overlay = await sharp(rgb, { raw: { width: outW, height: outH, channels: 3 }, limitInputPixels: false })
        .joinChannel(alpha, raw1)
        .png()
        .toBuffer();

    // Stretched to the rect through libvips' own uncompressed format, which the composite
    // then streams; a no-op resize at 1:1.
    const stretched = `${outPath}.overlay.v`;
    try {
        await sharp(overlay, BUFFER_INPUT).resize(width, height, { fit: 'fill' }).toFile(stretched);
        await sharp(sourcePath, FILE_INPUT)
            .composite([{ input: stretched, left, top, limitInputPixels: false }])
            .png()
            .toFile(outPath);
    } finally {
        await fs.remove(stretched).catch(() => {});
    }
    return { width: srcW, height: srcH };
}

/**
 * Remove Background on a photo over the cap: the engine cut out the ENGINE copy, so the
 * alpha of its result is the matte at <= the cap. Stretched to the photo, it goes onto the
 * original's own pixels, or lays them over `color` — what the graph's JoinImageWithAlpha /
 * ImageCompositeMasked pair does at engine size — so the card is the photo's size and
 * every kept pixel is the original's.
 *
 * @param {object} o
 * @param {string} o.sourcePath - the original photo
 * @param {string} o.resultPath - the engine's RGBA cut-out of the engine copy
 * @param {number|null} o.color - 0xRRGGBB background, or null for transparent
 * @param {string} o.outPath - PNG to write
 * @returns {Promise<{width: number, height: number}>} the written image's size
 */
async function applyMatte({ sourcePath, resultPath, color, outPath }) {
    const { width, height } = await uprightSize(sourcePath);
    const { data, info } = await sharp(resultPath, BUFFER_INPUT).raw().toBuffer({ resolveWithObject: true });
    if (info.channels !== 4) throw new Error('The engine returned no cut-out');
    const alpha = Buffer.alloc(info.width * info.height);
    for (let i = 0; i < alpha.length; i++) alpha[i] = data[i * 4 + 3];

    // Every step its own pipeline, through libvips' uncompressed format: sharp runs ops in
    // a FIXED order, and a removeAlpha or flatten chained with joinChannel runs on the
    // wrong side of the join (the joined matte dropped, or never used).
    const tmp = (name) => `${outPath}.${name}.v`;
    try {
        await sharp(alpha, { raw: { width: info.width, height: info.height, channels: 1 }, limitInputPixels: false })
            .resize(width, height, { fit: 'fill' })
            .toColourspace('b-w')
            .toFile(tmp('matte'));
        await sharp(sourcePath, FILE_INPUT).removeAlpha().toColourspace('srgb').toFile(tmp('rgb'));
        const cut = sharp(tmp('rgb'), BUFFER_INPUT).joinChannel(tmp('matte'), BUFFER_INPUT);
        if (color == null) {
            await cut.png().toFile(outPath);
        } else {
            await cut.toFile(tmp('rgba'));
            const background = `#${(Number(color) & 0xffffff).toString(16).padStart(6, '0')}`;
            await sharp(tmp('rgba'), BUFFER_INPUT).flatten({ background }).png().toFile(outPath);
        }
    } finally {
        await Promise.all(['matte', 'rgb', 'rgba'].map((n) => fs.remove(tmp(n)).catch(() => {})));
    }
    return { width, height };
}

module.exports = { prepareMaskedInput, stitchMaskCrop, applyMatte, planMaskCrop, maskBox, uprightSize, CONTEXT_PAD, CONTEXT_REACH, BLEND_BAND };
