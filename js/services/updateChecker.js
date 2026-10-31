/**
 * updateChecker.js — MPI-334 in-app update prompt (PORTABLE builds only).
 *
 * On boot (called from init.js) we ask main whether a newer version exists.
 * Main gates on the portable root and does the fetch; here we do the semver compare
 * (reusing compareSemVer), honour the mute, and drive the MpiOkCancel dialog.
 *
 * MPI-1355: 2.1.4 is the last free release. Main asks the Licence Worker, and the newer
 * version is the PAID one: OK opens its Gumroad page (with the founder code applied
 * while any are left) instead of running the updater. Nothing downloads.
 *
 * MPI-629 changed WHAT mutes it. It used to count dismissals and go quiet after 3,
 * which left a user who pressed Later three times with no route back to that update
 * at all — the popup was the only route. Now the popup is one of two routes: it
 * offers every boot until the user explicitly ticks "Don't ask again", and Settings
 * carries an Update section whenever an update is due. The tick silences the POPUP;
 * it never hides the Settings route, which is the whole point of an explicit opt-out.
 *
 * Ordering is load-bearing: the failed-update report comes first (see below), and a
 * boot that reported a failure does not then stack an update prompt on top of it.
 * The result of the check is cached so Settings can ask what is due without a second
 * fetch — see getPendingUpdate().
 *
 * Dev note: in a dev/browser build the portable gate returns portable:false, so
 * nothing is ever due. Set localStorage 'mpi_dev_force_update' to a fake latest
 * version (e.g. "9.9.9") to drive both surfaces, with a sample founder line.
 */
import { compareSemVer } from '../managers/versioningManager.js';
import { APP_VERSION } from '../core/appVersion.js';
import { Storage } from '../core/storage.js';
import { MpiOkCancel } from '../components/Compounds/MpiOkCancel/MpiOkCancel.js';
import { clientLogger } from './clientLogger.js';
import { openExternal } from '../utils/openExternal.js';

/** Used until the Worker has answered, and when it cannot be reached. */
const STORE_URL_FALLBACK = 'https://mad-pony-interactive.gumroad.com/l/ubqygr';

/** Promise<{current, latest, url, founder}|null> — the boot check, resolved once and shared. */
let _pending = null;
/** The store link the Worker last gave; the error dialog's button reads it. */
let _storeUrl = STORE_URL_FALLBACK;

/** Where "Get the latest version" goes: the paid version's Gumroad page. */
export function getStoreUrl() {
    return _storeUrl;
}

function getIpc() {
    try {
        if (typeof window.require === 'function') {
            return window.require('electron')?.ipcRenderer || null;
        }
    } catch { /* not electron */ }
    return null;
}

export function checkForUpdate() {
    _pending = _checkForUpdate().catch((err) => {
        clientLogger.warn('update', `update check failed: ${err?.message || err}`);
        return null;
    });
    return _pending;
}

/**
 * What the boot check found, without re-fetching. Resolves to `{current, latest}`
 * when a newer version exists, `null` otherwise (up to date, non-portable, or the
 * fetch failed). Answers regardless of the mute — a muted popup is still an
 * available update, and Settings is where a muted user goes to get it.
 */
export function getPendingUpdate() {
    return _pending || Promise.resolve(null);
}

async function _checkForUpdate() {
    const ipc = getIpc();

    // A failed run means the newer version is still out there, so the prompt below
    // would fire straight after the failure dialog. One message per boot — but the
    // update stays "due", so Settings still offers the retry.
    const failed = await reportFailedUpdate(ipc);

    const info = await _resolveUpdate(ipc);
    if (!info || failed) return info || null;

    const dismissed = Storage.getUpdateDismissed();
    if (dismissed.version === info.latest && dismissed.muted) {
        clientLogger.info('update', `v${info.latest} available but muted — offered in Settings only`);
        return info;
    }

    clientLogger.info('update', `update available: v${info.current} -> v${info.latest}, prompting`);
    promptUpdate(info);
    return info;
}

