'use strict';
/**
 * tests/trim-silence.test.cjs — the silence stripped off the START of a recorded take (MPI-999).
 *
 * Run: node --test tests/trim-silence.test.cjs
 *
 * `js/utils/trimSilence.js` is import-free, so it loads in bare Node with no microphone
 * and no browser. The last group reads source instead: the trim must live ONLY on the
 * recorder's path, because toWavFile.js is shared with the voice library and would
 * otherwise cut a voice file the user uploaded.
 *
 * START ONLY (Fabio, 2026-09-30): the dead air is in front of the first word. Everything
 * from the first sound to the end of the take is kept as recorded.
 */

const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

const RATE = 48000;

let trimSilence;
let TRIM;
before(async () => {
    ({ trimSilence, TRIM } = await import('../js/utils/trimSilence.js'));
});

/** ms -> samples, the way the code under test rounds it. */
const ms = (n, rate = RATE) => Math.round(rate * n / 1000);

/** Deterministic hiss in [-amp, amp] so a failure reproduces. */
function hiss(amp) {
    let seed = 1234567;
    return () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return ((seed / 0xFFFFFFFF) * 2 - 1) * amp;
    };
}

/**
 * Build a take from segments: `{ silence: seconds }` or `{ tone: seconds, amp }`.
 * `floor` adds hiss under the whole take, as a real mic has.
 */
function take(segments, { floor = 0, rate = RATE } = {}) {
    const noise = floor ? hiss(floor) : () => 0;
    const total = segments.reduce((n, s) => n + Math.round((s.silence ?? s.tone) * rate), 0);
    const out = new Float32Array(total);
    let at = 0;
    for (const s of segments) {
        const n = Math.round((s.silence ?? s.tone) * rate);
        for (let i = 0; i < n; i++) {
            out[at + i] = noise() + (s.tone ? Math.sin(2 * Math.PI * 220 * i / rate) * s.amp : 0);
        }
        at += n;
    }
    return out;
}

/** The kept take runs from `start` to the END of the take, always. */
function assertCutAt(r, pcm, start) {
    assert.equal(r.start, start);
    assert.equal(r.samples.length, pcm.length - start, 'everything after the cut is kept');
}

describe('the start is trimmed, to a pad in front of the sound', () => {
    test('silence / tone / silence: the lead goes, the tail stays', () => {
        const pcm = take([{ silence: 1 }, { tone: 1, amp: 0.5 }, { silence: 1 }]);
        const r = trimSilence(pcm, RATE);

        // The tone starts at 1.0 s on a frame boundary, so the bound is exact.
        assertCutAt(r, pcm, RATE - ms(TRIM.padLeadMs));
        // The kept piece starts on the pad's silence, carries the tone whole, and ends
        // on the take's own trailing silence.
        assert.equal(r.samples[0], 0);
        assert.deepEqual(r.samples.subarray(ms(TRIM.padLeadMs), ms(TRIM.padLeadMs) + RATE), pcm.subarray(RATE, 2 * RATE));
        assert.equal(r.samples[r.samples.length - 1], pcm[pcm.length - 1]);
    });

    test('the pad is the number the header says: 150 ms, and there is no tail setting', () => {
        assert.equal(TRIM.padLeadMs, 150);
        assert.equal(TRIM.padTailMs, undefined, 'the end of a take is never trimmed');
    });

    test('the result is a view of the take, not a copy', () => {
        const pcm = take([{ silence: 1 }, { tone: 1, amp: 0.5 }, { silence: 1 }]);
        const r = trimSilence(pcm, RATE);
        assert.equal(r.samples.buffer, pcm.buffer);
        assert.equal(r.samples[ms(TRIM.padLeadMs) + 100], pcm[r.start + ms(TRIM.padLeadMs) + 100]);
    });

    test('the pad scales with the sample rate', () => {
        const rate = 16000;
        const pcm = take([{ silence: 1 }, { tone: 1, amp: 0.5 }, { silence: 1 }], { rate });
        assertCutAt(trimSilence(pcm, rate), pcm, rate - ms(TRIM.padLeadMs, rate));
    });

    test('a take that starts on sound is unchanged, however much silence follows it', () => {
        const pcm = take([{ tone: 1, amp: 0.5 }, { silence: 3 }]);
        const r = trimSilence(pcm, RATE);
        assert.equal(r.start, 0);
        assert.equal(r.samples, pcm);
    });
});

describe('pauses inside the take are timing and stay', () => {
    test('a one second gap between two tones is kept whole', () => {
        const pcm = take([
            { silence: 1 }, { tone: 0.5, amp: 0.5 }, { silence: 1 }, { tone: 0.5, amp: 0.5 }, { silence: 1 },
        ]);
        const r = trimSilence(pcm, RATE);
        assertCutAt(r, pcm, RATE - ms(TRIM.padLeadMs));
        assert.deepEqual(r.samples.subarray(ms(TRIM.padLeadMs)), pcm.subarray(RATE));
    });
});

