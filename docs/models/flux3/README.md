# FLUX.3 Klein — model notes

> **What this is.** The FLUX.3 Klein *what*. `docs/playbooks/add-model/` is the generic *how*.
>
> Tracking card: MPI-1181. Every bench and decision with dates: the card's `brief.md`
> (sections "2026-10-19 update" and "Hand-back 2026-10-19"). Raw research: `tasks/MPI-1181/research/`.

Black Forest Labs, 5.6B, released 2026-10-15. Text-to-image and instruction editing with up to TEN
reference images in one model, plus bounding boxes in the prompt. One card (`flux3-klein`) with a
Turbo button; ships Klein's op set minus depth: t2i, i2i, edit, inpaint, detail, upscale.

| | |
|---|---|
| Licence | **FLUX Kommunity License v1.0** (`MODEL_LICENCES['flux3-klein']`, bundled `licences/flux3-klein/`). Model: non-commercial. Outputs: commercial only for a Qualifying User (under US$5M gross a year with affiliates). §2.e content filtering is a condition (the child-safety gate). HF-gated `auto`, so the gate proves access with the user's token (`verify` probes `workflows/README.md`). Not Klein 9B's agreement; different receipt |
| Engine floor | ComfyUI core **0.41.0** (native support, PR 17064); shipped on 0.42.1 |
| Transformers | BOTH install: distilled `flux3-image-klein-int8-convrot` 5.43 GB (Turbo on) and base `flux3-image-klein-base-int8-convrot` 5.41 GB (Turbo off). R2 primary, mirror `ml-resources/flux-3-image-klein-comfy` (ungated, same lfs sha256 as BFL's gated repo). No bf16 (double size), no nvfp4 (RTX 50 only) |
| Text encoder | **Reused** `qwen3vl-abliterated-clip` (Qwen3-VL-4B abliterated fp8_scaled, an engine asset) at CLIPLoader type `flux3`. BFL's own `qwen3vl_4b_int8_convrot` is not shipped |
| VAE | `vae-flux2` (shared) |
| Graph | ONE file, Klein's shape: `comfy_workflows/flux3_t2i.json`, raw `raw/flux3_t2i_template.json` (Fabio's bench `flux3.json`), generator `generate_flux3.py`. `Input_wf_type` 1 t2i, 2 i2i, 4 edit, 5 inpaint, 6 detail, 7 upscale (3 routes to t2i). Turbo = `Input_is_Turbo` -> MpiIfElse picks the UNET and steps (16/50) and cfg (1/3.5). References via `MpiFlux3References` (MpiNodes, `ref_image_0..9`, empties dropped, `<ref_image_N>` tags renumbered). Style rack, NSFW and depth LoRAs are bypassed in the raw, so the converter drops them |
| Settings | t2i er_sde/simple, base 50 steps cfg 3.5, Turbo 16 cfg 1; i2i er_sde/beta; edit euler/simple; inpaint LanPaint NumSteps 1 on VAEEncode of the crop; upscale single pass by default (tile = no prompt, cfg 1). The graph is the truth: Fabio confirmed it correct as wired 2026-10-19, where the brief's earlier table differs |
| Sizes | Tiers `1k` / `2k` (Qwen-Image 2.1's table) and `4k` = 2k x2 per edge (16:9 3840x2176, ~8.4 MP). Benched coherent at 4k on both weights: Turbo 130 s, base 681 s on a 16 GB card; the 4k radio carries a "slow" hint, never a cap |
| Custom edit size | Unmasked edit takes the ratio + tier picker (`customSizeOps: ['edit']`, `sizeOptIn` on the edit command) behind a **Custom size** button, off by default (`customSize` control, perOp, injects `Input_custom_size`). Off = follow reference 1: MpiPromptBox parks ratio + tier (hidden, not injected). Agent submit: a named `ratio`/`qualityTier` turns it on, else the project's button (`resolveNamedParams`). Never in opInject. The graph honours it only with no mask (#798 `custom size AND NOT has_mask`), so a masked edit keeps the source frame |
| Edit frame (MPI-1216) | Off: the output is picture 1's own size, /16, shrunk only past the 4K area (`_keep_edit_size`). Picture 1 is handed to the model resized to that exact frame (or the Custom size frame), node on `keep resolution`, pictures 2-10 scaled to 1 MP in the graph (`_ref_matches_frame`). At 1 MP it no longer lined up: chained edits crept, a big photo re-composed, and a 2 MP Custom size frame re-drew the scene (Cosmo's 8:5 2K lost the tiger and dog). A Custom size of another ratio (>2% off) keeps picture 1 at 1 MP, so the model reframes instead of cropping. Price: a ~8.6 MP photo edit runs ~2.5x as long (519 s vs 204 s Turbo, 16 GB). Bench + scripts: `.agents/mpi-kanban/tasks/MPI-1216/research/` |
| Edit grade (MPI-1216) | FLUX.3 re-renders every pixel and each pass runs a touch warmer and more saturated, so chained edits drifted (Turbo "change nothing" x3: 3.3 dE off picture 1; base 1.4 with chroma +60%). A keep-colour clause in the prompt did nothing (identical on Cosmo's real chain, worse on base) and a global ColorMatch turned an added dog beige. `MpiGradeBack` (MpiNodes `grade.py`) fits a gain + offset over the whole frame, refitted without what the edit changed, and applies it (~0.2 s at 1 MP, ~1.7 s at 8.6 MP, CPU). Wired by `_grade_back` on the UNMASKED edit decode, on only when slot 2 is blank (one picture) and the edit is not a Custom size reframe; a mean correction over 4/255 is an asked-for grade (night) and is kept. Bench + scripts: `.agents/mpi-kanban/tasks/MPI-1216/research/colour/` |
| Boxes | Settings button (`boxes` control, perOp; `layoutBoxes: { ops: ['t2i','edit'], format: 'flux3' }`), greyed on the other ops. `MpiBoxesPanel` slides up out of the PromptBox `__boxes-slot` (no backdrop; prompt, ratio and Run stay live) and draws over the output frame: blank at the ratio on t2i, picture 1 on edit, `contain`-centred in the ratio when Custom size is on (ASSUMED: FLUX.3 fills around it, not benched). Boxes are `{x,y,w,h,desc,name}` fractions; the name is the row id the prompt cites as `<name>` (a rename rewrites the prompt), an empty desc reads as the name, a pre-name box is `obj_N`; the prompt box `@` picker lists the boxes after the references. An EDIT with an empty prompt gets `In <name>: desc. ... Keep everything else in the picture exactly the same.` written by `withLayoutBoxes` (bench 2026-10-20, `research/boxes/tigerbench.py`: table-only lost the subject on 2 of 4 seeds, the written line on 0 of 4; an `Add <name>` wording drew nothing once and printed the label once). A TYPED box edit with no keep clause (`KEEP_CLAUSE`) gets the same closing keep line (Fabio, 2026-10-20). `Layout_Boxes` is injected even empty so the sidecar, hence Reuse, records the run's own boxes; `commandExecutor._buildParams` consumes `Layout_Boxes` and appends `Flux3LayoutPrompt`'s table (`withLayoutBoxes`, `js/data/layoutBoxes.js`) LAST, unless an Enhance already wrote one. So a box drawn, moved or removed after Enhance DROPS the enhancement (`MpiPromptBox._dropIfBoxesMoved`, panel change + Run; Reuse carries the card's boxes in `enhanced.boxes`). NO box node in the graph. Bench 2026-10-20: boxes place subjects on t2i, swapping boxes swaps them; on edit an added object lands in its box, cited or not, simple or BFL i2i row shape alike. Agents (Cosmo, MCP) send the same list as the named param `boxes` (`namedParamsFor` advertises `boxes: true`; `resolveNamedParams` validates and injects `Layout_Boxes`, asked only, so the panel's boxes never ride an agent run); the how is `docs/agent/models/flux-3.md` § Boxes. **Analyse** (MPI-1253, both models, t2i ONLY: it lays a new picture out like another one, a magazine cover; an edit's boxes are the user's own, Fabio 2026-10-22): right-click a gallery card > **Create boxes** (not on history cards: that workspace has no t2i) (offered while `state.s_boxesReady` names the mounted prompt box, set by `MpiPromptBox._syncBoxes`; the menu emits `boxes:create`), or the panel's button to re-run, asks `describeImage` (`queued`, so a queue row + Stop) `ANALYSE_QUESTION`; `boxesFromAnalysis` reads `{caption, items:[{name, desc, bbox_2d}]}`, bbox_2d = Qwen-VL's own `[x1,y1,x2,y2]` on 0-1000 (benched on qwen3-vl 4B: tight on objects and lettering). It REPLACES the boxes and writes the caption only into an EMPTY prompt. The card becomes `_boxesGuide`, never staged (staging switches FLUX.3 to edit; MOSS t2i has no image slot). A drop onto the panel was the first way in and was REMOVED: a real card drag got staged as a prompt-box input. The guide is drawn stretched (`--guide`), and the ratio moves to the nearest one for the picture (`ratioSettingsFromParams` + `applyPromptReuseSettings`, as Reuse) |
| Speed (bench, 1024x1024 t2i, runtime file) | Turbo 12 s, base 48 s; edit (1 ref, 571x1021) Turbo 21 s; i2i Turbo 12 s |

## Hard rules

- **Never copy Klein 9B's "images stay commercially usable" line unqualified.** Here it holds only
  under US$5M revenue.
- **The prompt upsampler is required for good results** (BFL, Fabio's bench), and is NOT in the
  graph: the `flux-3` Enhancer recipe carries BFL's system prompts verbatim (`t2v` = BFL t2i, `i2i` =
  BFL i2i for edit/inpaint, `t2v_bbox` = BFL t2i_bbox for a t2i with Boxes; `research/bfl_pup_system_prompts.json`,
  Apache 2.0). BFL's i2i_bbox is NOT shipped: it boxes what is already in the pictures, which a
  description-reading enhancer can only guess; an edit with Boxes enhances in `i2i`, gets each box as words
  (`editPlacementInput`: name, desc, "on the right of the frame, at middle height"), and the app appends the
  user's table. Never send it BFL's "LOCKED ... identity, provenance" header: the 4B wrote "the tiger from the
  first image" 3 of 3 with no tiger picture (`research/boxes/enhbench.mjs`). The edit's pictures reach it by load order
  (`Image 1`...; MpiPromptBox `_openEnhanceDialog`): edit slots carry no tag, and before 2026-10-20 that sent NO
  picture description at all. The user presses
  Enhance; NO auto-run (Fabio, 2026-10-20), the op help says to. Cosmo's guide: `docs/agent/models/flux-3.md`.
- **Who-does-what-to-whom in a box edit is the model's limit, not ours** (Fabio, 2026-10-20). Benched
  on the tiger/raptor/mouse scene: BFL's own text encoder (`qwen3vl_4b_int8_convrot`) = same pictures;
  BFL's external-VLM `i2i_bbox` prompt written by a vision model (gemma3 12B, Gemma 4 26B) = no pass
  either. Do NOT re-run those or build a seeing-enhancer for it; the user fixes it with box size
  (smaller and higher reads as further away) and wording (`MPI-1181/validation.md`).
- **Turbo on upscale is the user's call**, not forced (Fabio). Turbo single-pass upscale held identity
  best of every upscale run; tile upscale drifts identity.

## Sources

- <https://bfl.ai/blog/flux-3-image-klein>
- <https://huggingface.co/black-forest-labs/flux-3-image-klein-comfy> (gated; LICENSE.md ungated)
- <https://huggingface.co/black-forest-labs/flux-3-image-klein-pup> (upsampler + system prompts)
