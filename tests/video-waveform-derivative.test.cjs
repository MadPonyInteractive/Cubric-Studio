'use strict';

// MPI-829 — a video's audio, baked so the trim bar can paint it and an in/out point can
// be cut against a word or a beat.
//
// The waveform rides the SAME contract as an audio card's (MPI-730): an alpha mask,
// white-on-transparent, coloured by CSS vars. What is new here is the name and the gate:
//
//   * `<id>.wave.webp`, NOT `<id>.thumb.webp` — a video already owns the thumb name for
//     its poster, so sharing it would overwrite the poster with a waveform.
//   * it must be swept by BOTH `DERIVATIVE_RE` (delete, orphan sweep) and
//     `CLEANUP_DERIVATIVE_RE` (the pre-share slimming step), and the cleanup must null
//     the sidecar's `wavePath` with it — the backfill gates on the sidecar, never on
//     disk, so a nulled file with a live URL would 404 the mask forever.
//   * a SILENT clip must not bake one. That is the common case here, not the exception:
//     every text-to-video op emits a silent clip, and an ungated bake would spend an
//     ffmpeg run per generation to produce nothing.
//
// Asserts on PIXELS, like `audio-waveform-alpha.test.cjs` — a file that exists at the
// right name can still be a solid opaque rectangle, which paints as a filled block.

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('fs-extra');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { ffmpegPath } = require('../services/ffmpegBinary');
const { writeVideoDerivatives, extractVideoWaveform, VIDEO_WAVEFORM_PX, AUDIO_WAVEFORM_PX } = require('../services/ffmpegThumb');
const { DERIVATIVE_RE, cleanupRebuildableAssets } = require('../routes/projects.js');

// The cleanup regex is module-private on purpose, so it is exercised through the
// function that owns it rather than re-declared here (a copy would pass while the real
// one stayed wrong).
const CLEANUP_VIA_FUNCTION = cleanupRebuildableAssets;

/** The alpha plane as raw gray bytes — same read-back as MPI-730's test. */
function alphaBytes(file) {
    return execFileSync(ffmpegPath, [
        '-v', 'error', '-i', file,
        '-vf', 'alphaextract',
        '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'gray', '-',
    ], { maxBuffer: 64 * 1024 * 1024 });
}

/**
 * A real, decodable clip. 320x240 so it is under the proxy height and the transcode is
 * skipped — this test is about the wave, not the proxy.
 *
 * The audio is amplitude-modulated and driven hard for the same reason MPI-730's fixture
 * is: ffmpeg's `sine` peaks around -18 dBFS, so a bare tone draws a thin band and the
 * envelope assertion below would read as a broken filter when the filter is fine.
 */
function makeClip(dir, name, { audio }) {
    const out = path.join(dir, name);
    const args = ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'testsrc=s=320x240:r=24:d=3'];
    if (audio) {
        args.push('-f', 'lavfi', '-i', 'sine=f=440:d=3',
                  '-af', 'volume=7.0*abs(sin(2*PI*t/1.5))+0.05:eval=frame',
                  '-c:a', 'aac');
    } else {
        args.push('-an');
    }
    args.push('-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', out);
    execFileSync(ffmpegPath, args);
    return out;
}

test('the video wave is baked SHORTER than the audio card wave', () => {
    // The trim track is ~26px inside its border. At the card's 540 the browser averages
    // ~20 source rows per output pixel and the envelope smears into a soft band —
    // measured side by side at 540/160/80. Peaks and gaps are the entire point here, so
    // a regression back to the card height is a real loss of function, not a nicety.
    assert.ok(VIDEO_WAVEFORM_PX.h < AUDIO_WAVEFORM_PX.h,
        'the video wave is no shorter than the audio card wave — the trim bar will be blurry');
    assert.equal(VIDEO_WAVEFORM_PX.w, AUDIO_WAVEFORM_PX.w, 'width should still cover the widest bar');
});

test('extractVideoWaveform lands at <id>.wave.webp, never on the poster name', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mpi829-name-'));
    try {
        const clip = makeClip(dir, 'n.mp4', { audio: true });
        const base = path.join(dir, 'abc.thumb.jpg');
        const out = await extractVideoWaveform(clip, base);
        assert.equal(out, path.join(dir, 'abc.wave.webp'));
        // The poster owns `.thumb.` — a collision would overwrite it with a waveform.
        assert.equal(await fs.pathExists(path.join(dir, 'abc.thumb.webp')), false);
        assert.equal(await fs.pathExists(path.join(dir, 'abc.wave.jpg')), false, 'a JPG was left beside the WebP');
    } finally {
        await fs.remove(dir);
    }
});

test('both sweeps match <id>.wave.webp and capture the id', () => {
    const m = DERIVATIVE_RE.exec('abc-123.wave.webp');
    assert.ok(m, 'DERIVATIVE_RE does not match a wave file — delete would orphan it');
    assert.equal(m[1], 'abc-123', 'DERIVATIVE_RE captured the wrong owner id');
    // A sibling id must not be swept by another item's delete.
    assert.notEqual(DERIVATIVE_RE.exec('abc-124.wave.webp')[1], 'abc-123');
});

