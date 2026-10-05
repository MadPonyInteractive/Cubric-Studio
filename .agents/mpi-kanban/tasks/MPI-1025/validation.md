# MPI-1025 validation

Docs-only: one bullet added to `.claude/rules/comfy_engine.md` section 2 (ComfyUI Process State), Fabio-approved rules edit (MPI-1024 handoff).

Evidence (2026-10-05):
- Every named symbol grepped live: `_noteDynamicVramFault` / `_cudaModeArgs` / `AIMDO_FAULT_RE` in `routes/comfy.js:170-186`, `restartReason` on `/comfy/status` at `routes/comfy.js:296`, clears at `routes/comfy.js:574` (isUserRestart) and `:625` (spawn); `dynamicVramOff` / `comfyRestartReason` in `routes/shared.js:351-354`; toast fallback in `js/services/comfyController.js:466-469`.
- `node --test tests/dynamic-vram-fallback.test.cjs`: 4 pass, 0 fail.
- No code touched, so no CI run to judge (docs path-ignored).
