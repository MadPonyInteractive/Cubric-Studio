/**
 * routes/engineScratch.js — empty the engine's ComfyUI input/ and output/ (MPI-778).
 *
 * Both folders are scratch for the ENGINE PROCESS, not for an app instance. The engine
 * root is repo-scoped and the port is fixed, so every instance on a checkout (the
 * user's `npm start`, each desktop spec, each `app:isolated`, each worktree) shares one
 * engine and these two folders (MPI-484). Only the instance that SPAWNED the engine may
 * empty them: its quit ends that engine (the server fork kills the handle it owns), so
 * nothing left there can still be consumed. Any other instance (attached to someone
 * else's engine, remote-only, or E2E, which never starts one) would delete the inputs a
 * live generation staged and the outputs it has not collected yet.
 *
 * Plain fs + sync on purpose: main.js calls this from `before-quit`, which cannot wait.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { getComfyPath } = require('./platformEngine');

/**
 * @param {string} engineRoot
 * @param {boolean} ownsEngine - this instance spawned the engine that is running now
 * @param {{info: Function}} logger
 * @returns {boolean} whether the folders were emptied
 */
function cleanEngineScratch(engineRoot, ownsEngine, logger) {
  if (!ownsEngine) {
    logger.info('comfy', 'Engine input/output left alone on quit: this instance did not start the engine');
    return false;
  }
  for (const dir of [getComfyPath(engineRoot, 'input'), getComfyPath(engineRoot, 'output')]) {
    if (!fs.existsSync(dir)) continue;
    // Empty the contents, keep the directory itself.
    for (const entry of fs.readdirSync(dir)) {
      fs.rmSync(path.join(dir, entry), { recursive: true, force: true });
    }
    logger.info('comfy', `Cleaned temp folder: ${dir}`);
  }
  return true;
}

module.exports = { cleanEngineScratch };
