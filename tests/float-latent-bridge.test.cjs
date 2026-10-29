'use strict';

/**
 * float-latent-bridge.test.cjs — MPI-1345.
 *
 * The minimised-app Latents window showed a video run as one frame per sampler step
 * while the gallery card looped the clip. Faults, all silent:
 *
 * 1. The loop ran in the APP's renderer, which is a hidden page while the float
 *    window is up: Chromium clamps its timers to ~1s, then ~1/min after 5 minutes.
 *    The bridge therefore runs NO timer now: it forwards every frame once, as bytes,
 *    with the run's clip meta, and the float window (visible) paces the loop.
 * 2. The frame's generation came from `generationStore.activeGenId(lane)`, not its own
 *    promptId; on a busy MCP queue that was null — no clip meta, caption "Generating".
 * 3. A cloud/tool job finishing was folded onto the 'local' lane.
 *
 * Drives the REAL bridge with a fake ipcRenderer and real activeGenerations/store/bus.
 * The float window's own loop is the shared player, pinned by previewClipPlayer.test.cjs.
 */

const assert = require('node:assert/strict');
const test = require('node:test');

const handlers = new Map();
const sent = [];
const ipcRenderer = {
    on: (channel, fn) => handlers.set(channel, fn),
    send: (channel, payload) => sent.push({ channel, payload }),
};
globalThis.window = globalThis.window || {};
globalThis.window.require = () => ({ ipcRenderer });

const tick = (ms) => new Promise((r) => setTimeout(r, ms));
const of = (channel) => sent.filter((s) => s.channel === channel);
const frameUrl = (i) => `data:image/jpeg;base64,${Buffer.from(`frame-${i}`).toString('base64')}`;
const text = (bytes) => Buffer.from(bytes).toString();

test('every frame reaches the float window once, in order, as bytes with its run and clip meta', async () => {
    const { Events } = await import('../js/events.js');
    const { activeGenerations } = await import('../js/services/activeGenerations.js');
    const { generationStore } = await import('../js/services/generationStore.js');
    const { initFloatLatentBridge } = await import('../js/shell/floatLatentBridge.js');
    initFloatLatentBridge();

    activeGenerations.start({ id: 'gen-h3', scope: 'gallery', operation: 'ref2v_ms', modelId: 'minimax-h3-ref2va', exec: {} });
    activeGenerations.setPromptId('gen-h3', 'prompt-h3');
    activeGenerations.resetPreview('gen-h3', { length: 4, rate: 24 });
    // Deliberately NO store job for 'local': the condition the user's MCP queue hit.
    assert.equal(generationStore.activeGenId('local'), null);

    try {
        // Step 1 bursts while the app is still up: nothing is forwarded, but the bridge
        // remembers the clip window for a mid-step open.
        for (let i = 0; i < 4; i++) Events.emit('preview:frame', { engine: 'local', promptId: 'prompt-h3', seq: i + 1, url: frameUrl(i) });
        await tick(50);
        assert.equal(of('float-latent:frame').length, 0);

        // The user minimises mid-step: the tile opens on the WHOLE current clip, not one still.
        handlers.get('float-latent:query-show')();
        assert.deepEqual(of('float-latent:show-state')[0].payload, { show: true });
        await tick(50);
        assert.deepEqual(of('float-latent:frame').map((f) => text(f.payload.bytes)), ['frame-0', 'frame-1', 'frame-2', 'frame-3']);

        // Step 2's burst: each frame forwarded exactly once, in order, as bytes.
        sent.length = 0;
        Events.emit('generation:preview-reset', { id: 'gen-h3', clip: { length: 4, rate: 24 } });
        for (let i = 4; i < 8; i++) Events.emit('preview:frame', { engine: 'local', promptId: 'prompt-h3', seq: i + 1, url: frameUrl(i) });
        await tick(50);
        const frames = of('float-latent:frame');
        assert.deepEqual(frames.map((f) => text(f.payload.bytes)), ['frame-4', 'frame-5', 'frame-6', 'frame-7']);
        assert.ok(frames.every((f) => f.payload.bytes instanceof Uint8Array));
        assert.ok(frames.every((f) => f.payload.genId === 'gen-h3'));
        assert.ok(frames.every((f) => f.payload.clip?.rate === 24 && f.payload.clip?.length === 4),
            'the clip meta rides along, so the window loops instead of showing stills');
        const tile = of('float-latent:add-tile').at(-1).payload;
        assert.notEqual(tile.title, 'Generating', 'the tile names the run, not the no-gen fallback');
        // The stage reset reaches the window BEFORE that stage's frames, never after them.
        const order = sent.filter((s) => s.channel === 'float-latent:reset' || s.channel === 'float-latent:frame').map((s) => s.channel);
        assert.equal(order[0], 'float-latent:reset');

        // No timer in the bridge: nothing more is sent without new frames.
        const count = sent.length;
        await tick(400);
        assert.equal(sent.length, count, 'the bridge must not pace a loop — the float window does');

        // A cloud job (its own lane, no preview socket) finishing touches no tile.
        generationStore.register({ jobId: 'job-cloud', genId: 'gen-cloud', engine: 'cloud', scope: 'gallery' });
        Events.emit('generation:complete', { id: 'gen-cloud', item: { type: 'image' } });
        await tick(20);
        assert.ok(!sent.some((s) => ['float-latent:finalize', 'float-latent:spend'].includes(s.channel) && s.payload.genId === 'gen-cloud'),
            'a cloud job has no tile to freeze');
    } finally {
        handlers.get('float-latent:closed')?.();
        activeGenerations.end('gen-h3', { revokePreview: false });
    }
});
