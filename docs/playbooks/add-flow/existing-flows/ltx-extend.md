# Extend Video (LTX 2.3 or MiniMax H3)

> Continue a clip past its last frame: a source video in, the same clip plus newly generated
> seconds — with matching audio — out. Card: **MPI-520** (member of the **MPI-552** v2v trio).
> **SHIPPED as a Flow** 2026-08-14 — no `ModelDef`, no `supportedOps`, no dep entry; it runs
> on the already-installed LTX 2.3 checkpoint.
>
> **Two candidates since MPI-591 (2026-09-27):** LTX 2.3 (recommended, `models[0]`) or
> MiniMax H3 (`minimax-h3`, the fl2va DiT). The two share no nodes, so the pick selects a
> different GRAPH FILE, not different params — § The H3 arm, and the portable half in
> [../any-of-models.md](../any-of-models.md) § A slot may pick a different GRAPH.
>
> **This was the first Flow authored with no component at all** (they are all like this now —
> the component surface was removed in MPI-572). Its controls are declared
> data (`FlowDef.fields`, MPI-531). Adding a JS component here to gain a knob would undo
> that — add the field type instead. Portable UI decisions live in [../ui/](../ui/).

## Status

| Item | State | Notes |
|---|---|---|
| Bench graph | **PROVEN** before this card | 56 nodes, user-approved end to end incl. silent sources + 3s foley |
| Workflow synced | **DONE** 2026-08-14 | `raw/flow_ltx_extend.json` → `comfy_workflows/flow_ltx_extend.json`, 56 API nodes, injection-rules gate clean |
| Op + descriptor | **DONE** | `flowLtxExtend` in the 4 op files; `ltx-extend` in `flowsRegistry.js` |
| Render + payload | **VERIFIED** 2026-08-14 | Live in an isolated app: controls render, values reach the payload, reopen restores them (§ Verification) |
| Real generation | **NOT RUN by the agent** | The playbook's live-run gate is the user's. Nothing about the graph changed, but the app-side dispatch has never produced a clip |
| H3 arm (MPI-591) | **VERIFIED** 2026-09-27 | `flow_h3_extend.json`, 54 API nodes. Fabio ran it end to end twice; second run: "the join is clean now" |
| User LoRA rack (MPI-1036) | **DONE** 2026-10-10 | Slot `loras: true`; LTX's flat `Input_Lora_N` retitled `Input_Lora_Phase1_N`, the H3 graph gained nodes 980-985 (loader 392 -> 497, CLIP 390 -> 970) |
| Resolution control | **DEFERRED** | See § The width/height decision |

## Shape

- **Model slot:** `[{ label: 'Model', models: ['ltx-23-balanced', 'minimax-h3'] }]`. The LTX
  arm is `flow_ltx_extend.json` (the op's `workflow`); the H3 arm is `flow_h3_extend.json`,
  reached through `UNIVERSAL_WORKFLOWS.flowLtxExtend.byModel`. The id and the graph move
  TOGETHER: `minimax-h3` is the only dep set supplying the fl2va transformer and its fl2v turbo
  LoRA. The slot said `minimax-h3-ref2va` until the Phase 8 rewire (2026-09-27).
- **LTX is `ltx-23-balanced` only.** The graph's `UNETLoader` bakes `...int8_convrot.safetensors`,
  so the High card's bf16 weight does not satisfy it (Add Foley and Upscale Video have the same
  gap). The precedent fix is scribble-object's: ONE graph, the loader retitled to an `Input_*`
  title, and a `modelParams` arm per tier. Unbuilt and unverifiable here: nobody has the 39.13GB
  bf16 weight, and 22B bf16 on a 16GB card offloads heavily.
- **Input:** one video slot (`video1` → `Input_Video`, `MpiLoadVideoUpload`, staged path in `string`, self-gating).
- **Output:** `mediaType: 'video'`; one capture, `Output_Video`.
- **Steps:** one `preview` middle step (MPI-582, 2026-08-20) — a 3-step carousel
  (supply → describe → run). Nothing is MARKED on the clip, but step 0 loads media at
  thumbnail size, so the preview is the first point at which the user can judge the take
  they are about to continue. Same shape as foley's; it replaced the original `steps: []`.

## The controls, and why each is what it is

```js
steps: [
  { kind: 'preview', role: 'video1', tickerLabel: 'Describe', title: 'Describe what happens next',
    fields: [
      { id: 'positive', type: 'text', rows: 3, label: 'What happens next', placeholder: '…' },
      { id: 'negative', type: 'text', rows: 2, label: 'Avoid', default: '<the bench negative>',
        hiddenWhen: { model: 'minimax-h3' } },
    ] },
],
fields: [
  { id: 'Input_Duration', type: 'slider', label: 'Seconds to add', min: 1, max: 10, step: 1, default: 4 },
  { id: 'Input_is_Turbo', type: 'toggle', label: 'Turbo', default: true,
    hiddenWhen: { modelNot: 'minimax-h3' } },
  { id: 'Input_Context', type: 'select', label: 'Show it this much of the clip', default: 39,
    options: [39, 90, 141 /* frames, labelled in seconds */], hiddenWhen: { modelNot: 'minimax-h3' } },
]
```

