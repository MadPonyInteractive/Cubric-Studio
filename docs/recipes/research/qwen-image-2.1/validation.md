# Validation Record — Qwen-Image 2.1

## Stage 1 — autonomous text-only loop (agent)

- **Recipe / mode:** `qwen-image-2.1` / `t2v` (every op that enhances; edit never does)
- **Enhancer model:** `huihui_ai/gemma-4-abliterated:12b`
- **Judge model:** `gemma3:12b`
- **Runs per tier:** 3 (a tier passes only if all 3 pass)
- **Harness:** `node scripts/recipe-test.mjs qwen-image-2.1 --engine gemma-4-abliterated-12b --judge gemma-3-12b --runs 3`
- **Date:** 2026-10-09 (MPI-1048, session 3e2b8b66)

### Result — ALL PASS, two independent sweeps

30 consecutive passing runs (5 tiers × 3 runs × 2 sweeps), every judge verdict `intent=2 structure=2 format=2`.

| Tier | Result | Words (sweep 3 / sweep 4) |
|---|---|---|
| `bare` | **3/3, twice** | 252,258,234 / 232,227,239 |
| `medium` | **3/3, twice** | 252,281,273 / 265,243,269 |
| `directed` | **3/3, twice** | 235,256,230 / 265,256,241 |
| `overlong` | **3/3, twice** | 286,299,296 / 263,298,295 *(410 in)* |
| `general` | **3/3, twice** | 266,249,245 / 237,243,240 |

The floor (200) now has 27 words of headroom; condense peaks at 299 against the 410-word input.

### Tally by iteration

| # | bare | medium | directed | overlong | general | What changed |
|---|---|---|---|---|---|---|
| 1 | 3/3 | 3/3 | 2/3 | 3/3 | 2/3 | draft: "about 300 words, never below 250"; failures 193 and 196 words |
| 2 | 3/3 | 3/3 | 2/3 | 3/3 | 3/3 | per-section sentence counts (background 2, walk >= 9, lighting 2) + limb rule; `directed` 192 |
| 3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | stated length 350 (16-20 sentences, never below 300) |
| 4 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | none — confirmation sweep |

### What the loop taught

- **The 12B engine lands ~25% under any stated length.** "About 300" produced a 192-243 spread; the total word count
  is not something it tracks. Per-section sentence counts lifted the middle, but only raising the stated figure to 350
  cleared the 200 floor on `directed` (a close-up, so less frame to walk).
- **The limb rule is from renders, not from the harness.** On Fabio's own failed seeds (MPI-936 bench, 2026-10-09) a
  ~300-word description in this shape fixed the bent and extra arms that a one-line prompt produced; the encoder
  (fp8 vs int8) did not. So the walk round a person names where each arm and leg is.

## Stage 2 — real renders (Fabio)

Not run. Open questions: `<image1>` vs "image 1" on edit; the full vendor 400-500 words vs this ~300 at 30 steps int8.
