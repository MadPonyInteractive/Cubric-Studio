// MPI-803. The output-device picker's one piece of logic: applying a stored sink to
// a media element.
//
// Worth a test because every failure mode here is SILENT. Skip the call and playback
// stays on the OS default endpoint, which on a box with a virtual mixer means a user
// who hears nothing and an app that reports a healthy audio session. Let a rejected
// setSinkId throw instead and it takes the playback down with it — the fallback has
// to be "wrong device", never "no sound". Neither shows up in a screenshot.

const assert = require('node:assert');
const test = require('node:test');

const KEY = 'mpi_audio_output_device';

/** A media element that records what the module did to it. */
class FakeMedia {
    constructor({ supported = true, reject = null } = {}) {
        this.sinkId = '';
        this.calls = [];
        if (!supported) return;
        this.setSinkId = async (id) => {
            this.calls.push(id);
            if (reject) throw reject;
            this.sinkId = id;
        };
    }
}

/**
 * Fresh globals + a fresh module instance per test. The module holds a
 * warn-once Set, so a cached copy would leak state between cases.
 */
async function load() {
    const store = new Map();
    globalThis.localStorage = {
        getItem: (k) => (store.has(k) ? store.get(k) : null),
        setItem: (k, v) => store.set(k, String(v)),
        removeItem: (k) => store.delete(k),
    };
    const listeners = [];
    const inDom = [];
    globalThis.document = {
        addEventListener: (type, fn, capture) => listeners.push({ type, fn, capture }),
        querySelectorAll: () => inDom,
    };
    globalThis.HTMLMediaElement = FakeMedia;
    globalThis.fetch = async () => ({ ok: true });   // clientLogger is fire-and-forget

    // Cache-bust so each case gets its own module state.
    const mod = await import(`../js/utils/audioOutput.js?t=${Math.random()}`);
    return {
        mod,
        listeners,
        inDom,
        setStored: (v) => store.set(KEY, JSON.stringify(v)),
        getStored: () => JSON.parse(store.get(KEY) ?? 'null'),
    };
}

test('no stored device leaves the element on the system default', async () => {
    const { mod } = await load();
    const el = new FakeMedia();
    assert.strictEqual(await mod.applySink(el), true, 'the default IS the intended device');
    assert.deepStrictEqual(el.calls, [], 'setSinkId must not be called for the default');
});

test('a stored device is applied once, and not re-applied', async () => {
    const { mod, setStored } = await load();
    setStored('device-abc');
    const el = new FakeMedia();

    assert.strictEqual(await mod.applySink(el), true);
    assert.deepStrictEqual(el.calls, ['device-abc']);

    // Second play of the same element: already on that sink, nothing to do.
    assert.strictEqual(await mod.applySink(el), true);
    assert.deepStrictEqual(el.calls, ['device-abc'], 'an already-routed element is left alone');
});

test('a rejected or unsupported setSinkId never breaks the playback', async () => {
    const { mod, setStored } = await load();
    setStored('device-gone');

    const err = new Error('Requested device not found');
    err.name = 'NotFoundError';
    const rejecting = new FakeMedia({ reject: err });
    // false, not a throw: the Settings Test button reports this, playback swallows it.
    assert.strictEqual(await mod.applySink(rejecting), false);
    assert.deepStrictEqual(rejecting.calls, ['device-gone']);
    assert.strictEqual(rejecting.sinkId, '', 'stays on the default when the device is gone');

    const unsupported = new FakeMedia({ supported: false });
    assert.strictEqual(await mod.applySink(unsupported), false);
    assert.strictEqual(unsupported.setSinkId, undefined);

    assert.strictEqual(await mod.applySink(null), false);
});

test('installAudioOutput catches playback through a capture listener on document', async () => {
    const { mod, listeners, setStored } = await load();
    setStored('device-abc');
    mod.installAudioOutput();

    assert.strictEqual(listeners.length, 1, 'exactly one listener');
    const [l] = listeners;
    assert.strictEqual(l.type, 'play');
    assert.strictEqual(l.capture, true, '`play` does not bubble — capture is what catches it');

    const el = new FakeMedia();
    await l.fn({ target: el });
    assert.deepStrictEqual(el.calls, ['device-abc']);

    // Something that is not a media element must not be touched.
    await l.fn({ target: { setSinkId: () => assert.fail('not a media element') } });
});

test('changing the device moves what is already playing onto it', async () => {
    const { mod, inDom, getStored } = await load();
    const playing = new FakeMedia();
    const alsoPlaying = new FakeMedia();
    inDom.push(playing, alsoPlaying);

    await mod.setOutputDevice('device-xyz');

    assert.strictEqual(getStored(), 'device-xyz', 'the choice is persisted');
    assert.deepStrictEqual(playing.calls, ['device-xyz']);
    assert.deepStrictEqual(alsoPlaying.calls, ['device-xyz']);
});
