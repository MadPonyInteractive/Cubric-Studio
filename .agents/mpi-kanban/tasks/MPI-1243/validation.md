# MPI-1243 validation

## Bench checks (G:\ComfyUi :8188, under gpu_lease, 2026-10-22)

- VAE: shipped `flux2-vae` vs bench `flux2-vae_small`, Turbo text + photo seed 1: 42.6 / 43.1 dB PSNR, no
  visible difference (`research/vae/results.jsonl`, `research/vaebench.py`). Ship `vae-flux2`.
- Boxes: the app's own `mossLayoutPrompt` output (run through node) as the prompt, Turbo 1024x1024: swapping
  the dog and cat boxes swaps their sides, "OPEN DAILY" exact (`research/boxes/strip.jpg`, `research/boxbench.py`).
- 2K: Turbo 1472x1472 photo coherent, 15 s sampler (1.9 s/it), 22 s wall, peak VRAM 12.9 GB cold.

## Verified 2026-10-22 (Moss image 4)

- `npm test` + lint green with the ModelDef, recipe and guide (pushed `d2dcca4ad` onward).
- Enhancer recipe `moss-image`: Stage 1 twice-green on DeepInfra Gemma 4 26B, 15/15 local 12B
  (`docs/recipes/research/moss-image/validation.md`).
- R2: the three weights byte-exact by `rclone lsl` and public Content-Length; no orphan multiparts.
- Real app (`npm run app:isolated`, own profile + documents, weights copied G: -> M:/CubricModels, under
  gpu_lease, `/connector/generate`, seed 1234):
  - Turbo t2i, bakery sign 1024x1024: 13.8 s; "ROSA'S BAKERY", "fresh bread since 1962", "OPEN" all exact.
  - SFT (`turbo: false`), same prompt + seed: 32.3 s; same three texts exact, softer, more natural.
  - Turbo + two boxes, 16:9 1344x768: 9.7 s; fox in its left box, bicycle in its right box. ComfyUI
    received MOSS layout JSON (`summary.caption` = the prompt, two `object` items, `abs_centralized`
    `yxyx`, edges checked by hand).

- **Fabio's eye, 2026-10-22: "it looks right"** on all three (boxes "only work in that area, similar to
  our mask edits. That's good.").

## Recipe Stage 2, 2026-10-22 (Moss image 5)

- Three ideas (Lisbon poster with "VISIT LISBOA", fox reading at dusk, fisherman at sunrise) enhanced
  twice: the app's default ComfyUI 4B enhancer (job captured from `llmService.enhance` in an
  `app:isolated` renderer, sha256-matched) and DeepInfra Gemma 4 26B (3 calls, $0.00036, Fabio's yes).
  All six rendered on MOSS Turbo, seed 1234, under gpu_lease. Record:
  `docs/recipes/research/moss-image/validation.md` § Stage 2; images `research/stage2/`.
- 26B: every rule kept, lettering exact. 4B: invented "Morning Tide" text on the fisherman, no
  medium opening and a sound on the fox. Same system prompt: the 4B is the weak link.

## Not yet verified

- Fabio's eye on the Stage 2 renders; `draft -> validated` is his.

## Reopened 2026-10-22 (Moss image 6): Fabio's smoke test

Fabio ran MOSS in his own app (RunPod Pod, local GPU taken by a peer). Two findings:

1. **No `+`, no image drop, no ops on a picture.** Expected for a `t2i`-only card, but Fabio:
   "we need to add those operations to it, for sure, all of them". Added `i2i`, `inpaint`, `detail`,
   `upscale` on FLUX.3's own graph branches (already in `moss_t2i.json`, already on MOSS's UNET).
   `edit` stays off: MOSS reads no reference. MOSS core `extra_conds` reads only `cross_attn`, so
   inpaint's `MpiFlux3References` conditioning is plain text for it (checked in
   `comfy/model_base.py` `MOSSImage`).
