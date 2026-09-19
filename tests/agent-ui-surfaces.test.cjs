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
    // Five visible columns in agent mode: the text, the head, the model button, the cog and
    // Stop. It was three until MPI-774 Phase 7 put the pinned settings panel back (below);
    // the track count and the hide list have to agree or the textarea lands in an `auto`
    // column and the toggle in the stretching one.
    const cols = css.match(/\.mpi-prompt-box--agent-mode \{[^}]*grid-template-columns:\s*([^;]+);/);
    assert.ok(cols, 'agent mode declares its own column track');
    assert.equal(cols[1].trim().split(/\s+/).length, 5);
    // The class the rule spares has to be the one the component puts on the host.
    assert.match(read(PROMPT_BOX_JS), /stopHost\.className = 'mpi-prompt-box__stop-host'/);
});

// ── 1b. The pinned settings panel (MPI-774 Phase 7) ──────────────────────────
// Fabio, 2026-09-19: one boolean. Cog shut, the agent picks the model and the settings from
// MODEL DEFAULTS; cog open, the user owns both and the agent still owns the prompt, the
// media, the op and the card name. Enforcement is code in agentDispatch (its own test file,
// agent-pinned-settings.test.cjs) — these four assert the SURFACE that arms it.

test('agent mode keeps the model button and the cog — they are the pinned panel', () => {
    const css = read(PROMPT_BOX_CSS);
    const hidden = css.match(/\.mpi-prompt-box--agent-mode > :is\(([^)]*)\)/)[1];
    assert.ok(!hidden.includes('__col--settings'), 'the model button IS the pinned model');
    assert.ok(!hidden.includes('__col--cog'), 'the cog is what pins and unpins the panel');
    // The op strip stays gone in both mounts. Fabio: "if the user wants to go and change
    // operations, then he just needs to close the agent mode. That's too much already."
    assert.ok(hidden.includes('__op-strip'), 'the bar strip stays hidden');
    assert.match(css, /\.mpi-prompt-box__popup--agent \.mpi-prompt-box__settings-ops\s*\{[^}]*display:\s*none/,
        'the popup carries a SECOND op-strip mount and it has to go too');
});

test('the popup gets its own agent class — it is portaled and cannot inherit the box`s', () => {
    const js = read(PROMPT_BOX_JS);
    assert.match(js, /popupNode\.classList\.toggle\('mpi-prompt-box__popup--agent', _agentMode\)/);
    // Portaled: the class on `el` can never reach document.body.
    assert.match(js, /document\.body\.appendChild\(popupNode\)/);
});

test('in agent mode the panel is PINNED: no outside-click, no close-all, cog only', () => {
    const js = read(PROMPT_BOX_JS);
    const outside = js.match(/const onPopupOutsideClick = \(e\) => \{([\s\S]*?)\n        \};/);
    assert.ok(outside, 'the outside-click dismiss must still exist');
    assert.match(outside[1], /if \(_agentMode\) return;/,
        'a stray click on the canvas must not hand the settings back to the agent');
    const closeAll = js.match(/Events\.on\('ui:close-all-popups',([\s\S]*?)\}\)\);/);
    assert.ok(closeAll, 'the close-all pulse handler must still exist');
    assert.match(closeAll[1], /if \(_agentMode\) return;/, 'Escape reaches this pulse');
    // Open/close are what WRITE the boolean the dispatch gate reads.
    assert.match(js, /if \(_agentMode\) state\.agentSettingsPinned = true;/);
    assert.match(js, /state\.agentSettingsPinned = _agentMode && popupActive;/);
    // A destroyed box must not leave the flag set with no panel to see.
    assert.match(js, /state\.agentSettingsPinned = false;[\s\S]{0,200}popupNode\.parentNode\.removeChild/);
});

test('the cog says what opening it costs, before the click', () => {
    const js = read(PROMPT_BOX_JS);
    // [data-info] is the status-bar line (js/shell/statusBar.js), and it is the only copy
    // readable BEFORE the panel is open.
    assert.match(js, /const COG_INFO_AGENT = 'In agent mode, when you open this panel, you control the settings and the model, not the agent\.'/);
    assert.match(js, /cogBtn\.el\.setAttribute\('data-info', _agentMode \? COG_INFO_AGENT : COG_INFO\)/);
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

// ── 2b. A sent message's attachments, and the composer's height ───────────────

test("a bubble's attachments are a row under the text, not inline siblings of it", () => {
    const js = read(CHAT_JS);
    // Appended straight to the bubble they were inline with the text node and wrapped
    // into the middle of the sentence (Fabio, round 2).
    assert.match(js, /mpi-agent-chat__attachments--in-bubble/);
    assert.match(js, /if \(row\.childElementCount\) bubble\.appendChild\(row\)/);
    assert.match(read(CHAT_CSS), /\.mpi-agent-chat__attachments--in-bubble:not\(:first-child\)/);
});

test('the composer and its Send button are one line, and the same one', () => {
    // `lh` resolves against each element's own font-size, and Send's is smaller: both
    // sides have to read the SAME custom property or they never meet.
    const css = read(CHAT_CSS);
    assert.match(css, /--agent-composer-h:\s*calc\(var\(--t-sm\) \* 1\.3 \+ var\(--s-4\)\)/);
    assert.match(css, /\.mpi-agent-chat__input-row \.mpi-btn \{\s*min-height: var\(--agent-composer-h\)/);
    assert.match(read('styles/shell/landing.css'), /min-height: var\(--agent-composer-h\)/);
    // MpiInput sets no `rows`, so the browser default of 2 sized it before this ran.
    assert.match(read(CHAT_JS), /textareaEl\.rows = 1/);
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
