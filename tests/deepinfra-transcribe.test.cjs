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

test('sends the recording as a data URL to the fixed Whisper endpoint and trims the text', async () => {
    const f = stubFetch(200, { text: ' A red fox at dawn.', language: 'en', inference_status: { cost: 0.0027 } });
    try {
        const out = await _transcribe('k', Buffer.from('abc'), 'audio/webm', false);
        assert.deepEqual(out, { text: 'A red fox at dawn.' });
        assert.equal(f.calls.length, 1);
        assert.equal(f.calls[0].url, 'https://api.deepinfra.com/v1/inference/openai/whisper-large-v3-turbo');
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

test('a transport failure is PROVIDER_ERROR', async () => {
    const real = global.fetch;
    global.fetch = async () => { throw new Error('ECONNRESET'); };
    try {
        assert.equal((await _transcribe('k', Buffer.from('abc'), 'audio/webm', false)).code, 'PROVIDER_ERROR');
    } finally { global.fetch = real; }
});
