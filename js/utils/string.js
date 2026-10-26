// @ts-check
/**
 * js/utils/string.js — String utilities for Cubric Studio.
 */

'use strict';

/**
 * Escapes a value for an HTML template: element content AND a quoted attribute
 * (either quote). null/undefined become ''.
 * @param {*} value
 * @returns {string}
 */
export const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/**
 * How long a piece of text needs to be on screen to be READ.
 *
 * Broadcast subtitling already solved this: Netflix caps adult English at 17
 * characters/second, the BBC works to ~160-180 wpm. Both assume the viewer is
 * already looking at the text. A toast is not — it arrives unannounced, in the
 * corner, over something else — so this budgets a slower 12 CPS plus a lead-in
 * for noticing it at all.
 *
 * Clamped at both ends: a two-word toast should not feel curt, and no message
 * should camp on screen (long ones are usually a sign the copy needs cutting,
 * not the timer extending).
 *
 * @param {string} text
 * @returns {number} milliseconds
 */
export const readingTimeMs = (text) => {
    const chars = String(text || '').trim().length;
    return Math.min(12000, Math.max(3000, Math.round(2500 + (chars / 12) * 1000)));
};

/**
 * Formats seconds into MM:SS.ms display string.
 * @param {number} s
 * @returns {string}
 */
export const formatTime = (s) => {
    if (isNaN(s) || s < 0) return '00:00.00';
    const min = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    const ms  = Math.floor((s % 1) * 100);
    return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
};
