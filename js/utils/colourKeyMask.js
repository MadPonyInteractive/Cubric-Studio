/**
 * colourKeyMask — mask by colour (MPI-771, plan Decision 15). A pixel whose RGB
 * sits within `tolerance` of the key colour is keyed OUT; everything else is
 * kept. Same polarity as a SAM3 / BiRefNet mask (white = keep), so the result
 * drops into the GIF cut-out's track layer and the image mask tools' detect
 * layer unchanged — Mask Adjust, Invert and the brush all apply to it.
 *
 * Distance is the largest per-channel difference (Photoshop's magic wand
 * tolerance, 0-255). A pixel that is already fully transparent is keyed out too.
 *
 * `edgesOnly` keys out only matching pixels CONNECTED to the frame border
 * (4-neighbour flood fill): the background goes, a same-coloured patch enclosed
 * by the subject stays. Off, every matching pixel goes, which also clears the
 * enclosed background pockets (between an arm and a body).
 *
 * No GPU and no engine: pure JS over RGBA bytes. `colourKeyMaskUrl()` is the
 * browser wrapper both consumers call. The image mask tools want the opposite
 * polarity (select the colour, like a magic wand): `selectMatching`.
 */

export const COLOUR_KEY_DEFAULTS = Object.freeze({ tolerance: 16, edgesOnly: false });

/**
 * @param {Uint8ClampedArray|Uint8Array|Buffer} rgba
 * @param {number} width
 * @param {number} height
 * @param {{ key: number[], tolerance?: number, edgesOnly?: boolean, selectMatching?: boolean }} opts
 * @returns {Uint8Array} one byte per pixel, 255 = keep, 0 = keyed out
 *          (`selectMatching`: 255 = the keyed pixels instead)
 */
export function colourKeyMask(rgba, width, height, { key, tolerance = COLOUR_KEY_DEFAULTS.tolerance, edgesOnly = false, selectMatching = false } = {}) {
    const mask = keepMask(rgba, width, height, key, tolerance, edgesOnly);
    if (selectMatching) for (let i = 0; i < mask.length; i++) mask[i] = 255 - mask[i];
    return mask;
}

function keepMask(rgba, width, height, key, tolerance, edgesOnly) {
    const n = width * height;
    const [kr, kg, kb] = key;
    const tol = Math.max(0, Math.min(255, Number(tolerance) || 0));
    const matches = new Uint8Array(n);
    for (let i = 0, p = 0; i < n; i++, p += 4) {
        matches[i] = rgba[p + 3] === 0 || (
            Math.abs(rgba[p] - kr) <= tol
            && Math.abs(rgba[p + 1] - kg) <= tol
            && Math.abs(rgba[p + 2] - kb) <= tol
        ) ? 1 : 0;
    }

    const mask = new Uint8Array(n).fill(255);
    if (!edgesOnly) {
        for (let i = 0; i < n; i++) if (matches[i]) mask[i] = 0;
        return mask;
    }

    const stack = new Int32Array(n);
    let top = 0;
    const seed = (i) => { if (matches[i] && mask[i]) { mask[i] = 0; stack[top++] = i; } };
    for (let x = 0; x < width; x++) { seed(x); seed((height - 1) * width + x); }
    for (let y = 0; y < height; y++) { seed(y * width); seed(y * width + width - 1); }
    while (top) {
        const i = stack[--top];
        const x = i % width;
        if (x > 0) seed(i - 1);
        if (x < width - 1) seed(i + 1);
        if (i >= width) seed(i - width);
        if (i < n - width) seed(i + width);
    }
    return mask;
}

/**
 * The default key: the top-left pixel — but only when it is really on screen.
 * A frame that was already cut out has a TRANSPARENT corner whose RGB is
 * whatever the old mask hid (a 320x320 cut of Fabio's robot reads `#c8c6c8`
 * at alpha 0), so keying it removes a colour nobody can see and quietly eats
 * the subject's dark outline at any tolerance. No opaque corner -> no default,
 * and the caller asks for a Pick instead.
 * @returns {string|null} `#rrggbb`, or null when the corner is transparent
 */
export function cornerColour(rgba) {
    if (rgba[3] === 0) return null;
    return '#' + [rgba[0], rgba[1], rgba[2]].map(v => v.toString(16).padStart(2, '0')).join('');
}

/** `#rrggbb` -> [r, g, b] */
export function hexToRgb(hex) {
    const v = parseInt(String(hex).replace('#', ''), 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

/** Decode an image URL to RGBA pixels (browser only). */
export async function readImagePixels(url) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error(`could not load ${url}`));
        img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    return { width: canvas.width, height: canvas.height, data: ctx.getImageData(0, 0, canvas.width, canvas.height).data };
}

/**
 * Browser wrapper: key one image and return the mask as an opaque B/W PNG data
 * URL (white = keep) — the shape engine masks arrive in.
 * @param {string} url
 * @param {{ colour?: string|null, tolerance?: number, edgesOnly?: boolean, selectMatching?: boolean }} opts
 *        `colour` null = the image's own top-left pixel; throws when that pixel
 *        is transparent, so nothing is keyed against a colour nobody can see
 * @returns {Promise<{ url: string, colour: string }>}
 */
export async function colourKeyMaskUrl(url, { colour = null, tolerance, edgesOnly, selectMatching } = {}) {
    const { width, height, data } = await readImagePixels(url);
    const hex = colour || cornerColour(data);
    if (!hex) throw new Error('no key colour: this frame\'s corner is transparent — pick one');
    const mask = colourKeyMask(data, width, height, { key: hexToRgb(hex), tolerance, edgesOnly, selectMatching });
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    const out = ctx.createImageData(width, height);
    for (let i = 0, p = 0; i < mask.length; i++, p += 4) {
        out.data[p] = out.data[p + 1] = out.data[p + 2] = mask[i];
        out.data[p + 3] = 255;
    }
    ctx.putImageData(out, 0, 0);
    return { url: canvas.toDataURL('image/png'), colour: hex };
}
