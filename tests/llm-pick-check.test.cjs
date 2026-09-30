'use strict';

// MPI-993 — the project-open check for language models the user's Ollama lacks.
// Run: node --test tests/llm-pick-check.test.cjs
// The toast itself is DOM; what can go wrong without a window is WHICH picks count
// as missing, and that the text sends the user to the Remote tab.

const assert = require('node:assert/strict');
const test = require('node:test');

global.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };

const { missingOllamaPicks, missingPicksMessage } = require('../js/shell/llmPickCheck.js');

// The Ollama connection's list, as `listRemoteModels` returns it.
const MODELS = [
    { id: 'huihui_ai/gemma-4-abliterated:12b', recommendedFor: ['enhance'] },
    { id: 'huihui_ai/qwen3-vl-abliterated:4b', recommendedFor: ['describe'], installed: false },
    { id: 'ornith:9b', recommendedFor: [], installed: false },
    { id: 'qwen3.5:latest', recommendedFor: [] },
];

test('an empty pick is the recommended model, and it counts when Ollama lacks it', () => {
    assert.deepEqual(missingOllamaPicks(MODELS, { enhance: '', describe: '' }),
        [{ job: 'describe', model: 'huihui_ai/qwen3-vl-abliterated:4b' }]);
});

test('a downloaded pick is fine; a pick Ollama no longer lists at all is missing', () => {
    assert.deepEqual(missingOllamaPicks(MODELS, { enhance: 'qwen3.5:latest', agent: 'gone:7b' }),
        [{ job: 'agent', model: 'gone:7b' }]);
});

test('a job with no pick and no recommendation has nothing to download', () => {
    // The agent has no Ollama recommendation: '' there means nothing picked, not a model.
    assert.deepEqual(missingOllamaPicks(MODELS, { agent: '' }), []);
    assert.deepEqual(missingOllamaPicks(MODELS, { agent: 'ornith:9b' }), [{ job: 'agent', model: 'ornith:9b' }]);
});

test('the message names the model, the job and the Remote tab', () => {
    const one = missingPicksMessage([{ job: 'describe', model: 'huihui_ai/qwen3-vl-abliterated:4b' }]);
    assert.match(one, /image description model, huihui_ai\/qwen3-vl-abliterated:4b, is not downloaded/);
    assert.match(one, /Remote tab on the home screen, under Language Models/);
    const two = missingPicksMessage([{ job: 'enhance', model: 'a:1b' }, { job: 'agent', model: 'b:2b' }]);
    assert.match(two, /^2 of your language models .*a:1b \(prompt enhancement\), b:2b \(agent\)\. Download them from the Remote tab/);
    assert.doesNotMatch(one + two, /—/);
});
