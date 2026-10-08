# MPI-623 checklist

Derived from [plan.md](plan.md) by `mpi-continue` when implementation resumes. The bake-era
ticks (Phase 0/0b/1, all complete) moved verbatim to
[research/checklist-history-bake.md](research/checklist-history-bake.md).

## Phase 2: Engine nodes and ops

- [x] MpiNodes code: vendored MoGe v1 + `MpiPanoDepth`, `MpiLiftDepth`, `MpiWrapPad/Crop/Soften/CutMerge`,
      CPU unit tests 9/9, CPU parity (vendored == SplatKit's MoGe; pano vs spike npz mean 0.77%),
      whole-pack smoke (2026-10-07, validation.md § Phase 2 MpiNodes) - MpiNodes `3e8d7d2`, not pinned
- [x] Bench GPU run: pano depth on the GPU + lift fit error per step vs `chain_ring8k_gen.log` (lease)
      (2026-10-07: pano mean 0.77%, 46 s; lift == log on all 8 steps - validation.md § Phase 2 bench, GPU half)
- [x] Ship: commit + push the pack, pin `dev_configs/node_lock.json`, MoGe safetensors on R2 as a dep
      (2026-10-07 pin + R2 + dep; 2026-10-08 the local engine reinstalled the pin, `publish-runtime.sh dev`
      live - validation.md § Live Convert, § Fabio's four calls. Pod check + promote + HF: Phase 4 gate)
- [x] Universal ops `sceneConvert` + `sceneLift` in the 4 registry files, live dispatch
      (2026-10-08: `sceneConvert` through Fabio's app; `sceneLift`'s app dispatch is Phase 3's Take picture)
- [x] yaml ship gate: `syncExtraModelPathsYaml` at engine start (2026-10-08, Fabio's yes)
- [x] moge-vitl owned by the dev-only `scene-convert` plugin (2026-10-08, Fabio's yes)

## Parallel Batch: Scene workspace shell + Convert

- [x] Shell: `PAGE_SCENE`, `MpiSceneBlock`, `MpiSceneCanvas` (GL teardown), dev_mode intercept,
      disabled Convert to 360 pano row (2026-10-07, validation.md § Scene workspace shell)
- [x] Convert enabled + wired to `sceneConvert`, writes `scenePath` (after Phase 2)
      (2026-10-08: real Convert in Fabio's app - validation.md § Live Convert in Fabio's app)

## Phase 0: spikes

- [x] 0a renderer parity, GPU half: PASS (2026-10-08, research/spike-0a.md)

## Phase 3: Explore, picture, build

- [ ] Viewer: 0a's renderer in `js/services/scene/`, fly controls via `Hotkeys.bind`, frame guides,
      height, lens, depth-of-field preview (golden-PNG spec)
      (2026-10-08 scaffold: loader + pano layer + fly + drag look, validation.md § Phase 3 viewer
      scaffold. 2026-10-08 session 34: rule C + fill layers + reverse depth, GPU parity PASS in
      Electron, validation.md § Phase 3 viewer: rule C. Left: frame guides, lens/height UI, DoF,
      golden PNG)
- [ ] Picture panel + Take picture (`scenePose` entries, entry click flies the camera)
      (2026-10-08 session 34: built + GPU-free checks green, validation.md § Phase 3 picture panel.
      2026-10-08 session 35: engine run end to end, three breakers fixed, floor still clean,
      validation.md § Take picture end to end. Fabio's eye on the four stills: "1". Left: DoF after 0c)
- [x] Interior lift: fit a fill on the back-faced walls' z too (MpiLiftDepth sign convention),
      window picture < 15% holes at its own camera (found session 35). Done 2026-10-08: + option
      A, MpiNodes `3ec03ef`; live re-take 12.3% (was 64%), validation.md § Interior lift
- [ ] Build here (0b's loop as a tool) (2026-10-08 session 37: built, both 0b spots live, 265 /
      295 s; left: interior style via the pano as reference (A/B), SAM3 glass, Fabio's eye)
- [x] History -> gallery: several entries -> one stack of plain cards (2026-10-08, validation.md
      § Phase 3 GPU-free)
- [x] Wan bake: disabled coming-soon tool (2026-10-08, same section)
- [ ] End check (user-ux, Fabio)
