'use strict';

// MPI-1249 — the enhancer writes the picture in the picked style LoRA.
// Run: node --test tests/enhance-style-rule.test.cjs
//
// The enhancer never heard which style was picked, so MOSS's recipe rule "no medium named = a
// photograph" turned "a woman skydiving" with Anime on into "A dramatic color photograph...",
// and the word outweighed the LoRA (Fabio, 2026-10-22). The pick now rides in the SYSTEM prompt
// as `styleRule(label)`, like No Background. Pinned on the real path, stubbed only at the network.

const assert = require('node:assert');
const test = require('node:test');

const _ls = {};
global.localStorage = {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(_ls, k) ? _ls[k] : null),
    setItem: (k, v) => { _ls[k] = String(v); },
    removeItem: (k) => { delete _ls[k]; },
};

const { settleInGraphEnhance, setBackendPreference } = require('../js/services/llmService.js');
const { styleRule } = require('../js/data/recipes/registry.js');
const { getModelById } = require('../js/data/modelRegistry.js');

test('the rule names the style and outranks the photograph default', () => {
    const rule = styleRule('Anime');
    assert.match(rule, /^STYLE\./);
    assert.ok(rule.includes('"Anime"'));
    assert.match(rule, /outranks any rule that makes a picture with no named medium a photograph/);
    assert.match(rule, /never call the picture a photograph/);
});

async function systemSentFor(modelId, selector) {
    setBackendPreference('endpoint');
    const realFetch = global.fetch;
    const calls = [];
    global.fetch = (url, init) => {
        calls.push({ url, body: init?.body ? JSON.parse(init.body) : null });
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true, text: 'an anime skydiver', backend: 'endpoint', model: 'm' }) });
    };
    try {
        await settleInGraphEnhance({
            operation: 't2i',
            modelId,
            positive: 'a woman skydiving',
            negative: '',
            injectionParams: { Input_enhance_prompt: true, 'Input_Style_Selector.selector': selector },
        }, { log: () => {} });
        const sent = calls.filter((c) => c.url === '/llm/enhance');
        assert.strictEqual(sent.length, 1);
        return sent[0].body.system;
    } finally {
        global.fetch = realFetch;
        delete _ls['cubric.llm.backend'];
    }
}

for (const modelId of ['moss-image', 'krea2']) {
    test(`${modelId}: a picked style reaches the system prompt by its label; none adds nothing`, async () => {
        const label = getModelById(modelId).styleLoraLabels[1];
        assert.ok(label, 'fixture guard: the model has a style 1');
        assert.ok((await systemSentFor(modelId, 1)).endsWith(`\n\n${styleRule(label)}`));
        assert.ok(!(await systemSentFor(modelId, 0)).includes('STYLE.'), 'style 0 = no rule');
    });
}
