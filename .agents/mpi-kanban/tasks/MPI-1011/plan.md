# MPI-1011 Plan - Outpaint seam, then passes for big fills

2.0 GATE (Fabio 2026-10-02: found during the 2.0 push, "we can't release a flow that is broken
as its first version"). Two phases, in Fabio's order.

## Phase 1 - the seam (graph only)

Node 687 (Mickmumpitz `HarmonizeBoundary`) bilinear-resizes the plate (553) and its mask to the
decode size, then counts `m < 0.5` as the original. An edge that falls between decode pixels
gives a "known" pixel whose plate value is part black; the solve's 8x area-average carries that
row into the boundary condition and pulls the fill's level down (~value/16: +3..+8 RGB on a
bright sky). Fix: feed 687's `inpaint_mask` a mask already at the DECODE size and grown 1-2 px
there, so the half-black row reads as hole. 686's paste mask is unchanged. Decode space, not
plate space: the needed grow is then scale-free, and core GrowMask dilates on the CPU once per
pixel of growth, which a 179 MP plate cannot afford (a torch max-pool stand-in for an 8 px grow
took 29 s on 8192x4608; the decode-space grow takes under 0.1 s at any plate size).

- Edit `comfy_workflows/raw/flow_outpaint.json`, run `scripts/sync-raw-workflows.mjs`.
- **Verify:** proof script (real node classes, edge offsets 0..5, three plate scales): worst
  step with the fix within +-1; one local Outpaint run on a bright-sky image, measured.

## Phase 2 - passes for big fills

The pass machinery from `9c8c5841b` is idle, not deleted (`outpaintPasses.js`, flowService
`runNextPass`, `MpiBaseFlow._planPasses`, agent path). Re-arm it with a `maxGrow` on the Outpaint
step: each pass grows every side by at most a third of what it already has.

- **Verify:** unit tests on the plan; one local run that needs 2+ passes; Fabio's look.

## Verification

**Verify mode:** user-ux (Fabio's look at the seam and at a multi-pass fill). Re-smoke Outpaint
at the cut (MPI-595 B1) since the graph changes.

## Current State

2026-10-02 (session 27738b6a, at handoff): COMMITTED `bf9588d59` and Fabio's look PASSED
("Fantastabomb.": 9:21, two passes, flowOutpaint_011 672x1568, no seam). NEXT: CI run
36995557115 green -> done move in a board-only commit (template: session 27738b6a scratchpad
`close_commit.py`). What `bf9588d59` holds, as built:

2026-10-02 (session 27738b6a): Phase 1 is SUPERSEDED (see Plan Drift). Built and
tested, not committed: (1) pass 2 fix in `MpiStepCrop.js` `composeNextPass` (`filePath`, new
`tests/outpaint-next-pass.test.cjs`); (2) Outpaint graph = Klein's decode straight to
`Output_Image` (686-690 gone, raw + runtime, links checked), FlowDef description/comments,
`requiredDeps` dropped; (3) no cloud model on Outpaint (MPI-918's slot). `npm test` 2670 / 0
fail, eslint clean, smoke `--plan --flows outpaint` clean. NEXT: Fabio restarts his app and
runs one multi-pass Outpaint (his 9:21 on the monkey: two passes, final ~1 MP portrait, no
seam, the flow screen shows it); then commit by pathspec (MPI-1011 + MPI-918 files), CI,
done moves. Outpaint stays in the cut's scoped re-smoke (MPI-595 B1).

2026-10-02 (session b487ee6b): BOTH PHASES BUILT, unit + node-level proven (validation.md). Left: Fabio's look (seam on a bright sky, one multi-pass fill), then CI + close. Outpaint joins the cut's scoped re-smoke.

## Plan Drift

- 2026-10-02 (Fabio's live look, flowOutpaint_009): pass 2 never started (`composeNextPass`
  read `url`; a finished item has `filePath`), and a line showed where the bottom edge cut the
  horse (~3 levels average, up to 9, 30-65 px scale; the harmonizer's 8x block solve never
  matches the edge row). Fabio's call after the why: OPTION 2, run Klein directly, no paste-back
  (smaller, recoloured, no join); passes stay at a third per side; no cloud model on Outpaint.
  A seam-free exact original is for a later version.
