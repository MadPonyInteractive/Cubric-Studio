# MPI-1027 - Update experience (target: 2.1)

Fabio, 2026-10-05, during the 2.0.1 release: when the user presses Update they should first
see what is about to change, then a splash-style screen instead of a terminal while it
updates, then the app starting again instead of being left at the desktop.

## What happens today (read 2026-10-05)

- **No preview.** `check-for-update` (`main.js`) fetches `releases/latest` but returns only
  the version; `js/services/updateChecker.js` prompts with the number alone.
- **The terminal.** In-app Update on Windows spawns `update/win-update.cjs` as node through
  our own exe (`run-update`, `main.js`) with `detached: true`, which gives the child its own
  console window. Linux/macOS run `update.sh` / `update.command`.
- **Relaunch.** `win-update.cjs` relaunches the app on both outcomes (MPI-422). The manual
  `update-from-zip.bat` never relaunches - that is the "left at the desktop" path, and the one
  the 2.0.0 update test used.

## The work

1. **Preview before Update.** Show the notes of every release between the installed version
   and latest (GitHub release bodies, or a structured notes asset), styled like
   `MpiChangelogDialog`, with Update / Later.
2. **Splash instead of a terminal.** No console window; a small window in the splash style
   showing download %, applying, restarting. Hard part: the window cannot run from the files
   the update replaces (Windows locks a mapped `app.asar` / `icudtl.dat`).
3. **Relaunch on every path,** including the update-zip scripts, with the splash covering the
   gap.
4. **Download only the files that changed (Fabio, 2026-10-05: "the modern solution").** From
   2.0.1 every release ships ONE full update zip per platform (MPI-1026), ~540 MB, because
   today's updaters take one zip and a delta serves only installs exactly one behind. The new
   updater reads the latest full zip's own file list (`resources/cubric/update-manifest.json`,
   a SHA256 per file), compares it with the install, and fetches ONLY the changed files out of
   that zip by HTTP range (GitHub served the 2.0.0 asset with 206), plus the deletions. One
   step from any version, one zip per release, no chains, no baselines. Any failure falls back
   to the whole zip. Same idea as Steam manifests and electron-updater's differential download.
   Rejected: chained deltas (long, and one bad link blocks everyone behind it) and a patch
   from the previous version only (anyone two behind still gets the full zip).

## Constraint that shapes the rollout

The updater that runs is the one ALREADY installed. Whatever release first ships this is still
downloaded whole; every release after it is small for anyone on it or later. 1.4.x installs
can never benefit (their applier cannot take 2.0's files): they download the full build once.

**Not a release of its own (Fabio, 2026-10-05):** it rides with the next Flow release — the
video edit Flow or the 3D scene Flow, whichever lands first (both in other sessions).
