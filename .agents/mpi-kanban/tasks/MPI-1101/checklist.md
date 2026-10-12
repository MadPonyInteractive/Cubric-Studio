# MPI-1101 checklist

- [x] Phase 0: model bench on Fabio's GPU go (Klein 9B vs Krea 2 + baseline); verdict in validation.md
- [x] A1: seamless pixel service (services/seamlessOps.js, routes/seamless.js, server.js mount, tests/seamless-ops.test.cjs)
- [x] A2: MpiStepEdges gizmo + tiles view (component, stepKinds line, preloadStyles, tests/step-edges.test.cjs; types.js typedef when MPI-623 frees it)
- [x] A3: { media } in ruleHolds (flowsRegistry.js rules only, declaredFields.js, tests/flow-rules-media.test.cjs) (unblocked: MPI-1071 released it, e3a8f8fcb)
- [x] Phase 2: graph flow_make_seamless.json + op registration in the 4 files (the _t2i graph is out: from-scratch textures are later, Fabio 2026-10-12)
- [x] Phase 3: FlowDef, passes planner (D3), one-card landing (D2), result Tiles slider, agent + MCP
- [x] Phase 4a: agent-path 8K pano E2E + band-edge fix (ramped mask + DifferentialDiffusion); Fabio's eye test PASS 2026-10-12
- [ ] Phase 4b: the Flow screen on an isolated instance (status bar i/N on a 16K multi-window picture, no second Generating card, Tiles slider, a texture both ways)
- [ ] Phase 4c: one run with the content box EMPTY (describer path; ask Fabio first if the describer is a paid cloud pick)
- [ ] Phase 4d: one LIVE Cosmo request ("make this picture tile") and one call through the MCP generate tool, on an isolated instance in dev mode (the door is proven by the 8K connector E2E; the model picking the Flow is not)
- [x] Flow graphics: 4/5 tile still + wide hero clip via /mpi-flow-graphics (built + wired 2026-10-12; awaiting Fabio eye test)
