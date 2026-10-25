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

## Current State (2026-10-25)

- Volume is FILLED and verified: venv (py3.10, torch 2.12.0+cu130, triton 3.7.0), ComfyUI at the
  pin, all four node packs loading (1145 classes: MpiNodes 137, MMH3 14, LBH 5, Veda 1), all 14
  weights at full size, no `.aria2` leftovers. A GPU Pod now boots to COMFY_READY in ~2-3 min.
- `research/prompts.md` written (A-D, lines + named sounds, seeds 1135001/1135002, 4 s).
- Step 0 graphs: `research/step0/build_step0.py` writes 12 API graphs from the SHIPPED
  `minimax_h3_fl2va.json` (Shot A) / `minimax_h3_r2va.json` (Shot C) at 1344x768, stage-1 turbo.
  `none` = stage-1 halving maths set to full size, preview output only; `ours` = shipped;
  `benji` = `MMH3UltimateUpscale` on the stage-1 latent (chunks 85/17, anchor 1.0, LBH 3D
  upscaler, 512 tiles 128/32, min 256, linear) with LMS 0.70 on the refine model, euler/beta
  2 steps denoise 0.30. Benji's tile size was not in the brief: 512 (the node default) is a pick.
  `check_graphs.py <url>` validates against `/object_info` (passed on the local bench);
  `run_graphs.py <url> <clipdir> <graphs...>` uploads the refs, runs, logs `results.md`.
