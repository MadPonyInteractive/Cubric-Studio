# MPI-1135 bench plan: Singularity H3 v2 and FastH3 Trim vs ours

Phase 1 is bench only (`G:\ComfyUi`, port 8188, ComfyUI v0.42.1). Nothing in the app changes
until each candidate has a verdict. Why and what to judge: `brief.md`. GPU runs go through the
GPU lease (`gpu_lease.py run`).

## Weights (pulled 2026-10-24)

| What | File | Size | Where |
|---|---|---:|---|
| Singularity H3 v2 (WarmBloodAban, the source repo) | `Minimax-h3_Singularity_ref2va_v2_pruned_int8.safetensors` | 20.97 GB | `M:\CubricModels\diffusion_models\bench-mpi1135\` |
| FastH3 Trim, int8 (FastVideo) | `fastvideo_fasth3_trim_8step_int8_convrot.safetensors` | 18.92 GB | same |
| LMS sharpness LoRA (Alissonerdx) | `minimax_h3_lms_v1.0_r64.safetensors` | 1.24 GB | `M:\CubricModels\loras\bench-mpi1135\` |
| Veda predictors, T2VA/FL2VA + R2VA | `minimax_h3_*_veda_*_fp8.safetensors` | 2 x 0.28 GB | `G:\ComfyUi\ComfyUI\models\veda\` |

Encoder, both VAEs, turbo LoRAs and the 3D latent upscaler are the ones we already ship (on M:).
Not pulled: `h3_upscaler_lms_v0.1` (0.69 GB), only if Step 0's arm 3 wins.

**Singularity is ONE transformer for every op** (Fabio, 2026-10-24: on purpose). Every file in
the repo is `ref2va`, and that one file does ref2v, i2v and t2v. We ship two (fl2va for
t2v / i2v, ref2va for references), so Singularity runs against BOTH: ref2v vs our ref2va,
i2v and t2v vs our fl2va. One model covering all three is a plus in itself: one 21 GB file
instead of two.
**Licence:** the source repo tags itself apache-2.0, but it is a fine-tune of H3, so the H3
Community Licence (territory clause) still binds it. The WAS re-host says exactly that. Treat it
as H3-licensed.

## Nodes to add to the bench (before the first run)

- `Comfyui-MMH3-UltimateUpscale` (bbaudio-2025, MIT): Step 0 arm 3.
- `Veda-on-ComfyUI` (veda-sparse, MIT): speed arms.
- FastH3 Trim needs no new node (core >= 0.36.0). VSA / Comfy Kitchen attention: check the
  model loader options on v0.42.1 first.
- Restart the bench after installing; check each class with `/object_info/<Class>` and read the
  BODY (an empty `{}` means absent).

## Fixed inputs (the same for every arm)

**Every prompt carries dialogue AND an environment bed** (Fabio, 2026-10-24: audio is half the
test). The character speaks the whole clip, with written lines in quotes, and the scene's sounds
are named: on the beach shots the sea, waves breaking, gulls, wind; in the city, traffic, distant
music, footsteps, impacts. A prompt with no lines or no named sounds is not a valid test prompt.

- **Shot A, run at the camera:** far -> medium -> close-up, talking the whole way, city bed.
- **Shot B, side tracking run:** jumps over obstacles, camera pushes in to the face at the end,
  talking, city bed + impacts.
- **Shot C, two characters at the beach (ref2v)** (Fabio, 2026-10-24): two full-body tattooed
  character sheets as references 1 and 2. They run into the sea and splash through the waves,
  talking to each other; waves, wind and gulls in the bed. Judges WATER dynamics (spray, wave
  break, wet skin) and **tattoo morphing**: dense full-body linework that must hold its pattern
  through the motion. Identity anchors to check: her pink-tipped black bob, his grey hair and
  brown leather crossbody bag. The sheets stay in Fabio's project and are NOT copied into this
  public repo:
  `C:\Users\Fabio\Documents\Cubric Studio\Projects\Qwen 2.1\Media\flowCharacterSheet_087.png`
  (woman), `...\flowCharacterSheet_084.png` (man).
- **Shot D, i2v walk-in** (Fabio, 2026-10-24): start image
  `C:\Users\Fabio\Documents\Cubric Studio\Projects\Qwen 2.1\Media\t2i_011.png` (also stays
  outside git): a woman in a coral bikini on a white-sand beach, full body, face small in the
  frame. She walks toward the camera until her face fills it, talking to the camera the whole
way, over waves, gulls and wind. Judges face morphing at a
  distance and identity held in the close-up against the start frame (dark curly hair, the
  pendant necklace). Portrait (~896x1088), so the i2v rows run portrait.
- Shots A and B run as t2v (no image): the fast-motion tearing test lives there and in Shot C.
- 2 seeds per shot. Length 4 s for every 2-5 s row. Prompts written once into
  `research/prompts.md`, never edited between arms.

## Run order

Each phase picks a winner the next one uses, so the model comparison is never judged through a
weak upscale.

| # | Phase | Arms | Clips |
|---|---|---|---:|
| 0 | Upscale, on our current H3 | none / ours (3D upscaler + windowed refine) / Benji's (MMH3 Ultimate Upscale + LMS 0.70 on the refine), Shots A + C | 3 x 2 shots x 2 seeds = 12 |
| 1a | ref2v, on the Step 0 winner | ours ref2va vs Singularity, Shot C | 2 x 2 seeds = 4 |
| 1b | i2v | ours fl2va vs Singularity vs FastH3 Trim, Shot D | 3 x 2 seeds = 6 |
| 1c | t2v | ours fl2va vs Singularity vs FastH3 Trim, Shots A + B | 3 x 2 x 2 = 12 |
| 2 | Speed, on the survivors | none / EasyCache / Veda / VSA / Veda + EasyCache (non-turbo only) | ~10 |
| 3 | 10 s skin pass | survivors only, late-clip plastic skin / overexposure | ~4 |
| 4 | 15 s VRAM run | the winner, once | 1 |
| 5 | Story draft resolution | the winner at 1344x768 vs one or two lower rungs, Shot A | ~3 |

Per clip, logged in `research/results.md`: seconds, VRAM peak, RAM peak, file size. Fabio judges
(he is the only one who can): tearing, hands, far faces, plastic skin, pacing, tattoo morphing
and water (Shot C), and AUDIO (bed
layered or smeared, voice clean, lips in sync), each against the no-LoRA baseline of the same
seed. Clips side by side for that, one comparison per phase.

## Time estimate

About 55 clips. At 4 s and turbo, ~1.5-3 min each with the upscale, so **roughly 2.5 GPU hours**
plus node installs. The slow part is judging: one look per phase, five looks in all. Two to
three sessions if the looks come quickly. That is short enough to land before the LTX 2.5
release; the app wiring of a winner (`/mpi-add-model`) is a separate job after the verdict.

## Where it runs: RunPod, RTX PRO 4500 + a bench volume (Fabio, 2026-10-24)

Too slow on the local 4060 Ti. Fabio chose a persistent volume over a fresh Pod per session
(a fresh Pod's setup is 10-15 min every time; the PRO 4500 has had HIGH stock in EU-RO-1).

- Volume `cubric-h3-bench`, id `l545j38pyx`, 150 GB, EU-RO-1. Separate from the dev volume.
  ~$0.35/day while it exists; Fabio deletes it when the card is done.
- Pod: `research/pod/create-pod.mjs` (plain `runpod/pytorch` image; `boot.sh` installs a cu130
  torch 2.12 venv, ComfyUI at the shipped pin, MpiNodes / LBH upscaler / MMH3 / Veda and all the
  weights ON the volume, then starts ComfyUI on 8188; later boots skip the installs). SSH on
  22/tcp with `~/.ssh/id_ed25519`. The Pod removes itself after `HARD_MIN` 240 min.
- RunPod key: `RUNPOD_ENV_FILE=C:/AI/Mpi/cubric-remote-wrapper/.secrets/runpod.env`. Git Bash
  rewrites a `/path` argument into a Windows path, so `rp.mjs` calls need `MSYS_NO_PATHCONV=1`
  (that, not the API, was the 404s).
- Results are timed on the Pod (32 GB); only the winners get re-timed on the 4060 Ti.

## Current State (2026-10-24, handoff)

- Done: weights local (sha256 checked), MMH3 + Veda on the local bench, volume created.
- A first Pod (`3w2newbmjbr3aq`) booted ~5 min and was deleted for the handoff (~$0.06). Its
  half install may sit on the volume; `boot.sh` wipes a venv / ComfyUI with no done-marker.
- Next: rent the Pod, watch `watch.mjs` to COMFY_READY, check the nodes load (`/object_info`
  BODY, not status), the weights are listed, and Triton imports (Veda). Then write
  `research/prompts.md` (lines + named sounds in every prompt), then Step 0.
- Budget: $3-5 Pod time approved in total; ask before going past it.

## Output

A verdict per candidate in `validation.md`: replace / add / drop, with the evidence.
