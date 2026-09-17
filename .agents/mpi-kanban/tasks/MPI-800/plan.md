# MPI-800 Plan - Adopt MpiNodes 1.2.16 (contained paths, `loaded` outputs, Upload nodes)

Brief: `brief.md`. Evidence behind every line below: `research/call-sites.md`.

## Goal

The app engine runs MpiNodes `cff4c3b321f1eb9dc7403df8db6ed3ac5bd1e8fa` (1.2.16) and every
local generation still works: injected media is staged into the engine `input/`, every app
media slot is one Upload node whose `loaded` output drives its presence gates, no workflow ships a baked absolute path, and the
`/mpi/reload-extra-paths` call is gone. Pin, code and workflows land in ONE commit.

## Decisions (defaults taken, say if wrong)

1. **Staging** - new `POST /comfy/stage-media {path}` next to `stage-media-data-url`. Target
   `input/mpi_staged/<sha256(realpath|size|mtimeMs)[:16]><ext>`; hardlink first (free, and
   accepted by the node), copy to a temp name + rename when the link fails (other volume).
   A path already inside the engine `input/` is returned unchanged. The data-URL route moves
   into the same subfolder. The subfolder is emptied when the app spawns the local engine
   (nothing can be queued on an engine that was down), so cross-volume copies never pile up.
   Subfolder, not top level: core `LoadImage` pickers list top-level files only.
2. **Remote** - no change. The wrapper lands uploads in the dir ComfyUI runs with as
   `--input-directory` (code-read, research table).
3. **Model folders** - delete `reloadExtraPathsWhenReady` and its call. `POST
   /comfy/extra-folders` returns `restartNeeded` when the engine is running; `MpiSettings`
   shows an info toast asking for an engine restart. No auto-restart.
4. **Workflow edits by script, not by hand** - one guarded LiteGraph edit script over `raw/`:
   round-trip guard, `pos`/`size` byte-identical on every surviving node, links table and
   both link ends updated together. What it replaces: Phase 3.
5. **Brush** - not this card: no shipped workflow uses `MpiBrushTrain`. `mpi-message` MPI-623
   (doing) with the 1.2.13 install/dataset rules.

## Phase 1: Code (works on both node packs)

- [x] `routes/comfy.js`: `POST /comfy/stage-media`; data-URL staging into `mpi_staged/`;
  empty `mpi_staged/` at local engine spawn; drop `reloadExtraPathsWhenReady` + call;
  `restartNeeded` on `/comfy/extra-folders`.
- [x] `js/services/comfyController.js`: local branch of the media loop stages via the route
  (`_stageLocalMedia`), remote branch unchanged; comments that say "no staging" rewritten.
- [x] `MpiSettings.js` `_saveExtraFolders`: toast on `restartNeeded` (user copy, no ids).
- [x] Test: staging helper - hardlink, cross-volume copy fallback (forced), reuse on same
  key, new key after mtime change, input/ passthrough, missing source -> 404. Update any
  test stubbing the local media branch (`tests/auto-mask-inject-titles.test.cjs`,
  `tests/inject-params-titles.test.cjs`).
- **Verify:** `node --test` on the new + touched tests; `npm run lint` on touched files.

## Phase 2: Pin + engine

- [x] `dev_configs/node_lock.json` `ComfyUI-MpiNodes.commit` -> `cff4c3b321f1eb9dc7403df8db6ed3ac5bd1e8fa` (1.2.16)
  (via the `/mpi-nodes-sync` pin procedure; sha pasted from `git rev-parse`).
- [x] **Fabio restarts the app** (server routes + boot drift repair; the engine is shared, an
  agent never restarts it).
- **Verify:** `engine/.../ComfyUI-MpiNodes/.mpi_node_commit` = new sha; `GET
  127.0.0.1:48188/object_info/MpiLoadVideo` lists `loaded`; `app.log` shows the repair.

## Phase 3: Workflows - every app media slot becomes ONE Upload node

