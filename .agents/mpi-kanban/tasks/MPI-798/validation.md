# MPI-798 Validation

Verify mode: `auto`. All checks below were run on 2026-09-19 against this checkout
(1.6.1, ComfyUI pin v0.34.0, 21 node packs).

## Evidence

**1. Publish the pin set — no change was needed.**
`dev_configs/node_lock.json` and `dev_configs/python_deps.txt` already ship at every
release tag of the public repo. Proved with `git show v1.5.0:dev_configs/node_lock.json`,
and end to end by `--version v1.5.0`, which fetched that tag's pins over the network and
correctly reported **16** packs (master has 21) and MpiNodes drifted against v1.5.0's
older pin. No build change, no generator, nothing to keep in sync.

**2. `scripts/install-flow-devkit.mjs` — installed all 21 packs into a scratch ComfyUI.**
`node scripts/install-flow-devkit.mjs "D:/tmp/devkit-scratch/ComfyUI" --skip-python` →
`Matched this checkout (21 installed)`. On disk afterwards: 21 folders, 21
`.mpi_node_commit` markers, staging folder cleaned up. Spot-checked LanPaint, RES4LYF and
ComfyUI-MelodramaBox — every marker equals the lock's commit. Re-running with `--check`
then reported `Matched this checkout`, exit 0.

**3. The linter reports engine match.**
- Matched scratch → `Engine matches this checkout — a clean result below holds for that release.`
- Then `RES4LYF` deleted and `LanPaint`'s marker overwritten with a bogus commit →
  `! 2 of 21 node packs do not match this checkout: RES4LYF (missing), LanPaint (drifted)`,
  with the fix command. Lint exit code unchanged, as intended — a mismatch warns, never fails.
- No `COMFY_PATH` → `Engine match NOT checked`, and the lint proceeds.

The `1 problem(s): Needs app version 2.0.0 or later (this is 1.6.1)` on both Cubric-Flows
packages is the MPI-781 by-design floor, not a regression.

**4. Docs.** `docs/flow-packages.md` gained "Match your ComfyUI to the release", and the
lint section documents `COMFY_PATH`. The stale "MPI-798, due at the 2.0 release" pointer in
Authoring notes now names the script. Every command in the new sections was run as written.

**5. Suite.** `npm run lint` clean. `npm test` → **1383 pass, 0 fail, 1 skipped**, exit 0
(single run, captured to a file — a second run in the same shell produces phantom
port/SSE failures).

**6. The match check names EXTRA packs (step 5, found after 1-4 were committed).**
`findExtraPacks()` reads `custom_nodes` and subtracts the lock's `filename`s.

- Against the MPI bench `G:\ComfyUi`: on top of the existing `! 5 of 21 node packs do not
  match`, it now prints `! 12 node pack(s) installed that this checkout does not ship` and
  names them — ComfyUI-BFSNodes, ComfyUI-DramaBox, ComfyUI-GGUF, ComfyUI-H3-Motion-Context,
  ComfyUI-JoyCaption, ComfyUI-MAINodes, ComfyUI-Manager, ComfyUI-MiniMax-H3-Turbo,
  ComfyUI-QwenTTS, ComfyUI-VDN-H3, comfyui-FSampler, rgthree-comfy.
- Against a synthetic ComfyUI carrying all 21 pinned packs with correct markers, every
  folder name lower-cased, plus `__pycache__`, a `.disabled` pack, a dot-prefixed folder,
  a loose `.py` file and one real extra: `Engine matches this checkout` followed by
  `! 1 node pack(s) installed` — ComfyUI-GGUF alone. That one run proves all four filters
  and the case-insensitive compare at once.
- Same tree with the extra removed: the match line alone, no extra block.
- No `COMFY_PATH`: `Engine match NOT checked`, unchanged.
- Exit code unchanged in every case — an extra pack warns, it never fails the lint.

**7. Suite after step 5.** `npm test` → **1383 pass, 0 fail, 1 skipped**, exit 0.
`npm run lint` clean. Both were run in this session and the counts read off the captured
output; the durable artifact is the CI run on e6908dd6 / 188cdc78, which runs the same suite.
(A close-out claim audit flagged the bare counts as self-reported with nothing on disk — they
are accurate, and CI is what proves them to a later reader.)

## Three bugs the verification caught, each of which would have shipped

1. **Marker-only inspection called 21 correct packs drifted.** A developer's packs are git
   clones; only the app zip-extracts. The first `--check` against the MPI bench reported
   all 21 drifted while every clone sat exactly on its pin — and ComfyUI-MpiNodes carried a
   *stale marker* that disagreed with its own HEAD. Unfixed, a real run would have deleted
   21 correct checkouts. Fixed by reading `git rev-parse HEAD` first, marker as fallback,
   and by moving a clone with `fetch` + `checkout --detach` instead of replacing it.
2. **`tar` could not read the zips.** Git Bash/MSYS put **GNU** tar ahead of Windows'
   bsdtar on PATH; GNU tar cannot read zip at all, and reads `C:\dir\x.zip` as the remote
   spec `host:path` ("Cannot connect to C: resolve failed"). The app never meets this
   because Electron spawns System32's bsdtar. Fixed by naming `System32\tar.exe` outright
   and keeping arguments colon-free.
3. **`EXDEV` on every pack.** Staging in `os.tmpdir()` (C:) and renaming into a ComfyUI on
   D: is a cross-device rename. Fixed by staging inside `custom_nodes/` — same volume, and
   it keeps several hundred MB of pack zips off the system drive.

## Not verified here

- **A real generation** through a Flow built on a devkit-matched ComfyUI. Out of this
  card's scope (no engine was started, no GPU used); the class-level guarantee is the
  linter's `/object_info` check, which is unchanged.
- **macOS and Linux.** The bsdtar fallback and `detectPython`'s venv paths are written for
  them but were only exercised on Windows.
