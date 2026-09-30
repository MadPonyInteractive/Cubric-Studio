/**
 * trimSilence.js — strip the dead air off the START of a recorded take (MPI-999).
 *
 * Standalone and import-free on purpose, like wavEncoder.js: it is pure arithmetic over
 * a Float32Array, which is what lets it be tested in bare Node (tests/trim-silence.test.cjs)
 * with no microphone and no browser.
 *
 * WHY IT EXISTS. A take from the Record button starts with the seconds between the click
 * and the user starting to talk. That silence then rides into every voice clone and every
 * Flow the clip feeds, and the app has no tool to cut it off afterwards.
 *
 * THE START ONLY (Fabio, 2026-09-30). The end is not the problem: the user stops the
 * take when they are done. Everything from the first sound onwards is kept as recorded,
 * pauses between words included.
 *
 * WHY IT IS NOT IN toWavFile.js. That decoder is shared with the voice library
 * (MpiMediaPicker), so trimming there would also cut a voice file the user UPLOADED. Only
 * the recorder's own path calls this.
 *
 * HOW:
 *   - Keeps a pad in front of the sound (TRIM.padLeadMs). A hard cut at the first sample
 *     above a threshold clips the breath in front of the first word.
 *   - Judges "sound" against the take's OWN loudest moment (TRIM.thresholdDb below it),
 *     not a fixed dB, so a quiet microphone is not mistaken for silence.
 *   - Reads a 10 ms RMS envelope, not single samples, and needs TRIM.minSoundMs of it
 *     unbroken before anything counts as sound. A mic pop or a keyboard click is a few
 *     milliseconds and must not be mistaken for the start of the take.
 *   - Returns a take with nothing to trim — all silence, or nothing above the floor, or
 *     already starting on sound — UNCHANGED. It never hands back an empty clip.
 */

/**
 * The numbers. Exported so the test asserts against the same constants the code reads.
 *  - thresholdDb: how far below the loudest 10 ms frame still counts as sound. -30 dB is
 *    ~3% of its level: well under a soft consonant, well over a quiet room's hiss.
 *  - floorRms: if even the loudest frame is below this (-66 dBFS) there is no sound to
 *    anchor a threshold to, so the take is left alone. Without it, a take of pure hiss
 *    would be judged against its own hiss.
 *  - padLeadMs: kept in front of the sound.
 */
export const TRIM = Object.freeze({
    frameMs: 10,
    minSoundMs: 50,
    thresholdDb: -30,
    floorRms: 0.0005,
    padLeadMs: 150,
});

/**
 * @param {Float32Array} samples Mono PCM, -1..1.
 * @param {number} sampleRate
 * @returns {{start:number, samples:Float32Array}} Where the kept take starts, and a VIEW of
 *          it from there to the end (no copy). The whole take, unchanged, when nothing is cut.
 */
export function trimSilence(samples, sampleRate) {
    const whole = { start: 0, samples };

    const frame = Math.max(1, Math.round(sampleRate * TRIM.frameMs / 1000));
    const frames = Math.ceil(samples.length / frame);
    const minRun = Math.max(1, Math.round(TRIM.minSoundMs / TRIM.frameMs));
    if (frames < minRun) return whole;

    // The envelope: RMS of each non-overlapping 10 ms frame.
    const rms = new Float32Array(frames);
    let loudest = 0;
    for (let f = 0; f < frames; f++) {
        const from = f * frame;
        const to = Math.min(from + frame, samples.length);
        let squares = 0;
        for (let i = from; i < to; i++) squares += samples[i] * samples[i];
        rms[f] = Math.sqrt(squares / (to - from));
        if (rms[f] > loudest) loudest = rms[f];
    }
    if (loudest < TRIM.floorRms) return whole;

    const threshold = loudest * Math.pow(10, TRIM.thresholdDb / 20);

    // First frame of the first unbroken run of sound.
    let first = -1;
    for (let f = 0, run = 0; f < frames && first < 0; f++) {
        run = rms[f] > threshold ? run + 1 : 0;
        if (run === minRun) first = f - minRun + 1;
    }
    if (first < 0) return whole;

    const start = Math.max(0, first * frame - Math.round(sampleRate * TRIM.padLeadMs / 1000));
    if (start === 0) return whole;
    return { start, samples: samples.subarray(start) };
}
