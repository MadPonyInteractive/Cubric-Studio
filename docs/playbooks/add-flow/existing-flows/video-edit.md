# Video Edit (`video-edit`) — two H3 graphs, the app picks one per route

> Swap a person, a head or an outfit in a clip, change its background, or any edit in words,
> with an optional picture. MPI-1036 (umbrella MPI-897). Bench evidence, numbers and Fabio's
> verdicts: `.agents/mpi-kanban/tasks/MPI-1036/brief.md` and `validation.md`.

## Shape

| | |
|---|---|
| id / title | `video-edit` / **Video Edit** |
| requiredModels | `['minimax-h3-ref2va']` — the graph loads the ref2va transformer, its 8-step turbo LoRA, `taeh3` |
| requiredDeps | `['minimax-h3-character-swap-lora']` (akatz-ai, `loraDeps.js`). `flow:video-edit` is gated by `MINIMAX_H3` in `licences.js`, so an H3 receipt covers it |
| operation | `flowVideoEdit` (new, `appVersionIntroduced` 2.0.1) |
| workflow | `flow_video_edit.json` (whole frame, the shipped two-stage H3 graph) + `byParams` -> `flow_video_edit_masked.json` (masked, single pass). Authoring: `tasks/MPI-1036/research/bench/flow_graph.py` (inputs, templates, routes) + `flow_graph_ours.py` (the two-stage section), exported by `export_raw.py` |
| describe | `Input_Look` / `Input_Kept`, filled by the app before the run (below) |
| inputs | `video1` (Input_Video), `image1` (Input_Image, optional); 5 run-slide fields |
| output | `video`, source soundtrack muxed back (the edit is pixels only); `result.compare: 'video1'` |

## Two routes, two graphs

> **INTERIM (2026-10-09): both files are the SINGLE pass.** The two-stage whole frame below REPLAYED the clip ~1 s
> in on head / outfit / background edits: H3 loses the moves when it renders below ~full size (288x512 and 448x768
> replay in any graph, prompt or sampler; 576x1024 follows), and the two-stage graph's stage 1 is half size. The fix
> under test: the single pass with the clip handed in at 0.75 of the render size (in sync, full edits, ~35% faster:
> MPI-1036 `plan.md`). The text below describes the two-stage design that was tried.

`Input_Target` typed (and the op is not Change the background) = **masked**: SAM3 finds the thing in
every frame -> `MpiMaskSquareBbox` pad 64 (ONE still square, the union of every frame) ->
`InpaintCropImproved` 512 -> H3 single pass + swap LoRA -> `MpiGradeMatch` band 48 ->
`InpaintStitchImproved`. Empty = **whole frame**: the clip resized to ~0.59 MP (aspect kept, /32) and
re-rendered by the shipped two-stage H3 graph (`minimax_h3_r2va.json`, Turbo on: stage 1 at half size
with refs `match`, latent upscaler x2, 3-step stage 2 with refs `max`, + the swap LoRA where it is on).
Both trim the clip to H3's 17k+5 frame grid.

- **The app picks the file** (`universal_workflows.js` `flowVideoEdit.byParams`, Fabio 2026-10-09:
  "whatever works best for each"): Input_Target non-blank and Input_Operation not 4 -> the masked
  file. Each file still carries both routes and re-checks the rule in-graph, so a stray value cannot
  break it.
- **Why two stages for the whole frame:** sharper, truer character and 17-29% faster (S1 781 s / S3
  692 s against R2d 938 s / R3f 971 s single pass, 5 s clip, 4060 Ti bench). **Why NOT for the box:** on two stages the
  512 crop's stage 1 runs at 256 px, and the box drifted 1-6 frames out of step (S7, mean lag 1.11);
  the same prompt on the single pass held lag 0.01 (S7s), and the single pass is faster there too.
- **One file cannot hold both H3 sections.** `MpiClearVram` is an OUTPUT node (MpiNodes `vram.py`),
  and ComfyUI starts from every output node; a lazy `MpiIfElse` spares only what sits below it, so
  the single pass's clear and the two-stage graph's three would run both H3s on every route.
- The whole-frame file drops the shipped graph's stage-1 preview save (`Output_Preview` + its two
  decodes): a Flow run is never preview-only, so it was a decode and a file per run for nothing.

- **The box is still and square on purpose.** A shape mask pasted back FAILED Fabio's eye (a ghost
  round the edit), and a moving box drifts. The square + swap LoRA locked sync (lag 0.00 frames).
- **The swap LoRA is not swap-only.** It was trained to keep the source's position, pose and timing,
  and that holds for any masked edit (lag 2.27 -> 0.00). It is on when masked, and for Swap the
  person keeping the video's room.
- **`MpiGradeMatch` is ours** (MpiNodes `grade.py`). KJNodes ColorMatch moves a whole-frame palette
  with no mask (it tints the edit); `MpiInpaintHeal` has no paired original. Without a grade match
  the re-rendered box reads a shade lighter than the wall round it.

## The instruction is hidden

