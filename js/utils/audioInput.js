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
 */
import { Storage } from '../core/storage.js';
import { clientLogger } from '../services/clientLogger.js';

/** @returns {Promise<MediaStream>} rejects as getUserMedia does (NotAllowedError, NotFoundError…) */
export async function openMic() {
    const deviceId = Storage.getAudioInputDevice();
    if (deviceId) {
        try {
            return await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: deviceId } } });
        } catch (err) {
            if (err?.name !== 'OverconstrainedError' && err?.name !== 'NotFoundError') throw err;
            clientLogger.warn('audio', `picked microphone is gone (${err.name}) — using the system default`);
        }
    }
    return navigator.mediaDevices.getUserMedia({ audio: true });
}
