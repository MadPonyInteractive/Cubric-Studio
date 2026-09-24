# MPI-902 brief

## Problem

The Windows local engine ships torch built for CUDA 13.0 (`+cu130`), which needs an NVIDIA
driver of r580 or newer. On an older driver (e.g. one that reports `CUDA Version: 12.6`) the
engine dies at startup: `cudaGetDeviceCount` returns `cudaErrorNotSupported`, then the
process exits with an access violation (3221225477). The user sees only a crashed engine,
with nothing telling them the fix is a driver update.

Seen in the field 2026-09-24 on an RTX 3060: updating the driver fixed it, and a second issue
on the same box (RunPod queue jobs sticking until Stop) went away with it.

## Where

- `routes/platformEngine.js` already runs `nvidia-smi` and parses the driver's
  `CUDA Version:` header (`cudaVersion`), then `selectNvidiaBuild(gpuName, cudaVersion)`
  (line ~194) picks the build by GPU ARCH only. The driver's CUDA version is only used when
  the GPU name is unrecognised, and no minimum is ever checked against the build it picks.

## Want

When the driver's CUDA version is below what the selected build needs, tell the user
plainly to update their NVIDIA driver (and roughly to what), before or instead of a crash.
Where it surfaces (install/repair, engine start, a boot warning) and whether it blocks or
only warns is open; decide at planning.

Check what the `cu126` legacy build needs too, and whether pointing an old-driver modern
card at that build is a better answer than a warning.
