# MPI-1318 validation

**Root cause:** MPI-1304 fixed AMD / Intel Arc detection, but nothing recorded or checked which
engine build was installed. A machine that got the NVIDIA engine under the broken probe kept it
after updating. With the card now detected, `/comfy/start` launches that CUDA torch in GPU mode
(`--lowvram`, no `--cpu`) on a card it cannot drive. 2.1.3 does not bump the engine, so no
upgrade would ever replace it, and the app has no reinstall button. A second AMD user reported
the symptom on Discord on 2026-10-28: CPU and RAM busy, GPU idle.

**Fix:** the installed torch's local build tag (`+cuNNN` / `+rocm…` / `+xpu`, from its
dist-info folder) is the ground truth for which card vendor the engine can drive.
`wrongEngineBuildReason(detectedVendor, engineVendor)` in `routes/platformEngine.js` names a
mismatch. `/engine/version-check` then reports `needsUpgrade`, so the boot gate opens the
existing "Updating ComfyUI Engine" modal before anything launches. `_fullReinstallReason()`
returns the same reason, so `/engine/upgrade` skips the in-place path, which can never swap
torch. It takes the full reinstall instead: models root preserved, archive picked by the
detected card. `readEngineTorchCuda` and the new reader share one dist-info lookup.
No card detected (`vendor: null`) never counts as a mismatch, because the NVIDIA build is the
deliberate CPU fallback there (MPI-387 F2).

**Evidence:**
- `tests/engine-gpu-mismatch.test.cjs` (6 tests):
  - Build tags map to the right vendor, including TheRock `+rocmsdk…` and `+cpu`.
  - The mismatch rule holds, and unknown values never trigger it.
  - The real `/engine/version-check` handler, on a stubbed AMD-only machine with a current-version cu130 engine, returns `needsUpgrade: true`. Once the engine is a ROCm build it returns `false`.
- Live, this RTX 4060 Ti machine: real engine reads `engine: nvidia`, `card: nvidia`, reason
  `null`. An NVIDIA user is not sent a reinstall.
- `npm run lint` clean; `npm test` 3777 pass, 0 fail.

**Not verified:**
- No AMD card here, so the swap itself was not run end to end.
- The AMD portable archive's real dist-info tag is assumed to contain `rocm`. That is ComfyUI's ROCm wheel naming, but an AMD engine was not inspected. If the tag differs, the reader returns `null` and nothing triggers, so a wrong guess fails safe.
- Whether the AMD portable runs on an RX 6800 is still open from MPI-1304.
