# MPI-1060 results - LTX 2.3 Ingredients IC-LoRA on the bench

2026-10-10. Bench `G:\ComfyUi` (:8188, ComfyUI 0.39.0, ComfyUI-LTXVideo at the shipped pin 3b9c5cd), RTX 4060 Ti 16 GB,
under `gpu_lease.py`. Graph: `bench-tools/ingredients_run.py` = the official
`LTX-2.3_ICLoRA_Ingredients_Single_Stage_Distilled.json` example with OUR shipped loaders (int8 distilled transformer,
Gemma 3 fp4 + projection, LTX23 video/audio VAEs). LoRA `ltx-2.3-22b-ic-lora-ingredients-0.9.safetensors` (1.31 GB,
gated repo, auto-approval) at strength 1.0, no distilled LoRA (our transformer is already distilled).
Weights live in `C:\AI\{diffusion_models,text_encoders,vae,loras\LTX2.3}` (G: had no LTX 2.3 base weights left).

## Runs (Lightricks' example sheet + prompt, seed 42)

| case | size | frames | wall time | result |
|---|---|---|---|---|
| ex_bucket | 768x448 | 121 (5 s) | 145 s incl. cold load | runs; all six sheet elements present; yak dominates the frame |
| ex_official | 960x544 | 241 (10 s) | 558 s | runs; strongest match: building (blue trim, red door, yellow valance), yak blanket + stirrups, backpack, stick, outfit, braids |

Both have an audio track with speech-shaped gaps (mean -30 dB, peaks -11 dB); words not checked.
Clips: `C:\AI\MPI-1060-out\` (mp4 + VP9 webm previews).

## Read so far (agent eye, not Fabio's)

- Our int8 distilled stack works with the LoRA as-is: no dev checkpoint, no distilled LoRA needed.
- Props and location carry over well. The woman keeps outfit, braids and build; her FACE reads younger and softer
  than the sheet's close-up in the last seconds. Identity is "same type", not yet proven "same person".
- 960x544 / 10 s is past the trained bucket and still looked better than the bucket run on this sheet.

## Our sheets + combinations (960x544, 121 frames, seed 42, sheet letterboxed in black)

MPI-1041/1042 3-panel character sheets (front | back | 3/4 close-up, grey background), two-part prompt in the
example's `### Reference Sheet Description` / `### Target Description` shape. Each case mirrors how the SHIPPED
graph wires the extra input (`bench-tools/ingredients_run.py` docstring).

| case | extra input | time | result (agent eye) |
|---|---|---|---|
| own_woman | none | 228 s | hair, jacket, mustard sweater, build all hold; cafe scene as prompted; face "same type", softer freckles |
| combo_start | start frame = her original cafe photo (LTXVImgToVideoInplace before the IC guide) | 204 s | composes cleanly: opens on the photo, identity holds through the clip |
| combo_audio | supplied voice (Input_Audio path, influence 0.9) | 222 s | audio KEPT: pauses at 1.60-2.20 / 2.99-3.69 s vs input 1.64-2.23 / 3.04-3.73 s; she talks to camera, freckles strong; lip-sync for Fabio's ear |
| combo_idlora | voice clone (talkvid ID-LoRA after Ingredients LoRA + LTXVReferenceAudio 1.5) | 333 s | runs, both LoRAs at 1.0; new speech pattern (generated, as intended); voice match for Fabio's ear; a blurred foreground person ("someone off camera") |
| own_fisher | none (3D stylised sheet) | 226 s | style and outfit hold; **the back-view panel leaks as a second figure for ~1 s** at the start |
| ref_video | a real clip (ex_official, first 121 frames) as the guide, new seed | 236 s | **a near-frame-for-frame COPY of the guide clip** (same framing, yak, motion; only a small haze at the start). A moving reference is not a reference to Ingredients: it reproduces it. Video refs = no. |

Answers so far: Ingredients is an IMAGE (sheet) adapter by training. Start frame, supplied audio and voice clone
all compose with it mechanically through the shipped graph's existing paths. Back-view panels can leak as an
extra figure (sheet layout matters: the LoRA was trained on face close-up + turnaround, props, location).

## Two-stage proof on the SHIPPED graph (`bench-tools/two_stage_run.py`, 2026-10-10)

The shipped `comfy_workflows/ltx_i2v_t2v_int8.json` with the plan's insertion spliced in at API level (nodes 900-915),
all shipped weights under their shipped names (`C:\AI\loras\ltx-2.3\...`). 960x512, 5 s (120 frames), seed 42, sheet
`mpi1042art_cafe2_sheet.png` (3-panel, grey), the own_woman prompt. Under `gpu_lease.py`, two lease chunks.

| case | graph | time | result |
|---|---|---|---|
| ts_ref_A | stage-1 guide + stage-2 guide (lipdub pattern) + crop before decode | 170 s | sheet holds: hair, jacket, mustard sweater; **freckles and smile lines carried at full res** |
| ts_ref_B | stage-1 guide only, IC model at stage 2 (inpaint pattern) | 50 s (stage 1 cached from A) | same framing and motion as A; **freckles fade, face smoother** at stage 2 |
| ts_ref_start_A | A + start frame (her cafe photo) | 126 s | opens on the photo, identity holds to the end |
| ts_t2v_shipped / ts_t2v_A | no sheet, shipped vs patched | 101 s / 70 s | **byte-identical mp4** (framemd5 equal, 355 packets) |
| ts_i2v_shipped / ts_i2v_A | start frame, no sheet, shipped vs patched | 95 s / 70 s | **byte-identical mp4** |

