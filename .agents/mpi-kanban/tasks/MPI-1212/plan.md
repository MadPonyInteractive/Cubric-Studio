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

## Plan Drift

## Completed
