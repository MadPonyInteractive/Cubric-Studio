# MPI-1191 Keyframes to Video Flow (IDEA, not a blocker)

## DECIDED 2026-10-24 (Fabio, brainstorm in "LTX 2.5 model 10") - supersedes the sections below where they differ

**NOT in the LTX 2.5 release** (Fabio, later the same day: too big for it; the Storyboard Flow
MPI-1231 ships alone). Parked under MPI-1134 (Story) with this design intact. Plan draft in `plan.md`
predates the design and must be rewritten when the card is picked up.

- **ONE step.** In: a stack (a storyboard from MPI-1231, or any stack the user made) OR pictures
  picked from the library, in order. Plus a **section prompt** (the main direction for the whole clip),
  **one length slider** for the clip (max 15 s), and the model: **LTX 2.5 or MiniMax H3** (both).
- **Per-picture lines come from each card's NOTE** ("Dolly in, the character runs right"; "comes to a
  stop, crash zoom out revealing..."), so there is no per-picture UI and no mid-Flow editing.
- **Pictures evenly spaced**: first on the first frame, last on the last, the rest evenly between.
- **The enhancer writes ONE timed prompt** from the section prompt + the lines (no model patch, works
  on both models). Show it like Character Sheet's enhanced prompt.
- **Timing advice only** (v1 never mentions Infinite Video): too many pictures for the length, or over
  the recommended length. Floor ~1.5-2 s per picture, to be set by the bench.
- Output: one ordinary video card. Re-render = run the Flow again.
- New piece: a Flow media input that takes a STACK and expands it into its ordered members (the Flow
  picker hides stacked cards today, D5 in `docs/stacks.md`).
- **Not v1 (Story umbrella MPI-1134):** several sections, a video per section, Generate for the missing
  sections, the Storyboard Editor workspace, Infinite Video (it directs: cuts vs extends, continuity,
  makes its own keyframes from loose references, runs this Flow's graph in 5-10 s clips, joins them).
- LTX Director (WhatDreamsCost, GPL-3.0) was ideas only: nothing copied (`research/ltx-director.md`).

**Widened 2026-10-21 (Fabio):** both LTX 2.3 and MiniMax H3 accept keyframes, so the Flow offers
both models (user picks, like Extend Video, MPI-591). Four or five pictures or more; the model fills
each gap with whatever the prompt asks for. Panels from the Storyboard Flow (MPI-1231) are one input.
LTX arm: core `LTXVAddGuide` at any `frame_idx` (FL2V already chains two, first @ 0 and last @ -1:
`docs/models/ltx/workflow-authoring.md`); for a guide of 9+ frames `frame_idx` must divide by 8.
Open: one prompt for the whole run, or an optional prompt per gap.

Fabio, 2026-10-18: save as an idea. Nothing waits on it.

## Who it is for

- Artists with **drawings** that need animating (key drawings, the model draws the in-betweens).
- **3D animation** blocked out with only the main key poses (rendered stills of the keys).

## The shape

- Drop in a bunch of pictures, in order.
- Each picture gets a **slider for how many frames (or how long) it covers** before the next one.
- One prompt box for the motion / style.
- Output: one clip that lands on every key.

A 5 s shot can take many keys here: the keys ARE the motion, so close spacing is the point, unlike
a Story shot where a few anchors guide free motion.

## Mechanism

Core `MiniMaxH3AddGuide` (already shipped, used by H3 Extend): one node per picture, chained, each at
its `frame_idx` (24 fps pixel frames). Node facts and what is proven:
`tasks/MPI-1134/research/h3-addguide-keyframes.md`.

## Before building

- Public evidence that it runs: 4 chained anchors in a 10 s H3 clip (MPI-1134 research note).

- The MPI-1134 Phase 3 keyframe bench answers whether mid-shot and many anchors hold at all. Add an
  arm here: ~8 drawn keys in 5 s, line-art in, does H3 keep the drawn style or turn it photoreal.
- Which H3 weights honour mid anchors (r2va / fl2va / t2va).
- The frame grid: H3 lengths snap to 17k+5, LTX to 8k+1; total of the sliders must snap to the picked model's grid.
- The same bench arms on LTX 2.3: does it hold 5+ mid-shot guides, and at what strength.

## Same node, other uses (tracked elsewhere)

Infinite Video / Story (Cosmo placing anchors and cuts) and Mix gap-fill live in MPI-1134 Phase 3
and Phase 7. When this Flow is built, use `/mpi-add-flow`.
