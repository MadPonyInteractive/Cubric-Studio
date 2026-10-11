'use strict';

/**
 * deepinfra-transcribe.test.cjs — MPI-946, dictation through DeepInfra's Whisper.
 *
 * `fetch` is stubbed: what matters is the request this app builds (the fixed endpoint, the
 * recording as a data URL, the task) and how each answer is read. The response shape is the
 * real one from 2026-09-26: Whisper answers with a leading space on `text`.
 */

const assert = require('node:assert/strict');
const test = require('node:test');

const { _transcribe } = require('../routes/deepinfra.js');

function stubFetch(status, body) {
    const calls = [];
    const real = global.fetch;
    global.fetch = async (url, init) => {
        calls.push({ url, init });
        return { ok: status >= 200 && status < 300, status, json: async () => body };
    };
    return { calls, restore: () => { global.fetch = real; } };
}

test('sends the recording as a data URL to the default (Qwen3-ASR) endpoint and trims the text', async () => {
    const f = stubFetch(200, { text: ' A red fox at dawn.', language: 'en', inference_status: { cost: 0.0027 } });
    try {
        const out = await _transcribe('k', Buffer.from('abc'), 'audio/webm', false);
        assert.deepEqual(out, { text: 'A red fox at dawn.' });
        assert.equal(f.calls.length, 1);
        assert.equal(f.calls[0].url, 'https://api.deepinfra.com/v1/inference/Qwen/Qwen3-ASR-1.7B');
        assert.equal(f.calls[0].init.headers.Authorization, 'bearer k');
        const sent = JSON.parse(f.calls[0].init.body);
        assert.equal(sent.audio, `data:audio/webm;base64,${Buffer.from('abc').toString('base64')}`);
        assert.equal(sent.task, 'transcribe');
    } finally { f.restore(); }
});

test('the translate toggle asks large-v3 for English out - turbo ignores translate', async () => {
    const f = stubFetch(200, { text: 'Hello' });
    try {
        await _transcribe('k', Buffer.from('abc'), 'audio/webm', true);
        assert.equal(JSON.parse(f.calls[0].init.body).task, 'translate');
        // Measured 2026-09-27: turbo answered Portuguese for Portuguese speech with task=translate.
        assert.equal(f.calls[0].url, 'https://api.deepinfra.com/v1/inference/openai/whisper-large-v3');
    } finally { f.restore(); }
});

test('upstream failures map to codes, and no upstream body reaches the answer', async () => {
    for (const [status, code] of [[401, 'NO_KEY'], [403, 'NO_KEY'], [402, 'NO_CREDIT'], [500, 'PROVIDER_ERROR'], [422, 'PROVIDER_ERROR']]) {
        const f = stubFetch(status, { detail: 'secret account detail' });
        try {
            const out = await _transcribe('k', Buffer.from('abc'), 'audio/webm', false);
            assert.equal(out.code, code, `HTTP ${status}`);
            assert.ok(!JSON.stringify(out).includes('secret'), `HTTP ${status} leaked the body`);
        } finally { f.restore(); }
    }
});

test('a 200 without text is a failure, not an empty insert', async () => {
    const f = stubFetch(200, { segments: [] });
    try {
        assert.equal((await _transcribe('k', Buffer.from('abc'), 'audio/webm', false)).code, 'PROVIDER_ERROR');
    } finally { f.restore(); }
});

// MPI-1071 — the Remote model pick.

test('a picked model key reaches its own endpoint, same request shape', async () => {
    const { STT_MODELS } = require('../routes/deepinfra.js');
    for (const [k, id] of Object.entries(STT_MODELS)) {
        const f = stubFetch(200, { text: ' Hi' });
        try {
            assert.deepEqual(await _transcribe('k', Buffer.from('abc'), 'audio/webm', false, k), { text: 'Hi' });
            assert.equal(f.calls[0].url, `https://api.deepinfra.com/v1/inference/${id}`);
            assert.equal(JSON.parse(f.calls[0].init.body).task, 'transcribe');
        } finally { f.restore(); }
    }
});

test('an unknown or inherited key falls back to the default, never a renderer-made endpoint', async () => {
    for (const k of ['', 'nope', 'constructor', '__proto__', 'openai/whisper-base']) {
        const f = stubFetch(200, { text: 'Hi' });
        try {
            await _transcribe('k', Buffer.from('abc'), 'audio/webm', false, k);
            assert.equal(f.calls[0].url, 'https://api.deepinfra.com/v1/inference/Qwen/Qwen3-ASR-1.7B', `key ${k}`);
        } finally { f.restore(); }
    }
});

test('translate forces large-v3 whatever model is picked', async () => {
    const f = stubFetch(200, { text: 'Hi' });
    try {
        await _transcribe('k', Buffer.from('abc'), 'audio/webm', true, 'turbo');
        assert.equal(f.calls[0].url, 'https://api.deepinfra.com/v1/inference/openai/whisper-large-v3');
    } finally { f.restore(); }
});

test('the Settings list offers exactly the server allowlist', () => {
    const { STT_MODELS } = require('../routes/deepinfra.js');
    const src = require('node:fs').readFileSync(require('node:path').join(__dirname, '../js/services/dictation.js'), 'utf8');
    const start = src.indexOf('DICTATION_MODELS');
    const block = src.slice(start, src.indexOf(']);', start));
    const keys = [...block.matchAll(/value: '([^']+)'/g)].map(m => m[1]);
    assert.deepEqual(keys.sort(), Object.keys(STT_MODELS).sort());
});

test('a transport failure is PROVIDER_ERROR', async () => {
    const real = global.fetch;
    global.fetch = async () => { throw new Error('ECONNRESET'); };
    try {
        assert.equal((await _transcribe('k', Buffer.from('abc'), 'audio/webm', false)).code, 'PROVIDER_ERROR');
    } finally { global.fetch = real; }
});
