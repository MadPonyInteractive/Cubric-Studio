# MPI-1054 Validation

## Method (2026-10-09)

RunPod's best-gpu-for-comfyui setup replicated on our own Secure Cloud Pods, no network
volume: FLUX.2 Klein 9B bf16 (`black-forest-labs/FLUX.2-klein-9B`), `qwen_3_8b_fp8mixed`
text encoder, official 4-step graph (euler, cfg 1, 1024x1024), ComfyUI v0.39.0 on
`runpod/pytorch:1.0.2-cu1281-torch280-ubuntu2204`, single user, one warm-up, then the median
of runs timed ON the Pod from ComfyUI's history (`execution_start` -> `execution_success`).

Two medians per card: 10 runs with one prompt (text encoder cached) and 5 runs with a new
prompt each image. The new-prompt median is the one that matches RunPod, so it is the one
shipped.

## Calibration against cards RunPod measured

| Card | Ours, new prompt | Ours, fixed prompt | RunPod |
|---|---|---|---|
| A40 | 4.6 | 3.9 | 4.80 |
| RTX A5000 | 6.75 | 4.65 | 6.46 |

Both within 5% on the new-prompt measure. RunPod's own rows stay as published.

## Results shipped in `GPU_GEN_SECS` (s/img, new prompt each)

| Card | s/img | fixed prompt |
|---|---|---|
| RTX 6000 Ada | 3.88 | 3.27 |
| RTX A6000 | 4.53 | 3.77 |
| RTX 4000 Ada | 6.74 | 5.23 |
| RTX A4500 | 7.01 | 5.46 |
| L4 | 8.29 | 6.57 |

RTX PRO 5000 Blackwell: no Secure Cloud stock at a 12.9+ driver in two 45-min windows
(19:28-20:13 and 20:16-21:00); not measured. Closed without it (Fabio's call left open).

Shipped in `2776a317`; master CI "Tests" green on that commit.

## Checks

- `node --test tests/gpu-picker.test.cjs`: 8 pass, 0 fail (the "unbenchmarked" example moved
  from L4, now measured, to H200).
- ESLint clean on `runpodGpuSpecs.js` and `MpiGpuPicker.js`.
- No Pod left running (`GET /v2/pods` empty after each run).

## Spend

About $0.92 of the $3 cap (rate x wall time): $0.25 lost to a bare `wait` in the Pod script,
$0.33 to a 6000 Ada crash-looping on a host with a 12.8 driver, the rest benchmarks.
