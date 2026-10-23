# Source Manifest — LTX 2.5

Provenance for the LTX 2.5 recipe (`js/data/recipes/ltx-2.5.recipe.js`, MPI-1095). LTX 2.5 gets its
OWN recipe (Fabio 2026-10-23), not a share of `ltx-2.3`: the two models' vendor rewriters disagree
on camera, register and length (table in `research.md` Part A Q6).

- **Model version researched:** LTX 2.5 (`Lightricks/LTX-2.5`, HF sha `49b093a39c19`, modified 2026-10-11;
  Vision card `ltx-25`, int8, distilled, dev builds only)
- **Research date:** 2026-10-23
- **Researcher:** agent ("LTX 2.5 model 7"), two read-only sub-agents (vendor repos; web + community)
- **Notebook:** none for LTX 2.5. Not a blocker; web + vendor code only.

## Phase 0 — vendor and community prompting skills

- **Vendor rewriter FOUND and is the spec.** `Lightricks/LTX-2` (HEAD `e98f6d927d83`, 2026-10-18),
  `packages/ltx-core/src/ltx_core/text_encoders/gemma/encoders/prompts/gemma4_{t2v,i2v}_system_prompt.txt`.
  Both files have ONE commit, `2362161611` (2026-08-11): unchanged since the 2026-08-17 read recorded in
  `../ltx-2.3/sources.md` rows 10-12, where they were first (wrongly) merged into the 2.3 recipe.
  `base_encoder.py` `_default_system_prompt()` picks `gemma4_*` for `model_type == "gemma4"`, and
  `encoder_configurator.py` labels gemma4 "LTX 2.5". So THESE files are 2.5's own rewriter.
- **No other vendor prompt file.** LTX-2 has no a2v, keyframe, extend or IC-LoRA prompt file; its
  `.claude/skills/` holds only `train-model`. `ComfyUI-LTXVideo` `system_prompts/gemma_{t2v,i2v}_*` are
  byte-identical to the GEMMA3 (2.3) files (commit `e1d2cff331`, 2026-01-06): there is no 2.5 prompt in the
  ComfyUI pack, so a ComfyUI user who turns its enhancer on gets 2.3's rules on 2.5. Not adopted.
- **LTX-Desktop** (`backend/services/prompt_enhancement/system_prompt.py`, commit `c8e423851b`,
  2026-10-19) calls the ltx-core gemma4 prompts directly for 2.5 and says they match the training-caption
  style. Its multi-keyframe rules are app-authored (single take, interpolate between stills, no cuts).
