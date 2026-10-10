# 3D scene - shoot exact-camera stills from a 360 pano

Design approved by Fabio 2026-10-07 ("1", sessions 26-27). The bake-era plan (Phases 0-5, 27
session notes, amendments 1-47) moved VERBATIM to
[research/plan-history-bake.md](research/plan-history-bake.md); the bake-era checklist to
[research/checklist-history-bake.md](research/checklist-history-bake.md). Evidence for every
single-shot finding: [validation.md](validation.md) § Single-shot ... § Extreme cameras.

## Current State

**Project mode:** `scalable-foundation`. Card in `doing`. **Session 43 (2026-10-10, "3D Scene 33", no
GPU job): Render path is READY for RunPod** (validation.md § Render path on RunPod: readiness). Dev Pods
boot `v0.26.0-dev` (mpi-ci `c9ca454`: ComfyUI-GGUF + pip gguf baked, MpiNodes d721182; CI 38017503044
green, both tags pull-verified; Vision `545b1ac0f` moved only the DEV consts). R2 lacked ALL FOUR Render
path weights (a 404 never fails over to the HF mirror, the Pod has none): uploaded with Fabio's yes
(given for the LoRA; the other three are the same job, permissive licences, ~$0.19/mo). The status line
now says "about N minutes on this GPU": `pathEtaMin` scales the 1810 s 4060 Ti run by `GPU_GEN_SECS`
(4060 Ti anchored on the A4000's 9.42 s - an estimate). **Next (Fabio, 2026-10-11):** restart his app
(routes/ bake the dev tag), connect an RTX PRO 6000 Pod, install `scene-path` (~20 GB from R2), lay
points, Render path. Then re-anchor `PATH_RUN` on the Pod's measured seconds (a table card) and say
the price of anything beyond his own test first. Still open: his eye on the path-ball fix; P3.
MPI-1043 told by state message (its MpiNodes-sync item is done; its scoped smoke + release rebuild must
use/bake GGUF). **Morning of 2026-10-10 (same session):** Fabio restarted; his first PRO 6000 Pod
(`bswhp64gs1z4v1`, EU-RO-1, image `v0.26.0-dev-cu130` per app.log + console) sat 8 min in
"Initializing" with EMPTY System logs (the pull never started: a host stall, not the image; he deleted
it). A CPU Pod on the same volume `lpja78wof3` came up fine; he installed the `scene-path` plugin (20 GB,
from R2, all four weights fetched) + Qwen 2.1's new style LoRAs (volume 59.3 -> 80.5 GB). **Mystery
(not root-caused):** on the CPU Pod every model read NOT installed (0/24) though the weights were on the
volume; the Qwen install re-fetched 4 volume node packs (MpiNodes, UltimateSDUpscale,
inpaint-cropandstitch, LanPaint) and Klein 9B + SDXL Realistic flipped to installed. Something drops
code-only node packs from the volume between Pods (10-09's installs re-fetched the same 4); not start.sh's
dedupe (baked twins only), no rmtree at boot. Fabio's call pending: a research card for it. **Next:**
Fabio connects the PRO 6000 again, then Render path (give him the steps). Note `lpja78wof3` was made
2026-10-09 09:09; the old 360 GB smoke volume `0gzc4yk344` is gone. **Session 42 (2026-10-10, "3D Scene 32"):
P2 RAN LIVE through the app** (validation.md § Paths P2 LIVE): Fabio restarted, the engine has GGUF +
`MpiWanMaskedVideo`; the real Render path button landed `cameraPathVideo_001` in 1810 s, known corr
median +0.975 (bench +0.972), a warm room with a fireplace behind the window. Copied into
`Projects/MPI-623` as card `Path - into the cottage` (`add_card.py`, session 42 scratchpad; his app
persists whole itemGroups, so he reopens the project to see it). **Fabio passed it by eye** ("proved
it can do interiors"). It plays as a FLAT equirect video: looking around in it is P3. Fabio found a
P1 bug: path balls drawn at the raw y-up pose spot in the y-down world (a high point showed mirrored
under the ground). FIXED (`poseToWorld` + `pathMeshes`, test + mutant; his eye on it after a restart
is pending). Fabio: NO per-point camera direction needed (the video is 360). **Next (Fabio's ask):
Render path on RunPod** - he wants to test on an RTX PRO 6000. Needs (1) a Pod image rebuild baking
ComfyUI-GGUF + pip gguf + MpiNodes d721182 (mpi-ci `node_lock.json` / `python_deps.txt` are in
MPI-1043's files.json - one rebuild for both; `build-cu128-v040.log` there suggests MPI-1043 already
built one: read it first), (2) the R2 upload of `wan21-pano360-lora`, (3) state the build price
before spending. Also: the "about 30 minutes on a 16 GB card" status line should come from the
per-GPU gen-speed table (MPI-1055), not a constant. Then P3. Nothing of P2 is uncommitted
except these task files. **Session 41 (2026-10-09, "3D Scene 31"):
P2 planned and half built** (§ Remaining Work > Paths P2). Fabio: run it on his card under the
lease, no RunPod yet. Built + unit-tested: `pathFrames`, `stitchPano` / `renderPano` (uncommitted).
Guide video of a path through the round window rendered live (scratchpad `p2_window/`, rig
`stage.py` + `guide.cjs` in session 41's scratchpad). **Wan filled it on the bench: 28 min, known
corr median +0.972, a coherent invented room** (`p2_wan.py`, `corr.py`; out
D:/WORK/Images/Outputs/mpi623_p2/). **Fabio: "Awesomeness. 1".** Then WIRED into the app (all
unit-tested, `npm test` 2837/0, lint clean, NOT yet run live): MpiNodes `d721182`
`MpiWanMaskedVideo` (SplatKit port, identical tensors) pushed + pinned; ComfyUI-GGUF back in
node_lock + nodesDeps + pip `gguf` (python_deps); deps `wan21-i2v-720p-q4`, `clip-vision-h`,
`wan21-pano360-lora` (R2 only, NOT uploaded yet), `wan21-lightx2v-distill`; plugin `scene-path`;
op `scenePathVideo` (4 places) + `scene_path_video.json`; route `frames-to-video`
(routes/projects.js); `scenePathVideo.js` `renderPath`; MpiSceneBlock **Render path** button.
The ~20.5 GB of weights were COPIED (not downloaded) into G:/CubricModels under the dep names
(Fabio freed 20 GB; G: ~8.5 GB left). **Next:** Fabio restarts his app (engine installs GGUF + pip
gguf + MpiNodes d721182), then the live run: `gpu_lease.py run --timeout 14400 --poll 2 -- node
<s41 scratchpad>/p2_live.cjs '[[0,0,0],[0,-0.1,-0.45],[0,-0.145,-0.79],[0,-0.145,-1.25]]' '<line>'`
(clicks the real button in an agent app on the scratch copy `MPI-623 P2`, waits for the card).
Then: score it (split the guide mp4 into top/bottom, `corr.py`), put the card in
Projects/MPI-623, Fabio's eye. Your-call items: R2 upload of the 360 LoRA (0.3 GB, needed for
anyone but Fabio); a Pod image rebuild before Render path works on RunPod. Also done:
MPI-1036's ask - pin MpiNodes `88816c8` + its changelog line (uncommitted; message resolved).
**Session 40 (2026-10-09, "3D Scene 30",
CPU only): both behind_well by-eye items explained** (validation.md § behind_well's two by-eye items):
the up view's black blob = black Klein left in its own fill (1 of 36 build fills); the 0.51 = the
whole near floor floating (affine fit b < 0; the guard did not fire; the clamp is one-sided). Offline
A/B (`abfit.py`, `abfloor.py`): "affine, scale-only when b < 0" fixes both outside floats and is never
worse outside; inside it is mixed. Floor-aware fits: no one-scale fit puts Klein's room on both the
walls and the ground (pinning the floor puts the walls off ~2x). **Fabio "go with your picks":**
MpiNodes `db3bdc7` pushed + pinned (scale-only on b < 0 when the frame has no back faces; 15/15, 3
mutants; offline the 5 outside b < 0 views all better). Live (`well_shift`): every near floor 1.00.
The live run exposed two more, both FIXED in the app (unit + mutants) and LIVE (`well_wait` /
`win_wait`): the window's Build here failed at view 3 (nothing known yet behind, inside) -> a blind
view now waits for the rest, then is skipped (not needed live this run); a fill leaving > 0.5% black
in its holes runs once more (fired live: 2.47% -> 0.00%). App changes + pin UNCOMMITTED (handoff /
close-out commits). Exported for his fly-through: `MPI-623 Fixes - behind well` / `- window`.
**PIVOT (Fabio, after flying them): paths + Wan** (§ Plan Drift 2026-10-09). **P1 path editor
BUILT + checked live in an isolated app** (validation.md § Paths P1): P / Add point, balls + tubes,
saved on the pano sidecar as `cameraPaths`. **Fabio's eye on P1: "1" (passed).** Test projects
MERGED into ONE `Projects/MPI-623` (cards Convert test / Fixes - behind well / Fixes - window; the
seven old folders in the Recycle Bin; `merge623.py`, session 40 scratchpad). **Future runs Fabio
should see go in as new cards there**, never a new project. **Next:** P2 = render a path with Wan
(Matrix-3D rail, research/plan-history-bake.md) - plan it first (Pod vs local ~35 min a rail).
Room floor / SAM3 / DoF parked behind the pivot.
**Session 39 (2026-10-09, "3D Scene 29"):
the straight-down wording is BUILT and LIVE at both spots** (validation.md § The straight-down
wording): `fillPrompt(..., pitch)` - pitched down past 60 degrees, `DOWN` outside / `FLOOR` + style
inside (A/B `abdown.py`, session 39 scratchpad: GENERIC = courtyard + sky, ROOM = a level box room,
both seeds; the new lines = ground / floor from above, both seeds). Unit 15/15, 4 mutants killed,
docs/scenes.md step 2. **Found in the live run, not from the wording:** the window's turned-180
picture failed in the lift ("fewer than 2 known pixels") - build view 3 kept 6% because the lift's
`a*zm + b` fit ran on one edge-on wall strip with no depth spread (`scene3d/lift.py:52-58`). **Fixed
(Fabio "let's try that approach"):** MpiNodes `972dc22` pushed + pinned - scale-only fit when the fit
pixels' MoGe depth p90/p10 < 1.05 or the slope <= 0 (offline on the real views: 6% -> 90% kept, 16 of
18 views unchanged; `liftrepro.py`); the app stops a frame with no known z before Klein. **LIVE at
both spots after Fabio's restart** (`run_fit.sh` -> `well_fit` / `win_fit`): the window's turned-180
picture now passes (no holes, behind layer 88% kept). **Next:** by eye - behind_well's up view black
blob, its behind layer's near floor at 0.51 (`liftrepro.py well_fit` says whether the guard fired);
then the room floor above the ground, Fabio's fly-through; then SAM3 glass windows, DoF after 0c.
**Session 38, later (Fabio "go with your
picks on all three"):** built + checked, NOT yet live: interior style (describer phrase, `insideAt`
per spot, `ROOM` wording), on-screen gap paint (`uGaps`), the ground plane in the lift (MpiNodes
`87d7962` pushed + pinned; app `groundAt` / `groundPlane` / `Input_Ground`). **LIVE at both spots
after Fabio's restart:** 0% of any layer under the ground, the room closed and in style, no rims on
screen (`run_both.sh`, `analyze.py`; exported `MPI-623 Ground - behind well` / `- window`). **Next
(Fabio "go", 2026-10-09):** a straight-down wording for Build here's DOWN view (pitch -PITCH_MAX):
Klein paints a courtyard + sky into it, laid on the floor. Bench A/B first like `abclosed.py` (the
down frame of `well_ground/project`), wire the winner (a view looking down -> its own line), re-run
`run_both.sh`. Also open by eye: the room floor above the ground (interior fit), Fabio's fly-through
of the two `MPI-623 Ground` projects. Then SAM3 glass windows, DoF after 0c. validation.md § Fabio's three picks.
**Session 38 (2026-10-08, "3D Scene 28"):**
describe/enhance already follow Remote > Language Models (`describeImage`, `settleInGraphEnhance`; no
card needed). Fabio flew behind_well: built the card-stays-on-pano rule, Shift x4, the stepped lens
slider, presets removed (validation.md § Fly-through). **Measured: the near floor sinks 2.4-6x**
(the lift's affine fit extrapolates) - fix route is Fabio's call (my pick: a ground-plane prior in
`MpiLiftDepth`). Interior-style A/B (`abstyle.py`, session 38 scratchpad: the pano's style captioned
on the ComfyUI describer, D = INTERIOR + phrase, E = D + pano ref, seeds 42/7, out
`D:/WORK/Images/Outputs/mpi623_abstyle/`) was queued behind a peer's lease; wire the winner through
`describeImage` (Remote's pick). **Session 37 (2026-10-08): Interior lift
re-take PASSED (12.3%) and Build here BUILT + run live at both 0b spots** (validation.md § Build
here): window 265 s -> window frame 1.9% holes; behind_well 295 s -> 6.3%; projects exported to
Fabio's Projects folder (`MPI-623 Build here - window` / `- behind well`) for his fly-through.
**Open: the interior fill's STYLE** - Klein paints a modern photoreal apartment inside the cartoon
cottage (the first view is 96% black; INTERIOR's "match the image" carries nothing). Fabio's idea:
the pano as Klein's reference image 2 (the inpaint graph already chains `Input_Image_2` as
`ReferenceLatent` 2 on the LanPaint sampler; only the app's `inpaint` op has no second image slot).
Bench A/B `abref/abref.py` (session 37 scratchpad): A today / B pano ref + style-only line / C pano
ref alone, seeds 42 + 7, on build view 1 (frame/mask in `D:/WORK/Images/Outputs/mpi623_abref/in/`,
outputs `.../mpi623_abref/`). **A/B RESULT:** the reference warms light + palette and copies no
village content, but every fill stays PHOTOREAL; B == C; +19 s a fill. NOT wired. **Next:**
Fabio's call on the rendering style - it needs words: a style phrase from the pano (a caption) or
the user's fill line, or Klein's style rack; my pick: A/B a pano-caption style phrase in INTERIOR
on the same bench rig (`abref.py`, add a variant), then wire the winner (if the reference stays in:
an optional `inputImage2` on `inpaint` gated like kleinEdit's `requiresCapability:
'multiReference'`) and re-run `build.cjs`. Then SAM3 glass windows, DoF after 0c.
**Session 36 (2026-10-08): Interior lift DONE but that live re-take** (validation.md § Interior
lift): the pick alone gave 58% (walls = one flat plane, Klein paints a corridor); Fabio picked A =
the pick + a back face never hides a fill -> 13%. MpiNodes `3ec03ef` pushed + pinned.

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

**Session 29 ("3D Scene 19", 2026-10-07): the Scene workspace SHELL is built and verified**
(validation.md § Scene workspace shell, committed at session 29's handoff): `PAGE_SCENE`,
`MpiSceneBlock`, `MpiSceneCanvas` (three ^0.186.1, render on demand, full GL teardown proven by a
10-visit spec), the dev_mode intercept, a DISABLED dev_mode **Convert to 360 pano** row
(`canConvertToPano`). Phase 2 enables that row + writes `scenePath`; Phase 3 draws into
`MpiSceneCanvas.getScene()`. GPU-free next work: Phase 2's MpiNodes code + CPU tests (its bench
run needs the lease). `research/spike-0a.md` not landed yet - fold it in when it does.

**Session 30 ("3D Scene 20", 2026-10-07): Phase 2's MpiNodes CODE is written and CPU-verified,
committed + pushed as MpiNodes `3e8d7d2` (main), NOT pinned** (`scene.py`, `scene3d/`, `tests/`;
validation.md § Phase 2 MpiNodes). Fabio picked this work ("go"). Vendored MoGe == SplatKit's on
CPU (diff 0.0); pano depth vs the spike npz mean 0.77% on CPU. Weights ship as
`models/moge/*.safetensors`. **Next:** the bench GPU run under the lease (copy the pack into
`G:\ComfyUi\ComfyUI\custom_nodes\`, a `moge_vitl.safetensors` in `models/moge/`; lift fit per step
needs the spike's GPU renders for known z), then Ship (pin + R2 dep) and the two universal ops.
`research/spike-0a.md` still not landed.

**Session 31 ("3D Scene 21", 2026-10-07, Fabio asleep from ~21:45): Phase 2 is DONE but one
check.** validation.md § Ship GPU-free half, § Phase 2 bench GPU half, § Ship R2 + pin, § Phase 2
ops. MoGe safetensors on R2 (byte-exact, Fabio's yes), dep `moge-vitl` (NOT `engineAsset`,
`noMirror`), `moge:` in mpi-ci `start.sh`; GPU bench green (pano 0.77%, lift == log on 8 steps);
MpiNodes pinned at `3e8d7d2`; `sceneConvert` + `sceneLift` graphs + `runSceneOp` + the 4 registry
files, both graphs run live on the bench (8K pixel-identical to the spike). **The one open check:**
a dispatch THROUGH THE APP (`runSceneOp` -> staging -> engine). Fabio's app was open on :48188 with
the old MpiNodes in memory; an `app:isolated` instance attaches to that engine, so it needs his app
(engine) restarted on the new pin first. **Open decisions:** how `moge-vitl` installs (an
`engineAsset` puts 1.17 GB on every engine while Scene is dev_mode-only); HF re-host (then drop
`noMirror`); `publish-runtime.sh dev` for the `start.sh` line (not live on any Pod until then).
**Found:** a NEW dep folder type (`moge`) never reaches an existing install's engine yaml - Ship
gate item below; Fabio's own yaml was patched by hand so his test can run.
**Convert row WIRED too** (validation.md § Convert to 360 pano wired): row enabled ->
`convertToPano` -> `POST /project-media/:id/scene` (manifest + `pano.png` + `pano_depth.f32` by
suffix, `scenePath` last). **Next:** after Fabio restarts his app (the engine reinstalls MpiNodes at
`3e8d7d2`, and `moge_vitl.safetensors` must be in his models root - `G:\CubricModels\moge\` has it),
right-click Convert on a 2:1 card (the ring 2K pano) and check the scene lands and opens; that one
run closes the Phase 2 ops verify AND the Convert verify. Then Phase 3's viewer (port 0a's renderer
onto the manifest) - 0a's parity result first (`research/spike-0a.md`, session 28).

**Session 32 ("3D Scene 22", 2026-10-08): Phase 2 CLOSED.** Fabio restarted; his engine
reinstalled MpiNodes at `3e8d7d2`, and a real Convert in his app on the ring 2K pano landed the
scene (71 s, 8K + 2048x1024 depth, `scenePath`, no new card, depth 0.80% off the spike, cube
badge, opens Scene) - validation.md § Live Convert. Fabio's calls, all settled: (1) the yaml gap is
BUILT - `syncExtraModelPathsYaml` at engine start; (2) MoGe belongs to a dev-only **3D Scene**
plugin (`scene-convert`), Convert warns when it is not installed; (3) weights stay on R2, HF
re-host before dev_mode comes off (Phase 4 gate); (4) `publish-runtime.sh dev` DONE (only
`start.sh` changed, dev was == stable before). **Next:** Phase 3's viewer once spike 0a's parity
result lands (`research/spike-0a.md` - session 28 still holds that claim, not landed 2026-10-08).
A Pod connect check of the `moge` line + `promote` waits for a Pod run (costs money - ask).
**Handoff (session 32 -> 33):** session 28 and every other 3D Scene session are ARCHIVED (Fabio);
session 28's claim on `D:\WORK\MPI-623-spike\` + `research/spike-0a.md` was released, so spike 0a's
GPU half is THIS card's next owner's. Fabio: do GPU-free work while the GPU is busy. GPU-free now:
Phase 3's History -> gallery stack, the Wan bake stub, the viewer scaffold (manifest loader + pano
layer + fly controls via `Hotkeys.bind`; rule C waits on 0a's verdict). The GPU half: serve
`viewer/` and run parity all / bench 1080p (plan § 0a Verify) under `gpu_lease.py run`.

**Session 33 ("3D Scene 23", 2026-10-08): spike 0a PASSED, three Phase 3 items built.** The peer
(MPI-1036) held the GPU until ~09:20Z, so GPU-free work first, then 0a under the lease the moment
it freed (validation.md § Spike 0a, research/spike-0a.md). Built + verified: History -> gallery
stack (`history-add-stack.spec.js`), the Wan bake stub (`scene-workspace.spec.js` § 4), and the
viewer scaffold (`js/services/scene/sceneViewer.js` + `MpiSceneBlock`: manifest loader, pano
layer by direction, fly keys + drag look, `getPose`/`setPose`; `tests/scene-viewer.test.cjs`,
`tests/desktop/scene-viewer.spec.js`). The fly keys needed a hotkeyManager ROOT fix: each
registry entry now gates its own handlers (A flew AND toggled Agent mode). **Next:** rule C in
the app (port the spike's MRT + rule C shader onto the scaffold, pass `reversedDepthBuffer` -
the 0.186 name), then the picture panel + Take picture (render targets dropped during Take
picture for Klein's VRAM; the floor-still spike eye check, sky band from 3). `.claude/rules/`
component-events maps updated with Fabio's yes (MpiHistoryList `{ indices }`, MpiSceneCanvas
`resize`, MpiSceneBlock). Fabio's call open: Add-to-gallery-as-a-stack ships ungated (my pick: keep).

**Session 34 ("3D Scene 24", 2026-10-08): rule C + fill layers IN THE APP, parity PASS on the GPU**
(validation.md § Phase 3 viewer: rule C). `createSceneView` (pano + layer MRT passes, composite,
`draw({ out })` for a picture-sized target, `dropTargets`), `RENDERER_OPTIONS` with
`reversedDepthBuffer`; `MpiSceneCanvas` takes `setDraw(fn)` instead of owning a Scene. The app's
module in Electron on the 4060 Ti: IoU 0.9995-0.9999, mad <= 0.125/255, 242 fps at 1080p. Viewer
sky band defaults to 3 (+1835 holes at the floor camera, as the spike measured). **Take picture
plumbing found (read-only sweep):** inpaint's mask is `config.maskDataUrl` (PNG data URL, white =
fill; a data-URL `Input_Image` skips the mask fit, so same size); `POST /project-media/:id/
place-preview-asset` `{ dataUrl, ext }` stores a PNG or `.f32` with no card and returns `absPath`
(= sceneLift's `knownDepthPath`); a new history entry = `uploadMediaFile` -> `createImageItem` ->
`appendToHistory` -> `updateGroup` (`MpiGroupHistoryBlock._addPickedEntry`); `deferCommit` works only
WITHOUT `existingGroup`; `POST .../scene` only CREATES a manifest (`layers: []`), so a layer needs a
new route. DoF waits on spike 0c.
**Then the picture panel + Take picture, GPU-free half** (validation.md § Phase 3 picture panel):
`scenePicture.js` (`takePicture` over `appIo()` doors, so its order/config test runs in node),
`POST .../scene-layer`, `renderPicture` / `pictureSize` / `layerCamera` / `loadLayer` /
`view.addLayer` / `groundBelow`, roll on Z/C, the panel in `MpiSceneBlock` with the card's
`MpiHistoryList` (entry -> fly back). **Not run: the engine half** - the peer's sweeps held the GPU.
The live run: `npm run app:isolated` (own profile + port), a converted 2:1 card (ring 2K), Take
picture at the four spike cameras; check the layer lands in the manifest, one entry per press, no
stray cards, the fill sits right in the viewer, the floor still (sky band 3) by eye. Unchecked in
code: whether `/engine-mask` crops the inpaint round the mask (`cropsToMask`) - the result is
stitched back full-frame either way. INTERIOR is the spike's with its cottage nouns removed
(unproven). The history list's context menu (delete, add-to-gallery...) is not wired in Scene.

**Session 35 ("3D Scene 25", 2026-10-08): Take picture RAN end to end on the engine** (validation.md
§ Take picture end to end). Rig: Playwright `_electron.launch` of the real app (own profile + port,
scratch `APP_DOCUMENTS`) on Fabio's 48188, a scratch copy of his converted card + the spike's window
rect, the real button at the four spike cameras. Three breakers found and fixed at the root: (1)
`renderPicture`'s z was all 0 (the composite's view-2 branch swallowed view 3) -> sceneLift failed;
(2) save-generation's sidecar GC DELETED `<id>.scene.json` on any generation in the project ->
`isSidecarFile` in `routes/projects.js`; (3) another picture's stretched ground fill hid a picture's
own fill at its own camera (44% holes) -> `LAYER_FRAG` discards rule-C-bad fragments (8.4%). Also the
picture's `displayName` now reaches the sidecar. All four: one entry per press with `scenePose`,
a layer per press, no new card, 60-77 s a picture; floor has no sky spikes. **Open:** the window
picture's room fill lies ~8% behind the walls' back faces (fit only on the view out), so 64% of its
own frame stays holes in the viewer - a lift contract change (below). Fabio's eye on the stills:
`take_picture_vs_spike.jpg` in session 35's scratchpad.

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

**App facts:** three ^0.186.1 in `package.json` since the shell (imported from
`node_modules/three/build/three.module.js`, like `marked`); the only GL teardown is
`MpiSceneCanvas.destroy()`; no add-a-workspace doc (touch list: `js/router.js:11-13`, `js/shell/navigation.js:195-206,
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

### Paths P2: render a path with Wan (session 41, Fabio: "on my card, under the lease")

Route (Plan Drift 2026-10-09, P2): the APP renders the guide, the bench fills it, only then wire.
- [x] `pathFrames` (scenePath.js): 81 frames, centripetal Catmull-Rom, constant speed, level,
      heading = chord over +-10% of the path. `cubePoses` / `stitchPano` / `renderPano`
      (sceneViewer.js): six 90-degree `renderPicture`s -> one 1440x720 360 frame in the pano's
      own layout + its hole mask. Unit 22/22, 5 mutants killed.
- [x] Guide rendered live (isolated app, `guide.cjs`): Convert test pano + the window rect, path
      `[[0,0,0],[0,-0.1,-0.45],[0,-0.145,-0.79],[0,-0.145,-1.25]]` through the round window;
      frame 0 = the pano (5% holes: sky-band cuts), inside the room 98-99.7% black.
- [x] Wan fill on the bench (`p2_wan.py`, the amendment-32 graph with node 27 swapped for our
      frames, `invert_mask` true, CLIP vision on frame 0): 28 min, known corr median +0.972;
      Wan invented a coherent room behind the window (validation.md § Paths P2).
- [x] Fabio's eye on the 360 video ("Awesomeness. 1") -> wired: MpiNodes `d721182`
      `MpiWanMaskedVideo`, ComfyUI-GGUF + pip gguf, deps, plugin `scene-path`, op `scenePathVideo`,
      Render path button (`902c72e2`, CI green).
- [x] Live through the app (session 42): the real button, 1810 s, median +0.975.
- [x] Fabio's eye on the app's card (Projects/MPI-623): "the video looks good. It proved that it
      can do interiors like we expected." It plays flat; looking around in it = P3.
- Levers, untested: Matrix-3D 480P LoRA (`pano_video_gen_480p.ckpt`, 0.31 GB, ~2x faster) and
      `pano_video_gen_720p_5b.safetensors` (0.24 GB) on the Wan 2.2 5B the app already ships.

### Phase 0: Single-shot spikes (bench + a scratch HTML page, NO product code)

All files in `D:\WORK\MPI-623-spike\single_shot\`; every GPU run via `gpu_lease.py run` with
the bench queue empty. Ordered; no batch - one GPU and each spike feeds the next (0d is research
only and may run beside the others).

- [x] **0a. App-side renderer parity.** **PASS 2026-10-08 (session 33, research/spike-0a.md):
      IoU 0.9995-0.9998, colour 0.065-0.129/255, 435-521 fps, ~650 MiB. The floor-still eye check
      moved to Take picture (it needs Klein's fill).** Export ring8k as records (pano 8K + depth `.f32`, the
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
- [x] **MpiNodes** (`/mpi-nodes-sync`, the sibling's new-node procedure read inline): vendored
      MoGe v1, `MpiPanoDepth`, `MpiLiftDepth`, `MpiWrapPad`, `MpiWrapCrop`, `MpiWrapSoften`,
      `MpiWrapCutMerge`; add utils3d's MIT notice to the vendored tree. **Verify:** CPU unit tests on tiny
      tensors; one bench GPU run reproduces the spike - pano depth vs `pano_depth_ring8k.npz`
      rel err < 1%, lift fit error matches `chain_ring8k_gen.log` per step.
      **(CODE + CPU checks DONE 2026-10-07, session 30, uncommitted: 9/9 unit tests, vendored MoGe
      == SplatKit's, pano vs npz mean 0.77% ON CPU, whole-pack smoke. GPU bench DONE 2026-10-07,
      session 31: pano on cuda mean 0.77% in 46 s; lift == the log on all 8 steps.)**
- [x] **Ship the pack and the weights:** commit, push, pin in `dev_configs/node_lock.json`; MoGe
      weights as a dep via `/mpi-add-model`'s deps half (R2, SHA). **Verify:** presence check
      green on the local engine; a Pod connect installs the pack with no image rebuild.
      **(2026-10-07: pinned `3e8d7d2`, weights on R2 byte-exact, dep written, `start.sh` maps
      `moge`. 2026-10-08: the local engine reinstalled the pin on boot and ran it;
      `publish-runtime.sh dev` live. The Pod connect check + `promote` + HF re-host moved to
      Phase 4's dev_mode gate.)**
- [x] **moge-vitl install mode** (Fabio 2026-10-08, "go with your suggestion"): the dev-only
      `scene-convert` plugin owns it (`pluginsRegistry.js`, `devOnly` filtered like a ModelDef);
      Convert warns "3D Scene is not installed" without it. `tests/scene-convert.test.cjs`.
- [x] **SHIP GATE - a new dep folder type never reaches an existing install's yaml.** BUILT
      2026-10-08 (Fabio's yes): `syncExtraModelPathsYaml` (`routes/shared.js`), called by the engine
      start before spawn. `tests/extra-model-folders.test.cjs`. The local
      `extra_model_paths.yaml` is DERIVED from the deps (`yamlHelper.js`) but rewritten only on engine
      install, a models-path change or an extra-folder change - so on every existing install a
      downloaded `moge-vitl` sits in `<root>/moge/` and the engine never sees it (MpiPanoDepth's model
      list stays empty -> "value not in list"). Found 2026-10-07; Fabio's own yaml got `moge: moge/` by
      hand (backup in session 31's scratchpad) so his test can run. **My pick:** at engine start,
      rewrite the yaml when a dep folder type is missing from it (same builder, current root +
      extras). Touches every user's boot, so Fabio's call before it is built. Not breaking today:
      Scene is dev_mode-only and nothing downloads `moge-vitl`.
- [x] **Universal ops + graphs:** `sceneConvert` (wrap-padded AnimeSharp when < 8K, cap 8K,
      `MpiPanoDepth`), `sceneLift` (`MpiLiftDepth` on a fill + the known-depth map + keep mask;
      Take picture and Build here both sequence it after Klein's own `inpaint`, A5),
      registered in the 4 files (`commandRegistry.js`, `universal_workflows.js`,
      `operationRegistry.js`, `operation_registry.json`). **Verify:** op/registry tests green;
      one live dispatch of each on an ISOLATED app (`npm run app:isolated`), outputs match the
      spike's numbers. **(2026-10-07: graphs + `runSceneOp` + registry DONE, tests green, both
      graphs live on the BENCH match the spike; the app-level dispatch waits on an engine
      restart. Neither op goes through `runCommand` - see Plan Drift. 2026-10-08: `sceneConvert`
      dispatched through Fabio's app via Convert; `sceneLift` has no app caller until Take
      picture, so its app dispatch is Phase 3's verify.)**

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
- [x] **Scene workspace shell + Convert:** `PAGE_SCENE` (all touch-list sites above), Block
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
      the card - `tests/scene-companion.test.cjs`. SHELL LANDED 2026-10-07 (session 29):
      `PAGE_SCENE`, both components, the intercept, the Convert row DISABLED -
      `tests/scene-workspace.test.cjs` + `tests/desktop/scene-workspace.spec.js`. CONVERT WIRED
      2026-10-07 (session 31): row enabled, `convertToPano`, `POST /project-media/:id/scene`,
      `tests/scene-convert.test.cjs`. Real Convert in Fabio's app DONE 2026-10-08.)**
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
      **(SCAFFOLD 2026-10-08, session 33: `sceneViewer.js` loader + pano layer + fly/drag,
      `scene-viewer.spec.js` checks the centre colour at four yaws within 2/255. RULE C + LAYERS
      2026-10-08, session 34: GPU parity PASS in Electron, spec asserts a tear hole + a layer +
      reverse depth. Left: frame guides, lens/height UI, DoF, the golden PNG.)**
- [ ] **Picture panel + Take picture:** **(BUILT 2026-10-08, session 34, GPU-free checks green;
      the engine run is open)** components only (ComponentFactory), fill line + presets
      (Character-Sheet-style picker), render base + mask at Klein size per aspect -> `scenePicture`
      -> add the fill layer to the manifest -> depth of field -> upload as a history entry with
      `scenePose` (A7); entry click flies the camera to its pose. `INTERIOR` switch at > 50%
      back faces. **Verify:** on an isolated app, poses set to the four spike cameras produce
      stills that match the spike's by eye; a spec clicks an entry and asserts the camera pose.
      **(ENGINE RUN DONE 2026-10-08, session 35: all four end to end, bookkeeping PASS, three
      breakers fixed; Fabio's eye on the four stills: "1". Left: DoF after 0c.)**
- [x] **Interior lift** (found by session 35's window picture): `MpiLiftDepth` fits a fill's depth
      only on the known (non-hole) pixels, so a picture taken inside a house fits the room on the
      view out and lands ~8% past the walls' back faces, hidden in the viewer. Pass the back-faced
      pano z as known-for-the-fit while still keeping those pixels (pick: negative z in the `.f32`
      = fit here AND keep). MpiNodes change + pin (`/mpi-nodes-sync`), then `renderPicture` writes
      `-z` on back faces. **Verify:** the window picture's own camera < 15% holes in the viewer; a
      CPU test of the node's sign convention. Build here (0b) depends on it.
      **(BUILT 2026-10-08, session 36: + option A, a back face never hides a fill; 13% offline on
      the real fill, MpiNodes `3ec03ef` pinned. LIVE RE-TAKE PASS 2026-10-08, session 37: 12.3%
      at its own camera, 79.6 s, fill-behind-wall 426k -> 120 px.)**
- [ ] **Build here:** 0b's loop as a tool (progress, cancel), SAM3 glass windows, fill line.
      **Verify:** isolated run inside a house builds the room and its windows show the real
      outside; time within 0b's measured budget.
      **(BUILT 2026-10-08, session 37: tool + Stop, both spots live in 265 / 295 s, holes 1.9 /
      6.3% at the spot's picture. Left: interior style (pano-reference A/B), SAM3 glass, Fabio's
      fly-through.)**
- [x] **History -> gallery:** multi-select in `MpiHistoryList` -> `Add to gallery` makes one
      stack of plain image cards (`stackGroups`); single stays as today. **Verify:** spec selects
      three entries -> one stack of three image cards, none carrying `scenePath`.
      **(DONE 2026-10-08, session 33: `tests/desktop/history-add-stack.spec.js`, validation.md
      § Phase 3 GPU-free. The Scene workspace's history list reuses the `{ indices }` event.)**
- [x] **Wan bake** as a disabled coming-soon tool with a tooltip. **Verify:** visible, inert.
      **(DONE 2026-10-08: `MpiSceneBlock` tools strip, `scene-workspace.spec.js` § 4.)**
- [ ] **End check (user-ux, includes Phase 1's deferred look):** Fabio makes a pano, converts it,
      flies, builds one interior, takes pictures from the four kinds of spot, sends three to the
      gallery as a stack, copies the card to a second project (companions travel), deletes it
      (no companion left).

### Phase 4: Docs, rules, release prep

- [ ] `docs/scenes.md` (new subsystem doc, routed from `docs/README.md`): A1-A9, the record
      format, rule C, the timings, the limits. **Verify:** <= 200 lines, every symbol greps.
      **(STARTED 2026-10-07, session 31: what is BUILT - card/companions/manifest, Convert, the
      two ops, nodes + weights, the yaml gap; 108 lines, symbols grepped. Phase 3 adds the viewer,
      rule C, Take picture, limits.)**
- [ ] Ask Fabio before touching `.claude/rules/` (workspaces.md says "three"; component maps via
      `mpic-update-component-map`). **Verify:** his yes recorded, or the drift noted.
- [ ] Privacy check: MoGe weights come from our R2 - no new outbound service. **Verify:** none
      added, or `cubric.studio/privacy/` updated in the same job.
- [ ] **Before dev_mode comes off** (Fabio 2026-10-08): MoGe re-hosted to the HF mirror and
      `noMirror` dropped; a Pod connect proves `start.sh`'s `moge` line (dev channel, live since
      2026-10-08) then `publish-runtime.sh promote`; the `scene-convert` plugin loses `devOnly`.
      **Verify:** `release:check` green with those three done.

## Plan Drift

- **2026-10-09 - P2 route (session 41, Fabio "on my card").** The guide video is rendered IN THE
  APP (pano + every layer, the A1 renderer), not by SplatKit's `CameraPlotRenderControlGeo`: that
  node re-runs MoGe on the pano, so the user's path would land in a different geometry and the
  built layers would be missing. The engine needs only SplatKit's ~80-line conditioning node.
  The bake's Wan was 2.1 I2V **720P** (the handoff's "480P" was wrong). A point stays a position:
  the heading comes from the travel direction (amendments 30-32: facing away breaks Wan).
- **2026-10-09 - Paths + Wan (Fabio, session 40: "we are doing way too much kung fu").** After
  flying the Build here layers (side-stepping inside the window tears them; Build here only adds,
  never removes, so a second press cannot clear the stray pieces), Fabio picked the path route:
  the user lays a camera path in the 3D view (balls joined by lines), Wan renders a 360 video
  along it and INVENTS what the path walks into (his reference: a Matrix-3D-style clip, street ->
  through a window -> a room that did not exist). Steps: **P1 path editor** (now; no GPU) ->
  **P2 render a path** (Matrix-3D / Wan 2.1 rail, ~35 min a rail on the 4060 Ti, or RunPod) ->
  **P3 what the video becomes** (Fabio's call; my pick: a playable 360 video card, its last frame a
  new pano spot). Constraint: Wan's video starts FROM the pano, so a path's first ball is the
  pano's centre (later: the end of an earlier path). Single shot / Build here stay as they are.
- **2026-10-07 - the bake became the single shot.** Phases 2-5 of the bake plan are superseded
  (history file). The Wan bake survives only as a coming-soon tool.
- **2026-10-07 - the renderer moved to the app (A1).** The spike renders in Python; the product
  renders in WebGL so the viewer and the picture cannot drift. Spike 0a is the price.
- **2026-10-07 - "~1.4 MP" said to Fabio in the brainstorm was wrong:** Klein's 16:9 output is
  1360x768 (~1 MP).
- **2026-10-07 - A9 decided by Fabio:** no auto-open for a 2:1 image (a banner is not always a
  pano); right-click **Convert to 360 pano** converts the card, then a left-click opens Scene.
  Convert left the Scene workspace for the gallery menu; the Pano Flow converts at its end.
- **2026-10-07 - the Scene shell ran BEFORE Phase 2** (Fabio split the card while the GPU was
  held): built without `sceneConvert`, so the Convert row ships disabled. three is ^0.186.1, not
  the spike's 0.170 - Phase 3's port re-checks parity on it. `agentDispatch.js` needed no page
  map. `.claude/rules/workspaces.md` + `docs/workspaces.md` still say "three workspaces" and
  `component-state.md` lists no `'scene'` page - drift for Phase 4, rules only with Fabio's yes.
- **2026-10-07 - A5 settled on neither planned route.** The op is `inpaint` on `klein-9b`, not a
  `kleinInpaint`; `scenePicture` is no longer a universal op (Phase 2's op list drops it), the
  sequencer lives in `js/services/scene/` (Phase 3) and needs `sceneLift` from Phase 2.

- **2026-10-07 - Phase 2 node contract settled in code (session 30):** MoGe weights are
  `.safetensors` (no pickle in a Registry pack; config pinned in `scene.py`), folder `models/moge/`
  (the Ship step's dep `filename` must be `moge/<name>.safetensors`). `MpiLiftDepth` reads known z
  from a `<f4` file in `input/` (0 = unknown) instead of a mask input; its output depth uses 0 = not
  kept, so a layer record needs no separate keep mask. Wrap Crop / Cut Merge take the pre-pad image
  as `reference`. Pano depth's GPU half ran on the CPU instead (same code, < 1%).
- **2026-10-07 - the scene ops run through `runSceneOp`, not `enqueueGeneration` (session 31).**
  A depth-only run has no image URL, and generationService treats that as a CANCEL; Convert must not
  make a card either. So A5's sequencer calls `enqueueGeneration` for the two Klein steps only and
  `runSceneOp('sceneLift')` between them. sceneConvert upscales with AnimeSharp only UNDER 4096 wide
  (a 4x model on a 4K+ pano builds a 16K+ intermediate); wider inputs are resized to 8192x4096.
  `Input_Known_Depth` is an `MpiString` so the engine stages / uploads the f32 itself.
- **2026-10-08 - 0a ran on three 0.170 and hit a three bug (session 33).** Under reverse depth
  0.170 never clears depth to 0, so every render was empty until a two-step `setClear`. 0.186 (the
  app) fixes it but renames the option `reversedDepthBuffer`; the spike's spelling is ignored there
  silently. The floor-still eye check needs Klein's fill, so it moved from 0a to Take picture.
- **2026-10-08 - the fly keys forced a hotkeyManager fix (session 33).** Entries on one key
  shared one verdict, so a `when` that read false still fired its handler. Now per entry, bind
  order kept; behaviour-preserving for every existing entry (only Escape and Space-up had
  differing gates, and both handlers self-gate). `agentMode.toggle` is gated off the Scene page.
  The Hotkeys page gets a "3D Scene" group only when `dev_mode` is on (A8).
- **2026-10-08 - the canvas draws a callback, not a Scene (session 34).** Rule C is two MRT passes
  and a composite, which no single three `Scene` holds, so `MpiSceneCanvas.getScene()` became
  `setDraw(fn)` + `renderNow()` (the plan said Phase 3 "draws into getScene()"). Under reverse depth
  three ^0.186 calls `updateProjectionMatrix()` on every camera it renders with, so the composite
  uses an `OrthographicCamera`, never a bare `Camera`. The parity re-check ran the app's module in
  Electron (a scratch main serving the repo), not the Scene workspace UI.
- **2026-10-08 - rule C for FILL LAYERS changed (session 35).** The spike (and the 0a port) let
  the nearest layer fragment win and made it a hole when rule C rejected it. Take picture adds a
  layer per picture, and two pictures' fills of one ground disagree by ~1 cm, so the one seen
  stretched hid the one seen straight on. A rejected fill fragment is now discarded (the pano keeps
  its bad faces). Spike parity moved by design (behind_well IoU 0.9198); the 0a gate measured the
  port, not this rule.
- **2026-10-08 - the Interior lift pick does not reach its own target (session 36).** Fitting the
  room to the back-faced walls assumed the fill agrees with them; on the window shot it does not (a
  corridor vs one flat wall, fit error 73%), so the window stays 58% holes. Fabio picked A: the
  composite lets a fill win over a pano face seen from behind (13%); the price is another picture's
  fill showing through a wall where the room's own fill does not reach. Build here will show
  whether that leak matters.
- **2026-10-08 - spike 0b folded into Build here (session 37, Fabio "go").** Take picture already
  runs render -> fill -> lift -> layer in the app, so 0b's bench loop became the product tool
  directly (`buildHere`, `buildPoses` in `scenePicture.js`; button in `MpiSceneBlock`'s tools strip).
  Views are 1024x1024 at 16 mm (~97 deg, overlapping), up/down at pitch +-`PITCH_MAX` (1.55:
  `applyPose` has no right vector straight up). SAM3 glass windows not in yet - the test house uses
  the spike's hand-marked window rect.
- **2026-10-08 - a `.meta` json is not always a sidecar (session 35).** The scene manifest
  `<id>.scene.json` was deleted by save-generation's orphan GC; every sidecar scan in
  `routes/projects.js` now goes through `isSidecarFile`.
- **2026-10-10 - a dep with a `mirrorUrl` still needs its R2 object (session 43).** Session 41 wired
  three Wan weights with HF mirrors and assumed only the mirror-less LoRA needed an upload. A 404 is
  not a transport error, so the app never fails over on it, and the Pod wrapper has no mirror path:
  every new dep's R2 object is required, checked with `rclone lsl` + a live control.

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
