/**
 * audioOutput.js — the app's chosen audio OUTPUT device (MPI-803).
 *
 * Without this the app never called `setSinkId`, so every `<audio>`/`<video>` it
 * plays followed the Windows/OS default endpoint with no way to redirect it. On a
 * box with a virtual mixer (SteelSeries Sonar and friends) the default endpoint is
 * often NOT the one the user listens to: the app is then emitting correctly — real
 * session, real peak — into silence, and nothing in the UI says so.
 *
 * Applied from ONE place on purpose. There are ~8 playback sites (gallery grid
 * audio + hover video, media picker, flow result dock, group history, op help
 * dialog, base flow) and a `setSinkId` call copied into each is a shared primitive
 * with eight call sites to keep in sync — the ninth would silently skip it. So the
 * sink is applied by a single capture-phase `play` listener on `document`: `play`
 * does not bubble, but a capture listener on `document` is still on the event path
 * down to any in-document media element, which catches every playback site the app
 * has now and every one it grows later, for free.
 *
 * The one gap that leaves is an element that never enters the DOM — `new Audio()`
 * played detached, like MpiToast's chime. Those few call `applySink` directly.
 */
import { Storage } from '../core/storage.js';
import { qsa } from './dom.js';
import { clientLogger } from '../services/clientLogger.js';

// One warn per session per reason. A rejected setSinkId would otherwise log on
// every single play — a hover-scrubbed gallery makes hundreds.
const _warned = new Set();
function _warnOnce(key, msg) {
    if (_warned.has(key)) return;
    _warned.add(key);
    clientLogger.warn('audio', msg);
}

/**
 * Point one media element at the chosen output device.
 *
 * Safe to call on anything: an element without `setSinkId` (or a stored id that no
 * longer exists) is left on the default device rather than failing the playback
 * that called us. A rejection here means no sound on the CHOSEN device, never no
 * sound at all.
 *
 * The return value exists for the Settings Test button, which has to be able to say
 * "that device did not take" instead of playing into nowhere and looking broken.
 * @param {HTMLMediaElement} el
 * @returns {Promise<boolean>} true when the element is on the intended device
 *          (including the system default, where there is nothing to apply)
 */
export async function applySink(el) {
    const id = Storage.getAudioOutputDevice();
    if (!el) return false;
    // '' is "system default", which is also what the element already does.
    if (!id) return true;
    if (typeof el.setSinkId !== 'function') {
        _warnOnce('unsupported', 'setSinkId is unavailable — output device choice cannot be applied');
        return false;
    }
    if (el.sinkId === id) return true;
    try {
        await el.setSinkId(id);
        return true;
    } catch (err) {
        // NotFoundError = the device is gone. NotAllowedError = a Chromium that gates
        // setSinkId on `speaker-selection`, which main.js does not grant (measured
        // unnecessary on this Electron, see docs/component-contracts.md).
        _warnOnce(`fail:${err?.name}`, `setSinkId(${id}) failed: ${err?.name || ''} ${err?.message || err}`);
        return false;
    }
}

/**
 * Store a new output device and move everything already playing onto it.
 *
 * Re-applying to the live elements is the difference between "the change works"
 * and "the change works next time you press play" — a user picking a device while
 * a clip plays is checking whether he can hear it.
 * @param {string} deviceId  a deviceId from `enumerateDevices`, or '' for the system default
 */
export async function setOutputDevice(deviceId) {
    Storage.setAudioOutputDevice(deviceId);
    await Promise.all(qsa('audio, video').map(el => applySink(el)));
}

/**
 * Install the one listener. Called at renderer boot, before anything can play.
 */
export function installAudioOutput() {
    // Capture phase, non-passive-irrelevant: we do not touch the event, only the
    // element it targets. `play` fires before the first sample is emitted, and
    // setSinkId on a playing element is allowed, so a late switch is inaudible.
    document.addEventListener('play', (e) => {
        const el = e.target;
        if (el instanceof HTMLMediaElement) applySink(el);
    }, true);
}
