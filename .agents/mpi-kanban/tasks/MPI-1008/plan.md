# MPI-1008 Plan - DramaBox device mismatch under tight VRAM

## Goal

A DramaBox run never fails with "Expected all tensors to be on the same device" when VRAM is short.

## Root cause (proven by reading ComfyUI v0.34 `comfy/model_patcher.py:982` `load`)

ComfyUI's partial load only offloads modules that carry `comfy_cast_weights` (comfy.ops layers).
A plain module that does not fit the budget is simply NOT moved, and the load still logs
`loaded completely; ... 0.00 MB loaded, full load: False`. No DramaBox module uses comfy.ops:
the embeddings processor, Gemma bf16, the DiT and VAE/vocoder are vendor `nn.Linear`, and the GGUF
DiT's `GGMLCastLinear` dequantises without moving weights. So EVERY DramaBox patcher crashes on a
partial load; the 4-bit Gemma (loaded outside ComfyUI) only makes a partial load likely.

## Fix

`dramabox_nodes/model/patcher.py` `load_patchers`: pass `force_full_load=True` to
`mm.load_models_gpu`. One shared primitive, every call site (text encoder, DiT, GGUF DiT, VAE,
vocoder). ComfyUI still evicts its own models first; a card with genuinely no room now gets a real
OOM (Windows spills to shared memory) instead of a wrong-device crash.

## Steps

1. Repro: script runs the fork's real `load_patchers` with free VRAM reported as ~0 -> device mismatch.
2. Fix `load_patchers`; same script -> runs on cuda.
3. Commit + push the fork (MadPonyInteractive/ComfyUI-MelodramaBox), repin `dev_configs/node_lock.json`.
4. Copy the fixed file into the local engine's custom_nodes copy so Fabio's next DramaBox run uses it.

## Verification

**Verify mode:** auto

- Repro script fails before the fix, passes after.
- `node_lock.json` commit equals the pushed fork HEAD.

## Current State

Steps 1-3 done (validation.md). Fork `529c4be` pushed and pinned. Next: CI green on the repin
commit, then Fabio's MPI-1004 look is the live DramaBox run; close on both.

## Completed

- Steps 1-3. Step 4 dropped (see drift).

## Remaining Work

- CI on the repin commit; the live run via MPI-1004's look.
- Fabio's call: the 2.0 smoke-evidence gate now needs a full-matrix re-run (validation.md).

## Plan Drift

- 2026-10-01: step 4 (hand-copy into the engine) dropped. The app sees the `.mpi_node_commit`
  drift and reinstalls the node at the pin itself, which is the real user path.
- 2026-10-01: a third-party pin move makes the release gate call ALL smoke evidence stale
  (`engine-drift.mjs` `assessPinMove`), so 2.0 needs a full re-smoke or a gate change.
