# Video Edit (`video-edit`) — one H3 graph, every choice resolved inside it

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
| workflow | `flow_video_edit.json`, 73 nodes. Authoring source: `tasks/MPI-1036/research/bench/flow_graph.py` |
| inputs | `video1` (Input_Video), `image1` (Input_Image, optional); 5 run-slide fields |
| output | `video`, source soundtrack muxed back (the edit is pixels only); `result.compare: 'video1'` |

## Two routes, one graph

`Input_Target` typed (and the op is not Change the background) = **masked**: SAM3 finds the thing in
every frame -> `MpiMaskSquareBbox` pad 64 (ONE still square, the union of every frame) ->
`InpaintCropImproved` 512 -> H3 + swap LoRA -> `MpiGradeMatch` band 48 -> `InpaintStitchImproved`.
Empty = **whole frame**: the clip resized to ~0.59 MP (aspect kept, /32) and re-rendered at that size.
Both trim the clip to H3's 17k+5 frame grid.

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
`MpiAnySwitch10` banks, then `{who}`, `{target}`, `{words}` spliced by `StringReplace`. Template 6
(the person into the PICTURE's room, performance capture) is never offered: the graph picks it from
op 1 + a picture + `Input_Keep_Background` false. `MpiH3References` strips a tag naming an empty
slot, which is why the no-picture bank exists at all. Masked runs end on "change only {target}"
plus the no-text / no-artefact tail, whole-frame runs on that tail alone. The masked tail KEEPS
"no text" (Fabio): without it a caption inside the box came back re-drawn and garbled; with it the
caption the box holds is erased cleanly, and text outside the box is never touched.

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
- **The raw/ file comes from the bench frontend.** No API -> LiteGraph converter exists: push the
  builder's prompt to ComfyUI userdata, `app.loadApiJson` it in the bench tab, POST
  `app.graph.serialize()` back, pull it into `raw/` (`research/bench/export_raw.py push|pull`), then
  `node scripts/sync-raw-workflows.mjs`. Diff the synced API against the builder before trusting it.

## Slow, warned, not capped

5 s whole frame is ~19 min on a 4060 Ti; masked 3 s is ~3 min. The description warns and
nothing caps (the user's GPU is the limit, never the Flow's).
