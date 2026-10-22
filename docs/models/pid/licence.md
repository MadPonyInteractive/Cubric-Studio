# PiD upscaler — licence (MPI-1250)

**Research or evaluation only. No commercial use, including what you upscale with it.**
Gated since MPI-1250 (2026-10-22): `nvidia-pid` → `NVIDIA_PID` in
`js/data/modelConstants/licences.js`, `nonCommercial: true`, so the install shows the licence
screen and the Model Library tile carries the non-commercial flag. It shipped ungated from
2026-07-03 until then, so earlier installs never saw the screen; they do see the tile flag.

## The licence

NVIDIA Source Code License v1 (`license_name: nsclv1` on Comfy-Org/PixelDiT). Read 2026-10-22:

| Repo | LICENSE |
|---|---|
| `Comfy-Org/PixelDiT` (our weights' source) | NSCL v1, 3,997 bytes, sha256 `5a974fcf…82af` |
| `nvidia/PixelDiT-1300M-1024px` | byte-identical to the above |
| `nvidia/PiD` | **no LICENSE file.** Its README § License/Terms of Use names NSCLv1 and links PixelDiT-1300M's |

- **§3.3 Use Limitation:** the Work and derivatives "only may be used or intended for use
  non-commercially", defined as "research or evaluation purposes only". NVIDIA itself is exempt.
- **No output carve-out.** Unlike FLUX.2 Klein 9B (§2.d lets you sell outputs), nothing here
  frees the images. Upscaling a client's or a sold image IS commercial use of the Work.
- **§3.1 Redistribution** is allowed under the licence, with a complete copy, keeping any notices.
  The Work carries no copyright or attribution notice, so the descriptor has no `poweredBy`.
- No HF access gate on either repo (`gated: false`), so no `verify` step.

## What we distribute

All PiD weights are on R2 (`url`, primary) with HF as `mirrorUrl`, uploaded 2026-07-03
(`rclone lsl`, 2026-10-22): the four `pid_*_1024_to_4096_4step_bf16` transformers (2.54 GB each),
`gemma_2_2b_it_elm_bf16` (4.87 GB) and `vae/sd3_vae`. §3.1 permits that; the complete copy it
requires is `licences/pid/LICENSE.txt`, byte-identical to Comfy-Org's, linked from the gate.
Fabio chose gate + keep R2 over dropping the model or moving to HF-only (2026-10-22).

## Not covered by this gate

`pid-gemma` is a Gemma 2 2B-it derivative (Google's Gemma Terms of Use) and `vae-sd3` is
Stability's SD3 VAE. Both are re-hosted on R2 and carry their own terms; NSCL does not speak
for them. Open follow-up, not settled here.

A commercially usable upscale already ships: the SDXL models' `upscale` op
(UltimateSDUpscale + `4x-NMKD-Siax`). Point commercial users there.
