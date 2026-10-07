# 3D scene - shoot exact-camera stills from a 360 pano

Design approved by Fabio 2026-10-07 ("1", sessions 26-27). The bake-era plan (Phases 0-5, 27
session notes, amendments 1-47) moved VERBATIM to
[research/plan-history-bake.md](research/plan-history-bake.md); the bake-era checklist to
[research/checklist-history-bake.md](research/checklist-history-bake.md). Evidence for every
single-shot finding: [validation.md](validation.md) § Single-shot ... § Extreme cameras.

## Current State

**Project mode:** `scalable-foundation`. Card in `doing`. **Next action: finish spike 0a's GPU half.**

**Session 28 (2026-10-07):** 0a's CPU half is built - `export_records.py` wrote ring8k as records
(`viewer/records/`, every layer's verts + faces round-trip the shots.py cache exactly; the
reference renders' black pixels equal the logged holes to 0.01%, so `render != 0` IS the known
mask) and `viewer/index.html` + `app.js` (three 0.170, rule C in the shader, reversed float depth,
seam column duplicated, sky-band toggle for the silhouette spikes, buttons: parity all / bench
1080p / self-check). Serve: `python -m http.server 8623 --bind 127.0.0.1 --directory
D:/WORK/MPI-623-spike/single_shot/viewer`, open `http://127.0.0.1:8623/`. NOT YET RUN: the peer
(MPI-1036) held the GPU lease all session; a lease holder was queued. Done meanwhile: 0d, A5,
the A2/A3 data layer (all in validation.md), A9 decided by Fabio.

