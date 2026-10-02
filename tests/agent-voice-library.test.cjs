'use strict';

/**
 * agent-voice-library.test.cjs — MPI-1004, an agent passes a shipped library voice by id.
 *
 * Fabio, 2026-10-01: a voice line with no sample and no DramaBox goes to Text to Speech, which
 * cannot run without a voice, so Cosmo picks one from the library the picker already offers.
 * The renderer half is here: the catalogue lists each voice slot's voices, and a
 * `{ role, voice }` ref becomes the same placed WAV the picker makes (`voiceWavFile`). The loop's
 * card is in agent-loop.test.cjs (MPI-1004 block).
 *
 * MPI-1012 made Text to Speech the Chatterbox MODEL, so its voice slot is now a model OP's
 * (`tts`, `audio1`, the CommandDef slot's `voiceLibrary`) and the resolver takes the op
 * key where it took the FlowDef. Voice Changer keeps the Flow half of the same contract.
 */

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const { getFlowById } = require('../js/data/flowsRegistry.js');
const { slotVoices, resolveVoices, openFlow } = require('../js/shell/agentDispatch.js');
const { createVoiceLibrary } = require('../js/data/voiceLibrary.js');
const { state } = require('../js/state.js');
const { Events } = require('../js/events.js');

const MANIFEST = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'voices', 'manifest.json'), 'utf8'));
const LIB = createVoiceLibrary(MANIFEST);
const PROJECT = { id: 'p1', folderPath: 'C:/Projects/Test', itemGroups: [] };
const PLACED = `/project-file?path=${encodeURIComponent('C:/Projects/Test/Media/.preview-assets/abc.wav')}`;

// ── Browser stand-ins: the decode and the read are the browser's, the logic around them is ours.
class FakeAudioContext {
    constructor(channels, length, rate) { Object.assign(this, { length, rate, destination: {} }); }
    async decodeAudioData() { return { length: 4800, sampleRate: 48000, numberOfChannels: 1, getChannelData: () => new Float32Array(4800) }; }
    createBufferSource() { return { connect() {}, start() {} }; }
    async startRendering() { return { length: this.length, sampleRate: this.rate, numberOfChannels: 1, getChannelData: () => new Float32Array(this.length) }; }
}
class FakeFileReader {
    readAsDataURL(blob) {
        blob.arrayBuffer().then((b) => {
            this.result = `data:${blob.type};base64,${Buffer.from(b).toString('base64')}`;
            this.onload();
        });
    }
}

/** Serve the manifest, a sample and the store from stubs; record every request. */
async function withApp(fn) {
    const seen = [];
    const real = { fetch: global.fetch, ctx: global.OfflineAudioContext, reader: global.FileReader };
    global.OfflineAudioContext = FakeAudioContext;
    global.FileReader = FakeFileReader;
    global.fetch = async (url, init) => {
        seen.push({ url: String(url), body: init?.body ? JSON.parse(init.body) : null });
        if (url === '/voices/manifest.json') return { ok: true, json: async () => MANIFEST };
        if (String(url).startsWith('/voices/')) return { ok: true, blob: async () => new Blob([new Uint8Array(16)], { type: 'audio/ogg' }) };
        if (String(url).includes('/place-preview-asset')) return { ok: true, json: async () => ({ success: true, filePath: PLACED }) };
        return { ok: true, json: async () => ({}) };
    };
    try {
        return await fn(seen);
    } finally {
        Object.assign(global, { fetch: real.fetch, OfflineAudioContext: real.ctx, FileReader: real.reader });
    }
}

test('the catalogue lists a voice slot\'s voices: one row per performer, its variations as ids', () => {
    const tts = slotVoices('tts', LIB);
    assert.deepEqual(Object.keys(tts), ['audio1']);
    assert.equal(tts.audio1.length, new Set(MANIFEST.voices.map((v) => v.section)).size, 'a section is a performer');
    const old = tts.audio1.find((s) => s.name === 'Elderly Male');
    assert.deepEqual([old.gender, old.age], ['male', 'elderly']);
    assert.ok(old.ids.length > 1 && old.ids.every((id) => LIB.getVoice(id)?.section === 'elderly_male'));
    assert.equal(tts.audio1.flatMap((s) => s.ids).length, MANIFEST.voices.length, 'every voice listed once');
});

test('only the slot that declares the library lists it: Voice Changer\'s own performance never does', () => {
    assert.deepEqual(Object.keys(slotVoices(getFlowById('voice-changer'), LIB)), ['audio2']);
    assert.equal(slotVoices(getFlowById('minimax-music'), LIB), null);
    assert.equal(slotVoices('t2a', LIB), null, 'an op with no voice slot lists none');
    assert.equal(slotVoices('tts', null), null, 'no library loaded: no list, never a throw');
});

test('a voice ref becomes the placed WAV the picker makes, beside the refs it leaves alone', async () => {
    await withApp(async (seen) => {
        const other = { role: 'audio2', url: '/project-file?path=x.wav' };
        const r = await resolveVoices('tts', [{ role: 'audio1', voice: 'elderly_male_1' }, other], PROJECT, 'Chatterbox');
        assert.equal(r.ok, true, r.message);
        assert.deepEqual(r.media, [{ role: 'audio1', url: PLACED }, other]);
        assert.ok(seen.some((s) => s.url === `/voices/${LIB.getVoice('elderly_male_1').sample}`), 'the voice\'s own sample');
        const place = seen.find((s) => s.url.includes('/place-preview-asset'));
        assert.equal(place.body.ext, '.wav');
        const wav = Buffer.from(place.body.dataUrl.split(',')[1], 'base64');
        assert.equal(wav.toString('ascii', 0, 4) + wav.toString('ascii', 8, 12), 'RIFFWAVE', 'decoded, not the raw opus');
    });
});

test('no voice ref: nothing fetched, the media handed back as it came', async () => {
    await withApp(async (seen) => {
        const media = [{ role: 'audio1', url: '/project-file?path=x.wav' }];
        const r = await resolveVoices('tts', media, PROJECT, 'Chatterbox');
        assert.equal(r.media, media);
        assert.equal(seen.length, 0);
    });
});

test('an id the library lacks, or a slot with no library, is refused by name', async () => {
    await withApp(async () => {
        const bad = await resolveVoices('tts', [{ role: 'audio1', voice: 'no_such_voice' }], PROJECT, 'Chatterbox');
        assert.deepEqual([bad.ok, bad.code], [false, 'INVALID_VOICE']);
        assert.match(bad.message, /no_such_voice/);
        const own = await resolveVoices(getFlowById('voice-changer'), [{ role: 'audio1', voice: 'elderly_male_1' }], PROJECT);
        assert.deepEqual([own.code, own.message], ['INVALID_VOICE', 'Voice Changer\'s "audio1" slot takes no library voice.']);
    });
});

test('the open path resolves it too: the Flow opens with the voice in its slot', async () => {
    state.currentProject = PROJECT;
    const opened = [];
    const off = Events.on('flow:open', (p) => opened.push(p));
    try {
        await withApp(() => openFlow('job-open-voice', {
            flowId: 'voice-changer', follow: true,
            media: [{ role: 'audio2', voice: 'elderly_male_1' }],
        }));
    } finally {
        off();
    }
    assert.equal(opened.length, 1);
    assert.deepEqual(state.s_flowInputs?.['voice-changer']?.mediaItems?.map((m) => [m.role, m.url]), [['audio2', PLACED]]);
});
