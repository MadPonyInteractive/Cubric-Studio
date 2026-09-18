# MPI-808 — bench proof: the graph is innocent, the BOX is too big

Run on the authoring bench (8188, `G:\ComfyUi`), never the app's engine on 48188.
Real target image: `Documents/Cubric Vision/Projects/New Project/Media/imported_001.png`,
**1664x2304** — the exact file the 14:21 run used. Real box: `{x:-619, y:556, 1299x1299}`,
the exact values the sidecar recorded.

Graph = the TARGET leg of `comfy_workflows/flow_head_swap.json`, node-for-node:
`LoadImage -> MpiBox(90) -> MpiBoxMask(91) -> InpaintCropImproved(21)`, with
`MpiFromBox(285) -> MpiMath(286) "floor(a*0.12+0.5)" -> 21.mask_expand_pixels`.
Node 21's widget values copied verbatim (`context_from_mask_extend_factor 1.1`,
`output_resize_to_target_size true`, `output_target 1024x1024`, `mask_blend_pixels 32`).

Runner: `scratchpad/mpi808_bench.py` (A/B) and `scratchpad/mpi808_geom.py` (C/D/E).

| # | Box | Wiring / setting changed | Result |
|---|---|---|---|
| A | `x:-619, 1299²` | production (Box Size <- RAW box 90) | **whole frame, three faces — symptom reproduced** |
| B | `x:-619, 1299²` | Box Size <- MpiBoxMask CLAMPED box (91 out 1) | **still the whole frame** |
| C | `x:0, 1299²` (no overflow at all) | production | **still the whole frame** |
| D | `x:0, 680²` (head-sized) | production | **correct — a clean crop of the one head** |
| E | `x:-619, 1299²` | `output_resize_to_target_size: false` | raw context region = **768 x 1536** |

## What this kills

- **Negative x is not the bug.** Already established from the contract
  (`headSwapInjector.js` header, `overflow: 'allow'` on both steps,
  `docs/playbooks/add-flow/ui/box-gizmo.md`) and Fabio's own bench screenshot (`x=-130`
  crops correctly). A/C now show it empirically: the same box with and without overflow
  produces the same whole-frame crop.
- **The `Box Size` clamp is NOT the cause.** B changes `mask_expand_pixels` from
  `floor(1299*0.12+0.5)=156` to `floor(680*0.12+0.5)=82` and the crop barely moves.
  *(It is still a real defect — see below — just not this one.)*
- **The injector, the gizmo capture and the graph are all faithful.** The numbers the
  sidecar recorded are the numbers Fabio drew, and the graph does exactly what those
  numbers ask for.

## What it shows instead

The box is simply **too large for the image**. 1299 px on a 1664 px-wide frame is 78% of
the width. `mask_expand_pixels` (+156 each side) then `context_from_mask_extend_factor 1.1`
then the 1:1 output target push the context region past the frame edges. E measures the
pre-resize region at 768x1536; forcing that to the 1024x1024 target's 1:1 aspect widens it
to ~1536², i.e. 92% of the image width — the neighbouring faces.

D is the control: the same pipeline, same settings, a 680² box, and it returns exactly the
head crop the flow is supposed to produce.

## So why did a 1299² box get drawn?

Fabio's account (2026-09-18): he drew it large deliberately, to take in the target's hair,
with about half the box outside the image. The step declares `ratio: 1`
(`js/data/flowsRegistry.js:504`), so the box is locked square. Dragging the left edge past
the frame to catch hair that runs off-screen grows the square in **both** axes — the height
follows the width to 1299, reaching from y=556 to y=1855, far below the head.
`overflow: 'allow'` lets the ORIGIN go negative but does nothing to stop the square growing.

That is the MPI-324 failure mode the flow's own comment describes — "A head at the edge
otherwise forces the box to GROW until it swallows the neighbour" — surviving MPI-325.
The UI reported "1290 x 1290" with nothing to signal that this is most of the picture.

## Open decision (Fabio's, not the agent's)

Needs a product call before any code changes:

1. Drop `ratio: 1` on the image1 (mask) step so an edge-adjacent head can be framed with a
   tall or wide rectangle. `InpaintCropImproved` re-squares to its target anyway, so the
   square is not load-bearing here. `Mpi Box Crop` on image2 DOES need the aspect.
2. Keep the square but drive the mask from the clipped intersection, so the off-frame half
   never inflates the region.
3. Warn in the gizmo when the box exceeds some fraction of the image.

## Separate, real, still worth fixing

`Box Size` (node 285) reads the **raw** `MpiBox` (90), while `MpiBoxMask` (91) already
publishes a clamped box on its second output whose documented purpose is exactly this —
`img.py`: "Also outputs the clamped box, so downstream nodes see the region actually drawn."
That output is connected to nothing in both `comfy_workflows/flow_head_swap.json` and
Fabio's re-exported `comfy_workflows/raw/flow_head_swap.json`. So a box hanging off the
frame gets a margin computed from geometry that is not in the picture. Not this bug, but a
latent one; fold it into whichever fix lands.
