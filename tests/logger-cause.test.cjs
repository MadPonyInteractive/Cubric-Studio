'use strict';

/**
 * logger-cause.test.cjs — MPI-817.
 *
 * Node's `fetch` and `http` put the real reason for a network failure one level down:
 * `TypeError: fetch failed` carries `cause.code === 'UND_ERR_HEADERS_TIMEOUT'`, and a stack
 * never prints its cause. So `logger.error(..., err)` wrote "fetch failed" and dropped the
 * one line that says why. The cause chain is part of the logged error now.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');

process.env.APP_USER_DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'cubric-logger-cause-'));
const logger = require('../routes/logger.js');

test('an error is logged WITH its cause chain, codes included', () => {
    const root = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:1'), { code: 'ECONNREFUSED' });
    const mid = Object.assign(new Error('headers timed out'), { code: 'UND_ERR_HEADERS_TIMEOUT', cause: root });
    logger.error('test', 'a loopback call failed', new TypeError('fetch failed', { cause: mid }));

    const logged = logger.getRecentLogs();
    assert.match(logged, /fetch failed/);
    assert.match(logged, /cause: .*UND_ERR_HEADERS_TIMEOUT/);
    assert.match(logged, /cause: .*ECONNREFUSED/, 'the whole chain, not just one level');
});

test('an error with no cause logs exactly as before', () => {
    logger.error('test', 'plain', new Error('no cause here'));
    const lines = logger.getRecentLogs().split('\n');
    const at = lines.findIndex((l) => l.includes('[test] plain'));
    assert.ok(at >= 0);
    assert.doesNotMatch(lines.slice(at).join('\n'), /cause:/);
});
