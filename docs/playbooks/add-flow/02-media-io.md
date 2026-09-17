# 02 — Media I/O

Polymorphic input slots, path-reading nodes, injection routing, self-gating outputs,
multi-output capture, and the two audio traps. Read [README](README.md) first.

## Polymorphic media slots

`inputSchema.media` is an array of slot GROUPS; `MpiBaseFlow` renders each generically:

```js
inputSchema: {
  media: [
    { type: 'image', mode: 'upto', max: 2, roles: ['image1', 'image2'] },
    { type: 'audio', mode: 'upto', max: 1, roles: ['audio1'] },
  ],
}
```

- `type`: `'image' | 'video' | 'audio'`.
- `mode: 'upto'` = dynamic-until-cap (an empty drop zone "Drop up to N…" appears until `max`
  slots are filled; `'fixed'` is treated as `'upto'` for now).
- `max` = cap.
- `roles` (length === max) = the role key assigned to the i-th filled item BY POSITION (models
  reference by index; roles re-assign on removal). **Each `role` MUST match a `key` in the op's
  `mediaInputs`** so the injector maps the item to its `Input_*` node.
- No `media` key → no upload UI (media-free flow). Media is NEVER a Run blocker in v1, but a flow
  that declares slots and gets none (and no prompt) is empty-run-guarded (`ui:warning`, abort).
- Each drop zone accepts DROP or click-to-browse (multi-select); over-cap files are dropped +
  `clientLogger.warn`.

## Input nodes (the core contract)

**Every flow media slot is ONE MpiNodes Upload loader titled `Input_*`** (MPI-800; the full
contract is [workflow-authoring/media-inputs.md](../../workflow-authoring/media-inputs.md)):

| media | node class | the app writes | nothing loaded |
|---|---|---|---|
| image | `MpiLoadImage` | the staged path into `.string` | image/mask block (`block_if_empty`) or 1x1 blank; `loaded` (4) False |
| video | `MpiLoadVideoUpload` | same | frames/audio block or blank; `loaded` (8) False |
| audio | `MpiLoadAudioUpload` | same | audio blocks or silent; `loaded` (1) False |

