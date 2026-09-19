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

// MPI-824. deviceIds we have already tried to re-resolve. `applySink` runs on EVERY
// play, and re-resolving means an `enumerateDevices` round trip, so a dead device must
// cost one lookup — not one per clip in a hover-scrubbed gallery. Cleared on
// `devicechange`: a new device set is a new chance for the device to be back.
const _reresolved = new Set();

/** The id the device with this exact label has NOW, or '' when nothing matches. */
async function _idForLabel(label) {
    if (!label || !navigator.mediaDevices?.enumerateDevices) return '';
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        return devices.find(d => d.kind === 'audiooutput' && d.label === label)?.deviceId || '';
    } catch (err) {
        _warnOnce('enumerate', `enumerateDevices failed while re-resolving the output device: ${err?.message || err}`);
        return '';
    }
}

/**
 * Re-pin a stored device whose id stopped resolving (MPI-824).
 *
 * A deviceId is a salted hash of the OS endpoint id, and SteelSeries Sonar regenerates
 * its virtual endpoints — so the device is still listed, under the same name, with an id
 * the stored one no longer matches. Measured on Fabio's box 2026-09-19: five sessions of
 * `setSinkId … NotFoundError` against a device Windows reported ACTIVE the whole time,
 * and a stored id that matched none of the 109 endpoints in the registry.
 *
 * Matching on the label verbatim is the point: it is the only part of the identity that
 * survives the id changing. Two devices sharing a label is possible (twin headsets) and
 * picking the first is fine — they are interchangeable by definition of being
 * indistinguishable in the picker.
 *
 * @returns {Promise<string>} the new id, already stored, or '' when it could not be healed
 */
async function _reresolve(deviceId, label) {
    const healed = await _idForLabel(label);
    if (!healed || healed === deviceId) return '';
    Storage.setAudioOutputDevice({ deviceId: healed, label });
    clientLogger.info('audio', `output device "${label}" came back under a new id — re-pinned`);
    return healed;
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
    const { deviceId: id, label } = Storage.getAudioOutputDevice();
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
        // NotFoundError = the stored id does not resolve. That is NOT the same as the
        // device being gone (MPI-824): a virtual mixer re-registers its endpoints under
        // new ids, so the device is usually still listed under its own name. Try to
        // re-pin it before giving up — once per dead id, not once per play.
        if (err?.name === 'NotFoundError' && !_reresolved.has(id)) {
            _reresolved.add(id);
            const healed = await _reresolve(id, label);
            if (healed) {
                try {
                    await el.setSinkId(healed);
                    return true;
                } catch (retryErr) {
                    _warnOnce(`reheal:${retryErr?.name}`, `re-pinned "${label}" to ${healed} and setSinkId still failed: ${retryErr?.name || retryErr}`);
                    return false;
                }
            }
        }
        // NotAllowedError = a Chromium that gates setSinkId on `speaker-selection`, which
        // main.js does not grant (measured unnecessary on this Electron, see
        // docs/component-contracts.md).
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
 * @param {string} [label]   that device's `enumerateDevices` label — what MPI-824 re-pins
 *                           from when the id stops resolving. Omit for the system default.
 */
export async function setOutputDevice(deviceId, label = '') {
    Storage.setAudioOutputDevice({ deviceId, label });
    // A fresh pick is a fresh chance: whatever we gave up on before is not this.
    _reresolved.clear();
    await Promise.all(qsa('audio, video').map(el => applySink(el)));
}

/**
 * Install the listeners. Called at renderer boot, before anything can play.
 */
export function installAudioOutput() {
    // Capture phase, non-passive-irrelevant: we do not touch the event, only the
    // element it targets. `play` fires before the first sample is emitted, and
    // setSinkId on a playing element is allowed, so a late switch is inaudible.
    document.addEventListener('play', (e) => {
        const el = e.target;
        if (el instanceof HTMLMediaElement) applySink(el);
    }, true);

    // MPI-824. A virtual mixer registers its endpoints AFTER the app is up — Cubric's
    // first `play` can beat SteelSeries Sonar to it, and without this the clip lands on
    // the OS default and everything after it inherits the same dead id. `devicechange`
    // is the moment that stops being true, so the attempt cache is dropped and whatever
    // is on screen is re-pointed. Elements already on the right sink return early, so
    // this is free when nothing is wrong.
    //
    // `_warned` is deliberately NOT cleared here: a mixer that churns fires this event
    // repeatedly, and a warning per churn is a log nobody can read.
    navigator.mediaDevices?.addEventListener?.('devicechange', () => {
        _reresolved.clear();
        qsa('audio, video').forEach(el => applySink(el));
    });
}
