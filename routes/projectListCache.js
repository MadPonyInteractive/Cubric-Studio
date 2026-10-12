'use strict';

/**
 * projectListCache.js — the landing's per-project cover and asset stats, cached (MPI-1058).
 *
 * POST /list-projects picked each project's cover by reading EVERY sidecar of EVERY project
 * (2,234 files, 17 MB of JSON for 76 projects, measured 2026-10-12) on every visit to the
 * landing, then the landing asked GET /project-stats once per row. The parse held the
 * server's event loop for ~1 s, so the boot checks sent at the same moment waited behind it
 * (/comfy/models/check: 60 ms alone, 1,030 ms beside the list), and the 76 stats calls
 * queued behind the list on the two connections the renderer's event streams leave free.
 *
 * Both answers depend only on what is IN the project's Media and Media/.meta folders, and a
 * card being added, removed or re-saved creates, deletes or renames an entry there (sidecars
 * are written tmp + rename), which moves that folder's mtime. So those two mtimes, plus
 * project.json's, are the cache key: a hit costs three stats instead of a scan.
 *
 * ponytail: a media file rewritten IN PLACE under the same name moves no folder mtime, so
 * its new size shows on the landing only after the next card lands. A cover whose sidecar
 * points OUTSIDE its own project (a copied card) is not re-checked if that outside file goes.
 * Key on a content hash if either ever shows up as a wrong number.
 */

const fs = require('fs-extra');
const path = require('path');

/** What GET /project-stats counts as a project's assets (its project mode). */
const MEDIA_EXTS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'mp4', 'webm', 'mov', 'avi', 'mp3', 'wav', 'ogg', 'flac', 'm4a']);

/** Count and total size of the media files directly in `mediaDir` (sidecars and derivatives skipped). */
async function mediaStats(mediaDir) {
    if (!(await fs.pathExists(mediaDir))) return { count: 0, bytes: 0 };
    let count = 0;
    let bytes = 0;
    for (const name of await fs.readdir(mediaDir)) {
        if (name === '.meta' || name.endsWith('.json')) continue;
        if (!MEDIA_EXTS.has(path.extname(name).toLowerCase().slice(1))) continue;
        try {
            const stat = await fs.stat(path.join(mediaDir, name));
            if (!stat.isFile()) continue;
            count++;
            bytes += stat.size;
        } catch { /* gone between readdir and stat */ }
    }
    return { count, bytes };
}

/** mediaDir -> { key, value } */
const _cache = new Map();

// project.json rides the key too: a sidecar healed IN PLACE on open (no folder entry moves)
// still comes with a project save.
async function _folderKey(mediaDir) {
    const mtime = p => fs.stat(p).then(s => s.mtimeMs, () => 0);
    const keys = await Promise.all([
        mtime(mediaDir), mtime(path.join(mediaDir, '.meta')), mtime(path.join(mediaDir, '..', 'project.json')),
    ]);
    return keys.join(':');
}

/**
 * The landing row's cover and stats for one project. `findCover(mediaDir)` is
 * routes/projects.js `findRecentProjectThumbnail`, passed in because that module requires
 * this one. The key is read BEFORE the scan, so a write landing mid-scan only makes the
 * next call scan again.
 *
 * @returns {Promise<{ recentThumbnail: string|null, recentThumbnailType: string|null, stats: { count: number, bytes: number } }>}
 */
async function projectSummary(mediaDir, findCover) {
    const key = await _folderKey(mediaDir);
    const hit = _cache.get(mediaDir);
    if (hit && hit.key === key) return hit.value;
    const [cover, stats] = await Promise.all([
        findCover(mediaDir).catch(() => ({ recentThumbnail: null, recentThumbnailType: null })),
        mediaStats(mediaDir),
    ]);
    const value = { recentThumbnail: cover.recentThumbnail, recentThumbnailType: cover.recentThumbnailType, stats };
    _cache.set(mediaDir, { key, value });
    return value;
}

module.exports = { projectSummary, mediaStats, MEDIA_EXTS };
