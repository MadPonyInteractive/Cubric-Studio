/**
 * srt.js — the plain text inside an SRT subtitle file (MPI-1071).
 *
 * The Transcribe Flow's graph returns ONE string, the SRT, so the timed file and the
 * readable transcript can never disagree. The result box shows the text: every cue's
 * lines joined with spaces, index and timing lines dropped. A long line the node split
 * into two cues reads as one sentence again.
 */

const TIMING = /^\d{1,2}:\d{2}:\d{2}[,.]\d{1,3}\s*-->/;

/**
 * Whether a text result carries timed cues (Transcribe) rather than plain text (a describe).
 * @param {string} text
 * @returns {boolean}
 */
export function isSrt(text) {
    return String(text ?? '').split(/\r?\n/).some(l => TIMING.test(l.trim()));
}

/**
 * @param {string} srt
 * @returns {string}
 */
export function srtToText(srt) {
    const words = [];
    for (const block of String(srt ?? '').replace(/\r\n?/g, '\n').split(/\n\s*\n/)) {
        const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
        const t = lines.findIndex(l => TIMING.test(l));
        // A block with no timing line is not a cue: plain text passes through as-is.
        words.push(...(t === -1 ? lines : lines.slice(t + 1)));
    }
    return words.join(' ').replace(/\s+/g, ' ').trim();
}
