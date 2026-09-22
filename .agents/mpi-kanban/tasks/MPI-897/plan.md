# MPI-897 Plan - Localised editing

> **Umbrella created by `/mpi-project-refresh` on 2026-09-22 (MPI-893).** These cards were
> already on the board and stay there; this card is the shared context and the running
> order, not a replacement. Nothing here has been re-scoped - read each member's own card
> before touching its files.

## Members

| Card | Title | State |
|---|---|---|
| MPI-602 | LanPaint: real mask-conditioned inpainting across every supported model | `todo` / `planned` |
| MPI-355 | 4K/8K localized-edit Flow - mask a small region of a huge scene (crop-stitch wiring already shipped) | `todo` / `planned` |
| MPI-557 | Video face detailer | `todo` / `planned` |

## Why these belong together

The same capability at three scales: mask a region and have the model respect it.
MPI-602 is the model-level route (LanPaint, real mask-conditioned inpainting), MPI-355 is
the huge-canvas route (4K/8K, crop-stitch already shipped), MPI-557 is the video route.

They are one umbrella because MPI-602 decides the other two. If real mask conditioning
lands across the supported models, the 4K Flow is a crop-and-stitch wrapper around it and
the video detailer inherits it; if it does not, both need their own workaround, and that
is a different plan.

## Phases

1. **MPI-602 first, and it is a decision as much as an implementation.** Establish which
   supported models can take a real mask condition and which cannot. **Verify:** a per-model
   table backed by generated evidence, not by what the node documentation claims.
2. **MPI-355 and MPI-557 in parallel**, each written against whatever phase 1 concluded.

## Parallel Batch

Phase 2 only.

- **MPI-355** - the 4K/8K localised-edit Flow. Crop-stitch wiring already shipped; this is
  the Flow around it. Follows `docs/playbooks/add-flow/`, art included.
- **MPI-557** - video face detailer.

Both go through `MpiBaseFlow.js`, which is a known collision point - claim before the first
write and message the other before touching it.

## Traps already known

- **Any code that mutates `manualCanvas`/`subtractCanvas`/a paint layer MUST record an
  `UndoStack` entry first.** Unwired = a silent hole in Ctrl+Z. Read `docs/masking-undo.md`.
- The H3 `as sampled` mask floors at **32px in OUTPUT pixels** - a grow below it is a no-op.
- A localised VIDEO edit already hit a wall once: MPI-711 (`doing`) is the record of the
  LanPaint/H3 masked route failing. Read it before re-deriving that.
- A new destination is a ROW in a table, never a new engine (the MPI-424 thesis).
