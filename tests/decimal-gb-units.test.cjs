'use strict';

// MPI-763 — storage sizes print in decimal GB (1 GB = 1e9 bytes), the unit RunPod, Hugging
// Face and macOS use. The disk-full toast and the Model Library printed binary GB beside the
// decimal Pod disk bar, so one 55 GB volume read "51.2 GB" in the toast and "55GB" on the bar.
// Dep `size` STRINGS are still 1024-based data (parsed by sizeToGb); only display changed.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const root = path.join(__dirname, '..');

test('formatBytes prints decimal units', async () => {
    const { formatBytes } = await import(pathToFileURL(path.join(root, 'js', 'utils', 'formatBytes.js')).href);
    assert.equal(formatBytes(55e9), '55.0GB');
    assert.equal(formatBytes(512e6), '512MB');
    // A '20GB' dep string is 20 × 1024³ bytes on disk: 21.5 decimal GB.
    assert.equal(formatBytes(20 * 1024 ** 3), '21.5GB');
});

test('formatSpeed prints decimal units, so a size and its speed agree', async () => {
    const { formatSpeed } = await import(pathToFileURL(path.join(root, 'js', 'utils', 'formatBytes.js')).href);
    assert.equal(formatSpeed(2.5e6), '2.5 MB/s');
    assert.equal(formatSpeed(640e3), '640 KB/s');
    assert.equal(formatSpeed(512), '512 B/s');
    assert.equal(formatSpeed(undefined), '0 B/s');
    // 2.5 MiB/s read "2.5 MB/s" under the old 1024-based copies.
    assert.equal(formatSpeed(2.5 * 1024 ** 2), '2.6 MB/s');
});

test('the server speed labels come from the shared formatSpeed', () => {
    for (const rel of ['routes/downloadManager.js', 'routes/shared.js', 'js/services/downloadService.js']) {
        const src = fs.readFileSync(path.join(root, rel), 'utf8');
        assert.ok(!/function _formatSpeed\(/.test(src), `${rel} defines its own _formatSpeed again`);
        assert.ok(/formatSpeed/.test(src) && /utils\/formatBytes\.js/.test(src), `${rel} no longer uses formatBytes.js formatSpeed`);
    }
});

test('the server disk-full / free-space formatter divides by 1e9', () => {
    // _fmtGb is module-internal to an express route file, so source-read it (the
    // disk-full-message.test.cjs convention) and evaluate just that body.
    const src = fs.readFileSync(path.join(root, 'routes', 'downloadManager.js'), 'utf8');
    const m = src.match(/function _fmtGb\(bytes\) \{([\s\S]*?)\r?\n\}/);
    assert.ok(m, '_fmtGb moved or was renamed — re-anchor this test');
    const fmtGb = new Function('bytes', m[1]);
    assert.equal(fmtGb(55e9), '55.0 GB');
});
