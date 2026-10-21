'use strict';
/**
 * tests/agent-chat-length.test.cjs — MPI-1125: the long-chat card.
 *
 * Past half its compaction point a conversation offers the user, once, a choice the app acts
 * on with no agent turn: Start fresh (the handoff is kept as a note, then the chat clears),
 * Compact (now), or Keep going (the renderer just closes the card).
 *
 * Fake engine, fake tools: no app, no spend.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');

const ENDPOINT = { profile: { id: 'deepinfra', name: 'DeepInfra', baseURL: 'http://127.0.0.1:9' }, key: 'k' };
const PROJECT = { folderPath: 'C:/Projects/Alpha', name: 'Alpha' };

async function setup({ promptTokens, saveOk = true, window = 1_048_576, profileId = 'deepinfra' }) {
    const { AgentLoop } = await import('../services/agentLoop.mjs');
    const { DeepInfraEngine, OllamaEngine } = await import('../services/llmEngines.mjs');
    const saved = [];
    const tools = {
        readKnowledge: async () => ({ ok: true, entries: [] }),
        readMemory: async () => ({ ok: true, notes: [] }),
        readGlobalMemory: async () => ({ ok: true, notes: [] }),
        writeMemory: async (folderPath, note) => { saved.push({ folderPath, ...note }); return { ok: saveOk }; },
        writeGlobalMemory: async (note) => { saved.push({ global: true, ...note }); return { ok: saveOk }; },
        discardAttachments: async () => {},
    };
    const loop = new AgentLoop({ tools, resolveEndpoint: async () => ENDPOINT, lookupContextWindow: async () => window });
    const events = [];
    loop._emit = (event, data) => events.push({ event, data });
    const orig = DeepInfraEngine.prototype.chat;
    const origOllama = OllamaEngine.prototype.chat;
    DeepInfraEngine.prototype.chat = OllamaEngine.prototype.chat = async (req) => (/compact handoff/.test(String(req.messages.at(-1).content))
        ? { text: 'Goal: a fox. Decided: Krea 2.' }
        : { text: 'reply', usage: { prompt_tokens: promptTokens } });
    const turn = (text) => loop.runTurn(text, [], PROJECT, 'auto', profileId, `t-${text}`, { model: 'fake' });
    return { loop, events, saved, turn, restore: () => { DeepInfraEngine.prototype.chat = orig; OllamaEngine.prototype.chat = origOllama; } };
}

const longs = (events) => events.filter((e) => e.event === 'agent:long').length;
const lastLong = (events) => events.filter((e) => e.event === 'agent:long').at(-1)?.data;

// MPI-1235: under 1M the card waits for 75% of the compaction point. Ollama's 64k compacts at
// 32,768, so the card shows at 24,576, not at 16,384 where Ornith's first turn already was.
test('a 64k window offers the card at 75% of the compaction point', async (t) => {
    const below = await setup({ promptTokens: 24_575, window: 65_536 });
    t.after(below.restore);
    await below.turn('one');
    assert.equal(longs(below.events), 0, 'one below 75% shows nothing');
    below.restore();
    const at = await setup({ promptTokens: 24_576, window: 65_536 });
    t.after(at.restore);
    await at.turn('one');
    assert.equal(longs(at.events), 1);
});

test('the card says whether the model is local, so a local one skips the cost line', async (t) => {
    const cloud = await setup({ promptTokens: 105_000 });
    t.after(cloud.restore);
    await cloud.turn('one');
    assert.equal(lastLong(cloud.events).local, false);
    cloud.restore();
    const local = await setup({ promptTokens: 24_576, window: 65_536, profileId: 'ollama' });
    t.after(local.restore);
    await local.turn('one');
    assert.equal(lastLong(local.events).local, true);
});

// MPI-1233: a 1,048,576 window compacts at 20% (~209.7k), so the card shows past ~104.9k.
test('past half the compaction point the card is offered once per chat', async (t) => {
    const h = await setup({ promptTokens: 105_000 });
    t.after(h.restore);
    await h.turn('one');
    assert.equal(longs(h.events), 1);
    await h.turn('two');
    assert.equal(longs(h.events), 1, 'once per chat');
    await h.loop.reset();
    await h.turn('three');
    assert.equal(longs(h.events), 2, 'a new chat can be offered again');
});

test('below half the compaction point there is no card', async (t) => {
    const h = await setup({ promptTokens: 104_000 });
    t.after(h.restore);
    await h.turn('one');
    assert.equal(longs(h.events), 0);
});

test('Start fresh keeps the handoff as a project note, then clears the chat', async (t) => {
    const h = await setup({ promptTokens: 70_000 });
    t.after(h.restore);
    await h.turn('one');
    const r = await h.loop.shorten('fresh', PROJECT.folderPath);
    assert.deepEqual(r, { ok: true });
    assert.equal(h.saved.length, 1);
    assert.equal(h.saved[0].folderPath, PROJECT.folderPath);
    assert.equal(h.saved[0].file, 'last-chat.md');
    assert.match(h.saved[0].text, /Goal: a fox/);
    assert.equal(h.loop._messages.length, 0, 'the chat is cleared');
});

test('the landing chat keeps its handoff as a global note', async (t) => {
    const h = await setup({ promptTokens: 70_000 });
    t.after(h.restore);
    await h.turn('one');
    assert.equal((await h.loop.shorten('fresh', null)).ok, true);
    assert.equal(h.saved[0].global, true);
});

test('a note that cannot be saved keeps the chat', async (t) => {
    const h = await setup({ promptTokens: 70_000, saveOk: false });
    t.after(h.restore);
    await h.turn('one');
    const r = await h.loop.shorten('fresh', PROJECT.folderPath);
    assert.equal(r.error.code, 'NOT_SAVED');
    assert.ok(h.loop._messages.length > 0, 'nothing is lost');
});

test('Compact compacts now and keeps the chat going', async (t) => {
    const h = await setup({ promptTokens: 70_000 });
    t.after(h.restore);
    await h.turn('one');
    assert.deepEqual(await h.loop.shorten('compact', PROJECT.folderPath), { ok: true });
    assert.match(String(h.loop._messages[1].content), /Session compacted[\s\S]*Goal: a fox/);
    assert.equal(h.saved.length, 0, 'compact writes no note');
});

test('nothing to shorten before the first turn', async (t) => {
    const h = await setup({ promptTokens: 70_000 });
    t.after(h.restore);
    assert.equal((await h.loop.shorten('compact', PROJECT.folderPath)).error.code, 'NO_CHAT');
});
