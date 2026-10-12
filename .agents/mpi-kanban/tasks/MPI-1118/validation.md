# MPI-1118 validation

## Cause, measured on the dev box (2026-10-12, read-only scan)

76 projects, 61 with no visual sidecar whose media exists:
- 51: every sidecar names the pre-2.0 `Documents\Cubric Vision\Projects\<name>` folder; the file is in the project's own Media. Never opened since the MPI-708 rename, so the MPI-898 heal never ran.
- 3: audio only (Add Foley Tutorial, AI Connections Tutorial, Fabio Dictation). The scan dropped audio outright.
- 7: no media at all (correctly blank).

## Fix

`relocationRebase()` extracted from `healRelocatedMeta()` (the rule, pure); the heal and `findRecentProjectThumbnail()` both use it. The landing scan never writes. Audio counts only with a waveform on disk, and any picture/clip outranks it.

## Checks

- `node --test tests/*project*.test.cjs tests/recent-project-thumbnail.test.cjs`: 47/47 pass, incl. 2 new cases (moved folder resolves and the sidecar bytes are unchanged; audio-only shows waveform, older picture outranks newer sound). eslint clean.
- Isolated instance (own profile + port 53761, never :3000), POST /list-projects: 68 of 76 have a cover (was 14-15), 0 covers point at a missing file. The 8 left: 7 empty projects, and The Failed Heist Tutorial (22 sounds, no waveform baked yet; baked on open by `/backfill-media-derivatives`).
