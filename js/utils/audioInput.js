/**
 * audioInput.js — open the microphone the user picked in Settings (MPI-1034).
 *
 * `exact`, never `ideal`. Chromium treats an `ideal` deviceId as a hint it is free to
 * override, and on Electron 41 it overrides it with the system default every time:
 * measured 2026-10-06 on Fabio's box, a fresh, valid Focusrite id asked as `ideal`
 * opened "Default - SteelSeries Sonar - Microphone". That virtual mic hands Chromium
 * digital zero, so dictation, the recorder and the Settings mic test all recorded
 * silence whatever the picker said — with no error and nothing in the log.
 *
 * `exact` throws when the device is gone (unplugged, driver reinstalled), and only
 * then do we take the system default, so a stale choice still records something.
 *
 * `raw` (MPI-1114): Chromium's defaults for `audio: true` are video-call processing —
 * auto gain, noise suppression, echo cancellation. Measured 2026-10-12 on Fabio's
 * Focusrite: the raw input held an even level, while the app's take ducked after the
 * first syllables (the AGC) and sounded phasey (the suppressor). A recording is a
 * voice sample, so it goes raw; dictation keeps the processing, which helps speech-to-text.
 */
import { Storage } from '../core/storage.js';
import { clientLogger } from '../services/clientLogger.js';

const RAW = { autoGainControl: false, noiseSuppression: false, echoCancellation: false };

/**
 * @param {{raw?: boolean}} [opts] raw: no call processing — for anything the user will listen to
 * @returns {Promise<MediaStream>} rejects as getUserMedia does (NotAllowedError, NotFoundError…)
 */
export async function openMic({ raw = false } = {}) {
    const extra = raw ? RAW : {};
    const deviceId = Storage.getAudioInputDevice();
    if (deviceId) {
        try {
            return await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: deviceId }, ...extra } });
        } catch (err) {
            if (err?.name !== 'OverconstrainedError' && err?.name !== 'NotFoundError') throw err;
            clientLogger.warn('audio', `picked microphone is gone (${err.name}) — using the system default`);
        }
    }
    return navigator.mediaDevices.getUserMedia({ audio: raw ? RAW : true });
}
