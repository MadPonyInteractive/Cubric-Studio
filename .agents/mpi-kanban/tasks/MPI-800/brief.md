# MPI-800 - Adopt MpiNodes 1.2.13 - 1.2.16 (contained paths, `loaded` outputs, upload loaders)

Written 2026-09-17 by the ComfyUi-MpiNodes session that shipped these releases.
(The card title still says 1.2.14; the target is now **1.2.16 or later**. It was
not retitled because the root `events.jsonl` was claimed by the MPI-532 session.)
This card carries **what changed in the node pack**; working out every Vision call
site is this card's research step.

## Why the pack changed

Every MpiNodes release from 1.2.7 to 1.2.12 was Flagged on the Comfy Registry by a
human reviewer for real policy findings (verdicts are public at
`https://api.comfy.org/nodes/ComfyUi-MpiNodes/versions?include_status_reason=true`):
an unauthenticated HTTP route, path widgets that read/write anywhere on disk, and a
download-and-run of Brush. Users of the pack have been stuck on 1.2.6 since.

- **1.2.13** (`66f5ef0`): route removed, first path widgets contained, Brush no
  longer downloaded.
- **1.2.14** (`060e78c`, release commit `879901b`): the remaining path widgets
  contained, new `MpiLoadImage`.
- **1.2.15** (`39acd17`, release commit
  `600c3782cd96dc7e1b182b055c3ff98e082fd8b2`): `loaded` BOOLEAN output on the
  loaders, new `MpiLoadVideoUpload` / `MpiLoadAudioUpload`, the 1.2.14 browse
  pickers on the existing video/audio loaders removed again.
- **1.2.16** (`245b8b3`, release commit
  `cff4c3b321f1eb9dc7403df8db6ed3ac5bd1e8fa`): the three picker loaders
  (`MpiLoadImage`, `MpiLoadVideoUpload`, `MpiLoadAudioUpload`) get an injectable
  `string` WIDGET and a `None` picker option, so ONE of them replaces the whole
  `MpiString -> MpiAnyChecker -> path loader` chain. **Pin this commit** (or
  anything later on MpiNodes main).

**A path typed into, or injected into, any MpiNodes widget must now resolve inside
ComfyUI's own `input/`, `output/` or `temp/` folder.** Anywhere else is treated as
missing (loaders block / report `loaded` false) or raises (savers). This is not
negotiable on the node side - it is what the registry reviewer requires.

## Where Vision stands today

- `dev_configs/node_lock.json` pins `ComfyUI-MpiNodes` at `1de35a3` (1.2.12). The
  engine at `engine/ComfyUI_windows_portable/ComfyUI/custom_nodes/ComfyUI-MpiNodes`
  is a real folder with 1.2.12 code (`routes.py` still present). **Vision works
  today; it breaks the moment the pin moves without the changes below.**
- The standalone dev ComfyUI at `G:\ComfyUi` symlinks its MpiNodes to the
  `C:\AI\Mpi\ComfyUi-MpiNodes` checkout, so it ALREADY runs the new code.
  Workflows authored there with a pasted absolute path now block.
- `comfyController.js` `_resolveMediaPath` decodes `/project-file?path=...` to an
  absolute **project-folder** path and injects it (local engine). Under 1.2.13+
  that path is outside input/output/temp, so `MpiLoadImageFromPath`,
  `MpiLoadVideo`, `MpiLoadAudio` and `MpiHasAudio` treat it as missing: the branch
  self-gates and the run ends with "no output returned".
- Remote engine: `_uploadRemoteMedia` injects the Pod path returned by
  `/remote/upload/media` (documented as `/workspace/comfyui/input/<name>`). That is
  fine **only if** it is the Pod ComfyUI's real `input/` directory
  (`folder_paths.get_input_directory()` on the Pod) - verify, do not assume.
- `POST /comfy/stage-media-data-url` (routes/comfy.js:334) already writes into the
  engine `input/` and returns that absolute path - that path is accepted as-is. It
  is the pattern to extend.
- `routes/comfy.js:849` `reloadExtraPathsWhenReady` POSTs
  `/mpi/reload-extra-paths`. **That route is gone** (1.2.13). The call already
  catches its failure and logs a warning, so nothing crashes, but a model folder
  added mid-session is not visible until the engine restarts
  (`extra_model_paths.yaml` is read at boot only).

## What changed, per node (pack side)

