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
| MPI-1004 | Cosmo picks a library voice itself when a voice line has no sample | `tasks/MPI-1004/task.json` |

(MPI-1001 is a peer's RunPod card, not a member.)

## Phases

1. MPI-998, MPI-999 and MPI-1003 in parallel (below).
2. MPI-1002 (its gap 1 needs Fabio's call first: the agent run calls the selected enhancer, or
   Cosmo writes Song's three blocks itself).
3. MPI-997, once MPI-603 (same graph, head-removal branch on LanPaint) is closed. Run it through
   `/mpi-add-flow` (a second workflow for a Flow) and the `docs/models/klein/` graph rules.
   Check MPI-603's column first; if it is still `validating`, build on top of it, never beside it.
   After MPI-1003 so the new workflow gets the agent steps too.

## Parallel Batch - phase 1

- **MPI-998 Object Stamp flip**
  Ownership: js/components/Organisms/MpiStepPlace/MpiStepPlace.js,
  js/components/Organisms/MpiStepPlace/MpiStepPlace.css,
  js/components/Primitives/MpiCanvas/managers/ShapeManager.js (only if the preview draw lives there)
  **Verify:** a unit test that the step value carries the flip and the Auto stamp is mirrored;
  live on an isolated app, Object Stamp result mirrored in Auto and in Manual.
- **MPI-999 Recording silence strip**
  Ownership: js/components/Blocks/MpiAudioRecorder/MpiAudioRecorder.js, a new import-free helper
  under js/utils/ (NOT js/utils/toWavFile.js: the voice library shares it), its test under tests/
  **Verify:** bare-Node unit test (silence/tone/silence, all-silence, no-silence); live on an
  isolated app, a take with pauses at both ends saves without them.
- **MPI-1003 Playbook agent steps**
  Ownership: docs/playbooks/add-flow/, docs/playbooks/add-model/, the /mpi-add-flow and
  /mpi-add-model skill definitions
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

## Current State

2026-09-30 (Agent 74): created; MPI-1002 and MPI-1003 added the same day at Fabio's ask. Nothing
started. Member cards stay open until their work lands (Fabio's pick). Next: phase 1 with
`mpi-execute-parallel` (or one card at a time); ask Fabio MPI-1002's gap-1 question before phase 2;
check MPI-603 before phase 3.