**Two sessions on this card from here (Fabio, 2026-10-07):** a FRESH session builds the Scene
workspace shell (Parallel Batch item 2, without `sceneConvert`, which is Phase 2) and owns
plan.md / validation.md / checklist.md. Session 28 ("3D Scene 18") stays on spike 0a and writes
ONLY `D:\WORK\MPI-623-spike\` plus `research/spike-0a.md`; the shell session folds that file
into validation.md when it lands.

**The product (Fabio's why):** the 3D scene exists for EXACT camera placement - behind a house,
up a tree, on the floor looking up, inside a house through a shut window, a door frame, a gap
between buildings. The deliverable is the STILL from the placed camera. Locale consistency
from one image is a different card (MPI-1039, multi-angle Flow).

**What exists on master (Phase 1, 2026-08-29):** a Scene card is an IMAGE card whose item carries
`splatPath` (`js/data/projectModel.js:102`), `.meta/<id>.splat.ply` on `DERIVATIVE_RE`
(`routes/projects.js:113`), `Output_Splat` capture (`commandExecutor.js:2121`, `:2611-2618`;
`generationService.js:1497`) - all unconsumed by any Flow. The gallery's open intercept
(`MpiGalleryBlock.js:286-289`) and the `scene` kind/badge row (`js/utils/assetKinds.js:65`,
painted from the SELECTED item at `MpiGalleryGrid.js:1532-1549`) both read the **selected**
item only. MpiNodes has `MpiBrushTrain` (`splat.py:170`) and no 3D/depth node.

**The spike that proved the route** (`D:\WORK\MPI-623-spike\single_shot\`):
- Pano depth: MoGe v1 (`Ruicheng/moge-vitl`, 1.26 GB) on the pano resized to 2048x1024, 12
  icosahedron views merged (`pano_splat.py:36-44`, SplatKit `matrix3d_pipeline.py:435-451`);
  ~30-56 s. Mesh = 1024x2048 grid, sky pushed to 2x max depth, colour sampled from the 8K pano
  by direction (`shots.py:52-53, 120-132, 250-264`).
- Renderer: SplatKit's PURE-TORCH shim of nvdiffrast's API (`shim/nvdiffrast_shim.py`) - not
  real nvdiffrast (which is non-commercial, NVIDIA Source Code License 3.3). Outputs colour,
  camera z, face id.
- Hole rule C (`shots.py:155-181, 279-312`): black = uncovered or depth-edge tear; + faces seen
  from BEHIND (per-face affine det < 0); + STRETCH (largest singular value > 3); a window rect
  drops its back faces so the room sees out.
- Fill: Klein 9B via `comfy_workflows/klein_9b_t2i.json`, title injection, `Input_wf_type` 5 =
  inpaint (LanPaint, white = fill), 4 = whole-frame edit; ~33 s at 1280x720 (first call ~40 s).
  Prompts: `GENERIC` (`chain.py:53-56`), `INTERIOR` (`shots.py:67-72`), user line appended as
  `In the large empty areas: <text>.`
- Lift (`chain.py:264-292`): MoGe on the fill, `z = a*zm + b` least-squares on known pixels
  (eroded 9x9), keep dilated hole pixels off depth edges, back-project, grid-mesh; fit error
  1.2-4.4% on open layouts, up to 12% when holes dominate. Composite = z-test.
- Clean-up B: whole-frame Klein edit (returns 1360x768, resized back) + Reinhard LAB lock
  (`color_lock.py:20-24`), ~29-35 s; ALWAYS on (Fabio).
- AnimeSharp 4x model-only, wrap-padded: 2K -> 8K in 25-30 s, seam clean (`run_animesharp2k.py`).

**Engine facts:** neither engine runs a node's `requirements.txt` - pip deps go through the
curated `dev_configs/python_deps.in` (already has `trimesh`, `kornia`, `scipy`,
`scikit-image`, `color-matcher==0.6.0`, `opencv-contrib-python-headless`). The Pod image has no
CUDA dev toolkit, so compiled CUDA extensions are out - pure torch only. MoGe was never a
declared dep (SplatKit fetched it at runtime; SplatKit and Mickmumpitz left the engine lock in
`b3c25a678` / `edff37f2a`). New MpiNodes nodes obey `registry-safety.md` (no runtime download,
paths via `resolve_in_comfy_dir`, no subprocess, no HTTP route).

**App facts:** no 3D library in `package.json`; no `loseContext` anywhere in `js/`; no
add-a-workspace doc (touch list: `js/router.js:11-13`, `js/shell/navigation.js:195-206,
276-319, 546-558`, `js/shell/focusModeService.js:38`, `MpiFlowLibrary.js:100`,
`agentService.js:215`, `agentDispatch.js:457/510`, `preloadStyles.js`, `types.js`). History:
`appendToHistory` selects the newest entry (`projectModel.js:226-229`); right-click `Add to
gallery` is single-entry and re-uploads without `splatPath` (`MpiHistoryList.js:235`,
`MpiGroupHistoryBlock.js:3447-3500`); no stack-from-entries exists; `STACKABLE_KINDS =
['image','video']`. Per-item sidecar fields go through `POST /project-media/:id/update-meta`
(`routes/projects.js:1472`; video `trim` is the template, `MpiGroupHistoryBlock.js:3694-3707`;
parity rule `docs/project-integrity.md:195`). Dev gate: `APP_CONFIG.dev_mode` (`docs/shell.md:24`).
Flows have NO dev gate of their own (`listFlows()` unfiltered).

## Design (approved)

1. **Making the scene.** The 360 Pano Flow makes the pano and upscales it to 8K itself
   (Ostris Krea2 edit pack + Mickmumpitz's MIT 360 LoRAs, fast tier only, flat-sky wrap soften
   before the seam pass, AnimeSharp wrap-padded). Tile upscaler = MPI-1038. No splat Flow.
   **Convert** gives the SAME card its scene: right-click **Convert to 360 pano** on a plain
   image (Fabio 2026-10-07: the app cannot tell a pano from a 2:1 banner, so the user says so);
   the Pano Flow ends with the same Convert, so its cards land converted. A card opens in the
   Scene workspace on a normal left-click once it HAS a scene, never before. Convert
   auto-upscales under 8K with the same step; above 8K it works at 8K and keeps the original.
2. **Explore.** Fly camera (WASD, Q/E down/up, drag rotate). **The viewer IS the shot**: what
   the viewer shows is what the picture starts from; nothing that only exists at picture time.
3. **Build here** (on demand, only the spots the user picks): fill everything around the camera
   (one 360 fill) and add it to the scene. Inside a house: the room around the camera, the
   windows on the walls around it become SHUT GLASS with the real outside behind. Behind an
   object: its hidden side. The fill line steers it.
4. **Picture panel:** lens mm (~12-85), aspect (16:9 / 9:16 / 1:1 / 2.39:1 frame guides), roll
   keys, height readout in metres (pano eye = 1.6 m), **depth of field** (click to focus, blur by
   real depth), fill line + presets (Forest, More houses, Open fields, free text), Take picture.
   All live in the viewer. Output ~1 MP per aspect (Klein's size); bigger = MPI-1038.
5. **Take picture** = rule C holes -> Klein inpaint (`GENERIC`, or `INTERIOR` by itself when most
   of the frame is seen from behind) -> lift the fill into the scene -> clean-up B (always) ->
   depth of field.
6. **Pictures are history entries** of the scene card; clicking one flies the camera to its pose;
   right-click `Add to gallery`; several selected -> a stack (new). Gallery face = the selected
   entry + the 3D badge.
7. **Later / limits:** Wan bake = a coming-soon tool; stand-in figure and standing props = own
   cards. Limits stated to users: grass is flat paint, flat 2D styles bend under big moves,
   never-seen parts are invented (the well became a basin).

## Architecture decisions (front-loaded, scalable-foundation)

- **A1. ONE renderer, in the app (WebGL2 + three.js, MIT).** The viewer and the picture's base
  render are the same code, so "the viewer IS the shot" holds by construction, it works
  unchanged with the RunPod remote engine (render locally, send two PNGs), and there is no
  Python renderer to keep in parity. Rule C in the fragment shader: back face =
  `!gl_FrontFacing`; stretch = screen-space derivatives of the source texel coordinate (one
  source texel > 3 px); depth-edge flag as a vertex attribute; MRT outputs colour, hole mask,
  camera z. three.js because camera maths, render targets and MRT are solved there; raw WebGL2
  would rebuild them. Spike 0a proves parity before any product code.
- **A2. A scene = records of "image + depth + camera".** The pano is one equirect record
  (8K image, 1024x2048 float depth); every fill layer is one pinhole record (fill PNG, aligned
  float depth, keep mask, pose + intrinsics). The app meshes each record as a grid - the pano
  and a layer are the same code path with two projections. Stored as companions of the pano
  ITEM: manifest `.meta/<id>.scene.json` + `.meta/<id>.scene.*` files, on `DERIVATIVE_RE`
  (add `scene`), referenced by a NEW item field **`scenePath`**. `splatPath` stays exactly as
  it is, for the future Wan bake's `.ply` (its capture plumbing is that tool's, not dead code).
- **A3. Scene-ness is found on the CARD, not the selected entry.** One helper
  `getSceneItem(group)` (first item with `scenePath || splatPath`) drives the open intercept,
  the 3D badge, the `scene` kind filter row and Add-to-project companion copying. Otherwise
  selecting a picture turns the card into a plain image everywhere.
- **A4. The engine does only the AI.** New pure-torch MpiNodes nodes, MoGe v1 inference code
  VENDORED into the pack (MIT; SplatKit vendored the same code), weights shipped as an app dep
  from R2 (no runtime download): `MpiPanoDepth` (equirect depth), `MpiLiftDepth` (MoGe on an
  image + least-squares fit to a known-depth map + keep mask), `MpiWrapPad` / `MpiWrapCrop`
  (shared by Convert and the Pano Flow), `MpiWrapSoften` and `MpiWrapCutMerge` (Pano Flow).
  Float depth crosses the wire as a 32-bit file in `output/` (path via `resolve_in_comfy_dir`).
  Reinhard runs in the APP beside depth of field (0d: KJNodes and `color-matcher` are GPL-3).
- **A5. Take picture is ONE press, three jobs - SETTLED 2026-10-07** (validation.md § A5): a
  scene sequencer calls `enqueueGeneration` per step with `deferCommit: true` (Cutout's Remove
  Background is the precedent): `klein-9b` `inpaint` -> `sceneLift` -> `klein-9b` `kleinEdit`
  -> Reinhard + depth of field in the app -> one history entry. The Flow `chain` cannot carry
  it (two universal legs, each landing a card); no copy of the Klein graph is needed.
- **A6. Depth of field runs in the app** (same shader in the viewer and on the final picture,
  using the picture's own depth: rendered z + the lifted fill's depth).
- **A7. A picture's pose is an item sidecar field `scenePose`** (position, yaw/pitch/roll, mm,
  aspect, focus distance, f-stop, fill line) through `update-meta`, mirrored on the live item
  (the `trim` pattern), parity rule honoured.
- **A8. Gate = `APP_CONFIG.dev_mode` on master, not a long-lived branch.** The shared tree has
  many peers; a weeks-long branch rots. Hidden in a released build: the Scene workspace entry,
  the right-click Convert to 360 pano, the Pano Flow tile (a `devOnly` FlowDef flag filtered in `listFlows()` - the
  mechanism does not exist yet). Adding a workspace bumps the 2nd version digit at release
  (`docs/versioning.md:43`) - the version itself is Fabio's call.
- **A9. Which cards open in Scene - DECIDED (Fabio 2026-10-07):** exactly the cards with a scene
  item (`getSceneItem`, already the gallery intercept). A plain image gets right-click
  **Convert to 360 pano** (offered on an image card with no scene, behind `dev_mode`; my pick:
  only at exactly 2:1, the shape Convert's equirect maths needs); it runs `sceneConvert` on the
  SAME card and writes `scenePath`. The Pano Flow's last step is that Convert (my pick: one
  opening rule, no `flowPano360` special case).

## Completed

- [x] Phase 1 (2026-08-29): scene card as an image card carrying a companion - see history.
- [x] Single-shot route proven on the bench (sessions 24-26): no-bake chain, GENERIC fill
      prompt, rule C + clean-up B on four extreme cameras (Fabio "1").
- [x] Design brainstorm (sessions 26-27): § Design above, Fabio "1".

## Remaining Work

### Phase 0: Single-shot spikes (bench + a scratch HTML page, NO product code)

All files in `D:\WORK\MPI-623-spike\single_shot\`; every GPU run via `gpu_lease.py run` with
the bench queue empty. Ordered; no batch - one GPU and each spike feeds the next (0d is research
only and may run beside the others).

- [ ] **0a. App-side renderer parity.** Export ring8k as records (pano 8K + depth `.f32`, the
      walk's 8 layers as fill PNG + depth + pose; CPU script). A standalone three.js page renders
      them with rule C in the shader at the four extreme cameras (window, treetop, floor,
      behind_well) and flies them. Fix the hair-thin sky-silhouette spikes here (depth-edge flag
      into the sky). **Verify:** vs `shots.py` rule C at the same cameras - hole-mask IoU >= 0.98
      and mean abs colour diff <= 2/255 on known pixels, all four; no spikes on the floor still
      by eye; >= 60 fps at 1080p on the 4060 Ti with all layers; VRAM held by the page measured
      against Klein's ~14.5 GB-free need (a number in validation.md, and the release rule if it
      collides: the viewer frees its buffers during Take picture).
- [ ] **0b. Build here.** From inside the window house and behind the well: 6 cube views (90°,
      1024x1024) around the camera, each render -> Klein inpaint -> lift -> next (`INTERIOR` when
      > 50% back faces); SAM3 text `window, door` on the pano crop of the walls around the camera
      -> those faces' back sides dropped (glass), and the interior wording asks for a CLOSED
      window with glass panes. **Verify (user-ux):** Fabio flies both built spots in the 0a page
      and two pictures in each agree; time per build recorded (target <= 6 min on the 4060 Ti).
- [ ] **0c. Depth of field.** Thin-lens blur by camera z on the four extreme stills (focus near
      and far), and live in the 0a page. **Verify (user-ux):** Fabio's eye on the stills.
- [x] **0d. Licences and deps** (2026-10-07): all MIT / Apache-2.0, no STOP; Reinhard moves to
      the app (KJNodes + `color-matcher` are GPL-3); MoGe vendoring strip list in validation.md.

### Phase 1: Scene card - COMPLETE (history). Its `user-ux` look moved to Phase 4's end check.

### Phase 2: Engine nodes and ops (sequential - one owner of the pin, the deps and the op registry)

**Verify mode:** `auto`.

- [x] **Settle A5** (2026-10-07, pulled forward while the GPU was busy): sequencer over
      `enqueueGeneration` + `deferCommit`, existing Klein model ops. Its test is Phase 3's.
- [ ] **MpiNodes** (`/mpi-nodes-sync`, the sibling's new-node procedure read inline): vendored
      MoGe v1, `MpiPanoDepth`, `MpiLiftDepth`, `MpiWrapPad`, `MpiWrapCrop`, `MpiWrapSoften`,
      `MpiWrapCutMerge`; add utils3d's MIT notice to the vendored tree. **Verify:** CPU unit tests on tiny
      tensors; one bench GPU run reproduces the spike - pano depth vs `pano_depth_ring8k.npz`
      rel err < 1%, lift fit error matches `chain_ring8k_gen.log` per step.
- [ ] **Ship the pack and the weights:** commit, push, pin in `dev_configs/node_lock.json`; MoGe
      weights as a dep via `/mpi-add-model`'s deps half (R2, SHA). **Verify:** presence check
      green on the local engine; a Pod connect installs the pack with no image rebuild.
- [ ] **Universal ops + graphs:** `sceneConvert` (wrap-padded AnimeSharp when < 8K, cap 8K,
      `MpiPanoDepth`), `sceneLift` (`MpiLiftDepth` on a fill + the known-depth map + keep mask;
      Take picture and Build here both sequence it after Klein's own `inpaint`, A5),
      registered in the 4 files (`commandRegistry.js`, `universal_workflows.js`,
      `operationRegistry.js`, `operation_registry.json`). **Verify:** op/registry tests green;
      one live dispatch of each on an ISOLATED app (`npm run app:isolated`), outputs match the
      spike's numbers.

### Parallel Batch: Pano Flow + Scene workspace shell

Runs after Phase 2. Both consume Phase 2's nodes/ops and touch disjoint files. Route through
`mpi-execute-parallel`.

- [ ] **360 Panorama Flow** via `/mpi-add-flow` (TEXT2SPHERE + IMG2SPHERE, op `flowPano360`,
      `devOnly`): Ostris pack + both 360 LoRAs as deps (re-add by hand, never revert
      `edff37f2a`), fast tier only, `MpiWrapSoften` before the 0.45 seam pass, AnimeSharp
      wrap-padded to 8K, then `sceneConvert`'s depth so the card lands converted (A9), the
      `devOnly` filter in `listFlows()`; graphics via `/mpi-flow-graphics`.
      Ownership: `js/data/flowsRegistry.js`, `comfy_workflows/flow_pano360*.json`,
      `js/data/commandRegistry.js`, `js/data/modelConstants/universal_workflows.js`,
      `js/core/operationRegistry.js`, `operation_registry.json`,
      `js/data/modelConstants/nodesDeps.js`, `js/data/modelConstants/assetDeps.js`,
      `dev_configs/node_lock.json`, the Flow's preview assets, its `docs/` page.
      Briefings: `comfy_engine`, `comfy_injection`, `versioning` + the add-flow playbook.
      **Verify:** text -> 360 and image -> 360 on an isolated app give a seam-clean 8K
      (`seam8k.py` ratio <= 2x median); the tile is hidden with `dev_mode` off.
- [ ] **Scene workspace shell + Convert:** `PAGE_SCENE` (all touch-list sites above), Block
      `MpiSceneBlock`, Primitive `MpiSceneCanvas` owning the GL context (teardown: cancel RAF,
      disconnect observers, `WEBGL_lose_context`, zero canvas dims, null refs - new code),
      `scenePath` + `getSceneItem` (A2/A3) incl. `DERIVATIVE_RE` and the Add-to-project copy,
      A9 behind `dev_mode`: the gallery right-click **Convert to 360 pano** calling
      `sceneConvert` and writing `scenePath` on the SAME card, and the intercept navigating to
      `PAGE_SCENE` instead of today's "not built yet" toast. Ownership: `js/router.js`, `js/shell/navigation.js`,
      `js/shell/focusModeService.js`, `js/shell/preloadStyles.js`, `js/components/types.js`,
      `js/components/Blocks/MpiSceneBlock/**`, `js/components/Primitives/MpiSceneCanvas/**`,
      `js/services/scene/**` (new), `js/data/projectModel.js`, `routes/projects.js`,
      `js/utils/assetKinds.js`, `MpiGalleryBlock.js`, `MpiGalleryGrid.js`, `MpiFlowLibrary.js`
      **(A2/A3 data layer LANDED 2026-10-07: `scenePath`, `getSceneItem`, `scene` in
      `DERIVATIVE_RE`, add-from-cards copies the set, kind/chip/filter/intercept/stacking read
      the card - `tests/scene-companion.test.cjs`. Left here: the `scenePath` WRITER is Convert's.)**
      (page check only), `agentService.js` / `agentDispatch.js` (page maps only),
      `package.json` + lock (three), `styles/` for the new Block, `tests/scene-*.cjs`,
      `tests/desktop/scene-*.spec.js`. Briefings: `components`, `dos_and_donts`, `workspaces`,
      `state`, `events`, `component-mounts`. **Verify:** unit tests for `getSceneItem` and the
      companion regex/copy; desktop spec: enter/leave Scene 10x leaves no live GL context, a card
      whose selected entry is a plain picture still opens Scene and keeps its badge; Convert on a
      2K pano on an isolated app writes the manifest + depth + 8K companion.

### Phase 3: Explore, picture, build (sequential - one Block, one renderer)

**Verify mode:** `user-ux` at the phase end; each task self-verifies first.

- [ ] **Viewer:** port 0a's renderer into `js/services/scene/`; fly controls through
      `Hotkeys.bind` + `hotkeyRegistry.js` (WASD, Q/E, roll keys); frame guides, height readout,
      lens, depth-of-field preview. **Verify:** desktop spec renders a fixed pose of a fixture
      scene and matches a golden PNG within 2/255.
- [ ] **Picture panel + Take picture:** components only (ComponentFactory), fill line + presets
      (Character-Sheet-style picker), render base + mask at Klein size per aspect -> `scenePicture`
      -> add the fill layer to the manifest -> depth of field -> upload as a history entry with
      `scenePose` (A7); entry click flies the camera to its pose. `INTERIOR` switch at > 50%
      back faces. **Verify:** on an isolated app, poses set to the four spike cameras produce
      stills that match the spike's by eye; a spec clicks an entry and asserts the camera pose.
- [ ] **Build here:** 0b's loop as a tool (progress, cancel), SAM3 glass windows, fill line.
      **Verify:** isolated run inside a house builds the room and its windows show the real
      outside; time within 0b's measured budget.
- [ ] **History -> gallery:** multi-select in `MpiHistoryList` -> `Add to gallery` makes one
      stack of plain image cards (`stackGroups`); single stays as today. **Verify:** spec selects
      three entries -> one stack of three image cards, none carrying `scenePath`.
- [ ] **Wan bake** as a disabled coming-soon tool with a tooltip. **Verify:** visible, inert.
- [ ] **End check (user-ux, includes Phase 1's deferred look):** Fabio makes a pano, converts it,
      flies, builds one interior, takes pictures from the four kinds of spot, sends three to the
      gallery as a stack, copies the card to a second project (companions travel), deletes it
      (no companion left).

### Phase 4: Docs, rules, release prep

- [ ] `docs/scenes.md` (new subsystem doc, routed from `docs/README.md`): A1-A9, the record
      format, rule C, the timings, the limits. **Verify:** <= 200 lines, every symbol greps.
- [ ] Ask Fabio before touching `.claude/rules/` (workspaces.md says "three"; component maps via
      `mpic-update-component-map`). **Verify:** his yes recorded, or the drift noted.
- [ ] Privacy check: MoGe weights come from our R2 - no new outbound service. **Verify:** none
      added, or `cubric.studio/privacy/` updated in the same job.

## Plan Drift

- **2026-10-07 - the bake became the single shot.** Phases 2-5 of the bake plan are superseded
  (history file). The Wan bake survives only as a coming-soon tool.
- **2026-10-07 - the renderer moved to the app (A1).** The spike renders in Python; the product
  renders in WebGL so the viewer and the picture cannot drift. Spike 0a is the price.
- **2026-10-07 - "~1.4 MP" said to Fabio in the brainstorm was wrong:** Klein's 16:9 output is
  1360x768 (~1 MP).
- **2026-10-07 - A9 decided by Fabio:** no auto-open for a 2:1 image (a banner is not always a
  pano); right-click **Convert to 360 pano** converts the card, then a left-click opens Scene.
  Convert left the Scene workspace for the gallery menu; the Pano Flow converts at its end.
- **2026-10-07 - A5 settled on neither planned route.** The op is `inpaint` on `klein-9b`, not a
  `kleinInpaint`; `scenePicture` is no longer a universal op (Phase 2's op list drops it), the
  sequencer lives in `js/services/scene/` (Phase 3) and needs `sceneLift` from Phase 2.

## Verification

**Verify mode:** `user-ux`

Phase 0 spikes 0a/0d and Phase 2 are `auto`; 0b, 0c and Phase 3's end check need Fabio's eye.

End-to-end:
1. A text prompt -> 360 Pano Flow -> 8K seam-clean pano card, already converted, that opens in
   the Scene workspace on a left-click.
2. Right-click Convert to 360 pano on a plain 2:1 image (also a 2K one: auto-upscaled) gives the
   same card a scene; before it, a left-click opens Group History as for any picture; after it,
   Scene, and the 3D badge stays whichever entry is selected.
3. Flying shows exactly what Take picture starts from (A1); pictures from treetop, floor,
   behind an object and inside a built room through a shut window all pass Fabio's eye.
4. Clicking a picture entry restores its camera; several entries -> one gallery stack.
5. The card copies to another project with every companion and deletes without leaking any.
6. Works with the RunPod remote engine (only PNGs and depth files cross the wire).
7. `npm test`, `npm run test:desktop`, `npm run lint`, `npm run release:check` green; with
   `dev_mode` off, nothing of this card is visible.

## Preservation Notes

- `docs/scenes.md` owns the durable facts (A2 record format, rule C, MoGe fit, timings,
  limits). The Phase 1 contract note from the history file moves there, updated for `scenePath`.
- Licence notices to carry: MoGe (MIT; DINOv2 parts Apache-2.0), three.js (MIT), Mickmumpitz
  360 LoRAs (MIT), Ostris Krea2 edit pack (MIT). Real nvdiffrast is NON-commercial - never
  vendor it; SplatKit's shim is the pure-torch stand-in.
- For `docs/models/krea2/editing.md`: an ai-toolkit "Ostris edit" LoRA does NOT run on
  lbouaraba's `Krea2EditModelPatch`; it needs `ostris/ComfyUI-Krea2-Ostris-Edit`.
- For the Pano Flow doc: tiled refines do not wrap - wrap-pad before, crop after; the 0.45 seam
  pass CREATES a light ridge in flat sky unless the wrap edge is softened there first.
- Klein plants the prompt's NOUNS in every hole - the fill line names areas, never landmarks.
- A ComfyUI node's registered type is not necessarily its Python class name - trust the
  workflow JSON.
