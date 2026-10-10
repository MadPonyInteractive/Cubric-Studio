# Video Edit (`video-edit`) — one single-pass H3 graph, masked or whole frame

> Swap a person, a head or an outfit in a clip, change its background, or any edit in words,
> with an optional picture. MPI-1036 (umbrella MPI-897). Bench evidence, numbers and Fabio's
> verdicts: `.agents/mpi-kanban/tasks/MPI-1036/brief.md` and `validation.md`.

## Shape

| | |
|---|---|
| id / title | `video-edit` / **Video Edit** |
| requiredModels | `['minimax-h3-ref2va']` — the graph loads the ref2va transformer, its 8-step turbo LoRA, `taeh3` |
| requiredDeps | `['minimax-h3-character-swap-lora', 'minimax-h3-faceswap-lora']` (akatz-ai, UntMods; `loraDeps.js`). `flow:video-edit` is gated by `MINIMAX_H3` in `licences.js`, so an H3 receipt covers both |
| operation | `flowVideoEdit` (new, `appVersionIntroduced` 2.0.1) |
| workflow | `flow_video_edit.json`, one single-pass H3 r2v turbo graph for both routes. Authoring: `tasks/MPI-1036/research/bench/flow_graph.py` (inputs, templates, routes), exported by `export_raw.py`; `flow_graph_ours.py` is the two-stage attempt, research only |
| describe | `Input_Look` / `Input_Kept`, filled by the app before the run (below) |
| inputs | `video1` (Input_Video), `image1` (Input_Image, optional); 5 run-slide fields |
| output | `video`, source soundtrack muxed back (the edit is pixels only); `result.compare: 'video1'` |

## Two routes, one graph

`Input_Target` typed (and the op is not Change the background) = **masked**: SAM3 finds the things in
every frame (a comma list is one search per item, masks unioned: comfy `sam3_clip.py`) -> `MpiMaskSquareBbox` pad 64 (ONE still square, the union of every frame) ->
`InpaintCropImproved` 512 -> H3 single pass + swap LoRA -> `MpiGradeMatch` band 48 ->
`InpaintStitchImproved`; the crop goes into H3 1:1. Empty = **whole frame**: rendered at ~0.59 MP
(aspect kept, /32), with the clip handed to H3 as `<Video 1>` at **0.75 of that size**. Both trim the
clip to H3's 17k+5 frame grid.

- **The render stays full size; only the clip shrinks.** H3 loses the clip's moves when it RENDERS
  below ~full size: 288x512 and 448x768 jump back to the opening pose ~1 s in (even the frame-0
  overlay comes back) in any graph, prompt, sampler, attention or model (bench S5p..S5ho). So the
  shipped two-stage H3 graph (half-size stage 1) is out for this Flow: it fell out of step on head,
  outfit and background edits, and leaked the picture's face on outfit. The REFERENCE clip's size is
  the speed lever instead: at 0.75 every whole-frame option kept full edits in sync, 30-35% faster
  than the full-size clip (S5s75 641 s vs 991, S4x 661 vs 1011, S3x 691 vs 971; 5 s clip, 4060 Ti);
  at 0.5, identity edits came out half-swapped (S5sr/S5sro).
- **One file, both routes.** A route picking its own file was built and removed again once the single
  pass won both. If two H3 sections ever share a file: `MpiClearVram` is an OUTPUT node (MpiNodes
  `vram.py`), ComfyUI starts from every output node, and a lazy `MpiIfElse` spares only what sits
  below it, so both sections would run on every route.

- **The box is still and square on purpose.** A shape mask pasted back FAILED Fabio's eye (a ghost
  round the edit), and a moving box drifts. The square + swap LoRA locked sync (lag 0.00 frames).
- **A square that cannot hold the whole mask runs the whole frame.** `MpiMaskSquareBbox` caps its
  side at the frame's short edge and centres it, so a union box taller than a portrait frame is
  wide (a dancing head) got CUT: the crown stayed as filmed (448x800 close-up) and the box edge
  crossed the hips (1072x1920). Measured from both results: square = frame width. Nodes 55/24
  (lazy `MpiIfElse` on 23, so SAM3 still runs only when a part is typed): masked only when
  `size < W` and `size < H`. Image workflows are unaffected: there the square is only
  `optional_context_mask`, and the painted mask is never cut.
- **A mask pays only on a small part that stays put** (ears, a hat on a talking head). A part that
  travels makes the union box big, and a big box edge crosses moving body.
- **Swap the head on the whole frame can carry the picture's clothes.** In-app E1 (Video edit 15,
  test dancer + a halter-top portrait) put the halter neckline on the dress; masked E2 ("Head", the
  square held, 377 s vs 472 s) kept the dress. Cosmo types "head" when the picture's clothes differ
  (`docs/agent/flows.md`); Fabio, 2026-10-10: a known limit, not a fix.
- **The swap LoRA is not swap-only.** It was trained to keep the source's position, pose and timing,
  and that holds for any masked edit (lag 2.27 -> 0.00). It is on when masked, and for Swap the
  person keeping the video's room.
- **Swap the head adds the Faceswap LoRA** (UntMods, ref2va, strength 1) on both routes, with its
  trigger word `Faceswap` on the prompt's first line (nodes 25, 145-149; lazy, so no other option
  loads it). On a clean 1088x1920 H3 dancer the face came out closer to the picture with it, whole
  frame and masked (Fabio, 2026-10-09: D2/D4 over D1/D3), at no time cost (422 s vs 430). On a
  low-quality screen recording it neither helped nor hurt.
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
- **A head swap keeps the clip's hair LENGTH** unless the picture shows where the hair ends (a bun
  worked); "shoulder-length" in the words did not move it. A model limit (Fabio, 2026-10-09): a
  head-and-shoulders picture or a character sheet is the user's lever.
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
  `app.graph.serialize()` back, pull them into `raw/` (`research/bench/export_raw.py push|pull`),
  then `node scripts/sync-raw-workflows.mjs`. Diff the synced API against the builder before
  trusting it.

## Slow, warned, not capped

On the 4060 Ti bench, cold: a 5 s clip whole frame takes 11-12 min, a 3 s masked edit ~8 min. The
description warns and nothing caps (the user's GPU is the limit, never the Flow's).
