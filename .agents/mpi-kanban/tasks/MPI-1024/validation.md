# MPI-1024 validation

## The report

First public 2.0 bug (2026-10-05). RTX 3060 12 GB, 64 GB RAM, driver 617.14 (CUDA 13.4), models on
a 5 TB drive, in-place upgrade 1.5.0 -> 2.0.0. Engine identical to the shipped 2.0 (ComfyUI 0.34.0,
comfy-aimdo 0.4.15, torch 2.13.0+cu130). `klein-4b:t2i` over MCP: text encode 4m17s, sampler at
"Model Initializing" 2m17s, then `aimdo: src/model-vbar.c:403:ERROR:VRAM Allocation failed`,
`CUDA error: unknown error`, Chromium GPU process crashed the same second, engine exit code 3.

`model-vbar.c:403` in aimdo 0.4.15 is the SECOND allocation attempt: the first returned OOM, aimdo
freed its own pages, and the retry still failed - real VRAM exhaustion it could not relieve. Not the
upstream `CUDA_ERROR_NOT_READY` race (comfy-aimdo#100, `(non OOM)`, line 393/399), though the same
allocator.

## Phase A - on Fabio's box (RTX 4060 Ti 16 GB, same driver 617.14, same engine)

12 GB emulated by a separate process holding 4 GiB. `klein-9b:t2i` 16:9 (4B not installed; 9B is
the same Flux2 + Flux2TE path, heavier: TE 9.0 GB + DiT 9.0 GB staged > ~10.5 GB free, so every run
evicts the encoder for the DiT - the upstream race's precondition). Isolated instance, GPU lease held.

| Mode | Load | Runs | Result | Time per run |
|---|---|---|---|---|
| dynamic VRAM ON (shipped) | 4 GiB held, same prompt | 6 | 6 OK | 8-24 s (TE cached after run 1 - not counted) |
| ON | 4 GiB held, prompt varied per run | 10 | 10 OK | 11-12 s |
| ON | 4 GiB held + 3 GiB burst every 0.5 s | 10 | 10 OK, 0 faults | 18-31 s, but **475 s** and **1194 s** (one step took 1167 s) |
| OFF (`--disable-dynamic-vram`, no `--lowvram`) | 4 GiB held, varied | 10 | 10 OK | 14-16 s |
| OFF | 4 GiB held + 3 GiB burst | 10 | 10 OK, 0 OOM | 24-31 s, no stall |

Shared GPU memory: ON under pressure 16.8 GB (Windows paging VRAM to RAM); OFF 0.3 GB.

**The crash did not reproduce in 46 runs either mode.** What reproduced is the stall: only ON, only
under outside VRAM pressure, minutes long - the user's 401 s run, which ended in the fault. OFF never
stalled. So the fallback switches to the mode that held up exactly where his run died.

## Phase B - fallback mode on heavy models (4 GiB held)

| Model | ON | OFF |
|---|---|---|
| krea2 t2i 1k (cold, warm) | 43 s, 32 s | 69 s, 42 s |
| minimax-h3-ref2va 3 s low turbo, no refs | 136 s | 224 s (TE + DiT loaded partially, no OOM) |

OFF costs 1.3-1.65x - acceptable for a mode that only switches on after a fault.

## The fallback, end to end (isolated app on the new code)

Fault line fed to the live engine through a validation error (`ckpt_name: 'Fault failed: 2'`):
`[WARN] [comfy] Dynamic VRAM fault — the engine restarts with dynamic VRAM off for the rest of this
session`; `/comfy/status` -> `needsRestart: true, restartReason: "Restarting ComfyUI in a safer GPU
memory mode..."`. Next connector generate: auto-restart, `Starting ComfyUI with dynamic VRAM off`,
engine `Set vram state to: NORMAL_VRAM` with no DynamicVRAM line, generation OK in 61 s (restart
included), next one 16 s.

Not exercised live: the engine dying on its own (the user's exit code 3). That path is the ordinary
"not running -> /comfy/start" spawn, which reads the same flag.

## Tests

`tests/dynamic-vram-fallback.test.cjs` - verbatim fault lines from the report set the mode, a healthy
line does not, the mode is sticky, `--lowvram` is dropped. `npm test`: 2723 tests, 0 fail.
