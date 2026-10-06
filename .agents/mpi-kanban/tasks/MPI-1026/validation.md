# MPI-1026 validation - release 2.0.1

Released commit: `acf2dc384` on master, tag `v2.0.1` (moved there 2026-10-06 after the hold; the first
cut `30ea77df6` was built and update-tested but never published).

## What proves it

- **Code on master, CI green.** Every 2.0.1 fix landed as its own card (MPI-1024, 1028, 1029, 1031,
  1032, 1033, 1034), each CI-green; the notes commit `acf2dc384` ran 37476235455 (unit + 4 desktop
  shards, success).
- **Notes approved.** Gate 1 (in-app changelog, 8 fixes) OK'd by Fabio 2026-10-06; token
  `docs/releases/.approved-2.0.1.json` 14:05Z; `npm run release:check` green; archival note
  `docs/releases/2026-10-06-v2.0.1.md` mirrors the block (parity check); UNRELEASED folded.
  Every "used to" claim checked against `v2.0.0`.
- **Build.** mpi-ci 37478074382, three legs each `HEAD is now at acf2dc384`, each "No baseline; full
  bundle"; 6 assets downloaded to `D:/CubricStudio/Vision/Builds/v2.0.1/`, every archive
  integrity-tested, Windows update manifest `fromVersion null / toVersion 2.0.1 / buildHash
  acf2dc3842cb / 7220 files`; CI artifacts deleted.
- **Windows update leg** (`docs/playbooks/install-test/README.md` § 3), recorded in
  `dev_configs/update-evidence.json`: fresh extract of the PUBLISHED 1.5.0 zip + 1.5.0-era user-data +
  a pre-2.0 engine; `update-from-zip.bat` exit 0; 398/398 user-data + models files byte-identical;
  scratch Documents renamed Cubric Vision -> Cubric Studio, pre-update project listed; update check
  `current=2.0.1 latest=2.0.0`; the install's own engine installed 2.0's packages and came up
  (ComfyUI 0.34.0, ready in 155 s); SDXL Realistic t2i 896x1152 in 83.5 s under the GPU lease;
  opened `t2i_002.png`: a red bicycle against a white brick wall in morning sun.
  `npm run release:check:publish` green.
- **Gate 2.** Release body OK'd by Fabio 2026-10-06 (new intro, the 8 fixes, Windows "tested on this
  build").

- **Published 2026-10-06 15:22Z.** https://github.com/MadPonyInteractive/Cubric-Studio/releases/tag/v2.0.1,
  title `v2.0.1`, created as a draft, all 6 uploaded sizes equal to the local files byte for byte, then
  `--draft=false --latest`. `releases/latest`: `tag_name v2.0.1`, `draft false`, `prerelease false`,
  6 assets; `gh release list` shows it as Latest above v2.0.0.

## Found on the way

- `D:/CVTest/CubricVision-v1.5.0/` is a PRE-release 1.5.0 cut (build `a86918348393`, applier dated
  2026-09-07, no MPI-709 icudtl fix): the applier aborts on `icudtl.dat` like 1.4.x. Not a user build;
  the published 1.5.0 (`43b22c407b61`) applies clean. Recorded in the evidence `oldestServedReason`.
- With Fabio's app open, a test install ATTACHES to his engine on the shared port 48188 (hard-coded,
  no override) and its generation goes to HIS engine. One rejected prompt reached it before I caught
  it (validation failure, nothing ran, no restart). The update leg's generation needs his app closed.
- The bundle ships a second, stale `resources/app/resources/cubric/update-manifest.json` (repo-committed
  dry-run file, `toVersion 0.0.11`, darwin); the real one is `resources/cubric/update-manifest.json`.
  Present in 2.0.0 too. Harmless, noted only.
- The 1.4.x `comfyui-kjnodes` triton import error in the engine log is upstream noise present in every
  install's log, including Fabio's.
