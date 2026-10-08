# MPI-1042 - Character Sheet from images - plan

Design is settled in `brief.md`. This plan is the order of work only.

## Current State

**2026-10-08, Fabio's decision: FORCE a three-quarter close-up, even from a frontal picture.** A
frontal close-up makes the video model hallucinate the 3/4 view, so shots stop matching. Today
the T6 portrait pass COPIES the picture's turn (frontal in, frontal out) because asking Klein for
a new pose redrew the face (run 2; A1). **Next action: bench frontal -> 3/4** on the front 4:5
crop, pass 1 prompt asking for the head turned three-quarters, 3+ seeds under `gpu_lease.py`;
judge likeness by eye against the picture (piercings, neck tattoo, face shape) and keep the
stretch check on the parts that do not turn. Fabio is also wiring Qwen-Image 2.1 in a separate
session as a possible better engine for this - check its card before deep-tuning Klein.

2026-10-08 afternoon (agent, ~50 autonomous bench runs, validation.md batches 1-8): **both issues
have one fix - sample the portrait on its OWN 896x1120 canvas, then the body views on their own
896x1120 with the finished portrait as a second reference, and stitch** (T6 in validation.md).
Portrait stretch 0.98-1.01 (was 0.92-0.96), turn + expression held 6 of 6 on the 3/4 picture
(was 1 of 3), two body views 12 of 12, same total pixels so ~same time (~50 s warm). The 4:5 crop
alone fixed neither; naming the turn, re-wording the portrait sentence, and every one-canvas
inpaint order failed (validation.md). The faint background step at the join (~1 in 3 seeds,
<= 14/255) is NOT an issue (Fabio, 2026-10-08): no gutter, no levelling node.
`research/bench-tools/two_pass.py <api.json> <out.json>` builds the tested graph (pass 1 prompts +
896x1120 baked); `sweep.py` posts it with image + seed. **Next: Fabio's eye on the T6 sheets;
then the bench graph v2 (two samplings) for his node graph; then body mode** - its
pass 2 takes the headless body as a third reference, and the portrait (Picture 1 only) will show
Picture 1's clothes at the shoulders: check that.

2026-10-08 (lunch handoff): Fabio has run the bench 6 times (no-body mode only) and handed TWO
issues over for autonomous testing while he is out. **He authorized bench runs on his `:8188`
(G:/ComfyUi) for these tests**, each batch under `gpu_lease.py run`, one line said before the
first run. He will bring more reference pictures once these are fixed.

**Issue A - the portrait always faces the camera**, even from a three-quarter picture (4 of
the 6 runs, all on `16eeba8c...jpg`, a smiling torso shot). Ideas to test, in order:
1. The 4:5 crop `input/mpi1042_threequarter_4x5.png` (more face for Klein to copy).
2. Name the turn in words ("head turned three-quarters to the left, exactly as in image 1"),
   the side read off the picture; and/or say the right half IS image 1 re-lit on grey.
3. Drop whatever in `Sheet_Layout` still reads as a front portrait.
3+ seeds per variant; a winner must hold across seeds.

**Issue B - the portrait is stretched taller/narrower** (face, neck, hat). Measured with
`research/bench-tools/stretch.py` (bench python has cv2): ratio sx/sy 0.93 at 1280x800 and 0.92
at 1792x1120 with the uncropped 979x1024 picture, so resolution does not touch it. Untested fix:
the 4:5 crop `input/mpi1042_front_4x5.png` (target ratio ~1.0). If it still stretches: pad the
picture to 4:5 instead of cropping; then per-panel generation; then pasting the user's own
pixels into the portrait panel (brief § "detail panels").

**The bench graph file now carries Fabio's tested values** (he closed his tab unsaved; regenerated
from `build_bench.py` before lunch): `W_sheet`/`H_sheet` = 1792 x 1120, Picture 1's
`ImageScaleToTotalPixels` = 2 MP, `Sheet_Layout` = the "keeps the head exactly as it is in
image 1, with the same turn, tilt and expression" text (validation.md, run 3), and an
`MpiClearVram` before `Output_Image` **at Fabio's request: VRAM must be released after every
run so his card does not sit hot** - keep it in every variant. Detail is fine at these sizes and
it fits the card. Re-open the file before editing it: he may have it open again.

Bench tools: `research/bench-tools/` (`build_bench.py` makes the graph, `convert.py` +
`simulate.py` prove it offline, `last_run.py <outdir>` pulls runs from `/history`, `stretch.py`
measures stretch, `crop45.py` makes 4:5 crops, `oi.py` reads `/object_info`). Post a run with
the API graph from `convert.py` + overrides, as `tool_bench_8189_prompt_sweep` does (port 8188
here, the bench is already up).

