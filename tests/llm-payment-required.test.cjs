'use strict';

/**
 * llm-payment-required.test.cjs — MPI-869. DeepInfra answers HTTP 402 for an empty balance
 * AND for a hit monthly spending limit (measured 2026-09-24: the cap refused Cosmo's chat at
 * $3.01 of $3.00). The agent showed "DeepInfra chat failed: 402 Payment Required", which says
 * neither; the copy must name both, because topping up cannot fix a limit the user set.
 */

const assert = require('node:assert/strict');
const test = require('node:test');

test('a 402 on chat names the balance AND the monthly limit; other failures keep the status', async () => {
    const { DeepInfraEngine } = await import('../services/llmEngines.mjs');
    const realFetch = global.fetch;
    const answer = (status, statusText) => { global.fetch = async () => ({ ok: false, status, statusText, text: async () => '' }); };
    const engine = new DeepInfraEngine('k', 'https://api.deepinfra.com/v1/openai');
    try {
        answer(402, 'Payment Required');
        const err = await engine.chat({ model: 'm', messages: [] }).catch(e => e);
        assert.equal(err.status, 402);
        assert.match(err.message, /balance is empty/);
        assert.match(err.message, /monthly spending limit/);
        assert.doesNotMatch(err.message, /402 Payment Required/);

        answer(500, 'Internal Server Error');
        const other = await engine.chat({ model: 'm', messages: [] }).catch(e => e);
        assert.equal(other.message, 'DeepInfra chat failed: 500 Internal Server Error');
    } finally {
        global.fetch = realFetch;
    }
});
