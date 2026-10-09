# MPI-936 Validation

Gates, in order: graph proven on the bench (`G:\ComfyUi`, 0.39.0) per op; one in-app generation per op;
RGBA survives capture; `npm test`; agent read-back; Fabio eye-tests the NC tile flag and the preview.

## 2026-10-08 (session 6271e0b6)

- **Bench, all seven ops: PASS.** `research/bench/run.py` under the GPU lease, outputs eyeballed on contact
  sheets (`research/bench-results.md` runs 2-3): t2i (RGBA, 64% clear when asked), edit 1/2 refs, edit RGBA
  (59% clear), i2i (0.65 nudges, 0.85 restyles), control depth + pose, masked edit + inpaint via LanPaint
  (no seam), detail, upscale 1.5x (Siax crosshatch = the upscaler's, app-wide, Noticed).
- **Raw -> runtime faithful: PASS.** `comfy_workflows/qwen_image_2_1.json` (84 nodes) diffed node-by-node
  against `graph.py`'s API: identical but for two optional ControlNet widgets taking defaults (0 / 1).
  `validate-injection-rules.mjs`: conforms. Raw committed by the sync (541caee9a).
- **`npm test`: 2779 pass, 1 fail, 2 skipped.** The fail is `tests/remote-engine-assets.test.cjs`
  asserting `qwen3vl-abliterated-clip` is an engineAsset: a peer's in-flight MPI-1045 edit (claim
  9ac7a7c7-mpi1045), not this card's files. Re-run once that lands.
- **Not yet:** in-app run per op (isolated app), RGBA through capture, agent read-back + tests, Fabio's
  eye-test of the NC flag and the preview webp.

## 2026-10-08 (session 2a01ba53)

- **In-app, `app:isolated` (own profile, port, scratch APP_DOCUMENTS; engine :48188 shared), via
  `/connector/generate`, GPU lease: PASS so far.** edit RGBA 65 s, RGBA **59% clear** (bench 59%), clean
  cut-out; edit 2 refs 55 s, RGBA opaque, image 2's jacket on her; i2i 24 s RGB (0.65 stays a photo, as on
  the bench); control depth 46 s RGB, bronze statue on her structure; upscale 51 s RGB 1536 (x1.5).
  Engine `/history` shows what ran: detail node 81 and USDU node 97 at **12 steps**, the rest 25; denoise
  0.65 / 0.3 and Input_Control_Net 2 injected.
