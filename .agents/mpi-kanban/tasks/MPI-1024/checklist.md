# MPI-1024 checklist

Fabio 2026-10-05: fallback, not a global switch-off. Prove the cause on his box FIRST, so the
fallback is not a fix for the wrong thing.

## Phase A - prove the cause (no code change)

- [ ] Own instance (`npm run app:isolated`), never :3000. GPU lease held for every run.
- [ ] Emulate the user's 12 GB: a separate process holds 4 GB of VRAM on the 4060 Ti (16 GB).
      Same driver as the user (617.14), same engine (ComfyUI 0.34.0, aimdo 0.4.15, torch 2.13 cu130).
- [ ] Dynamic VRAM ON (shipped args): Klein 9B t2i 16:9 x N. Record every
      `VRAM Allocation failed` / `Fault failed` / `CUDA error: unknown error`.
      Klein 4B (the user's model) is not installed and G: has 16 GB free; 9B is the same
      Flux2 + Flux2TE path under aimdo, heavier.
- [ ] Dynamic VRAM OFF (`--disable-dynamic-vram`, `--lowvram` dropped): same runs. Record
      success and time per run.

## Phase B - the fallback

- [ ] Engine start accepts a fallback mode: `--disable-dynamic-vram`, no `--lowvram`
      (with aimdo off, `--lowvram` puts the text encoders on the CPU - model_management.py:1197).
- [ ] Detect the aimdo fault on the failed prompt, restart the engine in fallback mode, retry
      the generation once. Fallback lasts for the app session.
- [ ] Big-model check in fallback mode at the emulated 12 GB (a video model), so the fallback
      does not trade a crash for an OOM.
- [ ] docs/comfy.md entry.

## Not doing

- Global `--disable-dynamic-vram` (changes fit and speed for every user).
- A settings toggle.
