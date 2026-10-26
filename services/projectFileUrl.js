/**
 * `/project-file?path=` URLs <-> disk paths — the ONE place the backend converts
 * between them (AUDIT D2).
 *
 * Decode exactly ONCE. `URLSearchParams.get()` already percent-decodes, so a further
 * `decodeURIComponent` on its result decodes twice: a file named `100%.mp4` threw and
 * read as "not found", and one named `a%20b.png` resolved to `a b.png` (AUDIT B1). That
 * bug lived in eleven hand-written copies of this conversion.
 *
 * Every writer here and in the renderer builds the query with `encodeURIComponent`,
 * so a literal `+`, `&`, `#` or `%` in a filename arrives encoded and round-trips.
 */
const fs = require('fs');
const path = require('path');

/** `/project-file?path=<filePath>` — the read-side URL for a file on disk. */
function projectFileUrl(filePath) {
    return `/project-file?path=${encodeURIComponent(filePath)}`;
}

/**
 * Cache-busted variant for FRESHLY-WRITTEN output. A run that overwrites a reused
 * sequenced name (crop_001, combined_001…) at the same path would otherwise be served
 * the previous run's bytes from Chromium's <video>/<img> cache; the file's mtime gives
 * each write a fresh URL. Read-side callers (reconciler, thumbnails, latents) keep
 * plain `projectFileUrl`.
 */
function projectFileUrlBusted(filePath) {
    let mtime = 0;
    try { mtime = Math.round(fs.statSync(filePath).mtimeMs); } catch (_) { /* file just written; best-effort */ }
    return `${projectFileUrl(filePath)}&v=${mtime}`;
}

/**
 * The disk path inside a `/project-file?path=` URL (relative, or with an origin, and
 * with any extra params such as `&v=` or `&filename=`). Null when `value` is not such
 * a URL or carries no path.
 * @param {unknown} value
 * @returns {string|null}
 */
function projectFilePath(value) {
    const raw = typeof value === 'string' ? value : '';
    if (!raw.includes('project-file?')) return null;
    let url;
    try { url = new URL(raw, 'http://127.0.0.1'); } catch (_) { return null; }
    if (!url.pathname.endsWith('/project-file')) return null;
    return url.searchParams.get('path') || null;
}

/**
 * A `/project-file?path=` URL or an absolute disk path -> the disk path. Anything
 * else (empty, relative, not a string) -> null: a relative path would resolve against
 * the server's working directory, which is never what a caller meant.
 * @param {unknown} value
 * @returns {string|null}
 */
function diskPathOf(value) {
    const fromUrl = projectFilePath(value);
    if (fromUrl) return fromUrl;
    if (typeof value !== 'string' || !value || value.includes('project-file?')) return null;
    return path.isAbsolute(value) ? value : null;
}

module.exports = { projectFileUrl, projectFileUrlBusted, projectFilePath, diskPathOf };
