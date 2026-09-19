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

const notFound = () => Object.assign(new Error('Requested device not found'), { name: 'NotFoundError' });

/**
 * A media element that records what the module did to it.
 *
 * `known` (MPI-824) is the set of ids this element's audio stack can actually resolve;
 * anything else throws NotFoundError, which is how a real one answers a stale id. Omit it
 * and every id resolves.
 */
class FakeMedia {
    constructor({ supported = true, reject = null, known = null } = {}) {
        this.sinkId = '';
        this.calls = [];
        if (!supported) return;
        this.setSinkId = async (id) => {
            this.calls.push(id);
            if (reject) throw reject;
            if (known && !known.includes(id)) throw notFound();
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

    // MPI-824: the device list the module re-resolves against, and the `devicechange`
    // listener it installs. `enumerateCalls` is what proves the lookup is not run per play.
    const mediaListeners = [];
    let devices = [];
    let enumerateCalls = 0;
    // defineProperty, not assignment: Node exposes `navigator` as a getter-only global, so
    // `globalThis.navigator = …` silently no-ops in sloppy mode and the stub never lands.
    Object.defineProperty(globalThis, 'navigator', {
        configurable: true,
        writable: true,
        value: {
            mediaDevices: {
                enumerateDevices: async () => { enumerateCalls += 1; return devices; },
                addEventListener: (type, fn) => mediaListeners.push({ type, fn }),
            },
        },
    });

    // Cache-bust so each case gets its own module state.
    const mod = await import(`../js/utils/audioOutput.js?t=${Math.random()}`);
    return {
        mod,
        listeners,
        mediaListeners,
        inDom,
        setDevices: (d) => { devices = d; },
        enumerateCalls: () => enumerateCalls,
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

    await mod.setOutputDevice('device-xyz', 'Speakers (Focusrite)');

    assert.deepStrictEqual(getStored(), { deviceId: 'device-xyz', label: 'Speakers (Focusrite)' },
        'the choice is persisted WITH its label — the label is what MPI-824 re-pins from');
    assert.deepStrictEqual(playing.calls, ['device-xyz']);
    assert.deepStrictEqual(alsoPlaying.calls, ['device-xyz']);
});

// ── MPI-824 ──────────────────────────────────────────────────────────────────────
//
// A deviceId is a salted hash of the OS endpoint id, and a virtual mixer regenerates its
// endpoints: the device is still listed, under the same name, with an id that no longer
// resolves. Measured on Fabio's box 2026-09-19 — five sessions of NotFoundError against a
// device Windows reported ACTIVE, and a stored id matching none of 109 registry endpoints.

test('a stored id that no longer resolves is re-pinned from its label', async () => {
    const { mod, setStored, setDevices, getStored } = await load();
    setStored({ deviceId: 'sonar-old', label: 'SteelSeries Sonar - Media' });
    setDevices([
        { kind: 'audiooutput', deviceId: 'sonar-new', label: 'SteelSeries Sonar - Media' },
        { kind: 'audioinput', deviceId: 'mic', label: 'SteelSeries Sonar - Microphone' },
    ]);

    const el = new FakeMedia({ known: ['sonar-new'] });
    assert.strictEqual(await mod.applySink(el), true, 'the device is still there under a new id');
    assert.deepStrictEqual(el.calls, ['sonar-old', 'sonar-new'], 'tries the stored id, then the healed one');
    assert.strictEqual(el.sinkId, 'sonar-new');
    assert.deepStrictEqual(getStored(), { deviceId: 'sonar-new', label: 'SteelSeries Sonar - Media' },
        're-pinned, so the next play costs no lookup');
});

test('a device that is genuinely gone costs ONE lookup, not one per play', async () => {
    const { mod, setStored, setDevices, enumerateCalls } = await load();
    setStored({ deviceId: 'gone', label: 'Headset (DualSense)' });
    setDevices([{ kind: 'audiooutput', deviceId: 'speakers', label: 'Speakers' }]);

    for (let i = 0; i < 5; i += 1) {
        assert.strictEqual(await mod.applySink(new FakeMedia({ known: ['speakers'] })), false);
    }
    // applySink runs on EVERY play; a hover-scrubbed gallery makes hundreds.
    assert.strictEqual(enumerateCalls(), 1, 'one enumerateDevices for the dead id, ever');
});

test('an id that never resolves and has no label never even looks', async () => {
    // A store written before MPI-824 holds the bare id and no label: nothing to match on.
    const { mod, setStored, setDevices, enumerateCalls } = await load();
    setStored('legacy-id');
    setDevices([{ kind: 'audiooutput', deviceId: 'speakers', label: 'Speakers' }]);

    assert.strictEqual(await mod.applySink(new FakeMedia({ known: ['speakers'] })), false);
    assert.strictEqual(enumerateCalls(), 0, 'no label, no lookup — and no crash on the old shape');
});

test('devicechange re-points live elements and re-arms the lookup', async () => {
    const { mod, mediaListeners, inDom, setStored, setDevices, getStored } = await load();
    setStored({ deviceId: 'sonar-old', label: 'SteelSeries Sonar - Media' });
    setDevices([]);                       // the mixer has not registered yet
    mod.installAudioOutput();

    const change = mediaListeners.find(l => l.type === 'devicechange');
    assert.ok(change, 'a devicechange listener is installed');

    // The first play beats the mixer: nothing to resolve, so it lands on the default.
    const early = new FakeMedia({ known: [] });
    assert.strictEqual(await mod.applySink(early), false);
    assert.strictEqual(early.sinkId, '', 'wrong device, never NO sound');

    // The mixer comes up. Whatever is on screen gets re-pointed without the user acting.
    const onScreen = new FakeMedia({ known: ['sonar-new'] });
    inDom.push(onScreen);
    setDevices([{ kind: 'audiooutput', deviceId: 'sonar-new', label: 'SteelSeries Sonar - Media' }]);
    await change.fn();
    await new Promise(resolve => setImmediate(resolve));   // the handler is not awaited

    assert.strictEqual(onScreen.sinkId, 'sonar-new', 'the late device is picked up on its own');
    assert.deepStrictEqual(getStored(), { deviceId: 'sonar-new', label: 'SteelSeries Sonar - Media' });
});
