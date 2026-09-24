# MPI-903 — Agent knowledge: rules route, docs teach

## Current State

Planned 2026-09-24 from the MPI-891 close-out discussion; Fabio approved the direction. No code
yet, card still in `todo` - `beginImplementation` (todo -> doing + files.json) before the first edit.
Next: Phase 0 baseline. Handoff bf5770d4.

Measured (scratchpad `measure.mjs`, the real `_buildSystemPrompt` + `TOOL_DEFS`): **43 KB, ~11k tokens
on every request** — system prompt 25.4 KB (20 rules ~24 KB), tool schemas 17.7 KB, knowledge index
1.6 KB (41 lines: 16 model, 12 guide, 7 skill, 6 app). Biggest rules: Masking 4.9k, Route 3.6k,
Model 2.0k, Cards 1.5k, Settings/Box/Voice ~1.2k. Biggest tools: generate 3.8k, the four GIF tools
4.8k, look 1.4k.

Fabio's direction (memory `feedback_agent_knowledge_one_home_no_stories`): information only — what
and when, no incident stories, no dates, no "Fabio said"; no repetition; keep healing as it grows.

## Principles

1. **One home per fact**, preferred in this order: a code check in a tool result (refusal/hint:
   costs tokens only when it fires, cannot be skipped) → a routing rule (1-3 sentences, always
   loaded) → an `app:*` doc via `read_knowledge` (gated where skipping it breaks a run) → a
   catalogue entry (`list_models`/`describe_model`).
2. **Rules route, docs teach.** A rule says when, and points at the doc that says how.
3. **Docs may carry right/wrong example pairs**, never the story behind them.
4. **Guards, not willpower:** a budget test and a no-story test fail the build when either drifts.

## Phases

### Phase 0 — Baseline (before any edit)
- `npm run agent:test` (21 real-model cases × 3 runs) on HEAD; record per-case pass counts, tokens,
  cost in validation.md. Key from memory `general.md` (DeepInfra).
- **Verify:** the table exists in validation.md.

### Phase 1 — Code does what code can (tool results)
- Masked `generate` before `app:masking` was read → `KNOWLEDGE_NOT_READ`, same mechanism as
  `GUIDE_NOT_READ` (`agentLoop.mjs:1479`).
- Several separate painted areas on an edit/inpaint op → refuse with "one area per run, or detail
  for several" (mask blob count at dispatch, `agentDispatch.js` where the mask is read).
- Head-swap box with squareShare over 0.6 → refuse, "measure again, head only".
- `look` refusal → the result carries the "switch to the local describer" hint.
- **Verify:** a unit test per gate, each mutation-proved (remove the check → red).

### Phase 2 — Rules rewritten
Per rule: keep + condense (Voice, Model, Route, Settings, Project, Cards, Memory, Chaining, Numbering,
Text, Shape, Naming, Docs, Looking-minus-refusal, Duration-core) · drop (Installation = tool
description, Guide = gate, Deletion = limits list) · move to a doc (Masking detail, Box, frame/grow).
Target: system prompt ≤ 9 KB. Index lists `app:*` only; `skill:*` leaves the in-app listing
(outside agents keep it via the connector route).
- **Verify:** `tests/agent-loop.test.cjs` rule slices updated; new `tests/agent-prompt-budget.test.cjs`
  (system prompt + tools under budget; no `20\d\d-\d\d-\d\d` / "Fabio" / "Live " in rules, tool
  descriptions or `docs/agent/*.md`).

### Phase 3 — Docs
- `docs/agent/masking.md`: dedupe against the rule, strip stories to example pairs, add the
  upscale-first tip (small target area → enlarge the picture first, no upscale model, then inpaint;
  until MPI-904 the user runs Resize from the tool rail).
- New `docs/agent/flows.md` (boxes, frame/grow for outpaint) — takes the Box rule and
  `generate.params`' prose.
- Trim tool descriptions to what the tool does and its args.
- **Verify:** agent-corpus tests; budget test.

### Phase 4 — Prove
- `npm run agent:test` × 3 again; every case at or above baseline. `--bite` still bites.
- `node --test tests/agent-*.test.cjs tests/connector-*.test.cjs`; eslint on touched files.

## Verification

**Verify mode:** auto (harness + suites). A live spot check by Fabio is welcome, not required.

## Remaining Work

All phases.

## Plan Drift

(none yet)
