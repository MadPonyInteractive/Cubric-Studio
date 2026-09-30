'use strict';
// MPI-910: Seedance 2.0 takes each input in its own named field. Images and audio go inline;
// a reference VIDEO goes by public URL only, so it is parked on our relay (relay.cubric.studio)
// for the call and DELETED when the call ends, success or not (cubric.studio/privacy/).
// Every fetch here is stubbed: nothing reaches the relay or DeepInfra.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const sharp = require('sharp');
const { ffmpegPath } = require('../services/ffmpegBinary');
const { MODELS } = require('../js/data/modelConstants/models.js');
const { _seedanceFields, _dropClips } = require('../routes/deepinfra.js');
const { estimateRunCost } = require('../js/services/cloudExecutor.js');

const seedance = MODELS.find(m => m.id === 'seedance-2-cloud');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mpi910-'));
const ff = (args, name) => { const p = path.join(dir, name); execFileSync(ffmpegPath, ['-v', 'error', '-y', ...args, p]); return p; };
// ffmpeg's plain mp4 puts `moov` AFTER the media: the shape the relay refuses unremuxed.
const clip = (s, name) => ff(['-f', 'lavfi', '-i', `testsrc=size=64x64:rate=24:duration=${s}`, '-c:v', 'mpeg4'], name);
const wav = (s, name) => ff(['-f', 'lavfi', '-i', `sine=frequency=440:duration=${s}`], name);
const png = async (name) => {
    const p = path.join(dir, name);
    await sharp({ create: { width: 8, height: 8, channels: 3, background: '#f00' } }).png().toFile(p);
    return p;
};
const RELAY = 'https://relay.cubric.studio';

/** Stub every fetch; record each call. `relay(status)` answers a PUT. */
function stubFetch({ putStatus = 201, inference = null } = {}) {
    const real = global.fetch;
    const calls = [];
    let n = 0;
    global.fetch = async (url, init = {}) => {
        url = String(url);
        if (url.startsWith('http://127.0.0.1')) return real(url, init);
        calls.push({ url, method: init.method || 'GET', init });
        if (url === `${RELAY}/v1/clip` && init.method === 'PUT') {
            const id = `${String(++n).padStart(32, '0')}.mp4`;
            const body = putStatus === 201 ? { ok: true, url: `${RELAY}/v1/clip/${id}`, deleteToken: `tok${n}`, expiresAt: 0 } : { ok: false, error: 'RATE_LIMIT' };
            return new Response(JSON.stringify(body), { status: putStatus });
        }
        if (url.startsWith(`${RELAY}/v1/clip/`) && init.method === 'DELETE') return new Response('{"ok":true}', { status: 200 });
        if (url.startsWith('https://api.deepinfra.com/v1/inference/') && inference) return inference(url, init);
        if (url === 'https://out.example/clip.mp4') return new Response(fs.readFileSync(clip(1, 'out.mp4')), { status: 200 });
        throw new Error(`unexpected fetch ${url}`);
    };
    return { calls, restore: () => { global.fetch = real; } };
}

test('seedance-2-cloud shows ref2v\'s 9/3/3 wells and i2v\'s end frame', async () => {
    const { getCommand, filterMediaInputsForModel } = await import('../js/data/commandRegistry.js');
    const ref = filterMediaInputsForModel(getCommand('ref2v').mediaInputs, seedance);
    assert.deepEqual(['image', 'video', 'audio'].map(t => ref.filter(s => s.mediaType === t).length), [9, 3, 3]);
    assert.deepEqual(filterMediaInputsForModel(getCommand('i2v').mediaInputs, seedance).map(s => s.key), ['startFrame', 'endFrame']);
    assert.ok(seedance.supportedOps.includes('ref2v'));
});

test('the @ picker writes @image1 for Seedance and <Image 1> for every other tagged model', async () => {
    const { refTagHandle, matchRefTagQuery } = await import('../js/data/commandRegistry.js');
    const wan3 = MODELS.find(m => m.id === 'wan3-cloud');
    assert.equal(refTagHandle('Image 1', seedance), '@image1');
    assert.equal(refTagHandle('Video 2', seedance), '@video2');
    assert.equal(refTagHandle('Audio 3', seedance), '@audio3');
    assert.equal(refTagHandle('Image 1', wan3), '<Image 1>');
    assert.equal(refTagHandle('Picture 1', null), '<Picture 1>');
    // Typing the handle itself still finds the reference.
    assert.deepEqual(matchRefTagQuery('the dance of @video', 19, [{ tag: 'Image 1' }, { tag: 'Video 1' }]).matches.map(m => m.tag), ['Video 1']);
    assert.deepEqual(MODELS.filter(m => m.capabilities?.atRefTags).map(m => m.id), ['seedance-2-cloud']);
});

test('i2v sends first_frame_image and last_frame_image as data URLs, and touches no relay', async () => {
    const f = stubFetch();
    try {
        const clips = [];
        const out = await _seedanceFields('i2v', [
            { mediaType: 'image', role: 'endFrame', path: await png('end.png') },
            { mediaType: 'image', role: 'startFrame', path: await png('start.png') },
        ], clips);
        assert.deepEqual(Object.keys(out.fields).sort(), ['first_frame_image', 'last_frame_image']);
        assert.match(out.fields.first_frame_image, /^data:image\/png;base64,/);
        assert.equal(f.calls.length, 0);
        assert.equal(clips.length, 0);
    } finally { f.restore(); }
});

