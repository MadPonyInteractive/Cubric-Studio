/**
 * maskCompose — commit one GIF frame's PROPOSED mask into the mask it already
 * has (MPI-859). The two writes `MaskManager.bakeAutoPicksInto()` makes on its
 * layer canvases, done on URLs instead, because a GIF's frames are headless: the
 * user is looking at one of sixty and the other fifty-nine have no canvas.
 *
 * A GIF mask is an OPAQUE GREYSCALE PNG — white = masked, black = not — which is
 * what `routes/gifCutout.js` reads as coverage. So `source-over` cannot union
 * two of them (it replaces), and the composite is per-channel instead:
 *
 *   add      max(base, candidate)         — `lighten`
 *   subtract min(base, 255 - candidate)   — `darken` over the inverted candidate
 *
 * Both preserve a SOFT edge, which matters as much here as it did in MPI-835:
 * the engine's feather is coverage, and a binary OR/AND would harden it into a
 * cut-out with a stair-stepped rim.
 */

/** @returns {Promise<HTMLImageElement>} */
function decode(url) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = url;
    return img.decode().then(() => img);
}

/**
 * An ALL-BLACK result is a real mask, not "no mask": it says the user composed
 * every pixel away and the frame cuts to nothing. NO mask means the user never
 * touched that frame, and `getCutMasks()` hands it a 1x1 WHITE PNG so it comes
 * through unchanged. Collapsing the first into the second would silently ignore
 * a Subtract that took everything.
 *
 * @param {string|null} baseUrl      the frame's current mask, null when it has none
 * @param {string} candidateUrl      what the method run proposed
 * @param {'add'|'subtract'} mode
 * @returns {Promise<string|null>} the new mask, null only when there was none to begin with
 */
export async function composeFrameMask(baseUrl, candidateUrl, mode) {
    if (!candidateUrl) return baseUrl;
    // Nothing to compose against: an Add IS the candidate, and a Subtract from
    // no mask removes nothing from nothing. Also the first Add's fast path — the
    // common one — which keeps the engine's own PNG byte-for-byte.
    if (!baseUrl) return mode === 'add' ? candidateUrl : null;

    const [base, cand] = await Promise.all([decode(baseUrl), decode(candidateUrl)]);
    // The base's size is the frame's established mask resolution; the candidate
    // is scaled to it, exactly as `routes/gifCutout.js` scales a mask to its frame.
    const w = base.naturalWidth;
    const h = base.naturalHeight;

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    // Black is "nothing masked", and it is the identity of both blends — without
    // it `lighten` onto a TRANSPARENT backdrop falls back to source-over.
    ctx.fillStyle = 'oklch(0 0 0)';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(base, 0, 0, w, h);

    if (mode === 'add') {
        ctx.globalCompositeOperation = 'lighten';
        ctx.drawImage(cand, 0, 0, w, h);
    } else {
        const inv = document.createElement('canvas');
        inv.width = w;
        inv.height = h;
        const ictx = inv.getContext('2d');
        ictx.filter = 'invert(1)';
        ictx.drawImage(cand, 0, 0, w, h);
        ctx.globalCompositeOperation = 'darken';
        ctx.drawImage(inv, 0, 0);
    }
    ctx.globalCompositeOperation = 'source-over';

    return canvas.toDataURL('image/png');
}
