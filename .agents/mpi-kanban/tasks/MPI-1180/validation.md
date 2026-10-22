# MPI-1180 validation

## Run 2 (pruned graph, real timings) - 2026-10-22, "Moss image 3"

Bench: Fabio's G:\ComfyUi v0.42.1 on :8188, RTX 4060 Ti 16 GB, 64 GB RAM, 1024x1024, under `gpu_lease.py run`.
Graph: `research/graphs/moss_t2i_api.json` (raw converted + `_prune_to_captures`, 111 nodes, one sampler pass per
image, confirmed by the ComfyUI console: one bar, "Prompt executed in 11.16 seconds" for a turbo image).
Raw rows: `research/bench/results.jsonl` (24/24 `success`). Contact sheet: `research/bench/run2_grid.jpg`
(rows turbo / turbo_euler / sft / sft_neg; columns text s1 s2, long s1 s2, photo s1 s2).

| Variant | Steps / CFG | Sampler bar (warm) | Wall s/img warm (cold s1) | Peak VRAM warm / cold |
|---|---|---|---|---|
| turbo (er_sde) | 8 / 1 | 6-10 s, ~1.1-1.3 it/s | 11-18 s (13-50 s) | 6.7-7.8 GB / 12.1 GB |
| turbo_euler | 8 / 1 | 5-8 s, ~1.2-1.4 it/s | 10-16 s (13-27 s) | 6.7-7.2 GB / 12.1-12.3 GB |
| sft (er_sde) | 25 / 2.5 | 26-28 s, ~1.1 s/it | 31-33 s (33-39 s) | 7.9 GB / 12.2-12.4 GB |
| sft_neg | 25 / 2.5 + neg | 27 s, ~1.1 s/it | 31-33 s (35-57 s) | 7.9 GB / 12.2-12.9 GB |

- Wall time is the script's submit-to-history poll (0.5 s grain), so it carries a few seconds of overhead and model
  loads; the sampler bar is the clean number. One outlier: sft text s2 38 s bar (a peer touched the GPU or a reload).
- Cold peak (~12.2 GB) = 9B text encoder (7.0 GB staged) + MOSS DiT (5.2 GB) resident together. Warm (TE cached)
  ~7-8 GB. ComfyUI's dynamic VRAM loading staged both, so a 12 GB card should run cold too; 8 GB untested.
- Peak RAM: ~25 GB for the WHOLE box (script reads `/system_stats`, not the ComfyUI process; the box sat at ~32 GB used
  with Fabio's apps before the run). Not attributable to MOSS; measure per-process at add-model time.
- Negative prompt costs nothing measurable (CFG 2.5 already runs two passes).

## Quality (agent read of the contact sheet; Fabio's eye is the gate)

- Text: "MOSS BAKERY" / "Fresh bread daily since 1987", "MAKERS", "The quiet art of glaze", "ISSUE 42" exact on all 24.
  Only slip: unrequested tiny filler lines under the masthead (turbo long s2 "EDITORIALS", sft long s2 a gibberish
  strapline). Run 1 (unpruned) agreed: text exact everywhere.
- Long prompt: every element present (silver hair, round glasses, blue bowl, graded shelves, cat in box, yellow circle).
- Photo: clean fox, breath, dusk light; turbo slightly more saturated / HDR, SFT softer and more natural.
- turbo vs turbo_euler: same quality, euler marginally faster (5-6 s bars vs 6-10 s). Pick euler for turbo.
- sft vs sft_neg: no visible difference. Ship SFT with an empty negative (and never `nsfw` as a default).

## Verdict (agent recommendation, awaiting Fabio)

WIRE. Turbo = ~6 s sampler / ~11 s per 1 MP image with exact multi-line text and full long-prompt adherence (Fabio: faster
than SDXL on his box; Klein not re-timed here), at ~7 GB warm VRAM. SFT (25 steps, ~27 s) as the quality tier. Two-model Klein
shape, turbo sampler = euler, empty negative. Next = an `/mpi-add-model` card starting from
`research/moss_image_t2i_template.json` (Fabio opens it). Open items for that card: turbo is community
(toxicdog, Apache-2.0, "experimental"), not official; 8 GB card test; per-process RAM; small-text and >1 MP checks
(video research: small infographic text misspells); Spectrum MOSS speed node (GPL-3.0) only helps the SFT path.

## Close (2026-10-22)

Fabio, in chat: "Yes, we're definitely going to add this model. The images look good." Verdict WIRE accepted;
the add-model work continues on its own card. The 9B MOSS TE stays (MOSS needs it); for any "boxes from picture"
step reuse the shipped `qwen3vl-abliterated-clip` (Qwen3-VL-4B abliterated, engine asset) and the describe
graph's `boxFromDescribeAnswer` mapping (`docs/llm.md`) - the video's Qwen3-VL 4B is what we already ship.
