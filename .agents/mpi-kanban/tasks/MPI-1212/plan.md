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

### Phase 2a - Character Sheet Editor: clothed-only FLUX.3 route (Fabio YES, 2026-10-22)

Scope (Fabio): body shape, child age, accessories -> FLUX.3 Turbo. Hair, makeup, tattoos, beard, clothes/undress
and ANY nude character stay on Qwen. FLUX.3 optional: not installed = today's Qwen route, unchanged.
Facts (mapped 2026-10-22, file:line in validation.md "PHASE 2A MAP"):
- Editor slots `flowsRegistry.js:1725-1729`: klein-9b (FLUX.2) + optional qwen-image-2-1. Leg 1 routes by
  `operationBy.field: 'change'` (`:1731-1753`); child age = chain rebuild leg `flowCharacterSheetImages` (Qwen
  from-images graph, ages 0-12, `:1756-1769`). Prompts are code templates (`characterSheetEditor.js`), no Enhancer.
- `flux3-klein` ModelDef exists (`models.js:2031`), but its `flux3_t2i.json` has none of the Editor's titled nodes
  (lock, face crop, back pass, Output_Image_3, Lora_Phase*): needs its own Flow graphs.
- Routing is fixed BEFORE the describe answers arrive (`flowService.js:434-525` vs `:706-717`): today the app
  cannot know an ADULT sheet is nude when it picks the model. Child rebuild is safe: SHEET_CLOTHES_CHECKS + the
  words gate already refuse anything but ordinary clothes at 0-17.
