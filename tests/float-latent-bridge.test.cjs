'use strict';

/**
 * float-latent-bridge.test.cjs — MPI-1345.
 *
 * The minimised-app Latents window played a video run's latents on the first sampler
 * step, then froze, captioned "Generating". Two faults in the bridge, both silent:
 *
 * 1. It resolved a frame's generation from `generationStore.activeGenId(lane)` instead
 *    of the frame's own promptId. When the store had no active job for the lane (a busy
 *    MCP queue), the bridge passed no clip meta, the player stayed in STILL mode, and a
 *    clip burst was painted once on arrival — one frame per step, never a loop.
 * 2. A cloud or tool job finishing (a Describe, a cloud edit) was folded onto the
 *    'local' lane and stopped the local video's loop mid-render.
 *
 * Drives the REAL bridge with a fake ipcRenderer and real activeGenerations/store/bus.
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
const frames = () => sent.filter((s) => s.channel === 'float-latent:frame');

test('a video run keeps looping in the float window with no store job on its lane, and a cloud job ending does not stop it', async () => {
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

    await handlers.get('float-latent:query-show')();
    // Closing the window stops the loop's timer; a failed assertion must not leave it running.
    try {
        assert.deepEqual(sent.find((s) => s.channel === 'float-latent:show-state').payload, { show: true });

        // One sampler step = an instant burst of a 4-frame clip.
        for (let i = 0; i < 4; i++) {
            Events.emit('preview:frame', { engine: 'local', promptId: 'prompt-h3', seq: i + 1, url: `data:image/jpeg;base64,F${i}` });
        }
        await tick(900);

        const distinct = new Set(frames().map((f) => f.payload.dataUrl));
        assert.ok(distinct.size >= 3, `the tile must LOOP the clip, saw ${distinct.size} distinct frame(s)`);
        const tile = sent.filter((s) => s.channel === 'float-latent:add-tile').at(-1).payload;
        assert.equal(tile.genId, 'gen-h3');
        assert.notEqual(tile.title, 'Generating', 'the tile names the run, not the no-gen fallback');

        // A cloud job (its own lane, no preview socket) finishes mid-render.
        generationStore.register({ jobId: 'job-cloud', genId: 'gen-cloud', engine: 'cloud', scope: 'gallery' });
        Events.emit('generation:complete', { id: 'gen-cloud', item: { type: 'image' } });
        const before = frames().length;
        await tick(600);
        assert.ok(frames().length > before + 2, 'the local loop keeps painting after a cloud job ends');
        assert.ok(!sent.some((s) => ['float-latent:finalize', 'float-latent:spend'].includes(s.channel) && s.payload.genId === 'gen-cloud'),
            'a cloud job has no tile to freeze');
    } finally {
        handlers.get('float-latent:closed')();
        activeGenerations.end('gen-h3', { revokePreview: false });
    }
});
