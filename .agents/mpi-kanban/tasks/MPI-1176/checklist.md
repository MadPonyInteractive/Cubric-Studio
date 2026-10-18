# MPI-1176 checklist

- [x] Append the pose sentence to node 184 (Edit Guardrails) in `comfy_workflows/flow_scribble.json`
- [x] Same text in the UI twin `comfy_workflows/raw/flow_scribble.json`
- [x] Both files parse; the shipped graph's node 184 equals bench variant B byte for byte
- [x] Flow/workflow tests green
