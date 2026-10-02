# Outpaint (MPI-594, rebuilt MPI-900)

One image in, the same picture back inside a bigger frame. FLUX.2 Klein 9B fills whatever the
user added and hands back the WHOLE picture, repainted, at ~1 MP. The portable half — the gizmo — is
[../ui/crop-gizmo.md](../ui/crop-gizmo.md); this file is what is specific to THIS flow.

| | |
|---|---|
| id / op | `outpaint` / `flowOutpaint` |
| graph | `comfy_workflows/flow_outpaint.json` (raw: `raw/flow_outpaint.json`) |
| models | `[['klein-9b']]` — 9B baked, nothing injected. No cloud model: Klein 9B cloud ran here 2026-10-01 to 10-02 (MPI-918), removed by Fabio |
| deps | none (the Mickmumpitz paste-back left with MPI-1011) |
| steps | 01 Inputs · 02 Frame (`kind: 'crop'`) · 03 Generate |
| controls | one optional prompt, `Input_Positive` |

## The shape of it

**The app pads the picture; the graph does not.** The crop step composes source + TRANSPARENT
bars into a single PNG, places it in `Media/.preview-assets/`, and THAT file is what
`Input_Image` loads. So the graph carries no rect, no pad node and no fill input. The mechanism
is the step kind's (`STEP_MEDIA`), not this flow's — any flow declaring `kind: 'crop'` gets it.

**The bars are transparent, never painted (MPI-900).** A cleared canvas pixel exports as RGBA
0,0,0,0, so `MpiLoadImage`'s IMAGE (RGB) still shows Klein the black bars. Never detect the new
area by black pixels — a dark photo has black pixels of its own.

**Klein's picture is the result (MPI-1011, Fabio 2026-10-02).** Klein samples the padded image
at ~1 MP (`ImageScaleToTotalPixels`, the OOM guard: a 4K plate gets a result, not an OOM) and
its decode IS the output: the whole frame repainted, original included, slightly recoloured.
From 2026-09-24 (MPI-900) the graph pasted only the fill back over the untouched original
(ComposeColorMatch), bending it to meet the original first (Mickmumpitz `HarmonizeBoundary`),
so an extended video start/end frame kept its colours and the photo its size. The live look on
2026-10-02 still showed a line where the bottom edge cut a horse: a step of ~3 levels on
average, up to 9, over 30-65 px stretches, against ~0.4 anywhere else. The harmonizer matches
colour averaged over ~10 px blocks, never the edge row itself. A direct Klein edit has no join,
so Fabio chose it: smaller, recoloured, no seam. A user who needs the original exact uses
another technique. Later versions may bring the original back (measured options: a second
harmonize at a fine scale, or a feathered paste).

**Passes again (MPI-1011, Fabio 2026-10-02).** One pass (2026-09-24 to 10-02) failed on large
fills, so the crop step declares `maxGrow: OUTPAINT_MAX_GROW` (a third per side): each pass grows
a side by at most a third of what it already has and runs on the previous result
(`outpaintPasses.js`, `flowService` `runNextPass`, `MpiBaseFlow._planPasses`, the agent path in
`agentDispatch.js`). A 9:16 frame round a 16:9 photo is three passes. A failed fill is still
re-run by the user or agent, no automatic retry. Each result is ~1 MP, so `nextPassRect`
scales the next frame into that result's pixels.

**The next pass reads the finished ITEM's `filePath`.** Both twins hand `composeNextPass` the
completion's `item`, a gallery item with no `url`. Reading `url` returned null, so every
multi-pass fill stopped after pass 1 with "Generation failed." (Fabio's live run, 2026-10-02).
`tests/outpaint-next-pass.test.cjs` builds the item with `createImageItem`, as the app does.

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
`inject-params-titles.test.cjs` pins the join, the untitled bake, and that `Output_Image` reads
Klein's decode with no paste-back.

**No `result.compare`.** The output is a different SHAPE from the input, so a wipe between
them compares two framings rather than two versions of one picture.

## Why not Krea 2 any more

Outpaint ran on either Krea 2 card (any-of) until MPI-900, then briefly on Krea + Klein behind
a lazy `Klein Or Krea` switch. Fabio's call on 2026-09-24: Klein 9B only — faster and fails
less. The Krea arm, `Input_is_Turbo` and `Input_Use_Klein` are gone from the graph and pinned
absent by the test. AnyPaint was evaluated the same day and dropped.

## Still open

- **Keeping the original exact, with no seam.** Deferred to a later version (Fabio, 2026-10-02);
  see "Klein's picture is the result" above for what was measured.
