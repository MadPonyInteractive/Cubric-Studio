'use strict';
/**
 * tests/llm-agent-context.test.cjs — MPI-905: the agent's local context floor
 * moved from 32K to 64K so it has room to grow (Fabio, 2026-09-24; local Ollama
 * cannot hold 120K, hence 64K, not the 120K floor first proposed).
 *
 * Run: node --test tests/llm-agent-context.test.cjs
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');

test('OLLAMA_AGENT_CONTEXT is the 64K floor, and chatEngineFor reports it for ollama', async () => {
    const { OLLAMA_AGENT_CONTEXT, chatEngineFor } = await import('../services/llmEngines.mjs');
    assert.equal(OLLAMA_AGENT_CONTEXT, 65_536);

    const { contextWindow } = chatEngineFor('ollama', null, 'http://localhost:11434/v1');
    assert.equal(contextWindow, OLLAMA_AGENT_CONTEXT);
});
