// MPI-1034. Opening the picked microphone.
//
// Asked as `ideal`, Chromium opened the system default whatever was picked, and on a box
// whose default is a virtual mixer that had gone quiet, every pick recorded silence with
// no error. These pin the constraint and the one case that may fall back.

const assert = require('node:assert');
const test = require('node:test');

const named = (name) => Object.assign(new Error(name), { name });

async function load(stored, answer) {
    const store = new Map(stored ? [['mpi_audio_input_device', JSON.stringify(stored)]] : []);
    globalThis.localStorage = {
        getItem: (k) => (store.has(k) ? store.get(k) : null),
        setItem: (k, v) => store.set(k, String(v)),
        removeItem: (k) => store.delete(k),
    };
    globalThis.fetch = async () => ({ ok: true });   // clientLogger is fire-and-forget
    const asks = [];
    Object.defineProperty(globalThis, 'navigator', {
        configurable: true,
        writable: true,
        value: { mediaDevices: { getUserMedia: async (c) => { asks.push(c); return answer(c); } } },
    });
    const { openMic } = await import(`../js/utils/audioInput.js?t=${Math.random()}`);
    return { openMic, asks };
}

test('a picked mic is asked for exactly, not as a hint', async () => {
    const { openMic, asks } = await load('focusrite', () => 'stream');
    assert.strictEqual(await openMic(), 'stream');
    assert.deepStrictEqual(asks, [{ audio: { deviceId: { exact: 'focusrite' } } }]);
});

test('nothing picked opens the system default', async () => {
    const { openMic, asks } = await load('', () => 'stream');
    await openMic();
    assert.deepStrictEqual(asks, [{ audio: true }]);
});

test('a picked mic that is gone falls back to the system default', async () => {
    const { openMic, asks } = await load('unplugged', (c) => {
        if (c.audio.deviceId) throw named('OverconstrainedError');
        return 'default';
    });
    assert.strictEqual(await openMic(), 'default');
    assert.deepStrictEqual(asks[1], { audio: true });
});

test('a refused mic is not papered over with the default', async () => {
    const { openMic, asks } = await load('focusrite', () => { throw named('NotAllowedError'); });
    await assert.rejects(openMic(), { name: 'NotAllowedError' });
    assert.strictEqual(asks.length, 1);
});
