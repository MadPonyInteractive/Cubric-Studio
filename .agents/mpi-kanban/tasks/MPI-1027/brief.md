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
4. **Pick the right bundle.** From 2.0.1 on, every release ships a FULL update bundle,
   because one release per change means users skip versions and a delta serves only installs
   exactly one behind (MPI-1026). A smarter updater could take a delta when its `fromVersion`
   matches and fall back to the full bundle otherwise, cutting the ~540 MB download.

## Constraint that shapes the rollout

The updater that runs is the one ALREADY installed. Whatever ships in 2.1 is first seen on
the 2.1 -> next update, so land it early in the 2.1 work.
