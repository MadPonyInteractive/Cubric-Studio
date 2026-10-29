# MPI-1344 — UMBRELLA: Engine diet

## Goal

The shipped engine carries 22 custom-node packs (21 third-party plus our MpiNodes). Most give us 1-5 nodes and
bring their own pip requirements, which slows installs and breaks engines (RES4LYF's
config rewrite, MPI-1274). Port only the nodes we use into `ComfyUi-MpiNodes`, swap the
workflows over, and drop the packs.

Pack requirements are NOT pip-installed per pack: since MPI-413 they are merged into the
hand-curated `dev_configs/python_deps.in` → generated `python_deps.txt` (opencv is already
one pin there). **A card's pip win = the lines it removes from `python_deps.in`**, checked
with `node scripts/compile-node-deps.mjs --check`. Startup time is NOT the prize: all
dropped packs together import in ~1.5 s (`research/baseline.md`).

**Keep as is:** ComfyUI-LTXVideo (Lightricks, day-one LTX support), ComfyUI_Fill-ChatterBox
and ComfyUI-MelodramaBox (the packs ARE the models), ComfyUI-GGUF (the loader), MpiNodes.

**Not in scope:** replacing ComfyUI itself. Discussed 2026-10-29 and decided against: the
cost is model ports and memory management, and the speed is in torch kernels, not Comfy.

## Evidence

`research/audit.py` + `research/out.json`: every `class_type` in `comfy_workflows/*.json`
and in JS mapped to the pack that defines it (read from the `G:\ComfyUi` bench, not the
exact pins, so line counts are approximate). 262 node types: 129 core, 70 MpiNodes, the
rest below. Re-run it after each phase: `python -I research/audit.py out.json`.
Blind spot: paid Flows (DramaBox, Head Swap) ship workflows outside the repo.

## Members

| Card | Pack(s) | Nodes | Win |
|---|---|---|---|
| MPI-1337 | VideoHelperSuite | 0 used | drop only (still a Wan dep in models.js) |
| MPI-1338 | comfyui_controlnet_aux | 3 | 25 pip reqs — biggest |
| MPI-1339 | Impact-Pack + Impact-Subpack | 16 | segment-anything, sam2 (git), ultralytics |
| MPI-1340 | RES4LYF | 3 | pywavelets, opencv, matplotlib + a known engine breaker |
| MPI-1341 | KJNodes | 10 | color-matcher, mss, matplotlib, opencv (weigh keeping the LTX nodes) |
| MPI-1342 | Mickmumpitz, audio-separation, Frame-Interpolation | 5 + 1 + 1 | ultralytics, moviepy, librosa |
| MPI-1343 | 8 small no-req packs | ~15 | no pip win; fewer pins. LOW PRIORITY |

## Cross-cutting rules

- **Licence:** MpiNodes is AGPL-3.0; the per-pack table is `research/licences.md`. Every
  pack we port is MIT/Apache/GPL-3/AGPL-3 (copy OK, keep notices) EXCEPT three with no
  licence at all — Painter I2V, Krea2-ControlNet, MiniMax H3 upscaler (all MPI-1343):
  rewrite or ask the author. WEIGHTS carry their own licences (Ultralytics YOLO is AGPL).
- **A custom_nodes dep removed from `nodesDeps.js` stays on existing users' disks** — the
  orphan sweep never touches node folders (`_orphanedDepIds`, routes/downloadManager.js).
  Harmless (it just keeps loading); precedent for removal: SplatKit, commit b3c25a678.