| Node | Vision usage (shipped `comfy_workflows/*.json`) | Behaviour now |
|---|---|---|
| `MpiLoadImageFromPath` | 70 uses / 33 workflows | `string` resolves under `input/` if relative; absolute only inside input/output/temp; else missing -> blocks (or 1x1 blank if `block_if_empty` off). **New last output `loaded` (index 4)**. Widgets unchanged. |
| `MpiLoadVideo` | 11 / 9 | Same containment. **New last output `loaded` (index 8)**. Inputs unchanged vs 1.2.12 (the 1.2.14 `video` picker is gone again; a leftover `video` key in a prompt is ignored). One shipped workflow still carries a stale authoring path (`...\Wan 5b\Media\t2v_005.mp4`). |
| `MpiLoadAudio` | 11 / 8 | Same containment. **New last output `loaded` (index 1)**. Inputs unchanged vs 1.2.12. |
| `MpiHasAudio` | 1 / 1 (fed by the `MpiString` fan-out) | Same containment; an outside path now returns **False** (the audio branch is silently dropped, not an error). |
| `MpiStageLatents` / `MpiSaveLatent` / `MpiLoadLatent` | 5 / 5 | Bare names (`mpi_stage1`) unchanged; an absolute filename is honoured only inside output/ or input/. `MpiLoadLatent` has an optional `file` picker used only when `filename` is cleared. Latents staged into `input/` by `/comfy/stage-preview-latent` keep working. |
| `MpiJsonLoad` / `MpiJsonSave` | not in shipped workflows (check generators/scripts) | Load: input/-relative or absolute inside input/output/temp, else `{}`; optional `file` picker used only when `path` is empty. Save: output/ only, raises otherwise, creates subfolders, returns the resolved path. |
| `MpiBatchTextReplace` | not in shipped workflows | input folder inside input/ (or output/), output folder inside output/, else raises. |
| `MpiBrushTrain` | used by projects route (`routes/projects.js:2066`) | **Brush is no longer downloaded**: install it by hand into `custom_nodes/ComfyUi-MpiNodes/bin/brush-v0.3.0/` (SHA-256 pinned in `splat.py`); `brush_path` is only a file name in that folder. `dataset_path` must be a folder inside input/output/temp. SplatKit datasets are tens of GB - see the hardlink note below. |
| `MpiRandPromptGen` / `...Save` | not in shipped workflows | `preset_folder` inside input/output/temp (empty = bundled); save destination inside output/. |
| `MpiLoadImage` (NEW 1.2.14) | - | Picker (first option **`None`**, the default) + **choose file to upload** button (file lands in `input/`), preview, `channel`, `block_if_empty`, optional `string` **widget**; outputs image/mask/width/height/`loaded`. Picker rule below. |
| `MpiLoadVideoUpload` (NEW 1.2.15) | - | `MpiLoadVideo` + picker (`None` first) + upload button + `string` widget, same outputs (`loaded` index 8), same picker rule. |
| `MpiLoadAudioUpload` (NEW 1.2.15) | - | `MpiLoadAudio` + picker (`None` first) + player + upload button + `string` widget, outputs audio/`loaded`, same picker rule. Needs the pack's `web/MpiLoadAudioUpload.js` (ships with the pack). |

**Picker rule (1.2.16), all three picker loaders:** `string` is tried first (a file
name inside `input/`, with its subfolder, e.g. `mpi_staged_ab12.png` or
`sub/clip.mp4`; an absolute path inside input/output/temp also works). If `string`
is empty **or does not load**, the file selected in the picker is tried. Only when
both fail (picker on `None`) is nothing loaded: media outputs block (or blank with
`block_if_empty` off) and `loaded` is False. `block_if_empty` never blocks
`loaded` or the numeric outputs (verified live: video -> images/audio blocked,
fps/frame_count/duration/width/height 0, has_audio False, loaded False).

`loaded` is True only when a file was actually read, and it is **never blocked** -
with `block_if_empty` on, the media outputs block but `loaded` still arrives as
False, so it can gate other branches. Verified live on the dev engine for all six
loaders above.

Accepted path forms for every contained input: `name.png` or `sub/name.png`
(under input/), core's annotated `name.png [output]` / `[temp]` (the loaders; the
latent and JSON-save nodes take plain names), or an absolute path whose REAL path
(symlinks and junctions resolved) is inside input/output/temp. Different drive =
outside.

## Every workflow must be updated

**Every workflow under `comfy_workflows/`** (the API JSON, the `raw/` templates and
the generators in `comfy_workflows/scripts/workflow_generation/`) has to be
reviewed and updated for this change, not only the few that break outright. Per
workflow:

1. **Media paths.** Any path the app injects into `MpiLoadImageFromPath`,
   `MpiLoadVideo`, `MpiLoadAudio`, `MpiHasAudio` or an `MpiString` that feeds them
   must be a staged path inside the engine `input/` (the controller change below).
   Any absolute path baked into the workflow itself must be cleared or moved into
   `input/`.
