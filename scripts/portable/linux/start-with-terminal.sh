#!/usr/bin/env sh
# MPI-595: the whole body lives in main(), called on the LAST line. An update
# bundle ships this very file, and apply-update.cjs writes it with copyFileSync
# — an in-place truncate + rewrite of the same inode — so a launcher that is
# running when an update lands would otherwise resume at an offset into the NEW
# file. A function body is parsed in full before its first line executes.
set -eu

main() {
  ROOT="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
  export CUBRIC_PORTABLE_ROOT="$ROOT"
  export CUBRIC_ENGINE_ROOT="$ROOT/engine"
  export CUBRIC_MODELS_ROOT="$ROOT/models"
  export CUBRIC_USER_DATA_ROOT="$ROOT/user-data"
  export MPI_RESOURCES_PATH="$ROOT/resources"
  if [ -x "$ROOT/uv/uv" ]; then
    export CUBRIC_UV_BIN="$ROOT/uv/uv"
  fi

  # Install/refresh the per-user .desktop entry + icon so the taskbar shows
  # "Cubric Studio" and our logo (not "Electron"). Idempotent and non-fatal.
  if [ -f "$ROOT/resources/setup-desktop.sh" ]; then
    sh "$ROOT/resources/setup-desktop.sh" >/dev/null 2>&1 || true
  fi

  cd "$ROOT/app"
  # Prefer the bundled Electron binary directly. The node_modules/.bin/electron
  # shim is a symlink that does not survive archiving on all platforms, so do not
  # rely on it. Fall back to the shim, then npm, only if the binary is absent.
  ELECTRON_BIN="node_modules/electron/dist/electron"
  if [ -f "$ELECTRON_BIN" ]; then
    [ -x "$ELECTRON_BIN" ] || chmod +x "$ELECTRON_BIN" 2>/dev/null || true
    "$ELECTRON_BIN" .
  elif [ -x "node_modules/.bin/electron" ]; then
    "node_modules/.bin/electron" .
  else
    npm start
  fi
}

# `; exit $?` on the SAME line matters: without it the shell, having run
# main, reads on from its saved byte offset into the REWRITTEN file and
# executes whatever now sits there (measured — it ran the new body).
main "$@"; exit $?
