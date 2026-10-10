# MPI-1041 A3 - the Qwen-Image 2.1 edit graph `flow_character_sheet_edit_qwen`

The Flow's own graph for **Body shape**: one Qwen-Image 2.1 edit of a finished 3-panel sheet, the sheet at its own size. Pruned from the edit path
(`Input_wf_type 4`, no mask) of `comfy_workflows/raw/qwen_image_2_1.json`; that graph and its runtime twin are only READ.
The op is NOT registered yet (Phase B). Research licence: the pictures are non-commercial.

| file | what |
|---|---|
| `comfy_workflows/raw/flow_character_sheet_edit_qwen.json` | LiteGraph, 15 nodes / 18 links, written by the builder |
| `comfy_workflows/flow_character_sheet_edit_qwen.json` | API graph, 14 nodes, converted from the raw (below) |
| `research/bench-tools/build_edit_graph_qwen.py` | the builder (donor-clone prune, asserts, deterministic bytes) |
| `research/bench-tools/run_graph_qwen.sh` | the leased runner: 4 cases + width / layout / size / pixel-diff / pairs |

## Node map (ids are the donor's, so each node traces to `qwen_image_2_1.json`)

| id | node | role |
|---|---|---|
| 11 | `MpiLoadImage` **Input_Image** | the sheet; `block_if_empty` ON (no sheet = no run); `width`/`height` outputs feed 128 |
| 5 | `MpiText` **Input_Positive** | the WHOLE prompt, written by the app; baked value is empty |
| 8 | `MpiInt` **Input_Seed** | linked to the KSampler `seed` (no baked noise seed) |
| 1, 2 | `UNETLoader` -> `QwenImage21Cache` | `qwen_image_2.1_int8_convrot`, cache auto / default |
| 3, 4 | `CLIPLoader`, `VAELoader` | `qwen3vl_8b_int8_convrot`, `qwen_image_2.1_vae_bf16` |
| 30 | `TextEncodeQwenImage21` | picture 1 = the sheet, **`resolution` 0 baked**, prompt by link, negative empty |
| 33 | `KSampler` | 30 steps, cfg 1, euler / simple, denoise 1, latent = node 30's own (follows picture 1) |
| 34, 46 | `VAEDecode` -> `SplitImageWithAlpha` | the 2.1 VAE decodes RGBA (alpha 253-255 on the bench PNGs); alpha dropped |
| 128 | `ImageScale` bicubic | stretches the result to the INPUT size, `width`/`height` from node 11 |
| 115, 35 | `MpiClearVram` -> `PreviewImage` **Output_Image** | the clear sits UPSTREAM of the capture title |
| 129 | `Note` | what the app fills; never converted |

Dropped from the model graph: mask / inpaint crop + stitch, detail and tile upscale, control-net, the 8 reference switches
and `Edit Canvas`, `Input_Width/Height/wf_type`, the six LoRA slots and the style rack, the style-trigger concat (selector 0 =
no style, so the prompt now reaches the encoder without the trailing space the concat added). Only four titles carry the
`Input_`/`Output_` prefix; nothing baked is called `Input_Positive`.

## Size: /32-safe, returns at the INPUT size

`TextEncodeQwenImage21` with `resolution` 0 "keeps each reference at its own size, rounded to a multiple of 32"
(`comfy_extras/nodes_qwen.py`: `round(w/32)*32`, lanczos only when the size changes) and sizes its latent from picture 1, so the
sampler canvas is always /32 whatever comes in. A /32 sheet (the test sheets are 1792x1120) is not resized at all. Node 128
then stretches the decode back to the input's own width x height. **Output size = input size**, not the nearest /32.
`bicubic` on purpose: at an unchanged size it is an exact identity (checked on CPU torch, max abs diff 0.0), where `lanczos`
goes through a uint8 PIL round trip. Odd size, run: 1770x1100 in -> 1770x1100 out (the encoder rounds to 1760x1088 by its source).

## Rebuild

