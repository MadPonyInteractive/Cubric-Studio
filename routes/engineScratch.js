/**
 * routes/engineScratch.js — empty the engine's ComfyUI input/ and output/ (MPI-778, MPI-1144).
 *
 * Both folders are scratch for the ENGINE PROCESS, not for an app instance. The engine
 * root is repo-scoped and the port is fixed, so every instance on a checkout (the
 * user's `npm start`, each desktop spec, each `app:isolated`, each worktree) shares one
 * engine and these two folders (MPI-484).
 *
 * They are emptied at ONE moment: when this server is about to spawn the engine
 * (`/comfy/start`). Only an instance that found no engine running gets there, and with
 * no engine nothing can be reading a staged input or waiting to collect an output. On
 * quit the engine was still alive (it dies only after main exits), so the old quit-time
 * clean deleted under a live engine and, on Windows, threw EPERM on a file it still held
 * open — a fatal dialog on every such quit (MPI-1144).
 *
 * An entry that cannot go (Windows refuses to delete a file ANY process holds open, and a
 * staged input is a hardlink sharing the project file) stays until the next start.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { getComfyPath } = require('./platformEngine');

/**
 * @param {string} engineRoot
 * @param {{info: Function, warn: Function}} logger
 * @returns {number} how many entries could not be removed
 */
function cleanEngineScratch(engineRoot, logger) {
  let left = 0;
  for (const dir of [getComfyPath(engineRoot, 'input'), getComfyPath(engineRoot, 'output')]) {
    if (!fs.existsSync(dir)) continue;
    // Empty the contents, keep the directory itself.
    for (const entry of fs.readdirSync(dir)) {
      try {
        fs.rmSync(path.join(dir, entry), { recursive: true, force: true });
      } catch (err) {
        left++;
        logger.warn('comfy', `could not clear ${path.join(dir, entry)} (${err.code || err.message}): stays until the next engine start`);
      }
    }
    logger.info('comfy', `Cleaned temp folder: ${dir}`);
  }
  return left;
}

module.exports = { cleanEngineScratch };
