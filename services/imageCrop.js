/**
 * imageCrop.js — crop an image to a rect that may fall OUTSIDE it (MPI-383).
 *
 * Sharp's `.extract` throws on an out-of-bounds rect, so the crop is split in
 * two: extract the part of the rect that lies ON the image, then extend it by
 * the overhang with the fill colour. Sharp applies extend after extract (and
 * after resize) whatever the call order — exactly the order wanted, so it is
 * ONE pipeline with no intermediate image (MPI-990). RESOLUTION-family crops
 * resample the in-bounds part and pad by the overhang in output pixels.
 *
 * Used by POST /project/crop-media and POST /gif/crop.
 */

const sharp = require('sharp');
// Every input passes limitInputPixels: false: photographers load 16K images (268 MP),
// past sharp's default limit, and the limit fires on metadata() too (MPI-925).
// autoOrient: the crop rect is in the pixels the canvas SHOWS, and Chromium honours EXIF
// orientation; sharp reads the stored grid unless told to (MPI-959).
const INPUT = { limitInputPixels: false, autoOrient: true };

const HEX_RE = /^#?([a-f0-9]{6})$/i;

/**
 * Parse '#rrggbb' (or an {r,g,b} object) into a Sharp background.
 * Anything unparseable falls back to opaque black — the fill is cosmetic and
 * must never fail a crop.
 */
function parseFill(value) {
    if (value && typeof value === 'object') {
        const clamp = (n) => Math.max(0, Math.min(255, Math.round(Number(n) || 0)));
        return { r: clamp(value.r), g: clamp(value.g), b: clamp(value.b), alpha: 1 };
    }
    const match = String(value || '').trim().match(HEX_RE);
    if (!match) return { r: 0, g: 0, b: 0, alpha: 1 };
    const hex = match[1].toLowerCase();
    return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
        alpha: 1,
    };
}

/**
 * Where the image span [a, b) of a `size`-long rect edge lands in an `out`-long
 * output: [padBefore, padAfter]. Exact when out === size; rounded when resampling,
 * but never below 1px, so a sliver of image cannot vanish into the fill.
 */
function scaleSpan(a, b, size, out) {
    let lo = Math.round(a * out / size);
    let hi = Math.round(b * out / size);
    if (hi <= lo) {
        if (hi < out) hi = lo + 1;
        else lo = hi - 1;
    }
    return [lo, out - hi];
}

/**
 * Split a (possibly out-of-bounds) crop rect into the part ON the image and
 * the fill around it. Pure maths — no Sharp, no IO.
 *
 * - `extract`: the rect ∩ image in SOURCE pixels, or null when they do not meet
 *   (the output is then all fill).
 * - `resize`: the size the extract resamples to (RESOLUTION family), or null.
 * - `extend`: the fill per side, in OUTPUT pixels — sharp extends after resize.
 * - `width`/`height`: the output size.
 *
 * @param {{srcW:number,srcH:number,x:number,y:number,w:number,h:number,outW?:number,outH?:number}} r
 */
function planExtendedCrop({ srcW, srcH, x, y, w, h, outW, outH }) {
    const resample = outW > 0 && outH > 0 && (outW !== w || outH !== h);
    const width = resample ? outW : w;
    const height = resample ? outH : h;

    const x0 = Math.max(0, x);
    const y0 = Math.max(0, y);
    const x1 = Math.min(srcW, x + w);
    const y1 = Math.min(srcH, y + h);
    if (x1 <= x0 || y1 <= y0) {
        return { extract: null, resize: null, extend: null, extends: false, width, height };
    }

    const [left, right] = scaleSpan(x0 - x, x1 - x, w, width);
    const [top, bottom] = scaleSpan(y0 - y, y1 - y, h, height);
    return {
        extract: { left: x0, top: y0, width: x1 - x0, height: y1 - y0 },
        resize: resample ? { width: width - left - right, height: height - top - bottom } : null,
        extend: { top, bottom, left, right },
        extends: (top + bottom + left + right) > 0,
        width,
        height,
    };
}

/**
 * The sharp pipeline for a plan, on `source` (a sharp instance of the image).
 * One pipeline, no intermediate: extract, resample, then pad. A rect that
 * misses the image is a solid fill with `channels` channels.
 */
function cropPipeline(source, plan, fill, channels = 3) {
    const background = parseFill(fill);
    if (!plan.extract) {
        return sharp({ create: { width: plan.width, height: plan.height, channels, background } });
    }
    let pipeline = source.extract(plan.extract);
    if (plan.resize) pipeline = pipeline.resize(plan.resize.width, plan.resize.height, { fit: 'fill' });
    if (plan.extends) pipeline = pipeline.extend({ ...plan.extend, background });
    return pipeline;
}

/**
 * Crop `inputPath` to the rect and write `outPath`.
 *
 * @param {string} inputPath
 * @param {string} outPath
 * @param {object} opts
 * @param {number} opts.x - rect origin, may be negative
 * @param {number} opts.y
 * @param {number} opts.w
 * @param {number} opts.h
 * @param {string|object} [opts.fill] - colour for pixels outside the source
 * @param {number|null} [opts.outW] - resample target (RESOLUTION family only)
 * @param {number|null} [opts.outH]
 * @returns {Promise<{width:number,height:number}>} written pixel size
 */
async function cropExtended(inputPath, outPath, { x, y, w, h, fill, outW, outH }) {
    const { autoOrient: upright, hasAlpha } = await sharp(inputPath, INPUT).metadata();
    const plan = planExtendedCrop({
        srcW: upright.width,
        srcH: upright.height,
        x: Math.round(x),
        y: Math.round(y),
        w: Math.round(w),
        h: Math.round(h),
        outW: Math.round(outW),
        outH: Math.round(outH),
    });

    await cropPipeline(sharp(inputPath, INPUT), plan, fill, hasAlpha ? 4 : 3).toFile(outPath);
    return { width: plan.width, height: plan.height };
}

module.exports = { cropExtended, cropPipeline, planExtendedCrop, parseFill };
