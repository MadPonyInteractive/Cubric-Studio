/**
 * js/utils/math.js — Number clamping for Cubric Studio.
 */

'use strict';

/**
 * Pins a number between lo and hi.
 * @param {number} v
 * @param {number} lo
 * @param {number} hi
 * @returns {number}
 */
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/**
 * Coerces raw input (a settings field, a typed string) to a number between min
 * and max; anything that is not a finite number gives `fallback`, unclamped.
 * @param {*} value
 * @param {*} fallback
 * @param {number} [min=-Infinity]
 * @param {number} [max=Infinity]
 * @returns {number|*}
 */
export function clampNumber(value, fallback, min = -Infinity, max = Infinity) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return clamp(n, min, max);
}

/**
 * `clampNumber`, rounded to a whole number (the fallback is not rounded).
 * @param {*} value
 * @param {*} fallback
 * @param {number} [min=-Infinity]
 * @param {number} [max=Infinity]
 * @returns {number|*}
 */
export function clampInt(value, fallback, min = -Infinity, max = Infinity) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.round(clamp(n, min, max));
}
