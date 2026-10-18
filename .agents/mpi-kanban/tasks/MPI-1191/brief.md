# MPI-1191 Keyframes to Video Flow (IDEA, not a blocker)

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
- The frame grid: H3 lengths snap to 17k+5; total of the sliders must snap the same way.

## Same node, other uses (tracked elsewhere)

Infinite Video / Story (Cosmo placing anchors and cuts) and Mix gap-fill live in MPI-1134 Phase 3
and Phase 7. When this Flow is built, use `/mpi-add-flow`.