test('a clip WITH audio bakes a real mask at the wave name', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mpi829-audio-'));
    try {
        const clip = makeClip(dir, 'loud.mp4', { audio: true });
        const metaDir = path.join(dir, '.meta');
        await fs.ensureDir(metaDir);

        const out = await writeVideoDerivatives(clip, metaDir, 'vid1', {
            sourceWidth: 320, sourceHeight: 240, hasAudio: true,
        });

        assert.ok(out.wavePath, 'no wavePath was returned for a clip with audio');
        const waveAbs = path.join(metaDir, 'vid1.wave.webp');
        assert.ok(await fs.pathExists(waveAbs), 'the wave did not land at <id>.wave.webp');
        assert.ok(out.wavePath.includes(encodeURIComponent(waveAbs)),
            'wavePath is not the /project-file URL of the file written');

        // The poster is a SEPARATE file and still a poster — the two names must not have
        // collided, or the card would paint a waveform where the first frame belongs.
        assert.ok(await fs.pathExists(path.join(metaDir, 'vid1.thumb.webp')), 'poster missing');
        assert.notEqual(out.thumbPath, out.wavePath);

        // THE REGRESSION: it is a mask. All-opaque paints a solid block of ink across the
        // whole track, all-transparent paints nothing, and both pass a file-exists check.
        const alpha = alphaBytes(waveAbs);
        assert.ok(alpha.some(b => b <= 2), 'wave has no transparent pixel — it is a picture, not a mask');
        assert.ok(alpha.some(b => b >= 253), 'wave has no opaque pixel — nothing would paint');

        // And the envelope actually varies, rather than being a flat band that tells the
        // user nothing about where the sound is.
        const { w, h } = VIDEO_WAVEFORM_PX;
        assert.equal(alpha.length, w * h, 'wave is not the baked video-wave size');
        const extent = (x) => {
            let top = -1, bottom = -1;
            for (let y = 0; y < h; y++) if (alpha[y * w + x] > 8) { if (top < 0) top = y; bottom = y; }
            return top < 0 ? 0 : bottom - top + 1;
        };
        const heights = Array.from({ length: w }, (_, x) => extent(x));
        assert.ok(Math.max(...heights) > h * 0.5, 'wave is squashed into a thin band');
        assert.ok(Math.max(...heights) - Math.min(...heights) > h * 0.1, 'wave is flat — no envelope drew');
    } finally {
        await fs.remove(dir);
    }
});

test('a SILENT clip is never baked one, and an unprobed caller still tries', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mpi829-silent-'));
    try {
        const clip = makeClip(dir, 'quiet.mp4', { audio: false });
        const metaDir = path.join(dir, '.meta');
        await fs.ensureDir(metaDir);

        // hasAudio: false — the gate. No ffmpeg run, no file, no field.
        const gated = await writeVideoDerivatives(clip, metaDir, 'vid2', {
            sourceWidth: 320, sourceHeight: 240, hasAudio: false,
        });
        assert.equal(gated.wavePath, null, 'a silent clip was given a wavePath');
        assert.equal(await fs.pathExists(path.join(metaDir, 'vid2.wave.webp')), false,
            'a silent clip wrote a wave file');
        // The poster still lands — the gate must not have skipped the rest.
        assert.ok(gated.thumbPath, 'gating the wave also skipped the poster');

        // hasAudio undefined = an unprobed caller, which is not evidence of silence. It
        // attempts the bake and soft-fails to null rather than throwing.
        const unprobed = await writeVideoDerivatives(clip, metaDir, 'vid3', {
            sourceWidth: 320, sourceHeight: 240,
        });
        assert.equal(unprobed.wavePath, null, 'a silent clip must not produce a wave even unprobed');
        assert.ok(unprobed.thumbPath, 'the unprobed path broke the poster');
    } finally {
        await fs.remove(dir);
    }
});

test('cleanup drops the wave file AND nulls wavePath, so the backfill re-bakes it', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mpi829-clean-'));
    try {
        const metaDir = path.join(root, 'Media', '.meta');
        await fs.ensureDir(metaDir);
        await fs.writeFile(path.join(root, 'Media', 'vid_001.mp4'), 'master');
        await fs.writeFile(path.join(metaDir, 'vid_001.wave.webp'), 'derivative');
        await fs.writeFile(path.join(metaDir, 'vid_001.thumb.webp'), 'derivative');
        await fs.writeJson(path.join(metaDir, 'vid_001.json'), {
            id: 'vid_001',
            type: 'video',
            thumbPath: '/project-file?path=x.thumb.webp',
            wavePath: '/project-file?path=x.wave.webp',
        });

        await CLEANUP_VIA_FUNCTION(root);

        assert.equal(await fs.pathExists(path.join(metaDir, 'vid_001.wave.webp')), false,
            'cleanup left the wave file behind');
        const meta = await fs.readJson(path.join(metaDir, 'vid_001.json'));
        assert.equal(meta.wavePath, null,
            'cleanup deleted the wave but left wavePath set — the mask 404s forever, because '
            + 'the backfill gates on the sidecar and will never re-bake it');
        assert.ok(await fs.pathExists(path.join(root, 'Media', 'vid_001.mp4')), 'cleanup ate the master');
    } finally {
        await fs.remove(root);
    }
});
