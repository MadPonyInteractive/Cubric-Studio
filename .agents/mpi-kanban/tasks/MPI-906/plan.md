# MPI-906 Plan - Mascots on the waiting spots

Under umbrella MPI-846. Spot rules and clip per spot: `docs/mascot-placement.md` § Spot map.
Clips are staged at `assets/mascot/{key}/{state}.webm`. Every clip swap goes through
`js/shell/heroCrew.js` `handOverClip` on two stacked `<video>`s (the flicker fix), flipped
on the next clip's first presented frame.

## Current State

Phase 1 DONE - Fabio verified live 2026-09-25, size accepted as is. The card's `<img>` + idle/greet flip
timer is gone: a `span.mpi-group-card__mascot` (grid, geometry + float) holds two stacked
looping `<video>`s, `_paintMascot` swaps them via `handOverClip`, `_releaseMascot` frees both
on done/refresh/destroy. Spec: `tests/desktop/gallery-generating-mascot.spec.js`.
Gotcha: the clips' figure fills ~60% of the 620px frame (the old PNG ~88%), so at the same
46% / 22% card width the mascot reads ~1/3 smaller - resize if Fabio says so.
2026-09-25 (667f09c0, umbrella MPI-932): Phases 3-5 BUILT, spec + related specs green; waiting on
Fabio's live check. Old: PARKED 2026-09-25: Fabio moved to MPI-908 (agent fail, empty states) and MPI-907 (toasts)
first; Phases 3-5 wait. Phase 2 dropped. `docs/mascot-placement.md` spot-map
row for the generating card still says "Code today" - update at close-out.

## Phases

### Phase 1: Generating card

`js/components/Compounds/MpiGalleryGrid/MpiGalleryGrid.js` (~1650-1760) + `.css` (~300-355).
The `<img>` with its idle/greet flip timer becomes two stacked looping videos. Big and
centred before latents = `{key}/getting-ready`; small bottom-right once previews stream =
`{key}/working`. Key = `getCommandAccent(history[0].operation)`, else the group's media
type (image -> vision), because flow and agent placeholders carry no history. An import
card keeps the spinner (MPI-671). `setDone` / `refreshGroup` / `destroy` release both decoders.

Ownership: `js/components/Compounds/MpiGalleryGrid/MpiGalleryGrid.js`, `js/components/Compounds/MpiGalleryGrid/MpiGalleryGrid.css`

### ~~Phase 2: Float latent window~~ - DROPPED by Fabio 2026-09-25 ("can be left alone")

`main/float-latent.html` ~166-171, `js/shell/floatLatentBridge.js`. Per lane: getting-ready,
then working (rule 5).

### Phase 3: Model Library queued install

`MpiTileSheet.js:172`, `MpiModelManager.js` (waiting PNG) -> the model's op `working` loop.

### Phase 4: History peek

`MpiGroupHistoryBlock.js:459,746` (waiting PNG) -> op's `working` loop.

### Phase 5: Starting-engine screen

`MpiStartingComfy.js:24` (idle PNG) -> `studio/engine-starting` looping (never shown yet).

## Verification

**Verify mode:** user-ux

Per phase: `npm run app:isolated`, trigger the spot, watch the clip and the swap (no blink,
no mascot left behind after the job ends). Desktop gallery specs stay green.

## Completed

- Phase 1 generating card (2026-09-25, Fabio verified).

## Remaining Work

Phases 3-5 (parked behind MPI-908 / MPI-907).

## Plan Drift

- 2026-09-25: Phase 2 (float latent window) dropped by Fabio; the card is parked while
  MPI-908 and MPI-907 go first.