Steps:
1. Prompt gate FIRST (GPU, Fabio's go): turn the bench's hand-written BFL prompts (`research/bfl.py` cseq3/5/8) into
   per-category TEMPLATES (sheet layout + per-view sentences + keep-list), render them for cseq3_0/5_0/8_3, bench
   vs the hand-written sheets. Template loses = stop and wire the seeing Enhancer first (FLUX.3 i2i recipe already
   `seesPictures`, `flux-3.recipe.js:109`). Verify: Fabio's verdict per sheet.
2. Graphs: `flow_character_sheet_edit_flux3.json` + `flow_character_sheet_images_flux3.json` built from the Qwen
   twins by flowbench `swap_qwen` (TextEncodeQwenImage21 -> MpiFlux3References same id, flux2 VAE, Turbo 16/1),
   committed as real workflow files. Verify: graph link check + one local run each = bench sheet.
3. Clothed check before routing: run the existing clothes question (SHEET_CLOTHES_CHECKS, 9/10 on bench) for
   adults too when change is body/accessories AND flux3-klein is installed; answer NOTHING/UNDERWEAR on any view
   -> Qwen. Needs the describe step moved ahead of op/model choice in `flowService.js` (a real refactor: brief
   Fabio before starting). Verify: unit test nude sheet -> Qwen op, clothed -> FLUX.3 op.
4. Wiring: third optional slot `{ models: ['flux3-klein'], for: [new ops] }`, ops in commandRegistry,
   universal_workflows, operationRegistry.js, operation_registry.json; routing rules for body/accessories + the
   rebuild leg; FLUX.3-specific templates from step 1. Verify: `tests/character-sheet-editor.test.cjs` extended
   (routing pinned per category x installed/not x clothed/not), `npm run lint`, `npm test`.
5. Copy: Flow description, slot label, Accessories/Body option info (`flowsRegistry.js:1721/1727/1789/1801`);
   fix stale `docs/playbooks/add-flow/existing-flows/character-sheet-editor.md` (:62 says hair on Klein, :16
   misses beard). UNRELEASED.md line. Privacy unaffected (local model).
6. Fabio's eye-test in `app:isolated`: one body, one accessory, one child-age run with FLUX.3 installed + one nude
   body edit (must go Qwen).
Open: undress cases' keep-list wording; whether body edits on Klein-era L1 string (`characterSheetEditor.js:354`)
also improve Qwen - out of scope, noted only.

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
- Fabio 2026-10-22 (session "Flux 3 on flows 3"): replacing Qwen-Image 2.1 WHEREVER FLUX.3 holds is a goal
  of its own - Qwen 2.1 is non-commercial. Qwen today: Character Sheet from Images (whole Flow) and the
  Editor's Qwen slot (body shape, hairstyle, beard, accessories, makeup, tattoos, undressing, child ages).
  Run 1 covers only beard (cseq1), tattoo (cseq2) and from-images x2 (csfi1_2, csfi2_1): the other six
  editor categories need their own cases before the Qwen slot can be called. Scribble retry:
  `research/scribble3.py` (style-neutral prompt citing <ref_image_0>, Turbo only - base dropped, Fabio:
  horrible on Scribble), sheet `sheet.py scr1_0 scr2_0 --s3`.
- Round 2 queued (`research/next.sh 53061`, log `research/next.log`, starts on rest.log "all done"):
  Fabio: FLUX.3 is useless without BFL-shaped prompts, and the bench fed it Klein/Qwen wording. `bfl.py`
  = per-case prompts hand-written to BFL's i2i upsampler rules looking at the real inputs (best case);
  `qwenprompt.py` = template route (image N -> <ref_image_N-1> + medium/backdrop clause); `scribble3.py`.
  Sheets: `sheet.py <g> --bfl | --s3 | --qp`. Fabio also found the app's Enhancer weak on FLUX.3 edits:
  our i2i Enhancer gets picture DESCRIPTIONS, BFL's PUP is a VLM that sees them - suspect, not proven.
- 2026-10-22 05:40Z: rest.sh + round 2 + Make Seamless ALL DONE, verdicts in validation.md, 12 sheets
  sent to Fabio. Klein stays: Draw It In, Scribble (unless Fabio likes the FLUX.3-prompt sheets), Outpaint,
  Editor Klein slot, Make Seamless. Qwen-replacement candidates: Editor beard (Fabio: decent), tattoo
  (mixed), from-images with FLUX.3 prompts (photo ok, anime clause leaks). Open: Fabio's look; the 6
  untested Qwen editor categories; whether the Pod + 150 GB volume go now (still billing $0.72/hr).
- 2026-10-22 Fabio's verdicts (validation.md "FABIO'S VERDICTS"): Scribble FAILS (sun stays a drawing);
  from-images Turbo PASSES with a FLUX.3 prompt; beard Turbo PASSES; tattoo half (close-up miss). Fabio
  deletes the Pod + volume himself. NEXT: local tests (GPU only on Fabio's go, `gpu_lease.py run --poll 2`):
  tattoo close-up fix, the 6 untested Qwen editor categories, and a FLUX.3 prompt for from-images that
  holds for photo AND anime. research/*.py hit an app's `/proxy/*`: locally point them at an
  `app:isolated` instance with the LOCAL engine, and re-check their `engine == remote` guards.
- Then: validation.md verdicts for the rest, Fabio's look, delete Pod + volume (volume 150 GB bills
  while it exists).
- 2026-10-22 (session "Flux 3 on flows 4") LOCAL BENCH READY, nothing run on the GPU:
  - Port 48188 = the local ComfyUI itself: `flowbench._url` hits it natively (/prompt /history /view, no
    /proxy - the app's /proxy is Pod-only, it 503s locally) and REFUSES unless `MPI_KANBAN_GPU_SLOT` is set,
    i.e. only under `gpu_lease.py run`. Any other port = an app instance's /proxy as before.
  - `flowbench._localize`: captured graphs load `/workspace/comfyui/input/<name>`; on 48188 the project file
    the app staged it from (`LOCAL_INPUTS`: cseq1/2, csfi1_2, csfi2_1 only - add a line per new case) is
    UPLOADED via ComfyUI `/upload/image` and the bare name injected. GOTCHA: MpiLoadImage refuses an absolute
    path outside input/output/temp, blocks the graph, and ComfyUI still says `success` with 0 images (first
    tattoo run, 3 s/run, empty columns). Runs now count images and fail on 0.
  - `replay.py`: remote-only guard replaced by `_engine()` - local engine allowed under the lease, its queue
    and history read from 48188. New cases cseq3..8 (body, hair, accessories, makeup, undress, child age 10)
    from Fabio's Qwen 2.1 project; undress + child ran on Klein then, the app routes them to Qwen now
    (MPI-1159 / age <= 12 rebuild leg). Their Qwen baselines = GPU runs through an isolated app.
  - `bfl.py cseq2_0` = tattoo fix prompt (all three views incl. close-up, nothing but the tattoo); editor
    graphs take it in `Input_Positive` (node 5, read by every edit encode; the back-view leg 198 untouched).
  - FLUX.3 weights all present in M:\CubricModels (turbo, base, qwen3vl_4b_abliterated, flux2-vae, sam3.1).
  - Run (on Fabio's go only), from the repo root, Bash in the background:
    `python <gpu_lease.py> run --poll 2 -- python <abs research>/bfl.py 48188 cseq2_0 --seeds 111,222 --variants bfl_turbo,bfl_base`
    then `sheet.py cseq2_0 --bfl`. Fabio's own app must have its engine up on 48188.
  - Fabio: the hand-written BFL-style prompt won from-images on EVERY run (template route lost). So the
    wiring question is no longer "which template": a BFL prompt is written per run, looking at the pictures.
    In the app that means an Enhancer that SEES the inputs and writes BFL-shaped prompts (ours gets picture
    descriptions only). The "one prompt for photo AND anime" item is that writer's job, not a fixed template.
    New editor cases (cseq3..8) get hand-written BFL prompts too, after their Qwen baselines are captured.
  - Fabio: FLUX.3 cannot do nudity without a LoRA (none exists yet; no nipples, no genitalia when it works).
    Undressing stays on Qwen, cseq7 is not benched on FLUX.3, and any NUDE sheet fails on FLUX.3 in every
    category. So FLUX.3 can at most replace Qwen for CLOTHED characters; the Qwen slot stays needed. Whether a
    clothed-only FLUX.3 route is worth wiring is Fabio's product call after the clothed cases (cseq3..6, 8).
- 2026-10-22 night bench DONE except cseq5 (sling bag): reads in validation.md "LOCAL BENCH". Tattoo fix =
  FAIL (Turbo keeps the bikini despite the prompt). FLUX.3 Turbo wins body (cseq3) and child age 10 (cseq8_3),
  Qwen ahead on hair (cseq4), makeup tie (cseq6_2). The PC RESTARTED overnight before cseq5 ran (cause
  unknown, not diagnosed); the isolated app on 57569 died with it.
  NEXT: Fabio judges the sheets (cseq2_0/3_0/4_0/6_2/8_3 `_bfl.jpg`). Then, on his GPU go, cseq5:
  relaunch `CUBRIC_AGENT_PROFILE=%LOCALAPPDATA%\Temp\cubric-agent-profile-mpi1212 node scripts/launch-instance.mjs`
  only if a replay is needed (cseq5_0.json is already captured - not needed); run
  `gpu_lease.py run --poll 2 -- python <research>/flowbench.py run 48188 cseq5_0 111 222 --variants base`, then
  `... bfl.py 48188 cseq5_0 --seeds 111,222 --variants bfl_turbo,bfl_base`, then `sheet.py cseq5_0 --bfl`.
  Fabio's engine must be up on 48188. Then Fabio's product call on a clothed-only FLUX.3 route.
- 2026-10-22 afternoon (session "Flux 3 on flows 5"): cseq5_0 sling bag RAN (sheet `cseq5_0_bfl.jpg`): Turbo ties
  Qwen, base 1 of 2 (seed 222 puts the bag on his back). LOCAL BENCH COMPLETE. GOTCHA fixed: locally captured
  graphs load `<engine input>\mpi_staged\<hash>.png`, and the app EMPTIES mpi_staged on every engine start -> 0
  images in 3 s. `flowbench.LOCAL_STAGED` maps staged name -> project file (name = sha256(path|size|mtimeMs)[:16])
  and `_localize` re-uploads when the staged file is gone; add a line per new local case.
  NEXT: Fabio's verdicts on cseq3/4/5/6/8 sheets + his product call on a clothed-only FLUX.3 route.
- 2026-10-22: Fabio YES to the clothed-only route (body, child age, accessories on FLUX.3 Turbo). 2.1.2 shipped
  2026-10-21, so the Phase 2 gate is open. Plan = "Phase 2a" above. NEXT: step 1 prompt gate (GPU go needed),
  and Fabio's OK on step 3's describe-before-route refactor.
- 2026-10-22 step 1 RAN (`research/tpl.py`, sheets `*_tpl.jpg`, reads in validation.md "PHASE 2A STEP 1"): template
  HOLDS child age, WEAKER on body (1 seed), FAILS accessory (seed 111 breaks the layout). LOCAL_STAGED now covers
  cseq3_0/5_0/8_3 (cseq8_3's input = `FLUX3 Flow Bench\Media\flowCSE_012.png`). NEXT: Fabio's verdict; agent's pick
  = wire the child-age leg on a template now, body/accessories wait for the seeing Enhancer.
- 2026-10-22 Fabio YES -> child-age leg WIRED (uncommitted): Editor slot 3 `Child ages` [flux3-klein, qwen-image-2-1]
  optional, `for: flowCharacterSheetImages` (slot 2 dropped it); `byModel` on that op ->
  `comfy_workflows/flow_character_sheet_images_flux3.json` (= `research/build_flux3_graph.py` swap of the Qwen twin;
  the from-images Flow itself never resolves it); `buildRebuildPromptFlux3` + builder takes `modelIds` (flowService
  passes the leg's per-op ids). No new op: commandRegistry is a live peer's (MPI-1232). Tests updated as contract
  changes (character-sheet-editor, flow-model-choice byModel owner = any flow that runs the op and slots the model,
  flow-licence-surface); lint + `npm test` green (3577). Doc + UNRELEASED line done.
  NEXT: Fabio's eye test in `app:isolated` (age 10 + age 1/0 unbenched on FLUX.3; Qwen-only fallback), then close.
  Body/accessories: parked on the seeing Enhancer (Phase 2a steps 3-4 for those two).
- 2026-10-22 LATE - Fabio REJECTED the Editor route: FLUX.3 must replace Klein 9B or Qwen WHOLE (dropdown on that
  model's own row, next to its LoRA cog), never a third model doing two or three things. It replaces neither, so
  the wiring is REVERTED (code == HEAD; `flow_character_sheet_images_flux3.json` deleted; patch kept at
  scratchpad only). Eye test also found MPI-1254 (child close-up keeps the adult chest; shipped Qwen route too).
  OPEN for Fabio: is anything left for this card? The only whole-model swap still standing is Character Sheet from
  Images (Qwen-only Flow; FLUX.3 Turbo passed there, but only with per-picture prompts = needs a seeing Enhancer).
  Otherwise close MPI-1212 as rejected.

## Plan Drift

## Completed