Earlier notes:

- **No `Input_Has_Body` param needed.** `MpiLoadImage` already outputs `loaded`; Picture 2 runs
  with `block_if_empty: false` (an empty slot gives a 1x1 blank and `loaded: false`), and that
  output drives three lazy `MpiIfElse`: prompt, conditioning, debug preview. Simulated over the
  API graph: without a body, SAM3 / fill / ref 2 never execute. App side: the Flow only has to
  leave the body slot empty.
- **Prompts are style-neutral** ("the same visual style and medium as image 1"), not
  Photoreal: a user's character can be any style. Close-up asks "turned the same way as in
  image 1" (risk 5). `[CHARACTER PROMPT]` sits right after the reference sentences, before the
  layout, so the user's text is read early. One shared `Sheet_Layout` string.
- SAM3 vocabulary on the body picture is `head, hair, hat` (the sheet's own is `face, hat,
  moustache`): the body picture's hair has to go with its head (brief).
- **Bench runs 1-3 (validation.md):** portrait = Klein COPYING Picture 1, so (a) the picture's
  aspect must match the 4:5 portrait panel or the copy stretches (measured 7%), (b) 1792x1120
  + Picture 1 at 2 MP gives ~1:1 detail and fits the card, (c) asking for a new pose or
  expression makes Klein redraw the face and lose the likeness.
- **Fabio's direction (pending his close-up run): a box on the face picture, Head Swap style.**
  Existing parts cover it: a `kind: 'box'` step with `ratio: 0.8` (4:5, the portrait panel) +
  `overflow: 'allow'` -> `Input_Box` `MpiBox` -> `MpiBoxCrop` (`pad` on) before the 2 MP scale
  (`docs/playbooks/add-flow/ui/box-gizmo.md`; Head Swap's image2 box is the same shape with
  `ratio: 1`). No auto head-detect needed.
- The generator is `research/bench-tools/build_bench.py`; once Fabio edits the graph by hand,
  his file is the source, not the script.

## Phase 1: Bench graph

Bench is Fabio's (MPI-560 phase 4): the agent supplies the topology and node semantics, Fabio
authors and runs it in the node graph. GPU runs under `gpu_lease.py`.

- [x] Starter graph `G:/ComfyUi/ComfyUI/user/default/workflows/MPI-1042_character_sheet_from_images.json`:
      Klein 9B distilled, Picture 1 (3/4 face) as `ReferenceLatent` 1, Picture 2 (body,
      optional) with its head masked out (SAM3 over the WHOLE picture, flat fill) as
      `ReferenceLatent` 2, two baked prompts + the user prompt, switched on Picture 2's
      `loaded` output, same sheet layout as `character-sheet`.
- [ ] Fabio runs it once each way (body / no body) and the graph holds.

## Phase 2: Bench risks

- [ ] Risk 1: placement odds (~2 in 3) - count hits over a handful of seeds, both modes.
- [ ] Risk 2: one shot holds a 3-panel sheet layout (per-panel only if it does not).
- [ ] Risk 3: invented back panel - judged on hair and outfit from behind.
- [ ] Risk 4: prompted haircut vs the face picture's hair.
- [ ] Same-side check: does the 3/4 close-up turn to the same side as Picture 1?
- [ ] Head-removal fill on the body picture: flat fill vs LanPaint fill.

## Phase 3: Wire the Flow

- [ ] `/mpi-add-flow` once the bench graph holds: raw export to
      `comfy_workflows/raw/flow_character_sheet_from_images.json`, its API twin, the FlowDef in
      `js/data/flowsRegistry.js` (body slot optional, left empty when unfilled - no presence param), the doc
      `docs/playbooks/add-flow/existing-flows/character-sheet-from-images.md`.

## Verification

**Verify mode:** user-ux

Bench outputs are judged by Fabio's eye (identity, layout, back panel). Wiring is verified by
`/mpi-add-flow`'s own gate (`docs/playbooks/add-flow/05-verify.md`).

## Plan Drift

- 2026-10-08 (Fabio): the close-up is ALWAYS three-quarter, even from a frontal picture - a
  frontal close-up leaves the video model to invent the 3/4 view. Overrides "the hint asks for a
  3/4 picture and the portrait copies it" as the only route.
- 2026-10-08 (afternoon): the sheet is no longer ONE sampling. The portrait must be sampled on its
  own 4:5 canvas (stretch + turn), the body views on a second canvas referencing it, then stitched
  (validation.md T6). Same layout and size; the brief's one-shot assumption is gone.
- 2026-10-08: brief's `Input_Has_Body` app param dropped. `MpiLoadImage.loaded` on Picture 2 already
  carries body presence inside the graph, so the app needs no new param (see Current State).
