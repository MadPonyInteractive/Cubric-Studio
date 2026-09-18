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

## Part 1 was necessary but NOT sufficient (Fabio, in his app, 2026-09-18)

With `ratio` gone he drew a proper rectangle - 676 x 1342 around the left-hand girl - and the
latent was STILL all three faces. Dropping the square lock let him draw the right box; it did
not stop the crop widening.

The remaining driver was node 21's baked `output_target 1024x1024`. `output_resize_to_target_size`
forces the CONTEXT region to the output's aspect, so a 1:2 box was widened to 1:1 - about 1650 px
on a 1664 px plate. Measured unforced, the region is 768x1536, i.e. its own aspect is 1:2 and the
1:1 target is what wrecked it.

Turning `output_resize_to_target_size` off was tempting (one widget) and was REJECTED by a range
test: the sampler's budget then swings 36x, 0.09 MP on a 200x260 box to 3.24 MP on a 1200x2000
one. The fixed target was doing a real job - guaranteeing a constant budget. Only its 1:1 shape
was wrong.

## Fix, part 2 - the graph (2026-09-18)

`comfy_workflows/raw/flow_head_swap.json`, synced to the runtime twin:

1. `Box Size` (285) reads `MpiBoxMask`'s CLAMPED box (91 out 1), not the raw `MpiBox` (90 out 0).
   That second output existed for exactly this ("so downstream nodes see the region actually
   drawn") and was wired to nothing. For an off-frame box the target aspect must follow the
   region really in the picture.
2. Two new `MpiMath` nodes (300/301) derive `output_target_width`/`height` from that box's
   aspect at a constant ~1 MP, snapped to /64, replacing the baked 1024x1024:
   `floor(a * sqrt(1048576 / ((a*b) if a*b > 0 else 1)) / 64 + 0.5) * 64 if a*b > 0 else 1024`
   (`safe_math` exposes every `math.*` function, so `sqrt`/`floor` are legal; the guard covers a
   zero-area clamp, and `and` is NOT available - safe_math has no BoolOp).
3. `context_from_mask_extend_factor` 1.1 -> 1.0 (Fabio's call). Budget stays ~1 MP (his call too).

Widget indices were read off a live 48188 `/object_info`, not guessed: `widgets_values[i]` is
`required[i+1]` because `image` is a link input, so 18 = context factor and 20/21 = the targets.
That also explains the stray `0` at index 9 - it is `mask_expand_pixels`, already widget-to-input
converted.

### Verification of the SHIPPED graph

`scratchpad/mpi808_shipped.py` lifts nodes 90/91/285/286/300/301/21 straight out of the synced
`comfy_workflows/flow_head_swap.json` - every expression, link and widget as it ships - and
substitutes only the plate and the box.

| box | crop | MP | aspect |
|---|---|---|---|
| 676x1342 (Fabio's) | 704x1472 | 1.04 | 1:2.09 |
| 676x1342 at x=-300 | 512x1920 | 0.98 | 1:3.75 |
| 200x260 | 896x1152 | 1.03 | 1:1.29 |
| 1200x2000 | 768x1344 | 1.03 | 1:1.75 |

Budget holds ~1 MP throughout; the aspect now follows the box. The x=-300 row is where change 1
earns its keep - the target follows the visible region, not the drawn one. The saved crop for
Fabio's box is the left-hand girl alone, which A/B/C all failed to produce.

- `COMFY_URL=http://127.0.0.1:48188 node scripts/sync-raw-workflows.mjs` -> OK, injection rules
  pass, raw committed as `a796f364`, runtime staged. Converted against the ENGINE, not the bench,
  per docs/workflow-authoring/converters.md.
- Raw diff audited semantically, not by line count (which fell ~1000 purely on reformat):
  +2 nodes, +6 links, 4 nodes changed (21/90/91/285), nothing lost.
- `npm run lint` exit 0. `npm test` 1352 tests, 1351 pass, 0 fail, 1 skipped.

## Still open

- Fabio's own run in the app: box a head that runs off the frame edge and confirm the crop.
  Only he can do this one - no sandbox reproduces his gizmo interaction. ComfyUI does NOT need
  restarting for the graph change (the app re-reads the workflow per dispatch), but the renderer
  does need a reload for the `ratio` change, which he has already done.
- `docs/playbooks/add-flow/ui/box-gizmo.md` line 85 still reasons that overflow is "safe on this
  slot ... Inpaint Crop re-squares the region itself". Run C disproves that as a safety argument,
  and the re-squaring is now driven by the box aspect rather than a baked 1:1. The consumer table
  on that page also predates `Box Size` reading the clamped output. Doc edit PROPOSED, not made -
  awaiting approval, per the never-edit-rules-unasked rule.
- The step-2 comment in `js/data/flowsRegistry.js` says a non-square image2 selection "arrives
  stretched". That is reasoning from `Mpi Box Crop`'s behaviour, not something this card measured
  - image2 keeps `ratio: 1` so nothing changed there, but it is worth a bench check before anyone
  relies on it.

## Closed during this card

- The raw->API sync Fabio's re-export owed (RemoveBackground after the reference pickup) was
  discharged by the same `sync-raw-workflows.mjs` run that baked this fix - raw commit
  `a796f364` carries both his reorder and the new nodes.
- The latent `Box Size` defect (node 285 reading the RAW `MpiBox` while `MpiBoxMask` published a
  clamped box wired to nothing) is FIXED. It was correctly ruled out as the cause of this bug by
  run B, then turned out to be load-bearing for the fix: without it an off-frame box would size
  its crop target from geometry that is not in the picture.
