# MPI-953 checklist

- [ ] Read how the runner dispatches today (docs/playbooks/bump-engine/01-smoke-run.md, scripts/smoke-workflows.mjs)
- [ ] A Flow leg: select Flows by id, supply fixture media per input, dispatch the Flow graph the app would, record evidence like a model op
- [ ] --plan lists the Flow legs and their cost (spends nothing)
- [ ] Unit tests for Flow selection / fixture binding / plan output, no RunPod
- [ ] Playbook documents the Flow leg
