# MPI-1038 checklist

- [x] Phase 1 - bench graph: raw LiteGraph `flow_tile_detailer.json` generated, proven on :8188 at None and 2x (+ guide_size 1024 fix for small pictures)
- [x] Phase 2 - repo wiring: converter + validator (sync-raw skipped, see plan drift), op in 4 files, FlowDef, inject-titles test case
- [x] Phase 3 - agent knowledge: description, docs/agent/flows.md, agent-flow-handover test
- [x] Phase 4 - live run in an isolated app: None + 2x cards, sidecar flowId/flowInputs
- [ ] Fabio's eye-test (user-ux): run it on his own pictures, detail only and 2x
- [x] Phase 5a - existing-flows doc
- [ ] Phase 5b - graphics (/mpi-flow-graphics) after Fabio's eye, then the UNRELEASED.md entry
