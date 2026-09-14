/**
 * toWavFile.js — any decodable audio Blob → 16-bit 48 kHz mono WAV File.
 *
 * Shared by the mic recorder (MpiAudioRecorder) and the voice library
 * (MpiMediaPicker). It lives here rather than in the recorder because both are
 * Compounds, and a Compound imports Primitives only. It stays out of
 * wavEncoder.js, which is import-free so it can be tested in bare Node.
 */

import { encodeWav } from './wavEncoder.js';
import { clientLogger } from '../services/clientLogger.js';

/**
 * Voice capture is mono, and no audio model in the app is fed above 48 kHz.
 * Anything the mic offers beyond this is bytes on disk and bytes uploaded to the
 * Pod on every generation, for nothing.
 */
const WAV_RATE = 48000;

/**
 * Decode whatever MediaRecorder produced and re-mux it as a 16-bit 48 kHz mono
 * WAV File. See MpiAudioRecorder's header for why the container is changed rather
 * than kept.
 *
 * The rate and the downmix are the point of the OfflineAudioContext (MPI-573):
 * `decodeAudioData` resamples to the context's own rate, and rendering into a
 * 1-channel destination downmixes. A live `new AudioContext()` decodes at the
 * HARDWARE rate instead — measured 96 kHz stereo on this machine, 23 MB/min, four
 * times the bytes with nothing a mic can put in them. WAV is kept deliberately:
 * a lossy round trip before a voice clone costs quality in the one workflow the
 * recorder exists for, and ComfyUI's audio loaders take WAV with no transcode.
 * EXPORTED because the voice library needs the identical treatment (MPI-622). Its samples
 * are `.opus`, and `opus` is missing from four of the five extension lists that classify a
 * file as audio — the same class of bug as the `.webm` one in MpiAudioRecorder's header, which
 * is why this function exists at all. Decoding the sample here hands the Flow slot a WAV: the one container every
 * list already knows, and the exact bytes a recording produces, so a library pick and a
 * recording reach the graph as the same kind of file.
 *
 * @param {Blob} blob
 * @param {string} [name='recording.wav'] Filename for the returned File. Keep the .wav.
 * @returns {Promise<File|null>} null if the blob could not be decoded.
 */
export async function toWavFile(blob, name = 'recording.wav') {
    try {
        const decoded = await new OfflineAudioContext(1, 1, WAV_RATE)
            .decodeAudioData(await blob.arrayBuffer());
        const off = new OfflineAudioContext(1, decoded.length, WAV_RATE);
        const src = off.createBufferSource();
        src.buffer = decoded;
        src.connect(off.destination);
        src.start();
        return new File([encodeWav(await off.startRendering())], name, { type: 'audio/wav' });
    } catch (err) {
        clientLogger.warn('audio-recorder', `wav encode failed: ${err?.message || err}`);
        return null;
    }
}
