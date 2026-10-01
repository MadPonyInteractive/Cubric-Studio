# MPI-1000 Plan - small Flow and media fixes (umbrella)

Fabio, 2026-09-30: three small jobs found while testing MPI-892, to pick up together in one
separate session. They share no files, so the two small ones can run in parallel; the
Character Sheet split waits on MPI-603.

## Members

| Card | Title | Brief |
|---|---|---|
| MPI-997 | Character Sheet splits into two workflows: the head removal becomes its own fast run | `tasks/MPI-997/brief.md` |
| MPI-998 | Object Stamp: flip the object before placing it | `tasks/MPI-998/brief.md` |
| MPI-999 | Recordings: strip the silence from the user's audio recordings | `tasks/MPI-999/brief.md` |
| MPI-1002 | Every Flow enhancement uses the enhancer picked in Remote, on the agent's runs too | `tasks/MPI-1002/brief.md` |
| MPI-1003 | Add-flow and add-model playbooks: the steps that make a new Flow or model known to the in-app agent | `tasks/MPI-1003/brief.md` |
| MPI-1004 | Cosmo picks a library voice itself when a voice line has no sample | `tasks/MPI-1004/brief.md`, `plan.md` |
| MPI-1005 | Song asks with a real card: Review lyrics / Just do it act on click, no agent turn | `tasks/MPI-1005/brief.md`, `plan.md` |

