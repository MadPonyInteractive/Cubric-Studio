# MPI-1335 — Video Edit: soundtrack into H3, clips padded to the grid, Reuse keeps "Where they are"

Found 2026-10-29 from the "Video edit showcase" project (11 runs, remote RTX PRO 6000, 960p and
1080p). Fabio: short sections (about 1 s or less) all failed, speech came out of sync or was
made up, and the mouth moved during pauses. **Infinite Video will later chop the input into
sections, so each fix here must hold for a section of any length.**

## Root causes (evidence)

1. **H3 never hears the clip.** Both `MpiH3References` in `flow_video_edit.json` (node 110,
   stage 1; node 223, refine) wire `ref_video_1` and no `ref_video_audio_1`.
   `minimax_h3_r2va.json` wires `ref_video_audio_1..3` on both of its encoders, and that is the
   graph where lip sync passed (MPI-1033). So H3 invents its own audio and moves the mouth to
   that, then node 130 throws it away and muxes the source soundtrack. The template still
   claims "The sound of <Video 1> continues unchanged".
   Fabio's own check: typing the clip's spoken words into "Describe the new look" came out
   closer, in sync at the end.
2. **The clip is floored to the 17k+5 grid.** Node 30 is `floor((a - 5) / 17) * 17 + 5` and
   node 31 cuts the source to that length. A 0.875 s clip (21 frames) ran as 5 frames
   (`flowVideoEdit_009`, 0.21 s). Every clip loses up to 16 frames (0.67 s) of its tail:
   2.17 s -> 1.63 s, 1.96 s -> 1.63 s, 4.63 s -> 4.46 s. Node 35 trims the audio to match, so
   sections no longer line up when they are put back together. Below 5 frames the length goes
   negative.
4. **The mouth is not copied from the frames either (Fabio, 2026-10-29).** Without the
   sound, H3 should still copy the moves, the expression and the lips from <Video 1>, and it
   did not. So cause 1 is not the whole story. What locks timing in this Flow is the Character
   Swap LoRA (lag 2.27 -> 0.00 frames, video-edit.md), and node 21 turns it on only when masked
   or for Swap the person in the VIDEO's room: `(a + (b == 1) * c) > 0`. "The picture's room"
   (template 6) runs without it. `_005` and `_007`-`_011`, the speech runs that failed, were all
   template 6. Template 6 is also `[reference generation]`, which MiniMax's format treats as a
   loose performance reference, not an edit. A third suspect: H3's own invented speech (cause
   1) drives the mouth harder than the reference frames do. A fourth, from MPI-1334 (Cosmo
   video edit flow logs session): Cosmo filled `positive` ({words}) with a whole H3 prompt
   including "speaking her line clearly with natural lip movement", which asks for speech
   through the pauses. MPI-1334 stops Cosmo doing that; the bench below runs `positive`
   EMPTY so the words cannot confound it. The test below separates the rest.
   Also from MPI-1334: the earlier "failures" on long runs were Stops on 1080p runs Cosmo
   carried over from a one-off request, not crashes. The RAM question below still stands.
5. **Reuse drops `Input_Keep_Background: false`.** Every sidecar saved `false` correctly (in
   `flowInputs.injectionParams` and in `generationSettings`), yet the reopened Flow shows
   "The video's room". The restore code (`openFlowFromReuse`, `MpiBaseFlow._seedField`, the
   radio branch of `declaredFields._buildField`) all use `??` and compare with `String(v)`, so
   reading the code did not find it. It needs a repro. Check every boolean radio while there.

## Inherited: MPI-1331 (validating), from session "Video editor mask performance", 2026-10-29

Fabio: every Video Edit issue now runs in this session. MPI-1331 shipped `d5b88846e`: the masked
square is sized from the source (node 230 = square bbox side x1.25, capped at the short edge, /32;
node 63 = max(512, min(quality size, node 230))), so a small square is no longer upscaled for H3.
Left to validate: one real masked run at 768p+ on a GPU, and the raw file loaded in a ComfyUI
frontend once (sync-raw-workflows did not run). Notes: `tasks/MPI-1331/validation.md`.
Still open, no call from Fabio: the masked route's RAM. SAM3 runs on every frame, and crop,
MpiGradeMatch and stitch work on full-size frames, so a 13 s clip filled ~81 of 94 GB of pod RAM.
That is the windowing job (MPI-1336), the same as the RAM item below.

## Masked route seam (Fabio, 2026-10-29, flowVideoEdit_005 + _006 in "MPI-1335 lip bench")

