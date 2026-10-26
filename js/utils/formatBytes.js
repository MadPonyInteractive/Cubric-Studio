/**
 * Format a byte count as a human-readable string (e.g. "1.5GB", "512MB").
 * Shared between download UI components.
 * Decimal units (1 GB = 1e9 bytes), matching RunPod, Hugging Face and macOS (MPI-763).
 *
 * @param {number} bytes
 * @returns {string}
 */
export function formatBytes(bytes) {
    if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)}GB`;
    if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(0)}MB`;
    if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(0)}KB`;
    return `${bytes}B`;
}

/**
 * Format a transfer rate (e.g. "2.5 MB/s", "640 KB/s"). Decimal units like
 * formatBytes, so a download's size and its speed agree on screen. Shared by the
 * renderer and, through createRequire, the server (routes/downloadManager.js,
 * routes/shared.js).
 *
 * @param {number} bytesPerSec
 * @returns {string}
 */
export function formatSpeed(bytesPerSec) {
    const b = Number(bytesPerSec) || 0;
    if (b >= 1e6) return `${(b / 1e6).toFixed(1)} MB/s`;
    if (b >= 1e3) return `${(b / 1e3).toFixed(0)} KB/s`;
    return `${Math.round(b)} B/s`;
}
