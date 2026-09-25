'use strict';

/**
 * MPI-903 — the in-app agent's per-request floor, and what agent-facing text may say.
 *
 * Every byte of the system prompt and the tool schemas is paid on EVERY request. It was
 * 43 KB (25.4 system + 17.7 tools) when this test was written, and it grew one incident at a
 * time. The budgets below are the measured size at the rewrite plus a little room: raising
 * one is a decision, made in the diff that needs it, never a drive-by.
 *
 * And agent-facing text is information only: what to do and when. No dates, no names, no
 * "live it failed" story. A doc may carry a right/wrong example pair; never the story behind it.
 */
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const SYSTEM_BUDGET = 10_150;  // bytes, measured 9,490 with the app:* index (MPI-903); 9,880 with the Declining rule (MPI-908); 10,098 with the Content rule (MPI-916: without it the recommended model declined adult requests)
const TOOLS_BUDGET = 17_200;   // bytes of JSON, measured 16,947 (MPI-903)
const DOC_LINES = 200;

async function floor() {
    const { AgentLoop, TOOL_DEFS } = await import('../services/agentLoop.mjs');
    const { listCorpus } = await import('../services/agentCorpus.mjs');
    const loop = new AgentLoop({
        tools: { readKnowledge: async () => ({ ok: true, entries: listCorpus().map(({ id, title }) => ({ id, title })) }) },
        resolveEndpoint: async () => ({}),
        lookupContextWindow: async () => 1e6,
    });
    const system = await loop._buildSystemPrompt('auto');
    return { system, tools: JSON.stringify(TOOL_DEFS), TOOL_DEFS };
}

/** Every markdown file under docs/agent, skills copies excluded (those are outside agents'). */
function agentDocs(dir = path.join(ROOT, 'docs', 'agent')) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) return e.name === 'skills' ? [] : agentDocs(p);
        return e.name.endsWith('.md') ? [p] : [];
    });
}

test('the system prompt and the tool schemas stay under budget', async () => {
    const { system, tools } = await floor();
    const s = Buffer.byteLength(system);
    const t = Buffer.byteLength(tools);
    assert.ok(s <= SYSTEM_BUDGET, `system prompt is ${s} bytes, budget ${SYSTEM_BUDGET}: move detail to a gated doc or a tool result`);
    assert.ok(t <= TOOLS_BUDGET, `tool schemas are ${t} bytes, budget ${TOOLS_BUDGET}: a tool describes itself and its args, nothing else`);
});

test('the in-app index lists app docs only; guides come from describe_model', async () => {
    const { system } = await floor();
    const index = system.slice(system.indexOf('App knowledge'));
    assert.match(index, /- app:masking:/);
    assert.match(index, /- app:flows:/);
    assert.doesNotMatch(index, /- (skill|guide):/, 'skill and guide ids repeat the tools and describe_model');
});

test('rules and tool descriptions carry no dates, names or incident stories', async () => {
    const { system, TOOL_DEFS } = await floor();
    const descriptions = JSON.stringify(TOOL_DEFS.map((t) => t.function));
    for (const [where, text] of [['system prompt', system], ['tool descriptions', descriptions]]) {
        assert.doesNotMatch(text, /20\d\d-\d\d-\d\d/, `a date in the ${where}`);
        assert.doesNotMatch(text, /Fabio/, `a name in the ${where}`);
        assert.doesNotMatch(text, /\bLive\b|\blive,|failed live/, `an incident story in the ${where}`);
    }
});

test('app docs carry no stories or prices, and no agent doc passes 200 lines', () => {
    const docs = agentDocs();
    assert.ok(docs.length >= 10, `found only ${docs.length} agent docs`);
    for (const file of docs) {
        const rel = path.relative(ROOT, file);
        const text = fs.readFileSync(file, 'utf8');
        const lines = text.trim().split('\n').length;
        assert.ok(lines <= DOC_LINES, `${rel} is ${lines} lines: split it into a folder of sub-skills behind a router`);
        assert.doesNotMatch(text, /\$\d/, `${rel} quotes a price: the estimate is the one home for a price`);
    }
    // Eight model guides still date their provenance. Each recipe heal cleans its guide and
    // deletes its line here (MPI-911 did seedance-2.0); every other agent doc stays clean.
    const DATED_GUIDES = new Set(['chroma', 'illustrious', 'krea-2', 'ltx-2.3', 'minimax-h3', 'pony', 'sdxl', 'wan-2.2']
        .map((id) => path.join(ROOT, 'docs', 'agent', 'models', `${id}.md`)));
    for (const file of docs.filter((f) => !DATED_GUIDES.has(f))) {
        const rel = path.relative(ROOT, file);
        const text = fs.readFileSync(file, 'utf8');
        assert.doesNotMatch(text, /20\d\d-\d\d-\d\d/, `${rel} carries a date`);
        assert.doesNotMatch(text, /Fabio/, `${rel} carries a name`);
        assert.doesNotMatch(text, /\bLive\b|\blive,|failed live/, `${rel} tells an incident story`);
    }
});

test('masking.md keeps the right/wrong pairs the gated read exists for', () => {
    const doc = fs.readFileSync(path.join(ROOT, 'docs', 'agent', 'masking.md'), 'utf8');
    assert.match(doc, /does the change stay inside ONE area of the picture/);
    assert.match(doc, /Right: `convert the boy into a demon version of himself`/);
    assert.match(doc, /Wrong: `convert the boy into a demon: glowing red eyes/);
    assert.match(doc, /beautiful redhead woman, green eyes, freckles/);
    assert.match(doc, /remove the flower from the vase/);
    assert.match(doc, /> cute girl with freckles, wooden chair, lady hand/);
    assert.match(doc, /## A small area: enlarge first/);
    assert.match(doc, /never more adjectives on the same one/);
});