(MPI-1001 is a peer's RunPod card, not a member.)

## Phases

1. MPI-998, MPI-999 and MPI-1003 in parallel (below).
2. MPI-1002 (its gap 1 needs Fabio's call first: the agent run calls the selected enhancer, or
   Cosmo writes Song's three blocks itself).
2b. MPI-1004 after MPI-1002 (both edit `js/shell/agentDispatch.js` and `docs/agent/flows.md`);
   its own `plan.md`.
3. MPI-997, once MPI-603 (same graph, head-removal branch on LanPaint) is closed. Run it through
   `/mpi-add-flow` (a second workflow for a Flow) and the `docs/models/klein/` graph rules.
   Check MPI-603's column first; if it is still `validating`, build on top of it, never beside it.
   After MPI-1003 so the new workflow gets the agent steps too.

## Parallel Batch - phase 1

- [x] **MPI-998 Object Stamp flip** (built + unit-verified 2026-09-30; Fabio's live look left)
  Ownership: js/components/Organisms/MpiStepPlace/MpiStepPlace.js,
  js/components/Organisms/MpiStepPlace/MpiStepPlace.css,
  js/components/Blocks/MpiBaseFlow/stepKinds.js (the `place` kind's value/media mapping),
  tests/object-stamp-flip.test.cjs (new). Only if needed: js/components/Primitives/MpiCanvas/
  managers/ShapeManager.js, CompositeManager.js, MpiCanvas.js (preview draw),
  js/components/Blocks/MpiBaseFlow/MpiBaseFlow.js and the `object-stamp` entry of
  js/data/flowsRegistry.js (Manual's flipped object reaching the run).
  **Verify:** a unit test that the step value carries the flip and the Auto stamp is mirrored;
  live on an isolated app, Object Stamp result mirrored in Auto and in Manual.
- [x] **MPI-999 Recording silence strip** (built, unit + desktop spec 2026-09-30; Fabio's ear test left)
  Ownership: js/components/Blocks/MpiAudioRecorder/MpiAudioRecorder.js, a new import-free helper
  under js/utils/ (NOT js/utils/toWavFile.js: the voice library shares it), its test under tests/
  **Verify:** bare-Node unit test (silence/tone/silence, all-silence, no-silence); live on an
  isolated app, a take with pauses at both ends saves without them.
- [x] **MPI-1003 Playbook agent steps** (playbooks + skills done 2026-09-30; scope strings + agent-chat.md pointer wait on MPI-950's claim)
  Ownership: docs/playbooks/add-flow/, docs/playbooks/add-model/, the /mpi-add-flow and
  /mpi-add-model skill definitions (.claude/skills/mpi-add-flow/, .claude/skills/mpi-add-model/),
  docs/agent-chat.md (a pointer only), tasks/MPI-1003/validation.md
  **Verify:** the audit list (what the agent reads) is in the card's validation.md, every item maps
  to a checklist line in a playbook README, and each skill's checklist names the new lines.

## Phase 2 - MPI-1002 Flow enhancement follows the Remote pick

Ownership: js/services/llmService.js, js/components/Blocks/MpiBaseFlow/MpiBaseFlow.js,
js/shell/agentDispatch.js, js/services/commandExecutor.js, the graphs with a `TextGenerate`
enhancer, docs/agent/flows.md.
**Verify:** per its brief: each backend x each enhancement site, the log names the backend, and a
non-ComfyUI pick executes no ComfyUI `TextGenerate`.

## Phase 3 - MPI-997 Character Sheet split

Ownership: comfy_workflows/ (the Character Sheet workflow and its new head-removal twin),
js/data/flowsRegistry.js (the `character-sheet` entry), the Flow's uiComponent if it owns the
"Headless front body" toggle. Exact files at pickup: MPI-603 may have moved them.
**Verify:** per `docs/playbooks/add-flow/`; the in-app agent still runs Character Sheet with ONE
generate call.

## Verification

**Verify mode:** user-ux

Each member closes on its own evidence; the umbrella closes when all three have.

## Plan Drift

- 2026-09-30 (session 43678b37): MPI-603 is release-gated, not graph-gated: its Character Sheet
  graph work is on master and only the 2.0 cut + an R2/HF weight delete remain. So phase 3 builds
  on the current graph; it does not wait for MPI-603 to close.
- 2026-09-30: MPI-1004 planned (phase 2b). Chatterbox REQUIRES a sample (refuses), DramaBox does
  not (runs on its own voice): the brief records both.

## Current State

2026-10-01 (session f60f51ad): MPI-1002 live matrix PASSED and Fabio said yes to close; code
`fb506e1fb` (voices cast as text, Song asks before it opens, Generate->Cue, "Opened <Flow>" label).
NEW member MPI-1005 (Fabio's ask during that look): Review lyrics / Just do it become a confirm card
that acts on click, no agent turn; brief + plan written, not started. It edits `agentLoop.mjs`,
`flows.md` and `MpiAgentChat.js`, so it runs after MPI-1004 or coordinates with it (both touch
`docs/agent/flows.md`). Still owed by Fabio: MPI-998 look, MPI-999 ear test, MPI-1004 A/B/C.

2026-10-01 (session 9c1e6f07): phase 3 MPI-997 CLOSED. The mirrored sheet was a prompt fix (the
left/right order stated in each recipe's first sentence; bench + Fabio's app run), and leg 2 now
frees SAM3 (`MpiClearVram` before Output_Image). CI green on 6f342280c. Left in this umbrella:
MPI-998/999/1002 validating (Fabio's look / ear test / live-matrix yes), MPI-1004 needs-decision.

2026-09-30 (session 123a6c39, handoff): MPI-1003 CLOSED (CI green on 6f86d4d5e). Phase 3 MPI-997 BUILT,
live-verified and committed (evidence `tasks/MPI-997/validation.md`, unit 2582/0); Fabio LOOKED: the
button works, but his first sheet came out MIRRORED (portrait left) and the head removal cut the
portrait. NEXT: `tasks/MPI-997/plan.md` § Open: a MIRRORED sheet - his direction is prompt first
(Recipe_* templates), then detect-big-face-left-and-flip. Still unanswered by Fabio: MPI-998/999 look,
MPI-1002 live matrix ($0.02, cap $0.05), MPI-1004 A/B/C. Agent 77's MPI-923 hunks sit uncommitted in
commandRegistry.js / operationRegistry.js / operation_registry.json: never restore those from HEAD.

2026-09-30 (session 43678b37, end): phases 1 and 2 BUILT and verified by tests (npm test 2572/0).
`validating`: MPI-998 (Fabio's look), MPI-999 (START-only trim per Fabio; ear test), MPI-1002 (live
matrix left: needs Fabio's local ComfyUI + a few DeepInfra calls, ask the price first), MPI-1003
(docs; closes on a green commit). MPI-950 closed and released agentDispatch/agentLoop/mcp, so step 6
and MPI-1003's scope strings landed. MPI-1004 `needs-decision` (offer shape A/B/C; pick A). Open picks
for Fabio on MPI-1002: failed enhancer stops the agent run (built that way); Character Sheet agent run
does not auto-enhance. Next: phase 3 MPI-997 (Character Sheet split) via /mpi-add-flow; it no longer
waits on MPI-603 (release-gated only).

2026-09-30 (Agent 74): created; MPI-1002 and MPI-1003 added the same day at Fabio's ask. Nothing
started. Member cards stay open until their work lands (Fabio's pick). Next: phase 1 with
`mpi-execute-parallel` (or one card at a time); ask Fabio MPI-1002's gap-1 question before phase 2;
check MPI-603 before phase 3.
