'use strict';
/**
 * agent-ui-surfaces.test.cjs — MPI-774 Phase 5
 *
 * The four agent-surface rules Fabio's first round produced. There is no DOM runner in
 * this suite, so each one is asserted where it is declared — the CSS rule, or the branch
 * in the component source. They exist to fail when a later edit quietly takes one back.
 *
 *  1. Stop stays reachable (the agent has no cancel tool; the user's Stop is the only way
 *     to halt a generation it started). MPI-797 Phase 3 answered this by deleting the
 *     prompt box's agent face entirely, so rule 1 is now "the box is never stripped down".
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

// ── 1. The prompt box is a prompt box, always (MPI-797 Phase 3) ──────────────
// Rule 1 used to read "agent mode must not hide the run column, because the user's Stop is
// the only way to halt a generation the agent started". Phase 3 answers it far harder: the
// prompt box is never stripped down at all, so the whole run cluster is always on screen.
// These guard that, which is the same protection stated at the new surface.

test('the prompt box has no agent face left — no modifier, no toggle slot, no agent branch', () => {
    const css = read(PROMPT_BOX_CSS);
    const js = read(PROMPT_BOX_JS);
    // A rule matching the modifier, not a mention of the name inside a comment.
    assert.doesNotMatch(css, /^\s*\.mpi-prompt-box--agent-mode[\s.>:,{]/m,
        'the --agent-mode modifier is what stripped the box down; it must stay deleted');
    assert.doesNotMatch(css, /^\s*\.mpi-prompt-box__popup--agent[\s.>:,{]/m,
        'the popup lost its agent class with the box`s agent face');
    assert.doesNotMatch(js, /\b_agentMode\b(?![^\n]*\/\/)/,
        'no agent branch may come back into the prompt box; the agent has its own composer');
    assert.ok(!js.includes('mode-toggle-slot'), 'the Agent|Prompt toggle slot is gone');
});

test('nothing hides the run column any more — Stop is always reachable', () => {
    const css = read(PROMPT_BOX_CSS);
    // Any rule that sets display:none on the run column, whatever prefixes it.
    const hides = css.match(/[^}]*__col--run[^{}]*\{[^}]*display:\s*none[^}]*\}/g);
    assert.equal(hides, null,
        'the user`s Stop is the only way to halt a generation the agent started');
});

test('the run column keeps its full cluster: no stop-only special case survives', () => {
    const js = read(PROMPT_BOX_JS);
    // __stop-host existed ONLY so the agent-mode rule could spare it. Rule gone, class gone.
    assert.ok(!js.includes('mpi-prompt-box__stop-host'),
        'the class had one consumer (the deleted agent-mode rule) and goes with it');
    assert.ok(!read(PROMPT_BOX_CSS).includes('__stop-host'));
});

// ── 1b. The pinned settings panel (MPI-774 Phase 7, re-homed in MPI-797 Phase 3) ──
// Fabio, 2026-09-19: one boolean. Cog shut, the agent picks the model and the settings from
// MODEL DEFAULTS; cog open, the user owns both and the agent still owns the prompt, the
// media, the op and the card name. Enforcement is code in agentDispatch (its own test file,
// agent-pinned-settings.test.cjs) — these assert the SURFACE that arms it.
//
// Phase 3 changed the TRIGGER and nothing else: the box's own `_agentMode` is gone, so the
// rule reads `state.agentMode` — the flag that local mirrored all along, now set by the top
// bar's Agent button instead of a toggle in here.

test('the pinned panel is armed by state.agentMode, not by a deleted local flag', () => {
    const js = read(PROMPT_BOX_JS);
    const outside = js.match(/const onPopupOutsideClick = \(e\) => \{([\s\S]*?)\n        \};/);
    assert.ok(outside, 'the outside-click dismiss must still exist');
    assert.match(outside[1], /if \(state\.agentMode === true\) return;/,
        'a stray click on the canvas must not hand the settings back to the agent');
    const closeAll = js.match(/Events\.on\('ui:close-all-popups',([\s\S]*?)\}\)\);/);
    assert.ok(closeAll, 'the close-all pulse handler must still exist');
    assert.match(closeAll[1], /if \(state\.agentMode === true\) return;/, 'Escape reaches this pulse');
    // Open is what WRITES the boolean the dispatch gate reads.
    assert.match(js, /if \(state\.agentMode === true\) state\.agentSettingsPinned = true;/);
    // The panel can also close while the cog is still open, and that hands the settings
    // straight back. `_applyAgentView` carried this line before Phase 3 deleted it.
    assert.match(js, /Events\.onState\('agentMode',[\s\S]{0,200}state\.agentSettingsPinned = val === true && popupActive;/);
    // A destroyed box must not leave the flag set with no panel to see.
    assert.match(js, /state\.agentSettingsPinned = false;[\s\S]{0,200}popupNode\.parentNode\.removeChild/);
});

test('the cog says what opening it costs, before the click', () => {
    const js = read(PROMPT_BOX_JS);
    // [data-info] is the status-bar line (js/shell/statusBar.js), and it is the only copy
    // readable BEFORE the panel is open.
    assert.match(js, /const COG_INFO_AGENT = 'In agent mode, when you open this panel, you control the settings and the model, not the agent\.'/);
    assert.match(js, /setAttribute\('data-info', val === true \? COG_INFO_AGENT : COG_INFO\)/);
});

// ── 1c. agent:send went with the toggle (MPI-797 Phase 3) ────────────────────
// It had one producer (the toggle) and one consumer (the panel's stand-in listener), and
// the panel's own composer calls _sendMessage directly. Deleted as a set so neither half
// can be left dangling — this is the guard that they stay deleted together.

test('agent:send is gone from every side: emit, listener and the event catalogue', () => {
    assert.ok(!read(PROMPT_BOX_JS).includes('agent:send'), 'the producer went with the toggle');
    assert.ok(!read(CHAT_JS).includes("Events.on('agent:send'"), 'the stand-in listener goes too');
    assert.ok(!read('js/events.js').includes('agent:send'), 'and its entry in the catalogue');
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
    // The prompt box's `__col--mode` rebound the same cream for the toggle's head. MPI-797
    // Phase 3 deleted the toggle, so there is one agent surface now, not two — and the box
    // must NOT carry a cream rebind of its own: it is the selected model's colour (MPI-736).
    assert.doesNotMatch(read(PROMPT_BOX_CSS), /^\s*\.mpi-prompt-box__col--mode[\s.>:,{]/m);
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

// ── 5. The spend card says whose money it is, and never formats the figure (MPI-876) ──
// Same reason as the four above: this is DOM code and there is no DOM runner here, so each
// rule is asserted where it is declared. These are not style points. The sentence is what
// the user agrees to before their own DeepInfra account is billed, and every clause in it
// was argued for: `docs`-free, it lives in the card's plan.md.

test('the spend card quotes the estimator verbatim and never renders a number of its own', () => {
    const js = read(CHAT_JS);
    // `price` goes into the sentence exactly as it arrives. It already carries "about", and
    // below a cent it is one significant figure — `toFixed`, `Number()` or a currency
    // formatter over it would say "$0.00", which reads as free.
    assert.match(js, /costs \$\{price\}/, 'the figure is interpolated whole');
    assert.doesNotMatch(js, /price[^\n]*\.toFixed\(|Number\(price\)|toLocaleString\([^)]*price/,
        'nothing may reformat the estimator\'s own string');
});

test('the spend card names whose key pays, and asks even when it cannot quote', () => {
    const js = read(CHAT_JS);
    assert.match(js, /Runs on your DeepInfra key and costs \$\{price\}\./);
    assert.match(js, /Runs on your DeepInfra key and costs \$\{price\} for \$\{count\} generations\./,
        'a batch quotes the BATCH figure and says how many it covers');
    // A price tag may stay silent when it cannot quote; a spend gate may not. And the line
    // names no CAUSE: a price is missing far more often because the endpoint is not in the
    // snapshot than because the model bills by GPU time, and naming the wrong one of those
    // tells the user something false.
    assert.match(js, /Runs on your DeepInfra key\. The cost is not known until it finishes\./);
    // In a quoted STRING, not anywhere in the file — the comment above that sentence
    // explains the three reasons a price can be missing, and has to be free to say so.
    assert.doesNotMatch(js, /(['"`])[^'"`\n]*GPU[^'"`\n]*\1/, 'the null line must not guess why');
});