```
python .agents/mpi-kanban/tasks/MPI-1041/research/bench-tools/build_edit_graph_qwen.py            # writes the raw (same bytes every run)
COMFY_URL=http://127.0.0.1:48188 node scripts/workflow-to-api.mjs comfy_workflows/raw/flow_character_sheet_edit_qwen.json > <tmp>
node scripts/verify-workflow.mjs <tmp>        # engine accepts it (48188, read-only /object_info)
COMFY_URL=http://127.0.0.1:48188 node scripts/validate-injection-rules.mjs <tmp>
cp <tmp> comfy_workflows/flow_character_sheet_edit_qwen.json     # only if all of the above passed
```
Never `sync-raw-workflows.mjs` (commits) and never `workflow-to-api.mjs` bare. The builder asserts: the donor raw round-trips
byte-for-byte, exactly four app titles, every link agrees with both back-pointers, every node but the Note is upstream of
`Output_Image`, no muted / bypassed node.

Proof the files are right without a generation: the converter's output vs the graph that ran in batch 9 (`qwen21_api.json`)
differs only in the pruned wiring + the three intended edits (empty prompt, `block_if_empty`, node 128); the raw loads in the
bench frontend with 15 nodes, 18 links, 0 missing types, 0 dangling links, and `app.graphToPrompt()` equals the converter's
API graph on all 14 nodes, every input (0 diffs).

## Results (bench :8188 under the lease, seed 42, wording verbatim from `qba.py`; ~108 s a warm edit, batch 9 ~105 s)

All outputs `G:/ComfyUi/ComfyUI/output/mpi1041_qba/graph_qwen/` (the nude ones never leave it). Widths = `width.py`, front / back /
portrait, % vs the input; batch 9's reading of the same case in brackets.

| case | sheet | s | width delta | size in -> out | verdict | artefact |
|---|---|---|---|---|---|---|
| muscular | nude | 115 (cold load) | -1.7 / +4.2 / +2.1 (-1.7 / +4.4 / -0.1) | 1792x1120 -> same | PASS: abs, arms, shoulders, calves defined front AND back, no clothes invented, face kept | `graphqwen_muscular_nude.png` |
| heavy | photo | 108 | +10.4 / +8.7 / -0.1 (+10.2 / +8.6 / -0.1) | 1792x1120 -> same | PASS: bodies fuller, portrait face and chin fuller, same clothes refitted | `graphqwen_heavy_photo.png` |
| skinny | nude | 108 | -22.7 / -14.6 / -13.3 (-22.5 / -14.2 / -13.4) | 1792x1120 -> same | PASS: ribs show, thinner on all three panels | `graphqwen_skinny_nude.png` |
| heavy, odd input | photo 1770x1100 | 108 | +10.2 / +5.8 / -0.3 (own original) | 1770x1100 -> same | change visible on all three panels, no stretch artefact | `graphqwen_heavy_photo_odd.png` |

- Each of the three matches batch 9's `qwen21_*` verdict by eye (`pairs_graphqwen_nude.jpg`, `pairs_graphqwen_photo.jpg`: original /
  batch 9 / this graph). Mean abs RGB difference to batch 9's PNG: 0.75 / 0.75 / 0.46 of 255 (the trailing-space prompt and
  RGB-vs-RGBA are the only differences); `layout.py` heads / seam within 2 px (the heavy photo's portrait +9 px is batch 9's identical figure).
- **The muscular width gate does not go positive**: batch 9 read the same (-1.7 / +4.4 / -0.1) - muscle, not width. That verdict rests
  on the eye; only heavyset (wider) and skinny (narrower) are readable by `width.py`.
- Output is RGB: the bench PNGs of batch 9 were RGBA (alpha 253-255).

## Traps met

- `MpiLoadImage` reads `input/` and the BENCH's output dir (`D:\WORK\Images\Outputs`, `--output-directory`), not
  `G:/ComfyUi/ComfyUI/output/...`: an absolute path there is "missing", `block_if_empty` blocks, and the run ends `success`
  in 3 s with no image and no node error. The runner puts the odd input in `input/mpi1041_graph_qwen/` (removed afterwards).
- `run_api.py` posts the prompt itself: running any slice of a runner by hand queues a real generation on :8188.
