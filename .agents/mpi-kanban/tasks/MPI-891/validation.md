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