describe('a take with nothing to trim comes back unchanged', () => {
    test('all silence is never emptied', () => {
        const pcm = new Float32Array(RATE * 3);
        const r = trimSilence(pcm, RATE);
        assert.equal(r.start, 0);
        assert.equal(r.samples, pcm);
    });

    test('a take of hiss and nothing else is left alone, quiet or not', () => {
        // Under the floor: there is no sound to anchor a threshold to.
        const faint = take([{ silence: 3 }], { floor: 0.0004 });
        assert.equal(trimSilence(faint, RATE).samples, faint);
        // Above the floor: every frame is as loud as the loudest, so none is "silence".
        const loud = take([{ silence: 3 }], { floor: 0.05 });
        assert.equal(trimSilence(loud, RATE).samples, loud);
    });

    test('a blip under the floor in digital silence is not mistaken for the take', () => {
        // Relative to ITSELF a -80 dBFS blip is the loudest thing in the clip. The floor
        // is what stops the trim from cutting an empty take down to it.
        const pcm = take([{ silence: 1 }, { tone: 0.3, amp: 0.0001 }, { silence: 1 }]);
        const r = trimSilence(pcm, RATE);
        assert.equal(r.start, 0);
        assert.equal(r.samples, pcm);
    });

    test('no silence at all is unchanged', () => {
        const pcm = take([{ tone: 3, amp: 0.5 }]);
        assert.equal(trimSilence(pcm, RATE).samples, pcm);
    });

    test('a lead shorter than the pad is unchanged, not shaved', () => {
        const pcm = take([{ silence: 0.1 }, { tone: 1, amp: 0.5 }, { silence: 0.1 }]);
        const r = trimSilence(pcm, RATE);
        assert.equal(r.start, 0);
        assert.equal(r.samples, pcm);
    });

    test('an empty or near-empty take does not throw and is unchanged', () => {
        for (const n of [0, 1, ms(20), ms(40)]) {
            const pcm = new Float32Array(n).fill(0.5);
            const r = trimSilence(pcm, RATE);
            assert.equal(r.start, 0, `length ${n}`);
            assert.equal(r.samples.length, n, `length ${n}`);
        }
    });
});

describe('the threshold follows the take, not a fixed level', () => {
    test('a quiet take, peak 0.004 (-48 dBFS), is trimmed just like a loud one', () => {
        // A fixed -40 dB gate would call the whole of this silence. Relative to its own
        // peak the tone is 30+ dB above the hiss and the lead goes.
        const pcm = take([{ silence: 1 }, { tone: 1, amp: 0.004 }, { silence: 1 }], { floor: 0.00002 });
        assertCutAt(trimSilence(pcm, RATE), pcm, RATE - ms(TRIM.padLeadMs));
    });

    test('hiss under a loud take does not move the cut', () => {
        const pcm = take([{ silence: 1 }, { tone: 1, amp: 0.5 }, { silence: 1 }], { floor: 0.002 });
        assertCutAt(trimSilence(pcm, RATE), pcm, RATE - ms(TRIM.padLeadMs));
    });
});

describe('a click is not sound', () => {
    test('a one-sample click and a 3 ms pop in the lead do not stop the trim', () => {
        const pcm = take([{ silence: 1 }, { tone: 1, amp: 0.5 }, { silence: 1 }]);
        pcm[ms(300)] = 1;                                              // 1 sample
        for (let i = 0; i < ms(3); i++) pcm[ms(600) + i] = 0.9;        // 3 ms pop
        assertCutAt(trimSilence(pcm, RATE), pcm, RATE - ms(TRIM.padLeadMs));
    });

    test('even a click louder than the speech (a quiet voice, a hard pop) does not become the start', () => {
        // The click sets the loudest frame, which lowers the bar the real voice must
        // clear - it still clears it, and the click is still one frame long.
        const pcm = take([{ silence: 1 }, { tone: 1, amp: 0.02 }, { silence: 1 }]);
        pcm[ms(300)] = 1;
        assertCutAt(trimSilence(pcm, RATE), pcm, RATE - ms(TRIM.padLeadMs));
    });
});

describe('the trim lives on the recorder path only', () => {
    test('toWavFile.js (shared with the voice library) and wavEncoder.js never trim', () => {
        assert.doesNotMatch(read('js/utils/toWavFile.js'), /trimSilence/,
            'toWavFile is shared with MpiMediaPicker: trimming there would cut an UPLOADED voice file');
        assert.doesNotMatch(read('js/utils/wavEncoder.js'), /trimSilence/);
    });

    test('the dictation path (speech-to-text for the agent box) never trims', () => {
        assert.doesNotMatch(read('js/services/dictation.js'), /trimSilence/);
    });

    test('the recorder trims the take before the preview is built, and Accept saves that same audio', () => {
        const src = read('js/components/Blocks/MpiAudioRecorder/MpiAudioRecorder.js');
        assert.match(src, /import \{ trimSilence \} from '\.\.\/\.\.\/\.\.\/utils\/trimSilence\.js'/);
        assert.match(src, /import \{ encodeWav \} from '\.\.\/\.\.\/\.\.\/utils\/wavEncoder\.js'/);
        // The trim runs in onstop, ahead of _buildPlayback: what plays is what is saved.
        const onstop = src.slice(src.indexOf('_recorder.onstop'), src.indexOf('_recorder.start()'));
        assert.ok(onstop.indexOf('trimRecording(') > -1, 'onstop must trim the take');
        assert.ok(onstop.indexOf('trimRecording(') < onstop.indexOf('_buildPlayback()'),
            'the take must be trimmed BEFORE the review preview is built');
        // Accept hands over the trimmed file rather than decoding the raw take again.
        const accept = src.slice(src.indexOf("acceptBtn.on('click'"), src.indexOf('actions.appendChild(acceptBtn.el)'));
        assert.match(accept, /_wav \|\| await toWavFile\(_blob\)/);
    });
});
