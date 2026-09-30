'use strict';
// MPI-923: Wan 3.0 takes every input in ONE typed `media` list — first/last frame on i2v,
// references on ref2v. The slots a user sees must match what the route can send.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { MODELS } = require('../js/data/modelConstants/models.js');
const { _wanMediaPlan, _wanMediaUrl } = require('../routes/deepinfra.js');
const { estimateRunCost, cloudRunFields } = require('../js/services/cloudExecutor.js');

const img = (p, role = null) => ({ mediaType: 'image', role, path: p });
const plan = (op, media) => _wanMediaPlan(op, media).map(e => `${e.type}:${e.item.path}`);

test('i2v sends a first frame and an optional last frame; a slot role beats strip order', () => {
    assert.deepEqual(plan('i2v', [img('a')]), ['first_frame:a']);
    assert.deepEqual(plan('i2v', [img('a'), img('b')]), ['first_frame:a', 'last_frame:b']);
    assert.deepEqual(plan('i2v', [img('b', 'endFrame'), img('a', 'startFrame')]), ['first_frame:a', 'last_frame:b']);
    assert.deepEqual(plan('i2v', [img('b', 'endFrame'), img('a')]), ['first_frame:a', 'last_frame:b']);
});

test('ref2v sends every item as a typed reference, in strip order', () => {
    const media = [img('i1'), { mediaType: 'video', path: 'v1' }, img('i2'), { mediaType: 'audio', path: 'a1' }];
    assert.deepEqual(plan('ref2v', media),
        ['reference_image:i1', 'reference_video:v1', 'reference_image:i2', 'reference_audio:a1']);
});

test('ops without media slots send none, so a stray chip cannot become a frame', () => {
    assert.deepEqual(plan('t2v', [img('a')]), []);
});

test('wan3-cloud shows ref2v\'s image/video/audio wells and i2v\'s end frame; Wan 5B does not', async () => {
    const { getCommand, filterMediaInputsForModel } = await import('../js/data/commandRegistry.js');
    const wan3 = MODELS.find(m => m.id === 'wan3-cloud');
    const keys = (op, model) => filterMediaInputsForModel(getCommand(op).mediaInputs, model).map(s => s.key);
    const ref = filterMediaInputsForModel(getCommand('ref2v').mediaInputs, wan3);
    assert.deepEqual(['image', 'video', 'audio'].map(t => ref.filter(s => s.mediaType === t).length), [9, 3, 3]);
    assert.equal(ref.find(s => s.key === 'inputVideo2').tag, 'Video 2', 'tags are the names Wan reads');
    assert.deepEqual(keys('i2v', wan3), ['startFrame', 'endFrame']);
    for (const m of MODELS.filter(m => m.supportedOps?.includes('i2v') && m.id !== 'wan3-cloud')) {
        assert.deepEqual(keys('i2v', m), ['startFrame'], `${m.id} has no end frame to take`);
    }
});

test('the renderer sends every staged item with its type and slot role, as disk paths', () => {
    const wan3 = MODELS.find(m => m.id === 'wan3-cloud');
    const { media, imagePaths } = cloudRunFields(wan3, {}, [
        { mediaType: 'image', role: 'endFrame', url: '/project-file?path=C%3A%5Cp%5Cend.png' },
        { mediaType: 'video', url: 'C:/p/ref.mp4' },
        { mediaType: 'audio', role: 'inputAudio', filePath: 'C:/p/voice.wav' },
    ]);
    assert.deepEqual(media.map(m => [m.mediaType, m.role]), [['image', 'endFrame'], ['video', null], ['audio', 'inputAudio']]);
    assert.equal(media[0].path, 'C:\\p\\end.png');
    assert.deepEqual(imagePaths, ['C:\\p\\end.png'], 'imagePaths still lists the images alone');
});

// Measured 2026-09-30: a 6.9 s reference video + a 5 s clip at 480p billed 11.9 s ($0.595),
// against a $0.25 quote. The length is unknown before the run, so the quote is the ceiling.
test('a reference video is quoted as a ceiling: 15 s a video, 30 s in all', () => {
    const wan3 = MODELS.find(m => m.id === 'wan3-cloud');
    const params = { Input_Duration: 5, Width: 854, Height: 480 };
    const plain = estimateRunCost(wan3, params, [{ mediaType: 'image', url: 'C:/p/a.png' }]);
    const one = estimateRunCost(wan3, params, [{ mediaType: 'video', url: 'C:/p/a.mp4' }]);
    const three = estimateRunCost(wan3, params, [1, 2, 3].map(n => ({ mediaType: 'video', url: `C:/p/${n}.mp4` })));
    assert.match(plain.display, /^about /);
    assert.ok(Math.abs(one.usd - plain.usd * 20 / 5) < 1e-9, `${one.usd} vs ${plain.usd}`);
    assert.ok(Math.abs(three.usd - plain.usd * 30 / 5) < 1e-9, 'capped at 30 s');
    assert.match(one.display, /^up to \$/);
});

test('video and audio go as data URLs; a type or size Wan refuses is refused before sending', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mpi923-'));
    const file = (name, bytes) => { const p = path.join(dir, name); fs.writeFileSync(p, bytes); return p; };
    const clip = await _wanMediaUrl({ mediaType: 'video', path: file('c.mp4', Buffer.from('x')) });
    assert.equal(clip.url, `data:video/mp4;base64,${Buffer.from('x').toString('base64')}`);
    assert.match((await _wanMediaUrl({ mediaType: 'audio', path: file('v.mp3', 'x') })).url, /^data:audio\/mpeg;base64,/);
    assert.match((await _wanMediaUrl({ mediaType: 'video', path: file('c.webm', 'x') })).refusal, /MP4 or MOV/);
    assert.match((await _wanMediaUrl({ mediaType: 'audio', path: file('c.mp4', 'x') })).refusal, /WAV or MP3/);
    const big = file('big.wav', Buffer.alloc(15 * 1024 * 1024 + 1));
    assert.match((await _wanMediaUrl({ mediaType: 'audio', path: big })).refusal, /15 MB/);
    fs.rmSync(dir, { recursive: true, force: true });
});