/** The fetch + semver compare. `{current, latest, url, founder}` when newer, else null. */
async function _resolveUpdate(ipc) {
    // ponytail: dev-only escape hatch to exercise the real dialog + mute in a build
    // where the portable gate would skip the fetch. Never set in prod. It flows through
    // the SAME compare + mute below, so it faithfully tests both surfaces.
    let devForce = null;
    try { devForce = localStorage.getItem('mpi_dev_force_update'); } catch { /* ignore */ }

    let current, latest, founder = null;
    if (devForce) {
        current = APP_VERSION;
        latest = devForce;
        founder = { code: 'FOUNDER100', left: 63, url: `${STORE_URL_FALLBACK}/FOUNDER100` };
        clientLogger.info('update', `DEV force-update flag set — simulating latest=${latest}`);
    } else {
        if (!ipc) { clientLogger.info('update', 'no IPC (browser) — update check skipped'); return null; }
        let result;
        try {
            result = await ipc.invoke('check-for-update');
        } catch (err) {
            clientLogger.warn('update', `check-for-update IPC failed: ${err.message}`);
            return null;
        }
        if (!result?.portable) return null;          // dev/non-portable — main already logged
        if (result.ok && result.url) _storeUrl = result.url;
        if (!result.ok || !result.latest) return null; // fetch failed or no paid build yet — main already logged
        current = result.current;
        latest = result.latest;
        founder = result.founder || null;
    }

    if (compareSemVer(latest, current) <= 0) {
        clientLogger.info('update', `up to date (current=${current} latest=${latest})`);
        return null;
    }
    return { current, latest, url: _storeUrl, founder };
}

// MPI-422: an update runs with the app closed, so a failure has no window to land in.
// The updater relaunches us either way and leaves update/update-result.json behind on
// failure; main reads-and-deletes it. Without this the user presses Update, waits, and
// gets a silent no-op with nothing to report.
async function reportFailedUpdate(ipc) {
    if (!ipc) return false;
    let result;
    try {
        result = await ipc.invoke('update-last-result');
    } catch (err) {
        clientLogger.warn('update', `update-last-result IPC failed: ${err.message}`);
        return false;
    }
    if (!result || result.ok) return false;

    clientLogger.warn('update', `previous update failed: ${result.error || 'unknown'}`);
    await showUpdateError(
        'Update failed',
        `The last update did not complete, so you are still on v${APP_VERSION}.\n\n`
        + `${result.error || 'No reason was recorded.'}\n\n`
        + `Full details are in update/update.log next to the app. You can try again from `
        + `Settings, or download the latest build manually.`,
    );
    return true;
}

/**
 * Open the paid version's Gumroad page in the browser — with the founder code applied
 * while any are left. Shared by the boot popup, the Settings row and the bell, so there
 * is one path. Nothing downloads: 2.1.4 gets no more updates (MPI-1355).
 */
export function openLatestVersion(info) {
    const url = info?.founder?.url || info?.url || _storeUrl;
    clientLogger.info('update', `user opened the store for v${info?.latest}: ${url}`);
    openExternal(url);
}

// shell.js is imported lazily: it pulls in the whole component tree, and this module
// is loaded from init.js before the shell is up.
async function showUpdateError(title, text) {
    const { showError } = await import('../shell.js');
    showError(title, text);
}

function promptUpdate(info) {
    const { current, latest, founder } = info;
    const founderLine = founder
        ? `\n\nFounder code ${founder.code} makes it free for the first users: ${founder.left} left. `
            + `The button below applies it for you.`
        : '';
    const dialog = MpiOkCancel.mount(document.createElement('div'), {
        mascot: { key: 'studio', clip: 'update-ready' },
        title: `Cubric Studio v${latest} is out`,
        text: `There are no more updates for this version (v${current}).\n\n`
            + `Cubric Studio v${latest} is the new paid version, on Gumroad.`
            + founderLine,
        okLabel: 'Open Gumroad',
        cancelLabel: 'Later',
        checkbox: { label: "Don't ask again", checked: false },
    });

    dialog.on('ok', () => openLatestVersion(info));

    dialog.on('cancel', ({ checkboxChecked }) => {
        const muted = checkboxChecked === true;
        Storage.setUpdateDismissed({ version: latest, muted });
        clientLogger.info('update', muted
            ? `user muted v${latest} — Settings still offers it`
            : `user deferred v${latest} — will ask again next boot`);
    });

    dialog.el.show();
}
