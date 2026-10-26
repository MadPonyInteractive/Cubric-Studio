# Camera-orbit mode for the Multi-angle Flow - research + bench plan (2026-10-26)

Linked card: MPI-1039 (Multi-angle Flow; its plan.md is owned by session "Multi-Angle 40" - not edited here).
Nothing downloaded, no GPU used. Sources = Hugging Face API + model cards, read 2026-10-26.

## UPDATE 2026-10-26 (Fabio): no pod - he tests by hand on his G:\ComfyUi bench
Workflow `G:\ComfyUi\ComfyUI\user\default\workflows\MPI-1301_qwen_edit_multiple_angles.json` = a COPY of
`comfy_workflows/raw/qwen_edit_template.json` (raw untouched) with Input_Lora_1 = the angle LoRA at 0.9, Tier 3
(4-step Lightning = fal's graph), wf_type 1 (edit), no style, a sample `<sks>` prompt, plus a Note with the prompt
grammar. fal's own workflow (Fabio's Downloads, same 28,086-byte file as HF) has NO gizmo node - stock nodes only.
The big pod grid / cost section below is superseded; keep it only as the checklist of what to look at.

## The idea (Fabio 2026-10-26)
A switch in the Flow. **Character mode** (today): FLUX.3 Klein / Qwen-Image 2.1 + Blender doll ref turn the
SUBJECT; the place stays put (validation.md 2026-10-23: "the red door + bicycle stay behind him in every yaw
cell"). **Camera mode** (new): Qwen Edit + an angle LoRA swings the CAMERA round the whole scene - a back view
should look the other way down the street. Likely needs a hi-res fix pass after (Qwen output is soft).

Earlier finding to weigh, not to repeat blindly: 2026-10-23 Fabio dropped "akhaliq's FLUX.3 angle LoRA and
fal's Qwen route" - "our prompting was better; Qwen slow and poor" (MPI-1039 plan.md line 55). Only the akhaliq
FLUX.3 LoRA was benched locally (validation.md "akhaliq FLUX.3 angle LoRA test"); I found no local run of the
fal Qwen LoRA in validation.md - the Qwen verdict came from the hosted route. That bench also judged the LoRA as
a SUBJECT rotator; the camera-mode question (does the background swing?) was never the pass criterion.

## Candidates (newest + best)
| Arm | LoRA | Base | Licence | Size | Prompt | Notes |
|---|---|---|---|---|---|---|
| **A (lead, Fabio's link)** | `fal/Qwen-Image-Edit-2511-Multiple-Angles-LoRA` (2026-01, 70k dl) | Qwen-Image-Edit-**2511** = our `qwen-edit` | Apache-2.0 (base Apache too) - commercial OK, no territory clause | 295 MB | `<sks> {azimuth} {elevation} {distance}` | 96 poses = 8 az x 4 el (-30/0/30/60) x 3 dist (close-up x0.6 / medium / wide x1.8). Trained on 3000+ Gaussian-splat renders (scenes, so camera moves). fal's own ComfyUI graph = 2511 + Lightning 4-step + LoRA 1.0, euler/simple, 4 steps, cfg 1 = OUR Hyper tier exactly. Strength 0.8-1.0 (start 0.9) |
| B | `gribbliest/qwen-image-2.1-qma-camera-angles` (2026-10-13, 9.5k dl) | Qwen-Image **2.1** = our `qwen-image-2-1` | LoRA Apache, BASE is Qwen Research Licence = non-commercial (already behind our NC gate) | 319 MB | `<qma> {az} {el} {dist}` (same 96-pose grammar as A) | Trained on photos + Blender SCENE renders; card says "directions are relative to the original camera", "big orbits on wide landscapes can stop short of 90 deg". 30 steps, cfg 3, euler/simple, str 1.0, ~1 MP |
| C (ref only) | `akhaliq/Qwen-Image-2.1-Multiple-Angles-LoRA` v2 | Qwen-Image 2.1 | as B | 319 MB | `<mva> {az}, {el}[ close-up]`, 12 az x 4 el | Objaverse dome objects + rigged characters on Unsplash backgrounds = a SUBJECT rotator, same family as the FLUX.3 one already rejected. Skip unless B fails |
| D (older) | `dx8152/Qwen-Edit-2509-Multiple-angles` | 2509 | Apache | ? | free text ("Rotate the camera 45 degrees to the left") | 2509 base - our Lightning LoRAs are 2511 and docs/models/qwen-edit says a mismatched generation silently degrades. Superseded by A. Skip |
| E (ref only) | `berkerdooo/qwen-image-edit-2511-camera-angle-lora` | 2511 | Apache | 590 MB | "Move the camera N degrees to the right around the object..." | White-background Objaverse objects; card says complex backgrounds need cut-out first = not a scene orbit. Skip |
| F (video route) | `pablodawson/MiniMax-H3-360-Orbit-LoRA` | MiniMax H3 FLF2V | H3 community licence (territory; we hold the grant) | 155 MB | long fixed "frozen instant, only the camera moves, 360 orbit" prompt, same image first+last | A real frozen-time orbit; grab the frame at the target angle. Expensive (a video per pick), not in this bench - noted as the fallback if A and B both fail on scenes |

Gizmo nodes worth reading for their prompt tables only (we have our own gizmo): `jtydhr88/ComfyUI-qwenmultiangle`
(emits `<sks>` strings for A), `CoreyCorza/QMA-Multi-Angle-Lora-Node` (for B).

Vocabulary map from our gizmo to A/B: turn stops front / 3/4 front L-R / profile L-R / 3/4 back L-R / back ->
`front view` / `front-left|front-right quarter view` / `left|right side view` / `back-left|back-right quarter view`
/ `back view`. Height: low -> `low-angle shot` (-30), level -> `eye-level shot`, high -> `elevated shot` (30) or
`high-angle shot` (60). Zoom ladder -> `close-up` / `medium shot` / `wide shot` (3 rungs only). NOTE: LoRA
directions are the CAMERA's, ours are the subject's - "right side view" (camera swings to its right) shows the
subject's LEFT side. The bench names both and grades on what lands.

## What the app already has (reuse)
- `qwen-edit` (js/data/modelConstants/models.js:1849): 2511 int8 transformer, Qwen2.5-VL-7B TE, Qwen VAE, the
  2511 Lightning 4/8-step LoRAs, tier radio (High 20 / Turbo 8 / Hyper 4), three image slots - all on disk here
  (M:\CubricModels). `comfy_workflows/qwen_edit.json` exposes `Input_Lora_1..6` and `Input_wf_type` (1 = edit).
  So arm A needs NO new graph and NO code for the bench: `/connector/generate` op `qwenEdit` with
  injectionParams `Lora_1: {lora_name, strength_model}` - the same route the 2026-10-23 akhaliq bench used
  (strength_model only: model-only loader; the MPI-219 dict-into-lora_name trap applies if the shape is wrong).
- `qwen-image-2-1` (models.js:1971, NC-gated, already the Flow's optional Qwen) - `qwen_image_2_1.json` has
  `Input_Lora_1..6` too, so arm B is also code-free.
- Hi-res fix candidates already shipped: `nvidia-pid` op `pid` with the **Qwen-Image latent path**
  (`pid_qwenimage_1024_to_4096_4step`, 4 steps, 4x, on disk) - the natural first pick since it shares the Qwen
  VAE; `krea2` `upscale` / `detail` ops (UltimateSDUpscale + 4x-NMKD-Siax; Krea2 shares Qwen's architecture - the
  "split sampling" idea in MPI-1039 plan.md Future directions); `flux3-klein` `upscale` / `detail`.
- If camera mode ships: one new dep entry (the LoRA, `noMirror` HF url or R2), the Flow's per-stop routing gains a
  mode switch, the gizmo emits the `<sks>` string. Out of scope here - bench first.

## Bench plan (ready to run on a pod after Fabio's yes)
Driver: copy `research/angles.py` helpers (its `_bench`, `_sheet`, connector submit) into
`tasks/MPI-1301/research/orbit.py`; results `out/orbit_*.json`, sheets `sheets/orbit_*.jpg`. Isolated app
instance (`npm run app:isolated`, own port/profile) connected to the pod as its remote engine - never :3000.

Inputs (the Multi-angle bench's own, 9 pictures):
- Fabio's case, project "Draw it in improvements": `edit_006.png` (low 3/4 back R) + `control_c6213e9f.png`
  (front eye-level) - paths as in MPI-1039 `research/r70.py`.
- r66 starts (`MPI-1039/research/out/mq_blender66_sources.json`): photo side 111, photo back 111, anime side 222.
- r67 part B (`mq_blender67_sources.json`): photo front lo 111, photo front hi 111, anime front hi 111.
- r70 eye-level street source (`mq_blender70_sources.json`, the anime street) - the background-swing test.

Run 1 - arm A grid (the main question). qwen-edit Hyper (4-step Lightning, as fal ships it), LoRA 0.9, seeds
111/222, medium shot: 8 azimuths x 4 elevations = 32 stops x 9 inputs x 2 = 576 edits.
Run 2 - arm A quality: High tier (20 steps, no Lightning) + LoRA 0.9 on 8 key stops (3/4 front L, profile R,
3/4 back R, back x eye/low) x 9 inputs x 1 seed = 72; plus strength 0.7 / 1.0 on 4 stops x 3 inputs = 24.
Run 3 - distance: close-up / wide on 4 stops x 3 inputs = 24 (does zoom compose with orbit?).
Run 4 - arm B (QMA on Qwen-Image 2.1): 30 steps cfg 3, same 8 key stops x 9 inputs x 1 seed = 72.
Run 5 - hi-res fix on the 16 best cells of runs 1-4: PiD Qwen path, Krea2 detail, FLUX.3 detail = 48.

Grade every cell (agent read, then Fabio's eye test on the sheets):
1. Camera landed at the asked azimuth/elevation (camera terms; note the side shown).
2. **The SCENE swung**: background shows what the new camera would see (back view = the reverse street), not the
   same backdrop behind a turned person. This is the pass criterion that separates camera from character mode.
3. Identity, outfit, one-sided details (watch left wrist / bag right hip - the r38 mirror check), drawing style.
4. Softness / artefacts (the round-41 "gritty HDR" Qwen-on-Qwen look; colour shift from `index_timestep_zero`).
5. Beside each cell, the current character-mode result for the same stop where a round already made it.
Then: 4b hi-res fix kept detail without changing the view/identity; pick one.

Decision out: camera mode GO (arm, tier, strength, hi-res model) -> a build card on MPI-1039's Flow; or NO-GO
with the reason (and whether the H3 orbit video route F is worth a round).

## Cost (to put to Fabio - nothing rented)
Edits: ~576 Hyper (~6-10 s on a 32 GB card at ~1 MP) + ~120 High/QMA (~30-45 s) + 48 hi-res (~20-40 s) =
~1.6 + 1.3 + 0.4 h GPU, plus ~0.5 h pod boot / model sync. **~4 h, cap 5 h.** Card: RTX PRO 4500 (32 GB,
$0.72/h, the bump-engine playbook's first pick) ~= $3, cap $3.60; fallback RTX 5090 ($1.19/h) ~= $5, cap $6.
Prices are from `docs/playbooks/bump-engine/01-smoke-run.md` (2026-10-14) - re-read the live tile before renting.
Cheaper trim if wanted: one seed on run 1 (288 edits) -> ~3 h, ~$2.20 on PRO 4500.
Arm A's LoRA is ALREADY LOCAL (Fabio downloaded it 2026-10-26): `M:\CubricModels\loras\qwen\qwen-image-edit-2511-
multiple-angles-lora.safetensors`, 295,140,688 bytes = the HF size exactly; 1680 tensors, diffusers key names
(`transformer.transformer_blocks.N...lora_A/B`) - fal's own ComfyUI graph loads this same file, but check the
first run's engine log for "lora key not loaded" (the FLUX.3 akhaliq LoRA needed `convert_lora.py`). Injection
name: `qwen/qwen-image-edit-2511-multiple-angles-lora.safetensors`. On a pod it still has to be put in the pod's
`loras/qwen/` (fetch from HF on the pod, 295 MB). Arm B's QMA LoRA (319 MB, HF) is NOT downloaded - ask first.
Base weights come from our own R2 deps as usual.
Free alternative: qwen-edit + this LoRA are both on this PC, so arm A could run on the local GPU once it is free
(Fabio's call - the brief said rented GPU).

## Fabio's hand tests 1-4 (2026-10-26, G:\ComfyUi, MPI-1301 workflow: LoRA 0.9, Tier 3, 1024x1024)
Source: a woman facing the camera, full body, hotel room (door behind her, bed frame-right, lamp, hands over chest).
1. `back-right quarter view eye-level shot medium shot`: THE SCENE SWUNG - a new wall with desk, chair, phone
   (plausibly the reverse wall). She lands between profile and back-right quarter (short of 135). Tighter framing
   (thighs up). Outfit and hands kept.
2. `back view eye-level shot medium shot`: a true back view of her. Bed and lamp correctly move to frame-left, BUT the
   door wall stays in front of her - the room is MIRRORED, not reversed (the camera should face the wall the
   original camera stood at). Fabio: "no room has two doors like that".
3. `back view eye-level shot wide shot`: same mirrored room; it ADDED A BRA (the source has bare chest + hands) -
   outfit drift on a back view that cannot see the chest.
4. `front-right quarter view low-angle shot wide shot`: low angle NOT landed (camera about level), turn small,
   room rearranged (door gone, bed bottom-right). Face identity held very well.
FABIO's verdict: "not bad" - identity holds and it invents the unseen part of the scene. Back views not accurate.
Ideas from him: Qwen's two spare image slots could carry environment references; or the user edits the place later.
Open questions for the next hand tests: does an environment ref in image 2/3 fix the mirrored back view (the LoRA
was trained on single-image pairs - may ignore it); strength 1.0 or Tier 2 (8-step) for the low angle; zoom words
behave as absolute rungs, not relative to the source framing.
5. (Fabio: "this one is awesome") Source: Superman and a man in a red shirt + cap talking, red truck behind, city
   street, 1344x768. `front-right quarter view low-angle shot wide shot`: a REAL camera move - camera near the
   road, far back, both men small at frame-left-centre, the truck now seen from its front 3/4 (grille to camera),
   skyline + street lamp, the road as foreground. Low angle and wide BOTH landed here (they failed on the tight
   indoor portrait, test 4) - the LoRA likes open scenes with a ground plane. Costumes kept; faces too small to judge.
   Fabio: a second pass with another model can always fix what is off (place, details) - the orbit pass does not
   have to be perfect alone.

## Round orbit1 (2026-10-26, agent, Fabio's go: "a few on Hyper", does the 3-slider gizmo map?)
`research/orbit.py`, results `out/orbit1.json`, sheet `sheets/orbit1.jpg`. Own isolated app instance -> the app's
engine (not Fabio's bench), GPU lease, qwen-edit Tier 3 (Hyper) + angle LoRA 0.9, seed 111, ~50-60 s an edit on
the 4060 Ti. Inputs: MPI-1039 r70 eye-level street sources photo|111 + anime|222. 18 edits.
MAPPING CONFIRMED: the LoRA names the CAMERA's move, our gizmo the person's view -> left/right swap
(gizmo pr_r = `left side view`, tq_br = `back-left quarter view`; tq_fl = `front-right quarter view`).
| gizmo stop | LoRA words | photo | anime |
|---|---|---|---|
| tq_fl level | front-right quarter, eye-level, medium | FAIL: still facing camera, came closer (plaza did change) | FAIL: scene ERASED to white, frontal |
| pr_r level | left side, eye-level, medium | PASS profile facing frame-right, plaza swung | PASS, shop fronts swung |
| tq_br level | back-left quarter | PASS, plaza swung | PASS, street swung |
| back level | back view | PASS true back, a new facade ahead | PASS |
| front lo | front, low-angle | FAIL ~level | FAIL ~unchanged |
| front hi | front, high-angle | PASS steep high | PASS steep high |
| tq_fr hi | front-left quarter, elevated | high PASS, turn weak/unclear | same |
| front far | front, wide shot | FAIL: plaza REPLACED by a green field | FAIL: no change |
| front hs | front, close-up | PASS | PASS |
Identity, outfit and the flat anime style held in every cell; no doll, no ref needed. Softness OK at sheet size.
Read: turn slider works for profile -> back (6/6) but not the 3/4 FRONT stops (same weak spot as FLUX.3 had);
height: high yes, low no (Fabio's outdoor truck test DID go low - with wide shot); zoom: close-up yes, wide no.
Next (if Fabio wants): the failing stops only (tq_fl, front lo, front far) at strength 1.0 and Tier 2, 2 inputs.

## PARKED 2026-10-26 (Fabio, after orbit1)
Stopped here (context), may pick up later depending on the Multi-angle (MPI-1039) peers' results. Fabio's read:
- Qwen's problem is LOW-QUALITY imagery. Full resolution and Tier 2 (8 steps) might be a bit better - untested.
- He tried a FLUX.3 detail pass on a Qwen orbit result: it made it WORSE. So "detail with FLUX.3" is not the
  hi-res fix; an upscale with another model, or leaving it to the user, are the remaining options.
- FLUX.3 (the current character-mode recipe) looks a lot better in quality; it loses a little more identity than
  Qwen, which he expects a character sheet to fix.
Open if resumed: the three failing gizmo stops (3/4 front, low, far) at LoRA 1.0 / Tier 2 / full res; an upscale
candidate (PiD Qwen path first); the room-picture-in-image-2 idea for back views.
