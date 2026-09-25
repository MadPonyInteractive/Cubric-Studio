# MPI-922 checklist

- [x] Prove the hole: a foreign-origin POST /prompt runs on a ComfyUI started with the bare flag
- [x] Prove the main.js session hooks carry the renderer without the flag (preflight, ws, crossOrigin img + video, HEAD, upload)
- [x] Drop the flag from the spawn args (routes/comfy.js) and the run_nvidia_gpu.bat patch (routes/engine.js, which also strips it from an old .bat)
- [x] Update every consumer that cites the flag (MpiBaseFlow comment, two docs, gif-cutout spec comment, main.js comment, PROJECT.md invariant 15)
- [x] Regression guard test (tests/comfy-port-lockstep.test.cjs, red on HEAD)
- [x] Verify: foreign-origin fetch refused (raw + real Chromium); generation, previews and Flow-pane HEAD work through the hooks (Electron harness)
- [x] Live app check against an engine the new code started (app:isolated, SDXL t2i + Scribble Flow, foreign probes on live 48188)
