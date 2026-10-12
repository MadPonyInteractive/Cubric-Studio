/**
 * srt.test.cjs — MPI-1071. The Transcribe Flow's text box shows the SRT with its cue
 * numbers and times taken out; a sentence the node split over two cues reads as one.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

let srtToText, isSrt;
test.before(async () => {
    ({ srtToText, isSrt } = await import(pathToFileURL(path.join(__dirname, '..', 'js', 'utils', 'srt.js')).href));
});

test('cue numbers and times are dropped, cues join with a space', () => {
    const srt = '1\r\n00:00:00,030 --> 00:00:03,500\r\nHello there, this is\r\n\r\n'
        + '2\r\n00:00:03,500 --> 00:00:06,000\r\nCubric Studio.\r\nSecond line.\r\n';
    assert.strictEqual(srtToText(srt), 'Hello there, this is Cubric Studio. Second line.');
});

test('a numeric line of speech survives (only the line before the timing is the index)', () => {
    assert.strictEqual(srtToText('1\n00:00:00,000 --> 00:00:01,000\n42\n'), '42');
});

test('isSrt tells a transcript from a plain describe answer', () => {
    assert.strictEqual(isSrt('1\r\n00:00:00,000 --> 00:00:01,000\r\nHi\r\n'), true);
    assert.strictEqual(isSrt('A cat on a mat. 10:00 --> later'), false);
    assert.strictEqual(isSrt(''), false);
});

test('empty and non-SRT input', () => {
    assert.strictEqual(srtToText(''), '');
    assert.strictEqual(srtToText(null), '');
    assert.strictEqual(srtToText('just words'), 'just words');
});
