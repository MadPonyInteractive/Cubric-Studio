'use strict';

/**
 * routes/devMode.js — dev_mode, server-side (MPI-1300).
 *
 * Mirrors dev_configs/app_config.js: on when js/core/buildInfo.js still says BUILD_HASH 'dev'
 * (a source run) and CUBRIC_DEV_MODE is not 'off' (`npm start nodev`). A staged portable build
 * stamps a real hash, so a release always reads false. The hash is read once; the env var is
 * read per call so a test can flip it.
 */

const fs = require('fs');
const path = require('path');

const _isDevBuild = (() => {
    try {
        const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'core', 'buildInfo.js'), 'utf8');
        const m = src.match(/BUILD_HASH\s*=\s*['"]([^'"]+)['"]/);
        return (m ? m[1] : 'dev') === 'dev';
    } catch { return false; } // default off — never open a dev door on a build we can't read
})();

function devMode() {
    return _isDevBuild && process.env.CUBRIC_DEV_MODE !== 'off';
}

module.exports = { devMode };
