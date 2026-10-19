# MPI-1194 validation

2026-10-19. Throwaway engine root only: the v0.34.0 `ComfyUI_windows_portable_nvidia.7z`
(the 2.0 engine) extracted to a scratch folder, `CUBRIC_ENGINE_ROOT` / `CUBRIC_MODELS_ROOT` /
profile all in scratch, `.mpi_engine_version` = 0.34.0, and the app launched with every PATH
entry holding a `git.exe` removed (`where git` -> exit 1). Fabio's `:3000` app and the repo
`engine/` were never touched.

## Before the fix (live)

    Upgrading engine in place to 0.41.0
    Full engine reinstall — the in-place upgrade failed (git is required but no supported
    package manager was found. Install git with your distribution package manager, e.g. sudo apt install git)

0.36 s after the boot gate fired, the full wipe-and-redownload started. Instance killed there.

## The fix

On win32 `_upgradeEngineInPlace` no longer calls `ensureGit()` (Linux/macOS only, as its own
header says). `comfyCheckoutSteps()` returns one run of the portable's own `python_embeded`
with a pygit2 script: owner validation off (as Comfy's `update.py`), depth-1 fetch of the pinned
ref (the portable's `.git` is shallow), force checkout, detached HEAD on the pin. Linux/macOS keep
`git fetch --tags` + `git checkout --force`. pygit2 is in the portable: 1.20.0 at 0.34.0, 1.19.3
at 0.41.0.

## After the fix (live, same scratch shape, git-less PATH)

    01:50:53.105 Upgrading engine in place to 0.41.0
    01:50:53.237 pygit2 checkout: ...python_embeded\python.exe -c import sys, pygit2 ...
    01:50:57.770 In-place upgrade pip set: comfyui-frontend-package==1.55.17 ... (5 packages)
    01:51:36.335 In-place upgrade landed 0.41.0; version stamp written
    01:56:25.612 In-place upgrade repaired 35 outstanding dep(s)

No `Full engine reinstall` line. ComfyUI HEAD `98cc0bf ComfyUI v0.41.0`, `git status` clean.
Re-run on the final script text (after the tag fix below): `In-place upgrade landed 0.41.0`
3 s after the gate.

The script was also run directly (shipped `comfyCheckoutSteps('win32', ...)`, PATH = System32
only) against the scratch repo: v0.34.0 (tag already local), the 0.41.0 sha, v0.41.0 (tag not
yet local), an older sha (0.27.0), back to the pin. Each landed with a clean tree. First draft
read FETCH_HEAD, which is EMPTY when the tag is already local; the shipped version fetches a tag
into its own ref and resolves locally.

Seen, not ours: after the node repair the scratch instance attached to the user's engine already
serving on 48188 and delegated a restart; the request file landed in the SCRATCH root
(`.engine-restart-request.json`), never the repo engine (same as MPI-1126). Second run was killed
at the landed line, before that point.

## Tests

- `tests/engine-in-place-upgrade.test.cjs` § 8: Windows steps run the engine python, never git,
  pass repo + pinned ref, shallow fetch, force checkout of the pin; linux/darwin keep git.
- `npm test`: 3415 tests, 3413 pass, 0 fail, 2 skipped. eslint clean on both files.