- 2026-10-25: Pod 1 `e3s7unjly7j3ms` (weights on the volume, 372 s/clip) terminated. Pod 2
  **`zb86nk40jri923` is RUNNING** (150 GB container disk, weights copied to `/root/models`;
  SSH `ssh -i ~/.ssh/id_ed25519 -p 44446 root@213.173.109.44`, log `/workspace/bench/boot.log`).
  It removes itself 240 min after boot (~05:25 local, 2026-10-25). ComfyUI on it was started by
  hand (boot.sh's bare `wait` hung on the HARD_MIN timer; fixed in boot.sh since).
- Step 0 is being fed by `run_graphs.py` running in the "H3 Singularity 3" session (left open):
  rows land in `research/results.md`, clips in `C:/AI/Mpi/_private/mpi1135-clips/`
  (log `C:/AI/Mpi/_private/mpi1135-step0b.log`). Done so far, Shot A seed 1: ours 114 s, none
  125 s, Benji 140 s; ours seed 2 113 s. Order: rest of fl2va Shot A, then ref2va Shot C x6.
- 2026-10-25: **Step 0 DONE**, all 12 rows in, Pod 2 gone (RunPod lists no Pods). Side-by-sides
  built by `research/step0/build_sbs.sh` (full + `_detail` true-pixel crop, render times on the
  labels, three audio passes). Fabio's verdict in `validation.md`: none wins at 1344x768, benji
  bad, ours at 2K best overall.
- 2026-10-25 Step 0b (Fabio): Benji's arm at refine denoise **0.485**, Shot C, 2 seeds, on our
  ref2va and then on Singularity, nothing else changed (`step0/build_b485.py`, graphs
  `b485_{ours,sing}_C_<seed>`). Pod 3 **`2u50xc8wdze96k`** booted 01:23 GMT (COMFY_READY in
  ~6.5 min), `HARD_MIN=90` (create-pod.mjs now reads HARD_MIN from the env). Local bench is held
  by a peer, so graphs were checked against the Pod's /object_info. Side-by-sides:
  `build_sbs.sh <dir> b485` -> none | benji .485 ours | benji .485 Singularity.
  Ran 4/4 ok (ours 208/174 s, Singularity 195/173 s); Pod 3 DELETED 01:42 UTC (~20 min,
  ~$0.25). Side-by-sides sent; Fabio's verdict pending. Spent so far ~$1.75 of $3-5.
- Next (handoff 2026-10-25): **start the Phase 1 Pod** (Fabio approved starting it in a new
  session; ~65 min, ~$0.80, ~$1.75 spent so far of $3-5). `create-pod.mjs` with `HARD_MIN=90`,
  wait for /system_stats, `check_graphs.py <url>` (local bench is held by a peer), then
  `run_graphs.py <url> C:/AI/Mpi/_private/mpi1135-clips graphs/p1_*.json` in build_phase1.py's
  printed order (Singularity first, then ours). Grep the Pod's ComfyUI log for EasyCache skip
  lines on the ours-arm Shot C runs. Terminate, then side-by-sides (extend `build_sbs.sh`:
  none | ours per model, and Singularity vs ours per arm) for Fabio's look.
  Open offer to Fabio, unanswered: add a Shot C variant with the character descriptions
  stripped (ours arm, both models, 2 seeds, ~$0.10) to test the community "describing the
  character hurts identity" report (`brief.md` ## Noticed). Ask before adding it.
- 2026-10-25 ("H3 Singularity 5"): Fabio said yes to the extra Shot C test, as TWO variants (ours
  arm, both models, 2 seeds): `Cb` = looks stripped, `Cs` = Cb plus MiniMax's
  `subject_definitions` / `retention_analysis` with visible-only traits (EllipsesMark's HF tip).
  Prompts in `prompts.md`; `build_phase1.py` now writes 32 graphs. Phase 1 Pod
  **`fli4ckspb2aghh`** created 02:42 GMT with `HARD_MIN=120` (32 clips do not fit in 90).
- 2026-10-25 **Phase 1 DONE**: 32/32 ok (`results.md`), clips in `C:/AI/Mpi/_private/mpi1135-clips/`.
  Pod DELETED 04:07 UTC (84 min, ~$1.01); RunPod lists no Pods. **Spent ~$2.76 of $3-5.**
  Timings: fl2va none ~120 s / ours-upscale ~107 s on both models (same speed); Shot C
  Singularity none ~157 s / ours-upscale ~126 s; D ~129 / ~112 s. **Cb/Cs (shorter-description
  prompts) ran ~92-115 s at ~30 GB RAM vs Shot C's ~126 s at ~54 GB**, graphs identical apart
  from the prompt (diffed); cause unexplained. EasyCache grep NOT done for this run: this boot's
  ComfyUI output never reached `boot.log` (it stops at "nodes done"), and the 0-skip lines in it
  are from earlier Pods. Side-by-sides: `build_sbs.sh <dir> p1` (now N panels) ->
  `sbs/p1_<shot>_<seed>` (Sing none | ours none | Sing +up | ours +up) and
  `sbs/p1prompt_{sing,ours}_<seed>` (C | stripped | sections), each with `_detail`.
- 2026-10-25 Fabio's Phase 1 verdict (in `validation.md`): **sections always** in ref prompting,
  **Singularity v1.3 replaces ours**, new **Fast Motion** control (no upscale route; 2K/4K still
  upscale above 1080x1920). Next: Phase 2 on Singularity (needs a Pod and the full-volume fix,
  and runs past the $3 floor of the budget), plus the three build jobs, which are not this card's.
- 2026-10-25 ("H3 Singularity 6"): cards made for the three build jobs: MPI-1283 (sections in H3
  ref prompts), MPI-1284 (Singularity replaces our H3, licence check first), MPI-1285 (Fast
  Motion control). Fabio: delete FastH3 Trim and OURS from the volume, keep Singularity v1.3 AND
  v2 for one more test, **Phase 1b = v1.3 vs v2, Shot B, no upscale, 2 seeds**
  (`step0/build_v2.py` -> `p1b_{s2,s13}_none_B_<seed>`, sbs `build_sbs.sh <dir> p1b`). boot.sh now
  `rm`s those files from the volume and fetches v2 + v1.3 only. Phase 2 = speed arms on the
  Phase 1b winner ONLY (no model comparison any more); Fabio approved ~$1.10-1.25 for it, but
  wants to see Phase 1b first and **the Pod stays up while he judges**. Pod
  **`e8e1vtrxvl5q6g`** created 09:02 UTC, `HARD_MIN=180` (removes itself ~12:02 UTC).
  SSH `ssh -i ~/.ssh/id_ed25519 -p 29007 root@213.173.107.21`. COMFY_READY 09:14 (both
  Singularity files full size, ours/FastH3 gone from the volume, container disk 73/150 GB).
  Phase 1b ran 4/4 ok: v2 128/86 s, v1.3 123/86 s (the second seed skips the load). v1.3's file sizes match
  Phase 1's same-seed clips. Side-by-sides `sbs/p1b_B_<seed>{,_detail}` sent 09:23; **Pod left
  RUNNING, idle, waiting on Fabio's verdict** ($0.72/h).
- 2026-10-25 Fabio: **v2 wins Phase 1b.** Phase 2 = speed arms on v2 only, Shot B, no upscale
  (`step0/build_phase2.py`, 18 graphs `p2_<arm>_B_<seed>`, sbs `build_sbs.sh <dir> p2`). Found on
  the Pod: the shipped graph ALREADY runs Comfy Kitchen int8 attention (393) on every path and
  EasyCache on the non-turbo path, so both are baseline. Core ComfyUI has `BlockSparseAttention`
  (sol-attn: training-free, H3-aware audio protection, comfy-kitchen 0.2.39, **no Triton**), which
  replaces the VSA arm (core's vsa needs FastH3 weights). **Veda needs Triton** (its
  requirements.txt), which the shipped engine cannot carry (performance.md), so Veda is measured
  but is not shippable as things stand. Arms: t_base/t_sol/t_veda, n_base (EC out)/n_ec/n_sol/
  n_sol_ec/n_veda/n_veda_ec. Run started ~09:45 UTC.
- 2026-10-25 Fabio: v2 had only run t2v, so **Phase 1c** = v2 on Shot D (i2v, none) + Shot Cs
  (ref2v, sections, ours route), 2 seeds, ~$0.10 (`build_v2.py 1c`, sbs `build_sbs.sh <dir> p1c`:
  ours | v1.3 | v2). Ours on Shot D was the fl2va file (MiniMax H3, not Reference): Fabio says
  Reference is weaker at i2v, and Singularity is a ref2va fine-tune, so judge v2's i2v against
  our fl2va. Queued to run right after Phase 2.
- 2026-10-25 Fabio: **Singularity H3 v2 is the ONLY H3** (memory note
  `project_singularity_h3_is_the_only_h3`); 2.1.3 = the MOSS release, readiness card **MPI-1286**
  (made this session: no 2.1.3 card existed), deprecates MiniMax H3 + H3 Reference. MPI-1284 has a brief.
- 2026-10-25 **Phase 2 DONE**, 18/18 ok, sbs `sbs/p2{turbo,full,fullec}_B_<seed>{,_detail}`.
  Compare SEED 2 times (warm): every seed-1 row after an arm change pays ~40 s and ~50 GB RAM (a
  model re-patch/reload). Turbo: base 85, sol-attn 72 (-15%), Veda 71 (-16%; seed 1 88 s = Triton
  JIT). Non-turbo 25 steps: base 246, EasyCache 212 (-14%, skips 3-5/25), sol 190 (-23%),
  sol+EC 173 (-30%), Veda 201 (-18%), Veda+EC 181 (-26%). Veda computes 15% of attention but only
  ~22 s of a step is attention at 4 s; gains grow with length (the 10/15 s runs are where it would
  show). Quality verdict pending (Fabio).
- 2026-10-25 **Phase 1c**: v2 Shot D 136/88 s, Cs 124/94 s (4/4 ok), sbs `sbs/p1c_{D,Cs}_<seed>` (ours |
  v1.3 | v2). Verdict pending.
- 2026-10-25 **Resolution rethink (Fabio, for the next session's brainstorm, feeds MPI-1285):**
  "single pass up to 1080p, upscale only for 2K/4K" does not work: High and Very High cannot
  render single-pass at 10-15 s on 16 GB cards (already measured). Idea: every tier above the
  bench size (High, Very High, 2K, 4K) is an UPSCALE from the 1344x768 (or 768x1344) single pass,
  with a factor per tier that lands on the target size. Every bench clip so far ran at 1344x768
  (Shot D 896x1088). The shipped 3D upscaler takes target dimensions (`mode: target dimensions`,
  node 419), so the factor is per tier, not fixed at 2. Brainstorm first, no build.
- Spent: ~$0.95 before Pod 2; Pod 2 at $0.72/h on top.
- Spent: ~$0.63 of the $3-5 Pod budget (GPU 47 min + the first Pod $0.06 + CPU fill $0.01).
- Watching boot: `watch.mjs` (RunPod log API) printed nothing in 30 min; poll
  `https://<id>-8188.proxy.runpod.net/system_stats` and SSH (`tail boot.log`) instead.
  Restart a Pod with `POST https://rest.runpod.io/v1/pods/<id>/restart` (v2 has no restart).

## Plan Drift

- 2026-10-25 ("H3 Singularity 5"): **the network volume `l545j38pyx` is FULL** (quota ~145 GB,
  weights 130 GB). The v1.3 download died at 19.8 of 20.97 GB ("Disk quota exceeded"; aria2 left
  its `.aria2` file, boot.sh still logged "weights done"), boot.sh copied the stub to
  `/root/models`, and ComfyUI's `/upload/image` answered 500 (0-byte file). Fixed on Pod
  `fli4ckspb2aghh` by hand: v1.3 resumed with `aria2c -c` straight onto `/root/models`, sha256
  matches HF's etag (`412a7b12...`), and the broken partial on the volume was deleted, which freed
  room for uploads and clips. **The volume now has no v1.3**: the next boot re-downloads it onto
  a volume with ~20 GB free, and it fails the same way. Before the next Pod, either delete the dropped
  `*_v2_*` + `fastvideo_*` weights (~38 GB, Fabio's call) or make boot.sh fetch v1.3 straight to
  `/root/models`. Also: `curl` from Git Bash returns 000 on the proxy URL; check readiness with
  `check_graphs.py` (urllib) instead.

- 2026-10-25 (Fabio): **FastH3 Trim OUT** (no reference op; the product needs ref2v).
  **Singularity v2 OUT, v1.3 IN**: the HF community tab reports v2 as a regression from v1.3
  (NSFW content nobody asked for, squashed characters; only gain a bit more natural skin), and
  Benji's file runs v1.3. Singularity IS the tearing fix candidate: trained for fast action and
  fighting, which base H3 lacks. Bench file: `Minimax-h3_Singularity_ref2va_Pruned_v1.3_int8`
  (20.97 GB, the same pruned int8 class as our shipped files; Benji runs the 34 GB unpruned).
  Phase 1 = `step0/build_phase1.py`, 24 graphs `p1_<model>_<arm>_<shot>_<seed>`: Singularity
  none/ours on A, B, C, D, then ours none/ours on B, D (ours A, C reuse Step 0's clips).
  `pod/boot.sh` fetches v1.3 and no longer copies `*_v2_*` / `fastvideo_*` to the container disk.

- 2026-10-25 (Fabio, after reading Benji's real workflow): **Benji closed.** Phase 1 keeps the
  fixed inputs: 1344x768 for every arm (a bigger frame always wins, so it is not a fair test),
  our 8-step turbo (4-step already tested, worse), Singularity **v2** (v1.3 in his file predates
  it), no NVIDIA RTX VSR (not every card / OS), no realism LoRA. Phase 1 = **none and ours on
  each of the three models** (ours H3, Singularity, FastH3 Trim), per model, Shots A-D where the
  model covers them, 2 seeds. Veda stays a Phase 2 SPEED arm judged on the high-action shot (B):
  Benji himself says it breaks physics on fast action, which is the tearing we are fixing.
- 2026-10-25 EasyCache trace (shipped graphs): under turbo it is OUT of the fl2va graph entirely
  (369 picks the plain shift), but in **r2va the turbo-on refine runs THROUGH EasyCache** (586
  true -> 523 <- 520 EasyCache). The turbo DRAFT never touches it in either graph, and it skips 0
  of 8 turbo steps anyway (`docs/models/h3/performance.md`), so it cannot cause draft tearing.
  Open: does it skip any of the 3 refine steps on ref2v? EasyCache is `verbose`, so the next
  Pod's ComfyUI log answers it (grep the skip lines). Twin mismatch noted, not changed.

- 2026-10-25 (Fabio): **run per MODEL, never per phase.** A load is the slow part, so one model
  stays loaded and does every shot it covers (A, B, C, D), then the next model. Phase 1 runs as:
  Singularity A/B/C/D -> FastH3 Trim A/B/D -> ours fl2va A/B/D -> ours ref2va C (or ours first,
  to reuse what is resident after Step 0). Step 0 is already grouped: fl2va Shot A x6, then
  ref2va Shot C x6. Judging stays one comparison per shot.
- 2026-10-25: first Step 0 clip took 372 s, of which ~45 s sampling. The rest was
  "Model Initializing": ComfyUI's dynamic VRAM loading streams the weights from the FILE on
  every load, and the file was on the network volume (0.67 GB/s vs 2.6 GB/s on the container
  disk). Fix: `create-pod.mjs` asks for a 150 GB container disk, `boot.sh` copies every weight
  there and points ComfyUI at it first (`extra_model_paths`, `is_default`). Fabio: leave the
  shipped `MpiClearVram` nodes alone, they are not the bottleneck.
- 2026-10-25: the RunPod proxy 403s Python's urllib User-Agent; both scripts send a browser one.

- 2026-10-25: first fill split by Fabio's call: GPU Pod for venv/ComfyUI/nodes, then a CPU Pod
  (`create-cpu-pod.mjs`, `boot.sh WEIGHTS_ONLY=1`, $0.12/h, removes itself) for the weights in
  case HF throttled. It did not: ~118 GB landed in ~3 min (~200+ MB/s from EU-RO-1). For a fresh
  volume, the CPU fill is still the cheap path.
- 2026-10-25: MpiNodes IMPORT FAILED on `cv2`: it has no requirements.txt, the app installs it
  from `dev_configs/python_deps.txt`, which is pinned for py3.12 and will not install on this
  image's py3.10. `boot.sh` now installs only the shipped `opencv-contrib-python-headless==5.0.0.93`.

## Output

A verdict per candidate in `validation.md`: replace / add / drop, with the evidence.
