# Outpaint (MPI-594, rebuilt MPI-900)

One image in, the same picture back inside a bigger frame. FLUX.2 Klein 9B fills whatever the
user added, and the original pixels come back untouched. The portable half — the gizmo — is
[../ui/crop-gizmo.md](../ui/crop-gizmo.md); this file is what is specific to THIS flow.

| | |
|---|---|
| id / op | `outpaint` / `flowOutpaint` |
| graph | `comfy_workflows/flow_outpaint.json` (raw: `raw/flow_outpaint.json`) |
| models | `[['klein-9b']]` — baked, nothing injected |
| deps | `ComfyUI-Mickmumpitz-Nodes` (ComposeColorMatch) |
| steps | 01 Inputs · 02 Frame (`kind: 'crop'`) · 03 Generate |
| controls | one optional prompt, `Input_Positive` |

## The shape of it

**The app pads the picture; the graph does not.** The crop step composes source + TRANSPARENT
bars into a single PNG, places it in `Media/.preview-assets/`, and THAT file is what
`Input_Image` loads. So the graph carries no rect, no pad node and no fill input. The mechanism
is the step kind's (`STEP_MEDIA`), not this flow's — any flow declaring `kind: 'crop'` gets it.

**The bars are transparent, never painted (MPI-900).** A cleared canvas pixel exports as RGBA
0,0,0,0, so `MpiLoadImage`'s IMAGE (RGB) still shows Klein the black bars, and its MASK output
(channel `alpha`, inverted like LoadImage) is exactly the new area. Never detect the new area
by black pixels — a dark photo has black pixels of its own.

**Klein repaints the whole frame, so the fill is pasted back.** Klein samples the padded image
at ~1 MP (`ImageScaleToTotalPixels`, the OOM guard: a 4K plate gets a result, not an OOM) and
its decode shifts the colour of EVERYTHING, original included. `Match Fill To Original Edge`
(Mickmumpitz `HarmonizeBoundary`) takes `original − klein` on the original's side and solves a
smooth harmonic field from it into the new area, so the fill meets the original EXACTLY at the
border and its own texture is untouched. `Paste Fill Over Original` (ComposeColorMatch,
correction `Off`) then resizes that fill to the frame and composites it over the untouched
original. The output is therefore the FRAME at source resolution, and the original pixels are
byte-for-byte the user's.

**Why not the grade match alone.** The first live run used ComposeColorMatch's `Grade match
(surround)` — one per-channel affine over the whole original — and left a straight tone line
at the border (2026-09-24: -1 to +8 RGB along the seam, varying across the width, where the
wall had a vignette Klein flattened). The drift is LOCAL, so no single affine removes it, and
feathering the mask is out: the fill side of the composite is transparent black and the other
side is the original, which may not change. Proven offline on that output before wiring: step
≤0.5 RGB, original byte-identical, solve ~1 s at 4000 iterations. A faint line can remain when
the source image's own edge row differs from the next (t2i generators often leave one) — that
row is the user's pixels, not the seam. That is the product requirement: an extended
video start/end frame may not change colour where it was not extended.

**One pass (Fabio, 2026-09-24).** Klein filled half the height in one pass; a failed fill is
re-run by the user or agent, no automatic retry. The step declares no `maxGrow`, so
`planOutpaintPasses` never splits. The pass machinery (`outpaintPasses.js`, `flowService`
`runNextPass`, `MpiBaseFlow._planPasses`, the agent path in `agentDispatch.js`) is idle, not
deleted — it went in with 9c8c5841 and removing it touches MPI-891's file.

## The prompt is joined after a bake

The instruction is baked in an UNTITLED node: *"Replace the black area with the rest of the
image."* (Fabio's tested wording). `Input_Positive` is a SEPARATE node, joined after it by
`Join Prompt` (delimiter a space), then `Trim Empty Prompt` strips trailing whitespace — so an
empty prompt leaves the bake exactly as written.

**The baked node is NOT titled `Input_Positive`.** `_buildParams` emits
`Input_Positive: positive || ''` on **every** run, so a titled bake gets an empty string
written over it. Caught in the first live run (MPI-594). **Do not "fix" this by making the app
skip an empty prompt** — nearly every graph in `comfy_workflows/` carries a leftover authoring
prompt, and the always-injected empty string is what stops those from running.
`inject-params-titles.test.cjs` pins the join, the untitled bake and the paste-back wiring.

**No `result.compare`.** The output is a different SHAPE from the input, so a wipe between
them compares two framings rather than two versions of one picture.

## Why not Krea 2 any more

Outpaint ran on either Krea 2 card (any-of) until MPI-900, then briefly on Krea + Klein behind
a lazy `Klein Or Krea` switch. Fabio's call on 2026-09-24: Klein 9B only — faster and fails
less. The Krea arm, `Input_is_Turbo` and `Input_Use_Klein` are gone from the graph and pinned
absent by the test. AnyPaint was evaluated the same day and dropped.

## Still open

- **Output size.** The paste-back returns the frame at SOURCE resolution; before MPI-900 it was
  ~1 MP (Fabio, 2026-08-21). Awaiting Fabio's call. (The live run on 2026-09-24 confirmed no
  seam and a byte-identical original.)
