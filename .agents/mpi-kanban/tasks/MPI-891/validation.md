# MPI-891 — validation

Verify mode: user-ux.

## 1. Re-run on a named model (folded in 2026-09-22)

Harness case `rerun-on-named-model` (`scripts/agent-test.mjs`), DeepSeek-V4-Flash, real model:

- HEAD rule: **0/3** — i2i restyle every time, picture sent as media (the live miss reproduced).
- New Model-rule sentence (`services/agentLoop.mjs`, RE-RUN task): 5/6 then 6/6 = **11/12** —
  `ill-anime` `t2i`, no media. `--bite` (flip asks for the restyle outright): **bites**.
- Residual: ~1 in 12 still restyles a PHOTO source into i2i. Prompt ceiling on this model; no
  app-side signal can tell a re-run from a restyle without reading the words.
- Side effect measured: `ranked-editor` ("make it a night scene" → kleinEdit) is **0/4 on HEAD**,
  3/4 with this edit. Pre-existing miss, not caused here; it is the Route rule's "night" case
  going to i2i instead of the edit task.

## 2. View follows the work

Automated, 2026-09-22:

- `tests/agent-view-follow.test.cjs` (new): guard table, `followTarget`, D4 routing, both call
  sites navigate before enqueue. Mutation-proved: dropping the D4 widening (1 red), the canvas
  mode check (2 red), the overlay check (2 red).
- `tests/agent-loop.test.cjs` `(MPI-891)`: `follow` sent on a typed turn, absent on a wake and a
  carry. Mutation `_follow = true` → 2 red.
- `tests/agent-mask-dispatch.test.cjs`: MPI-890's "in the gallery the same edit makes a new card"
  REVERSED by D4 on purpose (it passed only because its fixture had no `type`).
- `npm test`: 1823 tests, 1821 pass, 0 fail. eslint on every touched file: exit 0.

**Pending: Fabio's live check** (plan.md § Verification). Needs a full app restart.

## 3. Live read 1 (Fabio, 2026-09-24)

- Check 1 FAILED: a dragged card is a COPIED attachment (`look FRESH attachment att_ec5ef31b.png`),
  so no card owns the picture and the edit made a new card. That's MPI-886; still waiting on Fabio's
  call on whether to fold it in.
- Check 2 PASS: outpaint from `i2i_005` history → the view went to the gallery. Fabio: Flows landing
  in the gallery is RIGHT, and changes are made via Reuse → Flow (reshapes MPI-892).
- Outpaint went wrong twice: the frame is always centred and there is too much to fill in one pass → carded as MPI-900.
- The agent's thinking leaked into its reply ("Actually, let me reconsider", "the user"). Not fixed yet.
- The chat panel cropped portrait images: the result card was a fixed 120x80 box with cover. Fixed in
  `MpiAgentChat.css`: media now capped at 120px on the long side, attachment chips 40px tall with width
  from the image. `agent-ui-surfaces.test.cjs` 14/0. Renderer-only: a reload shows it.

## 4. Harness after the reasoning fix + MPI-900 agent half (2026-09-24)

- Full `node scripts/agent-test.mjs --runs 1`, DeepSeek-V4-Flash-0731: 18/20, $0.074. Both FAILs
  (`create-then-generate`, `new-project-brief`) = stale assertion: `create_project` opens what it
  makes (a2b243de) and the harness still wanted an `open_project`. Fixed.
- Re-run x3: `create-then-generate` 3/3; `new-project-brief` 2/3. Run 3 is a real model miss:
  said "I've noted the premise" with no `write_memory` call. Pre-existing, hidden by the stale check.
- New case `outpaint-grows-one-side` (Fabio's i2i_005 1280x800 "expand it up", 4:5): 3/3, `--bite` bites.
- `tests/agent-outpaint-frame.test.cjs` 5/5; mutation (grow "up" centred) -> 2 red.
  `node --test tests/agent-*.test.cjs tests/connector-*.test.cjs tests/outpaint-passes.test.cjs`
  397 pass / 0 fail. eslint on touched files: 0.
- NOT run: the multi-pass chain on the agent path (`_nextPassFor`) needs a real render. Live check.

## 5. Live read 2 (Fabio, 2026-09-24, DeepSeek-V4-Flash, after a full restart)

- Check 1 PASS: dragged t2i_006 + "indoor swimming pool" -> edit_026 in that card, history open.
- Check 3 (mask holds the view): the view held (MaskShapes still active after the run). But the
  agent did not know a mask was painted: prompt "Keep the blonde girl in front ... add people in the
  lounge chairs" (engine /history a3513f50) went out WITH `Input_Mask`, Klein saw only the masked
  corner and drew a second girl there (edit_027). Root cause: `activeMask()` was read only at dispatch
  (agentDispatch.js), never reported to the prompt writer. FIXED: agentService `_workspaceForTurn`
  sends `masked`, routes/agent.js passes only a real `true`, the App state line names the mask and
  points at the Masking rule. tests/agent-loop.test.cjs +2 (line + sanitiser); agent/connector
  suites 394/0; eslint 0. Needs a re-check after a full restart.
- Check 4 PASS. Check 5 PASS by the rule (Krea 2 t2i, no media) but Fabio: "nothing like the
  original". Source composite_001 is a COMPOSITE: no prompt of its own, so the agent wrote one from a
  look ("I worked from the picture"). A text re-run keeps content, never composition. Open question
  for Fabio (product): offer the Krea EDIT route when the source has no prompt?
- Text in picture PASS ("I am cute", edit_028, words quoted exactly in the prompt).
- Expand up PASS: staged input 1216x1621, 853 black rows on top, 0 at the bottom -> grow "up"
  reached the frame. ONE pass, correct: MPI-900 e7228875 made Outpaint Klein-only, one pass (no
  `maxGrow`), and the agent path follows the registry. The multi-pass code stays for any crop flow
  declaring `maxGrow`, on both frames; test 5 now pins OUTPAINT_MAX_GROW rather than the registry.
- Peer message 6019b4a1 (Mascots 12, 1e62e616): replied "go" (2b8bb876), released MpiAgentChat.js/.css.