Both hair edits show a seam. Located: a horizontal break across the blouse collar, the lapel edges
jump sideways, at the BOTTOM EDGE of the still square (node 53, pad 64). H3 redraws everything in
the square, and what is not masked (collar, neck) comes back slightly moved, so the square's edge
shows a step; `InpaintCropImproved` blends only 24 px (`mask_blend_pixels`, node 54).
Pasting the SAM3 shape instead was tried and failed Fabio's eye (ghost round the edit, video-edit.md
§ Traps), so the square stays. Candidates, cheapest first, each one masked 768p run (~3 min):
(a) blend 24 -> 64 / 96 px; (b) MpiGradeMatch band 48 wider; (c) paste the square with a falloff that
is full inside the grown mask and fades to the square's edge. Fabio judges by eye.
**2026-10-29 result:** (a) failed: 64 px only smears the step (flowVideoEdit_009), and 64 is the node's max
(96 refused). (b) skipped: the step is moved geometry, not colour. Next is (c), a new bench variant.

## Not yet investigated

- `flowVideoEdit_012` (video's room + a picture): the person and the background change, then
  switch back to the original. Watch it frame by frame before guessing.
  **Watched 2026-10-29:** 141 frames, video's room 768p, no soundtrack (shipped graph), Look empty. Starts in the
  PICTURE's room, dissolves to the office by ~1.2 s, then the person dissolves back to the original woman from
  ~4.5 s. The S2 run (flowVideoEdit_007 in the lip bench: same clip, picture and fields, soundtrack on, pinned
  seed) holds the swap and the office for all 5 s. One run each, so seed luck is not ruled out: re-check on the
  shipped soundtrack graph before opening anything.
- System RAM on clips over ~10 s. Unmeasured guess: `MpiLoadVideoUpload` decodes every frame
  at source size (about 25 MB a frame at 1088x1920, float) and the graph copies the batch
  several times (grid cut, lead-in, resize, crop). Measure peak RAM by node before changing
  anything. Infinite Video's sections cap this too.

## Plan

**Order, revised 2026-10-29 (Fabio agreed):** everything that copies a video is windowed, so
Video Edit gets its windowing from the Infinite Video work (session "Infinite video 1"),
not later. Run order: step 2b (lip bench, one clip of 5 s or less, the 0.875 s clip left
out) -> step 7 (Viggle bench, as the study of how windowing is done) -> the windowed edit pass,
built with Infinite Video, where step 1 (pad up, cut back) becomes the LAST window's rule and
the RAM item is measured by window -> steps 2/3 per window -> step 4 any time -> step 5.
Steps below keep their numbers.
**Windowing now lives on MPI-1336** (Infinite Video, session "Infinite video 1"). It runs the
windowing bench three ways: MpiWindowedSampler vs Viggle five_frame_anchor vs Motion Context V2
(each segment continues from ~1 s of the previous one's video AND audio latents), judged on
this card's grid / audio / timing-lock / RAM rules (`MPI-1336/research/video-edit-window-needs.md`).
Step 7 here is folded into that bench; Video Edit tests the winner. **2026-10-29 first result (session "Infinite video 1"):** the latent-path chain
(MpiSaveLatent/MpiLoadLatent, MpiH3MaskedPrefix context 39 before node 115) wins on Video Edit's graph: joins
invisible, no drift over 3 x 124-frame windows; the pixel path is 9% darker by window 3. Lip lag, 2K, RAM and
resume per window not measured. MPI-1336/research/bench-2026-10-29-chain.md. **Watch:** Motion Context's
author says single pass only (a latent upscale or a second stage shows the seams), but Video Edit
runs Fast Motion (base pass + latent upscale + refine) above 768p. If Motion Context wins, Video
Edit's above-768p route needs rethinking.
**Fabio, 2026-10-29:** aim for ~5 s windows like Viggle's (124 frames). The over-768p
out-of-memory failures on 16 GB were on clips of 10 s or more: length, not resolution. With
5 s windows even 2K may fit on 16 GB, so measure the cap by window. A window means its latents
saved to disk, like Viggle, so only one window is in memory and a run resumes. Relayed to
"Infinite video 1".

1. **Pad up, cut back (graph).** Node 30 becomes `ceil` onto the grid, with a minimum of
   22 frames (17 + 5). Pad by holding the last frame (`RepeatImageBatch` of the last frame +
   `ImageBatch`). Pad the audio with silence to the same length. Node 123 (and the masked
   route's stitch output) cuts the result back to the SOURCE frame count, and node 35 keeps
   the source audio at its full length. Verify: a 0.875 s clip and a 2.17 s clip come back at
   the source length, frame count and audio duration equal to the input.
2. **Feed the soundtrack (graph).** Wire the grid audio into `ref_video_audio_1` on nodes
   110 and 223. On template 6 the clip gets 17 still frames in front, so the audio needs 17
   frames (0.708 s) of silence in front of it too, or the speech lands 17 frames early.
   Masked route: the crop's audio is the whole clip's audio, unchanged.
   Check the `<Audio 1>`/`<Video 1>` renumbering in `MpiH3References` (a sounded video takes
   `<Audio 1>`; the templates name no audio tag today, so nothing should shift).
2b. **Separate the mouth causes (bench, before shipping 2).** On the 5 s speech clip
   (`ref2v_004`), template 6, same seed, four runs: as shipped / soundtrack wired / swap LoRA on /
   both. Measure the mouth against the source (mouth-open per frame vs the source's, lag in
   frames), then listen. If the LoRA run alone fixes the lips, node 21 turns the LoRA on for
   template 6 too, and the check is that the picture's room still replaces the clip's room
   (the LoRA was trained to keep the video's room, which is likely why it was left off).
3. **Say the words (prompt).** Fabio's check says the spoken words help. Options, cheapest
   first: (a) a "What they say" field the user or Cosmo fills, spliced into `[Shot 1]` the way
   `docs/models/h3` writes speech (quoted words, and MPI-1333's guidance for a pause);
   (b) transcribe the clip before the run, the same way `describe` fills `Input_Look`.
   Decide with Fabio after steps 1 and 2 are judged. Steps 1 and 2 may be enough on their own.
4. **Reuse repro (app).** On an isolated app (`npm run app:isolated`), reuse a
   picture's-room card and log `s_flowInputs['video-edit']` at mount and the radio's `cur`.
   Fix at the point the `false` is lost. Write a unit test on that point.
5. **Re-run the showcase sections** on the original ref2va weight: the 5 s speech clip
   (`ref2v_004`, was `_011`), the 0.875 s clip (`resizeVideo_010`) and the 2.17 s clip
   (`resizeVideo_005`). Judge on the SOUND and the mouth (H3 rule: judge on the audio).
   Fabio's eye and ear decide; this is a validating step, not an agent pass.
6. Then the two open investigations above, as their own cards if they turn out to be
   separate.
7. **Bench Viggle-Animate H3** (Fabio, 2026-10-29), a prompt-free H3 fine-tune for person
   swaps with its own chunked long-clip sampler: a fallback if Video Edit gets blocked on swaps,
   and research for Infinite Video. Notes and bench design: `research/viggle-animate.md`.

## Files

`comfy_workflows/raw/flow_video_edit.json` + `comfy_workflows/flow_video_edit.json` (via the
bench builder `tasks/MPI-1036/research/bench/flow_graph.py`, `export_raw.py`, then
`node scripts/sync-raw-workflows.mjs` — see `docs/playbooks/add-flow/existing-flows/video-edit.md`
§ Traps), `js/data/flowsRegistry.js` (only if step 3 adds a field), the Reuse fix site
(unknown until step 4), `docs/playbooks/add-flow/existing-flows/video-edit.md`.

## Current State (2026-10-29, session "Video Edit Flow Issues 4")

**Steps 1 + 2 SHIPPED to the working tree.** `export_raw.py push` -> frontend `loadApiJson` + serialize (152 nodes,
280 links, every node id and type kept) -> `pull` -> `sync-raw-workflows.mjs`: raw committed `c68d25ac4`, injection
rules pass, generated `comfy_workflows/flow_video_edit.json` is STAGED, NOT committed (commit it `--only` at
handoff/end). Synced API vs `fg.graph()`: 0 differences (ids, types, inputs, titles). `npm test` 3802 pass, 0 fail.
The G:\ComfyUi bench moved back to **:8188** (the :8189 note below is stale); export_raw's 11 "missing titles" are
nodes whose title is their default display name, not losses.
API committed `01a21433c`, pushed.
**Step 4 (Reuse) - NOT reproduced.** Standalone `node server.js` on a spare port + APP_DOCUMENTS copy of "Video edit
showcase" + browser pane: Reuse -> Flow on flowVideoEdit_013 (saved false) shows "The picture's room" active, fresh
open AND with a parked (flow:suspend) Flow already showing the video's room. Cosmo's open-flow route keeps `false`
too. Note `_012` itself saved `true`. **Fabio 2026-10-29: dropped** - reopen only if it happens again.
Found + fixed on the way (`0dca51d4e`, pushed, test `tests/reuse-no-dialog-opens-flow.test.cjs`): with the Reuse
dialog OFF in Settings, both blocks passed dest 'app' (renamed to 'flow' elsewhere), so a Flow card fell into the
prompt box. Verified live with ask off.
Noticed, not fixed: a closing Flow's `destroy()` flushes a pending 300 ms persist into `s_flowInputs`; and
`resolveFlowFieldValues` passes the string "false" through unchanged (a radio shows it right, a graph boolean would not).
**TRAP:** a standalone server's renderer runs the boot node-drift repair on the REAL engine: it swapped
engine/.../ComfyUI-MpiNodes 291bf3d -> pin 5e37b38 (harmless, it was master's new pin; "Strip Node Packs 3" confirmed).
Check `node drift` in the log, or the pin vs the engine, before booting any renderer.
**Next:** flowVideoEdit_012 re-check on the shipped graph when Fabio frees the Pod (one 768p run ~8 min, ask first).
Step 3 only if Fabio still wants it. Windowing from MPI-1336; seam last.

## Previous state (2026-10-29 ~17:40 UTC, session "Video Edit Flow Issues 3")

**Steps 1 (pad up, cut back) and 2 (soundtrack) PASS on Fabio's Pod and by his eye/ear** on all three clips
(validation.md § Step 1): the 0.875 s and 2.17 s clips come back at full length and in sync (the man's mouth 0.48 ->
0.92), the 5 s clip corr 0.97, "spot on". Both live ONLY in the builder `MPI-1036/research/bench/flow_graph.py`
(+ bench graph `research/lipbench/P1_padup.json`); the shipped `comfy_workflows/flow_video_edit.json` is still HEAD.
**ONE next action: ship it.** `export_raw.py push` -> load each in a ComfyUI frontend tab (`app.loadApiJson`, then
POST `app.graph.serialize()`) -> `pull` -> `node scripts/sync-raw-workflows.mjs` (it COMMITS raw itself) -> diff the
synced API against `fg.graph()` (only injected widget values may differ) -> `npm test`.
Gotcha: export_raw and the sync default to :8188, where nothing runs. The `G:\ComfyUi` bench is up on **:8189**
(set COMFY_URL and the URL in export_raw; read-only, queue nothing). The Pod wrapper has no /object_info.
Template line "The sound of <Video 1> continues unchanged" KEPT: with the soundtrack wired it is true, and it is
the wording every passing run used.
Masking seam: blend 64 failed (64 is the node's max), parked LAST by Fabio. Showcase flowVideoEdit_012 drift: S2
with the soundtrack held - re-check after shipping. The Pod is shared with session "Turbo LoRA comparison test for
MiniMax H3"; timings since ~17:02 are skewed.

## Previous state (2026-10-29 16:37 UTC, session "Video Edit Flow Issues 2")

**Fabio's RTX PRO 4500 Pod (32 GB VRAM, 62 GB RAM) is LIVE in his app on :3000 and billing.** Use it first.
Runs go through his app (Fabio said so): `research/lipbench/run_bench.py` / `run_more.py` swap a bench graph
into `comfy_workflows/flow_video_edit.json` (the app fetches it per run) and restore `V1_shipped.json`
(== HEAD) after EVERY run. Results land in project "MPI-1335 lip bench", never "Video edit showcase".
~7.6 min a 5 s whole-frame run at 768p, ~3 min masked, ~24 min at 1080p. Price every batch and ask first.

Done: step 2b. **Cause 1 is THE lip cause**: soundtrack into H3 (nodes 300-303 in `V2_soundtrack.json`,
silence for the template-6 lead-in, lazy no-lead-in branch) gives corr 0.98, lag 0, mouth shut in pauses,
on the picture's room (768p and 1080p) and the video's room. Fabio: S2/S3 "spot on". Swap LoRA: no effect
on lips. MPI-1331 masked run passed (validation there). Masked route: SEAM at the square's edge (section
above) - next on the Pod. Not shipped: the soundtrack is in bench graphs only; shipping = builder
`MPI-1036/research/bench/flow_graph.py` + raw + sync (video-edit.md § Traps), plus the template's
"sound continues unchanged" line.

**Fabio, 2026-10-29 (session "Video Edit Flow Issues 3"): masking goes LAST**, since other changes may affect it.
New order: ship the soundtrack (step 2) + pad-up-cut-back (step 1) in one graph pass, then one Pod round on the
5 s, 0.875 s and 2.17 s clips (step 5); Reuse repro (step 4) and flowVideoEdit_012 locally meanwhile.
Was: (1) seam bench on the Pod, Fabio judges by eye; (2) ship the soundtrack via the builder; (3) step 1
pad-up-cut-back on the 0.875 s / 2.17 s clips; (4) Reuse repro (step 4).
