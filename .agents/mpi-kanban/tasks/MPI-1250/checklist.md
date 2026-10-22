# MPI-1250 Checklist

- [x] Licence confirmed: Comfy-Org/PixelDiT LICENSE = NSCL v1, byte-identical to nvidia/PixelDiT-1300M-1024px; nvidia/PiD has none, README points there (2026-10-22)
- [x] Re-hosting checked: all four PiD transformers, pid-gemma and vae-sd3 on R2 (`rclone lsl`)
- [x] Fabio's pick (2026-10-22): gate non-commercial, licence screen, tile flag, bundled licence, keep R2
- [x] `NVIDIA_PID` descriptor keyed `nvidia-pid` in `js/data/modelConstants/licences.js`
- [x] `licences/pid/LICENSE.txt` bundled (3,997 bytes, sha256 5a974fcf...82af)
- [x] Pin test in `tests/licence-gate.test.cjs` (12/12 pass)
- [x] `docs/models/pid/licence.md` + pointers from `upscaler.md` and `docs/models/README.md`
- [x] `npm run lint` clean; `npm test` 3517/3520, sole failure = a peer's uncommitted MOSS style-LoRA edit in `models.js` (op-strip-availability styleOps), not this card
