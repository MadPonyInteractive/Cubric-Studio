# MPI-1002 Validation

## Built (2026-09-30, session 43678b37, phase 2 of MPI-1000; Fabio chose option A)

- Step 1: `js/services/flowEnhance.js` (new) is the shared enhance primitive; `runEnhanceDecl` is the
  only Flow-path caller of `llmService.enhanceFlow` and logs `[flow-enhance] <flow> enhanced on
  <backend> (<model>), N ms`. MpiBaseFlow keeps UI state only; the hand run builds byte-identical
  enhancer requests (golden captured from HEAD's code: 5 prompts + 2 whole `/llm/enhance` bodies).
- Step 2: `agentFieldSpecs` omits `hidden: true` fields (Song's three caption blocks);
  `resolveFlowFieldValues` ignores caller values for them with one warn (no `unknown`) and returns
  the raw `resolved`; a voices cast sent as text now round-trips instead of being dropped.
- Step 3: `settleInGraphEnhance` (llmService) called once in `commandExecutor.runCommand` before
  params are built (the one point local and Pod both pass): an in-graph enhancer flag with a
  non-ComfyUI pick is enhanced on the picked backend with the model's recipe and the graph node
  switched off; exempt ops forced off; a failed enhancer stops the job. Stale "app toggle" docs fixed.
- Step 4: `adoptHiddenTargets` at the frame's seed: an agent-opened Song's blocks count as
  machine-written, so Review lyrics then Cue enhances once.
- Step 5: `docs/agent/flows.md` tells Cosmo how Song's fields work (section tags only, one voice row
  per singer, who sings where in voice notes, never send the three blocks).
- Step 6: `buildFlow` (agentDispatch) calls `enhanceFlowRun` after the fields resolve; a failed
  enhancer refuses; the patch reaches the graph params and the saved snapshot (`enhanceWrote`).
  Wrong-field refusals list only the fields the agent was shown. Routines enhance too (same door).

## Evidence

- `node --test tests/flow-enhance.test.cjs tests/enhance-control.test.cjs tests/flow-enhance-ownership.test.cjs`: 32 pass.
- `node --test tests/connector-flow-dispatch.test.cjs`: 14 pass (worker mutation: 4 new tests fail on HEAD's file).
- `node --test tests/in-graph-enhance.test.cjs tests/output-prompt-capture.test.cjs`: 77 pass; llm-service 31 pass
  (9 flag spellings x 3 picks x 2 ops; real `enhance()` with only fetch stubbed; 3 mutations caught).
- `node --test tests/flow-enhance-agent.test.cjs` + agent-flow-handover, routine-runner, connector-flow-dispatch,
  agent-dispatch: 44 pass.
- `npx playwright test --config=playwright.desktop.config.js tests/desktop/flow-enhance-writes-textarea.spec.js`: 2 passed (hand path unchanged).
- `npm test`: 2572 pass, 0 fail, 2 skipped. Lint clean.

## Live matrix (step 7) - PASSED 2026-10-01, session f60f51ad

Fabio 2026-10-01: YES, ~$0.02, cap $0.05. Rig: own Electron (own profile, port, APP_DOCUMENTS
under `%TEMP%/c1002`, CDP 9372), real engine root (pins clean), Fabio's :48188 engine, every
dispatch under `gpu_lease.py run`, queue empty before each, no cancels. Cosmo on local Ollama
`ornith:9b` (the Ollama-cloud DeepSeek tag answers `410 Gone`), so DeepInfra billed only the enhancer.

| Leg | Pick | Log line | Engine jobs | Sidecar |
|---|---|---|---|---|
| Cosmo duet | DeepInfra | `Song enhanced on deepinfra (google/gemma-4-26B-A4B-it), 6515 ms` | Song only | 3 blocks, `enhanceWrote` |
| Cosmo duet | Ollama | `Song enhanced on ollama (gemma4:e4b), 13645 ms` | Song only | 3 blocks, `enhanceWrote` |
| Cosmo duet | ComfyUI | `Song enhanced on comfy (qwen3vl_4b_abliterated), 27319 ms` | 13-node enhancer `2a86c56e`, then Song | 3 blocks, `enhanceWrote` |
| Song by hand | DeepInfra | `Song enhanced on deepinfra (...), 5742 ms` | Song only | 3 blocks, `enhanceWrote` |
| Cosmo opens Song, Review lyrics, Cue | DeepInfra | one line (count 4 -> 5) | Song only | cast `Voice 1 (Male)\nVoice 2 (Female)` |
| Cue again, unchanged | DeepInfra | none (count stays 5) | Song only | same blocks reused |
| Character Sheet Enhance | DeepInfra | `Character Sheet enhanced on deepinfra (...), 1679 ms` | none | phrase written |
| Raw connector krea2 t2i, `Input_enhance_prompt: true` | DeepInfra | `[in-graph-enhance] t2i on krea2: enhanced by deepinfra (...); the graph's enhancer is off` | graph ran `Input_enhance_prompt: false`, `Input_Positive` = enhanced text | - |

ComfyUI `/history` 23:38Z-00:00Z: exactly ONE enhancer job (the ComfyUI-pick leg). Spent: 5 DeepInfra
enhancer calls on gemma-4-26B ($0.07/M in, $0.34/M out), about $0.003 by published rate (estimate,
not a billed figure); Cosmo $0 (local).

**Found and fixed in the run (step 2's voices contract):** Cosmo sent the cast as the STRING
`[{type:"Male"},{type:"Female"}]`, the notation `docs/agent/flows.md` shows, and the graph got ONE
`Voice 1`: `deserialiseVoices` read it as a caption line. It now parses rows sent as text (JSON or
unquoted keys) against the declared types. `tests/flow-field-constraints.test.cjs` failed first, then
28/28 with `connector-flow-dispatch`; the cue leg above is the live proof (two rows reached the graph).
After the fix: `npm test` 2591 pass, 0 fail, 2 skipped; eslint clean on `declaredFields.js`.

## Fabio's look, round 1 (2026-10-01) - Song asked AFTER opening

Cosmo (DeepSeek, his app) opened Song on its first turn (`flow.open` in his app.log, no ask), then
offered Review lyrics, which then had nothing to open. Root cause: `docs/agent/flows.md` said "write
the song first, then ask before it runs" without saying where, and opening runs nothing, so the open
read as the ask; this card's 13-line field block under it buried the rule further. Fixed: Song is
now two numbered steps (song IN THE CHAT + options, no `generate` yet; then open or run), the field
notes cut to one paragraph (the hidden blocks need no rule: the agent no longer sees them), and
"press Generate" -> "press Cue" in flows.md and `_openFlow`'s reply (`services/agentLoop.mjs`).
`agent-loop`, `agent-prompt-budget`, `flow-field-constraints`: 179 pass, 0 fail.

Round 2 (same night): the order now holds (lyrics in chat, options, then `flow.open` at 00:18:01 in
his app.log, engine queue empty). Two follow-ups fixed: the step line read "Starting generation" over
the open (now "Opened <Flow>" on the done frame, `agentLoop.mjs`; `agent-loop.test.cjs` failed first,
165 pass after); and Cosmo tagged `[Verse 4 – woman]` / `[Chorus – both]` (sung words), which the
round-1 wording "lyrics and who sings what" invited: now "then one line on who sings where" plus a
Right `[Chorus]` / Wrong `[Chorus - both]` pair.

Round 3: lyrics in chat with options, Review lyrics -> `flow.open` (00:26:06), the field's tags bare
(`[Bridge]`, `[Chorus]`); then his own run enhanced on DeepInfra in HIS app (`Song enhanced on
deepinfra (google/gemma-4-26B-A4B-it), 4558 ms`, 00:27:17). The label and "press Cue" fixes are
server code (shown after an app restart).

**Fabio 2026-10-01: YES, close MPI-1002.** His follow-up ask (Review lyrics / Just do it as real
buttons that act on click, no agent turn) is a new card under MPI-1000, not this one.
