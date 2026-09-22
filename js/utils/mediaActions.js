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

/** What `saveAttachment` (services/agentTools.mjs) will stage: JPEG, PNG and WebP, nothing else. */
const STAGEABLE_STILL = /\.(png|jpe?g|webp)$/i;

/**
 * MPI-884 — the full-resolution file behind a dragged gallery card, for a drop target that
 * wants the PICTURE rather than what the drag happens to carry. `null` = this card has no
 * stageable still to offer, so the caller falls back to `dataTransfer.files` unchanged.
 *
 * A card's `<img>` is the 512 `.thumb.webp` rendition (`pickImageRendition` returns
 * `item.thumbPath` for a card that has not promoted), and Chromium synthesises
 * `dataTransfer.files` from that element's OWN image resource — so a drop handler reading
 * `files` receives the thumbnail's bytes, not the card's file. Measured 2026-09-22: the file
 * staged for the agent was byte-identical to `<itemId>.thumb.webp`, 512x682 for a 768x1024
 * card, and the agent edited that. The card's real path rides the same drag in
 * `application/mpi-media` (set by `MpiGalleryGrid`'s `dragstart`), which is what this reads.
 *
 * @param {string|object} payload — the `application/mpi-media` value, raw JSON or parsed.
 * @returns {{url: string, name: string}|null}
 */
export function cardAttachmentSource(payload) {
    let card = payload;
    if (typeof payload === 'string') {
        try { card = JSON.parse(payload); } catch { return null; }
    }
    // Video and audio cards have no still to attach; `type` is the group's, as the grid sets it.
    if (!card || card.type !== 'image') return null;
    // A GIF's filePath is the animated file and a blob/preview card has no on-disk file at
    // all: both would turn a working (if small) attachment into a staging error.
    const name = extractFilenameFromPath(card.filePath);
    if (!name || !STAGEABLE_STILL.test(name)) return null;
    return { url: resolveMediaUrl(card.filePath), name };
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
