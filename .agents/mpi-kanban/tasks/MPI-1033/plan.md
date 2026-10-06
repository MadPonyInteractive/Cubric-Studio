# MPI-1033 plan - H3 Reference audio anchor

## Phase 1: Bench test the anchor on the ref2va graph
Copy the runtime `comfy_workflows/minimax_h3_r2va.json` to scratch, add `MiniMaxH3AddGuide(audio, frame_idx 0)`
after both `MpiH3References` (stage-1 #330, refine #688) ahead of the packer #873, run on G:/ComfyUi under the
GPU lease. Pass = output soundtrack matches the anchored track (waveform cross-correlation) and the picture
still follows the reference.

## Phase 2: Product shape (Fabio's call)
Standalone audio chip anchored, the reference video's own soundtrack kept, or both.

## Phase 3: Wire it
Ownership: comfy_workflows/raw/minimax_h3_r2va_template.json, comfy_workflows/scripts/workflow_generation/minimax_h3_r2va_template.json,
comfy_workflows/minimax_h3_r2va.json, docs/models/h3/ref2va.md, the app control (TBD by Phase 2).

## Verification
**Verify mode:** user-ux

## Current State
Phase 1 bench done 2026-10-06, 3 runs (validation.md § Findings). Video changed + audio kept already works on
today's graph (the sounded reference video's soundtrack comes back at ~0.97 with or without an anchor).
Video kept + audio changed: frames pin holds the picture, but the soundtrack wired as a reference forces the
original sound back. Bench builder/scorer: `research/bench.py` (modes anchor|keepvideo|control) and
`research/compare.py`; outputs in `D:/WORK/Images/Outputs/mpi1033/`.

Agent-text audit (2026-10-06): three places tell an agent the opposite of what was measured, so "restyle this
clip, keep its sound" would be refused or misrouted: `js/data/commandRegistry.js:882-883` (`ref2v_ms` help:
"a NEW video", "none of them appears in the output as-is"; also the Prompt Box help), `js/data/modelConstants/
modelPriority.js:145` (REF_NOTE: "the clip is made new around them"), `docs/agent/models/minimax-h3.md`
(references only "steer who and what appears"; no editing case). Keep-video/change-sound route is the Add Foley
Flow (`js/data/flowsRegistry.js` ~619, "silent clip", foley only - music is on its negative), not ref2v_ms.

NEXT (Fabio said yes to both, in this order): (1) speech-clip bench - control mode, a sounded SPEECH video as
`<Video 1>`, score its soundtrack; (2) then correct those three texts in place (fix the wrong sentences, do not
add new instruction lines), after reading github.com/MiniMax-AI/MiniMax-H3/tree/main/skills for anything usable.
Phases 2-3 (product toggles, graph wiring) wait for Fabio after that; Phase 3 also waits for MPI-1029's claim.

## Completed

## Plan Drift
- 2026-10-06: Fabio corrected the bench: image + standalone track only proves an anchor animates a picture.
  The case to prove is ONE sounded input video: picture as the reference (restyle it), its own soundtrack
  pinned so the output keeps it. Bench switched to `mpi568_ai_cowboys_hi.mp4` (5.17 s, rhythmic peaks),
  anchor audio = the video loader's own audio (`331` out 1), plus a control run on today's graph.
