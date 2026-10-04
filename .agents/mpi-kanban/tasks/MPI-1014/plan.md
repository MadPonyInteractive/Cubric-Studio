# MPI-1014 — Flows on big photos

Fabio 2026-10-04 (pre-cut smoke): a 32K photo shows a broken chip in a Flow's Inputs slot, a
16K paints in step by step, Draw It In's paint step is unusable on a 16K. "Implement if easy,
else gate with a warning." Umbrella: MPI-595 (2.0 breaker).

## Why

MPI-961 gave the History canvas and the Prompt preview a server **display copy**
(`js/utils/displayImage.js` `resolveDisplayImage` -> `GET /display-image`): past the cap they
draw a smaller copy while every coordinate stays in the ORIGINAL's px. MPI-971 sized what the
engine gets. The Flow image loader and the Flow step screens got neither: each loads the full
original into an `<img>` and redraws it per frame, and each Run-time `compose*` builds a
source-size canvas in the renderer (a 32K cannot decode at all; a 16K is ~700 MB per canvas).

## Phases

1. **Display** — every Flow screen draws the display copy: `MpiMediaPicker` chip/preview,
   `MpiStepBox`, `MpiStepPreview`, `MpiStepCrop`, `MpiStepPaint`, `MpiStepCutout`, `MpiStepPlace`.
   Natural size = the copy's reported ORIGINAL size, so box/crop/paint coordinates are unchanged.
   Server: `/display-image` also copies a file no sidecar owns (Flow `.preview-assets`) into the
   temp cache, as the engine copy already does, instead of serving the original.
2. **Exports** — no `compose*` builds a source-size canvas past the cap:
   - `composePaintLayer` (Draw It In): hand over the working-size layer; `/engine-box` already
     maps a layer onto the photo by ratio.
   - `composePaintComposite` (Scribble): load the <=4096 copy, not the original.
   - `composePaddedImage` (Outpaint), `composeCutObject`, `composePlacedObject` (Object Stamp):
     fix where the engine only ever gets <=4096 anyway; otherwise a clear `userMessage` refusal
     with the size, never a broken result.
3. **Docs + tests** — `docs/big-photos.md` § Flow screens; a desktop spec with a forced small
   `setDisplayMaxEdge` (the MPI-961 trick) so a fixture exercises the copy; unit tests for the
   export caps.

## Verification

**Verify mode:** user-ux

- `npm test` green; the new spec RED on HEAD, green after.
- Isolated app (`npm run app:isolated`): a 16K and a 32K photo through Draw It In, Scribble,
  Outpaint, Object Stamp: chip shows, steps usable, Run lands a card.
- Fabio's look on his own 16K/32K photos.

## Current State

2026-10-04: Phases 1-3 built + self-verified (validation.md). Outpaint lost its 16384 refusal
(frame capped at 4096, the graph scales to 1 MP). Next: Fabio's look on his own 16K/32K photos in
Draw It In, Scribble, Outpaint, Object Stamp; a GPU run only on his yes.

## Completed

## Plan Drift

- 2026-10-04: MpiMediaPicker's grid already used thumbs; the broken chip was MpiBaseFlow's Inputs
  slot. Added: the Flow result pane (a stitched 16K result) and the picker's enlarge preview.
  `outpaintRefusal` removed, not kept.
