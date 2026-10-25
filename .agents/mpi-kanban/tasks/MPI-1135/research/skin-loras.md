# H3 plastic / oily skin: LoRAs and fixes found online (2026-10-25)

Two research sub-agents (HF + GitHub; CivitAI/CivArchive + community). CivitAI itself returned 403, so
CivitAI items come from CivArchive mirrors. Nothing below has a skin A/B or a proven i2v first frame.
Rows marked (checked) were confirmed by the main session on the source page.

## The lead: the turbo LoRA may be the cause

- amirjan122222/MiniMax-H3-Turbo-Lora card (checked): training paused because of "plastic-looking skin
  and over-sharp grain/noise" (a 4-step turbo, apache-2.0).
- Singularity v2 card (checked): v2 "reduces excessive skin shine and unnatural glossy textures"; it
  recommends `minimax_h3_ref2v_turbo_4step_v0.1`. Discussion #7: "Makes everything look too turbo distilled".
- Prompt Mastery's RunningHub "most realistic skin" workflow (on Singularity, creator claim): single pass,
  no upscale ("upscaling makes skin oilier"), acceleration LoRAs cause the oiliness, 8-step turbo v1.0
  gives less skin detail than its EMA-600 checkpoint. Prompt: "dry matte skin, visible pores, peach fuzz,
  faint freckles, slight unevenness"; avoid "flawless, glow, dewy, shimmer, highlighter, wet skin"; no
  negated wording ("no oily skin" makes it oily). https://www.runninghub.ai/post/2104471397757386753/
- Shot D (p1c/p1d) ran with turbo ON (8-step v1.0).

## LoRA candidates (all unverified on skin, i2v first frame unknown unless said)

| LoRA | What | Licence | Note |
|---|---|---|---|
| TuTu_1018 "Minimax H3 Cinematic V2" civarchive.com/models/2890588 | cinematic texture incl. skin, 0.85, no trigger, 148 MB | not shown | most skin-aimed, mild style |
| prithivMLmods/MiniMax-H3-Facial-Realism-CloseUp | face micro-detail, trigger "Facial Realism:" | H3 Community | experimental, talking heads only |
| RunningHubAI/rh-minimax-h3-digicam-realism-improve-lora | camera noise / grain, 148 MB | "follow upstream" | masks, does not fix |
| CinemaGrade civarchive.com/models/2927223 | grade, fl2va, 68 MB | free, NON-commercial | author: photoreal start frame "mostly reinforced" |
| Polyhedron Perfect Skin civarchive.com/models/2899220 | t2v only, 0.4-0.6 | not shown | overtrained per author |
| siraxe 3d_to_real_detail_slider_H3 | 3D -> real slider, t2v | not stated | |
| fal Realism People | REJECTED (Phase 1d): replaces the i2v first frame, no skin gain | H3 Community | |

## Not for single clips, but for chained clips (Story / Infinite Video)

- Imagineer13/H3-Anti-Burn-LoRA (checked): stops face burn building up over chained continuation clips,
  0.5-0.6, H3 Community licence, "Don't use it on clip 1". 10-clip chain before/after on the card.

## Singularity model card on prompting vs ours (read 2026-10-25)

Card: https://huggingface.co/WarmBloodAban/Minimax-h3_Singularity (V2 section at the top + Usage Guide).
Ours: `docs/agent/models/minimax-h3.md`, `js/data/recipes/minimax-h3.recipe.js`.

- NEW for us: V2 wants an explicit STYLE KEYWORD (photorealistic / East Asian realism / 3D CG /
  cinematic CG). Its photoreal example: "Photorealistic style, natural lighting, realistic skin texture, ...".
  Our look line asks for "subject and style" but names no style word; Shot D has none.
- CLASH: our constraint line ends every prompt with "no cartoon or overly-CG rendering". With no
  negative channel that puts "CG" in the prompt, and V2 strengthened CG as a style keyword. Our own
  guide already says a negation adds the word; the card says avoid conflicting styles.
- Same: clear subject / action / setting / lighting / camera; describe action sequences clearly.
- No clash: <= ~5,000 characters, no repetition (ours runs 60-200 words). Sections (Cs) restate traits
  but won the Phase 1 test, so they stay.
- Turbo: card recommends 4-step v0.1; we keep 8-step v1.0 (4-step tested worse in this bench).
- Untested claim: V2 audio references can adjust the character colour tone.