The app stages the file into the engine `input/` first (MpiNodes only reads paths inside
ComfyUI's own folders) and ships every picker on `None`. `loaded` never blocks, so it is the
presence signal for any fork. Stock `LoadImage`/`LoadAudio` are not slots: they read an
input-dir filename, cannot take an injected path, and cannot report `loaded`.

## 🔴 Self-gating is not the same as HANDLED

The table above says an empty slot "self-gates", which is true and reads as reassuring.
It is not. A self-gated branch produces **no output**, and ComfyUI reports the run as
**success** — so the user presses Generate, waits, and gets nothing, with no error
anywhere. Twelve slots across eight flows shipped in exactly that state (2026-08-28).

**What turns a self-gate into a refusal is `required` on the OP's media slot**, in
`js/data/commandRegistry.js`:

```js
mediaInputs: [
    { key: 'audio1', mediaType: MEDIA_TYPE.AUDIO, title: 'Input_Audio', required: true },
],
```

`_findMissingMediaSlot` (`js/services/generationService.js`) reads it at **enqueue** and
again at **dispatch**, and raises "Add an image/video/audio file before generating".
Flows reach it like everything else: `MpiBaseFlow._run` → `submitFlowGeneration` →
`enqueueGeneration`.

- **An ABSENT `required` already means required.** `required: false` is never accidental —
  it is always a deliberate opt-out of that guard.
- **The check is per media TYPE, not per role** (MPI-466). One attached image satisfies
  every image slot, so it catches "no media of this type at all" and never a deliberate
  one-of-two run.
- **A later step may DERIVE the media**, after the slot the user sees. Scribble's slot is
  labelled "Drawing (optional)" and its `paint` step fills `image1` at run time, before
  enqueue — so the blank-canvas route passes the guard. Check `flow.steps[].into` before
  concluding a slot is unfillable.
- **`upto` is the only media mode there is**, so a slot can never RENDER as required. The
  declaration is the only signal; nothing in the UI shows it.

**The law, and `tests/flow-required-media.test.cjs` enforces it repo-wide:** a slot whose
graph blocks when empty must not declare `required: false`. It is asserted as that PAIR
rather than "everything is required", because DramaBox is the legitimate counter-example:
its voice slot really is optional, which is how its prompt-only arm builds a speaker from
the words alone.

🔴 **And DramaBox is exempt through LAZINESS, not through the flag** — stated wrongly
once already and caught by a claim audit. `Input_Audio` (`MpiLoadAudioUpload#11`) carries
`block_if_empty: true` like every other loader, but its `loaded` output drives
`MpiIfElse#15` between two samplers, one taking a `voice_ref` and one not. `loaded` never
blocks and `MpiIfElse` declares its arms **lazy**, so an empty slot takes the prompt-only
arm and the blocked `audio` output is never requested — the flag is real and simply
unreachable. **So "does this slot block?" is not answerable from the flag alone.** Fork on
`loaded` when you want a slot optional; feed its media straight on when you do not.

## Injection routing (`comfyController` media-kind sweep)

`comfyController` (in `runWorkflow`) routes each media param by the CLASS of the node that
carries its title (case-insensitive):

1. **Class route** — a param whose same-titled node is in `PATH_MEDIA_CLASSES` (the three
   Upload loaders, the older path loaders, `VHS_LoadVideoPath`, and the `MpiString` fan-out)
   takes the path branch. A `data:` URL is written to a file first.
2. **Resolve** — `_resolveMediaPath` decodes `/project-file?path=`; `_assertMediaSourceExists`
   raises the `input_asset_deleted` toast for a deleted reuse source.
3. **Place** — local engine: `_stageLocalMedia` (`POST /comfy/stage-media`, a hardlink or copy
   into `input/mpi_staged/`); remote: `_uploadRemoteMedia` → the Pod-absolute input path.
4. **Inject** — on an Upload loader `_inject` writes `.string` only and forces the picker to
   `None`; on anything else it sprays its usual widget keys (`string` among them).

So a new slot needs **zero injector change** as long as it is an Upload loader titled `Input_*`.

## The two audio traps (MPI-259)

The audio path never reaching `Input_audio` was TWO bugs in the op wiring, both flow-side (the
browser run was fine — a flow-vs-browser divergence is ALWAYS a flow-side injection/routing bug):

1. **Slot mediaType.** The `audio1` slot MUST be audio, NOT `MEDIA_TYPE.VIDEO`. Write it
   `MEDIA_TYPE.AUDIO` — the enum gained that member in MPI-573, so the bare string `'audio'`
   this section used to insist on is now just the same value spelled the long way. The flow's
   audio media item carries `mediaType: 'audio'`, and `_buildParams` role-first match requires
   `item.mediaType === slot.mediaType`. With `VIDEO` on the slot the match failed silently →
   `Input_audio` never set → output kept the source's own audio.
2. **`filterMediaInputsForModel`.** This helper DROPS every `'audio'` slot unless the model has
   `capabilities.audio === true` (the LTX-vs-WAN gate). A no-model Flow passes `model: null`, so
   its audio slot was filtered out entirely. Fixed: **`if (!model) return slots`** — a
   universal/Flow op's declared slots ARE the contract; the capability gate only exists to drop
   LTX's audio slot on WAN.

## Self-gating inputs — the step gate (MPI-644)

The frame refuses to leave **step 0** while a required media slot is empty, and says
*"You need to add inputs to this flow."* Step 0 is where every slot lives, so an empty
required one means the run is already doomed; before this the refusal landed at Generate,
several slides later, with nothing said in between.

- **The question asked is `findMissingMediaSlot`** (`js/services/generationService.js`) —
  the same predicate the enqueue and dispatch guards use, imported rather than copied.
  So the gate fires on exactly the ops those two would refuse, and never on one they
  would accept. It matches per media **TYPE**, not per role (MPI-466): one image
  satisfies every image slot. Do not tighten that here.
- **`required: false` opts a slot out**, of the gate and of both run-time guards
  together. DramaBox's voice is the shipped case — its prompt-only arm builds a speaker
  from the words, so the flow must reach Generate with nothing attached.
- **A step that DERIVES its media exempts the whole flow.** `composite: true` on a step
  means the kind builds the picture rather than editing one (`stepValueToMedia`), and it
  runs at dispatch — *after* the boundary being guarded. Scribble is the case: its slot
  reads "Drawing (optional)" and a blank canvas plus one stroke fills `image1`, even
  though `flowScribble` declares that slot required. `_stepDerivesOwnMedia` reads the
  flag; a gate without it refuses the flow's whole point.

So a new flow whose middle step CREATES its input must declare `composite` — otherwise
its users are stopped at step 0 before they can draw the thing that would satisfy the
slot. Pinned by `tests/desktop/flow-step-gate.spec.js` (both directions) and
`tests/flow-required-media.test.cjs` (the `required`/`block_if_empty` pair).

## Self-gating outputs

Flows do **no flow-side output gating**. Every media type self-gates INSIDE the workflow, so the
capture path keeps only what actually ran (`executed` events) — a gated-off output emits nothing
→ no card. No `outputSchema.when` is needed. The gating MpiNodes:

| node | gates | how |
|---|---|---|
| `MpiLoadImage` / `MpiLoadVideoUpload` / `MpiLoadAudioUpload` | image / video / audio | nothing loaded → `ExecutionBlocker` on the media outputs (`block_if_empty`, default on) → that `Output_*` branch never runs; `loaded` False drives any fork |
| `MpiBlockIfEmpty` | any | passes a value through, blocks downstream if empty |
| `MpiAnyChecker` | any non-media value | passes value + a `has_value` boolean (text prompts); never on a media slot — fork on `loaded` |
| `MpiHasAudio` | audio | boolean: does the loaded media carry an audio track |
| `MpiIfElse` | video (+ any) | boolean branch — no `Input_video_2` path → `Output_video_2` never runs |

## Multi-output capture

> The base `Output_*` capture naming law (MPI-252) is **[shared] — canonical in
> [../common/output-capture-titles.md](../common/output-capture-titles.md).** The flow
> divergence — PREFIX match for numbered siblings — is below.

A multi-output flow captures every `Output_<Type>*` node's result as its own gallery card.
The capture filter is **prefix-match**: `Output_Image` / `Output_Image_2` / `Output_video_2` all
qualify; `output_preview` (multi-stage) and `output_audio` (side-channel) stay EXACT.

### 🔴 Multiple AUDIO outputs number from `_1`, not from the base (MPI-663)

Audio is the one type whose base title is already taken. `Output_Audio` is the **video mux
side-channel** — the executor matches it EXACTLY, collects it into `audioOutputUrl` (not into
`outputUrls`), and `generationService` promotes it to the run's product only when the op
declares `mediaType: 'audio'` and nothing else landed (MPI-573). So a flow saving N audio
files titles them **`Output_Audio_1 … Output_Audio_N`**: numbered from `_1`, keeping the bare
title out of the graph entirely, because a stem carrying it would be swallowed by the mux path
instead of becoming a card.

They also need their own collector. `collectComfyOutputUrls` reads `images` / `gifs` /
`videos` and knows nothing about `audio`, so `outputAudioMultiNodeIds` in `commandExecutor`
matches `output_audio_` by prefix and pushes each node's file through the audio reader.

**Naming the cards is part of the job, not polish.** N outputs of one op share one
`getFilePrefix(operation)`, so four stems arrive as four cards with the same name and the user
has to open each to find the vocal. The graph is the only thing that knows: give each save a
`filename_prefix` naming what it is (`stems/Bass` → `Bass_00001_.flac`) and
`labelFromComfyOutputUrl` reads it back off the /view URL
(`js/utils/comfyOutputUrls.js`, pinned by `tests/multi-audio-card-label.test.cjs`). The
fallback to the op prefix stays — the label only wins on a multi-output audio run.

**The kept count is only known at completion** — outputs self-gate on input presence, so the flow
declares NO fixed N. `submitFlowGeneration` allocates exactly ONE "Generating…" placeholder (the
engine emits one live latent at a time, so one in-progress card is all that's honest), and the
capture-what-ran path lands the real 1..N cards on `generation:complete`. The in-app result pane
shows ALL that landed. **One mediaType per flow** — mixed image+video in a single run is NOT
supported (do not do the per-URL-mediaType refactor).
