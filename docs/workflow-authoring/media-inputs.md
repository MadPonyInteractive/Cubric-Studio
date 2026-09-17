# Media inputs — one Upload loader per slot, staged into the engine `input/`

> Part of [workflow-authoring](README.md). **Canonical home** for the media-input
> rule. Applies to any Cubric workflow — models AND apps — that reads an image,
> mask, video, or audio input. It lives here so both the
> [add-model playbook](../playbooks/add-model/README.md) and [Flows](../flows.md)
> point at ONE source.

## The rule (MPI-800)

**Every media input is ONE MpiNodes Upload loader, titled `Input_*`.**

| media | node | `loaded` output |
|---|---|---|
| image / mask | `MpiLoadImage` (`channel` picks the mask source; a detailer mask uses `'mask'`) | 4 |
| video | `MpiLoadVideoUpload` | 8 |
| audio | `MpiLoadAudioUpload` | 1 |

- **The app stages the file into the engine's `input/` folder and injects that path
  into the node's `string` widget.** MpiNodes 1.2.13+ reads a path only when it
  resolves inside ComfyUI's own `input/`, `output/` or `temp/` (the Comfy Registry
  policy); a project-folder path injected as-is loads nothing.
- **`string` is tried first, then the picker.** A shipped graph keeps the picker on
  `None` and `string` empty, or a file picked on the bench would load for every user
  who leaves the slot empty. `scripts/sync-raw-workflows.mjs` sets both on the
  converted output and `scripts/validate-injection-rules.mjs` refuses anything else,
  so `raw/` may keep a picked test file: pick it, test on the bench, sync.
