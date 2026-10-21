# MPI-1231 Storyboard Flow (IDEA)

Fabio, 2026-10-21: "The user should be able to ask for storyboards and get a nice storyboard. Maybe
we can make it a flow. This way, Cosmo does less work." Member of MPI-1134 (Story umbrella).

## Who it is for

- Anyone starting a long-form video: the storyboard is the FIRST step, before any clip is made.
- Cosmo: asked for a storyboard, it calls this Flow instead of planning and generating every frame
  itself.

## The shape (as Fabio described it, not settled)

- In: a scene or story in words (plus Elements for the cast and places, when MPI-815 lands).
- Out: a numbered set of panels, consistent characters, the target video's aspect ratio.
- **A stack, not one sheet.** Each panel is its own picture the user can edit one by one (History
  edits), reorder, drop or redo. Fabio: "probably a stack or something like that. Not sure, but we'll
  get to it."

## Where the panels go next

- **Keyframes to Video Flow (MPI-1191):** the panels ARE the keys; the Flow fills the motion between
  them on LTX 2.3 or MiniMax H3.
- **Story shots (MPI-1134 Phase 3):** a panel as a shot's start frame, end frame or mid anchor.
- Or used on their own (a pitch, a shot list).

## Open questions (decide at brainstorm, not here)

- Output shape: one card per panel, one card with the panels as history entries, or a new "stack"
  card kind. Check how the GIF card and the Story card (`docs/story/data-model.md`) hold a list
  before inventing one.
- Is this stack the same thing the Story card's **Storyboard workspace** (MPI-1134 Phase 6) shows?
  The names collide: Phase 6 "Storyboard" today means the shot-list editor page. If the panels
  become the Story card's shots, it is one storyboard with two ways in.
- Image model per job (`project_flows_chain_best_model_per_job`): a planner step that splits the
  scene into panels, then a consistency-keeping image model for the panels.
- Panel text: shot description, camera, duration under each panel, or none.
- How many panels by default; the user sets it.

## Before building

Use `/mpi-add-flow`. Brainstorm the output shape with Fabio first (it is a look-and-feel call).