- **The other three, same instance profile through an Electron harness (`_electron.launch`, launcher's env)
  that publishes a mask reader via `js/shell/activeMask.js` exactly as MpiGroupHistoryBlock does (an agent
  cannot paint): PASS.** t2i 31 s, RGBA **69% clear**, clean cut-out; inpaint 72 s RGB, plant placed in the
  box, no seam; detail 16 s RGB (24 s at 25 steps on the bench), face re-rendered, stitched invisibly. Both
  masked runs landed as new versions of the masked card (same groupId). **All seven ops PASS in-app; RGBA
  survives capture on t2i and edit.**
- **NC badge eye-test: PASS** (Fabio, "looks good"): moneyOff flag top-right of the tile, "Non-commercial
  licence" on hover.
- **Agent read-back: PASS after a fix.** Every op carried "the only model here that generates a transparent
  background"; five of seven return RGB. Moved to `qwen-image-2-1:t2i`. Agent tests 21/21.
- **`npm test`: 2789 pass, 0 fail, 2 skipped** (MPI-1045's test landed in 5938f6484).
- **`release:check`: was FAILING** (peer message b73155ff): the Pod yaml had no `model_patches`, so the
  ControlNet is invisible on a Pod. mpi-ci c57f7dd adds the line (pushed on Fabio's yes);
  `release:check` passes. Live on Pods only after `publish-runtime.sh dev` + a Pod test.

## Reopen 2026-10-09 (session 547921d1): no VRAM clear in the graph

- Fabio: the graph has no MpiClearVram. Confirmed: every other model graph has one before its Output_*; qwen_image_2_1.json had none.
  His three Qwen 2.1 runs on :48188 (08:10-08:12 UTC, /history) left the engine holding 13.2 GB idle (Windows GPU counters, pid of engine python).
- Root cause: graph built from the official template shape (bench graph.py), which never carries our node, and the add-model playbook never named it.
- Fix: MpiClearVram (node 115) spliced 99 -> 115 -> Output_Image 35 in raw/qwen_image_2_1.json; runtime re-converted with
  workflow-to-api.mjs (diff vs the old runtime = node 115 + Output_Image input only); validate-injection-rules OK; 55 injection tests pass.
  Rule added: docs/playbooks/add-model/01-workflow-split.md (Every graph ends in MpiClearVram before its Output_*).
- Not yet: the live VRAM-drop check (GPU), and the encoder A/B Fabio raised (weights.md Phase 0.6 planned it, never ran).

## Reopen 2026-10-09 (session 3e2b8b66): int8 encoder, limbs, steps

- **MpiClearVram live check: dropped by Fabio** ("proven on dozens of workflows, it will work"). Node 115 stands.
- **int8_convrot encoder on Boogu: PASS.** `qwen3vl_8b_int8_convrot.safetensors` (9,350,798,360 B, sha256 `8bfd0f6e...`,
  identical in Comfy-Org/Qwen3-VL [apache-2.0] and Comfy-Org/Qwen-Image-2.1) loads at CLIPLoader `type: boogu`. Boogu
  Balanced runtime graph on the G: bench, 3 edits x fp8/int8, fixed seeds (`research/bench/ab.py boogu`): red jacket,
  night street, retriever puppy, int8 near pixel-identical to fp8. Also loads at `type: qwen_image` (repro int8 column).
- **R2: uploaded on Fabio's yes.** rclone exit 0, `rclone lsl` 9350798360, public HEAD 200 Content-Length 9350798360.
- **Bent limbs, Fabio's own failures** (project "Qwen 2.1", t2i_002 shark seed 3978896040 1472^2, t2i_003 bikini seed
  1193008211 896x1088, prompts from the sidecars). Bench `base` reproduces his t2i_002 **bit for bit** (max diff 0), so
  each column is one change (`ab.py repro`):
  - int8 encoder: same defect as fp8 (t2i_003 arm identical). The encoder is NOT the cause.
  - long prompt (hand-written in the qwen-image-2.1 recipe's shape): fixes both, the clear winner.
  - steps: 30 ~= 40 in 10 of 11 rows (2 repro + 9 generic seeds, `ab.py limbs steps30`); 25 is where the breaks are
    (shark legs, yoga 33 arms, bench 33 legs). Cost vs 25: 30 = +20%, 40 = +50%.
  - cfg 2 helps some (2x time); 2K changes the composition (not a fix).
- **Fabio's call: 30 steps on samplers 33, 63, 112; LanPaint 49 at 20 (inpaint runs short, as Krea2; tune on results); detail 81 + upscale 97 at 15.**
  Raw edits are his in ComfyUI (node list handed over), then convert + validate.
- **Raw edits + convert (agent, on Fabio's ask: the raw is script-exported):** git diff = only the 10 scalars; validator 4/4;
  `npm test` 2800 pass / 0 fail / 2 skipped.
- **Shipped-graph smoke** (`comfy_workflows/qwen_image_2_1.json` untouched but for app injections, int8 + 30 steps, bench, his
  t2i_003 short prompt + seed): runs, 34 s. **Fabio's eye: still a third elbow behind her** (the agent misread it as fixed).
  So 30 steps does not rescue that seed; on it only the long prompt did. The limb fix is Enhance / the long form; 30 steps
  is the general improvement (validation above).
- **Licence gate on a RunPod install: PASS** (Fabio screenshot 2026-10-09): Qwen RESEARCH License dialog, two ticks,
  Accept and Install.
- **MPI-1048 Stage 1 (shared GPU window):** after two recipe fixes (per-section sentence counts + limb rule; stated length
  350), sweeps 3 and 4 both 15/15 ALL PASS, words 227-299.
