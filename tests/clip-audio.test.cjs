'use strict';

/**
 * tests/clip-audio.test.cjs — a clip's sound cut into pieces a transcriber takes (MPI-1169).
 *
 * DeepInfra refuses more than 60 s, so a long clip goes as several pieces, each keeping its
 * start so the transcript can stamp lines with the clip's own time. A clip with no sound
 * answers null, which the route turns into NO_AUDIO.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { ffmpegPath } = require('../services/ffmpegBinary');
const { cutAudio, stamp } = require('../services/clipAudio');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'clip-audio-'));
test.after(() => fs.rmSync(dir, { recursive: true, force: true }));

const video = (d) => ['-f', 'lavfi', '-i', `color=c=gray:s=64x48:d=${d}:r=4`];

test('a 130 s clip with sound is cut into three pieces at 0, 60 and 120 s', async () => {
    const clip = path.join(dir, 'long.mp4');
    execFileSync(ffmpegPath, ['-v', 'error', ...video(130), '-f', 'lavfi', '-i', 'sine=frequency=440:duration=130',
        '-shortest', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-y', clip], { windowsHide: true });

    const pieces = await cutAudio(clip, dir);
    assert.deepEqual(pieces.map((p) => p.start), [0, 60, 120]);
    for (const p of pieces) {
        assert.match(p.path, /\.wav$/);
        assert.ok(fs.existsSync(p.path), 'each piece is written');
    }
    // Mono 16 kHz 16-bit PCM is 32,000 bytes a second: a full piece ~60 s, the last ~10 s.
    const seconds = (p) => fs.statSync(p.path).size / 32000;
    assert.ok(Math.abs(seconds(pieces[0]) - 60) < 1, 'a full piece is 60 s of mono 16 kHz');
    assert.ok(Math.abs(seconds(pieces[2]) - 10) < 1, 'the last piece holds only the clip\'s last ten seconds');
});

test('a clip with no sound answers null', async () => {
    const clip = path.join(dir, 'silent.mp4');
    execFileSync(ffmpegPath, ['-v', 'error', ...video(2), '-pix_fmt', 'yuv420p', '-y', clip], { windowsHide: true });
    assert.equal(await cutAudio(clip, dir), null);
});

test('stamp writes a line\'s place in the clip as m:ss', () => {
    assert.equal(stamp(0), '0:00');
    assert.equal(stamp(75), '1:15');
    assert.equal(stamp(120), '2:00');
});
