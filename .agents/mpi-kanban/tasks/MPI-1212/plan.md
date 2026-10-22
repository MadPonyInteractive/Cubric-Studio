# MPI-1212 plan - FLUX.3 Klein in the Flows

**Verify mode:** user-ux (Fabio judges every bench sheet; the winner per Flow is his call)

## Constraint (Fabio, 2026-10-20)

No app code until 2.1.2 ships: scripts and sheets under `research/` only, nothing in `js/`,
`routes/`, `comfy_workflows/` or `flowsRegistry.js`. GPU only on Fabio's "GPU is free".

## Phase 1 - bench (prep now; runs need Fabio's GPU-free go, not 2.1.2)

1. Inputs: replay real past runs of each Flow (sidecar `injectionParams` + the media they name)
   so every model gets the same photo, drawing, mask and words. Fallback: MPI-1181 bench inputs.
2. `research/flowbench.py`: loads a Flow graph from `comfy_workflows/`, swaps its edit stage to
   FLUX.3 IN MEMORY (UNET `flux3-image-klein[-base]-int8-convrot`, CLIP `qwen3vl_4b_abliterated`
   type `flux3`, ReferenceLatent -> core ReferenceMultiLatent, sampler steps/cfg to FLUX.3's:
   Turbo 16/1, base 50/3.5), runs on the G:\ComfyUi bench under
   `gpu_lease.py run --poll 2`, writes one contact sheet per Flow. Sanity first: one run per Flow
   with the ORIGINAL graph must reproduce the baseline before any swap counts.
3. Matrix per Flow: baseline vs FLUX.3 Turbo vs FLUX.3 base, 2 inputs x 2 seeds = 12 runs.
   Flows: draw-it-in, scribble, outpaint, make-seamless, object-stamp, character-sheet-editor
   (Klein slot + Qwen slot), character-sheet-from-images. About 96 runs, local GPU, no cost.
4. Record per Flow in `validation.md`: win / lose / tie, why, time per run.

## Phase 2 - wire the winners (after 2.1.2 ships)

Per winning Flow: add `flux3-klein` to the slot's `models`, FIRST (recommended) where it wins
clearly, `modelParams` arm, graph variant or `byModel` graph for the reference node; its licence
gate (FLUX Kommunity: commercial under US$5M revenue) rides on the model as everywhere else.
Per `/mpi-add-flow` playbook.

## Current State

2026-10-20: plan written. TWO SEPARATE GATES (Fabio, 2026-10-20):
- GPU: no bench run until Fabio says the GPU is free (he is running tests). Independent of 2.1.2.
- App wiring (Phase 2): only after 2.1.2 ships.
Non-GPU prep DONE 2026-10-20:
- `research/inputs.json` (pickinputs.py): 2 newest real runs per Flow, different source pictures.
  Make Seamless has NO past run - pick a texture photo at run time.
- `research/flowbench.py dry` passes on all 6 Klein Flow templates (swap + link check).
Gotchas found:
- ComfyUI graphs come from the app's renderer compile (box crop, stitch, derived paint layer),
  so a Python rebuild would drift. Capture instead: run the Flow normally (= the baseline),
  `flowbench.py capture 48188 <flow>` pulls the exact graph from /history, then `run` swaps.
- Engine port is fixed 48188: an isolated app SHARES Fabio's engine, so baselines are GPU work too.
- Klein graphs keep ReferenceLatent (core ReferenceMultiLatent sets the same `reference_latents`);
  base needs the refs on an empty-prompt negative too (`_negative_with_refs`).
