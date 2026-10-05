# MPI-1020 Brief

Refresh the GitHub README for 2.0: current screenshots (taken from the docs site), the 2.0
feature set, and the docs links that moved off `/vision/`. Fabio, 2026-10-05: the old "Video
generation" clip stays; the UI screenshots were what needed updating.

## Noticed

- **The docs site still shows the old app in 40 of its 88 full-window screenshots.** A pixel
  check of the title-bar text in `C:/AI/Mpi/Cubric Studio (Docs)/assets/docs/` (2026-10-05)
  found the pink 1.x "Cubric Vision" title on 40 and "Cubric Studio" on 48; 17 of the 26 in
  `prompt-box/` and 4 of the 5 in `video-tools/` are old captures. The README avoided them. A
  re-capture pass belongs to the Docs repo's own board.
- **Smart App Control is only in the release body and the README.** The 2.0 notes list it as a
  known Windows first-launch issue (double-click does nothing, no message), but neither the
  docs site's `installation/` nor its getting-started page mentions it (grep of the Docs repo,
  2026-10-05). Xcode Command Line Tools for macOS is covered there.