- **Nothing loaded:** the media outputs block (`block_if_empty` on) or arrive as a 1x1
  blank / silent audio (off). **`loaded` is False either way and is never blocked**, so
  it is the presence signal — wire it into the gates. An unused optional slot (a t2v
  graph's `Input_Start_Frame`) costs nothing.
- **No `MpiString`, no `MpiAnyChecker` in a slot.** `has_value` only says a string was
  typed; since containment a string can be non-empty while nothing loads.
- **One exception:** `resize_video.json`'s `Input_Video` is an `MpiString` that feeds
  both `VHS_LoadVideoPath` and `MpiHasAudio`. The app stages its value the same way.

Pinned by `tests/workflow-media-slots.test.cjs` (every shipped graph).

The pre-1.2.16 path loaders (`MpiLoadImageFromPath` / `MpiLoadVideo` / `MpiLoadAudio`)
still exist in the pack and still work, with the same containment; they are just not
an app slot.

### Raw `widgets_values` order

The converter maps `widgets_values` positionally against `/object_info` order, and the
frontend appends the upload button's value LAST, where the converter ignores it:

| node | `widgets_values` |
|---|---|
| `MpiLoadImage` | `[picker, channel, block_if_empty, string, "image"]` |
| `MpiLoadVideoUpload` | `[picker, block_if_empty, force_rate, string, "image"]` |
| `MpiLoadAudioUpload` | `[picker, block_if_empty, string, null, null]` (player, upload) |

**A node's default does NOT auto-fill a missing *required* key in an API prompt** —
`block_if_empty` is required, so verify the converted JSON carries it. Replacing a
slot by script: clone a node the bench saved (never hand-write one), keep the old
loader's id, `pos` and output links (same RETURN_TYPES), and re-point any gate at
`loaded`. The MPI-800 conversion did exactly that for 35 raw files.

`ltx_video_upscale.json` and `remove_background.json` have **no `raw/` twin** — their
API JSON is hand-maintained, so no sync rebakes them and the same edit is made by hand.
`tests/workflow-media-slots.test.cjs` sweeps the shipped graphs, not `raw/`, so it
catches one that was missed either way.

### Path source law

Every injected path comes from the **PROJECT FOLDER** — gallery or
`.preview-assets`, resolved via `/project-file?path=` — or a temp file the app wrote
itself (the GIF cut-out video). `_resolveMediaPath` decodes `/project-file?path=` →
local path, then:

- **local engine** — `_stageLocalMedia` → `POST /comfy/stage-media` puts it in
  `<engine input>/mpi_staged/<hash><ext>`: a **hardlink** first (free; a hardlink's real
  path is the link itself, so the node accepts it), a copy when the link fails (another
  volume). The name keys on path + size + mtime, so a re-run reuses the file. The
  folder is emptied each time the app spawns the engine. A symlink or junction would
  NOT work — it resolves back to the project and is refused.
- **remote engine** — `_uploadRemoteMedia` ships the bytes to the Pod, which lands them
  in the Pod ComfyUI's `--input-directory`, and injects that Pod-absolute path.

Reuse-prompt resolves against the project store and fails hard otherwise;
`_assertMediaSourceExists` HEAD-probes the source and raises the
`input_asset_deleted` soft-error (WARNING toast, not the crash dialog) when a
reused card's source was deleted.

### Injection

Title-based: a param keyed like the node title (`Input_Image`, `Input_Mask`,
`Input_audio`, `Input_Start_Frame`, …) routes by **target node class**
(`PATH_MEDIA_CLASSES` in `comfyController.js`) → resolve → stage/upload → inject.
Case-insensitive on both sides. On an Upload loader the value goes into `string`
only, and the picker is forced to `None` in the dispatched graph too.

Data-URL media (the auto-mask painted mask arrives as a `data:` URL) is first
written to `mpi_staged/` via `POST /comfy/stage-media-data-url`, then flows the
same path.

## No placeholder latent — `LoadLatent` is gone (MPI-466)

**This section used to say the opposite, and the reversal is the point.** It read
*"Do NOT 'finish the cleanup' by removing latent staging — there is no path node
for latents; killing this breaks every multi-stage LTX/Wan run."* That was true
while `LoadLatent` was the only way to read a latent, because ComfyUI validates a
Load* node's baked filename even when its output is gated off, so three dummy
`.latent` files had to be copied into the engine `input/` before every `_ms`
submit.

`MpiStageLatents` **is** the path node that did not exist. It reads its stage-1
file from a `load_path` widget the app writes per run, checks the engine `input/`
first and falls back to `<output>/latents/`. WAN, H3 and finally LTX all migrated
onto it, so no shipped graph carries a `LoadLatent` at all — and staging a file
that nothing loads is just three dead bytes in the build.

Deleted, therefore, and do not reinstate:

- `WORKFLOW_INPUT_DEFAULTS` and `POST /comfy/prepare-workflow-inputs` (`routes/comfy.js`)
- `_MEDIA_INPUT_CLASSES` + `_prepareWorkflowInputs` (`commandExecutor.js`)
- `comfy_workflows/input/{ComfyUI_00001_,ltx_video_latent_00001_,ltx_audio_latent_00001_}.latent`

Pinned by `tests/optional-media-placeholder.test.cjs`, which now fails in BOTH
directions: a bare Load* node reappearing in an optional graph, and
`WORKFLOW_INPUT_DEFAULTS` reappearing in `routes/comfy.js`.

`stage-preview-latent` is a DIFFERENT mechanism and stays — it writes the real
per-run stage-1 latent into the engine `input/` under a per-run name, which is
exactly what `MpiStageLatents.load_path` then reads.

## MUTE severs a link. BYPASS passes it through. They are NOT interchangeable (MPI-466)

A **muted** node (LiteGraph `mode: 2`) is removed and its output links go with it.
A **bypassed** node (`mode: 4`) is removed but its links are re-routed through by
matching type. The converter reproduces both exactly as the ComfyUI frontend does,
so a mute left on a live path ships a graph with **missing required inputs**.

What that looks like, because it does not look like an error: LTX shipped with
`Stage 2 Video/Audio Latent` and `Model` reroutes muted, so `VAEDecode.samples`,
`LTXVAudioVAEDecode.samples` and both `CFGGuider.model` arrived unlinked. ComfyUI
reported `Output will be ignored` for EVERY output node and the prompt "executed"
in **0.07 seconds** with no video and no failure. The app logged
`Generation completed but no output returned`.

Mute is for a node you want *gone*, on a branch nothing downstream needs. If you
want a node skipped but the signal to keep flowing, bypass it. If the path is
live, neither — leave it enabled.

The conversion gate below now catches this class before bake.

## `block_if_empty: false` on any loader whose PRESENCE drives routing (MPI-466)

A loader raises an `ExecutionBlocker` on its media outputs when nothing loads and
`block_if_empty: true`. That blocker propagates downstream and kills
the branch — which is correct for a genuinely required input, and **wrong for a
media-derived route**, where the empty slot IS the signal.

In a presence-routed graph the routing is done by the loader's own `loaded` output →
the lazy `MpiIfElse` gates (`loaded` itself never blocks). H3 has no gate at all: its
blank-tolerant `MpiH3ImageToVideo` reads the 1x1 blank an empty slot produces, which
only exists with `false`. The frame slots stay `false` everywhere (a `true` has not been
tested since the `loaded` rewire). All three end-frame graphs agree
(`Input_Start_Frame` / `Input_End_Frame`):

| graph | start | end |
|---|---|---|
| `ltx_i2v_t2v*.json` | `false` | `false` |
| `minimax_h3_fl2va.json` | `false` | `false` |
| `wan22_i2v.json` | `false` | `false` |

H3 and WAN shipped with `start.block_if_empty: true` and were re-exported. Nobody
had hit it because `startFrame` was `required: true`, so an empty start never
reached those graphs — it only surfaced when the last-frame-only route needed one.

## Guard

`scripts/validate-injection-rules.mjs` gates every converted API before bake
(title-prefix law / capture / seed convention / integrity, and every Upload loader
titled `Input_*` with its picker on `None` and `string` empty). It STOPS and names
the offending node on a violation — it never auto-fixes. Run the raw→API sync
(`scripts/sync-raw-workflows.mjs`) after authoring or re-exporting a workflow.