**Pick: variant A** (stage-2 guide re-added on the upsampled latent, `LTXVCropGuides` before decode). B saves the
stage-2 IC frames but loses exactly the fine detail the sheet exists to carry. No-sheet runs are byte-identical, so
the fill-driven branch (everything keyed off `Input_Image` `loaded`) is a true no-op when unused: t2v/i2v unchanged.
The patched no-sheet runs were faster only because the Gemma encode was cached from the shipped run.
Previews: `C:\AI\MPI-1060-out\ts_ref_A_vs_B.webm` (A left), `ts_ref_start_A.webm`.

## Phase 2b layout bench: several pictures composed into one sheet (`bench-tools/layout_run.py`, 2026-10-10)

Two-stage variant-A graph, 960x512, 5 s. Pictures: our 3-panel sheets (woman, 3D fisher), Lightricks' backpack +
mountain cells cropped from their example, a storybook village (MPI-1038). Rows like the example: characters on top.
Two composers: **grid** = justified rows centred on black (big black margins round narrow rows), **fill** = cells
tile the whole canvas edge to edge, each picture CONTAINED on a grey card, black only in 12 px gutters.

| case | layout / preamble | seed | result |
|---|---|---|---|
| lay_fisher_raw | the sheet as-is, village in words only | 42 | no leak; generic village (the words alone) |
| lay_fisher_grid | grid: sheet + village picture | 42 | works: storybook cottages, well, cobbles from the picture; no leak |
| lay_fisher_noback | grid: front + close-up (no back view) + village | 42 | works, wider shot; no leak. The back view is not the leak's cause here |
| lay_woman_grid | grid: sheet + mountains + backpack, full descriptions | 42 | **FAIL: the clip COPIES the sheet's layout** (split screen of panels on black) |
| lay_woman_grid_s7 | same | 7 | **FAIL again**, same copy |
| lay_woman_fill | fill, full descriptions | 42 | **works**: full-frame hike, identity holds, blue framed backpack, the peaks |
| lay_woman_fill_s7 | same | 7 | **works** |
| lay_woman_tags | grid, preamble = "Top Row: Picture 1." only, short tagged prompt | 42 | **FAIL**: ~2.5 s of a web-page collage with literal "2"/"3" cards, then a hard cut to a correct hike |

| lay_woman_tags_fill | fill, "Top Row: Picture 1." only | 42 | **FAIL**: ~1 s of web-page collage, then the hike; her face weaker |
| lay_woman_roles_fill | fill, role + two words ("the woman", "the backpack") | 42 | no collage; character holds; **backpack lost** (a generic green one) |

**Rules found:** (1) never leave big black areas: the composer must TILE the canvas (fill), black only in thin
gutters. (2) a preamble that names pictures without describing them gets drawn as a UI collage; two-word role labels
avoid the collage but drop the prop. **Each picture needs a real description** (agent / enhancer written).

### Packing for pixel use (Fabio: "way too much empty space", Google-Photos-like)

The fill sheet above puts pictures on only **58%** of the canvas. `compose_pack()` searches every slicing tree
(side by side / stacked, nested; justified rows are a subset), stretches the winner to the canvas, and scores
coverage x fairness (no picture under 60% of its fair share, characters count double) x a character floor
(characters >= 45% of the sheet). A SETTING may be centre-cropped (>= 60% kept) to fill its cell; characters and props
never are. Fabio: a prop sheet carries three views (front, side/three-quarter, back), never four.

| case | sheet | fill | result |
|---|---|---|---|
| pack_woman | her sheet SPLIT into front / close-up / back cells + cropped mountains + 3-view backpack | ~80% | **FAIL: the back-view cell became a SECOND woman** (wearing the backpack); backpack itself perfect |
| pack_fisher | fisher split into front / close-up + village | 87% | works (village from the picture, character right), but letterboxed with black bars |

| pack_woman_whole | her sheet WHOLE + mountains (cropped to fit) + 3-view backpack | 76% | **works**: one woman, blue framed backpack with the leather patch, the path from the picture, identity holds |
| pack_fisher_whole | fisher sheet whole + village (cropped to fit) | 79% | **works**: the storybook village from the picture, character holds, no bars |

Rule (3): a character stays in ONE cell with all its views (Lightricks' layout); never split a sheet into views.

**Composer = `compose_pack()` on WHOLE pictures** (76-79% vs 58%; the remaining grey is the pictures' own studio
background and contained-cell edges). Cells named for the preamble from their centre (`where()`: "Left Panel",
"Top Far Right Panel"). Previews: `C:\AI\MPI-1060-out\pack_whole.webm`.

## Open

- Fabio's eye-test on both clips (face identity, audio).
- One run on a sheet of ours (MPI-1041 character sheets are the obvious source; the LoRA wants black background,
  face close-up + turnaround panels, no text).
- H3 comparison: paid / heavier, ask first.
- If kept: lands as a branch of `comfy_workflows/ltx_i2v_t2v_int8.json` (new op on the LTX 2.3 model), never a new
  model workflow. The ref sheet enters as `RepeatImageBatch` -> `LTXAddVideoICLoRAGuide`, guides cropped before decode.
