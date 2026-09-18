#!/usr/bin/env sh
# Install a per-user .desktop entry + icon so the Linux taskbar/dock shows
# "Cubric Studio" and our logo instead of "Electron" + the default Electron icon.
#
# Why this is needed: the portable app runs the unpackaged `electron` binary
# directly. On X11 the window's WM_CLASS comes from package.json `name`
# (cubric-vision) and on Wayland the app_id comes from `desktopName`
# (cubric-vision.desktop). GNOME/KDE map that class to an icon ONLY via a
# matching .desktop file (StartupWMClass=) whose Icon= resolves through the
# hicolor icon theme. No system install step exists for a portable app, so the
# launcher calls this on first run. Everything is written under ~/.local — no
# root required. Re-running is cheap and idempotent (paths are refreshed in case
# the portable folder moved).
#
# This script lives in <portable-root>/resources/. Both launchers export
# CUBRIC_PORTABLE_ROOT before calling it; when run standalone we derive the
# portable root as the parent of this script's resources/ directory.
#
# MPI-595: the whole body lives in main(), called on the LAST line. An update
# bundle ships this very file, and apply-update.cjs writes it with copyFileSync
# — an in-place truncate + rewrite of the same inode — so a copy that is
# running when an update lands would otherwise resume at an offset into the NEW
# file. A function body is parsed in full before its first line executes.
set -eu

main() {
  ROOT="${CUBRIC_PORTABLE_ROOT:-$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)}"
  ICON_SRC="$ROOT/resources/cubric-vision.png"
  LAUNCHER="$ROOT/start.sh"

  APPS_DIR="$HOME/.local/share/applications"
  ICON_DIR="$HOME/.local/share/icons/hicolor/256x256/apps"
  DESKTOP_FILE="$APPS_DIR/cubric-vision.desktop"

  # Nothing to install if the icon is missing (e.g. a stripped build).
  [ -f "$ICON_SRC" ] || exit 0

  mkdir -p "$APPS_DIR" "$ICON_DIR"
  cp -f "$ICON_SRC" "$ICON_DIR/cubric-vision.png" 2>/dev/null || true

  # Heredoc body stays at column 0 — indenting it would write the leading
  # whitespace straight into the .desktop file.
  cat > "$DESKTOP_FILE" <<EOF
[Desktop Entry]
Type=Application
Name=Cubric Studio
Comment=Local Open Source Image and Video Generator
Exec="$LAUNCHER"
Icon=cubric-vision
Terminal=false
Categories=Graphics;Photography;AudioVideo;
StartupWMClass=cubric-vision
StartupNotify=true
EOF

  # Refresh the desktop database + icon cache where the tools exist. All optional;
  # the .desktop/icon files alone are enough on most DEs after the next relogin.
  update-desktop-database "$APPS_DIR" >/dev/null 2>&1 || true
  gtk-update-icon-cache "$HOME/.local/share/icons/hicolor" >/dev/null 2>&1 || true

  exit 0
}

# `; exit $?` on the SAME line matters: without it the shell, having run
# main, reads on from its saved byte offset into the REWRITTEN file and
# executes whatever now sits there (measured — it ran the new body).
main "$@"; exit $?
