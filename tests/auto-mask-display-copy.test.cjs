// MPI-961 / MPI-971 — an auto-mask on a 16K+ photo died in the ENGINE: MpiLoadImage opens
// its input whole and Pillow refuses anything past 178,956,970 px ("Auto-mask failed ...
// DecompressionBombError", Fabio on the 16K and the 32K). `runAutoMask` now sends a big
// source as the server's 4096 copy and scales SAM3's click points onto it; a source at or
// under 4096 goes exactly as before.
//
// Driven end to end through the real `runAutoMask`: the server's `/display-image` answer
// and the engine are stubbed, and what the engine is handed is asserted.

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.join(__dirname, '..');
const WORKFLOW = fs.readFileSync(path.join(ROOT, 'comfy_workflows/img_auto_mask.json'), 'utf8');

globalThis.window = globalThis.window || { screen: { width: 1920, height: 1080 }, devicePixelRatio: 1 };
globalThis.location = globalThis.location || { href: 'http://127.0.0.1:3000/', origin: 'http://127.0.0.1:3000' };

const ORIGINAL = '/project-file?path=' + encodeURIComponent('C:/p/Media/big.png');
const COPY = '/project-file?path=' + encodeURIComponent('C:/p/Media/.meta/id1.thumb.fit4096.webp') + '&v=1';

/** Run one auto-mask with the server saying the source is `size` px square. */
async function dispatch(size, payload) {
    const ce = await import('../js/services/commandExecutor.js');
    const { localEngine, remoteEngine } = await import('../js/services/comfyController.js');
    const saved = [localEngine.runWorkflow, remoteEngine.runWorkflow, globalThis.fetch];
    let sent = null;
    const capture = async (wf, params) => { sent = params; };
    localEngine.runWorkflow = capture;
    remoteEngine.runWorkflow = capture;
    const asked = [];
    globalThis.fetch = async (url) => {
        const u = String(url);
        asked.push(u);
        if (u.startsWith('/comfy_workflows/')) return { ok: true, json: async () => JSON.parse(WORKFLOW) };
        if (u.startsWith('/display-image')) {
            const over = size > 4096;
            return { ok: true, json: async () => ({ url: over ? COPY : null, width: size, height: size }) };
        }
        throw new Error(`unexpected fetch ${u}`);
    };
    try {
        await new Promise((resolve) => {
            const exec = ce.runAutoMask({ imageUrl: ORIGINAL, detectorModel: 'x', useBox: false, ...payload });
            exec.onDone = resolve;
            exec.onError = resolve;
        });
    } finally {
        [localEngine.runWorkflow, remoteEngine.runWorkflow, globalThis.fetch] = saved;
    }
    return { sent, asked };
}

test('a 32K source reaches the engine as its 4096 copy, click points scaled onto it', async () => {
    const pos = JSON.stringify([{ x: 16384, y: 8192 }, { x: 32767, y: 0 }]);
    const neg = JSON.stringify([{ x: 800, y: 24000 }]);
    const { sent, asked } = await dispatch(32768, { pointsMode: true, pointsPositive: pos, pointsNegative: neg });
    assert.ok(sent, 'the engine was never handed the workflow');
    assert.ok(asked.some(u => u.startsWith('/display-image') && u.includes('edge=4096')), 'the copy was not asked for at the mask cap');
    assert.strictEqual(sent.Input_Image, COPY, 'the engine got the original — MpiLoadImage dies on it');
    assert.deepStrictEqual(JSON.parse(sent.Input_Points_Positive), [{ x: 2048, y: 1024 }, { x: 4096, y: 0 }]);
    assert.deepStrictEqual(JSON.parse(sent.Input_Points_Negative), [{ x: 100, y: 3000 }]);
});

test('a source at or under 4096 goes as it always did: its own URL, points untouched', async () => {
    const pos = JSON.stringify([{ x: 1000, y: 2000 }]);
    const { sent } = await dispatch(4096, { pointsMode: true, pointsPositive: pos, pointsNegative: '[]' });
    assert.strictEqual(sent.Input_Image, ORIGINAL);
    assert.strictEqual(sent.Input_Points_Positive, pos);
    assert.strictEqual(sent.Input_Points_Negative, '[]');
});

test('a text / detector run on a 16K goes as the copy too (the Pillow limit is not SAM3-only)', async () => {
    const { sent } = await dispatch(16384, { textMode: true, textPrompt: 'eye:3' });
    assert.strictEqual(sent.Input_Image, COPY);
    assert.strictEqual(sent.Input_Points_Positive, '', 'points stay off outside points mode');
});