- Qwen-Image graphs (character-sheet-from-images, editor's Qwen variant) are NOT swappable this
  way (TextEncodeQwenImage21, own VAE); write that swap off the captured graph.
2026-10-22 DECIDED: bench runs on a RunPod Pod, NOT the local GPU (Fabio keeps his GPU).
Approved cap: $5 total (RTX PRO 4500 $0.72/hr first, est. ~2 h + ~100 GB volume, delete after).
Route:
1. `npm run app:isolated` (Bash run_in_background) - window must be VISIBLE, not minimised:
   Fabio pastes the RunPod key into its Settings and connects the Pod himself. Never copy his
   `runpod-secrets.json`.
2. In that instance install the Flows' models onto the Pod volume; run each Flow normally from
   inputs.json (= baseline, the app compiles the graph).
3. Point flowbench.py at the instance's pass-through, NOT a ComfyUI port: `POST /proxy/prompt`,
   `GET /proxy/history/:promptId`, `GET /proxy/view` (routes/remoteProxyForward.js). There is NO
   `/proxy/history` list route: take the prompt_id from `/proxy/queue` or the instance's app.log.
   `capture` + `_api` need that base-URL change (one line); gpu_lease is not needed on a Pod.
4. Track spend; ask before passing $5. Delete the Pod and the volume when done.
2026-10-22 (session "Flux 3 on flows 2"): isolated instance UP, visible, port 53061, own profile
`%LOCALAPPDATA%\Temp\cubric-agent-profile-mpi1212` (CUBRIC_BACKGROUND=0). Waiting on Fabio: key +
Pod. flowbench.py now hits `/proxy/*` (capture needs the prompt_id; dry still passes).
Pod up ~03:18Z (RTX PRO 4500, volume grown 50 -> 150 GB). Fabio installed flux3-klein, klein-9b,
qwen-image-2-1 + the 7 Flows. Bench project "FLUX3 Flow Bench" (Fabio's Documents).
- Old inputs.json is STALE (half its sidecars deleted). `research/replay.py` holds the picked
  CASES instead (12: dii1/2, scr1/2, out1/2, csfi1/2, cse1/2 Klein slot, cseq1/2 Qwen slot),
  replayed via `/connector/generate` with the sidecar's DERIVED run media (`.preview-assets`:
  paint layer, composite) as url media, box1 params, outpaint as frame ratio.
- prompt ids: not in app.log, not in the sidecar; replay.py polls `/proxy/queue` during the run
  and saves `graphs/<case>_<n>.json` from `/proxy/history/<id>`.
- Object Stamp: NO agent route (its `place` step has no box param) -> SKIPPED (Fabio 2026-10-22:
  by design - placement is the user's pick; the agent lists it and opens it for the user).
- Make Seamless: no past run; `replay.py <port> texture` makes 2 Klein t2i textures on the Pod.
- guard-gpu blocks any `/connector/generate` in a Bash line even with a remote engine: the
  scripts refuse unless `engine == remote`, and the calls live in the script, not the line.
- flowbench `_seed` now sets the `Input_Seed` MpiInt (app graphs feed every sampler from it).
- flowbench `swap_qwen`: each TextEncodeQwenImage21 -> MpiFlux3References UNDER THE SAME ID
  (same 3 outputs), QwenImage21Cache bypassed, flux2 VAE, RGBA split dropped. Dry-checked only.
- `sheet.py <graph>` -> `sheets/<graph>.jpg`. Klein results so far in validation.md.
- 04:03Z the Pod vanished: Fabio's OWN :3000 app quit at 04:02:57 and its quit teardown's orphan
  sweep deleted every untracked `cubric-vision` Pod (his app.log: "orphan sweep deleted 1 stray
  Pod(s): kp0mdv6q6tpacj"). While a bench Pod runs, Fabio must NOT quit or connect RunPod in his app.
- New Pod 79ecfy2y36afa4 (04:08Z). `research/rest.sh 53061` runs EVERYTHING left (waits for the
  engine to read remote): cse1/cse2 Klein, csfi1_2/csfi2_1/cseq1_0/cseq2_0 (Qwen swap, first real
  run), replay seam1/seam2 + their bench, sheets. Progress: `research/rest.log`. Started in session
  "Flux 3 on flows 2" (kept open, NOT archived, isolated window left running). Uploaded inputs sit
  in `/workspace/comfyui/input` (volume): a FAIL with a missing image = re-run replay.py for it.
- Fabio on Scribble (2026-10-22): FLUX.3 "definitely failing" - it must CREATE from the drawing,
  never carry the paint. The Flow's Klein instruction already says no stroke survives (graph nodes
  103 Edit Instruction / 184 Edit Guardrails); FLUX.3 ignores it. Next: try a FLUX.3-specific
  approach (prompt that cites <ref_image_0> as a layout guide, or a lower-strength reference / i2i
  route) as an extra variant before calling Scribble a loss. Lady-on-bed (scr2) came out broken.
- Then: validation.md verdicts for the rest, Fabio's look, delete Pod + volume (volume 150 GB bills
  while it exists).

## Plan Drift

## Completed
