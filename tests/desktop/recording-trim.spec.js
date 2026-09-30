const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('./launch');

/**
 * MPI-999 — a recorded take has the silence at its START trimmed in the RENDERER, before review.
 *
 * `trimSilence()` is pure and unit-tested in bare Node (tests/trim-silence.test.cjs).
 * What bare Node cannot reach is the half around it: `trimRecording()` decodes the
 * take with `OfflineAudioContext`, mixes it to mono and re-encodes it. That is the
 * half this spec drives, in the real Electron renderer, with a synthetic clip rather
 * than the mic (the fake-device flag is not wired into this harness, and the thing
 * under test is the decode and the cut, not getUserMedia). The end of the take is kept
 * as recorded (Fabio, 2026-09-30: the dead air is in front of the first word).
 *
 * Stereo on purpose: the tone sits in the LEFT channel only, so a mixdown that read
 * channel 0 alone and one that averaged would both pass a mono clip. The averaged tone
 * is half as loud and must still be found, because the threshold is relative to the
 * take's own peak.
 */
test.setTimeout(120000);

test('a take comes back with its lead cut to the pad, its tail kept, decoded and re-encoded as WAV', async ({}, testInfo) => {
    let app, window;
    try {
        ({ app, window } = await launchApp(testInfo));
        await window.waitForTimeout(6000); // shell boot settles

        const r = await window.evaluate(async () => {
            const [{ trimRecording }, { encodeWav }, { TRIM }] = await Promise.all([
                import('/js/components/Blocks/MpiAudioRecorder/MpiAudioRecorder.js'),
                import('/js/utils/wavEncoder.js'),
                import('/js/utils/trimSilence.js'),
            ]);

            // 5 s at 48k, stereo: 1.5 s silence, 2 s tone on the left only, 1.5 s silence.
            const RATE = 48000;
            const left = new Float32Array(RATE * 5);
            const right = new Float32Array(RATE * 5);
            for (let i = RATE * 1.5; i < RATE * 3.5; i++) left[i] = Math.sin(i / 8) * 0.5;
            const wav = encodeWav({
                numberOfChannels: 2, length: left.length, sampleRate: RATE,
                getChannelData: (c) => (c === 0 ? left : right),
            });

            const out = await trimRecording(new Blob([wav], { type: 'audio/wav' }));
            if (!out) return { error: 'trimRecording returned null' };

            // Read the saved file back: it is what Accept hands over.
            const back = await new OfflineAudioContext(1, 1, RATE)
                .decodeAudioData(await out.file.arrayBuffer());

            const silent = await trimRecording(new Blob([encodeWav({
                numberOfChannels: 1, length: RATE * 2, sampleRate: RATE,
                getChannelData: () => new Float32Array(RATE * 2),
            })], { type: 'audio/wav' }));

            return {
                name: out.file.name, type: out.file.type,
                seconds: out.seconds, trimmed: out.trimmedSeconds,
                backSeconds: back.length / RATE,
                expected: 5 - 1.5 + TRIM.padLeadMs / 1000,
                silentSeconds: silent?.seconds, silentTrimmed: silent?.trimmedSeconds,
            };
        });

        expect(r.error).toBeUndefined();
        expect(r.name).toBe('recording.wav');
        expect(r.type).toBe('audio/wav');
        // The envelope grid is 10 ms, so the cut lands within one frame of the pads.
        expect(Math.abs(r.seconds - r.expected)).toBeLessThan(0.02);
        expect(Math.abs(r.trimmed - (5 - r.expected))).toBeLessThan(0.02);
        expect(Math.abs(r.backSeconds - r.seconds)).toBeLessThan(0.001);
        // All silence is kept whole, never emptied.
        expect(r.silentSeconds).toBeCloseTo(2, 3);
        expect(r.silentTrimmed).toBe(0);
    } finally {
        await closeApp(app);
    }
});
