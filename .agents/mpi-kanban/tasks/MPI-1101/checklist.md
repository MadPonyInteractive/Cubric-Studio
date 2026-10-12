# MPI-1101 checklist

- [x] Phase 0: model bench on Fabio's GPU go (Klein 9B vs Krea 2 + baseline); verdict in validation.md
- [x] A1: seamless pixel service (services/seamlessOps.js, routes/seamless.js, server.js mount, tests/seamless-ops.test.cjs)
- [x] A2: MpiStepEdges gizmo + tiles view (component, stepKinds line, preloadStyles, tests/step-edges.test.cjs; types.js typedef when MPI-623 frees it)
- [x] A3: { media } in ruleHolds (flowsRegistry.js rules only, declaredFields.js, tests/flow-rules-media.test.cjs) (unblocked: MPI-1071 released it, e3a8f8fcb)
- [x] Phase 2: graph flow_make_seamless.json + op registration in the 4 files (the _t2i graph is out: from-scratch textures are later, Fabio 2026-10-12)
- [x] Phase 3: FlowDef, passes planner (D3), one-card landing (D2), result Tiles slider, agent + MCP
- [ ] Phase 4: end to end on an isolated instance + Fabio's eye test
