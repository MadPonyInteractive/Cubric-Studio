# Make seamless (MPI-1101)

One picture in, the same picture back with its edges joined so it repeats left-right, top-bottom or
both. Only a band along each seam is repainted (FLUX.2 Klein 9B, one ~1024 window at a time); every
pixel outside the bands is the source's own, byte for byte. The run lands as ONE card that heals
window by window. Shipped ungated 2026-10-14 (2.1).

| | |
|---|---|
| id / op | `make-seamless` / `flowMakeSeamless` |
| graph | `comfy_workflows/flow_make_seamless.json` (raw: `raw/flow_make_seamless.json`) |
| models | `klein-9b`, nothing injected but the window, its mask, a seed and the prompt |
| pixel service | `services/seamlessOps.js` behind `routes/seamless.js` (prepare / window / paste / finish) |
| planner | `js/utils/flowPasses.js` `registerPlanner('flowMakeSeamless', ...)` |
| steps | 01 Inputs (picture required) · 02 Edges (`kind: 'edges'`, `MpiStepEdges`) · 03 Generate |
| controls | `Input_Positive` (empty = described per window), Even out lighting (step 03), `direction` (agent only) |
| tests | `seamless-ops`, `seamless-landing`, `flow-make-seamless`, `step-edges`, `result-tiles`, `status-bar-hold`, `flow-rules-media` |

## The shape of it

**The app does the geometry; the graph only repaints one window.** `prepare` writes a lossless working
copy under `os.tmpdir()/cubric-seamless/<runId>/` (swept after 24 h) and plans the windows. Each pass:
`window` cuts window i + its mask, Klein repaints it, `paste` writes ONLY the band's part of the result
back (32 px inward feather), and the next pass cuts from the updated copy. `finish` copies the result out.

**Each window carries its own roll, the copy never rolls.** x-band windows sit in frame (w/2, 0),
y-band windows in (0, h/2), and a both-ways run adds ONE corner window in (w/2, h/2) where the four
copies meet (`planCorner`, mask faded to 0 at both ends of its run). Rolling the whole copy once made
each band one window whose two free ends were neighbouring rows of the picture's MIDDLE: a hard break
at h/2 and w/2 on every both-ways result. `framePieces` reads/writes a frame as up to 4 wrapped pieces.

**Window sizing.** Windows walk along the seam at ~1024 (`WINDOW_TARGET`), each cut with
`CONTEXT_PX` (256) of picture either side of the band and `OVERLAP_PX` (256) over the window before.
A cut's long edge is capped at `MAX_CUT` = 1024 x `MAX_SHRINK` (4): Klein samples at 1024, so a 16K
picture's windows are seen at 4x shrink. A band wider than one cut splits into columns CENTRED ON THE
SEAM, the outer ones re-reading `OVERLAP_PX` of the inner with the mask ramped across it.

**The mask is a ramp, read as per-pixel strength.** `rampMaskBuffer` rises from 0 at each band edge
to full at `RAMP_FRAC` (0.4) of the band; `windowMaskBuffer` also ramps along the seam through the
overlap, so two windows meet without a line. The graph runs LanPaint through `DifferentialDiffusion`,
so near the band's edges the picture keeps its own content. A hard band mask drew two straight lines
at the band edges (eye test 2026-10-12).

**No reference image, and a prompt per window.** Klein with a ReferenceLatent copies the band back,
seam included (bench round 5). Without any prompt it paints unrelated things into the band (round 4).
So: the user's words when given, else the describer is asked about EACH WINDOW's own crop
(`describe` entry `everyPass: true`, re-asked by flowService each pass). One whole-picture line made
Klein paint the whole scene into a window that shows only floor.

**One card, a counted status bar.** Each pass's output is pasted, not landed as a new version
(`pastesToWorkingCopy` in `commandRegistry.js`). The status bar shows `i/N`, and `tool:hold` keeps it
sweeping between passes instead of falling to IDLE while the next window is cut.

## Scope, said out loud

Only the band changes, so one big shape crossing an edge (a marble vein) or light falling off to one
side still repeats when tiled. It does not make game textures (that is MPI-1128, from scratch). The
FlowDef description and `docs/agent/flows.md` both say so; keep them in step.

## Testing it

- **Use a picture whose ends are a fair case.** A real 360 has ends that almost meet; our own 360 Pano
  Flow's RAW output (before its seam pass) is the honest test. A panorama with a slice cut out shows
  two different views at its ends and can never join: 2026-10-14 lost a day of benches to one (the
  Poly Haven greenhouse cut from 8192 to 7192 wide before enlarging).
- **Always eye-check at 1:1, right end placed against left end.** `seamlessOps.seamScore` (step across
  the seam over the median step beside it; healed < ~15) is blind to a scene Klein invented, and drops
  when texture sharpens beside a line that is still there.
- 16K: our village 360 enlarged 8x heals clean (wrap step ~1 per block). A 1K texture stretched 16x
  keeps a faint line in places: known edge case, not chased.

## Dead ends (do not retry)

- A wider paste feather ghosts; pasting several bands at once leaves haze.
- Klein's shrink capped at 2x at 16K (19 windows): worse. A 2048 cut shows only floor or sky, and
  Klein paints whole new scenes into it.
- Tile detailing (Impact MakeTileSEGS + DetailerForEachPipe, no prompt, any denoise), alone or after
  LanPaint: sharpens beside the cut, keeps it; 6-10 min a window.
- Filling the band core before sampling: a blur comes back as a soft blob (cloth, a pillar); a mirrored
  crossfade still gets a line where the two sides switch; plain image-to-image at 0.6/0.8 keeps it.
  Klein follows the core's layout, not its edge pixels. (All judged on the broken greenhouse, but the
  blob and crossfade findings stand on their own.)
- A baked masked-branch denoise from the model's own t2i graph never reached the sampler: the masked
  branch runs LanPaint at a FIXED denoise 1.0. Build from the Character Sheet Editor's Klein branch.

Full record: `.agents/mpi-kanban/tasks/MPI-1101/` (`research/brainstorm.md`, `validation.md`).