test('ref2v: images and audio inline, the video remuxed faststart and parked on the relay, then deleted', async () => {
    const f = stubFetch();
    try {
        const clips = [];
        const out = await _seedanceFields('ref2v', [
            { mediaType: 'image', path: await png('face.png') },
            { mediaType: 'video', path: clip(3, 'motion.mp4') },
            { mediaType: 'audio', path: wav(3, 'voice.wav') },
        ], clips);
        assert.equal(out.refusal, undefined, out.refusal);
        assert.match(out.fields.reference_images[0], /^data:image\/png;base64,/);
        assert.match(out.fields.reference_audios[0], /^data:audio\/wav;base64,/);
        assert.deepEqual(out.fields.reference_videos, [`${RELAY}/v1/clip/${'1'.padStart(32, '0')}.mp4`]);

        const put = f.calls.find(c => c.method === 'PUT');
        const sent = Buffer.from(put.init.body);
        assert.ok(sent.indexOf('moov') > 0 && sent.indexOf('moov') < sent.indexOf('mdat'), 'moov must come first');
        assert.equal(clips.length, 1);

        await _dropClips(clips);
        const del = f.calls.find(c => c.method === 'DELETE');
        assert.equal(del.url, out.fields.reference_videos[0]);
        assert.equal(del.init.headers.Authorization, 'Bearer tok1');
        assert.equal(clips.length, 0, 'the list is emptied');
    } finally { f.restore(); }
});

test('every refusal lands before any upload: audio alone, a clip too short, too much video in all', async () => {
    const f = stubFetch();
    try {
        const refuse = async (media) => (await _seedanceFields('ref2v', media, [])).refusal;
        assert.match(await refuse([{ mediaType: 'audio', path: wav(3, 'a.wav') }]), /alongside a reference image or video/);
        assert.match(await refuse([{ mediaType: 'video', path: clip(1, 'short.mp4') }]), /2 to 15 seconds/);
        assert.match(await refuse([{ mediaType: 'video', path: clip(8, 'v1.mp4') }, { mediaType: 'video', path: clip(8, 'v2.mp4') }]),
            /at most 15 seconds of reference video/);
        assert.match(await refuse([{ mediaType: 'video', path: path.join(dir, 'x.webm') }]), /MP4 or MOV/);
        assert.equal(f.calls.length, 0, 'nothing was uploaded');
    } finally { f.restore(); }
});

test('a relay refusal is a refusal, with nothing parked', async () => {
    const f = stubFetch({ putStatus: 429 });
    try {
        const clips = [];
        const out = await _seedanceFields('ref2v', [{ mediaType: 'video', path: clip(3, 'rl.mp4') }], clips);
        assert.match(out.refusal, /Wait a minute/);
        assert.equal(clips.length, 0);
    } finally { f.restore(); }
});

/** POST the real route with a stubbed provider; returns what DeepInfra was sent. */
async function runRoute(inference) {
    const express = require('express');
    const app = express();
    app.use(express.json());
    app.use(require('../routes/deepinfra.js'));
    const server = await new Promise(r => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
    process.env.DEEPINFRA_API_KEY = 'test-key';
    let sentBody = null;
    const f = stubFetch({ inference: async (url, init) => { sentBody = JSON.parse(init.body); return inference(); } });
    try {
        const res = await fetch(`http://127.0.0.1:${server.address().port}/deepinfra/generate`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ modelId: 'seedance-2-cloud', operation: 'ref2v', prompt: 'the dance from Video 1',
                qualityTier: '480p', ratioLabel: '16:9', duration: 5, media: [{ mediaType: 'video', path: clip(3, 'route.mp4') }] }),
        });
        return { json: await res.json(), sentBody, calls: f.calls };
    } finally {
        f.restore();
        delete process.env.DEEPINFRA_API_KEY;
        server.close();
    }
}

test('the route deletes the parked clip when the call FAILS', async () => {
    const { json, sentBody, calls } = await runRoute(() => new Response('{"detail":"boom"}', { status: 500 }));
    assert.equal(json.ok, false);
    assert.equal(sentBody.reference_videos.length, 1);
    assert.deepEqual(calls.filter(c => c.method === 'DELETE').map(c => c.url), sentBody.reference_videos);
});

test('the route deletes the parked clip when the call SUCCEEDS', async () => {
    const { json, sentBody, calls } = await runRoute(() => new Response(JSON.stringify({ video_url: 'https://out.example/clip.mp4', inference_status: { cost: 0.5 } }), { status: 200 }));
    assert.equal(json.ok, true);
    assert.deepEqual(calls.filter(c => c.method === 'DELETE').map(c => c.url), sentBody.reference_videos);
});

test('a reference video moves the quote to the "with video" band plus a 15 s ceiling, as "up to"', () => {
    const params = { Input_Duration: 5, Width: 864, Height: 496 };
    const plain = estimateRunCost(seedance, params, [{ mediaType: 'image', url: 'C:/p/a.png' }]);
    const withVideo = estimateRunCost(seedance, params, [{ mediaType: 'video', url: 'C:/p/a.mp4' }]);
    assert.match(plain.display, /^about /);
    assert.match(withVideo.display, /^up to \$/);
    // tokens over 5 + 15 s at $4.70/M against 5 s at $7.70/M.
    const tokens = (s) => Math.floor(864 * 496 * (24 * s + 1) / 1024);
    assert.ok(Math.abs(plain.usd - tokens(5) * 7.7 / 1e6) < 1e-9, `${plain.usd}`);
    assert.ok(Math.abs(withVideo.usd - tokens(20) * 4.7 / 1e6) < 1e-9, `${withVideo.usd}`);
});

test.after(() => fs.rmSync(dir, { recursive: true, force: true }));
