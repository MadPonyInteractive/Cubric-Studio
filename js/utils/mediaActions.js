/**
 * mediaActions.js — Shared media file utilities.
 *
 * Extracts repeated media-related operations from MpiGalleryBlock
 * and MpiGroupHistoryBlock into reusable functions.
 */

import { clientLogger } from '../services/clientLogger.js';

/**
 * Extract the absolute path from a /project-file?path=... URL.
 * @param {string} filePath — e.g. "/project-file?path=C%3A%5C...%5Ct2i_001.png"
 * @returns {string|null} The decoded absolute path, or null if not parseable
 */
export function extractAbsPath(filePath) {
    if (!filePath) return null;
    const match = filePath.match(/[?&]path=([^&]+)/);
    return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Extract just the filename from a filePath URL.
 * @param {string} filePath — e.g. "/project-file?path=C%3A%5CUsers%5C...%5Ct2i_001.png"
 * @returns {string|null}
 */
export function extractFilenameFromPath(filePath) {
    const absPath = extractAbsPath(filePath);
    if (!absPath) return null;
    return absPath.replace(/\\/g, '/').split('/').pop();
}

/**
 * Normalize a filePath to a URL the <img>/<video> tag can load.
 * Already-absolute URLs (http, blob, data) and project-file URLs pass through.
 * Raw Windows paths get wrapped in /project-file?path=....
 * @param {string} filePath
 * @returns {string}
 */
export function resolveMediaUrl(filePath) {
    if (!filePath) return '';
    if (filePath.startsWith('http') || filePath.startsWith('blob:') ||
        filePath.startsWith('data:') || filePath.includes('project-file')) {
        return filePath;
    }
    return `/project-file?path=${encodeURIComponent(filePath.replace(/\\/g, '/'))}`;
}

/**
 * MPI-867 — a dragged gallery card as the agent receives it: the CARD, by reference, never
 * its pixels (Fabio, 2026-09-26). The agent is told which card is meant and looks only if the
 * job needs it; `thumb` is for the user's chip and bubble alone.
 *
 * Reads `application/mpi-media` (set by `MpiGalleryGrid`'s `dragstart`), never
 * `dataTransfer.files`: Chromium builds those from the card's `<img>`, the 512 `.thumb.webp`
 * rendition, and that thumbnail is what the agent used to receive (MPI-884, measured
 * byte-identical 2026-09-22).
 *
 * `null` = nothing to hand over: an audio card, or a blob/preview card with no file on disk.
 * @param {string|object} payload — the `application/mpi-media` value, raw JSON or parsed.
 * @returns {{url: string, name: string, mediaType: 'image'|'video', itemId: string|null, groupId: string, thumb: string}|null}
 */
export function cardReference(payload) {
    let card = payload;
    if (typeof payload === 'string') {
        try { card = JSON.parse(payload); } catch { return null; }
    }
    // `type` is the group's, as the grid sets it. A GIF card is an image card.
    if (!card?.groupId || (card.type !== 'image' && card.type !== 'video')) return null;
    const name = extractFilenameFromPath(card.filePath);
    if (!name) return null;
    const url = resolveMediaUrl(card.filePath);
    return {
        url, name, mediaType: card.type, itemId: card.itemId || null, groupId: card.groupId,
        // An <img> cannot paint a clip: a video chip needs the card's poster.
        thumb: card.thumbPath ? resolveMediaUrl(card.thumbPath) : _posterOf(card) || url,
    };
}

/**
 * A clip's poster when the drag did not carry it: the card's poster `<img>` sets its own
 * payload without `thumbPath`. Every thumb is `Media/.meta/<itemId>.thumb.webp`, video
 * posters included (`routes/projects.js`), which is where the server looks too.
 */
function _posterOf(card) {
    const abs = card.type === 'video' && card.itemId ? extractAbsPath(card.filePath) : null;
    if (!abs) return '';
    const dir = abs.replace(/\\/g, '/').replace(/\/[^/]*$/, '');
    return resolveMediaUrl(`${dir}/.meta/${card.itemId}.thumb.webp`);
}

/**
 * Download media files.
 *  - Single file: browser <a download> (default Downloads folder / browser dialog).
 *  - Multiple files in Electron: one folder picker via IPC, then bulk copy.
 *  - Multiple files in browser dev mode: fall back to per-file <a> clicks.
 * @param {Object} project — state.currentProject (needs .folderPath)
 * @param {Array<{filePath: string}>} items — array of history items to download
 */
export async function downloadMediaFiles(project, items) {
    if (!project?.folderPath || !items?.length) return;

    const mediaDir = `${project.folderPath}/Media`.replace(/\\/g, '/');
    const entries = items
        .map((item) => {
            const filename = extractFilenameFromPath(item.filePath);
            if (!filename) return null;
            const absPath = `${mediaDir}/${filename}`;
            return { filename, absPath };
        })
        .filter(Boolean);
    if (!entries.length) return;

    const isElectron = typeof window !== 'undefined' && typeof window.require === 'function';

    if (entries.length > 1 && isElectron) {
        try {
            const { ipcRenderer } = window.require('electron');
            const sources = entries.map((e) => e.absPath);
            const res = await ipcRenderer.invoke('save-files-to-folder', sources);
            if (res && !res.cancelled) return;
            // cancelled or IPC missing — fall through to per-file
        } catch (err) {
            clientLogger.warn('mediaActions', 'bulk save IPC failed, falling back:', err);
        }
        return;
    }

    for (const { filename, absPath } of entries) {
        const url = `/project-file?path=${encodeURIComponent(absPath)}`;
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
    }
}

/**
 * Delete media files for the given items from a project.
 * Calls DELETE /project-media/:projectId/:filename for each item.
 * @param {Object} project — state.currentProject
 * @param {Array<{filePath: string}>} items — items whose files to delete
 */
export async function deleteMediaFiles(project, items) {
    if (!project) return;
    for (const item of items) {
        const filename = extractFilenameFromPath(item.filePath);
        if (!filename) continue;
        try {
            const idParam = item.id ? `&itemId=${encodeURIComponent(item.id)}` : '';
            await fetch(
                `/project-media/${project.id}/${encodeURIComponent(filename)}?folderPath=${encodeURIComponent(project.folderPath)}${idParam}`,
                { method: 'DELETE' }
            );
        } catch (err) {
            clientLogger.warn('mediaActions', 'delete file failed:', err);
        }
    }
}