Twelve `MpiText` templates (picture / no picture x six) picked by `MpiMath` + two
`MpiAnySwitch10` banks, then `{masked}`, `{who}`, `{target}`, `{words}`, `{look}`, `{kept}` spliced by
`StringReplace`. Template 6 (the person into the PICTURE's room, performance capture) is never
offered: the graph picks it from op 1 + a picture + `Input_Keep_Background` false. `MpiH3References`
strips a tag naming an empty slot, which is why the no-picture bank exists at all.

- **MiniMax's own VIDEO-EDITING format** (vendor `h3-prompt-writing` skill, `references/ref-en.txt`;
  location only, `docs/recipes/research/minimax-h3/sources.md`): `subject_definitions` /
  `summary` opening `[video editing] The target video is an edited version of <Video 1>.` /
  `retention_analysis` / `detailed_description` with `[Shot 1]` / `overall_soundscape` /
  `non_diegetic_music`, then the constraint line. Template 6 opens `[reference generation]`: the
  clip gives only the moves and the camera (ref-en.txt 2.1: look from a picture, motion from a video).
- **Positive only** (Fabio, 2026-10-08): what stays is a subject marked `fully_preserved`, and what
  must not leak is never named. The old "do not show <Picture 1> or its background" NAMED the
  picture's room, and the two-stage run took it (R2o); the same run in this format kept the clip's
  room (R2p). A picture-less new look gets no `<Subject N>` (subjects come from reference assets):
  the words land in `[Shot 1]` ("The new character: ...").
- **The constraint line is last on both routes** (rendering faults only: no text, logos, flicker).
  Masked runs add "Only {target} changes; everything else stays exactly as it is in <Video 1>..." as
  the last line of the description (`{masked}`). The masked route KEEPS "no text" (Fabio): without it
  a caption inside the box came back re-drawn and garbled; with it the caption the box holds is
  erased cleanly, and text outside the box is never touched.

## The picture is described in words before the run

**H3 mostly ignores a picture its prompt does not describe.** On the bench a swap kept the clip's
own person (only the picture's accessories came over), a background change kept the clip's room,
a head swap kept the long hair; the same runs with the picture DESCRIBED in the prompt passed
(R2d, R3f, R4e, R5e in the card's `brief.md`). So every picture template defines its picture's
subject with `{look}`, and `{kept}` names what the CLIP keeps: its own person for Change the
background (without it the picture's person leaked onto the dancer), its own room for Swap the
person in the video's room (R2p/S1: the room stays once it is named).

The words come from the describer picked in **Remote > Language Models > Image descriptions**
(Fabio, 2026-10-08), never from a describer wired into the graph: the FlowDef's `describe`
declaration names one question per option, `flowEnhance.describeFlowRun` asks it through
`llmService.describeImage`, and `flowService.submitFlowGeneration` runs that before the graph is
queued, so hand, agent and routine runs are described alike. The answers land in the hidden
`MpiText` inputs `Input_Look` / `Input_Kept`, run-only (never the snapshot: Reuse describes again).
`Input_Kept` describes the clip's FIRST FRAME, grabbed in the renderer and stored in the project's
preview-asset store (no card). A failed describe generates nothing and says so.

- **A question replaces the describer's own instruction on both backends**, so each `ask` carries
  the reply shape too ("one or two plain sentences of concrete visual facts...").
- **First entry per target wins**: template 6 (op 1 + the picture's room) is declared before op 1.
- **A mirror-shot picture (back to camera) opens on its own pose for ~0.8 s** in template 6 (R3d/R3e);
  a front-facing picture opens clean (R3f). The wording does not move it; a character sheet on a
  plain background avoids it.

## Traps

- **Every hiddenWhen rule is re-checked in the graph.** A hidden field keeps its value
  ([../ui/carousel-frame/fields.md](../ui/carousel-frame/fields.md)), so a target typed and then
  hidden by Change the background must not mask: `(a * (b != 4)) > 0`. Change a clause in the
  FlowDef, change its twin in the graph.
- **A text field is `MpiText`, never `MpiString`.** The app treats an `Input_*` `MpiString` as a
  media PATH (`comfyController` `PATH_MEDIA_CLASSES`) and stages it as a file, so "the person"
  would be resolved as a filename. `tests/workflow-media-slots.test.cjs` catches the
  `MpiAnyChecker` half of it.
- **`MpiMath` has no and / or / not** and returns 0.0 SILENTLY on an expression error. Write
  conjunctions as products, `(a * (b == 1) * c) > 0`.
- **The raw/ files come from the bench frontend.** No API -> LiteGraph converter exists: push the
  builders' prompts to ComfyUI userdata, `app.loadApiJson` each in the bench tab, POST
  `app.graph.serialize()` back, pull them into `raw/` (`research/bench/export_raw.py push|pull`, BOTH
  files), then `node scripts/sync-raw-workflows.mjs`. Diff the synced API against the builder before
  trusting it.

## Slow, warned, not capped

On the 4060 Ti bench, cold: a 5 s clip whole frame takes 11.5-13 min, a 3 s masked edit ~8 min. The
description warns and nothing caps (the user's GPU is the limit, never the Flow's).
