/**
 * maskUtils.js — Utility functions for mask operations.
 *
 * Provides reusable functions for checking mask content and state
 * across mask-related components and tools.
 */

/**
 * Flatten a layer to a flat-coloured STENCIL of its shape: alpha at or above
 * `alphaT` becomes `color` at full alpha, everything else transparent (MPI-439).
 *
 * The cut is the ≥128 one the whole canvas-tool family reads a shape by
 * (`docs/masking-adjust.md` § The paint layer) — alpha, never luminance, so a dark
 * scribble converts as readily as a light one. The result is deliberately BINARY:
 * the caller scales it into the destination afterwards, so the resampling supplies
 * a smooth edge without a soft mask feather surviving as soft paint.
 *
 * @param {HTMLCanvasElement} src
 * @param {string} color CSS colour for the stencil
 * @param {number} [alphaT]
 * @returns {HTMLCanvasElement|null} src-sized stencil, or null when nothing reaches `alphaT`
 */
export function alphaStencil(src, color, alphaT = 128) {
    if (!src?.width || !src?.height) return null;
    const w = src.width;
    const h = src.height;

    const out = document.createElement('canvas');
    out.width = w;
    out.height = h;
    const ctx = out.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(src, 0, 0);

    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    let any = false;
    for (let i = 3; i < d.length; i += 4) {
        if (d[i] >= alphaT) { d[i] = 255; any = true; } else d[i] = 0;
    }
    if (!any) return null;

    ctx.putImageData(img, 0, 0);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, w, h);
    return out;
}

/**
 * Checks if a mask canvas contains any painted content (non-transparent pixels).
 *
 * @param {HTMLCanvasElement} maskCanvas - The mask canvas element to check
 * @returns {boolean} - True if mask has painted content, false if empty
 */
export function hasMaskContent(maskCanvas) {
    if (!maskCanvas || !maskCanvas.width || !maskCanvas.height) {
        return false;
    }

    try {
        const ctx = maskCanvas.getContext('2d', { willReadFrequently: true });
        const imageData = ctx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
        const data = imageData.data;

        // Check for any non-transparent pixels (alpha > 0)
        for (let i = 3; i < data.length; i += 4) {
            if (data[i] > 0) {
                return true;
            }
        }

        return false;
    } catch (err) {
        console.warn('[maskUtils] hasMaskContent check failed:', err);
        return false;
    }
}

/**
 * The object's ORIGINAL pixels wearing the composited alpha.
 *
 * `alpha = (bgMask OR manual) AND NOT subtract` — the one place the two layers
 * meet. It runs at dispatch and at draw time from the SAME function so the canvas
 * cannot show something the run will not receive, and it runs in `MpiStepPlace`
 * too, which composes its preview from THIS step's reported value.
 *
 * RGB always comes from `rgb`, never from `bgMask`: a Restore stroke has to
 * reveal real pixels, and a cut-out PNG's colour under alpha 0 is encoder-
 * dependent (memory `tools/image-alpha-flatten.md`).
 *
 * @param {CanvasImageSource} rgb the object as the user supplied it
 * @param {CanvasImageSource|null} bgMask the cut-out, read for its ALPHA only; null
 *   means Remove Background is off, and the base alpha is the whole rectangle
 * @param {CanvasImageSource|null} manual white where the user restored
 * @param {CanvasImageSource|null} subtract white where the user erased
 * @param {number} w object px
 * @param {number} h object px
 * @returns {HTMLCanvasElement}
 */
export function composeObjectAlpha(rgb, bgMask, manual, subtract, w, h) {
    const stencil = document.createElement('canvas');
    stencil.width = w;
    stencil.height = h;
    const sc = stencil.getContext('2d');
    if (bgMask) sc.drawImage(bgMask, 0, 0, w, h);
    else {
        // Any opaque colour: only the alpha channel of this canvas is ever read.
        sc.fillStyle = 'rgba(255, 255, 255, 1)';
        sc.fillRect(0, 0, w, h);
    }
    // Restore adds alpha, erase removes it — and erase runs LAST so a pixel the
    // user rubbed out stays out whether the cut-out or a restore stroke put it there.
    if (manual) sc.drawImage(manual, 0, 0, w, h);
    if (subtract) {
        sc.globalCompositeOperation = 'destination-out';
        sc.drawImage(subtract, 0, 0, w, h);
        sc.globalCompositeOperation = 'source-over';
    }

    const out = document.createElement('canvas');
    out.width = w;
    out.height = h;
    const oc = out.getContext('2d');
    oc.drawImage(rgb, 0, 0, w, h);
    oc.globalCompositeOperation = 'destination-in';
    oc.drawImage(stencil, 0, 0, w, h);
    return out;
}

/**
 * The other half of a greyscale mask (MPI-859). BiRefNet returns the foreground
 * while the Background chip proposes the background, and `getCutMasks()` uses the
 * same flip once at the boundary - the GIF store holds WHAT GETS CUT, and
 * `routes/gifCutout.js` reads a mask as alpha, i.e. what stays.
 *
 * @param {string} url
 * @returns {Promise<string>}
 */
export async function invertMaskUrl(url) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = url;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.filter = 'invert(1)';
    ctx.drawImage(img, 0, 0);
    return canvas.toDataURL('image/png');
}
