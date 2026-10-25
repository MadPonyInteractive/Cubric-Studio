# MPI-1135 validation

## Step 0: upscale arms on our H3 (2026-10-25, Fabio)

Side-by-sides: `C:/AI/Mpi/_private/mpi1135-clips/sbs/` (`step0_<shot>_<seed>.mp4` full,
`_detail.mp4` middle 640 px per panel at true pixels; three passes, one per arm's audio).
Times and VRAM: `research/results.md`.

| arm | Shot A s (seed 1/2) | Shot C s (seed 1/2) | verdict |
|---|---|---|---|
| none | 125 / 127 | 162 / 164 | **wins on quality at 1344x768**: less tearing, fewer texture errors (Fabio, 3 of 4 judged) |
| ours | 114 / 113 | 115 / 94 | fastest; drafts at 672x384, which is the likely source of its tearing at this size |
| benji (MMH3 + LMS 0.70, denoise 0.30) | 140 / 142 | 210 / 210 | "absolute crap in every one" |

- Fabio: ours pushed to 2K output beats everything on quality. 2K ours drafts at 1344x768,
  the same as none, so the expected product shape is **none as the draft, ours's 3D upscale +
  refine as an optional "2K" step on the SAME draft** (not yet verified that the two drafts are
  identical, nor that the 2688x1536 refine fits 32 GB: the bugged first none run did it and
  failed at 31.1 GB). 4K: open, likely a pixel-space or tiled upscaler.
- Benji gets one more go in Phase 1, the way he runs it: **on Singularity H3**, refine denoise
  **0.485** (Fabio's read of his workflow). Fabio's risk: identity likely dies at that strength.
- Fabio (2026-10-25): the Upscale Video Flow needs a new version, with an H3 variant and an
  LTX 2.5 variant (may deprecate LTX 2.3's). Because H3's upscaler works on latents, his lean is
  2K / 4K as a resolution choice on the H3 generation that triggers the upscale stage. The
  Flow-vs-ours-at-2K test is NOT run unless he asks for it during the tests.
- Shot C seed 2 (Fabio): ours about as good as none and much faster. The ours graphs for the
  two seeds differ only in the seed (diffed), so the quality match is seed luck. The time is not:
  ours seed 1 (115 s) was the first ref2va clip and paid the model switch from fl2va; seed 2
  (94 s) is ours's real speed on Shot C, against none at ~163 s.
  Even there, **motion is still better on none** (Fabio). So none wins every Step 0 look on
  quality or motion; ours only wins speed.
- **Step 0b verdict (Fabio, 2026-10-25): benji DROPPED, no more runs.** Both 0.485 runs (our
  model and Singularity) were bad. His own videos look better than ours, so our copy of his setup
  is likely wrong or incomplete, not his method. Only the upscale phase was his: our stage 1
  stayed the shipped one (half-size draft at 672x384, ~0.26 MP, turbo 8 steps), while his refine
  targets 1.5-2.0 MP (brief.md) and his Veda run drafted at 0.7 MP (whether his upscale run
  used the same draft size is unconfirmed). Tile size (512) was our pick, and the setup
  came from a screenshot, not his workflow file.

## Benji's real workflow vs our copy (2026-10-25)

Source: `MinimaxH3_R2V-2Stage-VEDA.json` (Fabio's download, kept at
`C:/AI/Mpi/_private/mpi1135-benji/`, outside git). Traced link by link. Our "benji" arm copied
only the upscale node; everything that feeds it differed:

| | ours ("benji" arm) | Benji's file |
|---|---|---|
| Model | ours ref2va / Singularity **v2** | Singularity **v1.3** int8 (note in the file points to a fl2va+ref2va hybrid for normal use) |
| Turbo | 8-step ref2v turbo v1.0, beta 10, euler | **4-step ref2v turbo v0.1** at 1.0, beta **8**, res_multistep, shift 12/3 |
| Extra LoRA | none | **realism-people `r34l1sm` at 0.7**, trigger `r34l1sm , ultra realistic video.` prefixed to every prompt |
| Draft size | **672x384** (0.26 MP) | **1152x640** (0.7 MP) |
| Final size | 1344x768 | **1664x928** (1.5 MP) |
| Refine model | base model, **turbo OFF** (our shipped switch), shift 12/0.5, + LMS 0.70 | the **whole stage-1 chain, turbo ON** + realism + Veda, shift 12/3, + LMS 0.70 |
| Refine steps | beta 2, denoise 0.30 (Step 0b: 0.485) | beta 2, denoise **0.30** |
| Spatial tiles | 512x512 (our pick) -> 6 tiles with seams | tile = the full output size -> **one tile**, no spatial split |
| Temporal anchor | 1.0 | 0.999 |
| Refs | as uploaded | resized to the draft size with `nvidia_rtx_vsr` (ref 1 crop, ref 2 1024 pad) |
| Speed/memory | none | Sage attention, Veda sparse attention, chunked feed-forward, tiled VAE decode |
| Length | 4 s | 15 s |

Most likely causes of our bad benji clips: a 2-step refine on a NON-turbo model (cannot finish
denoising in 2 steps), 512 tiles (the dotted / grid texture), and a 0.26 MP draft. His 0.30 is
the denoise, so Step 0b's 0.485 was further from his setup, not closer. The realism LoRA and its
trigger are part of his look and are not in anything we ship (licence unknown).

## Phase 1: Singularity v1.3 vs ours, none vs ours-upscale, prompt sections (2026-10-25, Fabio)

Side-by-sides `C:/AI/Mpi/_private/mpi1135-clips/sbs/p1_<shot>_<seed>` (Sing none | ours none |
Sing +up | ours +up) and `p1prompt_{sing,ours}_<seed>` (Shot C | stripped `Cb` | sections `Cs`),
judged on the `_detail` files. 32/32 clips ok, numbers in `research/results.md`.

- **Upscale route:** fine on low action (Shot D, the woman walking up to the camera), where it
  looks the same as no upscale. On fast motion, **no upscale wins every time.**
- **Model:** on fast motion **Singularity v1.3 wins by a small margin every time.** Same render
  speed as ours on every shot.
- **Identity (Cs vs Cb vs C):** hard to judge, because the characters face away and are only seen
  in profile at a distance. But **sections win clearly on wardrobe and props**: with sections the
  man ALWAYS has his bag and shoes, and the bag swings like a real object. Stripped (and sometimes
  the normal prompt) loses the shoes, swaps the bag for something else, or fuses it to his body.
  Only sections keep the back of her bikini. To Fabio's eye, sections also tear the tattoos and hair less.

**Verdict (Fabio):**
1. **Always prompt with sections** (`subject_definitions` + `retention_analysis`, visible
   traits only) in reference mode.
2. **Singularity v1.3 is better than our H3**: replace.
3. **New "Fast Motion" control** next to Turbo: when ON, skip our upscale route and render with the
   no-upscale path. 2K / 4K still upscale, but only when the user goes above 1080x1920.

Not checked: whether sections help FACE identity (no frontal close shot in Shot C), and the EasyCache
skip lines (this run's ComfyUI output never reached `boot.log`).

## Phase 1b: Singularity v1.3 vs v2, Shot B, no upscale (2026-10-25, Fabio)

Side-by-sides `sbs/p1b_B_<seed>{,_detail}` (v1.3 | v2), 4/4 ok, same speed (v2 128/86 s, v1.3
123/86 s). **Verdict (Fabio): v2 wins.** Phase 2 speed arms run on v2 only. MPI-1284 ships v2.

## Phase 2: speed arms on v2, Shot B, no upscale (2026-10-25, Fabio)

Side-by-sides `sbs/p2{turbo,full,fullec}_B_<seed>{,_detail}`, 18/18 ok. Warm (seed 2) times: turbo
base 85 s / sol 72 / Veda 71; non-turbo base 246 / EC 212 / sol 190 / sol+EC 173 / Veda 201 / Veda+EC 181.

**Verdict (Fabio):**
1. **Veda is out** ("absolute shit"), and it needed Triton anyway.
2. **sol-attn (core `BlockSparseAttention`) looks BETTER than without it**, not only faster: always on.
3. Non-turbo ships **sol-attn + EasyCache** (-30%); turbo ships sol-attn (-15%).

## Phase 1c: v2 on i2v (Shot D) and ref2v (Shot Cs)

Side-by-sides `sbs/p1c_{D,Cs}_<seed>` (ours | v1.3 | v2). **Verdict (Fabio): v2 holds up** on i2v and ref2v. MPI-1284 ships v2 for every op.

## Phase 1d: realism-people LoRA on the plastic-skin clip (2026-10-25, Fabio)

Shot D seed 1135001 (her skin turns oily/plastic as she walks up to the camera), v2, no upscale: the
p1c clip vs the SAME graph + `fal/MiniMax-H3-Realism-People-LoRA` at 0.7 (Input_Lora_1) + trigger
`r34l1sm , ultra realistic video.` (`step0/build_p1d.py`). Ran on the LOCAL bench (RTX 4060 Ti, 332 s,
VRAM 15.0 GB). Side-by-side `sbs/p1d_D_1135001` (v2 | v2 + LoRA; true pixels already, no `_detail`).
**Verdict (Fabio): REJECTED.** The LoRA turns image-to-video into reference-to-video: the first frame is NOT the start image (new background, sea, gulls), and the skin is no better. Next: online research for other skin-fix LoRAs (two sub-agents).

## Phase 1e: 8 s Shot D, prompt wording + Cinematic V2 (2026-10-25, Fabio)

Pod, seed 1135001, v2, turbo, 8 s (`step0/build_p1e.py`), sbs `sbs/p1e{prompt,lora}_D_1135001`.
The 8 s single-pass clips LOST the i2v start frame (the 4 s p1c clip and the upscale-route clips kept it).
**Verdict (Fabio), prompt set:** + "Photorealistic, natural lighting, realistic skin texture" slightly best,
then the same with the "no cartoon or overly-CG rendering" line removed, then base. **Not a noticeable
improvement.** A fixed "Photorealistic" cannot ship anyway: the style word must follow the shot's own
style (animation, cartoon, anime, 3D CGI); same for the CG negation. For MPI-1284's prompt guide.
**Verdict (Fabio), Cinematic V2 at 0.85:** on the refine stage only (upcine) not noticeable, may need MORE
strength there; on stage 1 (cine) overcooked, 0.65-0.70 is probably right.

### Phase 1e start-frame test (2026-10-25)

`p1e_{s2,s13}_strip_D_1135001`: the 8 s base prompt minus its look line ("The supplied frame shows a
woman ... white-sand beach: bright turquoise ...") and minus "gulls calling over the water". **Both v2
and v1.3 now open on the real start image** (driftwood, grass); the base prompt opens on a generic
turquoise beach with gulls. Cause found: on i2v, **words describing what the picture shows override the
picture** (HF discussion #32's report, and our own guide's rule, docs/agent/models/minimax-h3.md:87,
which the bench prompt broke). The Phase 1d People-LoRA rejection used the same prompt, so it is
confounded. Feeds MPI-1284 (prompt guide) and MPI-1285 (single pass).

### Phase 1e final verdict (Fabio, 2026-10-25)

**No LoRAs.** Every LoRA tried on Singularity lost the i2v first frame, so a user's own LoRA would make
i2v a lottery: **Singularity is not an image-to-video model.** Decisions: **MiniMax H3 (fl2va) stays**
(only gains sol-attn; non-turbo sol-attn + EasyCache); **MiniMax H3 Reference keeps its name, its base
model becomes Singularity v2** (ours was the weak one, more tearing); **Fast Motion lands in H3 Reference
only**; nothing is deprecated. The tested LoRAs are deleted. Cards updated: MPI-1284, MPI-1285, MPI-1286.
