/**
 * maskTempPrune.cjs — MPI-1074
 *
 * Boot-time prune of the mask layer TEMP store (`%TEMP%\cubric-<uuid>`, one per app
 * instance; docs/masking.md § Storage). A dir is stale only when the instance that owns
 * it is gone. Pruning every dir but our own wiped a LIVE peer's persisted masks: each
 * `app:isolated` boot (own profile, own port, no single-instance lock between them)
 * deleted the developer's running app's dir. So each instance stamps its main-process
 * PID into its dir at boot, and the prune skips a dir whose PID is still alive.
 *
 * Kept out of main.js so it can be tested without Electron.
 */

'use strict';

const fs = require('fs');
const path = require('path');

// Only a mask session's own `cubric-<uuid>`: temp also holds cubric-deepinfra (paid
// cloud outputs), cubric-agent, cubric-gif, cubric-tests and cubric-agent-profile,
// and a bare `cubric-` prefix wiped them all at every launch (MPI-919).
const SESSION_DIR = /^cubric-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OWNER_FILE = 'owner.json';

function pidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err.code === 'EPERM'; // exists, just not ours to signal
  }
}

function writeOwnerMarker(dir, pid = process.pid) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, OWNER_FILE), JSON.stringify({ pid, startedAt: new Date().toISOString() }));
}

// No readable marker: written by a build before MPI-1074, which may still be RUNNING
// (the developer's live app while agents boot the new code). Only an unmarked dir left
// untouched this long goes.
const UNMARKED_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

// ponytail: PID only, no start-time check. A reused PID keeps a dead dir until that
// process exits too: a leak of temp PNGs, never a loss. Compare process start times if
// leaked dirs ever pile up.
function isStale(dir, isAlive = pidAlive, selfPid = process.pid, now = Date.now()) {
  let pid;
  try {
    pid = JSON.parse(fs.readFileSync(path.join(dir, OWNER_FILE), 'utf8')).pid;
  } catch {
    return now - fs.statSync(dir).mtimeMs > UNMARKED_GRACE_MS;
  }
  if (!Number.isInteger(pid) || pid === selfPid) return true; // our PID on another dir = a dead predecessor's reused PID
  return !isAlive(pid);
}

/**
 * @param {string} tmpRoot - app.getPath('temp')
 * @param {string} ownName - this instance's `cubric-<uuid>`
 * @param {{info: Function, warn: Function}} logger
 * @param {(pid: number) => boolean} [isAlive]
 */
function pruneStaleMaskTemp(tmpRoot, ownName, logger, isAlive = pidAlive) {
  try {
    for (const entry of fs.readdirSync(tmpRoot, { withFileTypes: true })) {
      if (!entry.isDirectory() || !SESSION_DIR.test(entry.name) || entry.name === ownName) continue;
      const dir = path.join(tmpRoot, entry.name);
      try {
        if (!isStale(dir, isAlive)) continue;
        fs.rmSync(dir, { recursive: true, force: true });
        logger.info('mask-temp', `Pruned stale session dir: ${dir}`);
      } catch (err) {
        logger.warn('mask-temp', `Failed to prune ${dir}: ${err.message}`);
      }
    }
  } catch (err) {
    logger.warn('mask-temp', `pruneStaleMaskTemp failed: ${err.message}`);
  }
}

module.exports = { pruneStaleMaskTemp, writeOwnerMarker, isStale, pidAlive };
