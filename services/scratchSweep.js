'use strict';

/**
 * The one age-based scratch sweep (MPI-1302, AUDIT D10). Nine routes and services each
 * wrote the same readdir → stat → "older than N" → remove loop; they differ only in the
 * age, whether files or run directories are swept, and (engine scratch) which names.
 */

const path = require('path');
const fs = require('fs-extra');

/**
 * Remove entries of `dir` last modified more than `maxAgeMs` ago. Best effort: a missing
 * dir, an entry that vanished mid-sweep or a locked file is skipped, never thrown.
 *
 * @param {string} dir
 * @param {number | ((name: string) => number | null)} maxAgeMs  a number, or a per-name
 *   age where `null` leaves that entry alone
 * @param {{ only?: 'file' | 'dir', now?: number }} [opts]  `only` sweeps just files or
 *   just directories (default: either); `now` is for tests
 */
async function sweepOlderThan(dir, maxAgeMs, { only, now = Date.now() } = {}) {
    for (const name of await fs.readdir(dir).catch(() => [])) {
        const keep = typeof maxAgeMs === 'function' ? maxAgeMs(name) : maxAgeMs;
        if (keep == null) continue;
        const entry = path.join(dir, name);
        const stat = await fs.stat(entry).catch(() => null);
        if (!stat || now - stat.mtimeMs <= keep) continue;
        if (only === 'file' && !stat.isFile()) continue;
        if (only === 'dir' && !stat.isDirectory()) continue;
        await fs.remove(entry).catch(() => {});
    }
}

module.exports = { sweepOlderThan };
