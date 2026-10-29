# MPI-1348 results

| arm_seed | result | render s | peak VRAM MiB | MB | error |
|---|---|---|---|---|---|

## Setup findings (2026-10-29, before any run)

- The shipped fl2va stage 2 is ALREADY a 3-step euler cfg-1 windowed refine after the 3D latent upscaler (nodes 419 -> 532, sigmas 0.9035/0.6316/0.3158/0). The NVIDIA pass is the same shape, so the test is: add the LoRA to the refine model (518 <- 9001 <- 460) and swap the sigmas to 0.909375/0.857143/0.666667/0. docs/models/h3/README.md still says stage2 is "1 (15-step)" at line 212 - stale, worth a doc fix.
- The official merged LoRA (rank 576, 12.45 GB) already FOLDS IN the fl2v turbo 4-step v1.2 LoRA (alpha/rank 0.0625) and the LMS sharp LoRA (lora/lora_config.json). Kijai's rank-384 (5.87 GB) is an extraction of it. So no turbo LoRA may be stacked on the refine in the regen arm.
- sharp_curve_branches.safetensors (1.24 GB) is NOT a LoRA: 50 branches driven by an 8-D timestep curve from the base model's adaln_t_table. A native LoRA loader cannot apply it; it needs the custom pack we excluded. Out of scope.
- Licence: HF card says minimax-h3-community, not gated.
- Bench card is an RTX 4060 Ti 16 GB, so every run here IS the 16 GB question.
| ship_1348001 | ok | 1125 | 15769 | 13.8 |  |
| regen_1348001 | ok | 859 | 15632 | 27.1 |  |

## Seed 1 verdict (2026-10-29, RTX 4060 Ti 16 GB, 5 s, 124 frames, out 2560x1408)

- Both arms ran on 16 GB, no OOM; peak whole-card VRAM 15.8 / 15.6 GB (dynamic loading fills the card, not a ceiling).
- Refine time is the SAME: 6 refine steps (2 windows x 3) at ~127 s/it = ~12.7 min in both arms. No speed win; the video's "faster" was against his own longer second stage. ship total 1125 s includes stage 1 (~4.5 min); regen 859 s is refine + decode only (stage 1 loaded).
- Detail: regen is clearly sharper. Background faces readable, knit texture, less motion smear; bitrate 2x at the same encoder settings (43.9 vs 22.2 Mb/s). Slightly darker / more contrast (LMS sharp folded in).
- **IDENTITY DRIFT: regen redraws the subject.** Same draft latent, but her face changes: freckles (in the prompt) gone, older and rounder face, darker hair. The shipped refine keeps the draft's face. For character work (Story, references, Video Edit) this is a blocker as is. Sheets: sheets/crop_far.png, crop_face.png, sbs_s1_t*.jpg.
- Suspect: NVIDIA's sigmas stay above 0.66 for two of three steps (more redraw) vs shipped 0.90 -> 0.63 -> 0.32. Queued: regenshsg (LoRA 1.0, shipped sigmas) and regen50 (LoRA 0.5, NVIDIA sigmas).

**Fabio's eye verdict (2026-10-29):** the shipped refine (left) is "way better" for the main character. regen as NVIDIA ships it LOSES. Seam runs pulled from the GPU queue: they only matter if an identity variant (regenshsg, regen50) keeps the face; re-queue them then.
| regenshsg_1348001 | ok | 870 | 15757 | 24.2 |  |
| regen50_1348001 | ok | 829 | 15987 | 22.5 |  |

## Identity variants, seed 1 (2026-10-29)

Sheets: sheets/crop_face4.png, crop_far4.png, order ship | regen | regenshsg | regen50.

- regenshsg (LoRA 1.0, SHIPPED sigmas): face STILL changes, same way as regen. So the sigmas are not the cause: the LoRA itself redraws identity. 870 s.
- regen50 (LoRA 0.5, NVIDIA sigmas): keeps the face (freckles, red hair, face shape) close to ship. Crowd detail looks only marginally above ship - the big sharpness gain went with the identity. 829 s, 15.99 GB peak, bitrate close to ship.
- Reading: the detail and the identity drift come from the same LoRA strength. At full strength it sharpens by repainting; at half it is close to the shipped refine.
