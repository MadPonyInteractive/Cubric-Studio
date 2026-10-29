# MPI-1342 - port the pano, stems and RIFE nodes into MpiNodes

Member of the MPI-1344 Engine diet umbrella; the cross-cutting rules (licence, new `Mpi*`
names, ports keep behaviour) are in `.agents/mpi-kanban/tasks/MPI-1344/plan.md`.

## Phase 1: port in MpiNodes (parallel batch)
Source pack: ComfyUI-Mickmumpitz-Nodes, audio-separation-nodes-comfyui, comfyui-frame-interpolation (read it from `G:/ComfyUi/ComfyUI/custom_nodes/`). Nodes we use:
- MickmumpitzPanoHarmonizeBoundary
- MickmumpitzPanoKrea2Reference
- MickmumpitzPanoRollHorizontal
- MickmumpitzPanoSeamMask
- MickmumpitzPanoWarp
- AudioSeparation
- RIFE VFI

Port only the code paths our workflows reach (`comfy_workflows/*.json` show the input
values set). Every class gets a NEW `Mpi*` name; the module exposes its own
`NODE_CLASS_MAPPINGS` / `NODE_DISPLAY_NAME_MAPPINGS` and is NOT registered in
`__init__.py` (Phase 2 does that). Keep upstream licence notices.

Ownership: `pano/**`, `stems/**`, `rife/**`, `tests/test_pano*.py`, `tests/test_stems*.py`, `tests/test_rife*.py` in `C:/AI/Mpi/ComfyUi-MpiNodes/`.

**Verify:** each of `tests/test_pano*.py`, `tests/test_stems*.py`, `tests/test_rife*.py` runs green with `G:/ComfyUi/python_embeded/python.exe <file>` on
CPU with tiny inputs; where the original pack code can be imported, the port's output
matches it on fixed inputs.

## Phase 2: swap over (serial, see umbrella)
Register nodes, pin via `/mpi-nodes-sync`, swap `class_type`s keeping input values, drop the
pack from `node_lock.json` / `nodesDeps.js` / model deps / `python_deps.in`, fixed-seed
before/after run, release note naming the removed classes.

### Phase 2 sites (listed 2026-10-29, GPU-free prep)
- class_type swaps (+ `raw/` twins, cnr_id/ver): `flow_pano360.json` (Pano Harmonize 1, Krea2Reference 4,
  RollHorizontal 5, SeamMask 2, Warp 1), `flow_stems.json` (AudioSeparation 1), `video_interpolate.json` (`RIFE VFI` 1).
- Pack entries to drop: `dev_configs/node_lock.json` (frame-interpolation :68, audio-separation :120,
  Mickmumpitz :134), `dev_configs/engine-attestation.json:48`, `nodesDeps.js` (:113, :255, :367),
  `flowsRegistry.js:2282` (stems node list), `scripts/compile-node-deps.mjs:89` (no-cupy requirements map).
- `python_deps.in`: cupy note (:34-38) and opencv-contrib note (:93) name Frame-Interpolation; drop what only those packs declared.
- RIFE weight `rife47` targetPath (`assetDeps.js:541-552`) -> `models/rife`; follow-on sites: `routes/downloadCompletion.js:22`,
  `routes/downloadManager.js:3132`, `routes/remoteModels.js:253`, `routes/shared.js:816`, `routes/yamlHelper.js:82`, Pod Dockerfile bake,
  and tests pinning the old path: `node-drift.test.cjs:339-380`, `remote-engine-assets.test.cjs:62`, `targetpath-dep-install-state.test.cjs:87-104`.
- Tests naming classes/packs: `inject-params-titles.test.cjs:421` (MickmumpitzPanoHarmonizeBoundary), `node-install-batch-resilience.test.cjs`,
  `download-completion.test.cjs:213-220`, `remote-install-submodules.test.cjs:42` (fixture ids; may stay as fixtures).
- Comments/docs: `universal_workflows.js:159`, `.claude/rules/comfy_injection.md:85`, `comfy_engine.md:342` (rule files: ask first),
  `docs/playbooks/add-flow/existing-flows/{stems,outpaint}.md`, `routes/remotePodLifecycle.js:160,310`.
- MpiNodes: add `tests/test_{pano,stems,rife}.py` to `.comfyignore`.