2. **Enhance made it worse** (Gemma 3 12B, then Gemma 4 26B: "not much difference"). Request "A woman
   skydiving. Photograph taken from the plane as she jumps out of it." Fabio: "The goal would be to be
   in the cockpit behind her as she jumps, seeing her from behind." Heal below.

### Recipe heal (mode `t2v`, the only mode; the production shot `t2v`)

Findings: the seven sidecars in Fabio's `Moss image` project (5 enhanced, 2 raw) + his words above.

| # | Inventory # | Recipe today (verbatim) | Evidence | Mode | Basis | Verdict |
|---|---|---|---|---|---|---|
| 1 | 1 camera stands where the request says | "Fill in what they left open with concrete visual choices: setting, composition and framing, viewpoint" | captions: "The plane fills the left side of the frame" (camera outside); "viewed from inside the open doorway ... doorframe is visible in the foreground" with her far off; Fabio's intent | t2v | measured (5 captions, 12B + 26B) | new |
| 2 | 2 subject size | (silent) | "the woman as the clear focal point against the expansive backdrop"; renders show a small figure | t2v | measured (5) | new |
| 3 | 3 action keeps its moment | "Keep everything the user specified: subjects, counts, actions" | "jumps out" became "having just exited", "mid-air" | t2v | measured (5) | contradicts (rule present, broken) |
| 4 | 4 closing mood line | "Describe only what can be seen. Leave out sounds, smells, backstory and intentions." | "conveys a sense of freedom, adventure, and exhilaration" closes every caption | t2v | measured (5) | new |
| 5 | 5 26B no better | (model fact) | Fabio: "not much difference" | model | measured | confirms the fault is the recipe, not the engine |

Edits: four adapter lines in `systemPrompt` (camera where the request puts it, the action's moment,
how much of the frame the subject fills, end on something visible), two `dos`, two `donts`, a
`forbiddenPatterns` mood-summary ban. Status back to `draft` (Fabio re-validates).

Skydiver check (`docs/recipes/research/moss-image/skydiver_check.mjs`, local Ollama `gemma3:12b` =
Fabio's enhancer weights, 5 runs each, free, under gpu_lease):

| Version | Camera inside the plane | Subject large | Mood ending | Unasked sign/sticker text |
|---|---|---|---|---|
| v1: lines under "Long or unclear requests" | 2/5 | 1/5 | 1/5 | 3/5 |
| v2: own section "Camera, subject and moment" after "Keep the request" | 4/5 | 5/5 | 3/5 | 3/5 |
| v3: + "Before you reply, check" list before the last line, doorway example | 5/5 | 5/5 | 0/5 | 4/5 |

v3 is the recipe on disk. Her back is said in 2/5 (pack "strapped to her back", face hidden).
**Open:** the 12B still adds made-up signs ("Buckle Up!", "FLY SAFE") 4/5. Stage 1 sweeps
(`npm run recipe:test`) NOT run yet on v3; the DeepInfra 26B twice-green needs Fabio's yes on the
price (~1.5 cents a sweep).

### Ops bench, 2026-10-22 (my `app:isolated` :62842 via `/connector/generate`; inpaint/detail straight to :48188 with a mask; seed 1234/777, under gpu_lease)

- t2i Turbo 13.8 s, "BAIT & TACKLE" exact.
- i2i 0.55: Turbo 10.3 s, SFT 32.4 s, clean, barely restyled; 0.8: SFT a real watercolour, Turbo stays
  photographic. i2i sizes from the project ratio, not the source (same as FLUX.3).
- upscale x2 to 2048: Turbo 60.9 s, SFT 66.0 s single pass; tiles Turbo 207.8 s, SFT 249.4 s. Face and
  lettering kept on all four; Turbo tiles slightly crosshatch the beard. SFT 15 steps (`MpiMath`) is enough.
- inpaint (sign -> "FRESH FISH"): Turbo 16 s, SFT 52 s, outside the mask unchanged, text exact.
- detail (face, 0.4): Turbo 8 s, SFT 16 s.
- **Fabio in his own app: detail, upscale, image-to-image passed.** Inpaint still to test (his).
