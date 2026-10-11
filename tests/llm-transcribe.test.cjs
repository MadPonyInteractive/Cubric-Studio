'use strict';

/**
 * llm-transcribe.test.cjs — MPI-1071, speech to text on Ollama's Gemma 4 12B.
 *
 * The request shape is the one measured on 2026-10-11 (routes/llm.js): the WAV as bare base64 in
 * `images`, thinking off, temperature 0. The WAV itself comes from the bundled ffmpeg, so the
 * conversion runs for real on a generated WebM/Opus tone.
 */

const assert = require('node:assert/strict');
const test = require('node:test');
const { execFileSync } = require('node:child_process');

const { transcribeChat, _toWav } = require('../routes/llm.js');
const { ffmpegPath } = require('../services/ffmpegBinary');

test('transcribe asks gemma4:12b with the audio in images, thinking off', () => {
    const body = transcribeChat('QUJD');
    assert.equal(body.model, 'gemma4:12b');
    assert.equal(body.think, false);
    assert.equal(body.stream, false);
    assert.equal(body.options.temperature, 0);
    // Stays loaded between takes (Fabio: a reload per take is too slow); a local generation clears it.
    assert.equal(body.keep_alive, undefined);
    assert.deepEqual(body.messages[0].images, ['QUJD']);
    assert.match(body.messages[0].content, /^Transcribe this audio verbatim\./);
    assert.doesNotMatch(body.messages[0].content, /Words the speaker/);
});

test('words to expect are appended; blank words add nothing', () => {
    assert.match(transcribeChat('x', { words: ' Cubric Studio ' }).messages[0].content, /Words the speaker may use: Cubric Studio\.$/);
    assert.doesNotMatch(transcribeChat('x', { words: '   ' }).messages[0].content, /Words/);
});

test('translate asks for English out', () => {
    assert.match(transcribeChat('x', { translate: true }).messages[0].content, /^Translate the speech in this audio into English\./);
});

test('a WebM/Opus recording becomes 16 kHz mono WAV', async () => {
    const webm = execFileSync(ffmpegPath, ['-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=1:sample_rate=48000',
        '-ac', '2', '-c:a', 'libopus', '-f', 'webm', 'pipe:1'], { windowsHide: true });
    const wav = await _toWav(webm);
    assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
    assert.equal(wav.toString('ascii', 8, 12), 'WAVE');
    assert.equal(wav.readUInt16LE(22), 1);        // channels
    assert.equal(wav.readUInt32LE(24), 16000);    // sample rate
});

test('bytes ffmpeg cannot read reject instead of hanging', async () => {
    await assert.rejects(_toWav(Buffer.from('not audio at all')), /ffmpeg/);
});
