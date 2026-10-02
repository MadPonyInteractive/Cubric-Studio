'use strict';
/**
 * MPI-1012 P6 — the smoke runner's MODEL-op leg handles audio, and its install leg
 * survives the MPI-513 job pruning. Pure: no app, no Pod, no network; the real
 * registry and the real workflow files on disk.
 *
 * 1. A required non-image slot gets its fixture. Chatterbox's `tts` has a required audio
 *    voice; the runner used to SKIP every op whose required input was not an image.
 * 2. Audio outputs count. A model op scored media on images/gifs/videos only, so a
 *    Sound & Music run that rendered would FAIL as "completed but produced no media".
 * 3. A finished install job is pruned from /comfy/downloads/status (done after a resync
 *    confirms it or 120 s, failed after 30 s). The probe read "absent" as "not registered
 *    yet" and waited out its 3-hour budget; and the failure scan after the loop missed an
 *    earlier model's pruned failure, so a GPU was rented over a missing weight.
 */

const path = require('node:path');
const assert = require('node:assert/strict');
const { test, before } = require('node:test');

const REPO = path.resolve(__dirname, '..');
let prepOp, loadRegistry, countMedia, installProbe, reg;

before(async () => {
    const url = `file:///${path.join(REPO, 'scripts', 'smoke-workflows.mjs').replace(/\\/g, '/')}`;
    ({ prepOp, loadRegistry, countMedia, installProbe } = await import(url));
    reg = await loadRegistry();
});

const model = (id) => reg.MODELS.find(m => m.id === id);
const nodeTitled = (graph, title) => Object.values(graph).find(n => n?._meta?.title === title);

// ── 1. required audio slot ───────────────────────────────────────────────────

test('prepOp chatterbox/tts: SKIP with no audio fixture, the voice lands on Input_Audio with one', () => {
    const skip = prepOp(reg, model('chatterbox'), 'tts', { image: '/pod/probe.png' });
    assert.equal(skip.status, 'SKIP');
    assert.match(skip.why, /audio/, `the SKIP names the missing fixture, got: ${skip.why}`);

    const r = prepOp(reg, model('chatterbox'), 'tts', { image: '/pod/probe.png', audio: '/pod/smoke-probe.wav' });
    assert.ok(!r.status, `expected a graph, got ${r.status}: ${r.why}`);
    const voice = nodeTitled(r.graph, 'Input_Audio');
    assert.ok(Object.values(voice.inputs).includes('/pod/smoke-probe.wav'),
        `the audio probe must reach the voice loader, got ${JSON.stringify(voice.inputs)}`);
});

test('prepOp stable-audio-3/t2a: needs no fixture, and the length budget applies', () => {
    const r = prepOp(reg, model('stable-audio-3'), 't2a', { image: '/pod/probe.png' });
    assert.ok(!r.status, `t2a takes no media; got ${r.status}: ${r.why}`);
    assert.ok(r.applied.includes('Input_Duration=1'), `a 190 s clip must not be smoked at full length, applied: ${r.applied}`);
});

test('every audio model op preps offline with the fixture set the runner stages', () => {
    const probes = { image: '/p.png', video: '/p.mp4', audio: '/p.wav' };
    const audio = reg.MODELS.filter(m => m.mediaType === 'audio');
    assert.ok(audio.length >= 2, `expected the audio models, found ${audio.map(m => m.id)}`);
    for (const m of audio) {
        for (const op of m.supportedOps) {
            const r = prepOp(reg, m, op, probes);
            assert.ok(!r.status, `${m.id}/${op}: ${r.status} ${r.why}`);
        }
    }
});

// ── 2. audio outputs count ───────────────────────────────────────────────────

test('countMedia counts audio outputs, and nothing is nothing', () => {
    assert.equal(countMedia({ 20: { audio: [{ filename: 'a.flac' }] } }), 1, 'SaveAudio reports under `audio`');
    assert.equal(countMedia({ 1: { images: [{}, {}] }, 2: { videos: [{}] }, 3: { audios: [{}] } }), 4);
    assert.equal(countMedia({ 5: { text: ['x'] } }), 0, 'a non-media output is not media');
    assert.equal(countMedia(undefined), 0);
});

// ── 3. install probe vs a pruned job ─────────────────────────────────────────

const job = (status, deps = [{ status: 'complete', downloadedBytes: 1 }]) => [{ modelId: 'm', status, deps }];

test('installProbe: a seen job that is pruned is finished; the disk says how', async () => {
    let jobs = job('downloading');
    let onDisk = true;
    const probe = installProbe('m', { getJobs: async () => jobs, isInstalled: async () => onDisk });
    assert.equal(await probe(), false, 'still downloading');
    jobs = [];                                  // the reconciler pruned it between two polls
    assert.equal(await probe(), true, 'absent after seen is finished, not "not registered yet"');
    assert.equal(probe.failed, false, 'on disk = installed');

    const lost = installProbe('m', { seen: true, getJobs: async () => [], isInstalled: async () => false });
    assert.equal(await lost(), true);
    assert.equal(lost.failed, true, 'pruned and NOT on disk = the 30 s failed TTL ate a failure');
});

test('installProbe: `seen` from the start POST covers a job pruned before the first poll', async () => {
    let asked = 0;
    const isInstalled = async () => { asked++; return true; };
    assert.equal(await installProbe('m', { getJobs: async () => [], isInstalled })(), false,
        'no registered job seen = still not an instant install');
    assert.equal(asked, 0, 'and the disk is not asked about a job that never registered');
    assert.equal(await installProbe('m', { seen: true, getJobs: async () => [], isInstalled })(), true);
    assert.equal(asked, 1);
});

test('installProbe: a failure is read the moment it is seen, not by a later scan', async () => {
    const depFailed = installProbe('m', { getJobs: async () => job('done', [{ status: 'failed', downloadedBytes: 0 }]) });
    assert.equal(await depFailed(), true);
    assert.equal(depFailed.failed, true, 'a failed dep fails the model');
    const jobFailed = installProbe('m', { getJobs: async () => job('failed') });
    assert.equal(await jobFailed(), true);
    assert.equal(jobFailed.failed, true);
    const ok = installProbe('m', { getJobs: async () => job('done') });
    assert.equal(await ok(), true);
    assert.equal(ok.failed, false);
});

test('installProbe: a disk check that throws is a blip for waitReady, not a verdict', async () => {
    const probe = installProbe('m', { seen: true, getJobs: async () => [], isInstalled: async () => { throw new Error('502'); } });
    await assert.rejects(probe(), /502/);
    assert.equal(probe.failed, false, 'no verdict recorded on a failed read');
});
