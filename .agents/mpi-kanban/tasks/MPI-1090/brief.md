# MPI-1090 - Clothes reference, round 2: colour drift, the invented back, words that redraw the layout

Umbrella: MPI-1091. Follows MPI-1041 (closed) F2, where the Clothes reference passed one eye test.

## Fabio's test (2026-10-11, project `Qwen 2.1`; reference = black high-neck dress, lace-up side cut-outs, studio photo, FRONT only)

1. `flowCSE_011`, no words. Prompt: "Dress the character in only the outfit from the reference picture. Take off
   everything else ... trousers, skirt and top included. ... close-up ... with the same neckline and straps."
   - Front: the dress lands but **dark grey, not black**. Close-up: black, right.
   - Back: **black shorts + tube top**. The reference has no back, so Klein invented one. Fabio: from behind that
     dress reads as a G-string or plain panties, never shorts.
2. `flowCSE_012`, words "G string on the back view". Builder output: "Dress the character in the outfit from the
   reference picture: G string on the back view, replacing all of the clothes ...".
   - **The front figure was redrawn as a second back view**, and the dress became a bikini on both.
   - Known since F1: naming "the back view" in a free edit makes Klein redraw the layout
     (`characterSheetEditor.js` ~107). The user's words reached the template raw.

The input sheet was a headless output (grey oval), see MPI-1089. That may have fed the grey too: bench with a
with-head sheet to separate the two.

## Questions to bench (NO GPU until Fabio frees it; under gpu_lease)

- Colour: does "in the same colours as the reference" hold the front at black? Is the grey from the oval / backdrop?
- Back view: what should the back show when the reference is front-only? "the back of the same outfit", or the
  user's words, which must NOT name a view. The builder could move words about the back into their own sentence
  ("Seen from behind, ...") instead of splicing them after the reference clause.
- Bench tools: `.agents/mpi-kanban/tasks/MPI-1041/research/bench-tools/phaseF/` (qf2j.py).
