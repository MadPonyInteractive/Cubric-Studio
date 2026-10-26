/**
 * js/phone/phoneMedia.js — getting a picture or clip into and out of the phone (MPI-1300).
 *
 * The desktop picks files through Electron's dialog and saves through the project; a phone
 * has only the browser's own doors. None of these draw UI: the file input and the download
 * link exist for the one call that opens the phone's picker or saves the file.
 */
import { ce, on } from '../utils/dom.js';

/** Open the phone's camera / photo picker. Resolves the chosen File, or null. */
export function pickPhoto() {
    return new Promise((resolve) => {
        // eslint-disable-next-line mpi/no-bare-form-control -- hidden OS file-dialog handle, never rendered
        const input = ce('input', { type: 'file', accept: 'image/*' });
        const off = on(input, 'change', () => { off(); resolve(input.files?.[0] || null); });
        input.click();
    });
}

/** A File as a data URL — what `POST /agent/message` takes until Phase 5's upload route. */
export function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        on(reader, 'load', () => resolve(reader.result));
        on(reader, 'error', () => reject(reader.error));
        reader.readAsDataURL(file);
    });
}

/** The file name a `/project-file?path=` url points at. */
export function fileNameOf(url) {
    try {
        const p = new URL(url, window.location.href).searchParams.get('path') || url;
        return p.split(/[\\/]/).pop();
    } catch { return 'cubric-studio'; }
}

/** Save to the phone (its Downloads / Files). */
export function saveMedia(url) {
    ce('a', { href: url, download: fileNameOf(url) }).click();
}

/** Share needs `navigator.share` (a secure context: localhost or HTTPS). */
export const canShare = () => typeof navigator.share === 'function';

/** The phone's share sheet, with the file itself when the browser takes files, else the link. */
export async function shareMedia(url) {
    const res = await fetch(url);
    const blob = await res.blob();
    const file = new File([blob], fileNameOf(url), { type: blob.type });
    if (navigator.canShare?.({ files: [file] })) return navigator.share({ files: [file] });
    return navigator.share({ url: new URL(url, window.location.href).href });
}