2. **Gating.** Where an `MpiAnyChecker` sits on a path string only to produce
   `has_value` for a loader, wire the loader's new `loaded` output instead and
   drop the checker. `has_value` only says a string was typed; since containment a
   non-empty path outside the allowed folders gives `has_value` True while nothing
   loads, so `has_value` is now the wrong signal. (Checkers that gate on something
   other than a loader's path are unaffected.)
3. **Loader choice (Fabio's direction).** New and reworked workflows use the
   picker loaders (`MpiLoadImage`, `MpiLoadVideoUpload`, `MpiLoadAudioUpload`) as
   the app slot itself: Vision injects the staged file name straight into the
   loader's `string` widget (the node carries the param title, like
   `Input_Image_3` today), and `loaded` feeds the has_* flag. That removes the
   `MpiString` and `MpiAnyChecker` nodes. `comfyController.js`
   `PATH_MEDIA_CLASSES` and the injection key must learn these three classes.
   Existing `MpiLoadImageFromPath` / `MpiLoadVideo` / `MpiLoadAudio` slots keep
   working.
4. **Sanitise every picker to `None`.** Vision must set every picker loader's
   picker (`image` / `video` / `audio`) to `"None"` in every workflow it ships or
   saves - Fabio authors with real files picked, and the picker is the fallback
   when the injected string is empty or does not load, so a saved test file would
   otherwise run in place of "no input". Also clear any leftover authoring text in
   `string`. Build this into the workflow sanitiser, not into per-workflow hand
   edits.
5. **Re-export.** Regenerate the API JSON from the edited raw templates /
   generators. Existing output indices do not move (`loaded` is appended last:
   `MpiLoadImageFromPath` 4, `MpiLoadImage` 4, `MpiLoadVideo` / `...Upload` 8,
   `MpiLoadAudio` / `...Upload` 1). Workflows saved on the dev install while 1.2.15
   was live reload with junk (`"image"`, `"None"`) shifted into the new `string`
   widget - harmless now (it falls back to the picker), but the sanitiser should
   clear it.
6. **Smoke every workflow** on a local engine running the new pin
   (`scripts/smoke-workflows.mjs`), including one run whose media lives only in a
   project folder (proves the staging) and one run with an optional input left
   empty (proves the `loaded` gating and that no picker is left on a file).

## What Vision needs in code (research to confirm, then plan)

1. **Stage every injected media file into the engine `input/` folder** before
   injecting, and inject that staged path (absolute inside input/, or the bare
   name). Content-hash names like `mpi_staged_<hash>.<ext>` avoid collisions and
   reuse identical files. For big video / dataset files on the same volume, a
   **hardlink** is accepted (its real path is the link itself - verified) and costs
   no copy; a symlink or junction is NOT accepted (it resolves outside). Covers the
   local engine path in `_resolveMediaPath` and every `PATH_MEDIA_CLASSES` class
   that is an Mpi node (`VHS_LoadVideoPath` is not ours and is unaffected - but the
   same `MpiString` value also feeds `MpiHasAudio`, which is).
2. **Remote**: confirm the Pod upload lands in the Pod ComfyUI's actual `input/`
   directory; if the wrapper writes elsewhere, change the wrapper or the target.
3. **Drop the `/mpi/reload-extra-paths` call** (or keep it as a harmless no-op and
   tell the user to restart the engine after adding a model folder).
4. **Brush**: the installer/engine setup must place Brush in
   `custom_nodes/ComfyUi-MpiNodes/bin/brush-v0.3.0/` (the node never downloads
   it), and the splat flow must hand `MpiBrushTrain` a dataset inside the engine's
   input/ or output/.
5. **Bump `dev_configs/node_lock.json`** `ComfyUI-MpiNodes.commit` from
   `1de35a3...` to `cff4c3b321f1eb9dc7403df8db6ed3ac5bd1e8fa` (1.2.16, or later) **in the same
   commit** as the code and workflow changes, so no build ever pairs new nodes with
   old injection or old workflows. The Pod image consumes the same lock
   (`mpi-ci/cubric-vision-pod`), and the app installer builds node download URLs
   from it, so dev and every later release move together.

## Registry status at hand-off

1.2.13-1.2.15 Flagged on the same 7 info-level scanner hits only (ffmpeg/Brush
subprocess, one env read; no reviewer verdict yet), 1.2.16 just published,
`latest_version` still 1.2.6. Vision pins by commit, so it does not
wait on the registry.

## Housekeeping

`task_ops create` wrote MPI-800's entry into `board.json` and its `task.created`
line into the root `events.jsonl` while both were claimed by the MPI-532 session
(`state/files/c5e2a7d1...`). Whoever commits those files must keep the MPI-800
lines; this card's folder is uncommitted.
