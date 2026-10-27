# Unreleased — pending notes for the next version bump

> Scratchpad for changelog items accumulated between releases. When running
> `/mpi-version-bump`, fold every item below into the new
> `RELEASE_NOTES['<newVersion>']` entry in `js/data/releaseNotes.js` and the
> archival `docs/releases/YYYY-MM-DD-v<newVersion>.md`, then clear this file
> back to the header.
>
> **Cleared 2026-10-27 at the 2.1.3 bump (MPI-1286).** Every item was folded into
> `RELEASE_NOTES['2.1.3']` and `docs/releases/2026-10-27-v2.1.3.md`, cut short and merged where they
> belonged together, plus MPI-1239, MPI-1249 (MOSS styles), MPI-1294 and AUDIT B1 straight from their commits.
>
> **Cleared 2026-10-21 at the 2.1.2 bump (MPI-1210).** Every item was folded into
> `RELEASE_NOTES['2.1.2']` and `docs/releases/2026-10-21-v2.1.2.md`, plus MPI-1216, MPI-1220, MPI-1221,
> MPI-1223 to MPI-1226, MPI-1228, MPI-1229, MPI-1234, MPI-1236 and MPI-1238 straight from their commits.
>
> **Cleared 2026-10-19 at the 2.1.1 bump (MPI-1044).** MPI-1199 (the RunPod volume create) was
> folded into `RELEASE_NOTES['2.1.1']` and `docs/releases/2026-10-19-v2.1.1.md`; the re-cut added
> MPI-1201, MPI-1202, MPI-1203, MPI-1205 and MPI-1206 straight from their commits (none passed through this file).
>
> **Cleared 2026-10-19 at the 2.1.0 bump (MPI-1044).** Every item was folded into
> `RELEASE_NOTES['2.1.0']` and `docs/releases/2026-10-19-v2.1.0.md`; the engine line was
> corrected to 0.41.0 and the CubricVision.exe line moved to Important.
>
> **Cleared 2026-10-06 at the 2.0.1 publish (MPI-1026).** The one item here (the Settings
> microphone, MPI-1034) was folded into `RELEASE_NOTES['2.0.1']` and
> `docs/releases/2026-10-06-v2.0.1.md`; the other six 2.0.1 fixes never passed through this
> file and were written into those two files straight from their commits.
>
> **Cleared 2026-10-04 at the 2.0.0 bump (MPI-595).** Every item was folded into
> `RELEASE_NOTES['2.0.0']` and `docs/releases/2026-10-04-v2.0.0.md`, cut to one or two
> lines each; the Known issues lines (release body only, never `releaseNotes.js`) moved to
> that archival note's last section. The 1.6.x private-build entries were deleted, not
> folded: their content was already here.
>
> **Cleared 2026-08-15 after 1.4.2 shipped.** All nine items (4 new + 5 fixes) were
> folded into `RELEASE_NOTES['1.4.2']` and `docs/releases/2026-08-15-v1.4.2.md`.
>
> **Cleared 2026-08-11 after 1.4.1 shipped.** All nine bullets (1 new + 8 fixes)
> were folded into `RELEASE_NOTES['1.4.1']` and
> `docs/releases/2026-08-11-v1.4.1.md`, including the first-run entry an earlier
> commit (`e2b0ddbf`) had filed for 1.5.0 — Fabio retargeted the whole scratchpad
> at the patch, because nothing pending was a feature.
>
> **The reset is part of the bump and it got missed in 1.4.0** — the fold ran, the
> clear did not, which would have re-folded all of 1.4.0 into the next version and
> shipped every bullet twice. If you are folding a release and this file still holds
> the last one's items, that is the bug, not a backlog.
>
> **KEEP EVERY BULLET SHORT.** One or two lines: what it is, and why the user would care.
> The rule and what it looks like are in `docs/releases/README.md` § Content → "Length".
>
> **Before writing a "used to / previously / no longer" claim, check it against the
> last released tag** (`git show v<prev>:<path>`), per bullet. Code that changed two
> or three times inside one unreleased version reads like user-visible history but
> never shipped, and the entry is then simply false. Full gate:
> `.claude/skills/mpi-release/references/copy-review.md` § Gate 0.

- **Card info opens at once, in info mode.** Hovering a gallery card shows its info card straight away, and only while the gallery info toggle (I) is on. It closes the moment you leave the card and never blocks the card next to it. (MPI-1308)
