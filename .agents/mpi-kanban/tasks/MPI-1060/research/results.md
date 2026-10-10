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

## Open

- Fabio's eye-test on both clips (face identity, audio).
- One run on a sheet of ours (MPI-1041 character sheets are the obvious source; the LoRA wants black background,
  face close-up + turnaround panels, no text).
- H3 comparison: paid / heavier, ask first.
- If kept: lands as a branch of `comfy_workflows/ltx_i2v_t2v_int8.json` (new op on the LTX 2.3 model), never a new
  model workflow. The ref sheet enters as `RepeatImageBatch` -> `LTXAddVideoICLoRAGuide`, guides cropped before decode.
