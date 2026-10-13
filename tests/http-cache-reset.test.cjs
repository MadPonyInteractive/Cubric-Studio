// MPI-1120 — every run starts on a NEW HTTP disk cache.
//
// A run killed mid-write (crash, End Task, Ctrl+C twice) left Chromium's disk cache
// broken: images and videos failed with ERR_CACHE_READ_FAILURE and queued ~16 s each,
// so the landing took ~30 s. session.clearCache() at window creation did not repair it;
// only deleting the folder did. The delete must come after the single-instance lock (a
// second launch must not pull the cache from under the running one) and before any
// window loads (Chromium then holds the files open and Windows refuses the delete).
//
// main.js only runs inside Electron, so this is a source check, like
// gallery-card-teardown.test.cjs.

const assert = require('node:assert');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');

test('the HTTP cache folder is deleted after the lock and before the app is ready', () => {
    const reset = SRC.indexOf("fs.rmSync(path.join(app.getPath('sessionData'), 'Cache')");
    const lock = SRC.indexOf('const gotTheLock = app.requestSingleInstanceLock();');
    const elseBranch = SRC.indexOf('} else {', lock);
    const ready = SRC.indexOf("app.on('ready'");
    assert.ok(reset !== -1, 'main.js no longer deletes the HTTP cache at start');
    assert.ok(lock !== -1 && ready !== -1, 'main.js lost its lock or ready hook');
    assert.ok(reset > elseBranch, 'the cache is deleted before the lock is known to be ours');
    assert.ok(reset < ready, 'the cache is deleted after windows may already have opened it');
});
