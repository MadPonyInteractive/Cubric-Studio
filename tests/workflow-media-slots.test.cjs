'use strict';

/**
 * MPI-800 — every app media slot in a shipped workflow is ONE MpiNodes Upload loader.
 *
 * MpiNodes 1.2.13+ loads a path only inside ComfyUI's input/, output/ or temp/, and
 * 1.2.16 gave its Upload loaders (`MpiLoadImage` / `MpiLoadVideoUpload` /
 * `MpiLoadAudioUpload`) an injectable `string` and a `loaded` output. A slot is that one
 * node, titled Input_*: the app stages the file and injects it into `string`, and
 * `loaded` drives any presence gate. The shapes it replaced must not come back:
 *   - an Input_* path loader (`MpiLoadImageFromPath` / `MpiLoadVideo` / `MpiLoadAudio`)
 *   - an Input_* `MpiString` feeding one, directly or through an `MpiAnyChecker`
 *     (its `has_value` says a string was typed, not that a file loaded)
 * and a shipped Upload node keeps its picker on "None": the node falls back to the
 * picked file when `string` is empty, so a bench pick would load for every user.
 */

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const DIR = path.join(__dirname, '..', 'comfy_workflows');
const PATH_LOADERS = new Set(['MpiLoadImageFromPath', 'MpiLoadVideo', 'MpiLoadAudio']);
const UPLOAD_PICKERS = { MpiLoadImage: 'image', MpiLoadVideoUpload: 'video', MpiLoadAudioUpload: 'audio' };
const ABSOLUTE = /^([A-Za-z]:[\\/]|\/|\\\\)/;

const isSlot = (n) => /^input_/i.test(n?._meta?.title || '');
const isLink = (v) => Array.isArray(v) && v.length === 2 && typeof v[1] === 'number';

const graphs = fs.readdirSync(DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => ({ f, wf: JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')) }))
    .filter(({ wf }) => !wf.nodes && Object.values(wf).some((n) => n?.class_type));   // API graphs only

/** The node an input value really comes from, walked back through MpiAnyChecker pass-throughs. */
function sourceOf(wf, value) {
    let v = value;
    while (isLink(v) && wf[v[0]]?.class_type === 'MpiAnyChecker' && v[1] === 0) v = wf[v[0]].inputs.any;
    return isLink(v) ? wf[v[0]] : null;
}

test('the sweep sees the shipped graphs', () => {
    assert.ok(graphs.length > 30, `only ${graphs.length} API graphs found`);
    const uploads = graphs.flatMap(({ wf }) => Object.values(wf)).filter((n) => UPLOAD_PICKERS[n.class_type]);
    assert.ok(uploads.length > 40, `only ${uploads.length} Upload slots found — did the sweep read the right folder?`);
});

test('no app slot is a path loader or a string feeding one', () => {
    const bad = [];
    for (const { f, wf } of graphs) {
        for (const [id, n] of Object.entries(wf)) {
            if (!PATH_LOADERS.has(n.class_type)) continue;
            if (isSlot(n)) bad.push(`${f} #${id} ${n.class_type} "${n._meta.title}"`);
            const src = sourceOf(wf, n.inputs?.string);
            if (src && src.class_type === 'MpiString' && isSlot(src)) {
                bad.push(`${f} #${id} ${n.class_type} fed by MpiString "${src._meta.title}"`);
            }
        }
    }
    assert.deepEqual(bad, [], 'replace each with ONE Upload loader titled Input_* (MPI-800)');
});

test('no MpiAnyChecker gates on an injected path', () => {
    const bad = [];
    for (const { f, wf } of graphs) {
        for (const [id, n] of Object.entries(wf)) {
            if (n.class_type !== 'MpiAnyChecker') continue;
            const src = isLink(n.inputs?.any) ? wf[n.inputs.any[0]] : null;
            if (src?.class_type === 'MpiString' && isSlot(src)) bad.push(`${f} #${id} checks "${src._meta.title}"`);
        }
    }
    assert.deepEqual(bad, [], 'gate on the Upload loader\'s `loaded` output instead');
});

test('every Upload loader is an injectable slot with its picker on None', () => {
    const bad = [];
    for (const { f, wf } of graphs) {
        for (const [id, n] of Object.entries(wf)) {
            const key = UPLOAD_PICKERS[n.class_type];
            if (!key) continue;
            if (!isSlot(n)) bad.push(`${f} #${id} ${n.class_type} is not titled Input_*`);
            if (n.inputs[key] !== 'None') bad.push(`${f} #${id} ${key} = ${JSON.stringify(n.inputs[key])}`);
            if (n.inputs.string !== '') bad.push(`${f} #${id} string = ${JSON.stringify(n.inputs.string)}`);
        }
    }
    assert.deepEqual(bad, []);
});

test('the sync ships every Upload loader with picker None and an empty string', async () => {
    const { shipUploadSlots } = await import('../scripts/sync-raw-workflows.mjs');
    const out = JSON.parse(shipUploadSlots(JSON.stringify({
        1: { class_type: 'MpiLoadImage', inputs: { image: 'bench.png', channel: 'alpha', block_if_empty: true, string: 'image' } },
        2: { class_type: 'MpiLoadVideoUpload', inputs: { video: 'clip.mp4', block_if_empty: true, force_rate: 0, string: '' } },
        3: { class_type: 'MpiLoadAudioUpload', inputs: { audio: 'None', block_if_empty: false, string: 'x.wav' } },
        4: { class_type: 'MpiString', inputs: { string: 'untouched' } },
    })));
    assert.deepEqual([out[1].inputs.image, out[2].inputs.video, out[3].inputs.audio], ['None', 'None', 'None']);
    assert.deepEqual([out[1].inputs.string, out[2].inputs.string, out[3].inputs.string], ['', '', '']);
    assert.equal(out[1].inputs.channel, 'alpha', 'other widgets are left alone');
    assert.equal(out[4].inputs.string, 'untouched', 'only Upload loaders are touched');
});

test('no media slot ships a baked absolute path', () => {
    const bad = [];
    for (const { f, wf } of graphs) {
        for (const [id, n] of Object.entries(wf)) {
            const media = PATH_LOADERS.has(n.class_type) || UPLOAD_PICKERS[n.class_type] || (n.class_type === 'MpiString' && isSlot(n));
            if (!media) continue;
            for (const [k, v] of Object.entries(n.inputs || {})) {
                if (typeof v === 'string' && ABSOLUTE.test(v)) bad.push(`${f} #${id}.${k} = ${v}`);
            }
        }
    }
    assert.deepEqual(bad, [], 'a test path left in the graph loads (or blocks) on every user\'s machine');
});
