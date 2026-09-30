# MPI-892 Plan - each Flow says how Cosmo uses it; Cosmo can open a Flow filled in

Brief: `brief.md` (Fabio's per-Flow sort, 2026-09-30).

## Shape

- **`agentOpens` on a FlowDef** (`js/data/flowsRegistry.js`): where the Flow opens when the
  agent reaches for it. A middle step's `kind`, or `'run'` for the Generate step. Absent = the
  agent runs it. Set on four: `scribble-object` (Draw It In) `paint`, `scribble` `paint`,
  `object-stamp` `cutout` (its hint already says "already cut out? skip this step", so the user
  cleans up and then places), `minimax-music` (Song) `run`.
- **Opening is its own route and job, never a flag on generate** - the `/connector/quote`
  precedent: a dropped or mistyped flag must fall towards NOT running. `POST /connector/open-flow`
  -> renderer capability `flow.open` -> `agentDispatch._openFlow`.
- **`_openFlow`** (renderer): the open project only; refuses while `followBlocker` says the user
  is mid-gesture or has an overlay up (the same guard as MPI-891). Resolves media and declared
  fields exactly as `buildFlow` does, but lets empty slots, boxes and frames through (they are
  the user's to fill). Seeds `state.s_flowInputs[flowId]` - the store Reuse restores through
  (`openFlowFromReuse`) - and emits `flow:open { flowId, openAt }`. Where: the Flow's
  `agentOpens`; else `inputs` when a required slot is empty (the missing voice sample); else
  `run`. Answers the step's title and hint so the agent can say what to do there.
- **`MpiBaseFlow` opens at `openAt`** (prop, threaded by `shell.js`'s `flow:open` handler):
  `inputs` = 0, a kind = its visible slide, `run` = the last.
- **The loop** (`services/agentLoop.mjs`): a `generate` naming a Flow with `agentOpens`, or with
  `open: true`, goes to `openFlow` and never to `generate`: no box gate, no spend, no inflight.
  Only on a typed turn (`this._follow`); a wake or a carry is refused. A Flow's MEDIA_REQUIRED
  refusal gains "or offer to open it for the user (open: true)". `open` is one new generate
  property (TOOLS budget raise, reason in the constant).
- **Duration rule**: drop the stale "you never speak first..." sentence (SYSTEM shrinks).
- **Knowledge**: `docs/agent/flows.md` (app:flows) gains a "Flows the user finishes" section.
- **Catalogue**: `list_models`' flow entries carry `opens` so the agent knows before it asks.

Ownership: js/data/generationControls.js, services/userFlows.js, docs/flow-packages.md,
tests/agent-no-delete.test.cjs, js/data/flowsRegistry.js, js/shell.js, js/components/Blocks/MpiBaseFlow/MpiBaseFlow.js,
js/components/types.js, js/shell/agentDispatch.js, routes/connector.js, services/agentTools.mjs,
services/agentLoop.mjs, docs/agent/flows.md, docs/agent-chat.md,
docs/playbooks/add-flow/01-descriptor-and-ops.md, tests/agent-prompt-budget.test.cjs,
tests/agent-flow-handover.test.cjs, tests/agent-loop.test.cjs

## Phases

1. Flow setting + the frame opening at a step (flowsRegistry, types, MpiBaseFlow, shell.js)
2. The open job and route (agentDispatch `_openFlow`, connector route, agentTools)
3. The loop: routing, `open` property, refusal wording, Duration rule, budgets
4. Knowledge and docs (app:flows, agent-chat.md, add-flow 01)
5. Verify: unit tests, npm test, a live open on an isolated app, then Fabio's look

## Verification

**Verify mode:** user-ux

- `node --test tests/agent-flow-handover.test.cjs tests/agent-loop.test.cjs tests/agent-prompt-budget.test.cjs`
- `npm test` green.
- Live, own isolated app (never :3000): POST `/connector/open-flow` for Scribble, Object Stamp,
  Song and Text to Speech with no voice sample; each opens at its step with the fields filled.
- Fabio: ask Cosmo for a Scribble, an Object Stamp, a Song, and a Text to Speech without a
  voice; each opens where it should, filled in, and nothing runs until he presses Generate.

## Current State

2026-09-30 (Agent 73): built and self-verified; card `validating`, waiting ONLY on Fabio's look
in his own app (restart it first: the renderer loads the new code on start). Evidence in
validation.md: `npm test` 2407/0, lint clean, live opens of Scribble / Object Stamp / Song / Text
to Speech on the isolated rig (`%TEMP%/c892`, CDP 9392; launcher + `cdp-eval.mjs` + `open3.mjs`
in session 8a36810a's scratchpad). Uncommitted. On his yes: `mpi-end-session` (commit by
pathspec, the MPI-889 umbrella plan's Current State to phase 3 done, then 950 is the last member).

Later the same session (Fabio's look, round 1): "make a scribble of a cat" correctly went to Klein
9B's Doodle style, not the Flow (my test line was wrong). His shape for the real trigger ("is
there any way I can scribble something and you convert it to a nice image?"): Cosmo offers both
(Draw It In = add to an image, Scribble = start from a drawing) as `[options: ...]`, opens the pick
at its drawing step; "I've drawn it" -> "go to the last step and press Generate". Done in app:flows,
and the Flow rule now reads app:flows before an ANSWER about a Flow (SYSTEM 10,423 / 10,460).
npm test 2407/0. Fabio still to redo checks 1-5 after a restart.

2026-09-30 (Agent 74): the parked-Flow question is answered, no fix: `suspend` -> `hide` ->
`Overlays.release`, so a parked Flow leaves the depth and `openFlow` is not refused (validation.md).
26b63204f is pushed (origin/master at 6e0342e4a). Only Fabio's checks 1-5 remain, then close.
Fabio: checks 1 and 2 PASS. Found in his look and fixed (uncommitted): an audio result's chat tile
read "Did not finish" (MpiAgentChat .js/.css + two tests, validation.md). At close-out also: the
Docs site agent page (`Cubric Studio (Docs)/agent/index.html` + `pages/agent.html`, local commit,
NEVER push) says "the right model or Flow ... offers to install it" (it installs models only; a
missing Flow it tells the user to add) and does not mention the four Flows Cosmo now opens.
The website's "Picks the right model and installs it" is true: no change. New cards MPI-998,
MPI-999 and umbrella MPI-1000 (with MPI-997) created in todo at Fabio's ask; commit their folders.
Round 2 done (uncommitted, validation.md): the look note before a redo, Song asks Review lyrics |
Just do it, prompt line "image, video and sound tool", Flows carry `does` + IS_A_FLOW refusal, the
Docs page EDITED (commit it in the Docs repo, never push). Checks 1, 2, 3 (both paths) PASS; the
Song "Starting" stall did not recur. Cards MPI-1002 (Flow enhancement follows the Remote pick) and
MPI-1003 (playbook agent steps) added to umbrella MPI-1000.
NEXT: Fabio restarts, redoes check 4 (a voice line, no sample: expect DramaBox considered, no
install offer; Text to Speech -> offer to open on Inputs) and check 5 (Outpaint / Head Swap run).
His idea, not built, ask whether to card it: for a voice with no sample, Cosmo offers
[Pick from the voice library | You pick one]: the first opens the Flow on Inputs (voice picker),
the second has Cosmo choose from `js/data/voiceLibrary.js` (register, kind, accent) to match
"an old man", "a documentary voice", "a girl". On his yes: mpi-end-session.

## Plan Drift

- 2026-09-30: `resolveAgentMedia` refuses an empty required slot itself, so an open without a
  voice sample or a drawing died there. Added `{ allowEmpty }` (js/data/generationControls.js).
- 2026-09-30: `npm test` caught two more homes for the new names: the Flow-package validator's
  field list (`services/userFlows.js` FLOW_KEYS + docs/flow-packages.md, so a community Flow can
  declare `agentOpens` too) and the in-app agent's route allowlist (tests/agent-no-delete).
- Renderer job exported as `agentDispatch.openFlow` (tested directly).
