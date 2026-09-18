# MPI-808 Validation

## Investigation — the card's two premises were both false (2026-09-18)

Full bench evidence and the run table: `research/bench-proof-2026-09-18.md`.

- **Negative x is by design**, not a defect: `headSwapInjector.js` header ("MAY BE NEGATIVE
  (MPI-325)", and its clamp was deliberately removed), `overflow: 'allow'` on both steps, and
  `docs/playbooks/add-flow/ui/box-gizmo.md` recording it verified end to end on 2026-08-17.
  Fabio's own bench screenshot cropped correctly at `x=-130`.
- **The box size was not mis-captured** either: Fabio confirmed he drew it large on purpose, to
  take in the target's hair, with about half outside the frame. The sidecar numbers are his.
- So the injector, the gizmo capture and the graph are all faithful; the bug was upstream of
  all three, in what the square lock made him draw.

## Root cause, proved on the bench (8188, never the app's 48188)

Real plate `Media/imported_001.png` (1664x2304) and the real box `{x:-619, y:556, 1299x1299}`,
through node 21's verbatim settings. Runners: `scratchpad/mpi808_bench.py`, `mpi808_geom.py`.

| # | Box | Change | Result |
|---|---|---|---|
| A | `x:-619, 1299²` | production wiring | whole frame, three faces — **symptom reproduced** |
| B | `x:-619, 1299²` | Box Size <- clamped box (the first hypothesis) | still the whole frame — **hypothesis falsified** |
| C | `x:0, 1299²`, no overflow | production | still the whole frame — **overflow is irrelevant** |
| D | `x:0, 680²` | production | correct: one clean head crop |
| E | `x:-619, 1299²` | `output_resize_to_target_size: false` | raw context region 768x1536 |

C is decisive: remove the overflow entirely and it still swallows the picture. The driver is
SIZE. 1299 px is 78% of a 1664 px-wide plate; `mask_expand_pixels` then
`context_from_mask_extend_factor 1.1` then the 1:1 output target widen E's 768x1536 region to
about 1536², i.e. the neighbours.

The box got that big because the step locked `ratio: 1`. Dragging the left edge off-frame to
catch hair grew the square in BOTH axes, so the height followed the width to 1299 (y 556 ->
1855, far below the head). `overflow: 'allow'` frees the origin; it does not stop the square
growing — the MPI-324 failure surviving MPI-325.

## Fix (Fabio's call, 2026-09-18) — drop `ratio: 1` on the image1 step

`js/data/flowsRegistry.js`: the image1 (mask) step no longer declares `ratio`. image2 KEEPS it —
Mpi Box Crop hands the encoder exactly what is boxed, so a non-square selection arrives
stretched, and growth is harmless on a reference portrait with no neighbour to swallow.

Safe because the ratio is a UI lock only (`MpiStepBox` applies it under `step.ratio != null`,
and its own comment says "the graph's width/height are independent"), Mpi Box Mask is
full-frame and clips, and Inpaint Crop expands a non-square region out to its target aspect
rather than clipping it.

- **F — the verification run** (`scratchpad/mpi808_verify.py`): box `{x:-260, y:470, 680x820}`,
  a rectangle still hanging off the left edge — the shape the square lock made impossible.
  Same plate, same node-21 settings, production wiring. Result: the crop is the TARGET head
  with its hair, not the frame. Compare A/B/C, which were all three faces.
- `npm run lint` → exit 0.
- `npx node --test tests/connector-agent-tools.test.cjs tests/agent-loop.test.cjs
  tests/declared-fields.test.cjs` → 62 tests, 61 pass, 0 fail, 1 skipped. The connector's
  "reject width !== height" validator is data-driven off each step's own `ratio`, so dropping
  it from the real flow widens what an agent may dispatch on box1 and breaks no fixture.
- `npm test` → **1352 tests, 1351 pass, 0 fail, 1 skipped**.

## Still open

- Fabio's own run in the app: box a head that runs off the frame edge and confirm the crop.
  Only he can do this one — no sandbox reproduces his gizmo interaction.
- `docs/playbooks/add-flow/ui/box-gizmo.md` line 85 still reasons that overflow is "safe on
  this slot ... Inpaint Crop re-squares the region itself". C disproves that as a safety
  argument. Doc edit PROPOSED, not made — awaiting approval.
- `comfy_workflows/raw/flow_head_swap.json` is Fabio's uncommitted re-export (RemoveBackground
  after the reference pickup) and still owes its raw->API sync. Untouched by this fix, which is
  app-side only.
- Latent, separate: `Box Size` (node 285) reads the RAW MpiBox while `Mpi Box Mask` already
  publishes a clamped box on its second output ("so downstream nodes see the region actually
  drawn") that is wired to nothing in both graphs. Not this bug — B proved that — but a real
  defect to fold into whichever graph change lands next.
