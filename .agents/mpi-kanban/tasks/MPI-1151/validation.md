# MPI-1151 validation

Pass bar (Fabio, 2026-10-15): the picture's OWN mountains, sun and trees in the result, not mountains like it; the
characters and their motion unchanged.

## Bench (G: ComfyUI, 4060 Ti, GPU lease, `MPI-1036/research/bench/run_flow.py` M*), 2026-10-16

Inputs: `logs/mpi1151/mpi1151_monkey_horse.mp4` (512x960, 2 s) + `logs/mpi1151/mpi1151_mountains.png` (1024 square), copied
to G: input. Every run = his flowVideoEdit_001 (seed 515488481, the app describer's look/kept copied from _001's sidecar `Input_Look`/`Input_Kept`, no words), 576p.

- **M0 baseline (today's template 4): FAIL, reproduces the app.** Meadow and sky kept, 241 s. The bench matches the
  app, so a bench lever is a fair test.
- **M2 op 4 as `[reference generation]` (template-6 framing): FAIL.** Same meadow and sky as M0, 241 s.
- M1 / M3 (`ref_image_size` max): dropped (Fabio: the size is not the problem, try the prompt first).
- **M4 (video editing kept; "everything around them" is a third subject, `partially_preserved`, and the place of
  <Picture 1> is `attribute_transfer` onto it, laid out as in the picture): the picture comes over.** 240 s. Sun
  top-left with rays, the rocky peaks, the lake, the cartoon pines, the picture's warm light; monkey, horse and every
  move as filmed (frames 2/20/36). Side-by-side `logs/mpi1151/mpi1151_source_today_M4_picture.webm`. **Fabio: passes.**
- M4 names mountains, a lake and the sun, and template 4 serves every picture. **M5 = M4 in picture-neutral words
  ("ground, landscape or room, objects, sky or walls"): FAIL on the monkey (meadow kept) AND V4f (Fabio's bedroom
  case, V4d's seed) kept the clip's living room, where the old template (V4d) had changed it.** The concrete nouns
  carry it.
- **V4g = M4 verbatim on the bedroom: FAIL - mountains, a lake and a sunset behind her.** M4 cannot ship as written.
- **M6 = M4 with its landscape nouns replaced by `{look}` (the picture's own words, 3x): PASSES both.** Monkey
  (250 s) near frame-identical to M4; bedroom V4h (190 s) = the picture's bedroom (framed print, dresser, bed,
  textured ceiling). Side-by-sides `logs/mpi1151/mpi1151_source_M4_M6_picture.webm`,
  `logs/mpi1151/mpi1151_bedroom_source_M4_M6_picture.webm`.

## Shipped (2026-10-16)

- `flow_graph.py` template 4 = M6, byte-identical to the benched text (asserted).
- Raw node 74's widget swapped in place (raw matched the builder on all 13 template nodes, only 74 differed), API
  node 74 likewise; NOT via `sync-raw-workflows.mjs`, which commits every git-changed raw and would have taken the
  Character Sheet session's (MPI-1148) raw too. Proof: `workflow-to-api.mjs` on the raw + the upload-slot reset ==
  `comfy_workflows/flow_video_edit.json`; all 96 API nodes' inputs == `flow_graph.graph()`;
  `validate-injection-rules.mjs` passes.
- `node --test` agent-flow-handover, child-safety-gate, flow-describe, flow-legs, flow-lora-rack,
  inject-params-titles, workflow-media-slots: 117/117 pass.
- Not run: the app itself (the shipped JSON is proven equal to the benched graph). Not run on a Pod.
- **Fabio, 2026-10-16: "M6 passes on both"** (monkey + bedroom side-by-sides).
- CI `tests.yml` run 38829257946 on `1e8359526`: success.

Side finding: `Input_Kept` describes only the monkey although `Input_Who` is "The monkey and the horse" (the describer
asks for one person).