- **The Pod has its own copy** of the lock and clone list in `c:\AI\Mpi\mpi-ci\cubric-vision-pod\`
  (`node_lock.json`, `Dockerfile`, `README.md`) and `cubric-vision-builder/install_nodes.sh`.
  Each removal syncs there per `.claude/rules/sibling-repos.md`.
- **Ports keep behaviour:** a ported node gets a new `Mpi*` class name; the workflow
  swaps the `class_type` and keeps every input value. Prove "same output" with a fixed
  seed run before vs after (pixel-diff or eye-test), not just "it ran".
- **Removing a pack** follows `docs/playbooks/add-model/README.md` § "Removing or
  re-tiering" logic for deps: never strand files on users' disks; check how the orphan
  sweep treats a dropped `custom_nodes` dep before deleting its `nodesDeps.js` entry.
- Nodes ship only **committed → pushed → pinned** (`/mpi-nodes-sync`).

- **Paid Flows use pack nodes too.** Their graphs live outside the repo, in
  `%APPDATA%\Cubric Studio\user_flows\<id>\workflow.json`. Head Swap uses KJNodes
  `GrowMaskWithBlur` + `ImageConcanate` (MPI-1341 must add `ImageConcanate`, the audit could
  not see it) and Inpaint Crop/Stitch (MPI-1343). DramaBox uses only MelodramaBox + Mpi.
  A swap card re-exports the paid Flow package too, or it breaks for buyers.
- **Proof that a pack is gone:** `research/run_novhs.sh` pattern (scratch engine on 48199,
  `--disable-all-custom-nodes --whitelist-custom-nodes <all but the dropped pack>`, own
  four dirs) + `research/check_nodes.py 48199` → "ALL PRESENT". An `app:isolated` run
  cannot prove it: it shares the user's 48188 engine, which still has the pack loaded.

## DECIDED 2026-10-29 (Fabio) — commercially restricted packs stay dependencies
Any pack whose code or weights carry a commercial restriction stays as a plain dependency: no
port, no clean-room rewrite, no asking the author. RES4LYF (MPI-1340) and comfyui_controlnet_aux
(MPI-1338, OpenPose CMU + DepthAnything NC) closed rejected; their working ports are shelved,
never committed. RES4LYF also has other nodes we may use.

## DECIDED 2026-10-29 (Fabio) — ported nodes get NEW `Mpi*` names
Third-party Flow packages authored against the old pack nodes will break when a pack
leaves; accepted. Every Phase 2 swap that drops a pack says so in its release notes,
naming the old node classes that are gone. Never reuse an original class name in MpiNodes.

## Phase 0 — baseline (one session, serial)

1. Licence table for all 20 packs → `research/licences.md`.
2. Baseline: engine pip freeze size, install time, engine cold-start time. Same numbers
   again at the end of each phase.
3. MPI-1337 (VHS drop) — the warm-up: tiny, proves the dep-removal path end to end.

## Parallel Batch — Phase 1: ports in MpiNodes

Each card writes NEW modules only in the sibling repo; `__init__.py` registration is the
one shared file, so it is NOT edited in this phase — each card leaves a
`NODE_CLASS_MAPPINGS` dict in its own module for Phase 2 to wire.

| Card | Owns (in `c:\AI\Mpi\ComfyUi-MpiNodes\`) |
|---|---|
| MPI-1338 | `preprocess/**`, `tests/test_preprocess*.py` |
| MPI-1339 | `detailer/**`, `tests/test_detailer*.py` |
| MPI-1340 | `clown/**`, `tests/test_clown*.py` |
| MPI-1341 | `kj/**`, `tests/test_kj*.py` |
| MPI-1342 | `pano/**`, `stems/**`, `rife/**`, `tests/test_pano*.py`, `tests/test_stems*.py`, `tests/test_rife*.py` |

MPI-1343 stays out of the batch (low priority); run it after Phase 2 if still wanted.

## Phase 2 — swap over, serial (one card at a time)

Shared files, so never parallel: `ComfyUi-MpiNodes/__init__.py`, `dev_configs/node_lock.json`,
`js/data/modelConstants/nodesDeps.js`, `js/data/modelConstants/models.js` dependency lists,
`comfy_workflows/*.json` + `comfy_workflows/raw/*`.

Per card: register its nodes → `/mpi-nodes-sync` pin → swap `class_type`s in its workflows
→ remove the pack from every model's `dependencies` + node_lock → fixed-seed before/after
run on an isolated app (`npm run app:isolated`) for every workflow it touched → close card.
Order: MPI-1338, MPI-1339, MPI-1340, MPI-1342, MPI-1341.

## Phase 3 — prove the shipped engine

`/mpi-bump-engine` smoke of every model op on RunPod (`--plan` first; it costs money —
state price and ask). Re-run the audit: the dropped packs must show 0 nodes. Record the
baseline-vs-now numbers in `validation.md`.

## Completed
- 2026-10-29 Phase 0: `research/licences.md` (3 packs have no licence), `research/baseline.md`
  (191 packages / 5.8 GB site-packages, 23 s warm start, packs ~8.4 s of it, ChatterBox 4.3 s).
- 2026-10-29 MPI-1337: VideoHelperSuite removed (lock, nodesDeps, two Wan dep lists, one
  test); every workflow node proven present without it. Committed 59dc63cc1, pushed e9b767005.
- 2026-10-29 Phase 1 (5 workers): MPI-1338 preprocess/, MPI-1339 detailer/, MPI-1340 clown/,
  MPI-1341 kj/, MPI-1342 pano/ stems/ rife/ in ComfyUi-MpiNodes, each with tests/test_<x>*.py,
  all green on the bench python (re-run by the orchestrator), bit-equal to the originals on
  fixed inputs. NOT registered, NOT committed. Per-card detail: each card's validation.md.

## Plan Drift
- 2026-10-29: MPI-1339 .comfyignore needed nothing (it already ignores /tests/). Before/after
  runs on a G:\ComfyUi bench scratch engine on 48199 (has both packs + linked MpiNodes), not app:isolated
  (its engine is the user's 48188 at the old pin).
- 2026-10-29: the opencv conflict named in the audit was already fixed by MPI-413; pip
  wins are measured in `python_deps.in` lines, not per-pack requirements.
- 2026-10-29: startup time is not a goal (see baseline); goals are installs and breakage.
- 2026-10-29: Phase 0 licence table missed RES4LYF's no-commercial-service preamble (corrected
  in research/licences.md). clown/ must NOT be committed until Fabio picks: ask the author or
  clean-room rewrite. Also: OpenPose code+weights are CMU non-commercial; DepthAnything V2
  Large (AIO depth default) is CC-BY-NC. All other pack LICENSE openings swept clean.
- 2026-10-29: ultralytics stays (MPI-1339 option a: YOLO .pt are pickled ultralytics objects).
- 2026-10-29: controlnet_aux ports never download weights -> Phase 2 for MPI-1338 adds weight deps.
- 2026-10-29: MPI-1342 moved `rife47` targetPath to `models/rife`: a weight-only folder under
  custom_nodes/ is an IMPORT FAILED (ComfyUI imports every dir there). The Pod image still bakes it
  at `custom_nodes/comfyui-frame-interpolation/ckpts/rife` (Dockerfile RIFE_DIR) and still clones
  the three packs; MpiRifeVFI reads that old dir too, so today's image works. The rebuild that
  drops the three clones MUST move RIFE_DIR to /opt/ComfyUI/models/rife in the same change.
- 2026-10-29: MPI-1341: paid Flow packages get KJNodes through a MODEL's dependency list, not their
  own requiredDeps (Head Swap listed only the LoRA + inpaint-cropandstitch). Dropping a pack from
  models.js breaks the old package, so its re-export bumps compat.minAppVersion to the release that
  ships the swap. raw/ templates keep a few KJ authoring nodes (SetNode/GetNode etc.): bench-only.
- 2026-10-29: RES4LYF registers bong_tangent globally and Chroma's UltimateSDUpscale uses it;
  clown/ (or its replacement) must register it too.

## Current State
Phases 1-2 COMPLETE, MPI-1343 included: MPI-1339, MPI-1341, MPI-1342, MPI-1343 CLOSED (1337 too; 1338 and
1340 rejected, commercially restricted). MPI-1343 = Vision 382e20a90 on MpiNodes 4d8b87e, GPU A/B
identical; Painter I2V, Krea2-ControlNet and the MiniMax H3 latent upscaler stay (no licence). The
engine now ships 10 packs. Head Swap 1.1.1 (Cubric-Flows) supersedes 1.1.0; it needs app 2.1.4, so its
Gumroad upload goes with the 2.1.4 release, not before (installed Flows never auto-update; buyers
re-download). DECIDED 2026-10-29 (Fabio): STAY on ComfyUI v0.42.1. v0.43.0 was researched (MOSS-Image
fixes, H3 PDD-bank LoRA fix, Flux2/Klein VAE fuse, Qwen 2.1 cache; adds comfy-aimdo 0.6.0 + comfy-kitchen
0.2.40 pins; open issues cluster on Dynamic VRAM OOM when switching workflows) and not taken. NEXT: Phase
3 = RunPod smoke of the current engine via /mpi-bump-engine --plan (costs money: state price, ask Fabio
first). ComfyUI master has a native MiniMax H3 latent upscaler, not
in a tag yet: a later swap for the unlicensed pack. Gotcha: the GPU is shared with H3 benches -
gpu_lease.py with a long --timeout; check :8189/queue for Fabio's own bench runs, which the lease cannot
see. The user's open app must restart to reinstall MpiNodes at the new pin.

## Remaining Work
- Phase 1, Phase 2, Phase 3 as above. The Pod's lock copy (`mpi-ci`) syncs at the next
  image build.
