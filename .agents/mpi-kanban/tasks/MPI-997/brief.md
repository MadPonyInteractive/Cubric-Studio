# MPI-997 Brief

Character Sheet splits into two ComfyUI workflows, so the head removal is its own fast run.

## Why

Fabio, 2026-09-30, while sorting the Flows for the in-app agent (MPI-892): the head removal
is a fast operation, so it should not ride inside the one long Character Sheet graph.

## His shape, in his words

"Character sheet needs to be broken up into two ComfyUI workflows. I think pressing the
button that removes the head becomes calling a workflow: the part of the workflow that
actually replaces the head. Pressing it would run it, and pressing it would return to the
original. And running the flow with its press would just run that second workflow
sequentially."

Read as:

1. Workflow A: the sheet itself (today's graph without the head-removal branch).
2. Workflow B: the head removal alone, run on a finished sheet.
3. The `Input_Remove_Head` toggle ("Headless front body") becomes a button on the result:
   press = run workflow B on the sheet; press again = back to the original sheet.
4. A full Flow run with the button pressed runs A, then B, one after the other.

## Constraints

- Same graph as MPI-603 (retire the outpaint LoRA; head-removal branch re-authored onto
  LanPaint), which is still `validating` on Fabio's live run. Land after it, or on top of it.
- The in-app agent runs Character Sheet with no questions (MPI-892's table); the split must
  keep one `generate` call enough for the agent.
- Flow wiring: `/mpi-add-flow` playbook (`docs/playbooks/add-flow/`); graph authoring rules
  in `docs/models/klein/`.