The concept (Fabio, 2026-09-17), for image, video AND audio, in every `raw/` file that has it:
an app media slot is an ACTIVE (`mode` 0) node titled `Input_*` that is either a loader
itself (`MpiLoadImageFromPath` / `MpiLoadVideo` / `MpiLoadAudio`) or an `MpiString` whose value
reaches loader `string` inputs directly or through an `MpiAnyChecker`. Replace it with one
Upload node (`MpiLoadImage` / `MpiLoadVideoUpload` / `MpiLoadAudioUpload`):

- **No new nodes besides the Upload node - no new Set nodes.** Its output slot k takes over
  every link the old loader's slot k had (same RETURN_TYPES, subclass), and the checker's
  `has_value` consumers are re-pointed at its `loaded` output. Link ids are kept, only the
  origin changes.
- Delete the old loader, the checker used for this, and the `MpiString`. The Upload node
  takes the `Input_*` title, the old loader's `pos`, colours, `channel` / `block_if_empty` /
  `force_rate`, the picker on `None` and `string` "" (a widget since 1.2.16; the app injects into it).
- Cloned from the donor `G:\ComfyUi\ComfyUI\user\default\workflows\mpi800_donor.json`
  (all three Upload nodes, 1.2.16 shapes). Dry-run convert against the bench (8188, 1.2.16):
  `image`/`video`/`audio` = "None", `channel`, `block_if_empty`, `force_rate` and `string: ""`
  all map right; the trailing `upload` / `audioUI` values are ignored.
- ABORT and list for review (no guess): an `MpiString` that also feeds a non-loader (e.g.
  `resize_video`: VHS + `MpiHasAudio`, left as is), one string feeding two loaders, a
  checker whose pass-through reaches a non-loader, Reroute/GetNode in the slot chain, muted
  slot nodes.
- Shipping normalisation in `scripts/sync-raw-workflows.mjs` (not the converter, which bench
  experiments use): every Upload node in a converted runtime/template gets its picker forced to
  `None`, so a bench pick never ships (1.2.16 falls back to the picker when `string` is empty). An Upload node without an `Input_*` title in a
  shipped graph is refused.

- [x] Edit script over `raw/` (guards: round-trip, surviving nodes' `pos`/`size` identical,
  links table and both link ends together, `mode` unchanged); clear any remaining live baked
  paths.
- [x] Sync normalisation above. (`PATH_MEDIA_CLASSES` gained the three Upload classes in Phase 1.)
- [x] `COMFY_URL=http://127.0.0.1:48188 node scripts/sync-raw-workflows.mjs` (converts,
  gates, bakes via `orchestrate.py`). Check `generate_*.py` `_bake_widgets` title lookups
  still land on the Upload nodes' `string`.
- [x] `generate_h3.py`: stale "MpiAnyChecker" comments.
- [x] Guard test over `comfy_workflows/*.json`: no absolute path baked anywhere in a media
  input; no `MpiAnyChecker` fed by an `Input_*` string; every Upload node titled `Input_*`
  with the picker on `None`. Rewrite DramaBox's
  exemption in `tests/flow-required-media.test.cjs` (and `flow-derived-fields` /
  `inject-params-titles` if they pin checker ids).
- **Verify:** `research/survey.py` prints no `LOADER-GATES` / `ABS` on shipped files;
  `node scripts/verify-workflow.mjs` + `validate-injection-rules.mjs` on every changed API
  file (48188); diff `mode` per node id vs HEAD raw; `node scripts/smoke-workflows.mjs --plan`;
  `npm test`.

## Phase 4: Live verification (Fabio's app, GPU lease)

Scratch project, `gpu_lease.py run -- ...`, `/connector/generate`, read sidecars:
- [ ] edit op with a project-folder image (staging, hardlink case) and one with media on a
  different volume from the engine (copy case)
- [ ] optional inputs empty: klein edit 1-image, qwen edit no mask, LTX t2v + i2v + FLF,
  wan22 i2v, DramaBox without a voice (the `loaded` gates)
- [ ] a video op (upscale or interpolate), `resize_video` on a clip with audio (`MpiHasAudio`)
- [ ] reuse a card whose source was deleted -> still the `input_asset_deleted` toast
- [ ] add a model folder with the engine running -> the restart toast
- **RunPod smoke** (`release:check` will demand it, research note): at release, unless
  Fabio asks for it now.

## Phase 5: Docs, messages, commit

