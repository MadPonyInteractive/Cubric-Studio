/**
 * mixMath.js — the ONE definition of audio math shared by the Mix live preview
 * (Web Audio API) and the server render (ffmpeg). MPI-917 Phase 1.
 *
 * DOM-free by construction: no imports, safe to require() from routes.
 *
 * All gain values are LINEAR (0–1+). Callers use dbToGain() to convert dB.
 * Pan position is in [−1, 1]: −1 = hard left, 0 = centre, 1 = hard right.
 */

/** −1 dBFS ceiling applied by the master limiter (`alimiter limit=<ceil>:level=0:latency=1`). */
export const LIMITER_CEILING_DB = -1;

/**
 * Linear amplitude gain from a dB value.
 * @param {number} db
 * @returns {number}
 */
export function dbToGain(db) {
    return Math.pow(10, db / 20);
}

/**
 * Full 2×2 gain matrix for the W3C StereoPannerNode equal-power pan law.
 *
 * Returns `{ ll, lr, rl, rr }` where:
 *   outL = ll * inL  +  lr * inR
 *   outR = rl * inL  +  rr * inR
 *
 * **Mono** (channels === 1): the single input is `inL`; `lr` and `rr` are always 0.
 *   At centre (p = 0): ll = rl = cos(π/4) = 1/√2 → −3.01 dB per channel.
 *
 * **Stereo** (channels === 2): the W3C StereoPannerNode algorithm
 *   (research/tests-parity.md line 62):
 *   - p ≤ 0: x = p+1;  outL = inL + inR·cos(xπ/2);  outR = inR·sin(xπ/2)
 *   - p > 0: x = p;    outL = inL·cos(xπ/2);  outR = inR + inL·sin(xπ/2)
 *   At centre (p = 0) both channels pass through at unity with no cross-feed.
 *   At hard left (p = −1) the entire stereo image folds into L; at hard right into R.
 *
 * @param {number} p        Pan position in [−1, 1]
 * @param {number} channels Source channel count: 1 (mono) or 2 (stereo)
 * @returns {{ ll: number, lr: number, rl: number, rr: number }}
 */
export function panGains(p, channels) {
    const c = Math.max(-1, Math.min(1, p));
    if (channels === 1) {
        // Mono: equal-power cosine law; both outputs from the single input (lr = rr = 0)
        const x = (c + 1) * Math.PI / 4;   // [0, π/2]
        return { ll: Math.cos(x), lr: 0, rl: Math.sin(x), rr: 0 };
    }
    // Stereo: W3C StereoPannerNode cross-feed algorithm
    if (c <= 0) {
        // x ∈ [0, 1] as p goes from −1 to 0
        const x = c + 1;
        const cos = Math.cos(x * Math.PI / 2);
        const sin = Math.sin(x * Math.PI / 2);
        return { ll: 1, lr: cos, rl: 0, rr: sin };
    }
    // x ∈ (0, 1] as p goes from 0 to 1; mirrors the left half
    const x = c;
    const cos = Math.cos(x * Math.PI / 2);
    const sin = Math.sin(x * Math.PI / 2);
    return { ll: cos, lr: 0, rl: sin, rr: 1 };
}

/**
 * Gain at time `t` (seconds, absolute timeline position) for a clip with optional
 * linear fade in and/or fade out.  Matches ffmpeg `afade curve=tri` (linear ramp),
 * so the preview and the render agree.
 *
 * Callers are responsible for checking whether `t` falls within the clip at all;
 * when called outside [clip.start, clip.start + (clip.out − clip.in)] the function
 * returns 1 (full gain), which is harmless in that context.
 *
 * @param {number} t   Absolute timeline time in seconds
 * @param {{ start: number, in: number, out: number, fadeIn?: number, fadeOut?: number }} clip
 * @returns {number}   Linear gain clamped to [0, 1]
 */
export function fadeGainAt(t, clip) {
    const clipDur = clip.out - clip.in;
    const tRel    = t - clip.start;
    const fadeIn  = clip.fadeIn  || 0;
    const fadeOut = clip.fadeOut || 0;
    let gain = 1;
    if (fadeIn > 0 && tRel < fadeIn) {
        gain = Math.min(gain, tRel / fadeIn);
    }
    if (fadeOut > 0 && tRel > clipDur - fadeOut) {
        gain = Math.min(gain, (clipDur - tRel) / fadeOut);
    }
    return Math.max(0, Math.min(1, gain));
}

// Threshold below which a gain coefficient is treated as zero in the filter expression.
const _ZERO_THRESHOLD = 1e-9;

/**
 * ffmpeg `pan` filter expression for the given pan position and source channel count.
 * Returns `pan=stereo|c0=<expr>|c1=<expr>`, using `=` as the channel-assignment operator.
 *
 * Each output expression is the sum of every non-zero term from the gain matrix.
 * A channel with no contributing terms emits `0` (silence).
 *
 * Mono upmix example (p = 0):
 *   `pan=stereo|c0=0.707107*c0|c1=0.707107*c0`
 *
 * Stereo centre (p = 0):
 *   `pan=stereo|c0=c0|c1=c1`          (unity, no cross-feed)
 *
 * Stereo hard-left (p = −1):
 *   `pan=stereo|c0=c0+c1|c1=0`        (full fold to L)
 *
 * @param {number} p        Pan position in [−1, 1]
 * @param {number} channels Source channel count: 1 or 2
 * @returns {string}
 */
export function ffmpegPanExpr(p, channels) {
    const { ll, lr, rl, rr } = panGains(p, channels);
    // Round to 6 significant figures to keep filter-script lines readable
    const fmt = (n) => parseFloat(n.toPrecision(6));

    function term(gain, srcChan) {
        if (Math.abs(gain) < _ZERO_THRESHOLD) return null;
        const g = fmt(gain);
        return g === 1 ? srcChan : `${g}*${srcChan}`;
    }

    // For mono, lr and rr are 0 so both output channels come from c0 only
    const src1 = channels === 1 ? 'c0' : 'c1';

    const c0terms = [term(ll, 'c0'), term(lr, src1)].filter(Boolean);
    const c1terms = [term(rl, 'c0'), term(rr, src1)].filter(Boolean);

    // A silent row still names a channel: ffmpeg refuses a bare `c1=0` ("Expected in channel name").
    const c0expr = c0terms.length ? c0terms.join('+') : '0*c0';
    const c1expr = c1terms.length ? c1terms.join('+') : '0*c0';

    return `pan=stereo|c0=${c0expr}|c1=${c1expr}`;
}
