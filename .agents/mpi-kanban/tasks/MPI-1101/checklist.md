# MPI-1101 checklist

- [x] Phase 0: model bench on Fabio's GPU go (Klein 9B vs Krea 2 + baseline); verdict in validation.md
- [x] A1: seamless pixel service (services/seamlessOps.js, routes/seamless.js, server.js mount, tests/seamless-ops.test.cjs)
- [x] A2: MpiStepEdges gizmo + tiles view (component, stepKinds line, preloadStyles, tests/step-edges.test.cjs; types.js typedef when MPI-623 frees it)
- [x] A3: { media } in ruleHolds (flowsRegistry.js rules only, declaredFields.js, tests/flow-rules-media.test.cjs) (unblocked: MPI-1071 released it, e3a8f8fcb)
- [x] Phase 2: graph flow_make_seamless.json + op registration in the 4 files (the _t2i graph is out: from-scratch textures are later, Fabio 2026-10-12)
- [x] Phase 3: FlowDef, passes planner (D3), one-card landing (D2), result Tiles slider, agent + MCP
- [x] Phase 4a: agent-path 8K pano E2E + band-edge fix (ramped mask + DifferentialDiffusion); Fabio's eye test PASS 2026-10-12
- [x] Phase 4b: the Flow screen on an isolated instance (status bar i/N on a 16K multi-window picture, no second Generating card, Tiles slider, a texture both ways) - Tiles aspect bug found + fixed
- [x] Phase 4c: one run with the content box EMPTY (describer path; local describer, no cost)
- [x] Phase 4d: one LIVE Cosmo request ("make this picture tile") and one call through the MCP generate tool - MCP PASS; Cosmo FAIL on ornith:9b (picked tiled upscale); Cosmo PASS on the production DeepInfra model 2026-10-14 (picked Make seamless, both ways, `flowMakeSeamless_096`)
- [x] Status bar shows IDLE between windows (~15 s per gap at 16K): show the run between passes (`tool:hold`; unit + live greenhouse 16K)
- [ ] 16384-wide joins: at 4x shrink Klein KEEPS THE CUT in most windows (seamScore: 4 of 5 leaves + greenhouse w0; 8K all heal) - fix direction back to Fabio (seed re-run heals ~1 in 5)
- [x] Line across the seam where two 16K windows meet (row step 2.5x): overlap mask ramp in `windowMaskBuffer` - unit + live (`_074`: 1.30/1.29 vs control 1.39)
- [x] Flow graphics: 4/5 tile still + wide hero clip via /mpi-flow-graphics (edge design, autumn leaves; Fabio approved 2026-10-13)
- [x] Both-ways centre break fixed (per-window frames + corner window, seamlessOps.js; unit + live moss/sand/stone)