- [ ] Rewrite (current truth, no history layers): `docs/workflow-authoring/media-inputs.md`,
  `mpi-nodes.md`, `docs/playbooks/add-flow/02-media-io.md`,
  `existing-flows/drama-box.md`, `docs/playbooks/add-model/01-workflow-split.md`.
- [ ] Ask before touching `.claude/rules/comfy_engine.md:353` (names the removed route).
- [ ] `mpi-message` MPI-623 re Brush.
- [ ] ONE commit by pathspec: code + tests + workflows (raw, templates, runtime) +
  `node_lock.json` + docs + `tasks/MPI-800/` + only the MPI-800 hunks of `board.json` /
  `.agents/mpi-kanban/events.jsonl` (MPI-532's uncommitted lines stay unstaged).

## Verification

**Verify mode:** user-ux (Phase 4 runs in Fabio's app, and Phase 2 needs Fabio to restart it)

## Current State

2026-09-17 ~18:00Z. COMMIT 2 LANDING. Engine 48188 is LIVE on MpiNodes 1.2.16 (Fabio restarted;
the boot repair re-installed cff4c3b, the engine starts on demand so it came up later). Bake DONE
(46 runtime + 11 templates), MPI-771's `gif_cutout_birefnet` folded in (35 raw files converted),
and `ltx_video_upscale` / `remove_background` migrated BY HAND because they have no `raw/` twin.
Full suite 1311/1311, survey + verify-workflow + smoke --plan clean; evidence in validation.md.

NEXT: commit 2 (pin + rebaked graphs + 5 tests + docs + card, private index), push, then Phase 4
live checks in Fabio's app (ask first), then close-out. Open: `mpi-ci`'s pod `node_lock.json` is
behind on MpiNodes (sibling repo, code-only, no image rebuild — smoke prints the 3 commands);
`.claude/rules/comfy_engine.md:353` still names the removed route (needs Fabio's permission).

### Handoff snapshot (2026-09-17 ~15:45Z, superseded above) Fabio has RESTARTED the app; at handoff 48188 did not answer yet
(booting). CI on ee034559 = success. The scratch scripts are copied into research/ (bake.mjs =
the bake runner, upload_slots.mjs = the raw converter, commit1.py = the private-index commit
recipe used for commit 1) - run bake.mjs from there (it has absolute repo paths only). COMMIT 1 PUSHED: ee034559 (code, staging test, sync/validator, raw/ 34 files,
generator comments, this card, MPI-800 board/events lines) via a private index. Still
uncommitted and held for commit 2: dev_configs/node_lock.json (pin), the three runtime tests +
two comment-only test edits, every doc edit, and the rebake itself.
Phases 1-2 DONE. Phase 3 + 5 prepared, WAITING ON THE ENGINE RESTART:
- raw/ 34 files converted (Upload loaders); sync `shipUploadSlots` (picker None + string '') is
  exported and imported by the bake; validator `checkUploadSlots` proven both ways;
  `comfyController._inject` writes only `string` on Upload loaders and forces the picker None.
- Tests: `tests/workflow-media-slots.test.cjs` (RED on the unbaked runtime, sync-helper case
  green); `flow-required-media` (DramaBox fork on `loaded`), `flow-model-choice`
  (`MpiLoadImage` + picker None), comments in `inject-params-titles` / `optional-media-placeholder`.
  These two runtime-reading tests go green only after the bake.
- Docs rewritten: media-inputs.md (canonical), mpi-nodes.md, generator-patterns.md,
  add-flow/02-media-io.md, existing-flows (chatter-box, drama-box, ltx-extend, ltx-foley,
  stems, voice-changer), ui/paint-gizmo.md, models (h3, klein, sdxl depth-control, wan
  two-stage-sigmas), bump-engine/01-smoke-run.md, runpod-remote-engine.md; registry.py and
  generate_h3.py comments. Peer-held docs messaged instead (see Coordination).

NEXT (in order):
1. Fabio restarts the app. DO NOT bake before: the running app serves runtime workflows from
   the tree, and 48188 still runs 1.2.12 (no MpiLoadImage class) - a baked runtime would break
   every generation, including agents generating over the connector.
   Check: `curl 127.0.0.1:48188/object_info/MpiLoadImage` is non-empty.
2. `node <scratchpad>/bake.mjs` (= sync steps on the 33 git-changed raw files, lipdub excluded,
   no raw commit, peer file untouched; COMFY_URL=48188). Scratchpad:
   C:/Users/Fabio/AppData/Local/Temp/claude/C--AI-Mpi-Cubric-Vision/0d43f404-1bda-4421-9ca6-f90c159755a3/scratchpad/
3. `node --test` on the workflow tests, then `npm test`; `research/survey.py`;
   `scripts/verify-workflow.mjs` on the changed runtime files; `smoke-workflows.mjs --plan`.
4. Phase 4 live checks (ask Fabio first; they open a scratch project in Fabio's app).
5. Close: validation.md, ONE commit by pathspec (MPI-800 hunks only in board.json/events.jsonl),
   ask before touching .claude/rules/comfy_engine.md:353.

Coordination: MPI-532 session (fe5850ff) LIVE, holds board.json + events.jsonl + add-flow/README.md
(messages ff8f8195, a46f5205). MPI-708 (0408510a) has uncommitted edits in
workflow-authoring/README.md, add-model/README.md + 01-workflow-split.md, ltx/audio-input.md
(messages 3d7076be, 9163e531). MPI-771 owns gif_cutout_birefnet + masking-sam3-gif.md
(069680a2, 2c3de183). MPI-623 Brush (9c02ef9c). MPI-774 (2951155f; its isolated app did the
drift repair).

## Plan Drift

- 2026-09-17: brief assumed `scripts/smoke-workflows.mjs` can smoke a LOCAL engine; it is
  RunPod-only. Local proof moved to Phase 4 live runs; the executing smoke stays the release gate.
- 2026-09-17 (Fabio, bench screenshot): Phase 3 target changes. The `MpiString -> MpiAnyChecker
  -> MpiLoadImageFromPath` triple is REPLACED by ONE Upload node (`MpiLoadImage` /
  `MpiLoadVideoUpload` / `MpiLoadAudioUpload`), `string` socket unwired, `loaded` -> the
  has_* Set node, media -> the media Set node. Consequences checked in MpiNodes source:
  picker `VALIDATE_INPUTS` returns True (a baked pick never fails validation); picker keys
  are `image` / `video` / `audio`, all in `_inject`'s spray list. Needed: the Upload node
  carries the `Input_*` title; `PATH_MEDIA_CLASSES` gains the three classes; the converted
  runtime ships `string: ""` and a blank picker so a bench pick never ships. Open: scope
  (gated triples only, or every app media slot) and a donor LiteGraph node from the bench.
- 2026-09-17 (Fabio): scope = every app media slot. STANDBY: Fabio is changing the Upload
  nodes' `string` from a forceInput socket to a WIDGET in MpiNodes. When that ships: pin its
  release commit (not `600c378`), re-read `mpi800_donor.json` (image + audio + video donors),
  re-run the donor dry-run convert (a widget `string` now takes a positional value, so the
  widget order must be re-proven), and drop the "`string` absent from the API" handling above
  if the converter now emits it.
- 2026-09-17: 1.2.16 landed (`245b8b3` + release `cff4c3b`, on origin/main). `string` is a widget
  tried FIRST, the picker is the fallback and lists `None` first. Donor re-read (image, video,
  audio) and converted: `string: ""` is emitted, so the only shipping normalisation left is
  picker -> `None`. Pin target is `cff4c3b321f1eb9dc7403df8db6ed3ac5bd1e8fa`.
- 2026-09-17: a peer's untracked `comfy_workflows/raw/gif_cutout_birefnet.json` (+ runtime) is in
  the tree. `sync-raw-workflows.mjs` is git-driven and commits `raw/` - run it on explicit files
  or check its options so the peer file is neither converted nor committed.

## Noticed, not actioned

- `_resolveMediaPath` flips `/` to backslash on any raw (non `/project-file`) path, which is
  wrong on a Linux/macOS local engine (gif cutout temp video). Pre-existing.
- Pod uploads keep the source basename with `overwrite=true`: two different `t2i_001.png`
  from two projects race on the Pod. Pre-existing.
