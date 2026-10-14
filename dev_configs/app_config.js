/**
 * app_config.js — Global Development Configuration Constants
 *
 * RULES FOR AGENTS:
 * - This file contains constants meant to be toggled by developers manually.
 * - This is for DEV flags, feature flags, or diagnostic settings.
 * - Do NOT store runtime user preferences here (use localStorage for that).
 *
 * dev_mode is DERIVED, not hand-toggled: it is on for source/dev runs and off
 * for any staged portable build. `scripts/build-portable.mjs` stamps a real Git
 * hash into js/core/buildInfo.js, so a release artifact automatically reports
 * dev_mode === false. main.js mirrors this derivation from buildInfo.js (it
 * cannot import this ESM module). Do not change dev_mode to a literal — that
 * reintroduces the "forgot to flip before release" risk.
 *
 * `npm start nodev` runs a source build as users see it: main.js turns the
 * `nodev` arg into CUBRIC_DEV_MODE=off, which the forked server and the window
 * (nodeIntegration) inherit. It can only turn dev_mode OFF, never on.
 */

import { BUILD_HASH } from '../js/core/buildInfo.js';

export const APP_CONFIG = {
    // True only in source/dev runs (BUILD_HASH === 'dev'); false in staged builds.
    dev_mode: BUILD_HASH === 'dev' && globalThis.process?.env?.CUBRIC_DEV_MODE !== 'off',
    // Restores the last-visited page on browser refresh (dev convenience).
    // Manual dev toggle — never ships meaningfully (only acts in dev_mode UI).
    test_styles: false
};
