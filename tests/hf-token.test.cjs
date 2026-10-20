'use strict';

// MPI-1215 — the Hugging Face token the licence gate proves a grant with is kept,
// encrypted, so a gated licence asks for it once. Run: node --test tests/hf-token.test.cjs
//
// End to end through the real pieces: secretsStore (AES-GCM fallback, no safeStorage),
// its fork bridge, routes/forkBridge.js, and the /licences/verify handler. Only Hugging
// Face is faked, by stubbing global fetch.

const test = require('node:test');
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.APP_USER_DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'cubric-hf-'));

const channels = [];
const store = require('../main/secretsStore.js');
store.init({ app: null, safeStorage: null, ipcMain: { handle: (c) => channels.push(c) }, logger: null });

// Play the Electron main process: the child's process.send lands in the store's bridge,
// and the bridge's reply comes back as a 'message' on this process.
let mainHandler = null;
store.registerForkBridge({
    on: (_ev, fn) => { mainHandler = fn; },
    send: (reply) => setImmediate(() => process.emit('message', reply)),
});
process.send = (msg) => setImmediate(() => mainHandler(msg));

const router = require('../routes/licences.js');
const verify = router.stack.find(l => l.route && l.route.path === '/licences/verify').route.stack[0].handle;

const TOKEN = 'hf_saved_token_123456';
const REQ = { repoId: 'black-forest-labs/flux-3-image-klein-comfy', probePath: 'model_index.json' };

// HF answers 200 to TOKEN-holders, 401 to anything else. Records the Authorization sent.
const sent = [];
global.fetch = async (_url, opts) => {
    const auth = opts.headers.Authorization;
    sent.push(auth);
    const good = auth === `Bearer ${TOKEN}` || auth === 'Bearer hf_replacement_9876543';
    return { status: good ? 200 : 401, headers: { get: () => null } };
};

function call(body) {
    return new Promise((resolve) => {
        const res = {
            code: 200,
            status(c) { this.code = c; return this; },
            json(obj) { resolve({ code: this.code, body: obj }); },
        };
        verify({ body }, res);
    });
}

test('the renderer can set, check and clear the token but never read it', () => {
    for (const c of ['secrets:set-hf-token', 'secrets:has-hf-token', 'secrets:clear-hf-token']) {
        assert.ok(channels.includes(c), `missing ${c}`);
    }
    assert.ok(!channels.some(c => /hf/i.test(c) && /get/i.test(c)), 'a renderer get channel would leak the token');
});

test('the token is encrypted at rest', () => {
    store.setHfToken(TOKEN);
    const raw = fs.readFileSync(path.join(process.env.APP_USER_DATA, 'runpod-secrets.json'), 'utf8');
    assert.ok(!raw.includes(TOKEN), 'plaintext token on disk');
    assert.strictEqual(store.getHfToken(), TOKEN);
    store.clearHfToken();
    assert.strictEqual(store.hasHfToken(), false);
});

test('with nothing saved and nothing typed the route asks for a token', async () => {
    const r = await call({ ...REQ });
    assert.strictEqual(r.code, 400);
    assert.strictEqual(r.body.reason, 'no-token');
});

test('a typed token that fails is not saved', async () => {
    const r = await call({ ...REQ, token: 'hf_junk_token_0000' });
    assert.strictEqual(r.body.reason, 'bad-token');
    assert.strictEqual(r.body.usedSaved, false);
    assert.strictEqual(store.hasHfToken(), false);
});

test('a typed token that passes is saved, and the next verify needs none', async () => {
    const first = await call({ ...REQ, token: TOKEN });
    assert.strictEqual(first.body.ok, true);
    assert.strictEqual(store.getHfToken(), TOKEN, 'a passing token must be kept');

    sent.length = 0;
    const second = await call({ ...REQ });
    assert.strictEqual(second.body.ok, true);
    assert.strictEqual(second.body.usedSaved, true);
    assert.deepStrictEqual(sent, [`Bearer ${TOKEN}`], 'the probe must carry the saved token');
});

test('a dead saved token says so, and a pasted one that passes replaces it', async () => {
    store.setHfToken('hf_expired_token_1111');
    const dead = await call({ ...REQ });
    assert.strictEqual(dead.body.reason, 'bad-token');
    assert.strictEqual(dead.body.usedSaved, true, 'the gate needs this to show the field again');

    const fresh = await call({ ...REQ, token: 'hf_replacement_9876543' });
    assert.strictEqual(fresh.body.ok, true);
    assert.strictEqual(store.getHfToken(), 'hf_replacement_9876543');
});
