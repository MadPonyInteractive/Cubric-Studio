#!/bin/sh
# MPI-595: the whole body lives in main(), called on the LAST line. The update
# bundle ships this very file, and apply-update.cjs writes it with copyFileSync
# — an in-place truncate + rewrite of the same inode — while `sh` is still
# reading this script by byte offset. Without the wrapper the shell resumes at
# an offset into the NEW file after the applier returns, so the chmod pass and
# the quarantine strip below never run. A function body is parsed in full
# before its first line executes, which is what makes the rewrite survivable.
set -eu

main() {
  ROOT="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
  export CUBRIC_PORTABLE_ROOT="$ROOT"
  export MPI_RESOURCES_PATH="$ROOT/resources"

  if [ "${1:-}" = "" ]; then
    echo "Usage: update-from-zip.command path/to/CubricStudio-update.zip"
    echo
    echo "The argument may be the downloaded update .zip OR the FOLDER that Safari"
    echo "auto-extracted it into (Safari/Archive Utility unzips downloads by"
    echo "default). Both work — drag either onto this script in Terminal."
    exit 2
  fi
  # Accept a .zip file OR an already-extracted directory. macOS Safari/Archive
  # Utility auto-extracts a downloaded update .zip into a folder (and truncates a
  # long folder name), so a default-Safari user has a directory, not a zip
  # (MPI-62). apply-update.cjs handles both — just pass it through.
  if [ ! -e "$1" ]; then
    echo "Update bundle not found: $1"
    exit 2
  fi

  if [ -x "$ROOT/app/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron" ]; then
    ELECTRON_RUN_AS_NODE=1 "$ROOT/app/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron" "$ROOT/update/apply-update.cjs" -- --root "$ROOT" --bundle "$1"
  elif [ -x "$ROOT/app/node_modules/electron/dist/electron" ]; then
    ELECTRON_RUN_AS_NODE=1 "$ROOT/app/node_modules/electron/dist/electron" "$ROOT/update/apply-update.cjs" -- --root "$ROOT" --bundle "$1"
  else
    node "$ROOT/update/apply-update.cjs" --root "$ROOT" --bundle "$1"
  fi

  # Belt-and-suspenders: re-assert +x on the launchers from the WRAPPER too, not
  # only inside the applier (which is itself updated by the bundle, so an old
  # applier may lack the exec-bit fix). This wrapper always runs, so the launchers
  # end up executable regardless of applier version — restoring the Finder
  # double-click "open" path.
  for f in start.command start-with-terminal.command update.command update-from-zip.command; do
    [ -e "$ROOT/$f" ] && chmod +x "$ROOT/$f" 2>/dev/null || true
  done

  # Freshly-written / extracted files can carry Gatekeeper quarantine. Strip it from
  # the whole tree so the updated launchers + Electron.app open without a block.
  xattr -dr com.apple.quarantine "$ROOT" 2>/dev/null || true
}

# `; exit $?` on the SAME line matters: without it the shell, having run
# main, reads on from its saved byte offset into the REWRITTEN file and
# executes whatever now sits there (measured — it ran the new body).
main "$@"; exit $?