- **The prompts sit on the step, the duration on the run slide** — Fabio's call (2026-08-20):
  the length knob belongs beside Generate, so the describe step is exactly foley's two boxes.
  Placement changes nothing about the payload: `_collectInputs` folds `stepValues[role].fields`
  into the same `declared` / `injectionParams` bins as a flow-level field.
- **`positive` / `negative` are top-level run inputs** — `submitFlowGeneration` reads
  `inputs.positive` / `inputs.negative` and the executor writes them to `Input_Positive` /
  `Input_Negative`. The prompt describes the NEW seconds, not the whole clip.
- **The negative's default is the bench negative, on purpose.** Those runs are what "proven"
  means here; an empty box is a different graph.
- **`Input_Duration` is prefixed, so the frame routes it into `injectionParams`** rather than
  the top level — an `Input_*` id names a graph node. It is SECONDS, snapped to whole latent
  frames by the graph itself (`MpiMath floor((a*b+0.5)/8)*8/b`, off the source's own fps), so
  a slider is honest: the value is coarse by construction.
- **No seed control.** `_buildParams` fills `Input_Seed` with a fresh random seed per run.
- **The three model clauses** take each arm's dead control off screen, because the injector
  skips a title the running graph lacks IN SILENCE: H3 takes no negative conditioning, and only
  the H3 graph carries `Input_is_Turbo` and `Input_Context`
  ([../ui/carousel-frame/fields.md](../ui/carousel-frame/fields.md) § The model clauses).
- **`Input_is_Turbo`** gates the H3 sampler path off one `MpiSimpleBoolean` (step count,
  scheduler, sampler and turbo-LoRA strength together). Default ON and it stays on: the
  non-turbo side is several times the steps.
- **`Input_Context` is FRAMES, and only three values exist.** `MpiH3MaskedPrefix` snaps DOWN
  to 39 / 90 / 141: on H3's 17k+5 video grid AND divisible by 3, so audio's 40 Hz clock lands
  on a whole step. 56 (the bench's third-party `MiniMaxH3MotionContext` value) is on the video
  grid only, so it cannot ship. **Default 39, measured:** at 90 the preserved window held a shot
  change and the model COPIED the cut, holding the earlier wide shot for all 102 new frames
  against the prompt. More context is more imitative, not better.

## The H3 arm (MPI-591)

**Mechanism.** `MpiH3ImageToVideo` (#970, fl2va conditioning, no references, no guide) builds the
empty AV latent. `MpiH3EncodeAV` (#971) encodes the source's tail, and `MpiH3MaskedPrefix` (#972)
writes it into the front of that latent and masks it out of sampling, so the head is never
regenerated and nothing has to be trimmed. The new frames are everything after the snapped
context (#941); the stitch is the WHOLE source plus those frames (#979). Audio: the source track
trimmed to its exact frame count (#950), joined to the generated audio after the context (#907),
then a 24-frame re-take window spliced back with a crossfade (#951-#953). **Every offset reads the
node's own snapped `context_frames` (#972 output 1), never a literal:** #941 and #942 directly,
#951 through #974 (`context - 24`). The old literal 16 re-took 74 frames at context 90. #953
places that re-take at `source frames - 24` (MPI-974) — the join, not the end; see the fourth trap.
Needs MpiNodes at `bc92a1b` or later (below).

**Three traps, all paid for in a real run, none visible on the bench:**

- **An off-grid source loses its END in the encode.** The H3 video VAE packs only 17k+5 frames
  and drops the remainder at the END. A 97-frame source encoded whole gave its first 90 frames,
  so the context stopped at frame 89 while the stitch appended after frame 96: the join jumped
  back 7 frames (up to 16 on any off-grid clip). Encode the on-grid TAIL: #976 =
  `(frame_count - 5) % 17`, #977 / #978 cut picture and audio there, #971 encodes the rest.
  `MpiH3MaskedPrefix` does accept an off-grid clip; the encode upstream is what loses the end.
  **The bench corpus cannot catch this** — clip 062 is 124 frames, exactly on the grid, so any
  bench arm standing in for a user's clip needs an off-grid source.
- **`ImageBatchExtendWithOverlap` with overlap 1 is a blend, not a hard join.** Its
  `linear_blend` alpha is 0.5 for the single overlap frame: a 50/50 double exposure at the seam,
  and a picture one frame shorter than its audio. Use KJ `ImageBatchMulti` for a plain concat.
  Core `ImageBatch` is deprecated on engine 0.34, and overlap 0 on the KJ node slices
  `source[:-0]`, which is empty.
- **An audio index from a ROUNDED frame count lands past the end.** At 44100 Hz / 24 fps a frame
  is 1837.5 samples, so a real track is almost never a whole number of frames. `MpiAudioRange`
  and `MpiAudioSplice` resolved a negative index off `round(total / rate * fps)` and raised
  `A 229688-sample patch ... runs 875 samples past the end`. Fixed in the node (MpiNodes
  `bc92a1b`): a negative index counts back from the LAST SAMPLE, and the splice drops an overhang
  of up to 1 ms (two rounded half-sample offsets) while still raising on anything a frame wide.
- **H3's audio is not the picture's length, so never count back from its END.** Core sizes the
  audio latent `round(frames * 40 / 24)` steps of 800 samples at 32 kHz: exact only when the
  frame count divides by 3. Otherwise the track is 267 samples longer (frames % 3 == 1) or
  shorter (== 2). #953 used to be `(context - 24) - length`, counted from the end, and raised
  `A 281600-sample patch ... runs 267 samples past the end` on Fabio's 8 s run (2026-09-29,
  MPI-974); an offline replay of the real nodes over 10 durations x 3 contexts x 4 source
  lengths x 2 source rates failed or misplaced 192 of 240, clean only at 2 s / 4 s added.
  The verified runs were 4 s. Anchored at the join (`Input_Video frame_count - 24`) all 240
  land within 2 samples. Pinned by `tests/flow-model-choice.test.cjs` § MPI-974. The output
  track can still end up to 8 ms off the last frame; harmless, not trimmed.

**Known, not fixed:** a source whose audio is SHORTER than its picture (clip 062, by 881 samples)
joins the new audio ~20 ms early. The fix is silence padding up to the frame count, not a trim.

**The live preview flicker Fabio saw on the first run was the Flow pane, not this graph** —
`MpiBaseFlow._paintResult` rebuilt its `<img>` per latent frame. Fixed and pinned by
`tests/flow-latent-no-strobe.test.cjs`, which carries the whole story.

**Cost, measured native 1920x800 on a 16GB RTX 4060 Ti:** the source encode alone is ~3 min for
124 frames, the DiT sits near 12.3GB, and the graph peaks near 14.4GB.

## The width/height decision (MPI-520's open half)

The card asks for `Input_Width`/`Input_Height` restored as `MpiInt`. They are **not** in the
shipped v1, and the flow is coherent without them: `ImageResizeKJv2` (#28) takes its width and
height from `Input_Video`'s own outputs, so the result matches the source clip's resolution.

Restoring them needs a **bench re-export** (agents never hand-edit a workflow JSON), plus the
card's own warning: a linked widget-input makes ComfyUI ignore the injected widget, so they
must arrive as real `MpiInt` nodes. Until then, "output matches the source" is the contract.

**Do not copy the resolution decision from foley.** There, `Input_Width`/`Input_Height` were
DELETED because they fed only the encode and never the delivered pixels. Here #28's output IS
the delivered clip. Same family, opposite call (`MPI-536` brief § Deliberately NOT exposed).

## Verification (2026-08-14, isolated app on its own port + profile)

> Records the ORIGINAL 2-step shape. The carousel gained its describe step on 2026-08-20
> (MPI-582); everything below still holds except the step count and where the two prompt
> boxes render.

1. `flow:open` mounts a 2-step carousel with **no** component — `_flowComponents[undefined]`
   resolves to `null`, which is a supported path, not a hole.
2. The run slide renders all three declared controls: two `textarea`s and a `range` with its
   live readout.
3. **Payload proof without spending a generation:** type a prompt, move the slider to 7, then
   strip `state.s_installedModelIds` before clicking Generate. `_run` persists the collected
   inputs to `state.s_flowInputs` BEFORE `submitFlowGeneration`'s availability guard aborts, so
   the exact payload is readable with nothing queued (engine queue confirmed empty after):

   ```json
   { "positive": "the camera pushes in as she turns to leave",
     "negative": "letterbox, black bars, …",
     "injectionParams": { "Input_Duration": 7 } }
   ```

4. Reopening the flow restores all three — including the slider, which seeds from
   `injectionParams`, not from the top level.

`tests/inject-params-titles.test.cjs` pins `input_video`, `input_positive`, `input_negative`,
`input_seed`, `input_duration` and `output_video` against the workflow — a declared control
whose node is missing would otherwise move the slider, run clean, and silently use the graph's
baked default. For the H3 arm, `tests/flow-model-choice.test.cjs` § 'the Extend Video pick
selects the GRAPH' checks every declared `Input_*` field, the prompt, the video input, a capture
node and every baked weight against `flow_h3_extend.json` and `minimax-h3`'s deps.

**H3 arm (2026-09-27):** `npm test` green, the flow desktop specs 9/9 (`verify-workflow` last
recorded clean at 53 nodes, before the tail rewire), and Fabio's second end-to-end run (tiger
clip, 97 frames, context 90, 4 s): "the join is clean now". That is his eye, not an
instrument; nobody has counted that output's frames.

## Siblings

Foley (**MPI-536**) and lipsync (**MPI-538**) are the other two of the trio and each needs a
LoRA staged to R2 first (`ltx-2.3-22b-lora-foley-v2a-1.0`, `ltx-2.3-22b-ic-lora-lipdub-0.9`).
Extend needed none, which is why it shipped first.
