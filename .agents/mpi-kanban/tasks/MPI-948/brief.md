# MPI-948 - A dragged gallery selection reaches the agent as ONE set chip

**UMBRELLA: MPI-941, Phase 2 (folded in 2026-09-27, Fabio).** The shape, footprint and
verification live in `tasks/MPI-941/plan.md` § Phase 2. This brief keeps the why.

## Why

Fabio, 2026-09-27, first after testing MPI-945's selection bar. Then he watched the photographer
tester use the app alone: the tester's instinct was to select several cards and DRAG them onto
the agent box. Today a plain drag carries only the card under the pointer
(`MpiGalleryGrid.js` dragstart), so the user believes the agent got every card and it got one.

## Decided (2026-09-27)

- **The gesture is the drag, not a button.** A drag that starts on a selected card carries the
  whole selection, in click order (`docs/gallery-selection.md`). The selection-bar "Send to
  agent" button originally asked for here is skipped unless testers miss the drag.
- **ONE chip in the composer**: a layers icon and "N cards", not N thumbnails.
- **What reaches the agent: references, never pixels, and ONE set handle.** The loop registers
  every card and writes one attachment line naming `set:<id>`, and `generate` `cards:
  ["set:<id>"]` expands it. 350 cards cost one line in and one short ref out. It then runs as
  MPI-941 Phase 1's one-job batch.
- **Not the agent reading the selection by itself**: a selection clears on the next click, and
  "these" would be ambiguous. `visible_cards` stays the way to reach a FILTERED set. A dropped set
  is a hand-picked one.

## Open, settle while building

- Removing the chip before sending: yes, like any chip. Opening it to list its cards: only if
  asked for.
- A set chip and ordinary attachment chips in one message share one numbering sequence.
