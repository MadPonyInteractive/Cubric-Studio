# MPI-953 checklist

- [x] Read how the runner dispatches today (docs/playbooks/bump-engine/01-smoke-run.md, scripts/smoke-workflows.mjs)
- [x] A Flow leg: select Flows by id, supply fixture media per input, dispatch the Flow graph the app would, record evidence like a model op
- [x] --plan lists the Flow legs and their cost (spends nothing)
- [x] Unit tests for Flow selection / fixture binding / plan output, no RunPod
- [x] Playbook documents the Flow leg
