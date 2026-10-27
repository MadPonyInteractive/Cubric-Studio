'use strict';

/**
 * MPI-1302 (AUDIT D10) — the one trim input seek behind crop, GIF, reverse, resize and extract.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { trimArgs } = require('../services/ffmpegBinary');

test('a valid window seeks before -i', () => {
    assert.deepEqual(trimArgs(1.5, 4), ['-ss', '1.5', '-to', '4']);
    assert.deepEqual(trimArgs('0', '2'), ['-ss', '0', '-to', '2']);
});

test('no window, a half window or out <= in means no seek', () => {
    for (const [a, b] of [[undefined, undefined], [1, undefined], [3, 3], [4, 2], ['x', 2]]) {
        assert.deepEqual(trimArgs(a, b), [], `${a}..${b}`);
    }
});
