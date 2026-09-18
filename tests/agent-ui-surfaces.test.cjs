'use strict';
/**
 * agent-ui-surfaces.test.cjs — MPI-774 Phase 5
 *
 * The four agent-surface rules Fabio's first round produced. There is no DOM runner in
 * this suite, so each one is asserted where it is declared — the CSS rule, or the branch
 * in the component source. They exist to fail when a later edit quietly takes one back.
 *
 *  1. Agent mode keeps Stop reachable (the agent has no cancel tool; the user's Stop is
 *     the only way to halt a generation it started).
 *  2. A video result is a <video>, and a result whose file will not load falls back to a
 *     readable tile instead of a broken image box.
 *  3. The agent's surfaces are Studio cream, not Vision rose.
 *  4. Language Models shows a loading state instead of empty labels.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

const PROMPT_BOX_CSS = 'js/components/Organisms/MpiPromptBox/MpiPromptBox.css';
const PROMPT_BOX_JS = 'js/components/Organisms/MpiPromptBox/MpiPromptBox.js';
const CHAT_JS = 'js/components/Compounds/MpiAgentChat/MpiAgentChat.js';
const CHAT_CSS = 'js/components/Compounds/MpiAgentChat/MpiAgentChat.css';
const LLM_JS = 'js/components/Organisms/MpiLlmSettings/MpiLlmSettings.js';
const LLM_CSS = 'js/components/Organisms/MpiLlmSettings/MpiLlmSettings.css';

// ── 1. Stop stays reachable in Agent mode ─────────────────────────────────────

test('agent mode does not hide the run column — Stop is the only way to halt a generation', () => {
    const css = read(PROMPT_BOX_CSS);
    // The block that hides the prompt-mode columns in agent mode.
    const hidden = css.match(/\.mpi-prompt-box--agent-mode > :is\(([^)]*)\)/);
    assert.ok(hidden, 'the agent-mode hide rule must exist');
    assert.ok(!hidden[1].includes('__col--run'),
        'the run column holds Stop: hiding it leaves an agent generation uncancellable');
    // Only Stop shows in it: everything else in the column is hidden by name.
    assert.match(css, /\.mpi-prompt-box--agent-mode \.mpi-prompt-box__col--run > :not\(\.mpi-prompt-box__stop-host\)/);
    // Three visible columns in agent mode: the text, the head, and Stop.
    const cols = css.match(/\.mpi-prompt-box--agent-mode \{[^}]*grid-template-columns:\s*([^;]+);/);
    assert.ok(cols, 'agent mode declares its own column track');
    assert.equal(cols[1].trim().split(/\s+/).length, 3);
    // The class the rule spares has to be the one the component puts on the host.
    assert.match(read(PROMPT_BOX_JS), /stopHost\.className = 'mpi-prompt-box__stop-host'/);
});

// ── 2. A video result, and a result that did not arrive ───────────────────────

test('a video result is a <video>, not an <img> that can never paint', () => {
    const js = read(CHAT_JS);
    assert.match(js, /createElement\(type === 'video' \? 'video' : 'img'\)/);
    assert.match(js, /preload = 'metadata'/);
    assert.match(read(CHAT_CSS), /\.mpi-agent-chat__result-card :is\(img, video\)/);
});

test('a result whose file will not load falls back to a readable tile', () => {
    const js = read(CHAT_JS);
    assert.match(js, /on\(media, 'error', \(\) => _fallbackTile\(card, type\)\)/);
    assert.match(js, /mpi-agent-chat__result-card--unavailable/);
    assert.match(read(CHAT_CSS), /\.mpi-agent-chat__result-card--unavailable/);
});

// ── 3. The agent is Studio cream ──────────────────────────────────────────────

test('the agent surfaces rebind the accent to Studio cream', () => {
    // One rebind per surface subtree covers the Primitives mounted inside it too — a
    // literal per rule would leave their hover and active states rose.
    assert.match(read(CHAT_CSS), /\.mpi-agent-chat \{[^}]*--accent-heat:\s*var\(--hub-accent\)/);
    assert.match(read(PROMPT_BOX_CSS), /\.mpi-prompt-box__col--mode \{[^}]*--accent-heat:\s*var\(--hub-accent\)/);
});

// ── 4. Language Models loads visibly ──────────────────────────────────────────

test('Language Models shows a loading state instead of labels with nothing under them', () => {
    const js = read(LLM_JS);
    assert.match(js, /_setLoading\(root, true\)/);
    assert.match(js, /finally \{\s*_setLoading\(root, false\);/);
    const css = read(LLM_CSS);
    assert.match(css, /\.mpi-llm-settings--loading \.mpi-llm-settings__loading \{\s*display: flex/);
    assert.match(css, /\.mpi-llm-settings--loading \.mpi-settings__subgroup \{\s*display: none/);
});
