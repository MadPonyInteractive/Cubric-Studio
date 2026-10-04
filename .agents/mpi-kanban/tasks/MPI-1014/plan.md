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
4. **A new image in a slot resets the steps that read it** (found in Fabio's look, 2026-10-04;
   PRE-EXISTING, not caused by phases 1-3). Object Stamp re-opened after a run, a NEW object
   loaded: step 2 (Cutout) showed the OLD erase mask, and Remove background showed the OLD cut;
   after back/forward, Remove background ran on the new object but kept the old mask (squirrel
   body erased, only its tail left). Root cause, `MpiBaseFlow.js`: the slot's X button drops the
   drawing bound to that role and keeps its declared `fields` (~line 839, MPI-620), but the two
   SWAP paths never do — the picker's `onPick` (~line 931) and `_handleFiles` (upload / drop,
   ~line 1046) just overwrite `entry.items[idx]`, so `_stepValues[role]` (masks, `bgUrl`,
   `removeBg`, paint layer, box, crop, placement) survives onto the new picture. Fix at the
   root: ONE helper run by all three paths when a role's media actually changes, dropping the
   step state of steps ON that role AND of steps whose `sourceRole` is it (Place: `sourceValue`
   is the cut, and a seeded `place.halfW` keeps the OLD object's aspect — `_initObject` only
   re-derives it when unseeded). Keep `fields`. Check every image Flow (Draw It In paint layer +
   box, Scribble, Outpaint crop, Object Stamp cutout + place) and Head Swap's box. Test: a desktop
   spec that swaps a slot's image and asserts the step mounts clean; RED first.
   **Fabio 2026-10-04: "If I press reset, it's fixed, so perhaps just triggering reset when the
   user loads in a new object should be enough."** That is this fix: the frame-level drop IS a
   Reset of every step bound to the swapped image, done once for all step kinds instead of per
   gizmo. Only when the image actually CHANGED (same URL re-picked keeps the drawing).

## Verification

**Verify mode:** user-ux

- `npm test` green; the new spec RED on HEAD, green after.
- Isolated app (`npm run app:isolated`): a 16K and a 32K photo through Draw It In, Scribble,
  Outpaint, Object Stamp: chip shows, steps usable, Run lands a card.
- Fabio's look on his own 16K/32K photos.

## Current State

2026-10-04: Phases 1-3 built, self-verified, pushed `3ed4ae7cd` (validation.md). Outpaint lost
its 16384 refusal (frame capped at 4096, the graph scales to 1 MP). Phase 4 built: `_setSlot` in
`MpiBaseFlow.js` is the one slot write (X, pick, upload/drop) and resets the steps bound to a
changed picture; `flow-swap-resets-steps.spec.js` RED on HEAD, green after. His look then found
the cutout brush capped tiny on a 16K: `brushScale` (`brushDab.js`) now scales the Cutout and
Paint brush default, cap and step by the long edge. **Next: Fabio's look**
on Draw It In, Scribble, Outpaint, Object Stamp with his own 16K/32K photos (app restart first),
and CI green on the push. A GPU run only on his yes.

## Completed

## Plan Drift

- 2026-10-04: MpiMediaPicker's grid already used thumbs; the broken chip was MpiBaseFlow's Inputs
  slot. Added: the Flow result pane (a stitched 16K result) and the picker's enlarge preview.
  `outpaintRefusal` removed, not kept.
