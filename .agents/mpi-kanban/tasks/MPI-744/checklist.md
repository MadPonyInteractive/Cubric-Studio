# MPI-744 Checklist

LoRA facts and open decisions live in the card description; do not repeat them here.
App wiring ran in the same session as MPI-747 (`Output_Display`) at Fabio's call, 2026-09-13 —
the Klein graph is that card's live test. Ownership: `files.json`.

## Bench

- [x] 1 - Klein 9B, no crop-stitch: first run about 20s, result "not too bad" (Fabio, 2026-09-13).
- [x] 2 - Klein 9B LoRA: `step3500_rank128`, at strength **0.75** — better than 1.0 (Fabio's export, 2026-09-13).
- [ ] 3 - Klein 4B: Fabio staged the undocumented `v1.1_optional` (rank 512), not the README's `v1`. No graph loads either yet.
- [x] 4 - Crop-stitch: KEPT in the exported graph.
- [ ] 5 - Side by side with the old Qwen Head Swap Flow — superseded by the decision in 6; skip unless Fabio wants it.
- [x] 6 - **DECIDED by Fabio 2026-09-13: Qwen is DROPPED, no tier; lcm sampler.** Graph exported to `comfy_workflows/raw/flow_head_swap.json` with `Output_Display`.

## App

- [x] 7 - R2: 9B + 4B BFS LoRAs uploaded, public `Content-Length` byte-exact; Qwen BFS LoRA DELETED from R2 (never shipped, Fabio's call).
- [x] 8 - Deps: `klein-9b-lora-headswap` added (sha256 = upstream `lfs.sha256`, upstream is the mirror); `qwen-lora-headswap` KEPT as DEPRECATED, `url` repointed at the upstream.
- [x] 9 - Graph: raw node 200 retitled `Input_Positive` -> `HeadSwap_Prompt` (the promptless-flow wipe); runtime regenerated via `workflow-to-api.mjs`, validators green.
- [x] 10 - FlowDef: `requiredModels ['klein-9b']`, `requiredDeps ['klein-9b-lora-headswap', 'comfyui-inpaint-cropandstitch']`, Speed radio removed; `flowHeadSwap` 1.1 in both registries.
- [x] 11 - Docs: `head-swap.md`, `UNRELEASED.md`, qwen-edit README; desktop spec fixture moved to `klein-9b`.
- [ ] 12 - Fabio's live run in his app (shared with MPI-747 `validation.md` § Live).
- [ ] 13 - Fabio retitles the bench node `HeadSwap_Prompt`, or the next export brings `Input_Positive` back.
- [ ] 14 - Tile + hero were cut from a Qwen run: re-cut via `/mpi-flow-graphics`, or keep — ask.

## Bench round 2 — the box comes back darker (2026-09-13)

- [x] 15 - MEASURED on bench runs #70-72 (`python research/seam_probe.py`, reads 8188 `/history`, diffs `Output_Image` against the source photo): outside `Input_Box` 0.00 change; just inside its top/left/right edges (background only) **-5 to -7 levels, uniform across RGB**. Klein returns the whole 360x360 box darker and the 32 px stitch blend only softens the edge. Bottom edge +28 R is the new hair/neck, content not defect.
- [x] 16 - `MpiInpaintHeal` after the stitch at `color 0 / grain 1 / ring 64 / feather 32` changed nothing measurable (grain is zero-mean, cannot move a tone shift). KJNodes `ColorMatch` REJECTED by Fabio: it is why `MpiInpaintHeal` was built. Neither route fixes it.
- [ ] 17 - Fabio's next approach, at the bench: Klein REMOVES the original person (a clean plate), then the new person, background removed, is composited onto that plate. Re-run `seam_probe.py` on it — the removal pass is a Klein crop too, so check the plate's box edges for the same shift wherever the cutout does not cover them. The wired graph and FlowDef will change again.
- [ ] 18 - The prompt's second paragraph, "Describe the expression in Picture 1 and copy it to the new image.", is a PLACEHOLDER (Fabio, 2026-09-13): it is meant to be REPLACED by a description of Picture 1's expression. The BFS author's Klein workflow carries a bypassed VLM ShowText branch that produced exactly that text; the README marks the line `[Optional]`. Today the literal sentence reaches the encoder. The Flow needs a describe step on `Input_Image` whose output replaces the paragraph (Vision already ships a VLM describe op, `imageDescribe`) — bench it first.
