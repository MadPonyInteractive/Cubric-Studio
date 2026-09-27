'use strict';

/**
 * main/launcherHeal.cjs — install launcher scripts an update staged for the app (MPI-954).
 *
 * Update bundles never list a launcher (start.sh, update.sh, update-from-zip.*, …) in
 * files[]: they stage it under update/pending-launchers/ instead. The applier that runs an
 * update is the one ALREADY installed, and before 2.0 it wrote with copyFileSync, which
 * rewrites the destination's SAME inode; a shell executing that launcher then resumed at
 * its byte offset inside the new file, so a perfect 1.x -> 2.0 update reported FAILED.
 * Left out of files[], the running launcher is never touched. The app installs the new
 * ones here, at boot, with renameSync: the destination gets a NEW inode, so a shell still
 * reading the old file keeps its own fd.
 *
 * Non-fatal: a launcher that fails to move is logged and left in pending-launchers/, and
 * the next boot tries again. The old launcher still starts the app meanwhile.
 */

const fs = require('fs');
const path = require('path');

/**
 * @param {string|null} portableRoot  the portable install root, or null outside one
 * @param {{ info: Function, warn: Function }} logger
 */
function healPortableLaunchers(portableRoot, logger) {
    if (!portableRoot) return;
    const pendingDir = path.join(portableRoot, 'update', 'pending-launchers');
    if (!fs.existsSync(pendingDir)) return;
    let entries;
    try {
        entries = fs.readdirSync(pendingDir);
    } catch (err) {
        logger.warn('update', `launcher heal: cannot read pending-launchers: ${err.message}`);
        return;
    }
    for (const name of entries) {
        const src = path.join(pendingDir, name);
        const dest = path.join(portableRoot, name);
        try {
            const mode = fs.statSync(src).mode & 0o777;
            fs.renameSync(src, dest);
            // renameSync carries the source mode; re-assert +x as belt-and-braces.
            if (process.platform !== 'win32') fs.chmodSync(dest, mode | 0o111);
            logger.info('update', `launcher heal: installed ${name}`);
        } catch (err) {
            logger.warn('update', `launcher heal: failed for ${name}: ${err.message}`);
        }
    }
    try { fs.rmdirSync(pendingDir); } catch { /* not empty = a move failed; retried next boot */ }
}

module.exports = { healPortableLaunchers };
