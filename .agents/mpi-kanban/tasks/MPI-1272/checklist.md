# MPI-1272 checklist

- [ ] Node installs set their own flag (`comfyNodesPending`), separate from `comfyNeedsRestart` (Settings path change, dynamic VRAM fault keep restarting unconditionally)
- [ ] Gen gate: with nodes pending, restart only when the workflow uses a node class the running ComfyUI has not registered (`/object_info/<class>`)
- [ ] runWorkflow loads the workflow BEFORE the gate and hands it in; the remote engine's fall-to-local passes it on
- [ ] Every spawn / user restart / engine provision clears the new flag alongside the old one
- [ ] "Installed" toast: "restarts the first time you use it"
- [ ] Tests updated + new gate test; `npm run lint` + `npm test` green
- [ ] Remote twin: unchanged on purpose (model installs no longer reach the Pod restart path, docs/runpod-remote-engine.md); stated in validation.md
