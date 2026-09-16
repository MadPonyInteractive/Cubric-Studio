'use strict';

// MPI-774 — endpoint-profile secrets tests.
// Run: node --test tests/secrets-endpoint-profiles.test.cjs
// No framework — matches the other tests/*.test.cjs in this repo.
//
// Three things are worth a test here:
//
//  1. **No renderer-readable get channel for endpoint keys.** The IPC channels
//     registered by secretsStore.init() include set/has/clear, and there is
//     deliberately no `get` variant for any endpoint key.
//  2. **A key saved for URL A is refused (key: null) when the profile's URL is
//     later edited to URL B.** The fork bridge enforces this binding.
//  3. **The `deepinfra` profile resolves the existing DeepInfra slot.** A user
//     who saved a DeepInfra enhance key before the agent row existed never
//     enters it again.

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

function freshStore(dir) {
    delete require.cache[require.resolve('../main/secretsStore.js')];
    const store = require('../main/secretsStore.js');
    store.init({ app: null, safeStorage: null, ipcMain: { handle: () => {} }, logger: null });
    return store;
}

// ── 1. No renderer-readable get channel for endpoint keys ──────────────────

function testNoRendererGetChannelForEndpointKeys() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cubric-ep-'));
    const prevUserData = process.env.APP_USER_DATA;
    process.env.APP_USER_DATA = dir;
    try {
        const channels = [];
        delete require.cache[require.resolve('../main/secretsStore.js')];
        const store = require('../main/secretsStore.js');
        store.init({
            app: null, safeStorage: null,
            ipcMain: { handle: (c) => channels.push(c) },
            logger: null,
        });

        // All six documented channels must be registered.
        assert.ok(channels.includes('secrets:list-endpoint-profiles'),   'missing list');
        assert.ok(channels.includes('secrets:save-endpoint-profile'),    'missing save');
        assert.ok(channels.includes('secrets:delete-endpoint-profile'),  'missing delete');
        assert.ok(channels.includes('secrets:set-endpoint-key'),         'missing set-key');
        assert.ok(channels.includes('secrets:has-endpoint-key'),         'missing has-key');
        assert.ok(channels.includes('secrets:clear-endpoint-key'),       'missing clear-key');

        // THE INVARIANT: no channel name contains both 'endpoint' and 'get'.
        const leaky = channels.filter(c => /endpoint/i.test(c) && /get/i.test(c));
        assert.deepStrictEqual(leaky, [],
            `renderer-readable endpoint-key get channel registered: ${leaky.join(', ')}`);
    } finally {
        if (prevUserData === undefined) delete process.env.APP_USER_DATA;
        else process.env.APP_USER_DATA = prevUserData;
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

// ── 2. Key bound to URL A is refused when profile URL changes to URL B ──────

function testEndpointKeyBoundToBaseUrl() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cubric-ep-'));
    const prevUserData = process.env.APP_USER_DATA;
    process.env.APP_USER_DATA = dir;
    try {
        delete require.cache[require.resolve('../main/secretsStore.js')];
        const store = require('../main/secretsStore.js');
        store.init({ app: null, safeStorage: null, ipcMain: { handle: () => {} }, logger: null });

        // Create a non-preset profile with URL A.
        const URL_A = 'https://a.example.com/v1';
        const URL_B = 'https://b.example.com/v1';
        store.saveEndpointProfile({ id: 'test-llm', name: 'Test', baseURL: URL_A, model: 'test-model', contextWindow: 4096 });

        // Save a key — it is bound to URL A.
        const setRes = store.setEndpointKey('test-llm', 'secret-key-for-a');
        assert.ok(setRes.ok, 'setEndpointKey should succeed');
        assert.ok(store.hasEndpointKey('test-llm'), 'key should be present');

        // Fork bridge returns the key when the profile URL still matches.
        let handlerFn = null;
        const sent = [];
        store.registerForkBridge({
            on: (_evt, fn) => { handlerFn = fn; },
            send: (m) => sent.push(m),
        });
        assert.ok(handlerFn, 'registerForkBridge did not subscribe a handler');

        handlerFn({ type: 'secrets:get-endpoint-profile-request', id: 'req-1', profileId: 'test-llm' });
        assert.strictEqual(sent.length, 1, 'fork bridge should have replied');
        assert.strictEqual(sent[0].profile.baseURL, URL_A, 'profile.baseURL should be URL_A');
        assert.strictEqual(sent[0].key, 'secret-key-for-a',
            'key should be returned when bound URL matches profile URL');

        // Now change the profile URL to URL B.
        store.saveEndpointProfile({ id: 'test-llm', name: 'Test', baseURL: URL_B, model: 'test-model', contextWindow: 4096 });

        // Fork bridge must now return null for the key (URL_B !== URL_A).
        handlerFn({ type: 'secrets:get-endpoint-profile-request', id: 'req-2', profileId: 'test-llm' });
        assert.strictEqual(sent.length, 2, 'fork bridge should have replied again');
        assert.strictEqual(sent[1].profile.baseURL, URL_B, 'profile.baseURL should be URL_B now');
        assert.strictEqual(sent[1].key, null,
            'key must be null when the profile URL was edited after the key was saved');
    } finally {
        if (prevUserData === undefined) delete process.env.APP_USER_DATA;
        else process.env.APP_USER_DATA = prevUserData;
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

// Mutation proof: flip the key-null assertion so it expects non-null; assert
// that it fails (i.e. the guard actually bites). Then restore.
function testEndpointKeyBoundToBaseUrlMutationProof() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cubric-ep-'));
    const prevUserData = process.env.APP_USER_DATA;
    process.env.APP_USER_DATA = dir;
    try {
        delete require.cache[require.resolve('../main/secretsStore.js')];
        const store = require('../main/secretsStore.js');
        store.init({ app: null, safeStorage: null, ipcMain: { handle: () => {} }, logger: null });

        const URL_A = 'https://a.example.com/v1';
        const URL_B = 'https://b.example.com/v1';
        store.saveEndpointProfile({ id: 'mut-test', name: 'Mut', baseURL: URL_A, model: 'm', contextWindow: 4096 });
        store.setEndpointKey('mut-test', 'secret-key');

        // Move the profile URL to B; the fork bridge MUST return null.
        store.saveEndpointProfile({ id: 'mut-test', name: 'Mut', baseURL: URL_B, model: 'm', contextWindow: 4096 });

        let handlerFn = null;
        const sent = [];
        store.registerForkBridge({
            on: (_evt, fn) => { handlerFn = fn; },
            send: (m) => sent.push(m),
        });
        handlerFn({ type: 'secrets:get-endpoint-profile-request', id: 'req-mut', profileId: 'mut-test' });

        // Flipped assertion — expecting non-null MUST throw (proves the guard bites).
        let threw = false;
        try {
            assert.strictEqual(sent[0].key, 'secret-key', 'FLIPPED: expecting key to survive URL change');
        } catch {
            threw = true;
        }
        assert.ok(threw, 'the flipped assertion did not throw — the URL-binding guard is missing or broken');
    } finally {
        if (prevUserData === undefined) delete process.env.APP_USER_DATA;
        else process.env.APP_USER_DATA = prevUserData;
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

// ── 3. deepinfra profile resolves the existing DeepInfra slot ──────────────

function testDeepInfraProfileReusesExistingSlot() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cubric-ep-'));
    const prevUserData = process.env.APP_USER_DATA;
    process.env.APP_USER_DATA = dir;
    try {
        delete require.cache[require.resolve('../main/secretsStore.js')];
        const store = require('../main/secretsStore.js');
        store.init({ app: null, safeStorage: null, ipcMain: { handle: () => {} }, logger: null });

        // The user sets the DeepInfra enhance key via the EXISTING enhance slot.
        const enhanceRes = store.setDeepInfraKey('di-shared-key');
        assert.ok(enhanceRes.ok, 'setDeepInfraKey should succeed');

        // The agent's endpoint key path for deepinfra must surface the SAME key.
        assert.ok(store.hasEndpointKey('deepinfra'), 'hasEndpointKey("deepinfra") must be true');

        // Fork bridge: deepinfra profile returns the shared key.
        let handlerFn = null;
        const sent = [];
        store.registerForkBridge({
            on: (_evt, fn) => { handlerFn = fn; },
            send: (m) => sent.push(m),
        });
        handlerFn({ type: 'secrets:get-endpoint-profile-request', id: 'di-req', profileId: 'deepinfra' });

        assert.ok(sent[0].profile, 'deepinfra profile should be returned');
        assert.strictEqual(sent[0].profile.id, 'deepinfra');
        assert.ok(sent[0].profile.baseURL, 'deepinfra profile must have a non-empty baseURL');
        assert.strictEqual(sent[0].key, 'di-shared-key',
            'fork bridge must return the DeepInfra enhance key for the deepinfra profile');

        // The deepinfra slot is independent of the RunPod slot.
        assert.strictEqual(store.hasApiKey(), false,
            'deepinfra key must not satisfy hasApiKey()');
    } finally {
        if (prevUserData === undefined) delete process.env.APP_USER_DATA;
        else process.env.APP_USER_DATA = prevUserData;
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

function testDeepInfraKeyNullWhenUrlOverridden() {
    // If the user overrides the deepinfra profile's baseURL to something other
    // than the canonical DeepInfra URL, the legacy key should not be forwarded
    // to the new host.
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cubric-ep-'));
    const prevUserData = process.env.APP_USER_DATA;
    process.env.APP_USER_DATA = dir;
    try {
        delete require.cache[require.resolve('../main/secretsStore.js')];
        const store = require('../main/secretsStore.js');
        store.init({ app: null, safeStorage: null, ipcMain: { handle: () => {} }, logger: null });

        // Legacy enhance key — no deepInfraKeyBoundURL stored.
        store.setDeepInfraKey('di-legacy-key');

        // Override the deepinfra profile URL.
        store.saveEndpointProfile({
            id: 'deepinfra', name: 'DeepInfra', baseURL: 'https://other.example.com/v1',
            model: 'test', contextWindow: 1048576,
        });

        let handlerFn = null;
        const sent = [];
        store.registerForkBridge({
            on: (_evt, fn) => { handlerFn = fn; },
            send: (m) => sent.push(m),
        });
        handlerFn({ type: 'secrets:get-endpoint-profile-request', id: 'di-override', profileId: 'deepinfra' });

        assert.strictEqual(sent[0].key, null,
            'key must be null when the deepinfra profile URL was overridden to a different host');
    } finally {
        if (prevUserData === undefined) delete process.env.APP_USER_DATA;
        else process.env.APP_USER_DATA = prevUserData;
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

function testEndpointKeyNeverPlainTextOnDisk() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cubric-ep-'));
    const prevUserData = process.env.APP_USER_DATA;
    process.env.APP_USER_DATA = dir;
    try {
        delete require.cache[require.resolve('../main/secretsStore.js')];
        const store = require('../main/secretsStore.js');
        store.init({ app: null, safeStorage: null, ipcMain: { handle: () => {} }, logger: null });

        store.saveEndpointProfile({ id: 'or', name: 'OR', baseURL: 'https://or.example.com/v1', model: 'm', contextWindow: 4096 });
        store.setEndpointKey('or', 'super-secret-openrouter-key');

        const onDisk = fs.readFileSync(path.join(dir, 'runpod-secrets.json'), 'utf8');
        assert.ok(!onDisk.includes('super-secret-openrouter-key'), 'endpoint key is on disk in plaintext');
    } finally {
        if (prevUserData === undefined) delete process.env.APP_USER_DATA;
        else process.env.APP_USER_DATA = prevUserData;
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

function testListEndpointProfilesIncludesAllPresets() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cubric-ep-'));
    const prevUserData = process.env.APP_USER_DATA;
    process.env.APP_USER_DATA = dir;
    try {
        const store = freshStore(dir);
        const profiles = store.listEndpointProfiles();
        const ids = profiles.map(p => p.id);
        for (const expected of ['deepinfra', 'openrouter', 'openai', 'ollama', 'custom']) {
            assert.ok(ids.includes(expected), `preset "${expected}" missing from listEndpointProfiles()`);
        }
        // A profile is a CONNECTION: exactly id, name, baseURL. The model is each
        // job's own pick (MPI-774 shared connection), so it must not ride along.
        for (const p of profiles) {
            assert.deepEqual(Object.keys(p).sort(), ['baseURL', 'id', 'name'], `profile shape: ${JSON.stringify(p)}`);
            assert.ok(p.id, `profile missing id: ${JSON.stringify(p)}`);
        }
    } finally {
        if (prevUserData === undefined) delete process.env.APP_USER_DATA;
        else process.env.APP_USER_DATA = prevUserData;
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

function testSaveAndDeleteUserProfile() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cubric-ep-'));
    const prevUserData = process.env.APP_USER_DATA;
    process.env.APP_USER_DATA = dir;
    try {
        const store = freshStore(dir);
        // A model saved by an older caller is dropped, not stored.
        store.saveEndpointProfile({ id: 'my-llm', name: 'My LLM', baseURL: 'https://my.example.com/v1', model: 'llama-3', contextWindow: 8192 });
        let profiles = store.listEndpointProfiles();
        assert.deepEqual(profiles.find(p => p.id === 'my-llm'), { id: 'my-llm', name: 'My LLM', baseURL: 'https://my.example.com/v1' });

        store.deleteEndpointProfile('my-llm');
        profiles = store.listEndpointProfiles();
        assert.ok(!profiles.some(p => p.id === 'my-llm'), 'deleted profile should not appear in list');
    } finally {
        if (prevUserData === undefined) delete process.env.APP_USER_DATA;
        else process.env.APP_USER_DATA = prevUserData;
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

// ── Runner ────────────────────────────────────────────────────────────────────

const tests = [
    testNoRendererGetChannelForEndpointKeys,
    testEndpointKeyBoundToBaseUrl,
    testEndpointKeyBoundToBaseUrlMutationProof,
    testDeepInfraProfileReusesExistingSlot,
    testDeepInfraKeyNullWhenUrlOverridden,
    testEndpointKeyNeverPlainTextOnDisk,
    testListEndpointProfilesIncludesAllPresets,
    testSaveAndDeleteUserProfile,
];

let failed = 0;
for (const t of tests) {
    try {
        t();
        console.log(`  ok  ${t.name}`);
    } catch (err) {
        failed++;
        console.error(`  FAIL ${t.name}\n    ${err.message}`);
    }
}
console.log(failed
    ? `\n${failed} of ${tests.length} endpoint-profile tests FAILED.`
    : `\nAll ${tests.length} endpoint-profile tests passed.`);
if (failed) process.exitCode = 1;
