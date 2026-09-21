# MPI-864 — validation

**Verify mode:** `user-ux` (inherited from the MPI-849 plan).

## What shipped

Fifteen cloud ModelDefs now carry the `image:` / `video:` their tile reads — the fourteen
Fabio listed, minus Gemini 3 Pro Image which he dropped mid-card, plus `flux-schnell-cloud`,
which is not one of his but would otherwise have been the one placeholder left on the grid.

| Source | Models |
|---|---|
| DeepInfra cover, centre-cropped 768x768 → 614x768 | Seedream 4, FLUX 2 Dev/Pro/Max, Nano Banana 2 Lite, FLUX Schnell |
| DeepInfra cover, **outpainted** to 768x960 (Krea 2, turbo on) | Seedream 4.5, Seedream 5.0 Pro, Nano Banana Pro |
| **Generated** on the model itself, 4:5 | Nano Banana 2 |
| Fabio's own downloads, transcoded | Seedance 1.5 Pro, Seedance 2.0, Wan 3.0, Veo 3.1 |
| DeepInfra `sample_output.mp4`, transcoded | Veo 3.1 Fast |

Clips: h264, 854x480, muted, 8–10s, 0.5–1.3MB, each with a `480x270` poster `.webp` cut from
its own first frame — the filename convention `MpiTileSheet.js` posters by, and which every
local video model already ships.

## Checks run

- `npm test` — **1707 tests, 1705 pass, 0 fail, 1 todo.** The todo is MPI-867's declared
  one (`agent-video-attachment.test.cjs`, the UI gate MPI-797 Phase 3 removed), red on
  purpose and not this card's.
- `tests/deepinfra-catalogue.test.cjs` — 21/21, including two new guards:
  - every cloud model has the art key its `mediaType` reads, and the file exists;
  - a video model also ships its poster `.webp`, because a missing poster is a silent no-op.
  - Both were proved **red first**: the art guard failed naming `seedream-45-cloud.webp`
    while the outpaints were still running, and passed once they landed.
- Gemini removal swept: `deepinfra-pricing`, `model-picker-cloud`, `paid-models-section`,
  `cloud-executor` — 71/71.

## Still owed — Fabio's eyes, in the app

The art is proved on disk and in a contact sheet he approved ("they look good"), but not yet
in the surfaces that draw it:

1. **Model Library**, DeepInfra section — fifteen tiles, no placeholder left.
2. **Model picker** — the same art in the tile sheet, and the subtitle now reading
   `15 cloud`, not 16, after the Gemini removal.
3. **A video tile on hover** — the clip plays, and the poster frame is what shows before it
   does.

## Cost

$0.3426 across three DeepInfra generations (sidecar `generationSettings.cost.usd`, the true
billed figure): $0.137566 + $0.067229 for the two keepers, plus $0.137770 for a first Gemini
attempt that framed the sign so the `3` fell off the edge. **$0.275 of that is now sunk** —
both Gemini images belong to a tile Fabio removed an hour later. The outpaints were free:
local Krea 2.

No video generations were bought. Fabio: *"Do not spend $7."*

## Two findings, carded

- [[MPI-873]] — an agent submit cannot name its project, it inherits whatever is open. Five
  of these outpaints landed in `Cubric Studio Mascots` because the app moved between the
  `open-project` call and the submits. Fabio moved them by hand.
- [[MPI-874]] — `cardName` is silently ignored on a Flow submit, though it works on a model
  op and the skill documents both.

## One measurement worth keeping

**Turbo off cost 5.3x, for no visible gain.** The gallery's own durations, same flow, same
input, same 912x1152 out: `flowOutpaint_001` 6m 35s and `_002` 6m 27s with turbo off,
against `_003` 1m 14s, `_004` 1m 14s and `_005` 1m 12s with it on. The flow's own field
comment says "Off for a keeper", which is true of a final render and wrong for a 768px tile
— Fabio caught it mid-run.

## Fabio's look - 2026-09-21, PASSED

Asked for and given in the app, on the three things only his eyes could settle: the Model
Library's DeepInfra section, the picker subtitle now reading `15 cloud`, and a video tile on
hover.

> *"I checked the app. It looks good. Cards and videos are displayed properly."*

That closes the card. Verify mode was `user-ux`, and the user has verified.
