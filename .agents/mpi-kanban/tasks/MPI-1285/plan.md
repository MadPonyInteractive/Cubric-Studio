# MPI-1285: Fast Motion on MiniMax H3 Reference

## Current State

Project mode: scalable-foundation. Card in `todo`, planned. Design is in `brief.md` (Fabio,
2026-10-25). Nothing built yet. Engine on 48188 is ComfyUI 0.42.1 and carries core
`BlockSparseAttention` (sol-attn), so no engine bump.

Decisions taken at planning (each a pick, said in one line, not a stop):

- **Builds on today's ref2va graph.** MPI-1284 (Singularity v2 base) is a weight swap on the
  same graph, so the two cards do not wait on each other.
- **All routing lives in the graph**, behind ONE new switch `Input_Fast_Motion` (default
  false). Every caller that only sets Width/Height (Flows on this graph, routines, old
  sidecars) runs today's path unchanged. The graph derives the native base itself from the
  target's shape (the Medium cell: 1344x768 / 768x1344 / 768x768 / 1536x640).
- **Mode** (one MpiMath): 0 = one pass at target (target <= base), 1 = base + one upscale
  hop (target <= 2x base), 2 = two hops (2x base, then target: 4K, and 21:9 2K/4K),
  3 = Fast Motion off (today: half size + 2x). Brief said "2K first" for 4K; 2x base is one
  rule for every ratio (16:9 4K: 2688x1536 then 1.43x). Plan Drift if Fabio wants the 2K cell.
- Mode 0 decodes the stage-1 latent; the upscaler and the refine never run (lazy MpiIfElse).
- **sol-attn on the stage-1 model only** (where MPI-1135 Phase 2 measured it), both switch
  states, r2va graph only. fl2va's sol-attn stays with MPI-1284.
- **App side:** a `h3FastMotion` toggle next to Turbo (capability `h3FastMotionToggle`,
  ref2va only, perModel, default OFF, new icon in icons.js). Preview is disabled while
  Fast Motion is on at very_low/low/medium (one shared JS helper, also used for the progress
  bar count: a one-pass run is 1 bar, not 2). Named param `fastMotion` through
  generationControls (namedParamsFor + resolveNamedParams), connector, MCP schema, Cosmo's
  generate tool (services/agentLoop.mjs), agentDispatch, routineModel, entryInfo, promptReuse.
- **Cosmo rule** in `docs/agent/models/minimax-h3.md`: fastMotion true on ref2v_ms for a
  launch, flight, chase or fight, without asking.

## Implementation

- [ ] Graph: edit `comfy_workflows/raw/minimax_h3_r2va_template.json` (LiteGraph) with a
  script (clone donor nodes in place, bench-editing.md), sync against 48188, check the
  runtime. Then the app toggle, preview gate, bar count, named param through every agent
  layer, Cosmo rule, docs (`docs/models/h3/ref2va.md` Fast Motion section, windowing note),
  tests. **Verify:** converter self-check (0 missing inputs), every tier x ratio x switch
  state evaluated through MpiNodes `safe_math` on the RUNTIME graph's expressions (stage 1,
  hops, refine size, skip flag), `npm run lint` + `npm test` green, then one real GPU run per
  mode (0 and 1) on my isolated instance if the GPU lease is free, then Fabio's in-app
  Superman re-run.

## Completed

- [x] Graph: raw r2va edited by script (scratchpad edit_r2va_fast_motion.py), synced against
  48188; raw committed locally as 94241e3a3 (not pushed), API + runtime staged. Runtime diff =
  exactly the planned nodes. safe_math sweep over all 28 cells x 2 states: every cell delivers
  its label; switch-off plans identical to before.
- [x] App: capability + h3FastMotion button + Preview gate + one-pass bar count; `fastMotion`
  through generationControls, connector, MCP, Cosmo tool, agentDispatch, routineModel; Reuse
  and the card info row; Cosmo rule; docs/models/h3/fast-motion.md (new, ref2va.md is >200
  lines); tests/h3-fast-motion.test.cjs.
- [x] sol-attn on MiniMax H3 (fl2va), 2026-10-25 (H3 Singularity 11): raw edited by script
  (scratchpad edit_fl2va_sol_attn.py: new node 543 between switch 457 and readers 140/150/338),
  synced against 48188 (sync committed + pushed the raw as c2b158ba3). Runtime diff = node 543
  + three re-pointed model inputs + a cosmetic title on 393. Test added (same settings as r2va,
  no Input_Fast_Motion, EasyCache kept); fast-motion.md, a performance.md pointer and MPI-1284's
  brief updated. Lint + 3,670 tests green.

## Remaining Work

- Lint + full tests; Fabio's in-app look and the Superman re-run (the first real GPU run of
  the new graph: no smoke run on a GPU yet, Fabio's engine is his live session).

## Current State

CLOSED 2026-10-25 (H3 Singularity 11). Everything shipped and pushed; CI green on both code
commits (c399b5e4b, 71315e370). Fabio ran both graphs in the app (validation.md: sol-attn
2m 56s -> 2m 38s on H3 Reference, 3m 28s -> 2m 32s on MiniMax H3) and Cosmo set Fast Motion on
unasked for a fast-action request. Singularity v2 weight swap stays on MPI-1284.

Earlier: committed and pushed at handoff (2026-10-25). Fabio is testing in the app: "looks okay",
little difference on one scene, still some tearing with turbo off + Fast Motion on (expected:
tearing is the old ref2va DiT, fixed by MPI-1284's Singularity v2 swap). He is trying 1080p
(Very High = mode 1). Next (Fabio asked): sol-attn on MiniMax H3 (fl2va) too, stage-1 model,
same BlockSparseAttention params as r2va, EasyCache stays on non-turbo. That is MPI-1284's
fl2va half pulled forward; do it on this card, note it in MPI-1284's brief. Still open: the
Superman re-run through Cosmo. Gotcha: an engine running a graph
cached from before needs no restart (graphs are sent per run), but the APP must be restarted
to load the new JS.

## Plan Drift

- 2026-10-25: 4K "2K first" became "2x base first" (one rule for all ratios); 21:9 2K also
  takes two hops (2.5x). Fast-motion doc in its own file, not ref2va.md (200-line rule).

## Verification

**Verify mode:** user-ux

Automated: converter self-check, the safe_math sweep over every cell, lint + tests. Then
Fabio in the app: the Fast Motion button sits next to Turbo on H3 Reference only (absent on
MiniMax H3); Preview greys out at Medium and below with it on; and his Superman request
("speaks, then flies off") re-run through Cosmo comes back with Fast Motion on, set by Cosmo.

## Preservation Notes

- docs/models/h3/ref2va.md: Fast Motion routing table (modes 0-3) and why sol-attn is stage 1 only.
- docs/models/h3/windowing.md: Window Frames now reads the refine size, not hop 1.
- progressStages.js comment: Fast Motion one-pass is 1 bar.
- Ask at close: update `.claude/rules/` comfy map (new Input_Fast_Motion injection)?
