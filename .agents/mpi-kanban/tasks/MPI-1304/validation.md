# MPI-1304 validation

**Root cause:** `detectWmiGPUs()` in `routes/platformEngine.js` spawned `wmic`, which current
Windows 11 builds no longer ship. The spawn failed, the error branch returned
`{ hasAmd: false, hasIntel: false }` without a log line, and the installer fell back to
`ComfyUI_windows_portable_nvidia.7z`. Reported by a Discord user with an RX 6800.

**Fix:** the same Win32_VideoController query through
`powershell.exe -NoProfile -NonInteractive -Command "(Get-CimInstance Win32_VideoController).Name"`;
a probe failure now logs a `gpu-detect` warning instead of passing silently.

**Evidence:**
- Live, on a Windows 11 box where `where wmic` finds nothing: with `nvidia-smi` stubbed out, the
  real probe returned `"NVIDIA GeForce RTX 4060 Ti\r\nIntel(R) UHD Graphics 770\r\n"`
  (0.4-0.7 s), the same one-name-per-line shape the AMD / Intel Arc regexes read.
- `tests/gpu-detect-once.test.cjs` now asserts the probe is the PowerShell CIM query and that
  `wmic` is never spawned; stubbed AMD output still resolves `ComfyUI_windows_portable_amd.7z`.
- `npm run lint` clean; `npm test` 3742 pass, 0 fail; pre-push gate green on a5e78bad1.

**Not verified:** no AMD card on this machine, so the AMD branch is proven by the stub only.
Whether the AMD portable build runs on an RX 6800 (RDNA2) is a separate, untested question.
