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