- **Community skills by stars** (`gh api search/repositories?q=ltx+skill`): benjiyaya/LTX-2.5-Agent-Prompt-Skill
  (21★), UgurInanc12/ltx25-prompt-writing (5★), kkget/Comfyui-LTX-2.5-prompt-Skill (2★),
  Deathdadev/ltx25-prompt-expert (1★). All four restate the official blog guide and add nothing measured.
  Read, NOT adopted (no evidence beyond #3).

## Sources

| # | Title / URL | Authority tier | Accessed | Notes |
|---|---|---|---|---|
| 1 | `Lightricks/LTX-2` `…/gemma/encoders/prompts/gemma4_t2v_system_prompt.txt` (blob `95fc9e8e`) | official-code (vendor rewriter, LTX-2.5) | 2026-10-23 | **The t2v spec.** Training-caption style; ~150-220 words; framing triple per shot (6 shot types, motion always stated, 7 viewpoints); "Camera movement is expected and good" (REJECTED, Fabio's 2.3 spec carries over); complete soundscape, dialogue quoted in its original language; observable only; people identified specifically, never by ethnicity/nationality/religion/culture; "Initially… / A moment later… / Simultaneously…"; one unlabelled paragraph; non-English in → English caption; closing AESTHETIC QUALITY pass. |
| 2 | same folder, `gemma4_i2v_system_prompt.txt` (blob `31f58e6c`) | official-code (vendor rewriter, LTX-2.5) | 2026-10-23 | **The i2v spec.** Everything in #1, plus FIRST-FRAME GROUNDING: the caption opens matching the reference image exactly (subjects, identity, clothing, setting, light, composition), shot type and viewpoint match the image's framing, then narrates the action; "Single continuous take — no hard cuts". |
| 3 | `Lightricks/LTX-2` `…/gemma/encoders/base_encoder.py`, `encoder_configurator.py`, `gemma_assets.py:162`, `tokenizer.py`, `ltx_pipelines/utils/helpers.py`, `utils/constants.py:186` | official-code | 2026-10-23 | gemma4 ↔ 2.5 selection; `TOKENIZER_MAX_LENGTH = 1024`, truncate + left-pad ≈ 768 words, so no encoder wall at our lengths; the vendor enhancer decodes gemma4 greedily (`max_new_tokens` 600). `DEFAULT_NEGATIVE_PROMPT` exists only for CFG pipelines; the distilled path we ship runs no guidance. |
| 4 | https://docs.ltx.io/open-source-model/usage-guides/prompting-guide | official-docs | 2026-10-23 | Read as a WebFetch summary, not verbatim. Single shot: one present-tense paragraph, 4-8 sentences. Multi-shot is **LTX-2.5 only**: one chronological paragraph, 2-4 shots, name each transition, re-establish framing, re-identify subjects, say whether audio continues; i2v prefers one continuous take. Duration predictor times the clip to the action written. On-screen text partly reliable; chaotic physics artefacts. No negative prompts. |
| 5 | https://ltx.io/blog/ltx-2-5-prompt-guide (2026-08-10) + https://ltx.io/blog/ltx-2-5-prompt-enhancer (2026-10-02) | official-docs | 2026-10-23 | Six-element order (shot, scene, action, character, camera, audio); hard cut / match cut / dissolve between shots; length follows COMPLEXITY (the 2.3 guide said duration). Enhancer = Gemma 4 E2B, optional, for short or rough prompts, not on the API. |
| 6 | https://runware.ai/docs/models/lightricks-ltx-2-5-pro/guides/prompting (2026-08-11) + `/guides/audio-driven` | provider-docs | 2026-10-23 | 5,000-character prompt cap; "a focused brief beats an exhaustive one"; audio-driven runs: describe the performance, not the words. |
| 7 | https://deapi.ai/blog/ltx-2-5-prompting-guide-multi-shot-scenes-native-audio-and-prompts-that-actually-cut (2026-09-04) | provider-docs / community | 2026-10-23 | Best failure list: emotion labels → neutral face; tag lists → nothing happens; labelled fields / shot lists → cuts ignored; open on the action (a subject-noun opener gives a near-static clip); "8K", "masterpiece" do nothing; ~2.5 spoken words per second; negatives ignored at CFG 1. Opinion unless stated. |
| 8 | https://huggingface.co/Lightricks/LTX-2.5/discussions/92 (2026-10-21) and /84 (2026-10-12), one author, distilled i2v | community-measured | 2026-10-23 | **#92:** naming something NOT in frame pulls it in (off-screen listener entered 6/10 clips; an out-of-shot light source pulled the camera off the face 4/7); after writing gaze direction and light only, 0/188 drifted. **#84:** in i2v, "static" held ~half the time; "very slow push-in" overshot to 1.3-2x zoom 5/5; the first+last-frame template hit the drawn end frame 6/6. |
| 9 | https://docs.comfy.org/tutorials/video/ltx/ltx-2-5 ; https://docs.ltx.io/open-source-model/usage-guides/image-to-video | provider-docs | 2026-10-23 | i2v: "describe what happens next" — CONFLICTS with #2 (see research.md Conflicts). The ComfyUI template hard-codes a negative "pc game, console game, video game, cartoon, childish, ugly" (a live-action push; irrelevant to our distilled graph). |
| 10 | https://fal.ai/learn/tools/how-to-use-ltx-2-5 (2026-08-18) | provider-docs | 2026-10-23 | Example prompts end on a labelled "Sound:" sentence — conflicts with #1 ("no labels like 'Audio:'"); #1 wins. |

Also read, low trust, not cited for any rule: jxp.com (2026-08-19), dreampixelforge.com (2026-08-11, upd.
08-29; "a good 2.3 prompt is a good 2.5 prompt" except multi-shot: opinion, contradicted by #1 vs the gemma3
file), theneuron.ai livestream recap (2026-08-14), ltx-23.org / ltx23.org (SEO farms), HF #36, #54, #57.

## Not found (searched)

No prompt-length A/B, no dialogue-quoting test, no scored enhancer on/off for 2.5. No Reddit threads from two
WebSearch phrasings (reddit.com not fetched directly). Nothing from Civitai, Replicate or WaveSpeed. The HF
model card body is gated (raw README → HTTP 401) and was not read.

Full texts of #1-#2 and the gemma3 pair, plus the community excerpts, were kept in the session scratchpad only
(internal provenance, not shipped).
