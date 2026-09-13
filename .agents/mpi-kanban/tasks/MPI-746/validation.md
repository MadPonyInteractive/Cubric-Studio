# MPI-746 validation

## Evidence (Fabio's bench, 2026-09-13)

- Klein t2i: 3 prompts x fixed seed, `lcm` vs `euler` = 6 generations. `lcm` removes euler's extra limbs, slightly better quality.
- BFS Klein head swap graph ships `lcm`; `euler` in the same graph was far worse.
- Samplers that also take a scheduler: `euler`/`beta` vs `lcm`/`simple` vs `lcm`/`normal`. **`lcm`/`normal` wins.** Applies to UltimateSDUpscale 405 and MaskDetailerPipe 415.

## Scope drift found at pickup

The card's SCOPE listed KSamplerSelect 24/112/171, LanPaint 652 and the three Flows. Two more Klein nodes carried `euler`/`beta`: MaskDetailerPipe 415 (detail) and UltimateSDUpscale 405 (upscale). Both folded in.

LanPaint_KSampler 652 cannot take `lcm`: `/object_info/LanPaint_KSampler` on 48188 lists its own samplers (euler ... seeds_3) with no `lcm`. Fabio benched SDXL's LanPaint config against it: **`euler_ancestral`/`simple` is better** - applied.

`docs/models/klein/removal.md` NOT edited: marked history, its `euler` records the 2026-07-26 measured config.

## Checks (2026-09-13)

- Pre-edit: all 4 raw sources re-converted against 48188 came out byte-identical to their shipped API twins, so the diff below is the edit alone.
- Raw edit: 10 lines, values only (`git diff --stat comfy_workflows/raw/`).
- Converted diff, node by node: template 7 (`sampler_name` x5, `scheduler` x2), each Flow 1 (`sampler_name`). `generate_klein.py` OK for both sizes; runtime diffs `sampler_name`/`scheduler` only.
- `node scripts/validate-injection-rules.mjs` on klein_t2i, klein_9b_t2i, 3 Flows -> 5/5 conform.
- `COMFY_URL=http://127.0.0.1:48188 node scripts/verify-workflow.mjs` same 5 -> all validate (12 value_not_in_list are the 4B weights absent from this box, not this change).
- `node --test tests/inject-params-titles.test.cjs` -> 23/23 pass.
- LanPaint 652 follow-up: raw +1 value line; converted diff exactly 1 (`sampler_name` `euler` -> `euler_ancestral`); regenerated both sizes OK. Final runtime diff across klein_t2i + klein_9b_t2i: `lcm` x10 (4 with `normal`), `euler_ancestral` x2, nothing else. Re-ran all three checks after it: injection rules 5/5, verify-workflow 5/5 against 48188, inject-params-titles 23/23.

**Verdict: verified.** Image quality judged by Fabio on his bench; graph integrity by the checks above. No generation run from this session, and 4B not executed (weight absent here) - same graph as 9B, values only.
