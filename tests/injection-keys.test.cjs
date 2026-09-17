'use strict';
// The Input_ canonicalization pass (js/utils/injectionKeys.js), run by commandExecutor on
// every generation's params. What lands where is asserted against a real graph in
// tests/llm-service.test.cjs; this pins the three shapes of key.

const test = require('node:test');
const assert = require('node:assert/strict');
const { canonicalizeInjectionKeys } = require('../js/utils/injectionKeys.js');

test('a bare key becomes its Input_ form, and the bare half goes', () => {
    assert.deepEqual(canonicalizeInjectionKeys({ Upscale_Model: 'x.pth' }), { Input_Upscale_Model: 'x.pth' });
    assert.deepEqual(canonicalizeInjectionKeys({ Lora_1: 1, Input_Lora_1: 2 }), { Input_Lora_1: 2 }, 'an explicit Input_ key wins');
});

test('Input_ and Output_ keys pass through', () => {
    assert.deepEqual(canonicalizeInjectionKeys({ Input_Seed: 5, 'Input_Tidy.regex_pattern': 'x', Output_prompt: 'y' }),
        { Input_Seed: 5, 'Input_Tidy.regex_pattern': 'x', Output_prompt: 'y' });
});

test('a dotted key keeps its bare title too: it may name a node that is not Input_-titled', () => {
    assert.deepEqual(canonicalizeInjectionKeys({ 'Load CLIP.clip_name': 'q.safetensors', 'Video_Latent.is_preview': true }), {
        'Load CLIP.clip_name': 'q.safetensors',
        'Input_Load CLIP.clip_name': 'q.safetensors',
        'Video_Latent.is_preview': true,
        'Input_Video_Latent.is_preview': true,
    });
});
