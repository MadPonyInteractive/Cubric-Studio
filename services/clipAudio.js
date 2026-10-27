'use strict';

/**
 * services/clipAudio.js — a clip's sound as pieces a speech-to-text model takes (MPI-1169).
 *
 * Cosmo hears a clip it looks at through the transcriber the user picked for dictation. Every
 * backend gets the same pieces: mono 16 kHz WAV, at most PIECE_S long, because DeepInfra refuses
 * more than 60 s (and a ComfyUI or Ollama run on a whole film would hold the queue for minutes).
 * Each piece keeps its start, so the joined transcript can stamp each line with the CLIP's time.
 */

const path = require('path');
const { randomUUID } = require('crypto');
const { runFfmpeg } = require('./ffmpegBinary');
const { probeVideo } = require('./ffprobeVideo');

const PIECE_S = 60;
const TAIL_S = 0.5;  // a last piece shorter than this is the container's rounding, not speech

/**
 * @param {string} file a video on disk
 * @param {string} dir where the pieces go; the caller deletes them
 * @returns {Promise<{path:string, start:number}[]|null>} null when the clip has no sound
 */
async function cutAudio(file, dir) {
    const probe = await probeVideo(file);
    if (!probe?.hasAudio) return null;
    const pieces = [];
    for (let start = 0; start === 0 || start < probe.duration - TAIL_S; start += PIECE_S) {
        const out = path.join(dir, `${randomUUID()}.wav`);
        await runFfmpeg(['-v', 'error', '-ss', String(start), '-t', String(PIECE_S), '-i', file,
            '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', '-y', out]);
        pieces.push({ path: out, start });
    }
    return pieces;
}

/** 75 -> "1:15": a transcript line's place in the clip. */
const stamp = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

module.exports = { cutAudio, stamp, PIECE_S };
