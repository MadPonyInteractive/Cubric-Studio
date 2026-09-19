/**
 * One swept scratch root for unit-test fixtures, so a test that builds a
 * project-shaped folder does not leave it in the temp ROOT forever.
 *
 * The leak this closes (MPI-810 -> MPI-813): six fixtures `mkdtemp`-ed straight
 * into `os.tmpdir()` and wrote a `project.json` inside, with cleanup sitting
 * AFTER the assertions — so every failing or throwing path littered. Measured
 * 2026-09-18: 970 folders, 1034 five hours later, 1042 when they were swept.
 *
 * Layout is `<tmpdir>/cubric-tests/<pid>/` — the per-pid level is deliberate.
 * `node --test` gives each test FILE its own process, so a pid directory is a
 * per-file sandbox: the isolation the old flat layout had by accident, kept on
 * purpose. What crashes past the exit hook still leaves one directory to `rm`.
 *
 * Cleanup mirrors `sandbox-roots.cjs`: `process.on('exit')` + a synchronous
 * `rmSync`. Nothing here is deferred to a promise — a floating `remove()` that
 * lands while a test is still writing is exactly the shape of the unexplained
 * `.meta directory missing` that sank the first attempt at this card, and a
 * sync exit hook cannot have it. An open handle (EBUSY) is swallowed: the
 * leftovers are temp files under one sweepable root, never worth a red test.
 */
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');

const ROOT = path.join(os.tmpdir(), 'cubric-tests', String(process.pid));
fs.mkdirSync(ROOT, { recursive: true });
process.on('exit', () => {
    try { fs.rmSync(ROOT, { recursive: true, force: true }); } catch { /* best effort */ }
});

/** `fs.mkdtemp` under the scratch root — the drop-in for `path.join(os.tmpdir(), prefix)`. */
async function scratchDir(prefix) {
    return fs.promises.mkdtemp(path.join(ROOT, prefix));
}

/** Sync twin, for a fixture that is not in an async context. */
function scratchDirSync(prefix) {
    return fs.mkdtempSync(path.join(ROOT, prefix));
}

/** A path inside the scratch root for a LOOSE file (no directory is created). */
function scratchPath(name) {
    return path.join(ROOT, name);
}

module.exports = { ROOT, scratchDir, scratchDirSync, scratchPath };
