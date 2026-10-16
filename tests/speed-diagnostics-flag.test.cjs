'use strict';

// MPI-1142 — the speed/stall diagnostics ([slow-load], [held-load], [health], the server's
// held-request list, the net log) sit behind ONE flag, off by default, so the next
// investigation flips `speed_diagnostics` in dev_configs/app_config.js (or launches with
// CUBRIC_SPEED_DIAG=1) instead of re-adding them. main.js cannot import that ESM file and
// reads the literal with a regex, so the line's shape is part of the contract.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

test('speed_diagnostics ships off, in the shape main.js reads', () => {
    const cfg = read('dev_configs/app_config.js');
    const line = cfg.match(/^\s*speed_diagnostics:\s*(true|false)\b.*$/m);
    assert.ok(line, 'main.js finds the literal with /^\\s*speed_diagnostics:\\s*true\\b/m');
    assert.equal(line[1], 'false', 'diagnostics must ship OFF');
    assert.match(line[0], /CUBRIC_SPEED_DIAG === '1'/, 'the env override stays on the same line');
    assert.match(read('main.js'), /speed_diagnostics:\\s\*true\\b\/m/, 'main.js reads the same literal');
});

test('every diagnostic is gated on the flag', () => {
    const main = read('main.js');
    assert.match(main, /if \(SPEED_DIAG\) trackHeldLoads\(\);/, '[held-load]');
    assert.match(main, /if \(netLogStarted \|\| app\.isPackaged \|\| !SPEED_DIAG\) return;/, 'net log');
    assert.match(read('server.js'), /if \(process\.env\.CUBRIC_SPEED_DIAG === '1'\) app\.use\(require\('\.\/routes\/heldRequests'\)\.trackHeldRequests\)/, 'held-request list');
    const init = read('js/init.js');
    assert.match(init, /if \(APP_CONFIG\.speed_diagnostics\) \{\s*installSlowLoadLog\(\);\s*installHealthLog\(\);\s*\}/, '[slow-load] + [health]');
    assert.equal((init.match(/installSlowLoadLog\(\)|installHealthLog\(\)/g) || []).length, 2, 'no ungated second call');
});
